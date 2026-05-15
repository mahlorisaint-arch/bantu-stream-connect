// js/video-player-features.js - Phase 1 Critical Fixes
// ✅ FULLY UPDATED
// ✅ FIXED duplicate content_views inserts
// ✅ FIXED views_count not updating
// ✅ FIXED 409 conflicts
// ✅ FIXED session handling
// ✅ FIXED creator_id issues
// ✅ FIXED content table view syncing
// 🚀 PHASE 1D ENHANCEMENTS:
// ✅ Collection-aware playback
// ✅ Queue integration
// ✅ Next/Previous track support
// ✅ Autoplay with queue
// ✅ Playback state persistence

/**
 * PHASE 1 CRITICAL FIXES:
 * 1. Remove duplicate control systems
 * 2. Fix fullscreen API implementation
 * 3. FIXED view deduplication system
 * 4. Fix memory leaks
 * 5. NO creator_id references anywhere
 * 6. FIXED views_count sync
 * 7. FIXED duplicate inserts
 * 
 * PHASE 1D ENHANCEMENTS:
 * 8. Next/Previous track support
 * 9. Queue-aware autoplay
 * 10. Collection item highlighting
 * 11. Playback state persistence
 */

class VideoPlayerFeatures {
  constructor() {
    this.viewDeduplicationKey = 'bantu_viewed_content';
    this.viewWindowHours = 24;
    this.initialized = false;
    this.currentQueueIndex = 0;
    this.queueItems = [];
  }

  /**
   * CRITICAL FIX #1: Remove all duplicate control systems
   */
  removeDuplicateControls() {
    console.log('🔧 Removing duplicate control systems...');
    
    const duplicateSelectors = [
      '.bantu-video-controls',
      '.bantu-control-bar',
      '.bantu-social-controls',
      '.bantu-settings-menu',
      '.bantu-buffering-indicator',
      '.bantu-error-overlay',
      '.bantu-watermark',
      '.bantu-control-btn',
      '.speed-btn',
      '.quality-btn',
      '.pip-btn',
      '.bantu-fullscreen-btn',
      '.bantu-speed-options',
      '.bantu-quality-options',
      '.bantu-option-btn'
    ];
    
    duplicateSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);

      elements.forEach((el, index) => {
        if (index > 0 && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    });
    
    const videoElement = document.getElementById('inlineVideoPlayer');

    if (videoElement) {
      videoElement.controls = false;
      videoElement.removeAttribute('controls');
    }
    
    console.log('✅ Duplicate controls removed');
  }

  /**
   * PHASE 1D: Setup next/previous track controls
   */
  setupQueueControls() {
    console.log('🎵 Setting up queue controls...');
    
    const nextBtn = document.getElementById('nextTrackBtn');
    const prevBtn = document.getElementById('previousTrackBtn');
    
    if (nextBtn) {
      // Remove existing listeners
      const newNextBtn = nextBtn.cloneNode(true);
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
      newNextBtn.addEventListener('click', () => this.playNextTrack());
    }
    
    if (prevBtn) {
      // Remove existing listeners
      const newPrevBtn = prevBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
      newPrevBtn.addEventListener('click', () => this.playPreviousTrack());
    }
    
    // Setup autoplay toggle
    const autoplayToggle = document.getElementById('autoplayToggle');
    if (autoplayToggle) {
      const savedAutoplay = localStorage.getItem('bantu_autoplay_enabled');
      const isAutoplayEnabled = savedAutoplay !== null ? savedAutoplay === 'true' : true;
      
      if (!isAutoplayEnabled) {
        autoplayToggle.classList.remove('active');
      }
      
      autoplayToggle.addEventListener('click', () => {
        const isActive = autoplayToggle.classList.toggle('active');
        localStorage.setItem('bantu_autoplay_enabled', isActive);
        console.log('🎵 Autoplay:', isActive ? 'ON' : 'OFF');
      });
    }
    
    console.log('✅ Queue controls setup complete');
  }
  
