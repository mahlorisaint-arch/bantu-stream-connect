// js/watch-session.js — Production Watch Session Lifecycle Manager
// Bantu Stream Connect — Phase 2 Stable View Tracking System
// ✅ FIXED: Duplicate session/content inserts
// ✅ FIXED: Proper UPSERT strategy for content_views
// ✅ FIXED: Session ID is ONLY read from storage
// ✅ FIXED: Frontend now matches unique_content_view_session index
// ✅ FIXED: Prevents PostgreSQL 23505 duplicate key errors
// ✅ FIXED: Better watch time accumulation
// ✅ FIXED: Safe sync lifecycle

(function() {
  'use strict';

  console.log('🎬 WatchSession module loading...');

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
      console.warn('⚠️ No session ID found');
    }

    this.lastSyncTime = 0;
    this.lastSavedPosition = 0;
    this.totalWatchTime = 0;

    this.viewCounted = false;
    this.isCompleted = false;
    this.isActive = false;

    this.visibilityHandler = null;

    this.onProgressSync = config.onProgressSync || null;
    this.onViewCounted = config.onViewCounted || null;
    this.onComplete = config.onComplete || null;
    this.onError = config.onError || null;

    console.log(
      '✅ WatchSession initialized:',
      this.sessionId || 'NO SESSION'
    );
  }

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

        console.log(
          '✅ WatchSession started for content:',
          self.contentId
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

    this._detachEventListeners();
    this._cleanupVisibilityHandler();

    this.isActive = false;

    console.log('🛑 WatchSession stopped');
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
      lastPosition: this.videoElement
        ? this.videoElement.currentTime
        : 0,
      lastSavedPosition: this.lastSavedPosition,
      totalWatchTime: this.totalWatchTime,
      viewCounted: this.viewCounted,
      isCompleted: this.isCompleted
    };
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
            '📥 Progress restored:',
            self.lastSavedPosition
          );
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
      // COUNT VIEW
      // =====================================

      if (
        !this.viewCounted &&
        currentTime >= this.viewThreshold
      ) {
        this.viewCounted = true;

        this._recordView(video);
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
    };

  WatchSession.prototype._onEnded =
    function() {

      console.log('🏁 Ended');

      this.isCompleted = true;

      this._updateCompletionStatus(true);

      this._syncProgress(true);

      if (this.onComplete) {
        this.onComplete({
          contentId: this.contentId,
          timestamp: Date.now(),
          reason: 'ended'
        });
      }
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

  WatchSession.prototype._recordView =
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
    '✅ WatchSession module loaded successfully'
  );

})();
