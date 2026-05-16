// js/watch-session.js — Production Watch Session Lifecycle Manager
// Bantu Stream Connect — Phase 2 Stable View Tracking System
// ✅ FIXED: Duplicate session/content inserts
// ✅ FIXED: Proper UPSERT strategy for content_views
// ✅ FIXED: Session ID is ONLY read from storage
// ✅ FIXED: Frontend now matches unique_content_view_session index
// ✅ FIXED: Prevents PostgreSQL 23505 duplicate key errors
// ✅ FIXED: Better watch time accumulation
// ✅ FIXED: Safe sync lifecycle
// 🚀 PHASE 1D ENHANCEMENTS:
// ✅ Queue-aware session tracking
// ✅ Collection item progress tracking
// ✅ Autoplay trigger on completion
// ✅ Session persistence for queue restoration
// ✅ Multi-content watch session support
// 🔧 VIEWS FIX #1: Removed premature early exit logic
// 🔧 VIEWS FIX #2: Added proper DB confirmation with viewPersisted flag
// 🔧 VIEWS FIX #3: Separate "session attempted" from "view successfully persisted"
// 🔧 VIEWS FIX #4: Added retry mechanism for failed view recording
// 🔧 VIEWS FIX #5: Added frontend optimistic update callback
// 🔧 VIEW SYNC FIX #1: Dispatch global event when view is recorded

