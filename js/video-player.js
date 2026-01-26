// js/video-player.js - Enhanced Video Player with Error Handling

class EnhancedVideoPlayer {
  constructor(options = {}) {
    this.defaults = {
      autoplay: false,
      muted: false,
      loop: false,
      controls: true,
      preload: 'metadata',
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      qualityLevels: ['auto', '360p', '480p', '720p', '1080p'],
      retryCount: 3,
      retryDelay: 2000,
      bufferThreshold: 10,
      networkCheckInterval: 5000,
      ...options
    };
    
    this.video = null;
    this.container = null;
    this.controls = null;
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
    this.eventListeners = new Map();
    this.stats = {
      playCount: 0,
      totalWatchTime: 0,
      bufferingCount: 0,
      bufferingTime: 0,
      qualityChanges: 0,
      errorCount: 0
    };
    
    this.init();
  }
  
  init() {
    this.setupEventHandlers();
    this.setupNetworkMonitoring();
  }
  
  attach(videoElement, containerElement) {
    this.video = videoElement;
    this.container = containerElement || videoElement.parentElement;
    
    if (!this.video || this.video.tagName !== 'VIDEO') {
      throw new Error('Invalid video element');
    }
    
    // Configure video element
    this.video.autoplay = this.defaults.autoplay;
    this.video.muted = this.defaults.muted;
    this.video.loop = this.defaults.loop;
    this.video.preload = this.defaults.preload;
    
    if (!this.defaults.controls) {
      this.video.controls = false;
      this.createCustomControls();
    }
    
    this.setupVideoEventListeners();
    this.createErrorOverlay();
    this.createBufferingIndicator();
    
    // Restore saved state
    this.restorePlaybackState();
    
    console.log('✅ Enhanced video player attached');
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
  }
  
  handleVideoEvent(event, originalEvent) {
    this.emit(event, originalEvent);
    
    switch (event) {
      case 'play':
        this.handlePlay();
        break;
      case 'pause':
        this.handlePause();
        break;
      case 'error':
        this.handleError(originalEvent);
        break;
      case 'waiting':
        this.handleBufferingStart();
        break;
      case 'canplay':
      case 'canplaythrough':
        this.handleBufferingEnd();
        break;
      case 'timeupdate':
        this.handleTimeUpdate();
        break;
      case 'seeking':
        this.handleSeeking();
        break;
      case 'enterpictureinpicture':
        this.isPiP = true;
        this.emit('pictureinpicturechange', true);
        break;
      case 'leavepictureinpicture':
        this.isPiP = false;
        this.emit('pictureinpicturechange', false);
        break;
    }
  }
  
  handlePlay() {
    this.playbackStartTime = Date.now();
    this.stats.playCount++;
    
    this.emit('playbackstart', {
      timestamp: this.playbackStartTime,
      currentTime: this.video.currentTime
    });
    
    this.startWatchTimeTracking();
  }
  
  handlePause() {
    if (this.playbackStartTime) {
      const watchTime = Date.now() - this.playbackStartTime;
      this.stats.totalWatchTime += watchTime;
      this.playbackStartTime = null;
      
      this.emit('playbackpause', {
        watchTime,
        currentTime: this.video.currentTime
      });
    }
    
    this.savePlaybackState();
  }
  
  handleError(event) {
    const error = this.video.error;
    this.stats.errorCount++;
    this.errorState = {
      code: error?.code || 0,
      message: this.getErrorMessage(error?.code),
      timestamp: Date.now(),
      src: this.video.src
    };
    
    console.error('Video error:', this.errorState);
    
    this.showErrorOverlay(this.errorState.message);
    this.attemptErrorRecovery();
    
    this.emit('error', this.errorState);
  }
  
  getErrorMessage(code) {
    const messages = {
      1: 'Video loading was aborted',
      2: 'Network error while loading video',
      3: 'Video decoding failed',
      4: 'Video not supported',
      5: 'Video source could not be loaded'
    };
    
    return messages[code] || 'Unknown video error';
  }
  
  async attemptErrorRecovery() {
    if (this.retryAttempts >= this.defaults.retryCount) {
      console.log('Max retry attempts reached');
      return;
    }
    
    this.retryAttempts++;
    
    this.updateErrorOverlay(`Retrying... (${this.retryAttempts}/${this.defaults.retryCount})`);
    
    await this.delay(this.defaults.retryDelay);
    
    const strategies = [
      () => this.retryWithBackoff(),
      () => this.tryLowerQuality(),
      () => this.tryAlternativeSource()
    ];
    
    for (const strategy of strategies) {
      if (await strategy()) {
        console.log('Recovery successful');
        this.hideErrorOverlay();
        return;
      }
    }
    
    this.updateErrorOverlay('Unable to play video. Please try again later.');
  }
  
