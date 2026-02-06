// js/video-player.js - Bantu Stream Connect Enhanced Video Player
// COMPLETE FIXED VERSION WITH ALL REQUIRED METHODS

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
  // CORE METHODS
  // ======================
  
  attach(videoElement, containerElement) {
    this.video = videoElement;
    this.container = containerElement || videoElement.parentElement;
    
    if (!this.video || this.video.tagName !== 'VIDEO') {
      throw new Error('Invalid video element');
    }
    
    // Configure video element
    this.video.autoplay = this.config.autoplay;
    this.video.muted = this.config.muted;
    this.video.loop = this.config.loop;
    this.video.preload = this.config.preload;
    
    // Remove native controls
    this.video.controls = false;
    
    // Create and setup custom controls
    this.createCustomControls();
    this.setupVideoEventListeners();
    
    // Initialize social features if content ID is provided
    if (this.contentId) {
      this.initializeSocialFeatures();
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
    const events = [
      'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
      'canplaythrough', 'loadeddata', 'loadedmetadata',
      'timeupdate', 'progress', 'seeking', 'seeked',
      'volumechange', 'ratechange', 'enterpictureinpicture',
      'leavepictureinpicture'
    ];
    
    events.forEach(event => {
      this.video.addEventListener(event, (e) => this.handleVideoEvent(event, e));
    });
    
    console.log('✅ Video event listeners setup');
  }
  
  handleVideoEvent(event, e) {
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
    this.playbackStartTime = Date.now();
    this.stats.playCount++;
    
    // Update play button icon
    const playBtn = this.controls?.querySelector('.play-pause');
    if (playBtn) {
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    this.emit('playbackstart', {
      timestamp: this.playbackStartTime,
      currentTime: this.video.currentTime
    });
  }
  
  handlePause() {
    if (this.playbackStartTime) {
      const watchTime = Date.now() - this.playbackStartTime;
      this.stats.totalWatchTime += watchTime;
      this.playbackStartTime = null;
      
      // Update play button icon
      const playBtn = this.controls?.querySelector('.play-pause');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
      
      this.emit('playbackpause', {
        watchTime,
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
    const startTime = Date.now();
    
    this.bufferingTimeout = setTimeout(() => {
      if (this.isBuffering) {
        this.stats.bufferingTime += Date.now() - startTime;
        this.showBufferingIndicator();
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
    const existingControls = this.container.querySelector('.enhanced-video-controls');
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
    this.container.addEventListener('mouseenter', () => {
      this.controls.style.opacity = '1';
    });
    
    this.container.addEventListener('mouseleave', () => {
      if (!this.video.paused) {
        this.controls.style.opacity = '0';
      }
    });
    
    this.video.addEventListener('play', () => {
      this.controls.style.opacity = '1';
    });
    
    this.video.addEventListener('pause', () => {
      this.controls.style.opacity = '1';
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
            ${this.config.playbackRates.map(rate => `
              <button class="speed-option ${rate === 1 ? 'active' : ''}" data-rate="${rate}">
                ${rate}x
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  setupControlListeners() {
    if (!this.controls) return;
    
    // Play/Pause button
    const playBtn = this.controls.querySelector('.play-pause');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlay());
    }
    
    // Progress bar
    const progressBar = this.controls.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.addEventListener('input', (e) => {
        const percent = e.target.value;
        const time = (percent / 100) * (this.video.duration || 0);
        this.seek(time);
      });
    }
    
    // Volume button
    const volumeBtn = this.controls.querySelector('.volume-btn');
    const volumeBar = this.controls.querySelector('.volume-bar');
    
    if (volumeBtn && volumeBar) {
      volumeBtn.addEventListener('click', () => {
        this.video.muted = !this.video.muted;
        volumeBtn.innerHTML = this.video.muted ? 
          '<i class="fas fa-volume-mute"></i>' : 
          '<i class="fas fa-volume-up"></i>';
        volumeBar.value = this.video.muted ? 0 : this.video.volume * 100;
      });
      
      volumeBar.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        this.video.volume = volume;
        this.video.muted = volume === 0;
        volumeBtn.innerHTML = volume === 0 ? 
          '<i class="fas fa-volume-mute"></i>' : 
          '<i class="fas fa-volume-up"></i>';
      });
    }
    
    // Settings button
    const settingsBtn = this.controls.querySelector('.settings-btn');
    const settingsMenu = this.controls.querySelector('.settings-menu');
    
    if (settingsBtn && settingsMenu) {
      settingsBtn.addEventListener('click', () => {
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
      });
      
      // Close settings when clicking outside
      document.addEventListener('click', (e) => {
        if (settingsMenu.style.display === 'block' && 
            !settingsMenu.contains(e.target) && 
            !settingsBtn.contains(e.target)) {
          settingsMenu.style.display = 'none';
        }
      });
    }
    
    // Speed options
    const speedOptions = this.controls.querySelectorAll('.speed-option');
    speedOptions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rate = parseFloat(e.target.dataset.rate);
        this.setPlaybackRate(rate);
        
        // Update active state
        speedOptions.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
    
    // Fullscreen button
    const fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    
    // Update time display
    this.video.addEventListener('timeupdate', () => {
      this.updateTimeDisplay();
    });
    
    console.log('✅ Control listeners setup');
  }
  
  updateTimeDisplay() {
    if (!this.controls) return;
    
    const currentTime = this.video.currentTime;
    const duration = this.video.duration || 0;
    
    // Update time display
    const currentTimeEl = this.controls.querySelector('.current-time');
    const durationEl = this.controls.querySelector('.duration');
    const progressBar = this.controls.querySelector('.progress-bar');
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(currentTime);
    }
    
    if (durationEl) {
      durationEl.textContent = this.formatTime(duration);
    }
    
    if (progressBar) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      progressBar.value = progress;
    }
  }
  
  // ======================
  // PLAYER ACTIONS
  // ======================
  
  play() {
    return this.video.play().catch(error => {
      this.handleError({ target: this.video });
      throw error;
    });
  }
  
  pause() {
    this.video.pause();
  }
  
  togglePlay() {
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  seek(time) {
    if (!isNaN(time) && isFinite(time)) {
      this.video.currentTime = time;
    }
  }
  
  setPlaybackRate(rate) {
    this.video.playbackRate = rate;
    this.playbackRate = rate;
    this.emit('ratechange', rate);
  }
  
  setVolume(volume) {
    this.video.volume = Math.max(0, Math.min(1, volume));
    this.video.muted = this.video.volume === 0;
    this.emit('volumechange', this.video.volume);
  }
  
  // ======================
  // CRITICAL FIX: FULLSCREEN
  // ======================
  
  toggleFullscreen() {
    // Use the player container, not video element
    const playerContainer = document.querySelector('.inline-player');
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
    setTimeout(() => {
      if (this.controls) this.controls.style.opacity = '1';
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
    // Create or show buffering indicator
    let indicator = this.container.querySelector('.buffering-indicator');
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
    const indicator = this.container.querySelector('.buffering-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
  
  showErrorOverlay(message) {
    // Create or show error overlay
    let overlay = this.container.querySelector('.error-overlay');
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
      const retryBtn = overlay.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.video.load();
          this.video.play().catch(console.error);
          overlay.style.display = 'none';
        });
      }
    }
    overlay.style.display = 'flex';
  }
  
  hideErrorOverlay() {
    const overlay = this.container.querySelector('.error-overlay');
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
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
      const callbacks = this.eventListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
  
  // ======================
  // CLEANUP
  // ======================
  
  destroy() {
    // Remove event listeners
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
    
    // Clear timeouts/intervals
    if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
    if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
    
    // Remove controls
    if (this.controls && this.controls.parentNode) {
      this.controls.parentNode.removeChild(this.controls);
    }
    
    // Clear social panel
    if (this.socialPanel && this.socialPanel.parentNode) {
      this.socialPanel.parentNode.removeChild(this.socialPanel);
    }
    
    // Clear event listeners
    this.eventListeners.clear();
    
    console.log('✅ EnhancedVideoPlayer destroyed');
  }
  
  // ======================
  // GETTERS
  // ======================
  
  getStats() {
    return { ...this.stats };
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

console.log('✅ Enhanced Video Player loaded successfully');
