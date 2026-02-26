// js/video-player.js - Bantu Stream Connect Enhanced Video Player
// COMPLETE FIXED VERSION WITH ALL REQUIRED METHODS AND NULL CHECKS

class EnhancedVideoPlayer {
  constructor(options = {}) {
    // Default configuration
    this.config = {
      autoplay: false,
      muted: false,
      loop: false,
      preload: 'metadata',
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      qualityLevels: ['auto', '360p', '480p', '720p', '1080p'],
      retryCount: 3,
      retryDelay: 2000,
      bufferThreshold: 10,
      networkCheckInterval: 5000,
      ...options
    };
    
    // Player elements
    this.video = null;
    this.container = null;
    this.controls = null;
    this.socialPanel = null;
    
    // Player state
    this.isFullscreen = false;
    this.isPiP = false;
    this.isBuffering = false;
    this.playbackRate = 1.0;
    this.currentQuality = 'auto';
    this.retryAttempts = 0;
    this.errorState = null;
    this.bufferingTimeout = null;
    this.networkCheckInterval = null;
    this.playbackStartTime = null;
    this.watchedSegments = [];
    
    // Event listeners
    this.eventListeners = new Map();
    
    // Stats
    this.stats = {
      playCount: 0,
      totalWatchTime: 0,
      bufferingCount: 0,
      bufferingTime: 0,
      qualityChanges: 0,
      errorCount: 0
    };
    
    // Social features
    this.contentId = options.contentId || null;
    this.supabase = options.supabaseClient || window.supabaseClient;
    this.userId = options.userId || (window.AuthHelper?.getUserProfile?.()?.id || null);
    
    this.likeCount = options.likeCount || 0;
    this.viewCount = options.viewCount || 0;
    this.favoriteCount = options.favoriteCount || 0;
    this.shareCount = options.shareCount || 0;
    this.isLiked = options.isLiked || false;
    this.isFavorited = options.isFavorited || false;
    
    console.log('✅ EnhancedVideoPlayer initialized');
  }
  
  // ======================
  // CORE METHODS - UPDATED
  // ======================
  
  attach(videoElement, container) {
    console.log('🔗 Attaching EnhancedVideoPlayer to video element');
    
    if (!videoElement) {
        throw new Error('Video element is required');
    }

    this.video = videoElement;
    this.container = container || videoElement.parentElement;
    
    // ============================================
    // CRITICAL FIX: Preserve existing video source
    // ============================================
    var existingSrc = this.video.src || this.video.getAttribute('src');
    var existingSourceElements = Array.from(this.video.querySelectorAll('source'));
    
    console.log('📥 Existing video src:', existingSrc);
    console.log('📥 Existing source elements:', existingSourceElements.length);
    
    // Store existing source info before we modify anything
    var preservedSource = null;
    var preservedType = null;
    
    if (existingSourceElements.length > 0) {
        preservedSource = existingSourceElements[0].src;
        preservedType = existingSourceElements[0].type;
    } else if (existingSrc) {
        preservedSource = existingSrc;
        // Infer type from URL
        if (preservedSource.endsWith('.mp4')) {
            preservedType = 'video/mp4';
        } else if (preservedSource.endsWith('.webm')) {
            preservedType = 'video/webm';
        } else if (preservedSource.endsWith('.mov')) {
            preservedType = 'video/quicktime';
        }
    }
    
    console.log('💾 Preserved source:', preservedSource);
    console.log('💾 Preserved type:', preservedType);

    // Remove native controls
    this.video.controls = false;
    this.video.removeAttribute('controls');

    // Configure video element
    this.video.autoplay = this.config.autoplay;
    this.video.muted = this.config.muted;
    this.video.loop = this.config.loop;
    this.video.preload = this.config.preload;

    // Create and setup custom controls
    this.createCustomControls();
    this.setupVideoEventListeners();
    
    // Initialize social features if content ID is provided
    if (this.contentId) {
      this.initializeSocialFeatures();
    }

    // ============================================
    // CRITICAL: Restore video source AFTER setup
    // ============================================
    if (preservedSource) {
        console.log('🔄 Restoring video source...');
        
        // Clear any existing sources
        while (this.video.firstChild) {
            this.video.removeChild(this.video.firstChild);
        }
        
        // Remove existing src attribute
        this.video.removeAttribute('src');
        
        // Create new source element
        var source = document.createElement('source');
        source.src = preservedSource;
        source.type = preservedType || 'video/mp4';
        
        // Add source to video element
        this.video.appendChild(source);
        
        // Force reload
        this.video.load();
        
        console.log('✅ Video source restored successfully');
    }

    console.log('✅ EnhancedVideoPlayer attached to video element');
    return this;
  }
  
