// js/watch-session.js — Modern Telemetry Engine with Playback Sessions & Heartbeats
// Bantu Stream Connect — Production-Grade Watch Session Management
// ✅ NEW ARCHITECTURE: Uses playback_sessions + playback_heartbeats tables
// ✅ NEW: View validation via RPC after threshold
// ✅ NEW: Append-only event ledger (no more upserts)
// ✅ REMOVED: Direct Content.views_count updates
// ✅ REMOVED: content_views table usage (migrated to new telemetry)
// ✅ NEW: Session restoration for queue/playlist continuity
// ✅ NEW: Autoplay trigger with queue awareness
// ✅ NEW: Proper cleanup with session finalization

(function() {
  'use strict';

  console.log('🎬 WatchSession (Modern Telemetry) module loading...');

  function WatchSession(config) {
    if (!config || !config.contentId || !config.supabase) {
      console.error('❌ WatchSession: Missing required config');
      return;
    }

    // Core identifiers
    this.contentId = config.contentId;
    this.userId = config.userId || null;
    this.supabase = config.supabase;
    this.videoElement = config.videoElement || null;

    // Playback session identifiers
    this.playbackSessionId = this._generatePlaybackSessionId();
    this.clientSessionId = config.sessionId || sessionStorage.getItem('bantu_view_session');
    
    if (!this.clientSessionId) {
      this.clientSessionId = this._generateUUID();
      sessionStorage.setItem('bantu_view_session', this.clientSessionId);
    }

    // Configuration
    this.heartbeatIntervalMs = config.heartbeatInterval || 10000;  // 10 seconds
    this.viewValidationThreshold = config.viewThreshold || 30;      // 30 seconds for valid view
    this.completionThreshold = config.completionThreshold || 0.9;   // 90% for completion
    
    // Session state
    this.isActive = false;
    this.isCompleted = false;
    this.playbackStartedAt = null;
    this.lastHeartbeatAt = null;
    this.sequenceNumber = 0;
    this.totalWatchTimeMs = 0;
    this.maxProgressSeconds = 0;
    this.heartbeatInterval = null;
    this.viewValidated = false;      // Has RPC validated this view?
    this.viewValidationAttempted = false;
    
    // Progress tracking (for UI resume)
    this.lastSavedPosition = 0;
    
    // Platform metadata
    this.platform = config.platform || 'web';
    this.deviceType = this._getDeviceType();
    
    // Queue/Collection context (Phase 1D)
    this.collectionId = config.collectionId || null;
    this.episodeNumber = config.episodeNumber || null;
    this.shouldAutoplayNext = config.autoplay !== false;
    
    // Session persistence (for crash recovery)
    this.sessionKey = `playback_session_${this.contentId}`;
    this.restoredFromStorage = false;
    
    // Callbacks
    this.onViewValidated = config.onViewValidated || null;
    this.onProgressSync = config.onProgressSync || null;
    this.onComplete = config.onComplete || null;
    this.onAutoplayTrigger = config.onAutoplayTrigger || null;
    this.onError = config.onError || null;
    
    // Visibility handler
    this.visibilityHandler = null;
    this.boundBeforeUnload = this._onBeforeUnload.bind(this);
    
    console.log('✅ WatchSession (Modern) initialized:', {
      playbackSessionId: this.playbackSessionId,
      contentId: this.contentId,
      userId: this.userId || 'guest',
      collectionId: this.collectionId || 'none'
    });
    
    // Restore session if available
    this._restoreFromStorage();
  }

  // =====================================================
  // PUBLIC API
  // =====================================================

  WatchSession.prototype.start = function(videoElement) {
    if (this.isActive) {
      console.warn('⚠️ WatchSession already active');
      return Promise.resolve(false);
    }

    this.videoElement = videoElement;
    this.isActive = true;
    this.playbackStartedAt = new Date();
    this.lastHeartbeatAt = Date.now();

    return this._initializeSession()
      .then(() => this._resumePlayback())
      .then(() => {
        this._attachEventListeners();
        this._setupVisibilityHandler();
        this._startHeartbeatLoop();
        this._saveToStorage();
        
        console.log('✅ WatchSession started:', this.playbackSessionId);
        return true;
      })
      .catch(error => {
        console.error('❌ WatchSession start failed:', error);
        this._handleError('start', error);
        return false;
      });
  };

  WatchSession.prototype.stop = function() {
    if (!this.isActive) return;
    
    this._stopHeartbeatLoop();
    this._finalizeSession();
    this._detachEventListeners();
    this._cleanupVisibilityHandler();
    this._saveToStorage();
    
    this.isActive = false;
    console.log('🛑 WatchSession stopped:', this.playbackSessionId);
  };

  WatchSession.prototype.syncNow = function() {
    if (!this.isActive || !this.videoElement) return;
    this._sendHeartbeat(true);
  };

  WatchSession.prototype.getState = function() {
    return {
      playbackSessionId: this.playbackSessionId,
      clientSessionId: this.clientSessionId,
      contentId: this.contentId,
      userId: this.userId,
      isActive: this.isActive,
      currentPosition: this.videoElement?.currentTime || 0,
      maxProgressSeconds: this.maxProgressSeconds,
      totalWatchTimeMs: this.totalWatchTimeMs,
      viewValidated: this.viewValidated,
      isCompleted: this.isCompleted,
      collectionId: this.collectionId,
      episodeNumber: this.episodeNumber
    };
  };

  WatchSession.prototype.setCollection = function(collectionId, episodeNumber) {
    this.collectionId = collectionId;
    this.episodeNumber = episodeNumber;
    this._saveToStorage();
    console.log('📁 Collection context updated:', { collectionId, episodeNumber });
  };

  WatchSession.prototype.setAutoplay = function(enabled) {
    this.shouldAutoplayNext = enabled;
    console.log('🎵 Autoplay set to:', enabled);
  };

  // =====================================================
  // SESSION INITIALIZATION (NEW ARCHITECTURE)
  // =====================================================

  WatchSession.prototype._initializeSession = async function() {
    // Step 1: Create playback session record
    const { error: sessionError } = await this.supabase
      .from('playback_sessions')
      .insert({
        playback_session_id: this.playbackSessionId,
        content_id: this.contentId,
        user_id: this.userId,
        session_id: this.clientSessionId,
        platform: this.platform,
        device_type: this.deviceType,
        started_at: this.playbackStartedAt.toISOString(),
        total_watch_time_ms: this.totalWatchTimeMs,
        max_progress_seconds: this.maxProgressSeconds,
        heartbeat_count: 0,
        is_completed: false
      });

    if (sessionError) {
      console.error('Failed to create playback session:', sessionError);
      throw sessionError;
    }

    console.log('✅ Playback session created:', this.playbackSessionId);
    
    // Step 2: Load existing progress if any
    await this._loadProgress();
  };

  WatchSession.prototype._loadProgress = async function() {
    if (!this.userId) return;

    try {
      const { data, error } = await this.supabase
        .from('playback_sessions')
        .select('max_progress_seconds, total_watch_time_ms, is_completed')
        .eq('content_id', this.contentId)
        .eq('user_id', this.userId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data && !data.is_completed) {
        this.maxProgressSeconds = data.max_progress_seconds || 0;
        this.totalWatchTimeMs = data.total_watch_time_ms || 0;
        console.log('📥 Progress loaded from previous session:', this.maxProgressSeconds);
      }
    } catch (error) {
      console.warn('Failed to load progress:', error);
    }
  };

  // =====================================================
  // HEARTBEAT LOOP (Append-Only Event Ledger)
  // =====================================================

  WatchSession.prototype._startHeartbeatLoop = function() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    this.heartbeatInterval = setInterval(() => {
      this._sendHeartbeat();
    }, this.heartbeatIntervalMs);
    
    console.log('💓 Heartbeat loop started (interval:', this.heartbeatIntervalMs, 'ms)');
  };

  WatchSession.prototype._stopHeartbeatLoop = function() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  };

  WatchSession.prototype._sendHeartbeat = async function(isForced = false) {
    if (!this.isActive || !this.videoElement) return;
    if (this.videoElement.paused && !isForced) return;

    const currentTime = Math.floor(this.videoElement.currentTime);
    const now = Date.now();
    const deltaWatchTimeMs = now - this.lastHeartbeatAt;
    
    // Update session state
    this.sequenceNumber++;
    this.totalWatchTimeMs += deltaWatchTimeMs;
    
    if (currentTime > this.maxProgressSeconds) {
      this.maxProgressSeconds = currentTime;
    }
    this.lastHeartbeatAt = now;

    // Step A: Write heartbeat to append-only ledger
    const { error: heartbeatError } = await this.supabase
      .from('playback_heartbeats')
      .insert({
        playback_session_id: this.playbackSessionId,
        content_id: this.contentId,
        user_id: this.userId,
        sequence_number: this.sequenceNumber,
        progress_seconds: currentTime,
        cumulative_watch_time_ms: this.totalWatchTimeMs,
        playback_state: this.videoElement.paused ? 'PAUSED' : 'PLAYING',
        timestamp: new Date().toISOString()
      });

    if (heartbeatError) {
      console.error('❌ Heartbeat insert failed:', heartbeatError.message);
      this._handleError('heartbeat', heartbeatError);
      return;
    }

    // Step B: Update session aggregate
    const { error: updateError } = await this.supabase
      .from('playback_sessions')
      .update({
        total_watch_time_ms: this.totalWatchTimeMs,
        max_progress_seconds: this.maxProgressSeconds,
        heartbeat_count: this.sequenceNumber,
        last_heartbeat_at: new Date().toISOString()
      })
      .eq('playback_session_id', this.playbackSessionId);

    if (updateError) {
      console.warn('⚠️ Session update failed:', updateError.message);
    }

    // Step C: Check and validate view (YouTube-style threshold)
    await this._checkAndValidateView(currentTime);

    // Step D: Check completion
    await this._checkCompletion(currentTime);

    // Step E: Save to storage for crash recovery
    this._saveToStorage();
    
    // Step F: Notify callback
    if (this.onProgressSync) {
      this.onProgressSync({
        contentId: this.contentId,
        position: currentTime,
        totalWatchTimeMs: this.totalWatchTimeMs,
        completed: this.isCompleted
      });
    }
    
    if (this.sequenceNumber % 6 === 0) {
      console.log(`💓 Heartbeat #${this.sequenceNumber}: ${currentTime}s, watch time: ${this.totalWatchTimeMs}ms`);
    }
  };

  // =====================================================
  // VIEW VALIDATION (RPC-based, no direct updates)
  // =====================================================

  WatchSession.prototype._checkAndValidateView = async function(currentTime) {
    // Only validate once, after threshold
    if (this.viewValidated || this.viewValidationAttempted) return;
    if (currentTime < this.viewValidationThreshold) return;
    
    this.viewValidationAttempted = true;
    
    console.log(`👁️ View threshold reached (${currentTime}s >= ${this.viewValidationThreshold}s), validating...`);
    
    try {
      // Call the RPC that validates the view and updates content_engagement_stats
      const { data, error } = await this.supabase
        .rpc('validate_playback_view', {
          p_playback_session_id: this.playbackSessionId
        });

      if (error) {
        console.error('❌ View validation RPC failed:', error);
        return;
      }
      
      this.viewValidated = true;
      console.log('✅ View validated and recorded in content_engagement_stats');
      
      // Dispatch event for UI updates
      this._dispatchViewValidatedEvent();
      
      if (this.onViewValidated) {
        this.onViewValidated({
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          watchTimeMs: this.totalWatchTimeMs
        });
      }
      
    } catch (error) {
      console.error('❌ View validation crashed:', error);
    }
  };

  WatchSession.prototype._dispatchViewValidatedEvent = function() {
    try {
      window.dispatchEvent(new CustomEvent('content-view-validated', {
        detail: {
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          timestamp: Date.now()
        }
      }));
    } catch (error) {
      console.warn('Failed to dispatch view validated event:', error);
    }
  };

  // =====================================================
  // COMPLETION TRACKING
  // =====================================================

  WatchSession.prototype._checkCompletion = async function(currentTime) {
    if (this.isCompleted) return;
    
    const duration = this.videoElement?.duration || 0;
    if (duration === 0) return;
    
    const progress = currentTime / duration;
    
    if (progress >= this.completionThreshold) {
      this.isCompleted = true;
      
      // Mark session as completed
      await this.supabase
        .from('playback_sessions')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('playback_session_id', this.playbackSessionId);
      
      console.log('🏆 Content completed!', {
        contentId: this.contentId,
        progress: `${Math.round(progress * 100)}%`
      });
      
      this._clearFromStorage();
      
      if (this.onComplete) {
        this.onComplete({
          contentId: this.contentId,
          playbackSessionId: this.playbackSessionId,
          totalWatchTimeMs: this.totalWatchTimeMs
        });
      }
      
      // Trigger autoplay for next content
      this._triggerAutoplayNext();
    }
  };

  // =====================================================
  // AUTOPLAY NEXT (Queue/Collection aware)
  // =====================================================

  WatchSession.prototype._triggerAutoplayNext = function() {
    if (!this.shouldAutoplayNext) {
      console.log('⏸️ Autoplay disabled');
      return;
    }
    
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
    } else if (window.QueueManager && window.QueueManager.playNext) {
      window.QueueManager.playNext();
    } else if (window.VideoPlayerFeatures && window.playNextTrack) {
      window.playNextTrack();
    }
  };

  // =====================================================
  // SESSION FINALIZATION
  // =====================================================

  WatchSession.prototype._finalizeSession = async function() {
    try {
      await this.supabase
        .from('playback_sessions')
        .update({
          exited_at: new Date().toISOString(),
          final_progress_seconds: this.videoElement?.currentTime || this.maxProgressSeconds
        })
        .eq('playback_session_id', this.playbackSessionId);
      
      console.log('📦 Session finalized');
    } catch (error) {
      console.warn('Failed to finalize session:', error);
    }
  };

  // =====================================================
  // PROGRESS RESUME (for "Continue Watching")
  // =====================================================

  WatchSession.prototype._resumePlayback = function() {
    if (!this.videoElement || !this.userId) return Promise.resolve();
    
    const shouldResume = this.maxProgressSeconds > 10 && 
                         !this.isCompleted && 
                         this.videoElement.currentTime < 2;
    
    if (!shouldResume) return Promise.resolve();
    
    return new Promise((resolve) => {
      const applyResume = () => {
        this.videoElement.currentTime = this.maxProgressSeconds;
        console.log('⏪ Resumed at:', this.maxProgressSeconds);
        
        if (typeof window.showToast === 'function') {
          window.showToast(`Resuming from ${this._formatTime(this.maxProgressSeconds)}`, 'info');
        }
        resolve();
      };
      
      if (this.videoElement.readyState >= 1) {
        applyResume();
      } else {
        this.videoElement.addEventListener('loadedmetadata', function onLoaded() {
          this.removeEventListener('loadedmetadata', onLoaded);
          applyResume();
        });
      }
    });
  };

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  WatchSession.prototype._attachEventListeners = function() {
    if (!this.videoElement) return;
    
    this._boundTimeUpdate = this._onTimeUpdate.bind(this);
    this._boundPlay = this._onPlay.bind(this);
    this._boundPause = this._onPause.bind(this);
    this._boundEnded = this._onEnded.bind(this);
    this._boundError = this._onVideoError.bind(this);
    
    this.videoElement.addEventListener('timeupdate', this._boundTimeUpdate);
    this.videoElement.addEventListener('play', this._boundPlay);
    this.videoElement.addEventListener('pause', this._boundPause);
    this.videoElement.addEventListener('ended', this._boundEnded);
    this.videoElement.addEventListener('error', this._boundError);
    
    window.addEventListener('beforeunload', this.boundBeforeUnload);
    
    console.log('🔗 Event listeners attached');
  };

  WatchSession.prototype._detachEventListeners = function() {
    if (!this.videoElement) return;
    
    this.videoElement.removeEventListener('timeupdate', this._boundTimeUpdate);
    this.videoElement.removeEventListener('play', this._boundPlay);
    this.videoElement.removeEventListener('pause', this._boundPause);
    this.videoElement.removeEventListener('ended', this._boundEnded);
    this.videoElement.removeEventListener('error', this._boundError);
    
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    
    console.log('🔌 Event listeners detached');
  };

  WatchSession.prototype._setupVisibilityHandler = function() {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && this.isActive) {
        console.log('👁️ Page hidden — sending final heartbeat');
        this._sendHeartbeat(true);
        this._saveToStorage();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  };

  WatchSession.prototype._cleanupVisibilityHandler = function() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  };

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  WatchSession.prototype._onTimeUpdate = function(event) {
    if (!this.isActive) return;
    // Heartbeat handles the heavy lifting
    this.lastSavedPosition = Math.floor(event.target.currentTime);
  };

  WatchSession.prototype._onPlay = function() {
    console.log('▶️ Playback started');
    this.lastHeartbeatAt = Date.now();
  };

  WatchSession.prototype._onPause = function() {
    console.log('⏸️ Playback paused');
    this._sendHeartbeat(true);
    this._saveToStorage();
  };

  WatchSession.prototype._onEnded = function() {
    console.log('🏁 Playback ended');
    this.isCompleted = true;
    this._sendHeartbeat(true);
    this._clearFromStorage();
  };

  WatchSession.prototype._onVideoError = function(event) {
    console.error('🔴 Video error:', event);
    this._handleError('playback', event);
  };

  WatchSession.prototype._onBeforeUnload = function() {
    if (this.isActive) {
      this._sendHeartbeat(true);
      this._saveToStorage();
    }
  };

  // =====================================================
  // SESSION PERSISTENCE (Crash Recovery)
  // =====================================================

  WatchSession.prototype._saveToStorage = function() {
    try {
      const sessionData = {
        playbackSessionId: this.playbackSessionId,
        clientSessionId: this.clientSessionId,
        contentId: this.contentId,
        userId: this.userId,
        maxProgressSeconds: this.maxProgressSeconds,
        totalWatchTimeMs: this.totalWatchTimeMs,
        sequenceNumber: this.sequenceNumber,
        viewValidated: this.viewValidated,
        isCompleted: this.isCompleted,
        collectionId: this.collectionId,
        episodeNumber: this.episodeNumber,
        timestamp: Date.now()
      };
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save session to storage:', error);
    }
  };

  WatchSession.prototype._restoreFromStorage = function() {
    try {
      const saved = localStorage.getItem(this.sessionKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          this.maxProgressSeconds = data.maxProgressSeconds || 0;
          this.totalWatchTimeMs = data.totalWatchTimeMs || 0;
          this.sequenceNumber = data.sequenceNumber || 0;
          this.viewValidated = data.viewValidated || false;
          this.isCompleted = data.isCompleted || false;
          this.restoredFromStorage = true;
          console.log('📦 Session restored from storage at position:', this.maxProgressSeconds);
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
    } catch (error) {
      console.warn('Failed to clear session from storage:', error);
    }
  };

  // =====================================================
  // UTILITIES
  // =====================================================

  WatchSession.prototype._generatePlaybackSessionId = function() {
    return 'pb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  WatchSession.prototype._generateUUID = function() {
    return crypto.randomUUID ? crypto.randomUUID() : 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  };

  WatchSession.prototype._getDeviceType = function() {
    if (/Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    if (/iPad|Tablet/i.test(navigator.userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  };

  WatchSession.prototype._formatTime = function(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  WatchSession.prototype._handleError = function(context, error) {
    console.error('❌ WatchSession error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // =====================================================
  // STATIC METHODS
  // =====================================================

  WatchSession.getActiveSession = function(contentId) {
    const key = `playback_session_${contentId}`;
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
        if (key.startsWith('playback_session_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem('bantu_view_session');
      console.log('🗑️ All watch sessions cleared');
    } catch (error) {
      console.warn('Failed to clear sessions:', error);
    }
  };

  // =====================================================
  // EXPORT
  // =====================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WatchSession;
  } else {
    window.WatchSession = WatchSession;
  }

  console.log('✅ WatchSession (Modern Telemetry Engine) loaded successfully');
  console.log('   Features: playback_sessions | playback_heartbeats | RPC view validation');
  console.log('   REMOVED: Direct Content updates | content_views table writes');

})();