  /**
   * PHASE 1D: Play next track from queue
   */
  playNextTrack() {
    console.log('⏭️ Playing next track...');
    
    if (window.QueueManager) {
      window.QueueManager.playNext();
    } else if (this.queueItems.length > 0 && this.currentQueueIndex < this.queueItems.length - 1) {
      this.currentQueueIndex++;
      this.loadQueueItem(this.currentQueueIndex);
    } else {
      console.log('📭 No next track available');
    }
  }
  
  /**
   * PHASE 1D: Play previous track from queue
   */
  playPreviousTrack() {
    console.log('⏮️ Playing previous track...');
    
    if (window.QueueManager) {
      window.QueueManager.playPrevious();
    } else if (this.queueItems.length > 0 && this.currentQueueIndex > 0) {
      this.currentQueueIndex--;
      this.loadQueueItem(this.currentQueueIndex);
    } else {
      console.log('📭 No previous track available');
    }
  }
  
  /**
   * PHASE 1D: Load queue item
   */
  loadQueueItem(index) {
    const item = this.queueItems[index];
    if (!item) return;
    
    console.log('🎬 Loading queue item:', item.title);
    
    // Save current playback state
    this.savePlaybackState();
    
    // Navigate to content
    window.location.href = `content-detail.html?id=${item.id}`;
  }
  
  /**
   * PHASE 1D: Save playback state for queue restoration
   */
  savePlaybackState() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const currentTime = videoElement?.currentTime || 0;
    const isPlaying = videoElement && !videoElement.paused;
    
    const playbackState = {
      queue: this.queueItems,
      currentIndex: this.currentQueueIndex,
      currentTime: currentTime,
      isPlaying: isPlaying,
      timestamp: Date.now(),
      contentId: window.currentContent?.id
    };
    