  // ======================
  // EVENT HANDLERS (CRITICAL FIX)
  // ======================
  
  setupEventHandlers() {
    console.log('🔧 Setting up event handlers');
    // This is called from init() but we'll handle events differently
  }
  
  setupVideoEventListeners() {
    var self = this;
    var events = [
      'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
      'canplaythrough', 'loadeddata', 'loadedmetadata',
      'timeupdate', 'progress', 'seeking', 'seeked',
      'volumechange', 'ratechange', 'enterpictureinpicture',
      'leavepictureinpicture'
    ];
    
    events.forEach(function(event) {
      self.video.addEventListener(event, function(e) {
        self.handleVideoEvent(event, e);
      });
    });
    
    console.log('✅ Video event listeners setup');
  }
  
  handleVideoEvent(event, e) {
    // CRITICAL FIX: Add null check at top
    if (!this.video) return;
    
    switch(event) {
      case 'play':
        this.handlePlay();
        this.emit('play', this.video.currentTime);
        break;
      case 'pause':
        this.handlePause();
        this.emit('pause', this.video.currentTime);
        break;
      case 'timeupdate':
        this.emit('timeupdate', this.video.currentTime);
        break;
      case 'volumechange':
        this.emit('volumechange', this.video.volume);
        break;
      case 'error':
        this.handleError(e);
        this.emit('error', e);
        break;
      case 'waiting':
        this.handleBuffering();
        break;
      case 'canplay':
      case 'canplaythrough':
        this.handleCanPlay();
        break;
    }
  }
  
  handlePlay() {
    // CRITICAL FIX: Add null check
    if (!this.video) return;
    
    this.playbackStartTime = Date.now();
    this.stats.playCount++;
    
    // Update play button icon
    if (this.controls) {
      var playBtn = this.controls.querySelector('.play-pause');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      }
    }
    
