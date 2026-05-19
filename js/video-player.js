// js/video-player.js — Enhanced Video Player
// Bantu Stream Connect — Phase 3 Telemetry + Phase 1D Collection Intelligence
// ✅ Phase 3: WatchSessionManager integration for telemetry streaming
// ✅ Phase 3: playback_sessions UUID propagation for view validation
// ✅ Phase 1D: Collection/series context awareness for smart navigation
// ✅ Phase 1D: QueueManager integration for seamless playlist playback
// ✅ Audio/Video support with MIME type detection and audio-mode UI
// ✅ Autoplay policy handling with graceful fallbacks
// ✅ Mobile-optimized controls with pointer/touch event support
// ✅ Robust error handling with retry logic and user-friendly overlays
// ✅ Resource cleanup with source preservation across destroy/re-init
// ✅ Event system for cross-component communication
// ✅ Quality selection, playback speed, volume, fullscreen, PiP support
// ✅ Social features integration (likes, favorites, shares) with RPC calls

(function() {
  'use strict';
  
  console.log('🎬 EnhancedVideoPlayer module loading... (Phase 3 + Phase 1D Enhanced)');

  /**
   * EnhancedVideoPlayer — Production video/audio player with telemetry,
   * collection awareness, and robust media handling
   */
  class EnhancedVideoPlayer {
    constructor(options = {}) {
      // Configuration with Phase 3/1D defaults
      this.config = {
        // Playback
        autoplay: options.autoplay ?? false,
        muted: options.muted ?? false,
        loop: options.loop ?? false,
        preload: options.preload || 'metadata',
        playbackRates: options.playbackRates || [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        
        // Quality & Streaming
        qualityLevels: options.qualityLevels || ['auto', '360p', '480p', '720p', '1080p'],
        defaultQuality: options.defaultQuality || 'auto',
        enableAdaptiveBitrate: options.enableAdaptiveBitrate ?? true,
        
        // Error Handling
        retryCount: options.retryCount ?? 3,
        retryDelay: options.retryDelay ?? 2000,
        bufferThreshold: options.bufferThreshold ?? 10, // seconds
        networkCheckInterval: options.networkCheckInterval ?? 5000,
        
        // UI
        hideControlsDelay: options.hideControlsDelay ?? 3000,
        enableKeyboardShortcuts: options.enableKeyboardShortcuts ?? true,
        enableTouchGestures: options.enableTouchGestures ?? true,
        
        // Phase 3: Telemetry
        enableTelemetry: options.enableTelemetry ?? true,
        heartbeatInterval: options.heartbeatInterval ?? 10000,
        validViewThreshold: options.validViewThreshold ?? 30,
        
        // Phase 1D: Collection/Queue
        enableCollectionNav: options.enableCollectionNav ?? true,
        enableQueueIntegration: options.enableQueueIntegration ?? true,
        
        ...options
      };
      
      // Core elements
      this.video = null;
      this.container = null;
      this.controls = null;
      this.socialPanel = null;
      this.settingsMenu = null;
      
      // Player state
      this.isFullscreen = false;
      this.isPiP = false;
      this.isBuffering = false;
      this.isPlaying = false;
      this.playbackRate = 1.0;
      this.currentQuality = 'auto';
      this.retryAttempts = 0;
      this.errorState = null;
      this.bufferingTimeout = null;
      this.networkCheckInterval = null;
      this.controlsHideTimeout = null;
      this.playbackStartTime = null;
      this.watchedSegments = [];
      
      // Phase 3: Telemetry state
      this.playbackSessionId = null;
      this.watchSession = null;
      this.viewRecorded = false;
      this.viewValidated = false;
      
      // Phase 1D: Collection/Queue context
      this.collectionContext = {
        collectionId: null,
        playlistId: null,
        currentSortIndex: null,
        episodeNumber: null,
        itemType: null // 'episode' | 'track' | 'video'
      };
      
      // Content metadata
      this.contentId = options.contentId || null;
      this.contentMetadata = options.contentMetadata || null;
      
      // Supabase integration
      this.supabase = options.supabase || window.supabase;
      this.userId = options.userId || window.AuthHelper?.getUserProfile?.()?.id || null;
      
      // Social engagement state
      this.engagement = {
        likes: options.likeCount || 0,
        views: options.viewCount || 0,
        favorites: options.favoriteCount || 0,
        shares: options.shareCount || 0,
        isLiked: options.isLiked || false,
        isFavorited: options.isFavorited || false
      };
      
      // Stats tracking
      this.stats = {
        playCount: 0,
        totalWatchTime: 0,
        bufferingCount: 0,
        bufferingTime: 0,
        qualityChanges: 0,
        errorCount: 0,
        seekCount: 0,
        volumeChanges: 0
      };
      
      // Event system
      this.eventListeners = new Map();
      
      // Lifecycle flags
      this._isAttached = false;
      this._isDestroyed = false;
      this._listenersAttached = false;
      this._sourcePreserved = null;
      
      // Mobile detection
      this._isMobile = /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(
        navigator.userAgent || ''
      );
      
      console.log('✅ EnhancedVideoPlayer instantiated', {
        contentId: this.contentId,
        userId: this.userId,
        telemetry: this.config.enableTelemetry,
        collectionNav: this.config.enableCollectionNav
      });
    }
    
    // =====================================================
    // MIME TYPE & MEDIA DETECTION
    // =====================================================
    
    /**
     * Get MIME type for media URL
     */
    getMediaMimeType(url = '') {
      if (!url) return 'video/mp4';
      
      const lower = url.toLowerCase();
      
      // Video types
      if (lower.endsWith('.mp4')) return 'video/mp4';
      if (lower.endsWith('.webm')) return 'video/webm';
      if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
      if (lower.endsWith('.mkv')) return 'video/x-matroska';
      if (lower.endsWith('.avi')) return 'video/x-msvideo';
      if (lower.endsWith('.m3u8')) return 'application/x-mpegURL';
      if (lower.endsWith('.mpd')) return 'application/dash+xml';
      
      // Audio types
      if (lower.endsWith('.mp3')) return 'audio/mpeg';
      if (lower.endsWith('.wav')) return 'audio/wav';
      if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
      if (lower.endsWith('.m4a')) return 'audio/mp4';
      if (lower.endsWith('.aac')) return 'audio/aac';
      if (lower.endsWith('.flac')) return 'audio/flac';
      if (lower.endsWith('.wma')) return 'audio/x-ms-wma';
      
      // Default fallback
      return lower.includes('audio') ? 'audio/mpeg' : 'video/mp4';
    }
    
    /**
     * Detect if URL is audio-only
     */
    isAudioSource(url) {
      if (!url) return false;
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.wma'];
      return audioExtensions.some(ext => url.toLowerCase().endsWith(ext));
    }
    
    /**
     * Detect media type from URL or metadata
     */
    detectMediaType(url, metadata = {}) {
      if (metadata.media_type) return metadata.media_type;
      if (this.isAudioSource(url)) return 'audio';
      return 'video';
    }
    
    // =====================================================
    // ATTACHMENT & INITIALIZATION
    // =====================================================
    
    /**
     * Attach player to video element with full setup
     */
    attach(videoElement, container, options = {}) {
      if (this._isDestroyed) {
        console.warn('⚠️ Cannot attach: player has been destroyed');
        return Promise.reject(new Error('Player destroyed'));
      }
      
      if (!videoElement) {
        throw new Error('Video element is required');
      }
      
      // Prevent duplicate attachment
      if (this._isAttached && this.video === videoElement) {
        console.log('ℹ️ Player already attached to this element');
        return Promise.resolve(this);
      }
      
      // Cleanup previous attachment if re-attaching
      if (this._isAttached) {
        console.log('🔄 Cleaning up previous attachment');
        this._cleanupAttachment();
      }
      
      this.video = videoElement;
      this.container = container || videoElement.parentElement;
      
      // Merge options
      if (options.contentId) this.contentId = options.contentId;
      if (options.contentMetadata) this.contentMetadata = options.contentMetadata;
      if (options.collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...options.collectionContext };
      }
      
      // Preserve existing source before modification
      this._preserveSource();
      
      // Configure video element
      this._configureVideoElement();
      
      // Apply audio mode if needed
      this._applyAudioMode();
      
      // Create UI controls
      this._createControls();
      
      // Setup event listeners
      this._setupEventListeners();
      
      // Setup control interactions
      this._setupControlInteractions();
      
      // Initialize integrations
      this._initializeIntegrations();
      
      // Restore source and load media
      this._restoreAndLoadSource();
      
      // Mark as attached
      this._isAttached = true;
      
      console.log('✅ EnhancedVideoPlayer attached', {
        contentId: this.contentId,
        mediaType: this.detectMediaType(this._sourcePreserved?.url),
        collectionId: this.collectionContext.collectionId
      });
      
      // Emit attached event
      this._emit('player:attached', {
        contentId: this.contentId,
        container: this.container,
        mediaType: this.detectMediaType(this._sourcePreserved?.url)
      });
      
      return Promise.resolve(this);
    }
    
    /**
     * Preserve current video source for restoration
     */
    _preserveSource() {
      const video = this.video;
      
      // Check for source elements
      const sourceEl = video.querySelector('source');
      if (sourceEl?.src) {
        this._sourcePreserved = {
          url: sourceEl.src,
          type: sourceEl.type || this.getMediaMimeType(sourceEl.src),
          method: 'source-element'
        };
        return;
      }
      
      // Check for direct src attribute
      if (video.src && video.src !== window.location.href) {
        this._sourcePreserved = {
          url: video.src,
          type: this.getMediaMimeType(video.src),
          method: 'src-attribute'
        };
        return;
      }
      
      // Check for data attributes (fallback)
      const dataSrc = video.dataset.src || video.getAttribute('data-file-url');
      if (dataSrc) {
        this._sourcePreserved = {
          url: dataSrc,
          type: video.dataset.type || this.getMediaMimeType(dataSrc),
          method: 'data-attribute'
        };
      }
    }
    
    /**
     * Configure video element properties
     */
    _configureVideoElement() {
      const video = this.video;
      
      // Disable native controls
      video.controls = false;
      video.removeAttribute('controls');
      
      // Apply config settings
      video.autoplay = this.config.autoplay;
      video.loop = this.config.loop;
      video.preload = this.config.preload;
      video.playsInline = true; // iOS support
      video.crossOrigin = 'anonymous'; // CORS for metrics
      
      // Ensure audio is enabled by default
      video.muted = this.config.muted;
      video.defaultMuted = this.config.muted;
      video.volume = 1.0;
      video.defaultVolume = 1.0;
      
      // Add player class for styling
      video.classList.add('enhanced-video-player');
    }
    
    /**
     * Apply audio-mode styling if needed
     */
    _applyAudioMode() {
      const isAudio = this.isAudioSource(this._sourcePreserved?.url);
      
      if (isAudio) {
        this.video.classList.add('audio-mode');
        this.video.setAttribute('aria-label', 'Audio player');
        console.log('🎵 Audio mode applied');
      } else {
        this.video.classList.remove('audio-mode');
        this.video.setAttribute('aria-label', 'Video player');
      }
      
      // Update container class for styling
      if (this.container) {
        this.container.classList.toggle('audio-player', isAudio);
        this.container.classList.toggle('video-player', !isAudio);
      }
    }
    
    /**
     * Create custom controls UI
     */
    _createControls() {
      if (!this.container) return;
      
      // Remove existing controls
      const existingControls = this.container.querySelector('.enhanced-video-controls');
      if (existingControls) existingControls.remove();
      
      // Create controls container
      this.controls = document.createElement('div');
      this.controls.className = 'enhanced-video-controls';
      this.controls.setAttribute('role', 'toolbar');
      this.controls.setAttribute('aria-label', 'Video player controls');
      this.controls.innerHTML = this._getControlsHTML();
      
      // Apply styles
      Object.assign(this.controls.style, {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4), transparent)',
        padding: '12px 16px',
        zIndex: '100',
        transition: 'opacity 0.25s ease',
        opacity: '0',
        pointerEvents: 'auto'
      });
      
      // Add to container
      this.container.appendChild(this.controls);
      
      // Cache control references
      this._cacheControlElements();
      
      // Setup settings menu
      this._setupSettingsMenu();
      
      console.log('✅ Custom controls created');
    }
    
    /**
     * Generate controls HTML
     */
    _getControlsHTML() {
      const isMobile = this._isMobile;
      
      return `
        <!-- Main Controls Bar -->
        <div class="controls-bar" role="group" aria-label="Playback controls">
          
          <!-- Play/Pause -->
          <button class="control-btn play-pause-btn" 
                  title="Play/Pause (Space)"
                  aria-label="Play or pause video">
            <i class="fas fa-play" aria-hidden="true"></i>
          </button>
          
          <!-- Time Display -->
          <div class="time-display" aria-live="off">
            <span class="current-time">0:00</span>
            <span class="time-separator"> / </span>
            <span class="duration">0:00</span>
          </div>
          
          <!-- Progress Bar -->
          <div class="progress-container" role="slider" 
               aria-label="Video progress"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <input type="range" 
                   class="progress-bar" 
                   min="0" max="100" value="0"
                   step="0.1"
                   aria-label="Seek through video">
            <div class="progress-buffer"></div>
            <div class="progress-tooltip"></div>
          </div>
          
          <!-- Volume (desktop only) -->
          ${!isMobile ? `
          <div class="volume-group">
            <button class="control-btn volume-btn" 
                    title="Mute/Unmute (M)"
                    aria-label="Toggle mute">
              <i class="fas fa-volume-up" aria-hidden="true"></i>
            </button>
            <input type="range" 
                   class="volume-bar" 
                   min="0" max="100" value="100"
                   aria-label="Volume">
          </div>
          ` : ''}
          
          <!-- Spacer -->
          <div class="controls-spacer"></div>
          
          <!-- Collection Nav (Phase 1D) -->
          ${this.config.enableCollectionNav ? `
          <button class="control-btn prev-track-btn" 
                  title="Previous (P)"
                  aria-label="Play previous item">
            <i class="fas fa-step-backward" aria-hidden="true"></i>
          </button>
          <button class="control-btn next-track-btn" 
                  title="Next (N)"
                  aria-label="Play next item">
            <i class="fas fa-step-forward" aria-hidden="true"></i>
          </button>
          ` : ''}
          
          <!-- Settings -->
          <button class="control-btn settings-btn" 
                  title="Settings"
                  aria-label="Open settings"
                  aria-haspopup="true"
                  aria-expanded="false">
            <i class="fas fa-cog" aria-hidden="true"></i>
          </button>
          
          <!-- Picture in Picture -->
          ${document.pictureInPictureEnabled ? `
          <button class="control-btn pip-btn" 
                  title="Picture in Picture"
                  aria-label="Toggle picture in picture">
            <i class="fas fa-external-link-square-alt" aria-hidden="true"></i>
          </button>
          ` : ''}
          
          <!-- Fullscreen -->
          <button class="control-btn fullscreen-btn" 
                  title="Fullscreen (F)"
                  aria-label="Toggle fullscreen">
            <i class="fas fa-expand" aria-hidden="true"></i>
          </button>
          
        </div>
        
        <!-- Settings Menu (Hidden by Default) -->
        <div class="settings-menu" 
             role="menu" 
             aria-hidden="true"
             style="display: none;">
          
          <!-- Quality Selection -->
          <div class="settings-section" id="qualitySection">
            <h4 class="settings-title">Quality</h4>
            <div class="quality-options" id="qualityOptions" role="radiogroup">
              ${this.config.qualityLevels.map(q => `
                <button class="quality-option ${q === this.config.defaultQuality ? 'active' : ''}" 
                        data-quality="${q}"
                        role="radio"
                        aria-checked="${q === this.config.defaultQuality}">
                  ${q === 'auto' ? 'Auto' : q}
                  ${q === this.config.defaultQuality ? '<i class="fas fa-check"></i>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
          
          <!-- Playback Speed -->
          <div class="settings-section">
            <h4 class="settings-title">Speed</h4>
            <div class="speed-options" role="radiogroup">
              ${this.config.playbackRates.map(rate => `
                <button class="speed-option ${rate === 1 ? 'active' : ''}" 
                        data-rate="${rate}"
                        role="radio"
                        aria-checked="${rate === 1}">
                  ${rate}x
                  ${rate === 1 ? '<i class="fas fa-check"></i>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
          
          <!-- Data Saver Toggle -->
          <div class="settings-section" id="dataSaverSection">
            <h4 class="settings-title">Data Saver</h4>
            <label class="toggle-switch">
              <input type="checkbox" id="dataSaverToggle" aria-label="Enable data saver mode">
              <span class="toggle-slider"></span>
            </label>
            <p class="toggle-description">Reduce data usage by streaming at lower quality</p>
          </div>
          
        </div>
        
        <!-- Initial Play Overlay (for autoplay blocked) -->
        <div class="initial-play-overlay hidden" id="initialPlayOverlay">
          <button class="play-overlay-btn" aria-label="Click to play">
            <i class="fas fa-play-circle fa-3x"></i>
            <span class="play-overlay-text">Tap to Play</span>
          </button>
        </div>
        
        <!-- Buffering Indicator -->
        <div class="buffering-indicator hidden">
          <div class="spinner"></div>
          <p>Buffering...</p>
        </div>
        
        <!-- Error Overlay -->
        <div class="error-overlay hidden">
          <div class="error-content">
            <i class="fas fa-exclamation-triangle fa-2x"></i>
            <h3>Playback Error</h3>
            <p class="error-message">Unable to load media. Please check your connection.</p>
            <button class="retry-btn">Retry</button>
            <button class="dismiss-btn">Dismiss</button>
          </div>
        </div>
        
        <!-- Social Panel -->
        ${this.contentId ? `
        <div class="social-panel" aria-label="Engagement actions">
          <button class="social-btn like-btn ${this.engagement.isLiked ? 'active' : ''}" 
                  aria-label="${this.engagement.isLiked ? 'Unlike' : 'Like'}"
                  aria-pressed="${this.engagement.isLiked}">
            <i class="fas fa-heart"></i>
            <span class="social-count">${this._formatCount(this.engagement.likes)}</span>
          </button>
          <button class="social-btn favorite-btn ${this.engagement.isFavorited ? 'active' : ''}" 
                  aria-label="${this.engagement.isFavorited ? 'Remove from favorites' : 'Add to favorites'}"
                  aria-pressed="${this.engagement.isFavorited}">
            <i class="fas fa-bookmark"></i>
            <span class="social-count">${this._formatCount(this.engagement.favorites)}</span>
          </button>
          <button class="social-btn share-btn" aria-label="Share">
            <i class="fas fa-share-alt"></i>
            <span class="social-count">${this._formatCount(this.engagement.shares)}</span>
          </button>
        </div>
        ` : ''}
      `;
    }
    
    /**
     * Cache control element references
     */
    _cacheControlElements() {
      if (!this.controls) return;
      
      this._controlsCache = {
        playPauseBtn: this.controls.querySelector('.play-pause-btn'),
        currentTime: this.controls.querySelector('.current-time'),
        duration: this.controls.querySelector('.duration'),
        progressBar: this.controls.querySelector('.progress-bar'),
        progressBuffer: this.controls.querySelector('.progress-buffer'),
        volumeBtn: this.controls.querySelector('.volume-btn'),
        volumeBar: this.controls.querySelector('.volume-bar'),
        settingsBtn: this.controls.querySelector('.settings-btn'),
        settingsMenu: this.controls.querySelector('.settings-menu'),
        qualityOptions: this.controls.querySelectorAll('.quality-option'),
        speedOptions: this.controls.querySelectorAll('.speed-option'),
        fullscreenBtn: this.controls.querySelector('.fullscreen-btn'),
        pipBtn: this.controls.querySelector('.pip-btn'),
        prevTrackBtn: this.controls.querySelector('.prev-track-btn'),
        nextTrackBtn: this.controls.querySelector('.next-track-btn'),
        playOverlay: document.getElementById('initialPlayOverlay'),
        bufferingIndicator: this.controls.querySelector('.buffering-indicator'),
        errorOverlay: this.controls.querySelector('.error-overlay'),
        socialPanel: this.controls.querySelector('.social-panel')
      };
    }
    
    /**
     * Setup settings menu interactions
     */
    _setupSettingsMenu() {
      if (!this._controlsCache?.settingsBtn || !this._controlsCache?.settingsMenu) return;
      
      const { settingsBtn, settingsMenu } = this._controlsCache;
      let isOpen = false;
      
      // Toggle settings menu
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        isOpen = !isOpen;
        settingsMenu.style.display = isOpen ? 'block' : 'none';
        settingsBtn.setAttribute('aria-expanded', isOpen);
        settingsMenu.setAttribute('aria-hidden', !isOpen);
        
        console.log(`⚙️ Settings menu ${isOpen ? 'opened' : 'closed'}`);
        this._emit('settings:toggled', { isOpen });
      });
      
      // Close settings when clicking outside
      document.addEventListener('click', (e) => {
        if (isOpen && 
            !settingsMenu.contains(e.target) && 
            !settingsBtn.contains(e.target)) {
          isOpen = false;
          settingsMenu.style.display = 'none';
          settingsBtn.setAttribute('aria-expanded', 'false');
          settingsMenu.setAttribute('aria-hidden', 'true');
        }
      });
      
      // Quality selection
      this._controlsCache.qualityOptions?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const quality = e.currentTarget.dataset.quality;
          this.setQuality(quality);
          
          // Update UI
          this._controlsCache.qualityOptions.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          e.currentTarget.classList.add('active');
          e.currentTarget.setAttribute('aria-checked', 'true');
          
          // Close menu
          isOpen = false;
          settingsMenu.style.display = 'none';
          settingsBtn.setAttribute('aria-expanded', 'false');
        });
      });
      
      // Speed selection
      this._controlsCache.speedOptions?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rate = parseFloat(e.currentTarget.dataset.rate);
          this.setPlaybackRate(rate);
          
          // Update UI
          this._controlsCache.speedOptions.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          e.currentTarget.classList.add('active');
          e.currentTarget.setAttribute('aria-checked', 'true');
          
          // Close menu
          isOpen = false;
          settingsMenu.style.display = 'none';
          settingsBtn.setAttribute('aria-expanded', 'false');
        });
      });
      
      // Data saver toggle
      const dataSaverToggle = document.getElementById('dataSaverToggle');
      if (dataSaverToggle) {
        dataSaverToggle.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          console.log(`💾 Data saver: ${enabled ? 'enabled' : 'disabled'}`);
          this._emit('settings:data-saver', { enabled });
          
          // Apply quality change if enabled
          if (enabled && this.currentQuality !== '360p') {
            this.setQuality('360p');
          }
        });
      }
    }
    
    /**
     * Setup video event listeners
     */
    _setupEventListeners() {
      if (!this.video || this._listenersAttached) return;
      
      const events = [
        'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
        'canplaythrough', 'loadeddata', 'loadedmetadata',
        'timeupdate', 'progress', 'seeking', 'seeked',
        'volumechange', 'ratechange', 'durationchange',
        'enterpictureinpicture', 'leavepictureinpicture'
      ];
      
      // Bind handler to preserve context
      this._handleVideoEvent = this._handleVideoEvent.bind(this);
      
      events.forEach(event => {
        this.video.addEventListener(event, this._handleVideoEvent);
      });
      
      // Additional listeners
      this.video.addEventListener('click', (e) => this._handleVideoClick(e));
      
      // Fullscreen change listeners
      document.addEventListener('fullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('webkitfullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('mozfullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('MSFullscreenChange', () => this._handleFullscreenChange());
      
      // Picture-in-Picture listeners
      if (document.pictureInPictureEnabled) {
        this.video.addEventListener('enterpictureinpicture', () => {
          this.isPiP = true;
          this._emit('pip:enter', { video: this.video });
        });
        this.video.addEventListener('leavepictureinpicture', () => {
          this.isPiP = false;
          this._emit('pip:leave', { video: this.video });
        });
      }
      
      // Keyboard shortcuts
      if (this.config.enableKeyboardShortcuts) {
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
      }
      
      // Touch gestures for mobile
      if (this.config.enableTouchGestures && this._isMobile) {
        this._setupTouchGestures();
      }
      
      this._listenersAttached = true;
      console.log('✅ Event listeners attached');
    }
    
    /**
     * Handle video events
     */
    _handleVideoEvent(event) {
      if (!this.video || this._isDestroyed) return;
      
      switch (event.type) {
        case 'play':
          this._handlePlay();
          break;
        case 'pause':
          this._handlePause();
          break;
        case 'ended':
          this._handleEnded();
          break;
        case 'timeupdate':
          this._handleTimeUpdate();
          break;
        case 'progress':
          this._handleProgress();
          break;
        case 'waiting':
          this._handleBufferingStart();
          break;
        case 'canplay':
        case 'canplaythrough':
          this._handleBufferingEnd();
          break;
        case 'loadeddata':
          this._handleLoadedData();
          break;
        case 'loadedmetadata':
          this._handleLoadedMetadata();
          break;
        case 'error':
          this._handleError(event);
          break;
        case 'volumechange':
          this._updateVolumeUI();
          break;
        case 'ratechange':
          this.playbackRate = this.video.playbackRate;
          break;
        case 'durationchange':
          this._updateDurationDisplay();
          break;
      }
      
      // Emit generic event for external listeners
      this._emit(`video:${event.type}`, {
        event: event.type,
        currentTime: this.video.currentTime,
        duration: this.video.duration
      });
    }
    
    /**
     * Handle play event
     */
    _handlePlay() {
      this.isPlaying = true;
      this.playbackStartTime = Date.now();
      this.stats.playCount++;
      
      // Update UI
      this._updatePlayButton(true);
      this._hidePlayOverlay();
      
      // Hide controls after delay
      this._scheduleControlsHide();
      
      // Phase 3: Initialize telemetry session
      this._initializeTelemetrySession();
      
      console.log('▶️ Playing');
      this._emit('playback:play', {
        timestamp: this.playbackStartTime,
        currentTime: this.video.currentTime
      });
    }
    
    /**
     * Handle pause event
     */
    _handlePause() {
      this.isPlaying = false;
      
      // Track watch time
      if (this.playbackStartTime) {
        const watchTime = Date.now() - this.playbackStartTime;
        this.stats.totalWatchTime += watchTime;
        this.playbackStartTime = null;
        
        this._emit('playback:pause', {
          watchTime,
          currentTime: this.video.currentTime
        });
      }
      
      // Update UI
      this._updatePlayButton(false);
      this._showControls();
      
      console.log('⏸️ Paused');
      this._emit('playback:pause', {
        currentTime: this.video.currentTime
      });
    }
    
    /**
     * Handle ended event
     */
    _handleEnded() {
      this.isPlaying = false;
      this._updatePlayButton(false);
      
      // Phase 1D: Auto-advance in collection/queue
      if (this.config.enableCollectionNav && this.config.autoplay) {
        this._autoAdvance();
      }
      
      console.log('🏁 Ended');
      this._emit('playback:ended', {
        totalWatchTime: this.stats.totalWatchTime,
        duration: this.video.duration
      });
    }
    
    /**
     * Handle time update
     */
    _handleTimeUpdate() {
      this._updateTimeDisplay();
      this._updateProgressBar();
      
      // Phase 3: Record view after threshold
      if (!this.viewRecorded && 
          this.video.currentTime >= this.config.validViewThreshold) {
        this._recordView();
      }
      
      // Emit for external progress tracking
      if (this.video.currentTime % 10 < 0.1) { // Every ~10 seconds
        this._emit('playback:progress', {
          currentTime: this.video.currentTime,
          duration: this.video.duration,
          percent: (this.video.currentTime / (this.video.duration || 1)) * 100
        });
      }
    }
    
    /**
     * Handle progress (buffering) event
     */
    _handleProgress() {
      this._updateBufferedProgress();
    }
    
    /**
     * Handle buffering start
     */
    _handleBufferingStart() {
      this.isBuffering = true;
      this.stats.bufferingCount++;
      const startTime = Date.now();
      
      this.bufferingTimeout = setTimeout(() => {
        if (this.isBuffering) {
          this.stats.bufferingTime += Date.now() - startTime;
          this._showBufferingIndicator();
        }
      }, 500);
      
      this._emit('buffering:start');
    }
    
    /**
     * Handle buffering end
     */
    _handleBufferingEnd() {
      this.isBuffering = false;
      clearTimeout(this.bufferingTimeout);
      this._hideBufferingIndicator();
      
      this._emit('buffering:end');
    }
    
    /**
     * Handle loaded data
     */
    _handleLoadedData() {
      console.log('✅ Media data loaded');
      this._emit('media:loadeddata', {
        video: this.video,
        duration: this.video.duration
      });
    }
    
    /**
     * Handle loaded metadata
     */
    _handleLoadedMetadata() {
      console.log('✅ Media metadata loaded', {
        duration: this.video.duration,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight,
        audioTracks: this.video.audioTracks?.length || 0
      });
      
      // Update duration display
      this._updateDurationDisplay();
      
      // Enable audio tracks if available
      if (this.video.audioTracks?.length > 0) {
        this.video.audioTracks[0].enabled = true;
      }
      
      this._emit('media:loadedmetadata', {
        duration: this.video.duration,
        dimensions: {
          width: this.video.videoWidth,
          height: this.video.videoHeight
        }
      });
    }
    
    /**
     * Handle error with retry logic
     */
    _handleError(event) {
      const error = this.video?.error;
      
      // Ignore autoplay blocking errors (handled by overlay)
      if (!error && this.video?.networkState !== 3) {
        console.log('ℹ️ Ignoring non-critical error (likely autoplay block)');
        return;
      }
      
      console.error('❌ Media error:', {
        code: error?.code,
        message: error?.message,
        networkState: this.video?.networkState
      });
      
      this.stats.errorCount++;
      this.errorState = error;
      
      // Retry logic
      if (this.retryAttempts < this.config.retryCount) {
        this.retryAttempts++;
        console.log(`🔄 Retry attempt ${this.retryAttempts}/${this.config.retryCount}`);
        
        setTimeout(() => {
          if (!this._isDestroyed) {
            this.video?.load();
            this.play().catch(() => {});
          }
        }, this.config.retryDelay * this.retryAttempts);
        
        return;
      }
      
      // Show error overlay after max retries
      this._showErrorOverlay('Unable to play media. Please check your connection and try again.');
      
      this._emit('media:error', {
        error: error,
        retryAttempts: this.retryAttempts,
        maxRetries: this.config.retryCount
      });
    }
    
    /**
     * Handle video click (toggle play/pause)
     */
    _handleVideoClick(event) {
      // Ignore clicks on controls
      if (event.target.closest('.enhanced-video-controls')) return;
      
      this.togglePlay();
      this._showControls();
    }
    
    /**
     * Handle keyboard shortcuts
     */
    _handleKeyboard(event) {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      
      // Ignore if settings menu is open
      if (this._controlsCache?.settingsMenu?.style.display === 'block') return;
      
      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          this.togglePlay();
          break;
        case 'arrowleft':
          event.preventDefault();
          this.seekRelative(-10);
          break;
        case 'arrowright':
          event.preventDefault();
          this.seekRelative(10);
          break;
        case 'arrowup':
          event.preventDefault();
          this.adjustVolume(0.1);
          break;
        case 'arrowdown':
          event.preventDefault();
          this.adjustVolume(-0.1);
          break;
        case 'm':
          event.preventDefault();
          this.toggleMute();
          break;
        case 'f':
          event.preventDefault();
          this.toggleFullscreen();
          break;
        case 'p':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            this.playPrevious();
          }
          break;
        case 'n':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            this.playNext();
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          event.preventDefault();
          const percent = parseInt(event.key) * 10;
          this.seekPercent(percent);
          break;
      }
    }
    
    /**
     * Setup touch gestures for mobile
     */
    _setupTouchGestures() {
      if (!this.container || !this._isMobile) return;
      
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      const SWIPE_THRESHOLD = 50;
      const TAP_THRESHOLD = 200;
      
      this.container.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }, { passive: true });
      
      this.container.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Swipe left/right for seek
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD / 2) {
          e.preventDefault();
          const seekTime = (deltaX / this.container.offsetWidth) * this.video.duration * 0.1;
          this.seekRelative(seekTime);
          return;
        }
        
        // Swipe up/down for volume
        if (Math.abs(deltaY) > SWIPE_THRESHOLD && Math.abs(deltaX) < SWIPE_THRESHOLD / 2) {
          e.preventDefault();
          const volumeChange = (deltaY / this.container.offsetHeight) * -0.2;
          this.adjustVolume(volumeChange);
          return;
        }
        
        // Tap to toggle play/pause
        if (touchDuration < TAP_THRESHOLD && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          e.preventDefault();
          this.togglePlay();
          this._showControls();
        }
      }, { passive: false });
      
      // Double tap for fullscreen
      let lastTap = 0;
      this.container.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
          e.preventDefault();
          this.toggleFullscreen();
        }
        lastTap = now;
      });
      
      console.log('✅ Touch gestures enabled');
    }
    
    // =====================================================
    // CONTROL INTERACTIONS
    // =====================================================
    
    /**
     * Setup control button interactions
     */
    _setupControlInteractions() {
      if (!this._controlsCache) return;
      
      const c = this._controlsCache;
      
      // Play/Pause button
      c.playPauseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
      
      // Progress bar seeking
      c.progressBar?.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        const time = (percent / 100) * (this.video?.duration || 0);
        this.seek(time);
      });
      
      c.progressBar?.addEventListener('change', (e) => {
        // Emit seek event on release
        this.stats.seekCount++;
        this._emit('playback:seek', {
          from: this.video?.currentTime,
          to: parseFloat(e.target.value) / 100 * (this.video?.duration || 0)
        });
      });
      
      // Volume controls (desktop)
      if (c.volumeBtn && c.volumeBar) {
        c.volumeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleMute();
        });
        
        c.volumeBar.addEventListener('input', (e) => {
          const volume = parseFloat(e.target.value) / 100;
          this.setVolume(volume);
        });
      }
      
      // Collection navigation (Phase 1D)
      if (this.config.enableCollectionNav) {
        c.prevTrackBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playPrevious();
        });
        
        c.nextTrackBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playNext();
        });
      }
      
      // Fullscreen toggle
      c.fullscreenBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });
      
      // Picture-in-Picture
      c.pipBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.togglePictureInPicture();
      });
      
      // Social buttons
      this._setupSocialInteractions();
      
      // Play overlay
      c.playOverlay?.querySelector('.play-overlay-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.play().catch(() => {});
      });
      
      // Error overlay buttons
      const errorOverlay = c.errorOverlay;
      errorOverlay?.querySelector('.retry-btn')?.addEventListener('click', () => {
        this.retryAttempts = 0;
        this.video?.load();
        this.play().catch(() => {});
        this._hideErrorOverlay();
      });
      
      errorOverlay?.querySelector('.dismiss-btn')?.addEventListener('click', () => {
        this._hideErrorOverlay();
      });
      
      // Controls hover/visibility
      this._setupControlsVisibility();
      
      console.log('✅ Control interactions setup');
    }
    
    /**
     * Setup social button interactions
     */
    _setupSocialInteractions() {
      if (!this._controlsCache?.socialPanel || !this.contentId) return;
      
      const { socialPanel } = this._controlsCache;
      
      // Like button
      const likeBtn = socialPanel.querySelector('.like-btn');
      likeBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._toggleLike();
      });
      
      // Favorite button
      const favBtn = socialPanel.querySelector('.favorite-btn');
      favBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._toggleFavorite();
      });
      
      // Share button
      const shareBtn = socialPanel.querySelector('.share-btn');
      shareBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._shareContent();
      });
    }
    
    /**
     * Setup controls visibility (auto-hide)
     */
    _setupControlsVisibility() {
      if (!this.container || !this.controls) return;
      
      const showControls = () => {
        this._showControls();
        this._scheduleControlsHide();
      };
      
      // Show on mouse enter/move
      this.container.addEventListener('mouseenter', showControls);
      this.container.addEventListener('mousemove', showControls);
      
      // Show on touch start (mobile)
      this.container.addEventListener('touchstart', () => {
        this._showControls();
        // Don't auto-hide immediately on mobile
        if (this.controlsHideTimeout) {
          clearTimeout(this.controlsHideTimeout);
        }
      }, { passive: true });
      
      // Show when paused
      this.video?.addEventListener('pause', () => {
        this._showControls();
      });
      
      // Initial show
      this._showControls();
    }
    
    /**
     * Schedule controls to auto-hide
     */
    _scheduleControlsHide() {
      if (this.controlsHideTimeout) {
        clearTimeout(this.controlsHideTimeout);
      }
      
      // Don't auto-hide on mobile or when paused
      if (this._isMobile || this.video?.paused) return;
      
      this.controlsHideTimeout = setTimeout(() => {
        if (this.isPlaying && !this._isMobile) {
          this._hideControls();
        }
      }, this.config.hideControlsDelay);
    }
    
    /**
     * Show controls
     */
    _showControls() {
      if (this.controls) {
        this.controls.style.opacity = '1';
        this.controls.style.pointerEvents = 'auto';
      }
    }
    
    /**
     * Hide controls
     */
    _hideControls() {
      if (this.controls && this.isPlaying && !this._isMobile) {
        this.controls.style.opacity = '0';
        this.controls.style.pointerEvents = 'none';
      }
    }
    
    // =====================================================
    // UI UPDATES
    // =====================================================
    
    /**
     * Update play/pause button icon
     */
    _updatePlayButton(isPlaying) {
      const btn = this._controlsCache?.playPauseBtn;
      if (!btn) return;
      
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
      }
      btn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
      btn.setAttribute('aria-label', isPlaying ? 'Pause video' : 'Play video');
    }
    
    /**
     * Update time display
     */
    _updateTimeDisplay() {
      if (!this._controlsCache?.currentTime || !this.video) return;
      
      const current = this._formatTime(this.video.currentTime);
      this._controlsCache.currentTime.textContent = current;
    }
    
    /**
     * Update duration display
     */
    _updateDurationDisplay() {
      if (!this._controlsCache?.duration || !this.video) return;
      
      const duration = this.video.duration;
      if (duration && isFinite(duration)) {
        this._controlsCache.duration.textContent = this._formatTime(duration);
      }
    }
    
    /**
     * Update progress bar
     */
    _updateProgressBar() {
      if (!this._controlsCache?.progressBar || !this.video) return;
      
      const { currentTime, duration } = this.video;
      if (duration && isFinite(duration)) {
        const percent = (currentTime / duration) * 100;
        this._controlsCache.progressBar.value = percent;
        this._controlsCache.progressBar.setAttribute('aria-valuenow', Math.round(percent));
      }
    }
    
    /**
     * Update buffered progress indicator
     */
    _updateBufferedProgress() {
      if (!this._controlsCache?.progressBuffer || !this.video) return;
      
      const { buffered, duration } = this.video;
      if (duration && isFinite(duration) && buffered?.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const percent = (end / duration) * 100;
        this._controlsCache.progressBuffer.style.width = `${percent}%`;
      }
    }
    
    /**
     * Update volume button icon
     */
    _updateVolumeUI() {
      if (!this._controlsCache?.volumeBtn || !this.video) return;
      
      const { muted, volume } = this.video;
      const icon = this._controlsCache.volumeBtn.querySelector('i');
      
      if (muted || volume === 0) {
        icon?.classList.replace('fa-volume-up', 'fa-volume-mute');
        icon?.classList.replace('fa-volume-down', 'fa-volume-mute');
        icon?.className = 'fas fa-volume-mute';
      } else if (volume < 0.5) {
        icon?.className = 'fas fa-volume-down';
      } else {
        icon?.className = 'fas fa-volume-up';
      }
      
      // Update volume bar if exists
      if (this._controlsCache?.volumeBar) {
        this._controlsCache.volumeBar.value = muted ? 0 : volume * 100;
      }
    }
    
    /**
     * Show buffering indicator
     */
    _showBufferingIndicator() {
      const indicator = this._controlsCache?.bufferingIndicator;
      if (indicator) {
        indicator.classList.remove('hidden');
      }
    }
    
    /**
     * Hide buffering indicator
     */
    _hideBufferingIndicator() {
      const indicator = this._controlsCache?.bufferingIndicator;
      if (indicator) {
        indicator.classList.add('hidden');
      }
    }
    
    /**
     * Show play overlay (for autoplay blocked)
     */
    _showPlayOverlay() {
      const overlay = this._controlsCache?.playOverlay;
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    }
    
    /**
     * Hide play overlay
     */
    _hidePlayOverlay() {
      const overlay = this._controlsCache?.playOverlay;
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
    
    /**
     * Show error overlay
     */
    _showErrorOverlay(message) {
      const overlay = this._controlsCache?.errorOverlay;
      if (overlay) {
        const msgEl = overlay.querySelector('.error-message');
        if (msgEl && message) {
          msgEl.textContent = message;
        }
        overlay.classList.remove('hidden');
      }
    }
    
    /**
     * Hide error overlay
     */
    _hideErrorOverlay() {
      const overlay = this._controlsCache?.errorOverlay;
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
    
    // =====================================================
    // SOURCE MANAGEMENT
    // =====================================================
    
    /**
     * Restore preserved source and load media
     */
    _restoreAndLoadSource() {
      if (!this._sourcePreserved?.url || !this.video) return;
      
      const { url, type } = this._sourcePreserved;
      
      console.log('🔄 Restoring media source:', { url, type });
      
      // Clear existing sources
      while (this.video.firstChild) {
        this.video.removeChild(this.video.firstChild);
      }
      this.video.removeAttribute('src');
      
      // Create new source element
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      this.video.appendChild(source);
      
      // Setup error handling for initial load
      const errorHandler = (e) => {
        // Ignore autoplay blocking
        if (!this.video?.error && this.video?.networkState !== 3) return;
        console.error('❌ Source load error:', this.video?.error);
        this._handleError(e);
      };
      
      this.video.addEventListener('error', errorHandler, { once: true });
      
      // Setup metadata handler
      const metadataHandler = () => {
        console.log('✅ Source loaded successfully');
        this.video.removeEventListener('loadedmetadata', metadataHandler);
      };
      this.video.addEventListener('loadedmetadata', metadataHandler, { once: true });
      
      // Load the media
      this.video.load();
      
      // Attempt autoplay if configured
      if (this.config.autoplay) {
        this.play().catch((error) => {
          if (error.name === 'NotAllowedError') {
            console.log('ℹ️ Autoplay blocked by browser policy');
            this._showPlayOverlay();
            this._emit('autoplay:blocked', { error });
          }
        });
      }
    }
    
    /**
     * Change media source dynamically
     */
    setSource(url, options = {}) {
      if (!this.video || this._isDestroyed) return Promise.reject('Player destroyed');
      
      const {
        type = this.getMediaMimeType(url),
        contentId = null,
        contentMetadata = null,
        collectionContext = null
      } = options;
      
      // Update metadata
      if (contentId) this.contentId = contentId;
      if (contentMetadata) this.contentMetadata = contentMetadata;
      if (collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...collectionContext };
      }
      
      // Update audio mode
      if (this.isAudioSource(url)) {
        this.video.classList.add('audio-mode');
      } else {
        this.video.classList.remove('audio-mode');
      }
      
      // Set new source
      this.video.pause();
      this.video.currentTime = 0;
      
      while (this.video.firstChild) {
        this.video.removeChild(this.video.firstChild);
      }
      
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      this.video.appendChild(source);
      
      // Reset state
      this.retryAttempts = 0;
      this.errorState = null;
      this.viewRecorded = false;
      this.viewValidated = false;
      
      // Load and optionally play
      this.video.load();
      
      // Update preserved source
      this._sourcePreserved = { url, type, method: 'setSource' };
      
      console.log('✅ Source changed:', { url, contentId });
      this._emit('source:changed', { url, contentId, type });
      
      return Promise.resolve();
    }
    
    // =====================================================
    // PLAYBACK CONTROLS
    // =====================================================
    
    /**
     * Play media with autoplay handling
     */
    async play() {
      if (!this.video || this._isDestroyed) {
        return Promise.reject('Player destroyed');
      }
      
      try {
        await this.video.play();
        return true;
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          console.log('ℹ️ Playback blocked by autoplay policy');
          this._showPlayOverlay();
          this._emit('autoplay:blocked', { error });
          return false;
        }
        console.error('❌ Play error:', error);
        throw error;
      }
    }
    
    /**
     * Pause media
     */
    pause() {
      if (this.video && !this._isDestroyed) {
        this.video.pause();
      }
    }
    
    /**
     * Toggle play/pause
     */
    togglePlay() {
      if (!this.video || this._isDestroyed) return;
      
      if (this.video.paused) {
        this.play().catch(() => {});
      } else {
        this.pause();
      }
    }
    
    /**
     * Seek to specific time
     */
    seek(time) {
      if (!this.video || this._isDestroyed) return;
      if (isNaN(time) || !isFinite(time)) return;
      
      const duration = this.video.duration || 0;
      const clamped = Math.max(0, Math.min(time, duration));
      
      this.video.currentTime = clamped;
      this._emit('playback:seeked', { time: clamped, duration });
    }
    
    /**
     * Seek relative to current time
     */
    seekRelative(seconds) {
      if (!this.video || this._isDestroyed) return;
      this.seek(this.video.currentTime + seconds);
    }
    
    /**
     * Seek to percentage of duration
     */
    seekPercent(percent) {
      if (!this.video || this._isDestroyed) return;
      const time = (percent / 100) * (this.video.duration || 0);
      this.seek(time);
    }
    
    /**
     * Set playback rate
     */
    setPlaybackRate(rate) {
      if (!this.video || this._isDestroyed) return;
      
      const clamped = Math.max(0.25, Math.min(4, rate));
      this.video.playbackRate = clamped;
      this.playbackRate = clamped;
      
      console.log(`⚡ Playback rate: ${clamped}x`);
      this._emit('playback:ratechange', { rate: clamped });
    }
    
    /**
     * Set volume
     */
    setVolume(volume) {
      if (!this.video || this._isDestroyed) return;
      
      const clamped = Math.max(0, Math.min(1, volume));
      this.video.volume = clamped;
      this.video.muted = clamped === 0;
      
      this.stats.volumeChanges++;
      this._updateVolumeUI();
      
      console.log(`🔊 Volume: ${Math.round(clamped * 100)}%`);
      this._emit('playback:volumechange', { volume: clamped, muted: this.video.muted });
    }
    
    /**
     * Adjust volume relative to current
     */
    adjustVolume(delta) {
      if (!this.video || this._isDestroyed) return;
      this.setVolume(this.video.volume + delta);
    }
    
    /**
     * Toggle mute
     */
    toggleMute() {
      if (!this.video || this._isDestroyed) return;
      
      this.video.muted = !this.video.muted;
      this._updateVolumeUI();
      
      console.log(`🔇 Mute: ${this.video.muted}`);
      this._emit('playback:mute', { muted: this.video.muted });
    }
    
    // =====================================================
    // FULLSCREEN & PIP
    // =====================================================
    
    /**
     * Toggle fullscreen using container
     */
    toggleFullscreen() {
      const target = this.container || this.video;
      if (!target) return;
      
      if (!this.isFullscreen) {
        // Enter fullscreen
        if (target.requestFullscreen) {
          target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen();
        } else if (target.mozRequestFullScreen) {
          target.mozRequestFullScreen();
        } else if (target.msRequestFullscreen) {
          target.msRequestFullscreen();
        }
        this.isFullscreen = true;
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
        this.isFullscreen = false;
      }
      
      // Update button icon
      this._updateFullscreenButton();
      
      console.log(`🖥️ Fullscreen: ${this.isFullscreen}`);
      this._emit('player:fullscreen', { isFullscreen: this.isFullscreen });
    }
    
    /**
     * Handle fullscreen change events
     */
    _handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      if (isCurrentlyFullscreen !== this.isFullscreen) {
        this.isFullscreen = isCurrentlyFullscreen;
        this._updateFullscreenButton();
        this._emit('player:fullscreen', { isFullscreen: this.isFullscreen });
      }
    }
    
    /**
     * Update fullscreen button icon
     */
    _updateFullscreenButton() {
      const btn = this._controlsCache?.fullscreenBtn?.querySelector('i');
      if (btn) {
        btn.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
      }
    }
    
    /**
     * Toggle Picture-in-Picture
     */
    async togglePictureInPicture() {
      if (!this.video || !document.pictureInPictureEnabled) return;
      
      try {
        if (this.isPiP) {
          await document.exitPictureInPicture();
          this.isPiP = false;
        } else {
          await this.video.requestPictureInPicture();
          this.isPiP = true;
        }
        console.log(`🪟 PiP: ${this.isPiP}`);
        this._emit('player:pip', { isPiP: this.isPiP });
      } catch (error) {
        console.error('❌ PiP error:', error);
        this._emit('player:pip-error', { error });
      }
    }
    
    // =====================================================
    // PHASE 3: TELEMETRY INTEGRATION
    // =====================================================
    
    /**
     * Initialize telemetry session (Phase 3)
     */
    _initializeTelemetrySession() {
      if (!this.config.enableTelemetry || !this.supabase || !this.contentId) return;
      
      // Get or create playback session ID
      if (!this.playbackSessionId) {
        this.playbackSessionId = sessionStorage.getItem('bantu_playback_session');
        if (!this.playbackSessionId) {
          this.playbackSessionId = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('bantu_playback_session', this.playbackSessionId);
        }
      }
      
      // Initialize WatchSessionManager if available
      if (typeof WatchSessionManager === 'function' && !this.watchSession) {
        try {
          this.watchSession = new WatchSessionManager({
            supabase: this.supabase,
            contentId: this.contentId,
            userId: this.userId,
            sessionId: this.playbackSessionId,
            heartbeatInterval: this.config.heartbeatInterval,
            validViewThreshold: this.config.validViewThreshold,
            // Collection context (Phase 1D)
            collectionId: this.collectionContext.collectionId,
            playlistId: this.collectionContext.playlistId,
            sortIndex: this.collectionContext.currentSortIndex,
            episodeNumber: this.collectionContext.episodeNumber,
            // Callbacks
            onViewValidated: (data) => {
              this.viewValidated = true;
              console.log('✅ View validated via telemetry');
              this._emit('telemetry:view-validated', data);
            },
            onCompletion: (data) => {
              console.log('✅ Content completed via telemetry');
              this._emit('telemetry:completed', data);
            }
          });
          
          console.log('🎬 WatchSession initialized for telemetry');
          
        } catch (error) {
          console.warn('⚠️ Failed to initialize WatchSession:', error);
        }
      }
    }
    
    /**
     * Record view after threshold (Phase 3)
     */
    async _recordView() {
      if (this.viewRecorded || !this.supabase || !this.contentId) return;
      
      this.viewRecorded = true;
      console.log('👁️ View threshold reached, recording...');
      
      try {
        // Use RPC for atomic increment (Phase 3)
        const { error } = await this.supabase
          .rpc('increment_content_views', {
            content_id_input: parseInt(this.contentId)
          });
        
        if (error) {
          console.warn('⚠️ View RPC failed:', error.message);
          // Fallback: direct insert
          await this._recordViewFallback();
        } else {
          console.log('✅ View recorded via RPC');
          this.engagement.views++;
          this._updateSocialCounts();
        }
        
        // Update state manager if available
        if (window.stateManager) {
          window.stateManager.markContentAsViewed(this.contentId, true);
        }
        
        this._emit('telemetry:view-recorded', {
          contentId: this.contentId,
          sessionId: this.playbackSessionId,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('❌ View recording failed:', error);
      }
    }
    
    /**
     * Fallback view recording method
     */
    async _recordViewFallback() {
      if (!this.supabase || !this.contentId) return;
      
      const { error } = await this.supabase
        .from('content_views')
        .insert({
          content_id: parseInt(this.contentId),
          viewer_id: this.userId,
          session_id: this.playbackSessionId,
          watched_seconds: Math.floor(this.video?.currentTime || 0),
          device_type: this._isMobile ? 'mobile' : 'desktop',
          created_at: new Date().toISOString()
        });
      
      if (error && error.code !== '23505') {
        console.warn('⚠️ Fallback view insert failed:', error.message);
      }
    }
    
    // =====================================================
    // PHASE 1D: COLLECTION/QUEUE NAVIGATION
    // =====================================================
    
    /**
     * Auto-advance to next item in collection/queue
     */
    _autoAdvance() {
      if (!this.config.enableCollectionNav) return;
      
      console.log('🎬 Auto-advancing to next item...');
      
      // Priority 1: QueueManager integration
      if (this.config.enableQueueIntegration && window.QueueManager?.playNext) {
        window.QueueManager.playNext();
        return;
      }
      
      // Priority 2: Collection engine navigation
      if (window.ContentCollectionsEngine?.getNextItem) {
        const nextItem = window.ContentCollectionsEngine.getNextItem(this.contentId);
        if (nextItem) {
          window.location.href = `content-detail.html?id=${nextItem.id}`;
          return;
        }
      }
      
      // Fallback: Emit event for external handler
      this._emit('collection:auto-advance', {
        currentContentId: this.contentId,
        collectionId: this.collectionContext.collectionId
      });
    }
    
    /**
     * Play previous item
     */
    playPrevious() {
      console.log('⏮️ Playing previous item...');
      
      if (window.QueueManager?.playPrevious) {
        window.QueueManager.playPrevious();
        return;
      }
      
      if (window.ContentCollectionsEngine?.getPreviousItem) {
        const prevItem = window.ContentCollectionsEngine.getPreviousItem(this.contentId);
        if (prevItem) {
          window.location.href = `content-detail.html?id=${prevItem.id}`;
        }
      }
      
      this._emit('collection:previous-requested', {
        currentContentId: this.contentId
      });
    }
    
    /**
     * Play next item
     */
    playNext() {
      console.log('⏭️ Playing next item...');
      
      if (window.QueueManager?.playNext) {
        window.QueueManager.playNext();
        return;
      }
      
      if (window.ContentCollectionsEngine?.getNextItem) {
        const nextItem = window.ContentCollectionsEngine.getNextItem(this.contentId);
        if (nextItem) {
          window.location.href = `content-detail.html?id=${nextItem.id}`;
        }
      }
      
      this._emit('collection:next-requested', {
        currentContentId: this.contentId
      });
    }
    
    // =====================================================
    // SOCIAL FEATURES
    // =====================================================
    
    /**
     * Toggle like with RPC (Phase 3)
     */
    async _toggleLike() {
      if (!this.supabase || !this.contentId || !this.userId) {
        console.warn('⚠️ Cannot toggle like: missing auth or content');
        return;
      }
      
      const willLike = !this.engagement.isLiked;
      
      // Optimistic UI update
      this.engagement.isLiked = willLike;
      this.engagement.likes += willLike ? 1 : -1;
      this._updateSocialCounts();
      
      try {
        // Ledger write (content_likes)
        if (willLike) {
          await this.supabase
            .from('content_likes')
            .upsert({
              user_id: this.userId,
              content_id: parseInt(this.contentId)
            }, { onConflict: 'user_id,content_id' });
        } else {
          await this.supabase
            .from('content_likes')
            .delete()
            .eq('user_id', this.userId)
            .eq('content_id', parseInt(this.contentId));
        }
        
        // Atomic counter update via RPC
        await this.supabase.rpc('increment_engagement_stats_likes', {
          target_content_id: parseInt(this.contentId),
          increment_value: willLike ? 1 : -1
        });
        
        console.log(`❤️ Like ${willLike ? 'added' : 'removed'}`);
        this._emit('social:like-toggled', { liked: willLike, count: this.engagement.likes });
        
      } catch (error) {
        console.error('❌ Like toggle failed:', error);
        // Revert optimistic update
        this.engagement.isLiked = !willLike;
        this.engagement.likes += willLike ? -1 : 1;
        this._updateSocialCounts();
      }
    }
    
    /**
     * Toggle favorite
     */
    async _toggleFavorite() {
      if (!this.supabase || !this.contentId || !this.userId) return;
      
      const willFav = !this.engagement.isFavorited;
      
      // Optimistic update
      this.engagement.isFavorited = willFav;
      this.engagement.favorites += willFav ? 1 : -1;
      this._updateSocialCounts();
      
      try {
        if (willFav) {
          await this.supabase
            .from('user_favorites')
            .upsert({
              user_id: this.userId,
              content_id: parseInt(this.contentId),
              created_at: new Date().toISOString()
            }, { onConflict: 'user_id,content_id' });
        } else {
          await this.supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', this.userId)
            .eq('content_id', parseInt(this.contentId));
        }
        
        console.log(`⭐ Favorite ${willFav ? 'added' : 'removed'}`);
        this._emit('social:favorite-toggled', { favorited: willFav, count: this.engagement.favorites });
        
      } catch (error) {
        console.error('❌ Favorite toggle failed:', error);
        this.engagement.isFavorited = !willFav;
        this.engagement.favorites += willFav ? -1 : 1;
        this._updateSocialCounts();
      }
    }
    
    /**
     * Share content
     */
    _shareContent() {
      const shareData = {
        title: this.contentMetadata?.title || 'Check this out',
        text: this.contentMetadata?.description || '',
        url: window.location.href
      };
      
      // Try Web Share API first
      if (navigator.share) {
        navigator.share(shareData)
          .then(() => {
            this.engagement.shares++;
            this._updateSocialCounts();
            this._emit('social:shared', { method: 'web-share' });
          })
          .catch(() => {
            // Fallback to clipboard
            this._shareFallback(shareData);
          });
      } else {
        this._shareFallback(shareData);
      }
    }
    
    /**
     * Fallback share method
     */
    _shareFallback(data) {
      // Copy URL to clipboard
      navigator.clipboard?.writeText(data.url).then(() => {
        this.engagement.shares++;
        this._updateSocialCounts();
        
        // Show toast notification
        if (window.state?.showToast) {
          window.state.showToast('Link copied to clipboard!', { type: 'success' });
        }
        
        this._emit('social:shared', { method: 'clipboard' });
      });
    }
    
    /**
     * Update social count displays
     */
    _updateSocialCounts() {
      if (!this._controlsCache?.socialPanel) return;
      
      const panel = this._controlsCache.socialPanel;
      
      // Update like count
      const likeCount = panel.querySelector('.like-btn .social-count');
      if (likeCount) {
        likeCount.textContent = this._formatCount(this.engagement.likes);
      }
      
      // Update favorite count
      const favCount = panel.querySelector('.favorite-btn .social-count');
      if (favCount) {
        favCount.textContent = this._formatCount(this.engagement.favorites);
      }
      
      // Update share count
      const shareCount = panel.querySelector('.share-btn .social-count');
      if (shareCount) {
        shareCount.textContent = this._formatCount(this.engagement.shares);
      }
      
      // Update button states
      const likeBtn = panel.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.classList.toggle('active', this.engagement.isLiked);
        likeBtn.setAttribute('aria-pressed', this.engagement.isLiked);
        likeBtn.setAttribute('aria-label', this.engagement.isLiked ? 'Unlike' : 'Like');
      }
      
      const favBtn = panel.querySelector('.favorite-btn');
      if (favBtn) {
        favBtn.classList.toggle('active', this.engagement.isFavorited);
        favBtn.setAttribute('aria-pressed', this.engagement.isFavorited);
        favBtn.setAttribute('aria-label', this.engagement.isFavorited ? 'Remove from favorites' : 'Add to favorites');
      }
    }
    
    // =====================================================
    // QUALITY & ADAPTIVE STREAMING
    // =====================================================
    
    /**
     * Set playback quality
     */
    setQuality(quality) {
      if (quality === this.currentQuality) return;
      
      console.log(`🎬 Quality: ${quality}`);
      this.currentQuality = quality;
      this.stats.qualityChanges++;
      
      // For HLS/DASH, this would trigger adaptive bitrate switch
      // For static files, this would load different source URL
      this._emit('playback:quality-change', {
        from: this.currentQuality,
        to: quality
      });
      
      // Update StateManager if available
      if (window.stateManager) {
        window.stateManager.setPreference('quality', quality);
      }
    }
    
    // =====================================================
    // EVENT SYSTEM
    // =====================================================
    
    /**
     * Subscribe to player events
     */
    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event).push(callback);
      
      // Return unsubscribe function
      return () => {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
          const idx = callbacks.indexOf(callback);
          if (idx > -1) callbacks.splice(idx, 1);
        }
      };
    }
    
    /**
     * Unsubscribe from event
     */
    off(event, callback) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks && callback) {
        const idx = callbacks.indexOf(callback);
        if (idx > -1) callbacks.splice(idx, 1);
      }
    }
    
    /**
     * Emit event to listeners
     */
    _emit(event, data) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(data);
          } catch (error) {
            console.error(`❌ Error in ${event} listener:`, error);
          }
        });
      }
      
      // Also emit to global event system
      if (window.dispatchEvent) {
        try {
          window.dispatchEvent(new CustomEvent(`player:${event}`, {
            detail: { ...data, player: this }
          }));
        } catch (e) {
          // Ignore
        }
      }
    }
    
    // =====================================================
    // UTILITIES
    // =====================================================
    
    /**
     * Format time in seconds to MM:SS or H:MM:SS
     */
    _formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';
      
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Format count with K/M suffixes
     */
    _formatCount(num) {
      if (!num) return '0';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }
    
    // =====================================================
    // CLEANUP & DESTROY
    // =====================================================
    
    /**
     * Cleanup attachment without full destroy
     */
    _cleanupAttachment() {
      // Remove event listeners
      if (this._listenersAttached && this.video) {
        const events = [
          'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
          'canplaythrough', 'loadeddata', 'loadedmetadata',
          'timeupdate', 'progress', 'seeking', 'seeked',
          'volumechange', 'ratechange', 'durationchange',
          'click'
        ];
        
        events.forEach(event => {
          this.video.removeEventListener(event, this._handleVideoEvent);
        });
        
        this._listenersAttached = false;
      }
      
      // Clear timeouts
      if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
      if (this.controlsHideTimeout) clearTimeout(this.controlsHideTimeout);
      if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
      
      // Remove controls
      if (this.controls?.parentNode) {
        this.controls.parentNode.removeChild(this.controls);
      }
      
      // Cleanup telemetry
      if (this.watchSession?.isActive) {
        this.watchSession.end();
      }
      
      // Reset flags
      this.isPlaying = false;
      this.isBuffering = false;
      this.viewRecorded = false;
      this.viewValidated = false;
    }
    
    /**
     * Destroy player and cleanup all resources
     */
    destroy() {
      if (this._isDestroyed) {
        console.log('ℹ️ Player already destroyed');
        return;
      }
      
      console.log('🗑️ Destroying EnhancedVideoPlayer...');
      this._isDestroyed = true;
      
      // Preserve source for potential re-initialization
      this._preserveSource();
      
      // Cleanup attachment
      this._cleanupAttachment();
      
      // Pause and reset video
      if (this.video) {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
        
        // Restore native controls as fallback
        this.video.controls = true;
      }
      
      // Clear event listeners map
      this.eventListeners.clear();
      
      // Clear references
      this.video = null;
      this.container = null;
      this.controls = null;
      this.socialPanel = null;
      this.settingsMenu = null;
      this._controlsCache = null;
      this.watchSession = null;
      
      console.log('✅ EnhancedVideoPlayer destroyed');
      this._emit('player:destroyed', { contentId: this.contentId });
    }
    
    // =====================================================
    // GETTERS & STATE
    // =====================================================
    
    /**
     * Get player stats
     */
    getStats() {
      return {
        ...this.stats,
        currentQuality: this.currentQuality,
        playbackRate: this.playbackRate,
        isFullscreen: this.isFullscreen,
        isPiP: this.isPiP,
        viewRecorded: this.viewRecorded,
        viewValidated: this.viewValidated
      };
    }
    
    /**
     * Get current playback state
     */
    getPlaybackState() {
      if (!this.video) return null;
      
      return {
        currentTime: this.video.currentTime,
        duration: this.video.duration,
        paused: this.video.paused,
        volume: this.video.volume,
        muted: this.video.muted,
        playbackRate: this.video.playbackRate,
        buffered: this.video.buffered?.length > 0 ? {
          start: this.video.buffered.start(0),
          end: this.video.buffered.end(this.video.buffered.length - 1)
        } : null
      };
    }
    
    /**
     * Check if player is ready
     */
    isReady() {
      return this._isAttached && !this._isDestroyed && this.video?.readyState >= 2;
    }
  }
  
  // =====================================================
  // GLOBAL EXPORT & INITIALIZATION
  // =====================================================
  
  // Export for global access
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
  window.BantuVideoPlayer = EnhancedVideoPlayer;
  
  // Auto-initialize if video element exists with data attributes
  document.addEventListener('DOMContentLoaded', () => {
    const videoEl = document.getElementById('inlineVideoPlayer');
    const container = videoEl?.closest('.video-container, .inline-player');
    
    if (videoEl && container) {
      // Check for initialization data
      const initData = {
        contentId: videoEl.dataset.contentId,
        autoplay: videoEl.dataset.autoplay === 'true',
        muted: videoEl.dataset.muted === 'true',
        contentMetadata: window.currentContent || null,
        // --- FIXED: Safe collection context extraction to prevent fatal errors ---
        collectionContext: (() => {
          // Only proceed if currentContent exists and is an object
          if (window.currentContent && typeof window.currentContent === 'object') {
            return {
              collectionId: window.currentContent.series_id || window.currentContent.playlist_id || null,
              playlistId: window.currentContent.playlist_id || window.currentContent.series_id || null,
              currentSortIndex: window.currentContent.sort_index ?? null,
              episodeNumber: window.currentContent.episode_number ?? null,
              itemType: window.currentContent.media_type === 'audio' ? 'track' : 'episode'
            };
          }
          // Return empty/default context if window.currentContent is missing or invalid
          return {
            collectionId: null,
            playlistId: null,
            currentSortIndex: null,
            episodeNumber: null,
            itemType: null
          };
        })()
        // --- END FIXED BLOCK ---
      };
      
      // Delay to ensure dependencies load
      setTimeout(() => {
        try {
          const player = new EnhancedVideoPlayer();
          player.attach(videoEl, container, initData);
          
          // Expose for debugging
          window.bantuPlayer = player;
          
        } catch (error) {
          console.error('❌ Failed to auto-initialize player:', error);
        }
      }, 500);
    }
  });
  
  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedVideoPlayer;
  }
  
  console.log('✅ EnhancedVideoPlayer module loaded successfully (Phase 3 + Phase 1D Enhanced)');
  console.log('   Features: Telemetry, Collection Nav, Audio/Video Support, Mobile Optimization');
  
})();
