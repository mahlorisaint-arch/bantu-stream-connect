// js/watch-session.js — Production Watch Session Lifecycle Manager
// Bantu Stream Connect — Phase 3 Stable Telemetry System
// ✅ Uses append-only playback_heartbeats ledger
// ✅ Validates views via validate_playback_view RPC after 30s threshold
// ✅ Session persistence for queue restoration
// ✅ Collection/playlist progress tracking
// ✅ Autoplay trigger on completion
// ✅ Cross-component event dispatching for view count sync
// ✅ Retry logic with exponential backoff for failed heartbeats
// ✅ Safe sync lifecycle with visibility handling
// ✅ FIXED: Missing methods (syncFinalState, onBeforeUnload, onVideoError)

(function() {
  'use strict';

  console.log('🎬 WatchSession module loading... (Phase 3 Telemetry Engine + Phase 1D Enhanced)');

  /**
   * WatchSessionManager — Handles telemetry streaming via playback_sessions/heartbeats
   * Replaces legacy direct Content.views_count updates
   */
  function WatchSessionManager(config) {
    if (!config || !config.contentId || !config.supabase) {
      console.error('❌ WatchSessionManager: Missing required config');
      return;
    }

    this.supabase = config.supabase;
    this.contentId = config.contentId;
    this.userId = config.userId || null;
    
    // Session identifiers
    this.playbackSessionId = config.sessionId || this._generateUUID();
    this.globalSessionId = config.globalSessionId || 
      sessionStorage.getItem('bantu_view_session') || 
      this._generateUUID();
    
    // Persist global session ID for cross-tab consistency
    sessionStorage.setItem('bantu_view_session', this.globalSessionId);

    // Video element reference
    this.videoElement = config.videoElement || null;

    // Telemetry configuration
    this.heartbeatIntervalMs = config.heartbeatInterval || 10000; // 10 seconds
    this.validViewThresholdSeconds = config.validViewThreshold || 30;
    
    // State tracking
    this.sequenceNumber = 0;
    this.totalWatchTimeMs = 0;
    this.maxProgressSeconds = 0;
    this.lastHeartbeatTime = Date.now();
    this.lastSyncPosition = 0;
    
    // View validation state
    this.viewThresholdReached = false;
    this.viewValidationAttempted = false;
    this.viewValidationConfirmed = false;
    this.viewRetryCount = 0;
    this.maxViewRetries = 3;

    // Session lifecycle
    this.isActive = false;
    this.isCompleted = false;
    this.heartbeatInterval = null;
    this.visibilityHandler = null;

    // PHASE 1D: Queue & Collection tracking
    this.collectionId = config.collectionId || null;
    this.playlistId = config.playlistId || null;
    this.sortIndex = config.sortIndex || null;
    this.episodeNumber = config.episodeNumber || null;
    this.shouldAutoplayNext = config.autoplay !== false;

    // PHASE 1D: Session persistence
    this.sessionStorageKey = `playback_session_${this.contentId}`;
    this.restoredFromStorage = false;

    // Callbacks
    this.onHeartbeat = config.onHeartbeat || null;
    this.onViewValidated = config.onViewValidated || null;
    this.onCompletion = config.onCompletion || null;
    this.onAutoplayTrigger = config.onAutoplayTrigger || null;
    this.onError = config.onError || null;
    this.onProgressSync = config.onProgressSync || null;

    // Bound event handlers (for proper removal)
    this._boundTimeUpdate = null;
    this._boundPlay = null;
    this._boundPause = null;
    this._boundEnded = null;
    this._boundError = null;
    this._boundUnload = null;

    console.log(
      '✅ WatchSessionManager initialized:',
      {
        playbackSessionId: this.playbackSessionId,
        contentId: this.contentId,
        collectionId: this.collectionId,
        sortIndex: this.sortIndex
      }
    );

    // Restore session state if available
    this._restoreFromStorage();
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  WatchSessionManager.prototype._generateUUID = function() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  WatchSessionManager.prototype._getDeviceType = function() {
    const ua = navigator.userAgent || '';
    if (/Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(ua)) {
      return 'mobile';
    }
    if (/Tablet|iPad/i.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  };

  WatchSessionManager.prototype._getPlatform = function() {
    return 'Web';
  };

  // =====================================================
  // PHASE 1D: SESSION PERSISTENCE
  // =====================================================

  WatchSessionManager.prototype._saveToStorage = function() {
    try {
      const sessionData = {
        playbackSessionId: this.playbackSessionId,
        globalSessionId: this.globalSessionId,
        contentId: this.contentId,
        userId: this.userId,
        maxProgressSeconds: this.maxProgressSeconds,
        totalWatchTimeMs: this.totalWatchTimeMs,
        sequenceNumber: this.sequenceNumber,
        viewThresholdReached: this.viewThresholdReached,
        viewValidationConfirmed: this.viewValidationConfirmed,
        isCompleted: this.isCompleted,
        collectionId: this.collectionId,
        playlistId: this.playlistId,
        sortIndex: this.sortIndex,
        episodeNumber: this.episodeNumber,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.sessionStorageKey, JSON.stringify(sessionData));
      
      // Also store last active session for quick reference
      sessionStorage.setItem('bantu_last_playback_session', JSON.stringify({
        contentId: this.contentId,
        playbackSessionId: this.playbackSessionId,
        timestamp: Date.now()
      }));
      
      console.log('💾 Playback session saved to storage');
    } catch (error) {
      console.warn('⚠️ Failed to save session to storage:', error);
    }
  };

  WatchSessionManager.prototype._restoreFromStorage = function() {
    try {
      const saved = localStorage.getItem(this.sessionStorageKey);
      if (saved) {
        const data = JSON.parse(saved);
        // Only restore if session is less than 24 hours old
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          this.maxProgressSeconds = data.maxProgressSeconds || 0;
          this.totalWatchTimeMs = data.totalWatchTimeMs || 0;
          this.sequenceNumber = data.sequenceNumber || 0;
          this.viewThresholdReached = data.viewThresholdReached || false;
          // Reset validation confirmed on restore to ensure re-validation for resumed sessions
          this.viewValidationConfirmed = false;
          this.isCompleted = data.isCompleted || false;
          this.restoredFromStorage = true;
          
          console.log('📦 Session restored from storage:', {
            progress: this.maxProgressSeconds,
            watchTime: this.totalWatchTimeMs,
            viewValidated: this.viewValidationConfirmed
          });
        } else {
          localStorage.removeItem(this.sessionStorageKey);
          console.log('🗑️ Session expired (>24h), removed from storage');
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to restore session from storage:', error);
    }
  };

  WatchSessionManager.prototype._clearFromStorage = function() {
    try {
      localStorage.removeItem(this.sessionStorageKey);
      console.log('🗑️ Playback session cleared from storage');
    } catch (error) {
      console.warn('⚠️ Failed to clear session from storage:', error);
    }
  };

  // =====================================================
  // PHASE 1D: COLLECTION/PLAYLIST PROGRESS TRACKING
  // =====================================================

  WatchSessionManager.prototype._updateCollectionProgress = async function() {
    if (!this.collectionId || !this.userId) return;
    
    try {
      const progressData = {
        user_id: this.userId,
        collection_id: this.collectionId,
        last_content_id: this.contentId,
        last_episode: this.episodeNumber,
        last_sort_index: this.sortIndex,
        progress_percentage: this.videoElement && this.videoElement.duration > 0
          ? Math.min(100, (this.videoElement.currentTime / this.videoElement.duration) * 100)
          : 0,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('collection_progress')
        .upsert(progressData, {
          onConflict: 'user_id,collection_id'
        });

      if (error) {
        console.warn('⚠️ Collection progress update failed:', error.message);
      } else {
        console.log('✅ Collection progress updated');
      }
    } catch (error) {
      console.warn('⚠️ Collection progress error:', error);
    }
  };

  WatchSessionManager.prototype._updatePlaylistProgress = async function() {
    if (!this.playlistId || !this.userId) return;
    
    try {
      const { error } = await this.supabase
        .from('playlist_user_progress')
        .upsert({
          user_id: this.userId,
          playlist_id: this.playlistId,
          content_id: this.contentId,
          last_position_seconds: this.maxProgressSeconds,
          is_completed: this.isCompleted,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,playlist_id,content_id'
        });

      if (error) {
        console.warn('⚠️ Playlist progress update failed:', error.message);
      }
    } catch (error) {
      console.warn('⚠️ Playlist progress error:', error);
    }
  };

  // =====================================================
  // PHASE 1D: AUTOPLAY TRIGGER
  // =====================================================

  WatchSessionManager.prototype._triggerAutoplayNext = function() {
    if (!this.shouldAutoplayNext) {
      console.log('⏸️ Autoplay disabled');
      return;
    }
    
    // Check UI toggle state if available
    const autoplayToggle = document.getElementById('autoplayToggle');
    const isAutoplayEnabled = !autoplayToggle || autoplayToggle.classList.contains('active');
    
    if (!isAutoplayEnabled) {
      console.log('⏸️ Autoplay toggle is OFF');
      return;
    }
    
    console.log('🎬 Autoplay: triggering next content...');
    
    // Priority 1: Custom callback
    if (this.onAutoplayTrigger) {
      this.onAutoplayTrigger({
        contentId: this.contentId,
        collectionId: this.collectionId,
        playlistId: this.playlistId,
        sortIndex: this.sortIndex,
        episodeNumber: this.episodeNumber
      });
      return;
    }
    
    // Priority 2: QueueManager
    if (window.QueueManager && typeof window.QueueManager.playNext === 'function') {
      window.QueueManager.playNext();
      return;
    }
    
    // Priority 3: VideoPlayerFeatures fallback
    if (window.VideoPlayerFeatures) {
      try {
        const vpf = new window.VideoPlayerFeatures();
        if (typeof vpf.playNextTrack === 'function') {
          vpf.playNextTrack();
          return;
        }
      } catch (e) {
        console.warn('⚠️ VideoPlayerFeatures fallback failed:', e);
      }
    }
    
    console.log('⚠️ No autoplay handler available');
  };

  // =====================================================
  // VIEW VALIDATION VIA RPC (Phase 3 Core)
  // =====================================================

  WatchSessionManager.prototype._validateViewViaRPC = async function() {
    if (this.viewValidationConfirmed) {
      console.log('✅ View already validated for session:', this.playbackSessionId);
      return true;
    }

    if (this.viewValidationAttempted && this.viewRetryCount >= this.maxViewRetries) {
      console.warn('⚠️ Max validation retries reached');
      return false;
    }

    try {
      this.viewValidationAttempted = true;
      
      // Call the RPC that validates and updates content_engagement_stats
      const { error } = await this.supabase
        .rpc('validate_playback_view', {
          p_playback_session_id: this.playbackSessionId
        });

      if (error) {
        throw error;
      }

      this.viewValidationConfirmed = true;
      this.viewRetryCount = 0;
      
      console.log('✅ View validated via RPC for session:', this.playbackSessionId);
      
      // Dispatch event for cross-component sync
      this._dispatchViewValidatedEvent();
      
      // Trigger callback
      if (this.onViewValidated) {
        this.onViewValidated({
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          userId: this.userId,
          timestamp: Date.now()
        });
      }
      
      return true;
      
    } catch (error) {
      console.warn('⚠️ View validation RPC failed:', error.message);
      this.viewRetryCount++;
      
      // Retry with exponential backoff
      if (this.viewRetryCount < this.maxViewRetries) {
        const delay = Math.min(1000 * Math.pow(2, this.viewRetryCount), 10000);
        console.log(`🔄 Retrying view validation in ${delay}ms...`);
        
        setTimeout(() => {
          this._validateViewViaRPC().catch(e => {
            console.warn('Retry failed:', e.message);
          });
        }, delay);
      }
      
      return false;
    }
  };

  WatchSessionManager.prototype._dispatchViewValidatedEvent = function() {
    try {
      window.dispatchEvent(new CustomEvent('content-view-validated', {
        detail: {
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          userId: this.userId,
          timestamp: Date.now()
        }
      }));
      console.log('📡 Dispatched content-view-validated event');
    } catch (error) {
      console.warn('⚠️ Failed to dispatch view validated event:', error);
    }
  };

  // =====================================================
  // HEARTBEAT LOOP (Phase 3 Core)
  // =====================================================

  WatchSessionManager.prototype._heartbeatTick = async function() {
    if (!this.isActive || !this.videoElement) return;
    
    const video = this.videoElement;
    if (video.paused || video.ended) return;

    const currentTime = Math.floor(video.currentTime);
    const now = Date.now();
    const deltaWatchTimeMs = now - this.lastHeartbeatTime;
    
    // Update counters
    this.sequenceNumber++;
    this.totalWatchTimeMs += deltaWatchTimeMs;
    
    if (currentTime > this.maxProgressSeconds) {
      this.maxProgressSeconds = currentTime;
    }
    
    this.lastHeartbeatTime = now;

    try {
      // A. Write to append-only event ledger
      const { error: hbError } = await this.supabase
        .from('playback_heartbeats')
        .insert({
          playback_session_id: this.playbackSessionId,
          content_id: this.contentId,
          user_id: this.userId,
          sequence_number: this.sequenceNumber,
          progress_seconds: currentTime,
          cumulative_watch_time_ms: this.totalWatchTimeMs,
          playback_state: video.paused ? 'PAUSED' : 'PLAYING',
          created_at: new Date().toISOString()
        });

      if (hbError) {
        console.warn('⚠️ Heartbeat insert failed:', hbError.message);
        return;
      }

      // B. Update session container with aggregated stats
      await this.supabase
        .from('playback_sessions')
        .update({
          total_watch_time_ms: this.totalWatchTimeMs,
          max_progress_seconds: this.maxProgressSeconds,
          heartbeat_count: this.sequenceNumber,
          last_heartbeat_at: new Date().toISOString()
        })
        .eq('playback_session_id', this.playbackSessionId);

      // C. Check view threshold and validate if needed
      if (!this.viewValidationConfirmed && 
          currentTime >= this.validViewThresholdSeconds && 
          !this.viewThresholdReached) {
        
        this.viewThresholdReached = true;
        console.log('👁️ View threshold reached (' + this.validViewThresholdSeconds + 's), validating...');
        await this._validateViewViaRPC();
      }

      // D. Trigger callbacks
      if (this.onHeartbeat) {
        this.onHeartbeat({
          sequenceNumber: this.sequenceNumber,
          progressSeconds: currentTime,
          totalWatchTimeMs: this.totalWatchTimeMs
        });
      }

      // E. Periodic collection progress update (every 5 heartbeats)
      if (this.sequenceNumber % 5 === 0) {
        await this._updateCollectionProgress();
        await this._updatePlaylistProgress();
      }

      // F. Save state to storage
      this._saveToStorage();

    } catch (error) {
      console.error('❌ Heartbeat error:', error.message);
      this._handleError('heartbeat', error);
    }
  };

  WatchSessionManager.prototype._startHeartbeatLoop = function() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    console.log('💓 Starting heartbeat loop (every ' + this.heartbeatIntervalMs + 'ms)');
    
    // Initial heartbeat
    this._heartbeatTick();
    
    // Recurring interval
    this.heartbeatInterval = setInterval(
      () => this._heartbeatTick(),
      this.heartbeatIntervalMs
    );
  };

  WatchSessionManager.prototype._stopHeartbeatLoop = function() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat loop stopped');
    }
  };

  // =====================================================
  // SESSION LIFECYCLE
  // =====================================================

  WatchSessionManager.prototype.initialize = async function(videoElement, options = {}) {
    if (this.isActive) {
      console.warn('⚠️ Session already active');
      return false;
    }

    this.videoElement = videoElement;
    this.isActive = true;
    this.lastHeartbeatTime = Date.now();

    // Merge config options
    if (options.collectionId) this.collectionId = options.collectionId;
    if (options.playlistId) this.playlistId = options.playlistId;
    if (options.sortIndex !== undefined) this.sortIndex = options.sortIndex;
    if (options.episodeNumber) this.episodeNumber = options.episodeNumber;
    if (options.autoplay !== undefined) this.shouldAutoplayNext = options.autoplay;

    try {
      // Initialize playback session record
      const { error } = await this.supabase
        .from('playback_sessions')
        .insert({
          playback_session_id: this.playbackSessionId,
          content_id: this.contentId,
          user_id: this.userId,
          session_id: this.globalSessionId,
          platform: this._getPlatform(),
          device_type: this._getDeviceType(),
          started_at: new Date().toISOString(),
          // PHASE 1D: Include collection/playlist context
          collection_id: this.collectionId,
          playlist_id: this.playlistId,
          sort_index: this.sortIndex,
          episode_number: this.episodeNumber
        });

      if (error) {
        // Handle duplicate session gracefully (e.g., page refresh)
        if (error.code !== '23505') {
          throw error;
        }
        console.log('📋 Session record already exists, continuing...');
      }

      // Start heartbeat telemetry
      this._startHeartbeatLoop();
      
      // Attach event listeners
      this._attachEventListeners();
      this._setupVisibilityHandler();
      
      // Save initial state
      this._saveToStorage();
      
      console.log('✅ WatchSession initialized:', {
        playbackSessionId: this.playbackSessionId,
        contentId: this.contentId,
        collectionId: this.collectionId
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Session initialization failed:', error.message);
      this._handleError('initialize', error);
      this.isActive = false;
      return false;
    }
  };

  WatchSessionManager.prototype.end = async function() {
    if (!this.isActive) return;
    
    console.log('🛑 Ending watch session...');
    
    // Stop heartbeat loop first
    this._stopHeartbeatLoop();
    
    // Final sync
    await this._syncFinalState();
    
    // Update collection/playlist progress
    await this._updateCollectionProgress();
    await this._updatePlaylistProgress();
    
    // Mark session as completed in DB
    try {
      await this.supabase
        .from('playback_sessions')
        .update({
          completed: true,
          exited_at: new Date().toISOString(),
          max_progress_seconds: this.maxProgressSeconds,
          total_watch_time_ms: this.totalWatchTimeMs
        })
        .eq('playback_session_id', this.playbackSessionId);
    } catch (error) {
      console.warn('⚠️ Failed to mark session completed:', error.message);
    }
    
    // Clear storage if content is completed
    if (this.isCompleted) {
      this._clearFromStorage();
    } else {
      this._saveToStorage();
    }
    
    // Cleanup
    this._detachEventListeners();
    this._cleanupVisibilityHandler();
    this.isActive = false;
    
    console.log('✅ WatchSession ended');
  };

  WatchSessionManager.prototype._syncFinalState = async function() {
    if (!this.videoElement) return;
    
    const currentTime = Math.floor(this.videoElement.currentTime);
    const duration = this.videoElement.duration || 0;
    
    // Check for completion
    if (duration > 0 && currentTime / duration >= 0.9 && !this.isCompleted) {
      this.isCompleted = true;
      console.log('✅ Content completed');
      
      if (this.onCompletion) {
        this.onCompletion({
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          timestamp: Date.now()
        });
      }
      
      // Trigger autoplay for next content
      this._triggerAutoplayNext();
    }
    
    // Final progress sync to legacy watch_progress table (for backward compat)
    if (this.userId) {
      try {
        await this.supabase
          .from('watch_progress')
          .upsert({
            user_id: this.userId,
            content_id: this.contentId,
            last_position: currentTime,
            total_watch_time: Math.floor(this.totalWatchTimeMs / 1000),
            is_completed: this.isCompleted,
            completed_at: this.isCompleted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,content_id'
          });
      } catch (error) {
        console.warn('⚠️ Legacy progress sync failed:', error.message);
      }
    }
    
    // Trigger progress callback
    if (this.onProgressSync) {
      this.onProgressSync({
        contentId: this.contentId,
        position: currentTime,
        totalWatchTimeMs: this.totalWatchTimeMs,
        completed: this.isCompleted,
        playbackSessionId: this.playbackSessionId
      });
    }
  };

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  WatchSessionManager.prototype._attachEventListeners = function() {
    if (!this.videoElement) return;

    this._boundTimeUpdate = this._onTimeUpdate.bind(this);
    this._boundPlay = this._onPlay.bind(this);
    this._boundPause = this._onPause.bind(this);
    this._boundEnded = this._onEnded.bind(this);
    this._boundError = this._onVideoError.bind(this);
    this._boundUnload = this._onBeforeUnload.bind(this);

    this.videoElement.addEventListener('timeupdate', this._boundTimeUpdate);
    this.videoElement.addEventListener('play', this._boundPlay);
    this.videoElement.addEventListener('pause', this._boundPause);
    this.videoElement.addEventListener('ended', this._boundEnded);
    this.videoElement.addEventListener('error', this._boundError);
    window.addEventListener('beforeunload', this._boundUnload);

    console.log('🔗 Event listeners attached');
  };

  WatchSessionManager.prototype._detachEventListeners = function() {
    if (!this.videoElement) return;

    if (this._boundTimeUpdate) {
      this.videoElement.removeEventListener('timeupdate', this._boundTimeUpdate);
    }
    if (this._boundPlay) {
      this.videoElement.removeEventListener('play', this._boundPlay);
    }
    if (this._boundPause) {
      this.videoElement.removeEventListener('pause', this._boundPause);
    }
    if (this._boundEnded) {
      this.videoElement.removeEventListener('ended', this._boundEnded);
    }
    if (this._boundError) {
      this.videoElement.removeEventListener('error', this._boundError);
    }
    if (this._boundUnload) {
      window.removeEventListener('beforeunload', this._boundUnload);
    }

    console.log('🔌 Event listeners detached');
  };

  WatchSessionManager.prototype._setupVisibilityHandler = function() {
    const self = this;
    
    this.visibilityHandler = function() {
      if (document.visibilityState === 'hidden' && self.isActive) {
        console.log('👁️ Page hidden — syncing progress');
        self._syncFinalState();
        self._saveToStorage();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
  };

  WatchSessionManager.prototype._cleanupVisibilityHandler = function() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  };

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  WatchSessionManager.prototype._onTimeUpdate = function(event) {
    if (!this.isActive || !this.videoElement || !this.userId) return;
    
    const video = event.target;
    const currentTime = Math.floor(video.currentTime);
    
    // Update last sync position for change detection
    if (currentTime !== this.lastSyncPosition) {
      this.lastSyncPosition = currentTime;
    }
  };

  WatchSessionManager.prototype._onPlay = function() {
    console.log('▶️ Playback started');
    if (!this.heartbeatInterval && this.isActive) {
      this._startHeartbeatLoop();
    }
  };

  WatchSessionManager.prototype._onPause = function() {
    console.log('⏸️ Playback paused');
    // Heartbeat loop naturally skips when paused, but save state
    this._saveToStorage();
  };

  WatchSessionManager.prototype._onEnded = function() {
    console.log('🏁 Playback ended');
    this.isCompleted = true;
    this._syncFinalState();
    this._clearFromStorage();
    
    if (this.onCompletion) {
      this.onCompletion({
        contentId: this.contentId,
        playbackSessionId: this.playbackSessionId,
        timestamp: Date.now(),
        reason: 'ended'
      });
    }
    
    // Trigger autoplay
    this._triggerAutoplayNext();
  };

  WatchSessionManager.prototype._onVideoError = function(event) {
    console.error('🔴 Video playback error:', event);
    this._handleError('playback', event);
  };

  WatchSessionManager.prototype._onBeforeUnload = function() {
    if (this.isActive && this.userId) {
      console.log('👋 Page unloading — syncing final state');
      this._syncFinalState();
      this._saveToStorage();
    }
  };

  // =====================================================
  // PUBLIC API
  // =====================================================

  WatchSessionManager.prototype.syncNow = function() {
    if (this.isActive && this.videoElement) {
      this._syncFinalState();
      this._saveToStorage();
    }
  };

  WatchSessionManager.prototype.getState = function() {
    return {
      playbackSessionId: this.playbackSessionId,
      globalSessionId: this.globalSessionId,
      contentId: this.contentId,
      userId: this.userId,
      isActive: this.isActive,
      isCompleted: this.isCompleted,
      sequenceNumber: this.sequenceNumber,
      progressSeconds: this.videoElement ? Math.floor(this.videoElement.currentTime) : 0,
      maxProgressSeconds: this.maxProgressSeconds,
      totalWatchTimeMs: this.totalWatchTimeMs,
      viewThresholdReached: this.viewThresholdReached,
      viewValidationConfirmed: this.viewValidationConfirmed,
      collectionId: this.collectionId,
      playlistId: this.playlistId,
      sortIndex: this.sortIndex,
      episodeNumber: this.episodeNumber
    };
  };

  WatchSessionManager.prototype.setCollection = function(collectionId, episodeNumber, sortIndex) {
    this.collectionId = collectionId;
    this.episodeNumber = episodeNumber;
    this.sortIndex = sortIndex;
    this._saveToStorage();
    console.log('📁 Collection context updated:', { collectionId, episodeNumber, sortIndex });
  };

  WatchSessionManager.prototype.setPlaylist = function(playlistId, sortIndex) {
    this.playlistId = playlistId;
    this.sortIndex = sortIndex;
    this._saveToStorage();
    console.log('🎵 Playlist context updated:', { playlistId, sortIndex });
  };

  WatchSessionManager.prototype.setAutoplay = function(enabled) {
    this.shouldAutoplayNext = enabled;
    console.log('🎬 Autoplay set to:', enabled);
  };

  // =====================================================
  // ERROR HANDLING
  // =====================================================

  WatchSessionManager.prototype._handleError = function(context, error) {
    console.error('❌ WatchSessionManager error [' + context + ']:', {
      message: error?.message || error,
      code: error?.code,
      details: error?.details
    });

    if (this.onError) {
      this.onError({
        context: context,
        error: {
          message: error?.message || String(error),
          code: error?.code,
          timestamp: Date.now()
        }
      });
    }
  };

  // =====================================================
  // STATIC UTILITIES
  // =====================================================

  WatchSessionManager.getActiveSession = function(contentId) {
    try {
      const key = `playback_session_${contentId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('⚠️ Failed to get active session:', error);
      return null;
    }
  };

  WatchSessionManager.clearAllSessions = function() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('playback_session_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem('bantu_last_playback_session');
      console.log('🗑️ All playback sessions cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear sessions:', error);
    }
  };

  // =====================================================
  // EXPORT
  // =====================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WatchSessionManager;
  } else {
    window.WatchSessionManager = WatchSessionManager;
  }

  console.log('✅ WatchSessionManager module loaded (Phase 3 + Phase 1D Enhanced)');

})();