  async retryWithBackoff() {
    try {
      this.video.src = '';
      await this.delay(1000);
      this.video.src = this.errorState.src;
      await this.video.load();
      await this.video.play();
      this.retryAttempts = 0;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async tryLowerQuality() {
    console.log('Attempting lower quality...');
    return false;
  }
  
  async tryAlternativeSource() {
    const sources = this.video.querySelectorAll('source');
    if (sources.length > 1) {
      const currentSrc = this.video.src;
      
      for (const source of sources) {
        if (source.src !== currentSrc) {
          try {
            this.video.src = source.src;
            await this.video.load();
            await this.video.play();
            return true;
          } catch (error) {
            continue;
          }
        }
      }
    }
    
    return false;
  }
  
  handleBufferingStart() {
    if (!this.isBuffering) {
      this.isBuffering = true;
      this.stats.bufferingCount++;
      const startTime = Date.now();
      
      this.showBufferingIndicator();
      
      this.bufferingTimeout = setTimeout(() => {
        if (this.isBuffering) {
          this.emit('bufferingwarning', {
            duration: Date.now() - startTime,
            currentTime: this.video.currentTime
          });
          
          this.suggestQualityDowngrade();
        }
      }, 5000);
      
      this.emit('bufferingstart', { timestamp: startTime });
    }
  }
  
  handleBufferingEnd() {
    if (this.isBuffering) {
      this.isBuffering = false;
      clearTimeout(this.bufferingTimeout);
      this.hideBufferingIndicator();
      this.emit('bufferingend', { timestamp: Date.now() });
    }
  }
  
  handleTimeUpdate() {
    const currentTime = Math.floor(this.video.currentTime);
    
    if (!this.watchedSegments.includes(currentTime)) {
      this.watchedSegments.push(currentTime);
      
      if (currentTime % 10 === 0) {
        this.emit('progress', {
          currentTime,
          duration: this.video.duration,
          percent: (currentTime / this.video.duration) * 100
        });
      }
    }
    
    if (currentTime % 30 === 0) {
      this.savePlaybackState();
    }
  }
  
  handleSeeking() {
    this.emit('seeking', {
      currentTime: this.video.currentTime,
      timestamp: Date.now()
    });
  }
  
  setupNetworkMonitoring() {
    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkQuality();
    }, this.defaults.networkCheckInterval);
    
    window.addEventListener('online', () => this.handleNetworkRestored());
    window.addEventListener('offline', () => this.handleNetworkLost());
  }
  
  async checkNetworkQuality() {
    if (!navigator.connection) return;
    
    const connection = navigator.connection;
    const downlink = connection.downlink;
    const rtt = connection.rtt;
    
    this.emit('networkquality', {
      downlink,
      rtt,
      effectiveType: connection.effectiveType,
      timestamp: Date.now()
    });
    
    if (downlink < 1.5) {
      this.autoAdjustQuality('480p');
    } else if (downlink < 3) {
      this.autoAdjustQuality('720p');
    } else {
      this.autoAdjustQuality('1080p');
    }
  }
  
  handleNetworkLost() {
    this.emit('networklost', { timestamp: Date.now() });
    
    if (this.video.readyState >= 3) {
      this.video.playbackRate = 0.9;
    }
  }
  
  handleNetworkRestored() {
    this.emit('networkrestored', { timestamp: Date.now() });
    
    if (this.video.playbackRate === 0.9) {
      this.video.playbackRate = this.playbackRate;
    }
    
    if (this.video.paused && this.video.currentTime > 0) {
      this.video.play().catch(console.error);
    }
  }
  