    this.emit('playbackstart', {
      timestamp: this.playbackStartTime,
      currentTime: this.video.currentTime
    });
  }
  
  handlePause() {
    // CRITICAL FIX: Add null check
    if (!this.video) return;
    
    if (this.playbackStartTime) {
      var watchTime = Date.now() - this.playbackStartTime;
      this.stats.totalWatchTime += watchTime;
      this.playbackStartTime = null;
      
      // Update play button icon
      if (this.controls) {
        var playBtn = this.controls.querySelector('.play-pause');
        if (playBtn) {
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
      }
      
      this.emit('playbackpause', {
        watchTime: watchTime,
        currentTime: this.video.currentTime
      });
    }
  }
  
  handleError(error) {
    console.error('Video player error:', error);
    this.stats.errorCount++;
    this.errorState = error;
    
    // Show error overlay
    this.showErrorOverlay('Unable to play video. Please check your connection.');
    
    this.emit('error', error);
  }
  
  handleBuffering() {
    this.isBuffering = true;
    this.stats.bufferingCount++;
    var startTime = Date.now();
    var self = this;
    
    this.bufferingTimeout = setTimeout(function() {
      if (self.isBuffering) {
        self.stats.bufferingTime += Date.now() - startTime;
        self.showBufferingIndicator();
      }
    }, 500);
    
    this.emit('bufferingstart');
  }
  
  handleCanPlay() {
    this.isBuffering = false;
    clearTimeout(this.bufferingTimeout);
    this.hideBufferingIndicator();
    
    this.emit('bufferingend');
  }
  
  // ======================
  // PLAYER CONTROLS
  // ======================
  
  createCustomControls() {
    if (!this.container) return;
    
    // Remove any existing controls
    var existingControls = this.container.querySelector('.enhanced-video-controls');
    if (existingControls) {
      existingControls.remove();
    }
    
    // Create controls container
    this.controls = document.createElement('div');
    this.controls.className = 'enhanced-video-controls';
    this.controls.innerHTML = this.getControlsHTML();
    
    // Style controls
    this.controls.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
      padding: 10px;
      z-index: 100;
      transition: opacity 0.3s ease;
      opacity: 0;
    `;
    
    // Add to container
    this.container.appendChild(this.controls);
    
    // Setup control listeners
    this.setupControlListeners();
    
    // Show/hide controls on hover
    var self = this;
    this.container.addEventListener('mouseenter', function() {
      if (self.controls) self.controls.style.opacity = '1';
    });
    
    this.container.addEventListener('mouseleave', function() {
      // CRITICAL FIX: Add null check
      if (!self.video) return;
      if (!self.video.paused && self.controls) {
        self.controls.style.opacity = '0';
      }
    });
    
    this.video.addEventListener('play', function() {
      if (self.controls) self.controls.style.opacity = '1';
    });
    
    this.video.addEventListener('pause', function() {
      if (self.controls) self.controls.style.opacity = '1';
    });
    
    console.log('✅ Custom controls created');
  }
  
  getControlsHTML() {
    return `
      <div class="controls-bar">
        <button class="control-btn play-pause" title="Play/Pause">
          <i class="fas fa-play"></i>
        </button>
        
        <div class="time-display">
          <span class="current-time">0:00</span>
          <span> / </span>
          <span class="duration">0:00</span>
        </div>
        
        <div class="progress-container">
          <input type="range" class="progress-bar" min="0" max="100" value="0">
        </div>
        
        <button class="control-btn volume-btn" title="Volume">
          <i class="fas fa-volume-up"></i>
        </button>
        
        <input type="range" class="volume-bar" min="0" max="100" value="100">
        
        <button class="control-btn settings-btn" title="Settings">
          <i class="fas fa-cog"></i>
        </button>
        
        <button class="control-btn fullscreen-btn" title="Fullscreen">
          <i class="fas fa-expand"></i>
        </button>
      </div>
      
      <div class="settings-menu" style="display: none;">
        <div class="settings-section">
          <h4>Playback Speed</h4>
          <div class="speed-options">
            ${this.config.playbackRates.map(function(rate) {
              return `
                <button class="speed-option ${rate === 1 ? 'active' : ''}" data-rate="${rate}">
                  ${rate}x
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  setupControlListeners() {
    if (!this.controls) return;
    
    var self = this;
    
    // Play/Pause button
    var playBtn = this.controls.querySelector('.play-pause');
    if (playBtn) {
      playBtn.addEventListener('click', function() {
        self.togglePlay();
      });
    }
    
    // Progress bar
    var progressBar = this.controls.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.addEventListener('input', function(e) {
        var percent = e.target.value;
        var time = (percent / 100) * (self.video.duration || 0);
        self.seek(time);
      });
    }
    
    // Volume button
    var volumeBtn = this.controls.querySelector('.volume-btn');
    var volumeBar = this.controls.querySelector('.volume-bar');
    
    if (volumeBtn && volumeBar) {
      volumeBtn.addEventListener('click', function() {
        if (!self.video) return;
        self.video.muted = !self.video.muted;
        volumeBtn.innerHTML = self.video.muted ? 
          '<i class="fas fa-volume-mute"></i>' : 
          '<i class="fas fa-volume-up"></i>';
        volumeBar.value = self.video.muted ? 0 : self.video.volume * 100;
      });
      
      volumeBar.addEventListener('input', function(e) {
        if (!self.video) return;
        var volume = e.target.value / 100;
        self.video.volume = volume;
        self.video.muted = volume === 0;
        volumeBtn.innerHTML = volume === 0 ? 
          '<i class="fas fa-volume-mute"></i>' : 
          '<i class="fas fa-volume-up"></i>';
      });
    }
    
    // Settings button
    var settingsBtn = this.controls.querySelector('.settings-btn');
    var settingsMenu = this.controls.querySelector('.settings-menu');
    
    if (settingsBtn && settingsMenu) {
      settingsBtn.addEventListener('click', function() {
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
      });
      
      // Close settings when clicking outside
      document.addEventListener('click', function(e) {
        if (settingsMenu && settingsMenu.style.display === 'block' && 
            !settingsMenu.contains(e.target) && 
            !settingsBtn.contains(e.target)) {
          settingsMenu.style.display = 'none';
        }
      });
    }
    
    // Speed options
    var speedOptions = this.controls.querySelectorAll('.speed-option');
    speedOptions.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var rate = parseFloat(e.target.dataset.rate);
        self.setPlaybackRate(rate);
        
        // Update active state
        speedOptions.forEach(function(b) {
          b.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Hide settings menu
        if (settingsMenu) settingsMenu.style.display = 'none';
      });
    });
    
    // Fullscreen button
    var fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function() {
        self.toggleFullscreen();
      });
    }
    
    // Update time display
    this.video.addEventListener('timeupdate', function() {
      self.updateTimeDisplay();
    });
    
    console.log('✅ Control listeners setup');
  }
  
  updateTimeDisplay() {
    // CRITICAL FIX: Add null check at top
    if (!this.controls || !this.video) return;
    
    var currentTime = this.video.currentTime;
    var duration = this.video.duration || 0;
    
    // Update time display
    var currentTimeEl = this.controls.querySelector('.current-time');
    var durationEl = this.controls.querySelector('.duration');
    var progressBar = this.controls.querySelector('.progress-bar');
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(currentTime);
    }
    
    if (durationEl) {
      durationEl.textContent = this.formatTime(duration);
    }
    
    if (progressBar) {
      var progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      progressBar.value = progress;
    }
  }
  
  // ======================
  // PLAYER ACTIONS
  // ======================
  
  play() {
    var self = this;
    return this.video.play().catch(function(error) {
      self.handleError({ target: self.video });
      throw error;
    });
  }
  
  pause() {
    if (this.video) {
      this.video.pause();
    }
  }
  
  togglePlay() {
    if (!this.video) return;
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  seek(time) {
    if (!isNaN(time) && isFinite(time) && this.video) {
      this.video.currentTime = time;
    }
  }
  
  setPlaybackRate(rate) {
    if (this.video) {
      this.video.playbackRate = rate;
      this.playbackRate = rate;
      this.emit('ratechange', rate);
    }
  }
  
  setVolume(volume) {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
      this.video.muted = this.video.volume === 0;
      this.emit('volumechange', this.video.volume);
    }
  }
  
  // ======================
  // CRITICAL FIX: FULLSCREEN
  // ======================
  
  toggleFullscreen() {
    // Use the player container, not video element
    var playerContainer = document.querySelector('.inline-player');
    if (!playerContainer) {
      console.error('Player container not found for fullscreen');
      return;
    }
    
    if (!this.isFullscreen) {
      if (playerContainer.requestFullscreen) {
        playerContainer.requestFullscreen();
      } else if (playerContainer.webkitRequestFullscreen) {
        playerContainer.webkitRequestFullscreen();
      } else if (playerContainer.mozRequestFullScreen) {
        playerContainer.mozRequestFullScreen();
      } else if (playerContainer.msRequestFullscreen) {
        playerContainer.msRequestFullscreen();
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
    
    // Force custom controls to show in fullscreen
    var self = this;
    setTimeout(function() {
      if (self.controls) self.controls.style.opacity = '1';
    }, 100);
  }
  
  // ======================
  // SOCIAL FEATURES
  // ======================
  
  initializeSocialFeatures() {
    console.log('🔧 Initializing social features');
    // This will be handled by content-detail.js
  }
  
  // ======================
  // UI HELPERS
  // ======================
  
  showBufferingIndicator() {
    // CRITICAL FIX: Add null check
    if (!this.container) return;
    
    // Create or show buffering indicator
    var indicator = this.container.querySelector('.buffering-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'buffering-indicator';
      indicator.innerHTML = `
        <div class="spinner"></div>
        <p>Buffering...</p>
      `;
      indicator.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        padding: 20px;
        border-radius: 10px;
        color: white;
        text-align: center;
        z-index: 90;
      `;
      this.container.appendChild(indicator);
    }
    indicator.style.display = 'block';
  }
  
  hideBufferingIndicator() {
    // CRITICAL FIX: Add null check
    if (!this.container) return;
    
    var indicator = this.container.querySelector('.buffering-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
  
  showErrorOverlay(message) {
    // CRITICAL FIX: Add null check
    if (!this.container) return;
    
    // Create or show error overlay
    var overlay = this.container.querySelector('.error-overlay');
    var self = this;
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'error-overlay';
      overlay.innerHTML = `
        <div class="error-content">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Playback Error</h3>
          <p class="error-message">${message}</p>
          <button class="retry-btn">Retry</button>
        </div>
      `;
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 95;
      `;
      this.container.appendChild(overlay);
      
      // Add retry button listener
      var retryBtn = overlay.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          if (self.video) {
            self.video.load();
            self.video.play().catch(console.error);
          }
          overlay.style.display = 'none';
        });
      }
    }
    overlay.style.display = 'flex';
  }
  
  hideErrorOverlay() {
    // CRITICAL FIX: Add null check
    if (!this.container) return;
    
    var overlay = this.container.querySelector('.error-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
  
  // ======================
  // UTILITY METHODS
  // ======================
  
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    seconds = Math.floor(seconds);
    var minutes = Math.floor(seconds / 60);
    var secs = seconds % 60;
    
    return minutes + ':' + (secs < 10 ? '0' + secs : secs);
  }
  
  formatCount(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
  
  // ======================
  // EVENT SYSTEM
  // ======================
  
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      var callbacks = this.eventListeners.get(event);
      var index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(function(callback) {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in ' + event + ' listener:', error);
        }
      });
    }
  }
  
  // ======================
  // CRITICAL FIX: DESTROY METHOD
  // ======================
  
  destroy() {
    console.log('🗑️ Destroying EnhancedVideoPlayer...');
    
    // ============================================
    // CRITICAL FIX: Preserve video source on destroy
    // ============================================
    var preservedSource = null;
    var preservedType = null;
    
    if (this.video) {
        var existingSources = this.video.querySelectorAll('source');
        if (existingSources.length > 0) {
            preservedSource = existingSources[0].src;
            preservedType = existingSources[0].type;
        } else if (this.video.src) {
            preservedSource = this.video.src;
            if (preservedSource.endsWith('.mp4')) preservedType = 'video/mp4';
            else if (preservedSource.endsWith('.webm')) preservedType = 'video/webm';
            else if (preservedSource.endsWith('.mov')) preservedType = 'video/quicktime';
        }
    }
    
    console.log('💾 Preserving video source on destroy:', preservedSource);

    // Remove event listeners
    if (this.video) {
        var events = [
          'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
          'canplaythrough', 'loadeddata', 'loadedmetadata',
          'timeupdate', 'progress', 'seeking', 'seeked',
          'volumechange', 'ratechange'
        ];
        
        var self = this;
        events.forEach(function(event) {
          self.video.removeEventListener(event, self.handleVideoEvent);
        });
    }
    
    // Clear timeouts/intervals
    if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
    if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
    
    // Remove controls
    if (this.controls && this.controls.parentNode) {
      this.controls.parentNode.removeChild(this.controls);
    }
    
    // Remove social panel
    if (this.socialPanel && this.socialPanel.parentNode) {
      this.socialPanel.parentNode.removeChild(this.socialPanel);
    }
    
    // Clear event listeners
    this.eventListeners.clear();

    // ============================================
    // CRITICAL: Restore native controls and source
    // ============================================
    if (this.video) {
        // Restore video source
        if (preservedSource) {
            console.log('🔄 Restoring video source after destroy...');
            
            // Clear existing sources
            while (this.video.firstChild) {
                this.video.removeChild(this.video.firstChild);
            }
            
            // Remove src attribute
            this.video.removeAttribute('src');
            
            // Create new source element
            var source = document.createElement('source');
            source.src = preservedSource;
            source.type = preservedType || 'video/mp4';
            
            // Add source back
            this.video.appendChild(source);
            
            // Reload video
            this.video.load();
        }
        
        // Restore native controls
        this.video.controls = true;
        
        console.log('✅ Video source preserved after destroy');
    }

    // Clear references
    this.video = null;
    this.container = null;
    
    console.log('✅ EnhancedVideoPlayer destroyed');
  }
  
  // ======================
  // GETTERS
  // ======================
  
  getStats() {
    return Object.assign({}, this.stats);
  }
  
  getCurrentTime() {
    return this.video?.currentTime || 0;
  }
  
  getDuration() {
    return this.video?.duration || 0;
  }
  
  isPaused() {
    return this.video?.paused ?? true;
  }
  
  getVolume() {
    return this.video?.volume || 0;
  }
  
  isMuted() {
    return this.video?.muted || false;
  }
}

// Export for global use
window.EnhancedVideoPlayer = EnhancedVideoPlayer;
window.BantuVideoPlayer = EnhancedVideoPlayer; // For compatibility

console.log('✅ Enhanced Video Player loaded successfully with null checks');
