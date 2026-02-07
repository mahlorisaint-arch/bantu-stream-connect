// js/video-player-features.js - Phase 1 Critical Fixes

/**
 * PHASE 1 CRITICAL FIXES:
 * 1. Remove duplicate control systems
 * 2. Fix fullscreen API implementation
 * 3. Implement view deduplication
 * 4. Fix memory leaks
 */

class VideoPlayerFeatures {
  constructor() {
    this.viewDeduplicationKey = 'bantu_viewed_content';
    this.viewWindowHours = 24;
    this.initialized = false;
  }

  /**
   * CRITICAL FIX #1: Remove all duplicate control systems
   * This function removes ALL Bantu branded controls that conflict with EnhancedVideoPlayer
   */
  removeDuplicateControls() {
    console.log('🔧 Removing duplicate control systems...');
    
    // Remove all Bantu branded control elements
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
    
    // Ensure video element has no native controls
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (videoElement) {
      videoElement.controls = false;
      videoElement.removeAttribute('controls');
    }
    
    console.log('✅ Duplicate controls removed');
  }

  /**
   * CRITICAL FIX #2: Proper fullscreen API implementation
   * Uses correct element (video-container) instead of inline-player
   */
  setupFullscreenFix() {
    console.log('🔧 Setting up fullscreen API fix...');
    
    // Override EnhancedVideoPlayer's toggleFullscreen method
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {
      const originalToggleFullscreen = window.EnhancedVideoPlayer.prototype.toggleFullscreen;
      
      window.EnhancedVideoPlayer.prototype.toggleFullscreen = function() {
        // Use the actual video container, not the inline-player wrapper
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) {
          console.error('Video container not found for fullscreen');
          return;
        }
        
        if (!this.isFullscreen) {
          // Request fullscreen on the video container
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
          // Exit fullscreen
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
        
        // Update button icon
        const fullscreenBtn = this.controls?.querySelector('.fullscreen-btn');
        if (fullscreenBtn) {
          fullscreenBtn.innerHTML = this.isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
        }
        
        // Force controls to show in fullscreen
        setTimeout(() => {
          if (this.controls) {
            this.controls.style.opacity = '1';
            this.controls.style.pointerEvents = 'all';
          }
        }, 100);
      };
      
      // Add fullscreen change listeners
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
    
    // Update all EnhancedVideoPlayer instances
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
   * Prevents view count inflation by tracking views in localStorage
   */
  setupViewDeduplication() {
    console.log('🔧 Setting up view deduplication...');
    
    // Override the view recording logic in content-detail.js
    const originalRecordView = window.recordContentView;
    
    window.recordContentView = async function(contentId) {
      try {
        // Check if view was already recorded recently
        if (VideoPlayerFeatures.hasViewedContent(contentId)) {
          console.log(`📊 View already recorded for content ${contentId} in last 24h`);
          return;
        }
        
        // Record the view
        VideoPlayerFeatures.markContentAsViewed(contentId);
        
        // Call original function
        if (originalRecordView) {
          return await originalRecordView.call(this, contentId);
        }
        
        console.log(`✅ New view recorded for content ${contentId}`);
      } catch (error) {
        console.error('❌ Error recording view:', error);
      }
    };
    
    console.log('✅ View deduplication setup complete');
  }

  /**
   * Check if content was viewed in the last 24 hours
   */
  static hasViewedContent(contentId) {
    try {
      const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
      const viewTime = viewedContent[contentId];
      
      if (!viewTime) return false;
      
      const hoursSinceView = (Date.now() - viewTime) / (1000 * 60 * 60);
      return hoursSinceView < 24;
    } catch (error) {
      console.error('Error checking view history:', error);
      return false;
    }
  }

  /**
   * Mark content as viewed
   */
  static markContentAsViewed(contentId) {
    try {
      const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
      viewedContent[contentId] = Date.now();
      
      // Clean up old entries (older than 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      Object.keys(viewedContent).forEach(id => {
        if (viewedContent[id] < sevenDaysAgo) {
          delete viewedContent[id];
        }
      });
      
      localStorage.setItem('bantu_viewed_content', JSON.stringify(viewedContent));
    } catch (error) {
      console.error('Error marking content as viewed:', error);
    }
  }

  /**
   * CRITICAL FIX #4: Fix memory leaks in player lifecycle
   */
  setupMemoryLeakFix() {
    console.log('🔧 Setting up memory leak fixes...');
    
    // Store original destroy method
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {
      const originalDestroy = window.EnhancedVideoPlayer.prototype.destroy;
      
      window.EnhancedVideoPlayer.prototype.destroy = function() {
        console.log('🧹 Cleaning up video player resources...');
        
        // Clear video source before destroying
        if (this.video) {
          this.video.pause();
          this.video.src = '';
          this.video.load();
        }
        
        // Clear all timeouts and intervals
        if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
        if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
        
        // Remove all event listeners
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
        
        // Remove controls
        if (this.controls && this.controls.parentNode) {
          this.controls.parentNode.removeChild(this.controls);
        }
        
        // Clear event listeners map
        if (this.eventListeners) {
          this.eventListeners.clear();
        }
        
        // Call original destroy method
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
    
    // Fix 1: Remove duplicate controls
    this.removeDuplicateControls();
    
    // Fix 2: Setup proper fullscreen API
    this.setupFullscreenFix();
    
    // Fix 3: Setup view deduplication
    this.setupViewDeduplication();
    
    // Fix 4: Fix memory leaks
    this.setupMemoryLeakFix();
    
    this.initialized = true;
    console.log('✅ Phase 1 fixes initialized successfully');
    
    // Setup additional event listeners
    this.setupAdditionalEventListeners();
  }

  /**
   * Setup additional event listeners for better UX
   */
  setupAdditionalEventListeners() {
    // Keyboard shortcuts
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
    
    // Double click for fullscreen
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
   * Fix for touch devices - ensure controls are accessible
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
  // Wait a bit for other scripts to load
  setTimeout(() => {
    const videoPlayerFeatures = new VideoPlayerFeatures();
    videoPlayerFeatures.initialize();
    
    // Setup touch device support
    videoPlayerFeatures.setupTouchDeviceSupport();
  }, 1000);
});

// Export for use in other scripts
window.VideoPlayerFeatures = VideoPlayerFeatures;

console.log('✅ Video Player Features (Phase 1) loaded');