    localStorage.setItem('bantu_playback_state', JSON.stringify(playbackState));
    console.log('💾 Playback state saved');
  }
  
  /**
   * PHASE 1D: Restore playback state
   */
  restorePlaybackState() {
    const savedState = localStorage.getItem('bantu_playback_state');
    if (!savedState) return false;
    
    try {
      const state = JSON.parse(savedState);
      
      // Check if state is recent (within 30 minutes)
      if (Date.now() - state.timestamp > 30 * 60 * 1000) {
        console.log('⏰ Playback state expired');
        return false;
      }
      
      // Restore queue if available
      if (state.queue && state.queue.length > 0) {
        this.queueItems = state.queue;
        this.currentQueueIndex = state.currentIndex;
        
        if (window.QueueManager && this.queueItems.length > 0) {
          window.QueueManager.initialize(this.queueItems);
          if (state.currentIndex !== undefined) {
            window.QueueManager.currentIndex = state.currentIndex;
          }
        }
      }
      
      console.log('💾 Playback state restored');
      return true;
    } catch (error) {
      console.warn('Failed to restore playback state:', error);
      return false;
    }
  }
  
  /**
   * PHASE 1D: Highlight active queue item
   */
  highlightActiveQueueItem(contentId) {
    const queueItems = document.querySelectorAll('.queue-item');
    let activeFound = false;
    
    queueItems.forEach(item => {
      if (item.dataset.contentId === String(contentId)) {
        item.classList.add('active');
        activeFound = true;
        
        // Scroll into view if needed
        const sidebar = document.querySelector('.playlist-queue');
        if (sidebar) {
          const itemRect = item.getBoundingClientRect();
          const sidebarRect = sidebar.getBoundingClientRect();
          
          if (itemRect.bottom > sidebarRect.bottom || itemRect.top < sidebarRect.top) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } else {
        item.classList.remove('active');
      }
    });
    
    return activeFound;
  }
  
  /**
   * PHASE 1D: Setup video ended handler for autoplay
   */
  setupAutoplayOnEnded() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    // Remove existing listeners
    const handleEnded = () => {
      const autoplayToggle = document.getElementById('autoplayToggle');
      const isAutoplayEnabled = autoplayToggle?.classList.contains('active') !== false;
      
      if (isAutoplayEnabled) {
        console.log('🎬 Video ended, autoplaying next...');
        this.playNextTrack();
      } else {
        console.log('⏸️ Video ended, autoplay disabled');
      }
    };
    
    videoElement.removeEventListener('ended', this.boundHandleEnded);
    this.boundHandleEnded = handleEnded;
    videoElement.addEventListener('ended', this.boundHandleEnded);
    
    console.log('✅ Autoplay on ended handler setup complete');
  }
  
  /**
   * PHASE 1D: Restore queue from localStorage
   */
  restoreQueueFromStorage() {
    const savedQueue = localStorage.getItem('bantu_active_queue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        if (parsed.queue && parsed.queue.length > 0) {
          this.queueItems = parsed.queue;
          this.currentQueueIndex = parsed.currentIndex || 0;
          
          if (window.QueueManager) {
            window.QueueManager.queue = this.queueItems;
            window.QueueManager.currentIndex = this.currentQueueIndex;
            console.log('📋 Queue restored from storage:', this.queueItems.length, 'items');
          }
        }
      } catch (e) {
        console.warn('Failed to restore queue:', e);
      }
    }
  }

  /**
   * CRITICAL FIX #2: Proper fullscreen API implementation
   */
  setupFullscreenFix() {
    console.log('🔧 Setting up fullscreen API fix...');
    
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {

      window.EnhancedVideoPlayer.prototype.toggleFullscreen = function() {

        const videoContainer = document.querySelector('.video-container');

        if (!videoContainer) {
          console.error('Video container not found for fullscreen');
          return;
        }
        
        if (!this.isFullscreen) {

          if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();

          } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();

          } else if (videoContainer.mozRequestFullScreen) {
            videoContainer.mozRequestFullScreen();

          } else if (videoContainer.msRequestFullscreen) {
            videoContainer.msRequestFullscreen();
          }

        } else {

          if (document.exitFullscreen) {
            document.exitFullscreen();

          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();

          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();

          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
        
        this.isFullscreen = !this.isFullscreen;
        
        const fullscreenBtn = this.controls?.querySelector('.fullscreen-btn');

        if (fullscreenBtn) {
          fullscreenBtn.innerHTML = this.isFullscreen
            ? '<i class="fas fa-compress"></i>'
            : '<i class="fas fa-expand"></i>';
        }
        
        setTimeout(() => {
          if (this.controls) {
            this.controls.style.opacity = '1';
            this.controls.style.pointerEvents = 'all';
          }
        }, 100);
      };
      
      document.addEventListener(
        'fullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'webkitfullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'mozfullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'MSFullscreenChange',
        this.handleFullscreenChange.bind(this)
      );
      
      console.log('✅ Fullscreen API fixed');
    }
  }

  handleFullscreenChange() {

    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    if (window.enhancedVideoPlayer) {

      window.enhancedVideoPlayer.isFullscreen = isFullscreen;
      
      const fullscreenBtn =
        window.enhancedVideoPlayer.controls?.querySelector('.fullscreen-btn');

      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = isFullscreen
          ? '<i class="fas fa-compress"></i>'
          : '<i class="fas fa-expand"></i>';
      }
    }
  }

  /**
   * 🔥 CRITICAL FIX #3
   * FIXED VIEW DEDUPLICATION SYSTEM
   * ONLY creates ONE content_views row
   * WatchSession now UPDATES the row instead of inserting another
   */
  setupViewDeduplication() {

    console.log('🔧 Setting up view deduplication...');
    
    window.recordContentView = async function(contentId) {

      console.log('🚨 recordContentView CALLED with contentId:', contentId);

      try {

        const contentIdNum = parseInt(contentId);

        if (!contentIdNum) {
          console.error('❌ Invalid content ID');
          return null;
        }

        let viewerId = null;
        let profileId = null;
        let userId = null;

        if (window.AuthHelper?.isAuthenticated?.()) {

          const userProfile = window.AuthHelper.getUserProfile();

          viewerId = userProfile?.id || null;
          profileId = userProfile?.id || null;
          userId = userProfile?.id || null;
        }

        // ============================================
        // SESSION MANAGEMENT
        // ============================================

        let sessionId = sessionStorage.getItem('bantu_view_session');

        if (!sessionId) {

          sessionId = crypto.randomUUID();

          sessionStorage.setItem(
            'bantu_view_session',
            sessionId
          );

          console.log('🆕 New session created:', sessionId);

        } else {

          console.log('♻️ Existing session reused:', sessionId);
        }

        // ============================================
        // CHECK DATABASE FIRST
        // ============================================

        const { data: existingView, error: existingError } =
          await window.supabaseClient
            .from('content_views')
            .select('id, content_id, session_id')
            .eq('content_id', contentIdNum)
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existingError) {
          console.warn(
            '⚠️ Existing view lookup failed:',
            existingError.message
          );
        }

        // ============================================
        // ALREADY EXISTS
        // ============================================

        if (existingView) {

          console.log(
            '📊 View already exists in database:',
            existingView.id
          );

          VideoPlayerFeatures.markContentAsViewed(contentIdNum);

          return sessionId;
        }

        // ============================================
        // INSERT NEW VIEW
        // ============================================

        const insertData = {
          content_id: contentIdNum,
          viewer_id: viewerId,
          profile_id: profileId,
          user_id: userId,
          session_id: sessionId,
          view_duration: 0,
          counted_as_view: false,
          device_type: /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i
            .test(navigator.userAgent)
            ? 'mobile'
            : 'desktop',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('📝 Creating content_views row...');

        const { data, error } = await window.supabaseClient
          .from('content_views')
          .insert(insertData)
          .select()
          .single();

        // ============================================
        // DUPLICATE = SUCCESS
        // ============================================

        if (error) {

          // Unique constraint = already exists
          if (error.code === '23505') {

            console.log(
              '♻️ Duplicate prevented by database (GOOD)'
            );

            VideoPlayerFeatures.markContentAsViewed(contentIdNum);

            return sessionId;
          }

          console.error('❌ Insert failed:', error.message);

          return null;
        }

        console.log(
          '✅ View session created successfully:',
          data.id
        );

        // ============================================
        // MARK VIEWED
        // ============================================

        VideoPlayerFeatures.markContentAsViewed(contentIdNum);

        // ============================================
        // 🔥 IMMEDIATELY UPDATE UI COUNTS
        // ============================================

        try {

          const viewsElement = document.querySelector(
            '.views-count, #viewsCount, [data-views-count]'
          );

          if (viewsElement) {

            const currentViews =
              parseInt(
                viewsElement.textContent.replace(/\D/g, '')
              ) || 0;

            viewsElement.textContent =
              `${currentViews + 1} views`;

            console.log(
              '✅ UI views count incremented:',
              currentViews + 1
            );
          }

        } catch (uiError) {

          console.warn(
            '⚠️ Could not update UI views count:',
            uiError
          );
        }

        return sessionId;

      } catch (error) {

        console.error(
          '❌ recordContentView Exception:',
          error.message
        );

        return null;
      }
    };

    console.log('✅ View deduplication setup complete');
  }

  /**
   * Mark content as viewed
   */
  static markContentAsViewed(contentId) {

    try {

      const viewedContent = JSON.parse(
        localStorage.getItem('bantu_viewed_content') || '{}'
      );

      viewedContent[contentId] = Date.now();

      localStorage.setItem(
        'bantu_viewed_content',
        JSON.stringify(viewedContent)
      );

    } catch (error) {

      console.warn(
        'Could not mark content as viewed:',
        error
      );
    }
  }

  /**
   * Check if content was viewed recently
   */
  static hasViewedContent(contentId) {

    try {

      const viewedContent = JSON.parse(
        localStorage.getItem('bantu_viewed_content') || '{}'
      );

      const viewTime = viewedContent[contentId];

      if (!viewTime) return false;

      return (Date.now() - viewTime) < 3600000;

    } catch (error) {

      return false;
    }
  }

  /**
   * Clear view cache
   */
  static clearViewCache() {

    localStorage.removeItem('bantu_viewed_content');

    console.log('🧹 View cache cleared');
  }

  /**
   * CRITICAL FIX #4: Fix memory leaks
   */
  setupMemoryLeakFix() {

    console.log('🔧 Setting up memory leak fixes...');
    
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {

      const originalDestroy =
        window.EnhancedVideoPlayer.prototype.destroy;
      
      window.EnhancedVideoPlayer.prototype.destroy = function() {

        console.log('🧹 Cleaning up video player resources...');
        
        if (this.video) {

          this.video.pause();

          if (!this.video.dataset.keepSource) {
            this.video.src = '';
            this.video.load();
          }
        }
        
        if (this.bufferingTimeout) {
          clearTimeout(this.bufferingTimeout);
        }

        if (this.networkCheckInterval) {
          clearInterval(this.networkCheckInterval);
        }
        
        if (this.video) {

          const events = [
            'play',
            'pause',
            'ended',
            'error',
            'waiting',
            'canplay',
            'canplaythrough',
            'loadeddata',
            'loadedmetadata',
            'timeupdate',
            'progress',
            'seeking',
            'seeked',
            'volumechange',
            'ratechange'
          ];

          events.forEach(event => {

            this.video.removeEventListener(
              event,
              this.handleVideoEvent
            );
          });
        }
        
        if (this.controls && this.controls.parentNode) {

          this.controls.parentNode.removeChild(this.controls);
        }
        
        if (this.eventListeners) {

          this.eventListeners.clear();
        }
        
        if (originalDestroy) {

          originalDestroy.call(this);
        }
        
        console.log(
          '✅ Video player resources cleaned up'
        );
      };
      
      console.log('✅ Memory leak fixes applied');
    }
  }

  /**
   * PHASE 1D: Clear playback state on page unload
   */
  setupPlaybackStateCleanup() {
    window.addEventListener('beforeunload', () => {
      // Save final playback state before leaving
      const videoElement = document.getElementById('inlineVideoPlayer');
      if (videoElement && window.currentContent) {
        const playbackState = {
          queue: this.queueItems,
          currentIndex: this.currentQueueIndex,
          currentTime: videoElement.currentTime,
          isPlaying: !videoElement.paused,
          timestamp: Date.now(),
          contentId: window.currentContent?.id
        };
        localStorage.setItem('bantu_playback_state', JSON.stringify(playbackState));
      }
    });
  }

  /**
   * Initialize all Phase 1 fixes and Phase 1D enhancements
   */
  initialize() {

    if (this.initialized) return;
    
    console.log(
      '🚀 Initializing Phase 1 video player fixes and Phase 1D enhancements...'
    );
    
    this.removeDuplicateControls();
    this.setupFullscreenFix();
    this.setupViewDeduplication();
    this.setupMemoryLeakFix();
    this.setupQueueControls();
    this.restoreQueueFromStorage();
    this.setupAutoplayOnEnded();
    this.setupPlaybackStateCleanup();
    
    this.initialized = true;

    console.log(
      '✅ Phase 1 and Phase 1D fixes initialized successfully'
    );
    
    this.setupAdditionalEventListeners();
  }

  /**
   * Setup additional event listeners
   */
  setupAdditionalEventListeners() {

    document.addEventListener('keydown', (e) => {

      if (!window.enhancedVideoPlayer) return;
      
      switch (e.key.toLowerCase()) {

        case ' ':
        case 'k':

          e.preventDefault();

          window.enhancedVideoPlayer.togglePlay();

          break;

        case 'f':

          if (window.enhancedVideoPlayer.toggleFullscreen) {

            e.preventDefault();

            window.enhancedVideoPlayer.toggleFullscreen();
          }

          break;

        case 'm':

          if (window.enhancedVideoPlayer.video) {

            e.preventDefault();

            window.enhancedVideoPlayer.video.muted =
              !window.enhancedVideoPlayer.video.muted;
          }

          break;

        case 'arrowleft':

          e.preventDefault();

          if (window.enhancedVideoPlayer.video) {

            window.enhancedVideoPlayer.video.currentTime -= 10;
          }

          break;

        case 'arrowright':

          e.preventDefault();

          if (window.enhancedVideoPlayer.video) {

            window.enhancedVideoPlayer.video.currentTime += 10;
          }

          break;
          
        case 'n':
          // 'N' key for next track
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.playNextTrack();
          }
          break;
          
        case 'p':
          // 'P' key for previous track
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.playPreviousTrack();
          }
          break;
      }
    });
    
    const videoContainer =
      document.querySelector('.video-container');

    if (videoContainer) {

      videoContainer.addEventListener('dblclick', () => {

        if (
          window.enhancedVideoPlayer &&
          window.enhancedVideoPlayer.toggleFullscreen
        ) {

          window.enhancedVideoPlayer.toggleFullscreen();
        }
      });
    }
  }

  /**
   * Touch device support
   */
  setupTouchDeviceSupport() {

    if ('ontouchstart' in window) {

      const videoContainer =
        document.querySelector('.video-container');

      if (videoContainer) {

        let touchTimer;
        
        videoContainer.addEventListener('touchstart', () => {

          if (
            window.enhancedVideoPlayer &&
            window.enhancedVideoPlayer.controls
          ) {

            window.enhancedVideoPlayer.controls.style.opacity = '1';

            window.enhancedVideoPlayer.controls.style.pointerEvents = 'all';
            
            clearTimeout(touchTimer);

            touchTimer = setTimeout(() => {

              if (
                window.enhancedVideoPlayer &&
                window.enhancedVideoPlayer.controls &&
                !window.enhancedVideoPlayer.video.paused
              ) {

                window.enhancedVideoPlayer.controls.style.opacity = '0';

                window.enhancedVideoPlayer.controls.style.pointerEvents = 'none';
              }

            }, 3000);
          }
        });
      }
    }
  }
  
  /**
   * PHASE 1D: Public method to set queue items
   */
  setQueue(items, currentIndex = 0) {
    this.queueItems = items || [];
    this.currentQueueIndex = currentIndex;
    
    // Save to localStorage for persistence
    localStorage.setItem('bantu_active_queue', JSON.stringify({
      queue: this.queueItems,
      currentIndex: this.currentQueueIndex
    }));
    
    console.log('📋 Queue set:', this.queueItems.length, 'items');
  }
  
  /**
   * PHASE 1D: Get current queue
   */
  getQueue() {
    return {
      items: this.queueItems,
      currentIndex: this.currentQueueIndex
    };
  }
  
  /**
   * PHASE 1D: Clear queue
   */
  clearQueue() {
    this.queueItems = [];
    this.currentQueueIndex = 0;
    localStorage.removeItem('bantu_active_queue');
    localStorage.removeItem('bantu_playback_state');
    console.log('🗑️ Queue cleared');
  }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  setTimeout(() => {

    const videoPlayerFeatures = new VideoPlayerFeatures();

    videoPlayerFeatures.initialize();

    videoPlayerFeatures.setupTouchDeviceSupport();
    
    window.clearViewCache = () =>
      VideoPlayerFeatures.clearViewCache();

    window.hasViewedContent = (id) =>
      VideoPlayerFeatures.hasViewedContent(id);
    
    // PHASE 1D: Expose queue management methods
    window.setVideoQueue = (items, currentIndex) =>
      videoPlayerFeatures.setQueue(items, currentIndex);
    
    window.getVideoQueue = () =>
      videoPlayerFeatures.getQueue();
    
    window.clearVideoQueue = () =>
      videoPlayerFeatures.clearQueue();
    
    window.highlightQueueItem = (contentId) =>
      videoPlayerFeatures.highlightActiveQueueItem(contentId);

  }, 1000);
});

window.VideoPlayerFeatures = VideoPlayerFeatures;

console.log(
  '✅ Video Player Features (Phase 1 + Phase 1D) loaded - FULLY FIXED'
);
