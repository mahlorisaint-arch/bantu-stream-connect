// js/watch-session.js — Production Watch Session Lifecycle Manager
// Bantu Stream Connect — Phase 1 Implementation

class WatchSession {
  constructor(config) {
    // Required config
    this.contentId = config.contentId;
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
    
    // Optional config with sensible defaults
    this.videoElement = config.videoElement || null;
    this.syncInterval = config.syncInterval || 10000; // 10 seconds
    this.viewThreshold = config.viewThreshold || 20; // Count view after 20s
    this.completionThreshold = config.completionThreshold || 0.9; // 90% watched = completed
    
    // Internal state - SAFE SESSION ID GENERATION (FIXED)
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        this.sessionId = crypto.randomUUID();
      } else {
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
    } catch (e) {
      console.warn('⚠️ Session ID fallback:', e);
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    
    this.lastSyncTime = 0;
    this.lastSavedPosition = 0;
    this.viewCounted = false;
    this.isCompleted = false;
    this.isActive = false;
    this.syncTimeout = null;
    this.visibilityHandler = null;
    
    // Callbacks for external events
    this.onProgressSync = config.onProgressSync || null;
    this.onViewCounted = config.onViewCounted || null;
    this.onComplete = config.onComplete || null;
    this.onError = config.onError || null;
    
    console.log(`🎬 WatchSession initialized: ${this.sessionId}`);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async start(videoElement) {
    if (this.isActive) {
      console.warn('⚠️ WatchSession already active');
      return;
    }
    
    this.videoElement = videoElement;
    this.isActive = true;
    
    try {
      // 1. Initialize or fetch existing progress
      await this._initializeProgress();
      
      // 2. Resume playback if applicable
      await this._resumePlayback();
      
      // 3. Attach event listeners
      this._attachEventListeners();
      
      // 4. Start visibility change handler (for tab switching)
      this._setupVisibilityHandler();
      
      console.log(`✅ WatchSession started for content ${this.contentId}`);
      return true;
      
    } catch (error) {
      console.error('❌ WatchSession start failed:', error);
      this._handleError('start', error);
      return false;
    }
  }

  async stop() {
    if (!this.isActive) return;
    
    // Final sync before stopping
    await this._syncProgress(true);
    
    // Clean up
    this._detachEventListeners();
    this._cleanupVisibilityHandler();
    
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    
    this.isActive = false;
    console.log(`🛑 WatchSession stopped: ${this.sessionId}`);
  }

  // Manual sync trigger (for testing or special cases)
  async syncNow() {
    if (!this.isActive || !this.videoElement) return;
    await this._syncProgress(true);
  }

  // Get current session state (for debugging)
  getState() {
    return {
      sessionId: this.sessionId,
      contentId: this.contentId,
      userId: this.userId,
      isActive: this.isActive,
      lastPosition: this.videoElement?.currentTime || 0,
      lastSavedPosition: this.lastSavedPosition,
      viewCounted: this.viewCounted,
      isCompleted: this.isCompleted,
      duration: this.videoElement?.duration || 0
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  async _initializeProgress() {
    if (!this.userId) {
      console.log('🔓 No user authenticated — progress tracking disabled');
      return;
    }
    
    try {
      const { data, error } = await this.supabase
        .from('watch_progress')
        .select('*')
        .eq('user_id', this.userId)
        .eq('content_id', this.contentId)
        .maybeSingle();
      
      if (error) {
        console.warn('⚠️ Could not fetch watch progress:', error.message);
        return;
      }
      
      if (data) {
        this.lastSavedPosition = data.last_position || 0;
        this.isCompleted = data.is_completed || false;
        console.log(`📥 Loaded progress: ${this.lastSavedPosition}s, completed: ${this.isCompleted}`);
      }
      
    } catch (error) {
      console.warn('⚠️ Progress initialization error:', error);
    }
  }

  async _resumePlayback() {
    if (!this.videoElement || !this.userId) return;
    
    // Only resume if:
    // 1. We have a saved position > 10 seconds (avoid resuming very short watches)
    // 2. Content is not already completed
    // 3. User hasn't manually seeked yet (check if currentTime is still 0)
    
    const shouldResume = 
      this.lastSavedPosition > 10 && 
      !this.isCompleted && 
      this.videoElement.currentTime < 2; // Allow 2s buffer for manual interaction
    
    if (shouldResume) {
      // Wait for video metadata to load before seeking
      if (this.videoElement.readyState >= 1) {
        this._applyResumePosition();
      } else {
        const onLoaded = () => {
          this._applyResumePosition();
          this.videoElement.removeEventListener('loadedmetadata', onLoaded);
        };
        this.videoElement.addEventListener('loadedmetadata', onLoaded);
      }
    }
  }

  _applyResumePosition() {
    if (!this.videoElement) return;
    
    // Don't resume if video is near end already
    const duration = this.videoElement.duration || 0;
    if (duration > 0 && this.lastSavedPosition >= duration * 0.95) {
      console.log('⏭️ Progress near end — not resuming');
      return;
    }
    
    this.videoElement.currentTime = this.lastSavedPosition;
    
    // Show subtle toast/notification (optional UX)
    if (typeof showToast === 'function') {
      showToast(`Resuming from ${this._formatTime(this.lastSavedPosition)}`, 'info');
    }
    
    console.log(`⏪ Resumed playback at ${this.lastSavedPosition}s`);
  }

  _attachEventListeners() {
    if (!this.videoElement) return;
    
    // Time update — main tracking loop
    this.videoElement.addEventListener('timeupdate', this._onTimeUpdate.bind(this));
    
    // Play — ensure session is active
    this.videoElement.addEventListener('play', this._onPlay.bind(this));
    
    // Pause — optional immediate sync (conservative approach: wait for next interval)
    this.videoElement.addEventListener('pause', this._onPause.bind(this));
    
    // Ended — mark complete
    this.videoElement.addEventListener('ended', this._onEnded.bind(this));
    
    // Error handling
    this.videoElement.addEventListener('error', this._onVideoError.bind(this));
    
    // Page unload — final sync
    window.addEventListener('beforeunload', this._onBeforeUnload.bind(this));
    
    console.log('🔗 Event listeners attached');
  }

  _detachEventListeners() {
    if (!this.videoElement) return;
    
    this.videoElement.removeEventListener('timeupdate', this._onTimeUpdate.bind(this));
    this.videoElement.removeEventListener('play', this._onPlay.bind(this));
    this.videoElement.removeEventListener('pause', this._onPause.bind(this));
    this.videoElement.removeEventListener('ended', this._onEnded.bind(this));
    this.videoElement.removeEventListener('error', this._onVideoError.bind(this));
    window.removeEventListener('beforeunload', this._onBeforeUnload.bind(this));
    
    console.log('🔌 Event listeners detached');
  }

  _setupVisibilityHandler() {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && this.isActive) {
        // Tab hidden — sync immediately to preserve progress
        console.log('👁️ Tab hidden — forcing progress sync');
        this._syncProgress(true);
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  _cleanupVisibilityHandler() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  async _onTimeUpdate(event) {
    if (!this.isActive || !this.userId) return;
    
    const video = event.target;
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration || 0;
    
    // 1. Count view after threshold (anti-inflation)
    if (!this.viewCounted && currentTime >= this.viewThreshold) {
      await this._recordView(video);
      this.viewCounted = true;
    }
    
    // 2. Check completion status
    if (!this.isCompleted && duration > 0) {
      const progress = currentTime / duration;
      if (progress >= this.completionThreshold) {
        this.isCompleted = true;
        console.log('✅ Content marked as completed');
        
        // Trigger completion callback
        if (this.onComplete) {
          this.onComplete({ contentId: this.contentId, timestamp: Date.now() });
        }
      }
    }
    
    // 3. Sync progress at interval (debounced)
    const now = Date.now();
    if (currentTime !== this.lastSavedPosition && now - this.lastSyncTime >= this.syncInterval) {
      await this._syncProgress(false);
      this.lastSyncTime = now;
      this.lastSavedPosition = currentTime;
    }
  }

  _onPlay() {
    console.log('▶️ Video playing — session active');
    // Optional: Could trigger analytics event here
  }

  _onPause() {
    // Optional: Could sync immediately on pause for conservative tracking
    // For now, we rely on the interval + beforeunload for efficiency
    console.log('⏸️ Video paused');
  }

  async _onEnded() {
    console.log('🏁 Video ended');
    
    // Ensure completion is marked
    if (!this.isCompleted) {
      this.isCompleted = true;
      
      if (this.userId) {
        await this._updateCompletionStatus(true);
      }
      
      if (this.onComplete) {
        this.onComplete({ contentId: this.contentId, timestamp: Date.now(), reason: 'ended' });
      }
    }
    
    // Final sync
    await this._syncProgress(true);
  }

  _onVideoError(event) {
    console.error('🔴 Video playback error:', event);
    this._handleError('playback', event);
  }

  async _onBeforeUnload() {
    if (this.isActive && this.userId) {
      console.log('🔄 Page unloading — final progress sync');
      await this._syncProgress(true);
    }
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  async _recordView(video) {
    if (!this.userId) return;
    
    try {
      const { data, error } = await this.supabase
        .from('content_views')
        .insert({
          content_id: this.contentId,
          viewer_id: this.userId,
          session_id: this.sessionId,
          view_duration: Math.floor(video.currentTime),
          counted_as_view: true,
          device_type: this._getDeviceType(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        // Unique constraint violation = already counted, safe to ignore
        if (error.code !== '23505') {
          throw error;
        }
        console.log('ℹ️ View already counted for this session');
        return;
      }
      
      console.log('✅ View recorded:', data);
      
      // Trigger callback
      if (this.onViewCounted) {
        this.onViewCounted({ contentId: this.contentId, viewId: data?.id });
      }
      
    } catch (error) {
      console.error('❌ Failed to record view:', error);
      this._handleError('recordView', error);
    }
  }

  async _syncProgress(force = false) {
    if (!this.userId || !this.videoElement) return;
    
    const currentTime = Math.floor(this.videoElement.currentTime);
    const duration = this.videoElement.duration || 0;
    
    // Skip sync if no meaningful change (unless forced)
    if (!force && currentTime === this.lastSavedPosition) {
      return;
    }
    
    try {
      const { error } = await this.supabase
        .from('watch_progress')
        .upsert({
          user_id: this.userId,
          content_id: this.contentId,
          last_position: currentTime,
          watch_duration: currentTime, // Could track cumulative watch time separately
          is_completed: this.isCompleted,
          completed_at: this.isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: ['user_id', 'content_id']
        });
      
      if (error) throw error;
      
      console.log(`💾 Progress synced: ${currentTime}s${this.isCompleted ? ' (completed)' : ''}`);
      
      // Trigger callback
      if (this.onProgressSync) {
        this.onProgressSync({
          contentId: this.contentId,
          position: currentTime,
          duration: duration,
          completed: this.isCompleted
        });
      }
      
    } catch (error) {
      console.error('❌ Progress sync failed:', error);
      this._handleError('syncProgress', error);
      // Don't throw — continue session even if sync fails
    }
  }

  async _updateCompletionStatus(isCompleted) {
    if (!this.userId) return;
    
    try {
      const { error } = await this.supabase
        .from('watch_progress')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .eq('content_id', this.contentId);
      
      if (error) throw error;
      
      console.log(`✅ Completion status updated: ${isCompleted}`);
      
    } catch (error) {
      console.error('❌ Failed to update completion:', error);
      this._handleError('updateCompletion', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(ua)) {
      return 'mobile';
    }
    if (/Tablet|iPad/i.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  }

  _handleError(context, error) {
    console.error(`❌ WatchSession error [${context}]:`, error);
    
    if (this.onError) {
      this.onError({ context, error: error.message || error });
    }
    
    // In production, you might send to error tracking service here
    // e.g., Sentry, LogRocket, etc.
  }

  // Cleanup on garbage collection (optional but good practice)
  [Symbol.dispose]?.() {
    this.stop();
  }
}

// Export for module systems + global fallback
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WatchSession;
} else {
  window.WatchSession = WatchSession;
}

console.log('✅ WatchSession module loaded');