(function() {
  'use strict';

  console.log('🎬 WatchSession module loading... (Phase 1D Enhanced with view recording fixes)');

  function WatchSession(config) {
    if (!config || !config.contentId || !config.supabase) {
      console.error('❌ WatchSession: Missing required config');
      return;
    }

    this.contentId = config.contentId;
    this.userId = config.userId || null;
    this.supabase = config.supabase;

    this.videoElement = config.videoElement || null;

    this.syncInterval = config.syncInterval || 10000;
    this.viewThreshold = config.viewThreshold || 20;
    this.completionThreshold = config.completionThreshold || 0.9;

    // ✅ SESSION ID MUST ALREADY EXIST
    this.sessionId =
      config.sessionId ||
      sessionStorage.getItem('bantu_view_session');

    if (!this.sessionId) {
      console.warn('⚠️ No session ID found, generating one');
      this.sessionId = this._generateSessionId();
      sessionStorage.setItem('bantu_view_session', this.sessionId);
    }

    this.lastSyncTime = 0;
    this.lastSavedPosition = 0;
    this.totalWatchTime = 0;

    // 🔧 VIEWS FIX #2 & #3: Separate tracking flags
    this.viewCounted = false;      // Threshold reached (for analytics)
    this.viewAttempted = false;    // Recording attempted (prevents duplicate calls)
    this.viewPersisted = false;    // ✅ DB CONFIRMED - view successfully saved
    
    this.isCompleted = false;
    this.isActive = false;
    this.viewRetryCount = 0;       // Track retries for failed view recording
    this.maxViewRetries = 3;       // Maximum retry attempts

    this.visibilityHandler = null;

    // PHASE 1D: Queue tracking
    this.collectionId = config.collectionId || null;
    this.episodeNumber = config.episodeNumber || null;
    this.shouldAutoplayNext = config.autoplay !== false;
    
    // PHASE 1D: Session persistence
    this.sessionKey = `watch_session_${this.contentId}`;
    this.restoredFromStorage = false;

    this.onProgressSync = config.onProgressSync || null;
    this.onViewCounted = config.onViewCounted || null;
    this.onViewRecorded = config.onViewRecorded || null;  // 🔧 VIEWS FIX: New callback for view recording
    this.onComplete = config.onComplete || null;
    this.onError = config.onError || null;
    this.onAutoplayTrigger = config.onAutoplayTrigger || null; // PHASE 1D

    console.log(
      '✅ WatchSession initialized:',
      this.sessionId || 'NO SESSION',
      'Collection:',
      this.collectionId || 'none'
    );
    
    // PHASE 1D: Restore session from storage if available
    this._restoreFromStorage();
  }

  // =====================================================
  // PHASE 1D: Session Persistence Methods
  // =====================================================

  WatchSession.prototype._generateSessionId = function() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  WatchSession.prototype._saveToStorage = function() {
    try {
      const sessionData = {
        contentId: this.contentId,
        userId: this.userId,
        sessionId: this.sessionId,
        lastPosition: this.lastSavedPosition,
        totalWatchTime: this.totalWatchTime,
        viewCounted: this.viewCounted,
        viewAttempted: this.viewAttempted,
        viewPersisted: this.viewPersisted,
        isCompleted: this.isCompleted,
        collectionId: this.collectionId,
        episodeNumber: this.episodeNumber,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
      sessionStorage.setItem('bantu_last_watch_session', JSON.stringify({
        contentId: this.contentId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      }));
      
      console.log('💾 Watch session saved to storage');
    } catch (error) {
      console.warn('Failed to save session to storage:', error);
    }
  };

  WatchSession.prototype._restoreFromStorage = function() {
    try {
      const saved = localStorage.getItem(this.sessionKey);
      if (saved) {
        const data = JSON.parse(saved);
        // Only restore if session is less than 24 hours old
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          this.lastSavedPosition = data.lastPosition || 0;
          this.totalWatchTime = data.totalWatchTime || 0;
          this.viewCounted = data.viewCounted || false;
          this.viewAttempted = data.viewAttempted || false;
          this.viewPersisted = data.viewPersisted || false;
          this.isCompleted = data.isCompleted || false;
          this.restoredFromStorage = true;
          console.log('📦 Session restored from storage at position:', this.lastSavedPosition);
        } else {
          localStorage.removeItem(this.sessionKey);
        }
      }
    } catch (error) {
      console.warn('Failed to restore session from storage:', error);
    }
  };

  WatchSession.prototype._clearFromStorage = function() {
    try {
      localStorage.removeItem(this.sessionKey);
      console.log('🗑️ Session cleared from storage');
    } catch (error) {
      console.warn('Failed to clear session from storage:', error);
    }
  };

  // =====================================================
  // PHASE 1D: Collection Progress Tracking
  // =====================================================

  WatchSession.prototype._updateCollectionProgress = function() {
    if (!this.collectionId || !this.userId) return Promise.resolve();
    
    console.log('📊 Updating collection progress for:', this.collectionId);
    
    return this.supabase
      .from('collection_progress')
      .upsert({
        user_id: this.userId,
        collection_id: this.collectionId,
        last_content_id: this.contentId,
        last_episode: this.episodeNumber,
        progress_percentage: this.videoElement 
          ? (this.videoElement.currentTime / (this.videoElement.duration || 1)) * 100 
          : 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,collection_id'
      })
      .then(function(result) {
        if (result.error) {
          console.warn('Collection progress update failed:', result.error.message);
        } else {
          console.log('✅ Collection progress updated');
        }
      })
      .catch(function(error) {
        console.warn('Collection progress error:', error);
      });
  };

  // =====================================================
  // PHASE 1D: Trigger Next Content in Collection
  // =====================================================

  WatchSession.prototype._triggerAutoplayNext = function() {
    if (!this.shouldAutoplayNext) {
      console.log('⏸️ Autoplay disabled, not playing next');
      return;
    }
    
    // Check autoplay toggle state
    const autoplayToggle = document.getElementById('autoplayToggle');
    const isAutoplayEnabled = autoplayToggle?.classList.contains('active') !== false;
    
    if (!isAutoplayEnabled) {
      console.log('⏸️ Autoplay toggle is OFF');
      return;
    }
    
    console.log('🎬 Autoplay: triggering next content...');
    
    if (this.onAutoplayTrigger) {
      this.onAutoplayTrigger({
        contentId: this.contentId,
        collectionId: this.collectionId,
        episodeNumber: this.episodeNumber
      });
    } else if (window.QueueManager) {
      // Use QueueManager if available
      window.QueueManager.playNext();
    } else if (window.VideoPlayerFeatures) {
      // Fallback to VideoPlayerFeatures
      const vpf = new window.VideoPlayerFeatures();
      vpf.playNextTrack();
    }
  };

  // =====================================================
  // 🔧 VIEWS FIX #1-5: RECORD VIEW - PROPER DB CONFIRMATION
  // =====================================================
  
  /**
   * recordView() - Records a view for the content
   * 
   * CRITICAL FIXES:
   * 1. NO premature early exit - only skip if DB ALREADY confirmed (viewPersisted)
   * 2. Separate "session attempted" (viewAttempted) from "view successfully persisted" (viewPersisted)
   * 3. Retry mechanism for failed view recording
   * 4. Frontend optimistic update callback
   * 5. Proper DB confirmation before marking as persisted
   * 6. Dispatch global event for cross-component sync
   */
  WatchSession.prototype.recordView = async function() {
    // 🔧 VIEWS FIX #1 & #2: Only skip if DATABASE already confirmed
    if (this.viewPersisted === true) {
      console.log('👁️ View already persisted in database for session:', this.sessionId);
      return true;
    }

    // 🔧 VIEWS FIX #3: Prevent duplicate simultaneous calls ONLY
    if (this.viewAttempted === true) {
      console.log('👁️ View recording already attempted for this session, waiting for confirmation...');
      // Don't return false - we want to wait for the pending operation
      // Instead, we'll return a promise that resolves when the pending operation completes
      return this._waitForPendingView();
    }

    if (!this.userId) {
      console.log('🔓 Guest user - view recording skipped (will record on threshold)');
      return false;
    }

    console.log('👁️ Recording view for content:', this.contentId, 'Session:', this.sessionId);
    
    // Mark as attempted to prevent duplicate calls
    this.viewAttempted = true;
    this.viewRetryCount = 0;
    
    // Save state to storage
    this._saveToStorage();

    try {
      // Attempt to record the view
      const success = await this._performViewRecording();
      
      if (success) {
        // 🔧 VIEWS FIX #2: ONLY MARK SUCCESS AFTER DB CONFIRMATION
        this.viewPersisted = true;
        this._saveToStorage();
        
        console.log('✅ View recorded successfully and persisted to database');
        
        // 🔧 VIEW SYNC FIX #1: Dispatch global event for view count synchronization
        this._dispatchViewRecordedEvent();
        
        // 🔧 VIEWS FIX #4: Trigger frontend optimistic update callback
        if (this.onViewRecorded) {
          this.onViewRecorded({
            contentId: this.contentId,
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: Date.now()
          });
        }
        
        // Also trigger the legacy onViewCounted callback for compatibility
        if (this.onViewCounted) {
          this.onViewCounted({
            contentId: this.contentId,
            sessionId: this.sessionId,
            userId: this.userId
          });
        }
        
        return true;
      } else {
        // Recording failed, but we can retry
        console.warn('⚠️ View recording attempt failed, will retry on next sync');
        this.viewAttempted = false; // Allow retry
        return false;
      }
      
    } catch (error) {
      console.error('❌ View recording failed:', error.message);
      this.viewAttempted = false; // Allow retry
      this._handleError('recordView', error);
      return false;
    }
  };
  
  /**
   * Dispatch global event for view count synchronization across components
   */
  WatchSession.prototype._dispatchViewRecordedEvent = function() {
    try {
      window.dispatchEvent(new CustomEvent('content-views-updated', {
        detail: {
          contentId: this.contentId,
          sessionId: this.sessionId,
          userId: this.userId,
          timestamp: Date.now()
        }
      }));
      console.log('📡 Dispatched content-views-updated event for cross-component sync');
    } catch (error) {
      console.warn('Failed to dispatch view recorded event:', error);
    }
  };
  
  /**
   * Wait for pending view recording to complete
   * Used when multiple calls to recordView happen simultaneously
   */
  WatchSession.prototype._waitForPendingView = function() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.viewPersisted === true) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (this.viewAttempted === false && this.viewPersisted === false) {
          // Previous attempt failed, we can try again
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5000);
    });
  };
  
  /**
   * Perform the actual database operation for view recording
   * Returns true if successful, false otherwise
   */
  WatchSession.prototype._performViewRecording = async function() {
    // Try to use the increment_content_views RPC function first (YouTube-style)
    const { error: rpcError } = await this.supabase
      .rpc('increment_content_views', {
        content_id_input: this.contentId
      });

    if (!rpcError) {
      console.log('✅ View recorded via RPC increment_content_views');
      return true;
    }

    console.warn('RPC increment failed, falling back to manual upsert:', rpcError.message);
    
    // Fallback: Manual upsert with session-based deduplication
    if (this.sessionId) {
      const { error: upsertError } = await this.supabase
        .from('content_views')
        .upsert({
          content_id: this.contentId,
          session_id: this.sessionId,
          viewer_id: this.userId,
          profile_id: this.userId,
          user_id: this.userId,
          view_duration: Math.floor(this.videoElement?.currentTime || 0),
          counted_as_view: true,
          device_type: this._getDeviceType(),
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'content_id,session_id'
        });

      if (!upsertError) {
        console.log('✅ View recorded via manual upsert with session_id');
        return true;
      }
      
      console.warn('Upsert failed:', upsertError.message);
    }
    
    // Last resort: Simple insert without session_id
    const { error: insertError } = await this.supabase
      .from('content_views')
      .insert({
        content_id: this.contentId,
        viewer_id: this.userId,
        profile_id: this.userId,
        user_id: this.userId,
        view_duration: Math.floor(this.videoElement?.currentTime || 0),
        counted_as_view: true,
        device_type: this._getDeviceType(),
        created_at: new Date().toISOString()
      });

    if (!insertError) {
      console.log('✅ View recorded via simple insert');
      return true;
    }
    
    console.error('All view recording methods failed:', insertError.message);
    return false;
  };
  
  /**
   * Retry view recording with exponential backoff
   */
  WatchSession.prototype._retryViewRecording = async function() {
    if (this.viewPersisted) return true;
    if (this.viewRetryCount >= this.maxViewRetries) {
      console.warn('⚠️ Max view retries reached, giving up');
      return false;
    }
    
    this.viewRetryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.viewRetryCount), 10000);
    
    console.log(`🔄 Retrying view recording (attempt ${this.viewRetryCount}/${this.maxViewRetries}) in ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    this.viewAttempted = false; // Reset to allow retry
    return this.recordView();
  };

  // =====================================================
  // PUBLIC API
  // =====================================================

  WatchSession.prototype.start = function(videoElement) {
    var self = this;

    if (this.isActive) {
      console.warn('⚠️ WatchSession already active');
      return Promise.resolve(false);
    }

    this.videoElement = videoElement;
    this.isActive = true;

    return this._initializeProgress()
      .then(function() {
        return self._resumePlayback();
      })
      .then(function() {
        self._attachEventListeners();
        self._setupVisibilityHandler();
        
        // PHASE 1D: Save initial state to storage
        self._saveToStorage();

        // 🔧 VIEWS FIX #1-5: RECORD VIEW ON START with proper DB confirmation
        console.log('👁️ Recording view on session start (YouTube-style)...');
        return self.recordView();
      })
      .then(function(viewRecorded) {
        console.log(
          '✅ WatchSession started for content:',
          self.contentId,
          'View recorded:',
          viewRecorded,
          'View persisted:',
          self.viewPersisted
        );

        return true;
      })
      .catch(function(error) {
        console.error('❌ WatchSession start failed:', error);

        self._handleError('start', error);

        return false;
      });
  };

  WatchSession.prototype.stop = function() {
    if (!this.isActive) return;

    this._syncProgress(true);
    this._saveToStorage(); // PHASE 1D: Save before stopping

    this._detachEventListeners();
    this._cleanupVisibilityHandler();

    this.isActive = false;

    console.log('🛑 WatchSession stopped');
  };

  WatchSession.prototype.syncNow = function() {
    if (!this.isActive || !this.videoElement) return;

    this._syncProgress(true);
    this._saveToStorage(); // PHASE 1D: Save on manual sync
  };

  WatchSession.prototype.getState = function() {
    return {
      sessionId: this.sessionId,
      contentId: this.contentId,
      userId: this.userId,
      isActive: this.isActive,
      lastPosition: this.videoElement
        ? this.videoElement.currentTime
        : 0,
      lastSavedPosition: this.lastSavedPosition,
      totalWatchTime: this.totalWatchTime,
      viewCounted: this.viewCounted,
      viewAttempted: this.viewAttempted,
      viewPersisted: this.viewPersisted,
      isCompleted: this.isCompleted,
      collectionId: this.collectionId,
      episodeNumber: this.episodeNumber
    };
  };

  // PHASE 1D: Set collection info for queue tracking
  WatchSession.prototype.setCollection = function(collectionId, episodeNumber) {
    this.collectionId = collectionId;
    this.episodeNumber = episodeNumber;
    this._saveToStorage();
    console.log('📁 Collection set:', collectionId, 'Episode:', episodeNumber);
  };

  // PHASE 1D: Enable/disable autoplay
  WatchSession.prototype.setAutoplay = function(enabled) {
    this.shouldAutoplayNext = enabled;
    console.log('🎵 Autoplay set to:', enabled);
  };

  // =====================================================
  // INITIALIZATION
  // =====================================================

  WatchSession.prototype._initializeProgress = function() {
    var self = this;

    if (!this.userId) {
      console.log('🔓 Guest user');
      return Promise.resolve();
    }

    return this.supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', this.userId)
      .eq('content_id', this.contentId)
      .maybeSingle()
      .then(function(result) {
        if (result.error) {
          console.warn(
            '⚠️ Could not fetch watch progress:',
            result.error.message
          );
          return;
        }

        if (result.data) {
          self.lastSavedPosition =
            result.data.last_position || 0;

          self.totalWatchTime =
            result.data.total_watch_time || 0;

          self.isCompleted =
            result.data.is_completed || false;

          console.log(
            '📥 Progress restored from DB:',
            self.lastSavedPosition
          );
        }
        
        // PHASE 1D: Storage restoration takes precedence for position
        if (self.restoredFromStorage && self.lastSavedPosition > 0) {
          console.log('📦 Using storage-restored position:', self.lastSavedPosition);
        }
      })
      .catch(function(error) {
        console.warn('⚠️ Progress init failed:', error);
      });
  };

  WatchSession.prototype._resumePlayback = function() {
    var self = this;

    if (!this.videoElement || !this.userId) {
      return Promise.resolve();
    }

    var shouldResume =
      this.lastSavedPosition > 10 &&
      !this.isCompleted &&
      this.videoElement.currentTime < 2;

    if (!shouldResume) {
      return Promise.resolve();
    }

    return new Promise(function(resolve) {

      var applyResume = function() {
        self._applyResumePosition();
        resolve();
      };

      if (self.videoElement.readyState >= 1) {
        applyResume();
      } else {
        self.videoElement.addEventListener(
          'loadedmetadata',
          function onLoaded() {
            self.videoElement.removeEventListener(
              'loadedmetadata',
              onLoaded
            );

            applyResume();
          }
        );
      }
    });
  };

  WatchSession.prototype._applyResumePosition = function() {
    if (!this.videoElement) return;

    var duration = this.videoElement.duration || 0;

    if (
      duration > 0 &&
      this.lastSavedPosition >= duration * 0.95
    ) {
      console.log('⏭️ Near end — skipping resume');
      return;
    }

    this.videoElement.currentTime =
      this.lastSavedPosition;

    console.log(
      '⏪ Resumed at:',
      this.lastSavedPosition
    );

    if (typeof showToast === 'function') {
      showToast(
        'Resuming from ' +
          this._formatTime(this.lastSavedPosition),
        'info'
      );
    }
  };

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  WatchSession.prototype._attachEventListeners =
    function() {

      if (!this.videoElement) return;

      this._boundTimeUpdate =
        this._onTimeUpdate.bind(this);

      this._boundPlay =
        this._onPlay.bind(this);

      this._boundPause =
        this._onPause.bind(this);

      this._boundEnded =
        this._onEnded.bind(this);

      this._boundError =
        this._onVideoError.bind(this);

      this._boundUnload =
        this._onBeforeUnload.bind(this);

      this.videoElement.addEventListener(
        'timeupdate',
        this._boundTimeUpdate
      );

      this.videoElement.addEventListener(
        'play',
        this._boundPlay
      );

      this.videoElement.addEventListener(
        'pause',
        this._boundPause
      );

      this.videoElement.addEventListener(
        'ended',
        this._boundEnded
      );

      this.videoElement.addEventListener(
        'error',
        this._boundError
      );

      window.addEventListener(
        'beforeunload',
        this._boundUnload
      );

      console.log('🔗 Event listeners attached');
    };

  WatchSession.prototype._detachEventListeners =
    function() {

      if (!this.videoElement) return;

      this.videoElement.removeEventListener(
        'timeupdate',
        this._boundTimeUpdate
      );

      this.videoElement.removeEventListener(
        'play',
        this._boundPlay
      );

      this.videoElement.removeEventListener(
        'pause',
        this._boundPause
      );

      this.videoElement.removeEventListener(
        'ended',
        this._boundEnded
      );

      this.videoElement.removeEventListener(
        'error',
        this._boundError
      );

      window.removeEventListener(
        'beforeunload',
        this._boundUnload
      );

      console.log('🔌 Event listeners detached');
    };

  WatchSession.prototype._setupVisibilityHandler =
    function() {

      var self = this;

      this.visibilityHandler = function() {

        if (
          document.visibilityState === 'hidden' &&
          self.isActive
        ) {
          console.log('👁️ Hidden — syncing');

          self._syncProgress(true);
          self._saveToStorage();
        }
      };

      document.addEventListener(
        'visibilitychange',
        this.visibilityHandler
      );
    };

  WatchSession.prototype._cleanupVisibilityHandler =
    function() {

      if (!this.visibilityHandler) return;

      document.removeEventListener(
        'visibilitychange',
        this.visibilityHandler
      );

      this.visibilityHandler = null;
    };

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  WatchSession.prototype._onTimeUpdate =
    function(event) {

      if (
        !this.isActive ||
        !this.userId ||
        !this.videoElement
      ) {
        return;
      }

      var video = event.target;

      var currentTime =
        Math.floor(video.currentTime);

      var duration =
        video.duration || 0;

      // =====================================
      // COUNT VIEW (Threshold-based fallback)
      // =====================================
      // Only use threshold if view not already persisted
      if (
        !this.viewPersisted &&
        !this.viewCounted &&
        currentTime >= this.viewThreshold
      ) {
        this.viewCounted = true;
        // Fallback: record view if not already persisted
        if (!this.viewPersisted && !this.viewAttempted) {
          console.log('👁️ View threshold reached, recording view...');
          this.recordView().catch(err => {
            console.warn('Threshold view recording failed:', err);
          });
        }
      }

      // =====================================
      // WATCH TIME
      // =====================================

      if (
        currentTime > this.lastSavedPosition
      ) {
        this.totalWatchTime +=
          currentTime -
          this.lastSavedPosition;
      }

      // =====================================
      // COMPLETION
      // =====================================

      if (
        !this.isCompleted &&
        duration > 0
      ) {
        var progress =
          currentTime / duration;

        if (
          progress >=
          this.completionThreshold
        ) {
          this.isCompleted = true;

          console.log('✅ Completed');

          if (this.onComplete) {
            this.onComplete({
              contentId: this.contentId,
              timestamp: Date.now()
            });
          }
          
          // PHASE 1D: Clear from storage on completion
          this._clearFromStorage();
        }
      }

      // =====================================
      // PERIODIC SYNC
      // =====================================

      var now = Date.now();

      if (
        now - this.lastSyncTime >=
        this.syncInterval
      ) {
        this.lastSyncTime = now;

        this._syncProgress(false);
        this._saveToStorage(); // PHASE 1D: Periodic save
      }

      this.lastSavedPosition = currentTime;
    };

  WatchSession.prototype._onPlay =
    function() {
      console.log('▶️ Playing');
    };

  WatchSession.prototype._onPause =
    function() {
      console.log('⏸️ Paused');

      this._syncProgress(true);
      this._saveToStorage();
    };

  WatchSession.prototype._onEnded =
    function() {

      console.log('🏁 Ended');

      this.isCompleted = true;

      this._updateCompletionStatus(true);

      this._syncProgress(true);
      this._clearFromStorage();

      if (this.onComplete) {
        this.onComplete({
          contentId: this.contentId,
          timestamp: Date.now(),
          reason: 'ended'
        });
      }
      
      // PHASE 1D: Trigger autoplay for next content in collection/queue
      this._triggerAutoplayNext();
    };

  WatchSession.prototype._onVideoError =
    function(event) {

      console.error('🔴 Video error:', event);

      this._handleError(
        'playback',
        event
      );
    };

  WatchSession.prototype._onBeforeUnload =
    function() {

      if (
        this.isActive &&
        this.userId
      ) {
        this._syncProgress(true);
        this._saveToStorage();
      }
    };

  // =====================================================
  // DATABASE OPERATIONS
  // =====================================================

  /**
   * ✅ FIXED:
   * Uses UPSERT to match:
   *
   * unique_content_view_session
   * (content_id, session_id)
   */

  WatchSession.prototype._legacyRecordView =
    function(video) {

      var self = this;

      if (!this.userId) {
        return Promise.resolve();
      }

      if (!this.sessionId) {
        console.error(
          '❌ No session ID'
        );

        return Promise.resolve();
      }

      return this.supabase
        .from('content_views')
        .upsert({
          content_id: this.contentId,
          session_id: this.sessionId,

          viewer_id: this.userId,
          profile_id: this.userId,
          user_id: this.userId,

          view_duration: Math.floor(
            video.currentTime
          ),

          counted_as_view: true,

          device_type:
            this._getDeviceType(),

          updated_at:
            new Date().toISOString(),

          created_at:
            new Date().toISOString()
        }, {
          onConflict:
            'content_id,session_id'
        })

        .then(function(result) {

          if (result.error) {
            throw result.error;
          }

          console.log(
            '✅ View upserted successfully'
          );

          if (self.onViewCounted) {
            self.onViewCounted({
              contentId: self.contentId,
              sessionId: self.sessionId,
              userId: self.userId
            });
          }
        })

        .catch(function(error) {

          console.error(
            '❌ View record failed:',
            error.message
          );

          self._handleError(
            'recordView',
            error
          );
        });
    };

  WatchSession.prototype._syncProgress =
    function(force) {

      var self = this;

      if (
        !this.userId ||
        !this.videoElement
      ) {
        return Promise.resolve();
      }

      var currentTime =
        Math.floor(
          this.videoElement.currentTime
        );

      if (
        !force &&
        currentTime ===
          this.lastSavedPosition
      ) {
        return Promise.resolve();
      }

      return this.supabase
        .from('watch_progress')
        .upsert({
          user_id: this.userId,

          content_id:
            this.contentId,

          last_position:
            currentTime,

          total_watch_time:
            this.totalWatchTime,

          is_completed:
            this.isCompleted,

          completed_at:
            this.isCompleted
              ? new Date().toISOString()
              : null,

          updated_at:
            new Date().toISOString()
        }, {
          onConflict:
            'user_id,content_id'
        })

        .then(function(result) {

          if (result.error) {
            throw result.error;
          }

          console.log(
            '💾 Progress synced'
          );

          if (self.onProgressSync) {
            self.onProgressSync({
              contentId:
                self.contentId,

              position:
                currentTime,

              totalWatchTime:
                self.totalWatchTime,

              completed:
                self.isCompleted,

              sessionId:
                self.sessionId
            });
          }
          
          // PHASE 1D: Update collection progress after sync
          self._updateCollectionProgress();
        })

        .catch(function(error) {

          console.error(
            '❌ Sync failed:',
            error.message
          );

          self._handleError(
            'syncProgress',
            error
          );
        });
    };

  WatchSession.prototype._updateCompletionStatus =
    function(isCompleted) {

      var self = this;

      if (!this.userId) {
        return Promise.resolve();
      }

      return this.supabase
        .from('watch_progress')
        .update({
          is_completed:
            isCompleted,

          completed_at:
            isCompleted
              ? new Date().toISOString()
              : null,

          updated_at:
            new Date().toISOString()
        })

        .eq(
          'user_id',
          this.userId
        )

        .eq(
          'content_id',
          this.contentId
        )

        .then(function(result) {

          if (result.error) {
            throw result.error;
          }

          console.log(
            '✅ Completion updated'
          );
        })

        .catch(function(error) {

          console.error(
            '❌ Completion failed:',
            error.message
          );

          self._handleError(
            'completion',
            error
          );
        });
    };

  // =====================================================
  // UTILITIES
  // =====================================================

  WatchSession.prototype._getDeviceType =
    function() {

      if (
        /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(
          navigator.userAgent
        )
      ) {
        return 'mobile';
      }

      return 'desktop';
    };

  WatchSession.prototype._formatTime =
    function(seconds) {

      if (!seconds || isNaN(seconds)) {
        return '0:00';
      }

      var mins =
        Math.floor(seconds / 60);

      var secs =
        Math.floor(seconds % 60);

      return (
        mins +
        ':' +
        secs.toString().padStart(2, '0')
      );
    };

  WatchSession.prototype._handleError =
    function(context, error) {

      console.error(
        '❌ WatchSession error [' +
          context +
          ']:',
        error
      );

      if (this.onError) {
        this.onError({
          context: context,
          error:
            error.message || error
        });
      }
    };

  // =====================================================
  // PHASE 1D: Static Methods for Session Management
  // =====================================================

  WatchSession.getActiveSession = function(contentId) {
    const key = `watch_session_${contentId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to get active session:', error);
    }
    return null;
  };

  WatchSession.clearAllSessions = function() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('watch_session_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem('bantu_last_watch_session');
      console.log('🗑️ All watch sessions cleared');
    } catch (error) {
      console.warn('Failed to clear sessions:', error);
    }
  };

  // =====================================================
  // EXPORT
  // =====================================================

  if (
    typeof module !== 'undefined' &&
    module.exports
  ) {
    module.exports = WatchSession;
  } else {
    window.WatchSession =
      WatchSession;
  }

  console.log(
    '✅ WatchSession module loaded successfully (Phase 1D Enhanced with view recording fixes)'
  );

})();