  createErrorOverlay() {
    this.errorOverlay = document.createElement('div');
    this.errorOverlay.className = 'video-error-overlay';
    this.errorOverlay.style.display = 'none';
    this.errorOverlay.innerHTML = `
      <div class="error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Playback Error</h3>
        <p class="error-message"></p>
        <button class="retry-btn">Retry</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;
    
    if (this.container) {
      this.container.appendChild(this.errorOverlay);
    } else {
      document.body.appendChild(this.errorOverlay);
    }
    
    this.errorOverlay.querySelector('.retry-btn').addEventListener('click', () => {
      this.attemptErrorRecovery();
    });
    
    this.errorOverlay.querySelector('.cancel-btn').addEventListener('click', () => {
      this.hideErrorOverlay();
    });
  }
  
  showErrorOverlay(message) {
    if (this.errorOverlay) {
      this.errorOverlay.querySelector('.error-message').textContent = message;
      this.errorOverlay.style.display = 'flex';
    }
  }
  
  updateErrorOverlay(message) {
    if (this.errorOverlay) {
      this.errorOverlay.querySelector('.error-message').textContent = message;
    }
  }
  
  hideErrorOverlay() {
    if (this.errorOverlay) {
      this.errorOverlay.style.display = 'none';
    }
  }
  
  createBufferingIndicator() {
    this.bufferingIndicator = document.createElement('div');
    this.bufferingIndicator.className = 'buffering-indicator';
    this.bufferingIndicator.style.display = 'none';
    this.bufferingIndicator.innerHTML = `
      <div class="spinner"></div>
      <p>Buffering...</p>
    `;
    
    if (this.container) {
      this.container.appendChild(this.bufferingIndicator);
    }
  }
  
  showBufferingIndicator() {
    if (this.bufferingIndicator) {
      this.bufferingIndicator.style.display = 'flex';
    }
  }
  
  hideBufferingIndicator() {
    if (this.bufferingIndicator) {
      this.bufferingIndicator.style.display = 'none';
    }
  }
  
  createCustomControls() {
    this.controls = document.createElement('div');
    this.controls.className = 'video-controls';
    
    const controlsHTML = `
      <div class="controls-bar">
        <button class="control-btn play-pause" title="Play/Pause">
          <i class="fas fa-play"></i>
        </button>
        <div class="time-display">
          <span class="current-time">0:00</span> / 
          <span class="duration">0:00</span>
        </div>
        <input type="range" class="progress-bar" min="0" max="100" value="0">
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
        <div class="playback-speed">
          <h4>Playback Speed</h4>
          ${this.defaults.playbackRates.map(rate => 
            `<button class="speed-option ${rate === 1 ? 'active' : ''}" data-rate="${rate}">${rate}x</button>`
          ).join('')}
        </div>
        <div class="quality-selector">
          <h4>Quality</h4>
          ${this.defaults.qualityLevels.map(quality => 
            `<button class="quality-option ${quality === 'auto' ? 'active' : ''}" data-quality="${quality}">${quality}</button>`
          ).join('')}
        </div>
      </div>
    `;
    
    this.controls.innerHTML = controlsHTML;
    
    if (this.container) {
      this.container.appendChild(this.controls);
      this.setupControlListeners();
    }
  }
  
  setupControlListeners() {
    if (!this.controls) return;
    
    // Play/Pause
    this.controls.querySelector('.play-pause').addEventListener('click', () => {
      this.togglePlay();
    });
    
    // Progress bar
    const progressBar = this.controls.querySelector('.progress-bar');
    progressBar.addEventListener('input', (e) => {
      const percent = e.target.value;
      const time = (percent / 100) * this.video.duration;
      this.seek(time);
    });
    
    // Volume
    const volumeBtn = this.controls.querySelector('.volume-btn');
    const volumeBar = this.controls.querySelector('.volume-bar');
    
    volumeBtn.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      volumeBtn.querySelector('i').className = this.video.muted ? 
        'fas fa-volume-mute' : 'fas fa-volume-up';
    });
    
    volumeBar.addEventListener('input', (e) => {
      this.video.volume = e.target.value / 100;
    });
    
    // Fullscreen
    this.controls.querySelector('.fullscreen-btn').addEventListener('click', () => {
      this.toggleFullscreen();
    });
    
    // Settings
    const settingsBtn = this.controls.querySelector('.settings-btn');
    const settingsMenu = this.controls.querySelector('.settings-menu');
    
    settingsBtn.addEventListener('click', () => {
      settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    });
    
    // Playback speed
    this.controls.querySelectorAll('.speed-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rate = parseFloat(e.target.dataset.rate);
        this.setPlaybackRate(rate);
        this.controls.querySelectorAll('.speed-option').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
    
    // Quality
    this.controls.querySelectorAll('.quality-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quality = e.target.dataset.quality;
        this.setQuality(quality);
        this.controls.querySelectorAll('.quality-option').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
  }
  
  // Public API Methods
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
    if (time >= 0 && time <= this.video.duration) {
      this.video.currentTime = time;
    }
  }
  
  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.video.volume = volume;
      this.video.muted = volume === 0;
    }
  }
  
  mute() {
    this.video.muted = true;
  }
  
  unmute() {
    this.video.muted = false;
  }
  
  setPlaybackRate(rate) {
    if (this.defaults.playbackRates.includes(rate)) {
      this.video.playbackRate = rate;
      this.playbackRate = rate;
      this.emit('ratechange', { rate });
    }
  }
  
  setQuality(quality) {
    if (this.defaults.qualityLevels.includes(quality)) {
      this.currentQuality = quality;
      this.stats.qualityChanges++;
      this.emit('qualitychange', { quality });
    }
  }
  
  toggleFullscreen() {
    if (!this.isFullscreen) {
      if (this.container.requestFullscreen) {
        this.container.requestFullscreen();
      } else if (this.container.webkitRequestFullscreen) {
        this.container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
    
    this.isFullscreen = !this.isFullscreen;
  }
  
  togglePictureInPicture() {
    if (!document.pictureInPictureElement) {
      this.video.requestPictureInPicture();
    } else {
      document.exitPictureInPicture();
    }
  }
  
  savePlaybackState() {
    const state = {
      currentTime: this.video.currentTime,
      volume: this.video.volume,
      muted: this.video.muted,
      playbackRate: this.video.playbackRate,
      timestamp: Date.now()
    };
    
    localStorage.setItem('video_playback_state', JSON.stringify(state));
  }
  
  restorePlaybackState() {
    try {
      const saved = localStorage.getItem('video_playback_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          this.video.currentTime = state.currentTime;
          this.video.volume = state.volume;
          this.video.muted = state.muted;
          this.video.playbackRate = state.playbackRate;
        }
      }
    } catch (error) {
      console.error('Failed to restore playback state:', error);
    }
  }
  
  startWatchTimeTracking() {
    this.watchTimeInterval = setInterval(() => {
      if (!this.video.paused) {
        this.stats.totalWatchTime += 1000;
      }
    }, 1000);
  }
  
  getStats() {
    return {
      ...this.stats,
      currentTime: this.video.currentTime,
      duration: this.video.duration,
      buffering: this.isBuffering,
      volume: this.video.volume,
      muted: this.video.muted,
      playbackRate: this.video.playbackRate,
      quality: this.currentQuality
    };
  }
  
  // Event emitter system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
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
  
  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  destroy() {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
    }
    
    if (this.watchTimeInterval) {
      clearInterval(this.watchTimeInterval);
    }
    
    if (this.bufferingTimeout) {
      clearTimeout(this.bufferingTimeout);
    }
    
    // Clean up
    this.video = null;
    this.container = null;
    this.controls = null;
    this.eventListeners.clear();
    
    console.log('Video player destroyed');
  }
}

// Quality auto-adjustment
EnhancedVideoPlayer.prototype.autoAdjustQuality = function(targetQuality) {
  if (this.currentQuality !== targetQuality && targetQuality !== 'auto') {
    console.log(`Auto-adjusting quality to ${targetQuality}`);
    this.setQuality(targetQuality);
  }
};

EnhancedVideoPlayer.prototype.suggestQualityDowngrade = function() {
  const qualities = this.defaults.qualityLevels;
  const currentIndex = qualities.indexOf(this.currentQuality);
  
  if (currentIndex > 0) {
    const lowerQuality = qualities[currentIndex - 1];
    console.log(`Suggesting quality downgrade to ${lowerQuality}`);
    
    this.emit('qualitysuggestion', {
      current: this.currentQuality,
      suggested: lowerQuality,
      reason: 'buffering'
    });
    
    this.showQualitySuggestion(lowerQuality);
  }
};

EnhancedVideoPlayer.prototype.showQualitySuggestion = function(quality) {
  const suggestion = document.createElement('div');
  suggestion.className = 'quality-suggestion';
  suggestion.innerHTML = `
    <p>Poor connection. Switch to ${quality} for smoother playback?</p>
    <button class="accept-btn">Switch</button>
    <button class="dismiss-btn">Dismiss</button>
  `;
  
  if (this.container) {
    this.container.appendChild(suggestion);
    
    suggestion.querySelector('.accept-btn').addEventListener('click', () => {
      this.setQuality(quality);
      suggestion.remove();
    });
    
    suggestion.querySelector('.dismiss-btn').addEventListener('click', () => {
      suggestion.remove();
    });
    
    setTimeout(() => {
      if (suggestion.parentNode) {
        suggestion.remove();
      }
    }, 10000);
  }
};

// Export
window.EnhancedVideoPlayer = EnhancedVideoPlayer;
