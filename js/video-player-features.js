// js/video-player-features.js - Phase 1 Critical Fixes
// ✅ COMPLETE REWRITE - NO creator_id references

/**
 * PHASE 1 CRITICAL FIXES:
 * 1. Remove duplicate control systems
 * 2. Fix fullscreen API implementation
 * 3. Implement view deduplication
 * 4. Fix memory leaks
 * 5. NO creator_id references anywhere
 */

class VideoPlayerFeatures {
  constructor() {
    this.viewDeduplicationKey = 'bantu_viewed_content';
    this.viewWindowHours = 24;
    this.initialized = false;
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
      elements.forEach(el => {
        if (el.parentNode) {
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
          fullscreenBtn.innerHTML = this.isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
        }
        
        setTimeout(() => {
          if (this.controls) {
            this.controls.style.opacity = '1';
            this.controls.style.pointerEvents = 'all';
          }
        }, 100);
      };
      
      document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
      document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
      document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
      document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
      
      console.log('✅ Fullscreen API fixed');
    }
  }

  handleFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement || 
                           document.webkitFullscreenElement || 
                           document.mozFullScreenElement || 
                           document.msFullscreenElement);
    
    if (window.enhancedVideoPlayer) {
      window.enhancedVideoPlayer.isFullscreen = isFullscreen;
      
      const fullscreenBtn = window.enhancedVideoPlayer.controls?.querySelector('.fullscreen-btn');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = isFullscreen ? 
          '<i class="fas fa-compress"></i>' : 
          '<i class="fas fa-expand"></i>';
      }
    }
  }

  /**
   * CRITICAL FIX #3: View deduplication system
   * ✅ COMPLETELY REWRITTEN - NO creator_id
   */
  setupViewDeduplication() {
    console.log('🔧 Setting up view deduplication...');
    
    // Complete override - no creator_id anywhere
    window.recordContentView = async function(contentId) {
      console.log('🚨 recordContentView CALLED with contentId:', contentId);
      
      try {
        let viewerId = null;
        let profileId = null;
        
        if (window.AuthHelper?.isAuthenticated?.()) {
          const userProfile = window.AuthHelper.getUserProfile();
          viewerId = userProfile?.id || null;
          profileId = userProfile?.id || null;
          console.log('👤 User ID:', viewerId);
        }

        let sessionId = sessionStorage.getItem('bantu_view_session');
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem('bantu_view_session', sessionId);
        }
        console.log('🔑 Session ID:', sessionId);

        const contentIdNum = parseInt(contentId);
        
        // Check for recent view
        const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
        const lastViewTime = viewedContent[contentIdNum];
        if (lastViewTime && (Date.now() - lastViewTime) < 3600000) {
          console.log('📊 View already recorded recently, skipping');
          return sessionId;
        }
        
        const deviceType = /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)
          ? 'mobile'
          : 'desktop';
        
        // ✅ CORRECT INSERT - ONLY columns that exist
        const insertData = {
          content_id: contentIdNum,
          viewer_id: viewerId,
          profile_id: profileId,
          session_id: sessionId,
          view_duration: 0,
          counted_as_view: false,
          device_type: deviceType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('📝 Inserting:', insertData);

        const { data, error } = await window.supabaseClient
          .from('content_views')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('❌ Insert error:', error.message);
          return null;
        }

        console.log('✅ View recorded:', data.id);
        
        // Mark as viewed
        viewedContent[contentIdNum] = Date.now();
        localStorage.setItem('bantu_viewed_content', JSON.stringify(viewedContent));
        
        return sessionId;
      } catch (error) {
        console.error('❌ View recording error:', error);
        return null;
      }
    };
    
    console.log('✅ View deduplication setup complete');
  }

  /**
   * Check if content was viewed recently
   */
  static hasViewedContent(contentId) {
    try {
      const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
      const viewTime = viewedContent[contentId];
      if (!viewTime) return false;
      return (Date.now() - viewTime) < 3600000; // 1 hour
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
      const originalDestroy = window.EnhancedVideoPlayer.prototype.destroy;
      
      window.EnhancedVideoPlayer.prototype.destroy = function() {
        console.log('🧹 Cleaning up video player resources...');
        
        if (this.video) {
          this.video.pause();
          this.video.src = '';
          this.video.load();
        }
        
        if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
        if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
        
        if (this.video) {
          const events = [
            'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
            'canplaythrough', 'loadeddata', 'loadedmetadata',
            'timeupdate', 'progress', 'seeking', 'seeked',
            'volumechange', 'ratechange'
          ];
          events.forEach(event => {
            this.video.removeEventListener(event, this.handleVideoEvent);
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
        
        console.log('✅ Video player resources cleaned up');
      };
      
      console.log('✅ Memory leak fixes applied');
    }
  }

  /**
   * Initialize all Phase 1 fixes
   */
  initialize() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Phase 1 video player fixes...');
    
    this.removeDuplicateControls();
    this.setupFullscreenFix();
    this.setupViewDeduplication();
    this.setupMemoryLeakFix();
    
    this.initialized = true;
    console.log('✅ Phase 1 fixes initialized successfully');
    
    this.setupAdditionalEventListeners();
  }

  /**
   * Setup additional event listeners
   */
  setupAdditionalEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (!window.enhancedVideoPlayer) return;
      
      switch(e.key.toLowerCase()) {
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
            window.enhancedVideoPlayer.video.muted = !window.enhancedVideoPlayer.video.muted;
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
      }
    });
    
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
      videoContainer.addEventListener('dblclick', (e) => {
        if (window.enhancedVideoPlayer && window.enhancedVideoPlayer.toggleFullscreen) {
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
      const videoContainer = document.querySelector('.video-container');
      if (videoContainer) {
        let touchTimer;
        
        videoContainer.addEventListener('touchstart', () => {
          if (window.enhancedVideoPlayer && window.enhancedVideoPlayer.controls) {
            window.enhancedVideoPlayer.controls.style.opacity = '1';
            window.enhancedVideoPlayer.controls.style.pointerEvents = 'all';
            
            clearTimeout(touchTimer);
            touchTimer = setTimeout(() => {
              if (window.enhancedVideoPlayer && 
                  window.enhancedVideoPlayer.controls && 
                  !window.enhancedVideoPlayer.video.paused) {
                window.enhancedVideoPlayer.controls.style.opacity = '0';
                window.enhancedVideoPlayer.controls.style.pointerEvents = 'none';
              }
            }, 3000);
          }
        });
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const videoPlayerFeatures = new VideoPlayerFeatures();
    videoPlayerFeatures.initialize();
    videoPlayerFeatures.setupTouchDeviceSupport();
    
    window.clearViewCache = () => VideoPlayerFeatures.clearViewCache();
    window.hasViewedContent = (id) => VideoPlayerFeatures.hasViewedContent(id);
  }, 1000);
});

window.VideoPlayerFeatures = VideoPlayerFeatures;

console.log('✅ Video Player Features (Phase 1) loaded - NO creator_id');
