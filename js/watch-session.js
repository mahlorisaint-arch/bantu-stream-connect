// js/watch-session.js — Production Watch Session Lifecycle Manager
// Bantu Stream Connect — Phase 1 Implementation
// ✅ FIXED: Matches your actual Supabase schema (total_watch_time, no session_id/device_type)
// ✅ FIXED: REMOVED creator_id from content_views operations (column doesn't exist)
// ✅ FIXED: ADDED profile_id to content_views inserts (required column)
// ✅ FIXED: Proper session tracking with session_id

(function() {
  'use strict';
  
  console.log('🎬 WatchSession module loading...');

  function WatchSession(config) {
    if (!config || !config.contentId || !config.supabase) {
      console.error('❌ WatchSession: Missing required config (contentId, supabase)');
      return;
    }

    this.contentId = config.contentId;
    this.userId = config.userId || null;
    this.supabase = config.supabase;
    
    this.videoElement = config.videoElement || null;
    this.syncInterval = config.syncInterval || 10000;
    this.viewThreshold = config.viewThreshold || 20;
    this.completionThreshold = config.completionThreshold || 0.9;
    
    // ✅ Store session ID from config or generate new one
    this.sessionId = config.sessionId || this._generateSessionId();
    this.lastSyncTime = 0;
    this.lastSavedPosition = 0;
    this.totalWatchTime = 0; // Track cumulative watch time
    this.viewCounted = false;
    this.isCompleted = false;
    this.isActive = false;
    this.syncTimeout = null;
    this.visibilityHandler = null;
    
    this.onProgressSync = config.onProgressSync || null;
    this.onViewCounted = config.onViewCounted || null;
    this.onComplete = config.onComplete || null;
    this.onError = config.onError || null;
    
    console.log('✅ WatchSession initialized: ' + this.sessionId);
  }

  // ============================================
  // PUBLIC API
  // ============================================

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
        console.log('✅ WatchSession started for content ' + self.contentId);
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
    this._detachEventListeners();
    this._cleanupVisibilityHandler();
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    this.isActive = false;
    console.log('🛑 WatchSession stopped: ' + this.sessionId);
  };

  WatchSession.prototype.syncNow = function() {
    if (!this.isActive || !this.videoElement) return;
    this._syncProgress(true);
  };

  WatchSession.prototype.getState = function() {
    return {
      sessionId: this.sessionId,
      contentId: this.contentId,
      userId: this.userId,
      isActive: this.isActive,
      lastPosition: this.videoElement ? this.videoElement.currentTime : 0,
      lastSavedPosition: this.lastSavedPosition,
      totalWatchTime: this.totalWatchTime,
      viewCounted: this.viewCounted,
      isCompleted: this.isCompleted
    };
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  WatchSession.prototype._generateSessionId = function() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (e) {}
    return 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  };

  WatchSession.prototype._initializeProgress = function() {
    var self = this;
    if (!this.userId) {
      console.log('🔓 No user — progress tracking disabled');
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
          console.warn('⚠️ Could not fetch watch progress:', result.error.message);
          return;
        }
        if (result.data) {
          self.lastSavedPosition = result.data.last_position || 0;
          self.totalWatchTime = result.data.total_watch_time || 0;
          self.isCompleted = result.data.is_completed || false;
          console.log('📥 Loaded progress: ' + self.lastSavedPosition + 's, total: ' + self.totalWatchTime + 's, completed: ' + self.isCompleted);
        }
      })
      .catch(function(error) {
        console.warn('⚠️ Progress init error:', error);
      });
  };

  WatchSession.prototype._resumePlayback = function() {
    var self = this;
    if (!this.videoElement || !this.userId) return Promise.resolve();
    
    var shouldResume = 
      this.lastSavedPosition > 10 && 
      !this.isCompleted && 
      this.videoElement.currentTime < 2;
    
    if (!shouldResume) return Promise.resolve();
    
    return new Promise(function(resolve) {
      var onLoaded = function() {
        self._applyResumePosition();
        self.videoElement.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      };
      
      if (self.videoElement.readyState >= 1) {
        self._applyResumePosition();
        resolve();
      } else {
        self.videoElement.addEventListener('loadedmetadata', onLoaded);
      }
    });
  };

  WatchSession.prototype._applyResumePosition = function() {
    if (!this.videoElement) return;
    
    var duration = this.videoElement.duration || 0;
    if (duration > 0 && this.lastSavedPosition >= duration * 0.95) {
      console.log('⏭️ Progress near end — not resuming');
      return;
    }
    
    this.videoElement.currentTime = this.lastSavedPosition;
    
    if (typeof showToast === 'function') {
      showToast('Resuming from ' + this._formatTime(this.lastSavedPosition), 'info');
    }
    console.log('⏪ Resumed at ' + this.lastSavedPosition + 's');
  };

  WatchSession.prototype._attachEventListeners = function() {
    if (!this.videoElement) return;
    
    var self = this;
    
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

  WatchSession.prototype._detachEventListeners = function() {
    if (!this.videoElement) return;
    
    this.videoElement.removeEventListener('timeupdate', this._boundTimeUpdate);
    this.videoElement.removeEventListener('play', this._boundPlay);
    this.videoElement.removeEventListener('pause', this._boundPause);
    this.videoElement.removeEventListener('ended', this._boundEnded);
    this.videoElement.removeEventListener('error', this._boundError);
    window.removeEventListener('beforeunload', this._boundUnload);
    
    console.log('🔌 Event listeners detached');
  };

  WatchSession.prototype._setupVisibilityHandler = function() {
    var self = this;
    this.visibilityHandler = function() {
      if (document.visibilityState === 'hidden' && self.isActive) {
        console.log('👁️ Tab hidden — forcing sync');
        self._syncProgress(true);
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

  // ============================================
  // EVENT HANDLERS
  // ============================================

  WatchSession.prototype._onTimeUpdate = function(event) {
    if (!this.isActive || !this.userId || !this.videoElement) return;
    
    var video = event.target;
    var currentTime = Math.floor(video.currentTime);
    var duration = video.duration || 0;
    
    // Count view after threshold (anti-inflation)
    if (!this.viewCounted && currentTime >= this.viewThreshold) {
      this._recordView(video);
      this.viewCounted = true;
    }
    
    // Track cumulative watch time (only when playing)
    if (!video.paused && this.lastSyncTime > 0) {
      var elapsed = currentTime - this.lastSavedPosition;
      if (elapsed > 0) {
        this.totalWatchTime += elapsed;
      }
    }
    
    // Check completion at 90%
    if (!this.isCompleted && duration > 0) {
      var progress = currentTime / duration;
      if (progress >= this.completionThreshold) {
        this.isCompleted = true;
        console.log('✅ Content completed');
        if (this.onComplete) {
          this.onComplete({ contentId: this.contentId, timestamp: Date.now() });
        }
      }
    }
    
    // Sync progress at interval
    var now = Date.now();
    if (currentTime !== this.lastSavedPosition && now - this.lastSyncTime >= this.syncInterval) {
      this._syncProgress(false);
      this.lastSyncTime = now;
      this.lastSavedPosition = currentTime;
    }
  };

  WatchSession.prototype._onPlay = function() {
    console.log('▶️ Playing — session active');
  };

  WatchSession.prototype._onPause = function() {
    console.log('⏸️ Paused');
  };

  WatchSession.prototype._onEnded = function() {
    console.log('🏁 Ended');
    if (!this.isCompleted && this.userId) {
      this.isCompleted = true;
      this._updateCompletionStatus(true);
      if (this.onComplete) {
        this.onComplete({ contentId: this.contentId, timestamp: Date.now(), reason: 'ended' });
      }
    }
    this._syncProgress(true);
  };

  WatchSession.prototype._onVideoError = function(event) {
    console.error('🔴 Video error:', event);
    this._handleError('playback', event);
  };

  WatchSession.prototype._onBeforeUnload = function() {
    if (this.isActive && this.userId) {
      console.log('🔄 Unloading — final sync');
      this._syncProgress(true);
    }
  };

  // ============================================
  // DATABASE OPERATIONS — ✅ MATCHES YOUR SCHEMA
  // ✅ FIXED: REMOVED creator_id from all operations
  // ✅ FIXED: ADDED profile_id to content_views insert
  // ============================================

  /**
   * 🔧 FIXED: Record view in content_views table with session_id
   * ✅ NO creator_id anywhere in this function
   */
  WatchSession.prototype._recordView = function(video) {
    var self = this;
    if (!this.userId) return Promise.resolve();
    
    // ✅ CORRECT INSERT - NO creator_id
    return this.supabase
      .from('content_views')
      .insert({
        content_id: this.contentId,
        viewer_id: this.userId,
        profile_id: this.userId,
        user_id: this.userId,
        session_id: this.sessionId,
        view_duration: Math.floor(video.currentTime),
        counted_as_view: true,
        device_type: this._getDeviceType(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .then(function(result) {
        if (result.error && result.error.code !== '23505') {
          throw result.error;
        }
        console.log('✅ View recorded successfully with session:', self.sessionId);
        if (self.onViewCounted) {
          self.onViewCounted({ 
            contentId: self.contentId, 
            sessionId: self.sessionId,
            userId: self.userId,
            viewId: result.data && result.data.id 
          });
        }
      })
      .catch(function(error) {
        console.error('❌ Record view failed:', error.message);
        self._handleError('recordView', error);
      });
  };

  /**
   * 🔧 FIXED: Sync progress to watch_progress table
   * ✅ Uses correct column names (total_watch_time, NOT watch_duration)
   */
  WatchSession.prototype._syncProgress = function(force) {
    var self = this;
    if (!this.userId || !this.videoElement) return Promise.resolve();
    
    var currentTime = Math.floor(this.videoElement.currentTime);
    var duration = this.videoElement.duration || 0;
    
    if (!force && currentTime === this.lastSavedPosition) {
      return Promise.resolve();
    }
    
    // ✅ CORRECT: Use ONLY columns that exist in your watch_progress table
    return this.supabase
      .from('watch_progress')
      .upsert({
        user_id: this.userId,
        content_id: this.contentId,
        last_position: currentTime,
        total_watch_time: this.totalWatchTime,  // ✅ Your schema uses total_watch_time
        is_completed: this.isCompleted,
        completed_at: this.isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
        // ❌ REMOVED: watch_duration (your schema uses total_watch_time)
      }, {
        onConflict: ['user_id', 'content_id']
      })
      .then(function(result) {
        if (result.error) throw result.error;
        console.log('💾 Progress synced: pos=' + currentTime + 's, total=' + self.totalWatchTime + 's' + (self.isCompleted ? ' (completed)' : ''));
        if (self.onProgressSync) {
          self.onProgressSync({
            contentId: self.contentId,
            position: currentTime,
            duration: duration,
            totalWatchTime: self.totalWatchTime,
            completed: self.isCompleted,
            sessionId: self.sessionId
          });
        }
      })
      .catch(function(error) {
        console.error('❌ Sync failed:', error.message);
        self._handleError('syncProgress', error);
      });
  };

  WatchSession.prototype._updateCompletionStatus = function(isCompleted) {
    var self = this;
    if (!this.userId) return Promise.resolve();
    
    return this.supabase
      .from('watch_progress')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', this.userId)
      .eq('content_id', this.contentId)
      .then(function(result) {
        if (result.error) throw result.error;
        console.log('✅ Completion updated: ' + isCompleted);
      })
      .catch(function(error) {
        console.error('❌ Completion update failed:', error.message);
        self._handleError('updateCompletion', error);
      });
  };

  // ============================================
  // UTILITIES
  // ============================================

  WatchSession.prototype._getDeviceType = function() {
    if (/Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  WatchSession.prototype._formatTime = function(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  WatchSession.prototype._handleError = function(context, error) {
    console.error('❌ WatchSession error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WatchSession;
  } else {
    window.WatchSession = WatchSession;
  }
  
  console.log('✅ WatchSession module loaded successfully - creator_id removed, profile_id added');
})();
