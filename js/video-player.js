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
// 🔧 CRITICAL FIX (2026-05-19): Removed all optional chaining assignments
// 🔧 CRITICAL FIX (2026-05-19): Safe conditional checks for all player properties
// 🔧 AUDIO RENDERER FIX (2026-05-19): Automatic mute fallback for AUDIO_RENDERER_ERROR
// 🎯 YOUTUBE-STYLE PLAYLIST INTEGRATION (2026-05-21):
// - Player ended event triggers window.playNextPlaylistItem()
// - No playlist logic in player - only fires event for content-detail to handle
// - One-way communication: player -> content-detail (not vice versa)
// 🔧 DESKTOP AUTOPLAY AUDIO FIX (2026-05-22):
// - Enhanced safePlay() with user interaction audio restoration
// - Muted recovery with click/keydown listener to unmute
// - Persistent audio restoration after first user interaction
// 🔧 VERSION: v2.4.0 - Desktop Autoplay Audio Fix + YouTube-style playlist

(function() {
  'use strict';
  
  console.log('🎬 EnhancedVideoPlayer module loading... (v2.4.0 - Desktop Autoplay Audio Fix)');

  /**
   * EnhancedVideoPlayer — Production video/audio player with telemetry,
   * collection awareness, and robust media handling
   * 
   * 🎯 YOUTUBE-STYLE ARCHITECTURE:
   * - Player ONLY handles playback
   * - On 'ended', calls window.playNextPlaylistItem() if available
   * - Content-detail.js owns all playlist navigation logic
   * - Single source of truth: window.currentPlaylistItems/Index
   * 
   * 🔧 DESKTOP AUTOPLAY FIX:
   * - safePlay() attempts unmuted playback first
   * - Falls back to muted with click/keydown listener to restore audio
   * - Audio restored on first user interaction
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
        bufferThreshold: options.bufferThreshold ?? 10,
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
      
      // Audio restoration tracking
      this._audioRestoreListenerAttached = false;
      this._pendingAudioRestore = false;
      
      // Phase 1D: Collection/Queue context
      this.collectionContext = {
        collectionId: null,
        playlistId: null,
        currentSortIndex: null,
        episodeNumber: null,
        itemType: null
      };
      
      // Content metadata
      this.contentId = options.contentId || null;
      this.contentMetadata = options.contentMetadata || null;
      
      // Supabase integration
      this.supabase = options.supabase || window.supabaseClient || window.supabase;
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
      this._audioRendererRecoveryAttempted = false;
      
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
    
    isAudioSource(url) {
      if (!url) return false;
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.wma'];
      return audioExtensions.some(ext => url.toLowerCase().endsWith(ext));
    }
    
    detectMediaType(url, metadata = {}) {
      if (metadata.media_type) return metadata.media_type;
      if (this.isAudioSource(url)) return 'audio';
      return 'video';
    }
    
    // =====================================================
    // ATTACHMENT & INITIALIZATION
    // =====================================================
    
    attach(videoElement, container, options = {}) {
      if (this._isDestroyed) {
        console.warn('⚠️ Cannot attach: player has been destroyed');
        return Promise.reject(new Error('Player destroyed'));
      }
      
      if (!videoElement) {
        throw new Error('Video element is required');
      }
      
      if (this._isAttached && this.video === videoElement) {
        console.log('ℹ️ Player already attached to this element');
        return Promise.resolve(this);
      }
      
      if (this._isAttached) {
        console.log('🔄 Cleaning up previous attachment');
        this._cleanupAttachment();
      }
      
      this.video = videoElement;
      this.container = container || videoElement.parentElement;
      
      if (options.contentId) this.contentId = options.contentId;
      if (options.contentMetadata) this.contentMetadata = options.contentMetadata;
      if (options.collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...options.collectionContext };
      }
      
      this._preserveSource();
      this._configureVideoElement();
      this._applyAudioMode();
      this._createControls();
      this._setupEventListeners();
      this._setupControlInteractions();
      this._initializeIntegrations();
      this._restoreAndLoadSource();
      
      this._isAttached = true;
      
      console.log('✅ EnhancedVideoPlayer attached', {
        contentId: this.contentId,
        mediaType: this.detectMediaType(this._sourcePreserved?.url),
        collectionId: this.collectionContext.collectionId
      });
      
      this._emit('player:attached', {
        contentId: this.contentId,
        container: this.container,
        mediaType: this.detectMediaType(this._sourcePreserved?.url)
      });
      
      return Promise.resolve(this);
    }
    
    _preserveSource() {
      const video = this.video;
      if (!video) return;
      
      const sourceEl = video.querySelector('source');
      if (sourceEl && sourceEl.src) {
        this._sourcePreserved = {
          url: sourceEl.src,
          type: sourceEl.type || this.getMediaMimeType(sourceEl.src),
          method: 'source-element'
        };
        return;
      }
      
      if (video.src && video.src !== window.location.href) {
        this._sourcePreserved = {
          url: video.src,
          type: this.getMediaMimeType(video.src),
          method: 'src-attribute'
        };
        return;
      }
      
      const dataSrc = video.dataset && video.dataset.src ? video.dataset.src : video.getAttribute('data-file-url');
      if (dataSrc) {
        this._sourcePreserved = {
          url: dataSrc,
          type: (video.dataset && video.dataset.type) ? video.dataset.type : this.getMediaMimeType(dataSrc),
          method: 'data-attribute'
        };
      }
    }
    
    _configureVideoElement() {
      const video = this.video;
      if (!video) return;
      
      video.controls = false;
      video.removeAttribute('controls');
      
      video.autoplay = this.config.autoplay;
      video.loop = this.config.loop;
      video.preload = this.config.preload;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      video.muted = this.config.muted;
      video.defaultMuted = this.config.muted;
      video.volume = 1.0;
      video.defaultVolume = 1.0;
      
      video.classList.add('enhanced-video-player');
    }
    
    _applyAudioMode() {
      const url = this._sourcePreserved ? this._sourcePreserved.url : null;
      const isAudio = this.isAudioSource(url);
      
      if (this.video) {
        if (isAudio) {
          this.video.classList.add('audio-mode');
          this.video.setAttribute('aria-label', 'Audio player');
          console.log('🎵 Audio mode applied');
        } else {
          this.video.classList.remove('audio-mode');
          this.video.setAttribute('aria-label', 'Video player');
        }
      }
      
      if (this.container) {
        this.container.classList.toggle('audio-player', isAudio);
        this.container.classList.toggle('video-player', !isAudio);
      }
    }
    
    _createControls() {
      if (!this.container) return;
      
      const existingControls = this.container.querySelector('.enhanced-video-controls');
      if (existingControls) existingControls.remove();
      
      this.controls = document.createElement('div');
      this.controls.className = 'enhanced-video-controls';
      this.controls.setAttribute('role', 'toolbar');
      this.controls.setAttribute('aria-label', 'Video player controls');
      this.controls.innerHTML = this._getControlsHTML();
      
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
      
      this.container.appendChild(this.controls);
      this._cacheControlElements();
      this._setupSettingsMenu();
      
      console.log('✅ Custom controls created');
    }
    
    _getControlsHTML() {
      const isMobile = this._isMobile;
      
      return `
        <div class="controls-bar" role="group" aria-label="Playback controls">
          <button class="control-btn play-pause-btn" 
                  title="Play/Pause (Space)"
                  aria-label="Play or pause video">
            <i class="fas fa-play" aria-hidden="true"></i>
          </button>
          
          <div class="time-display" aria-live="off">
            <span class="current-time">0:00</span>
            <span class="time-separator"> / </span>
            <span class="duration">0:00</span>
          </div>
          
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
          
          <div class="controls-spacer"></div>
          
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
          
          <button class="control-btn settings-btn" 
                  title="Settings"
                  aria-label="Open settings"
                  aria-haspopup="true"
                  aria-expanded="false">
            <i class="fas fa-cog" aria-hidden="true"></i>
          </button>
          
          ${document.pictureInPictureEnabled ? `
          <button class="control-btn pip-btn" 
                  title="Picture in Picture"
                  aria-label="Toggle picture in picture">
            <i class="fas fa-external-link-square-alt" aria-hidden="true"></i>
          </button>
          ` : ''}
          
          <button class="control-btn fullscreen-btn" 
                  title="Fullscreen (F)"
                  aria-label="Toggle fullscreen">
            <i class="fas fa-expand" aria-hidden="true"></i>
          </button>
          
        </div>
        
        <div class="settings-menu" 
             role="menu" 
             aria-hidden="true"
             style="display: none;">
          
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
          
          <div class="settings-section" id="dataSaverSection">
            <h4 class="settings-title">Data Saver</h4>
            <label class="toggle-switch">
              <input type="checkbox" id="dataSaverToggle" aria-label="Enable data saver mode">
              <span class="toggle-slider"></span>
            </label>
            <p class="toggle-description">Reduce data usage by streaming at lower quality</p>
          </div>
          
        </div>
        
        <div class="initial-play-overlay hidden" id="initialPlayOverlay">
          <button class="play-overlay-btn" aria-label="Click to play">
            <i class="fas fa-play-circle fa-3x"></i>
            <span class="play-overlay-text">Tap to Play</span>
          </button>
        </div>
        
        <div class="buffering-indicator hidden">
          <div class="spinner"></div>
          <p>Buffering...</p>
        </div>
        
        <div class="error-overlay hidden">
          <div class="error-content">
            <i class="fas fa-exclamation-triangle fa-2x"></i>
            <h3>Playback Error</h3>
            <p class="error-message">Unable to load media. Please check your connection.</p>
            <button class="retry-btn">Retry</button>
            <button class="dismiss-btn">Dismiss</button>
          </div>
        </div>
        
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
    
    _setupSettingsMenu() {
      if (!this._controlsCache || !this._controlsCache.settingsBtn || !this._controlsCache.settingsMenu) return;
      
      const { settingsBtn, settingsMenu } = this._controlsCache;
      let isOpen = false;
      
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        isOpen = !isOpen;
        settingsMenu.style.display = isOpen ? 'block' : 'none';
        if (settingsBtn) {
          settingsBtn.setAttribute('aria-expanded', isOpen);
        }
        if (settingsMenu) {
          settingsMenu.setAttribute('aria-hidden', !isOpen);
        }
        
        console.log(`⚙️ Settings menu ${isOpen ? 'opened' : 'closed'}`);
        this._emit('settings:toggled', { isOpen });
      });
      
      document.addEventListener('click', (e) => {
        if (isOpen && settingsMenu && settingsBtn && 
            !settingsMenu.contains(e.target) && 
            !settingsBtn.contains(e.target)) {
          isOpen = false;
          settingsMenu.style.display = 'none';
          settingsBtn.setAttribute('aria-expanded', 'false');
          settingsMenu.setAttribute('aria-hidden', 'true');
        }
      });
      
      if (this._controlsCache.qualityOptions) {
        this._controlsCache.qualityOptions.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const quality = e.currentTarget.dataset.quality;
            this.setQuality(quality);
            
            if (this._controlsCache.qualityOptions) {
              this._controlsCache.qualityOptions.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
              });
            }
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-checked', 'true');
            
            isOpen = false;
            if (settingsMenu) settingsMenu.style.display = 'none';
            if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
          });
        });
      }
      
      if (this._controlsCache.speedOptions) {
        this._controlsCache.speedOptions.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rate = parseFloat(e.currentTarget.dataset.rate);
            this.setPlaybackRate(rate);
            
            if (this._controlsCache.speedOptions) {
              this._controlsCache.speedOptions.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
              });
            }
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-checked', 'true');
            
            isOpen = false;
            if (settingsMenu) settingsMenu.style.display = 'none';
            if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
          });
        });
      }
      
      const dataSaverToggle = document.getElementById('dataSaverToggle');
      if (dataSaverToggle) {
        dataSaverToggle.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          console.log(`💾 Data saver: ${enabled ? 'enabled' : 'disabled'}`);
          this._emit('settings:data-saver', { enabled });
          
          if (enabled && this.currentQuality !== '360p') {
            this.setQuality('360p');
          }
        });
      }
    }
    
    _setupEventListeners() {
      if (!this.video || this._listenersAttached) return;
      
      const events = [
        'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
        'canplaythrough', 'loadeddata', 'loadedmetadata',
        'timeupdate', 'progress', 'seeking', 'seeked',
        'volumechange', 'ratechange', 'durationchange',
        'enterpictureinpicture', 'leavepictureinpicture'
      ];
      
      this._handleVideoEvent = this._handleVideoEvent.bind(this);
      
      events.forEach(event => {
        if (this.video) {
          this.video.addEventListener(event, this._handleVideoEvent);
        }
      });
      
      if (this.video) {
        this.video.addEventListener('click', (e) => this._handleVideoClick(e));
      }
      
      document.addEventListener('fullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('webkitfullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('mozfullscreenchange', () => this._handleFullscreenChange());
      document.addEventListener('MSFullscreenChange', () => this._handleFullscreenChange());
      
      if (document.pictureInPictureEnabled && this.video) {
        this.video.addEventListener('enterpictureinpicture', () => {
          this.isPiP = true;
          this._emit('pip:enter', { video: this.video });
        });
        this.video.addEventListener('leavepictureinpicture', () => {
          this.isPiP = false;
          this._emit('pip:leave', { video: this.video });
        });
      }
      
      if (this.config.enableKeyboardShortcuts) {
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
      }
      
      if (this.config.enableTouchGestures && this._isMobile) {
        this._setupTouchGestures();
      }
      
      this._listenersAttached = true;
      console.log('✅ Event listeners attached');
    }
    
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
      
      this._emit(`video:${event.type}`, {
        event: event.type,
        currentTime: this.video.currentTime,
        duration: this.video.duration
      });
    }
    
    _handlePlay() {
      this.isPlaying = true;
      this.playbackStartTime = Date.now();
      this.stats.playCount++;
      
      this._updatePlayButton(true);
      this._hidePlayOverlay();
      this._scheduleControlsHide();
      
      this._initializeTelemetrySession();
      
      console.log('▶️ Playing');
      this._emit('playback:play', {
        timestamp: this.playbackStartTime,
        currentTime: this.video ? this.video.currentTime : 0
      });
    }
    
    _handlePause() {
      this.isPlaying = false;
      
      if (this.playbackStartTime) {
        const watchTime = Date.now() - this.playbackStartTime;
        this.stats.totalWatchTime += watchTime;
        this.playbackStartTime = null;
        
        this._emit('playback:pause', {
          watchTime,
          currentTime: this.video ? this.video.currentTime : 0
        });
      }
      
      this._updatePlayButton(false);
      this._showControls();
      
      console.log('⏸️ Paused');
      this._emit('playback:pause', {
        currentTime: this.video ? this.video.currentTime : 0
      });
    }
    
    // =====================================================
    // 🎯 YOUTUBE-STYLE ENDED HANDLER (CRITICAL)
    // =====================================================
    _handleEnded() {
      this.isPlaying = false;
      this._updatePlayButton(false);
      
      console.log('🏁 Media track completed. Checking for playlist progression...');
      
      // 🎯 YOUTUBE-STYLE ARCHITECTURE:
      // Player ONLY calls the global function if it exists
      // Content-detail.js owns the playlist logic
      if (typeof window.playNextPlaylistItem === 'function') {
        console.log('🎬 Invoking window.playNextPlaylistItem() for auto-advance');
        window.playNextPlaylistItem();
      } else if (window.ContentCollectionsEngine && typeof window.ContentCollectionsEngine.getNextItem === 'function') {
        // Fallback for legacy collection engine
        console.log('🎬 Using ContentCollectionsEngine for auto-advance');
        const nextItem = window.ContentCollectionsEngine.getNextItem(this.contentId);
        if (nextItem) {
          window.location.href = `content-detail.html?id=${nextItem.id}`;
        }
      } else if (this.config.enableCollectionNav && this.config.autoplay) {
        console.log('⚠️ No playlist controller found, using local auto-advance');
        this._autoAdvance();
      } else {
        console.log('🎵 No playlist controller bound to window');
      }
      
      this._emit('playback:ended', {
        totalWatchTime: this.stats.totalWatchTime,
        duration: this.video ? this.video.duration : 0
      });
    }
    
    _handleTimeUpdate() {
      this._updateTimeDisplay();
      this._updateProgressBar();
      
      if (!this.viewRecorded && this.video && 
          this.video.currentTime >= this.config.validViewThreshold) {
        this._recordView();
      }
      
      if (this.video && this.video.currentTime % 10 < 0.1) {
        this._emit('playback:progress', {
          currentTime: this.video.currentTime,
          duration: this.video.duration,
          percent: (this.video.currentTime / (this.video.duration || 1)) * 100
        });
      }
    }
    
    _handleProgress() {
      this._updateBufferedProgress();
    }
    
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
    
    _handleBufferingEnd() {
      this.isBuffering = false;
      if (this.bufferingTimeout) {
        clearTimeout(this.bufferingTimeout);
      }
      this._hideBufferingIndicator();
      
      this._emit('buffering:end');
    }
    
    _handleLoadedData() {
      console.log('✅ Media data loaded');
      this._emit('media:loadeddata', {
        video: this.video,
        duration: this.video ? this.video.duration : 0
      });
    }
    
    _handleLoadedMetadata() {
      console.log('✅ Media metadata loaded', {
        duration: this.video ? this.video.duration : 0,
        videoWidth: this.video ? this.video.videoWidth : 0,
        videoHeight: this.video ? this.video.videoHeight : 0,
        audioTracks: (this.video && this.video.audioTracks) ? this.video.audioTracks.length : 0
      });
      
      this._updateDurationDisplay();
      
      if (this.video && this.video.audioTracks && this.video.audioTracks.length > 0) {
        this.video.audioTracks[0].enabled = true;
      }
      
      this._emit('media:loadedmetadata', {
        duration: this.video ? this.video.duration : 0,
        dimensions: {
          width: this.video ? this.video.videoWidth : 0,
          height: this.video ? this.video.videoHeight : 0
        }
      });
    }
    
    _handleAudioRendererError(error) {
      console.warn('🔧 AUDIO_RENDERER_ERROR detected - Audio pipeline failure');
      console.warn('   Error details:', {
        code: error ? error.code : 'unknown',
        message: error ? error.message : 'unknown',
        networkState: this.video ? this.video.networkState : 'unknown'
      });
      
      if (this._audioRendererRecoveryAttempted) {
        console.error('❌ Audio renderer recovery already attempted - giving up');
        this._showErrorOverlay('Audio playback failed. Please check your audio output device and try again.');
        return;
      }
      
      this._audioRendererRecoveryAttempted = true;
      
      console.log('🔧 Attempting audio renderer recovery: Forcing mute and reloading...');
      
      if (this.video) {
        this.video.muted = true;
        this.config.muted = true;
        console.log('🔇 Video element muted for recovery');
      }
      
      this.retryAttempts = 0;
      
      if (this.retryAttempts < this.config.retryCount) {
        this.retryAttempts++;
        setTimeout(() => {
          if (!this._isDestroyed && this.video) {
            console.log(`🔄 Reloading source in muted mode (attempt ${this.retryAttempts}/${this.config.retryCount})`);
            this.video.load();
            
            this.play().catch((playError) => {
              console.warn('⚠️ Play after audio recovery failed:', playError.message);
              this._showErrorOverlay('Unable to play media. Please check your audio output device.');
            });
          }
        }, this.config.retryDelay);
        return;
      }
      
      this._showErrorOverlay(
        'Audio playback error detected. Your browser may not have a working audio output device. ' +
        'Please check your headphones/speakers and try again, or contact support.'
      );
      
      this._emit('media:audio-renderer-error', {
        error: error,
        recoveryAttempted: true,
        suggestion: 'Check audio output device or connect headphones'
      });
    }
    
    _handleError(event) {
      const error = this.video ? this.video.error : null;
      
      if (!error && this.video && this.video.networkState !== 3) {
        console.log('ℹ️ Ignoring non-critical error (likely autoplay block)');
        return;
      }
      
      console.error('❌ Media error:', {
        code: error ? error.code : 'unknown',
        message: error ? error.message : 'unknown',
        networkState: this.video ? this.video.networkState : 'unknown'
      });
      
      const errorMessage = (error && error.message) ? error.message : '';
      const isAudioRendererError = (error && error.code === 3) && 
        (errorMessage.includes('AUDIO_RENDERER_ERROR') || errorMessage.includes('audio renderer'));
      
      if (isAudioRendererError) {
        this._handleAudioRendererError(error);
        return;
      }
      
      this.stats.errorCount++;
      this.errorState = error;
      
      if (this.retryAttempts < this.config.retryCount) {
        this.retryAttempts++;
        console.log(`🔄 Retry attempt ${this.retryAttempts}/${this.config.retryCount}`);
        
        setTimeout(() => {
          if (!this._isDestroyed && this.video) {
            this.video.load();
            this.play().catch(() => {});
          }
        }, this.config.retryDelay * this.retryAttempts);
        
        return;
      }
      
      this._showErrorOverlay('Unable to play media. Please check your connection and try again.');
      
      this._emit('media:error', {
        error: error,
        retryAttempts: this.retryAttempts,
        maxRetries: this.config.retryCount
      });
    }
    
    _handleVideoClick(event) {
      if (event.target.closest('.enhanced-video-controls')) return;
      this.togglePlay();
      this._showControls();
    }
    
    _handleKeyboard(event) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      
      if (this._controlsCache && this._controlsCache.settingsMenu && 
          this._controlsCache.settingsMenu.style.display === 'block') return;
      
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
        
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD / 2) {
          e.preventDefault();
          const seekTime = (deltaX / this.container.offsetWidth) * (this.video ? this.video.duration : 0) * 0.1;
          this.seekRelative(seekTime);
          return;
        }
        
        if (Math.abs(deltaY) > SWIPE_THRESHOLD && Math.abs(deltaX) < SWIPE_THRESHOLD / 2) {
          e.preventDefault();
          const volumeChange = (deltaY / this.container.offsetHeight) * -0.2;
          this.adjustVolume(volumeChange);
          return;
        }
        
        if (touchDuration < TAP_THRESHOLD && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          e.preventDefault();
          this.togglePlay();
          this._showControls();
        }
      }, { passive: false });
      
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
    
    _setupControlInteractions() {
      if (!this._controlsCache) return;
      
      const c = this._controlsCache;
      
      if (c.playPauseBtn) {
        c.playPauseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePlay();
        });
      }
      
      if (c.progressBar) {
        c.progressBar.addEventListener('input', (e) => {
          const percent = parseFloat(e.target.value);
          const time = (percent / 100) * (this.video ? this.video.duration : 0);
          this.seek(time);
        });
        
        c.progressBar.addEventListener('change', (e) => {
          this.stats.seekCount++;
          this._emit('playback:seek', {
            from: this.video ? this.video.currentTime : 0,
            to: parseFloat(e.target.value) / 100 * (this.video ? this.video.duration : 0)
          });
        });
      }
      
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
      
      if (this.config.enableCollectionNav) {
        if (c.prevTrackBtn) {
          c.prevTrackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playPrevious();
          });
        }
        
        if (c.nextTrackBtn) {
          c.nextTrackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playNext();
          });
        }
      }
      
      if (c.fullscreenBtn) {
        c.fullscreenBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFullscreen();
        });
      }
      
      if (c.pipBtn) {
        c.pipBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.togglePictureInPicture();
        });
      }
      
      this._setupSocialInteractions();
      
      if (c.playOverlay) {
        const overlayBtn = c.playOverlay.querySelector('.play-overlay-btn');
        if (overlayBtn) {
          overlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.play().catch(() => {});
          });
        }
      }
      
      const errorOverlay = c.errorOverlay;
      if (errorOverlay) {
        const retryBtn = errorOverlay.querySelector('.retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            this.retryAttempts = 0;
            this._audioRendererRecoveryAttempted = false;
            if (this.video) this.video.load();
            this.play().catch(() => {});
            this._hideErrorOverlay();
          });
        }
        
        const dismissBtn = errorOverlay.querySelector('.dismiss-btn');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            this._hideErrorOverlay();
          });
        }
      }
      
      this._setupControlsVisibility();
      
      console.log('✅ Control interactions setup');
    }
    
    _setupSocialInteractions() {
      if (!this._controlsCache || !this._controlsCache.socialPanel || !this.contentId) return;
      
      const { socialPanel } = this._controlsCache;
      if (!socialPanel) return;
      
      const likeBtn = socialPanel.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this._toggleLike();
        });
      }
      
      const favBtn = socialPanel.querySelector('.favorite-btn');
      if (favBtn) {
        favBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this._toggleFavorite();
        });
      }
      
      const shareBtn = socialPanel.querySelector('.share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._shareContent();
        });
      }
    }
    
    _setupControlsVisibility() {
      if (!this.container || !this.controls) return;
      
      const showControls = () => {
        this._showControls();
        this._scheduleControlsHide();
      };
      
      this.container.addEventListener('mouseenter', showControls);
      this.container.addEventListener('mousemove', showControls);
      
      this.container.addEventListener('touchstart', () => {
        this._showControls();
        if (this.controlsHideTimeout) {
          clearTimeout(this.controlsHideTimeout);
        }
      }, { passive: true });
      
      if (this.video) {
        this.video.addEventListener('pause', () => {
          this._showControls();
        });
      }
      
      this._showControls();
    }
    
    _scheduleControlsHide() {
      if (this.controlsHideTimeout) {
        clearTimeout(this.controlsHideTimeout);
      }
      
      if (this._isMobile || (this.video && this.video.paused)) return;
      
      this.controlsHideTimeout = setTimeout(() => {
        if (this.isPlaying && !this._isMobile) {
          this._hideControls();
        }
      }, this.config.hideControlsDelay);
    }
    
    _showControls() {
      if (this.controls) {
        this.controls.style.opacity = '1';
        this.controls.style.pointerEvents = 'auto';
      }
    }
    
    _hideControls() {
      if (this.controls && this.isPlaying && !this._isMobile) {
        this.controls.style.opacity = '0';
        this.controls.style.pointerEvents = 'none';
      }
    }
    
    _updatePlayButton(isPlaying) {
      const btn = this._controlsCache ? this._controlsCache.playPauseBtn : null;
      if (!btn) return;
      
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
      }
      btn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
      btn.setAttribute('aria-label', isPlaying ? 'Pause video' : 'Play video');
    }
    
    _updateTimeDisplay() {
      if (!this._controlsCache || !this._controlsCache.currentTime || !this.video) return;
      const current = this._formatTime(this.video.currentTime);
      this._controlsCache.currentTime.textContent = current;
    }
    
    _updateDurationDisplay() {
      if (!this._controlsCache || !this._controlsCache.duration || !this.video) return;
      const duration = this.video.duration;
      if (duration && isFinite(duration)) {
        this._controlsCache.duration.textContent = this._formatTime(duration);
      }
    }
    
    _updateProgressBar() {
      if (!this._controlsCache || !this._controlsCache.progressBar || !this.video) return;
      const { currentTime, duration } = this.video;
      if (duration && isFinite(duration)) {
        const percent = (currentTime / duration) * 100;
        this._controlsCache.progressBar.value = percent;
        this._controlsCache.progressBar.setAttribute('aria-valuenow', Math.round(percent));
      }
    }
    
    _updateBufferedProgress() {
      if (!this._controlsCache || !this._controlsCache.progressBuffer || !this.video) return;
      const { buffered, duration } = this.video;
      if (duration && isFinite(duration) && buffered && buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const percent = (end / duration) * 100;
        this._controlsCache.progressBuffer.style.width = `${percent}%`;
      }
    }
    
    _updateVolumeUI() {
      if (!this._controlsCache || !this._controlsCache.volumeBtn || !this.video) return;
      const { muted, volume } = this.video;
      const icon = this._controlsCache.volumeBtn.querySelector('i');
      
      if (icon) {
        if (muted || volume === 0) {
          icon.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
          icon.className = 'fas fa-volume-down';
        } else {
          icon.className = 'fas fa-volume-up';
        }
      }
      
      if (this._controlsCache.volumeBar) {
        this._controlsCache.volumeBar.value = muted ? 0 : volume * 100;
      }
    }
    
    _showBufferingIndicator() {
      const indicator = this._controlsCache ? this._controlsCache.bufferingIndicator : null;
      if (indicator) {
        indicator.classList.remove('hidden');
      }
    }
    
    _hideBufferingIndicator() {
      const indicator = this._controlsCache ? this._controlsCache.bufferingIndicator : null;
      if (indicator) {
        indicator.classList.add('hidden');
      }
    }
    
    _showPlayOverlay() {
      const overlay = this._controlsCache ? this._controlsCache.playOverlay : null;
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    }
    
    _hidePlayOverlay() {
      const overlay = this._controlsCache ? this._controlsCache.playOverlay : null;
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
    
    _showErrorOverlay(message) {
      const overlay = this._controlsCache ? this._controlsCache.errorOverlay : null;
      if (overlay) {
        const msgEl = overlay.querySelector('.error-message');
        if (msgEl && message) {
          msgEl.textContent = message;
        }
        overlay.classList.remove('hidden');
      }
    }
    
    _hideErrorOverlay() {
      const overlay = this._controlsCache ? this._controlsCache.errorOverlay : null;
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
    
    _restoreAndLoadSource() {
      if (!this._sourcePreserved || !this._sourcePreserved.url || !this.video) return;
      
      const { url, type } = this._sourcePreserved;
      
      console.log('🔄 Restoring media source:', { url, type });
      
      while (this.video.firstChild) {
        this.video.removeChild(this.video.firstChild);
      }
      this.video.removeAttribute('src');
      
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      this.video.appendChild(source);
      
      this._audioRendererRecoveryAttempted = false;
      
      const errorHandler = (e) => {
        if (!this.video || (!this.video.error && this.video.networkState !== 3)) return;
        console.error('❌ Source load error:', this.video ? this.video.error : 'unknown');
        this._handleError(e);
      };
      
      this.video.addEventListener('error', errorHandler, { once: true });
      
      const metadataHandler = () => {
        console.log('✅ Source loaded successfully');
        if (this.video) {
          this.video.removeEventListener('loadedmetadata', metadataHandler);
        }
      };
      this.video.addEventListener('loadedmetadata', metadataHandler, { once: true });
      
      this.video.load();
      
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
    
    setSource(url, options = {}) {
      if (!this.video || this._isDestroyed) return Promise.reject('Player destroyed');
      
      const {
        type = this.getMediaMimeType(url),
        contentId = null,
        contentMetadata = null,
        collectionContext = null
      } = options;
      
      if (contentId) this.contentId = contentId;
      if (contentMetadata) this.contentMetadata = contentMetadata;
      if (collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...collectionContext };
      }
      
      this._audioRendererRecoveryAttempted = false;
      
      if (this.isAudioSource(url)) {
        if (this.video) this.video.classList.add('audio-mode');
      } else {
        if (this.video) this.video.classList.remove('audio-mode');
      }
      
      if (this.video) {
        this.video.pause();
        this.video.currentTime = 0;
      }
      
      if (this.video) {
        while (this.video.firstChild) {
          this.video.removeChild(this.video.firstChild);
        }
      }
      
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      if (this.video) this.video.appendChild(source);
      
      this.retryAttempts = 0;
      this.errorState = null;
      this.viewRecorded = false;
      this.viewValidated = false;
      
      if (this.video) this.video.load();
      
      this._sourcePreserved = { url, type, method: 'setSource' };
      
      console.log('✅ Source changed:', { url, contentId });
      this._emit('source:changed', { url, contentId, type });
      
      return Promise.resolve();
    }
    
    // =====================================================
    // 🔧 DESKTOP AUTOPLAY AUDIO FIX (ENHANCED)
    // =====================================================
    async safePlay() {
      if (!this.video || this._isDestroyed) {
        return Promise.reject('Player destroyed');
      }
      
      try {
        // First attempt: normal playback with unmuted audio
        await this.video.play();
        
        // Success! Unmute if needed
        this.video.muted = false;
        this.config.muted = false;
        
        // Clean up any pending audio restoration listeners
        this._cleanupAudioRestoreListeners();
        
        console.log('▶️ Playback started successfully with unmuted audio');
        this._emit('playback:audio-restored', { method: 'direct' });
        return true;
        
      } catch (error) {
        console.warn('⚠️ Initial play blocked or failed:', error.message);
        
        // Second attempt: Force mute and retry
        this.video.muted = true;
        this.config.muted = true;
        
        try {
          await this.video.play();
          console.log('✅ Playback recovered in muted mode');
          
          // Set up audio restoration on first user interaction
          this._setupAudioRestoreOnInteraction();
          
          this._emit('playback:audio-muted', { 
            reason: error.message,
            willRestoreOnInteraction: true 
          });
          return true;
          
        } catch (retryError) {
          console.error('❌ Hard playback failure:', retryError);
          
          // Show play overlay to let user initiate manually
          this._showPlayOverlay();
          
          this._emit('playback:fatal-error', { error: retryError });
          throw retryError;
        }
      }
    }
    
    // =====================================================
    // 🔧 AUDIO RESTORATION ON USER INTERACTION
    // =====================================================
    _setupAudioRestoreOnInteraction() {
      if (this._audioRestoreListenerAttached) {
        console.log('🔊 Audio restore listener already attached');
        return;
      }
      
      this._pendingAudioRestore = true;
      this._audioRestoreListenerAttached = true;
      
      const restoreAudio = () => {
        if (!this._pendingAudioRestore) return;
        if (!this.video || this._isDestroyed) return;
        
        // Only restore if video is still muted
        if (this.video.muted) {
          this.video.muted = false;
          console.log('🔊 Audio restored after user interaction');
          this._emit('playback:audio-restored', { method: 'user-interaction' });
        }
        
        this._pendingAudioRestore = false;
        this._cleanupAudioRestoreListeners();
      };
      
      // Listen for click, keydown, or touch events
      document.addEventListener('click', restoreAudio, { once: true });
      document.addEventListener('keydown', restoreAudio, { once: true });
      document.addEventListener('touchstart', restoreAudio, { once: true });
      
      // Also listen on video container for immediate interaction
      if (this.container) {
        this.container.addEventListener('click', restoreAudio, { once: true });
        this.container.addEventListener('touchstart', restoreAudio, { once: true });
      }
      
      console.log('🔊 Audio restore listener attached - will unmute on first user interaction');
    }
    
    _cleanupAudioRestoreListeners() {
      if (!this._audioRestoreListenerAttached) return;
      
      this._pendingAudioRestore = false;
      this._audioRestoreListenerAttached = false;
      
      // Note: can't easily remove listeners added with { once: true }
      // but they auto-cleanup after firing
      console.log('🔇 Audio restore listeners cleaned up');
    }
    
    async play() {
      if (!this.video || this._isDestroyed) {
        return Promise.reject('Player destroyed');
      }
      return this.safePlay();
    }
    
    pause() {
      if (this.video && !this._isDestroyed) {
        this.video.pause();
      }
    }
    
    togglePlay() {
      if (!this.video || this._isDestroyed) return;
      if (this.video.paused) {
        this.play().catch(() => {});
      } else {
        this.pause();
      }
    }
    
    seek(time) {
      if (!this.video || this._isDestroyed) return;
      if (isNaN(time) || !isFinite(time)) return;
      
      const duration = this.video.duration || 0;
      const clamped = Math.max(0, Math.min(time, duration));
      
      if (this.video) {
        this.video.currentTime = clamped;
      }
      
      this._emit('playback:seeked', { time: clamped, duration });
    }
    
    seekRelative(seconds) {
      if (!this.video || this._isDestroyed) return;
      this.seek(this.video.currentTime + seconds);
    }
    
    seekPercent(percent) {
      if (!this.video || this._isDestroyed) return;
      const time = (percent / 100) * (this.video.duration || 0);
      this.seek(time);
    }
    
    setPlaybackRate(rate) {
      if (!this.video || this._isDestroyed) return;
      
      const clamped = Math.max(0.25, Math.min(4, rate));
      if (this.video) {
        this.video.playbackRate = clamped;
      }
      this.playbackRate = clamped;
      
      console.log(`⚡ Playback rate: ${clamped}x`);
      this._emit('playback:ratechange', { rate: clamped });
    }
    
    setVolume(volume) {
      if (!this.video || this._isDestroyed) return;
      
      const clamped = Math.max(0, Math.min(1, volume));
      if (this.video) {
        this.video.volume = clamped;
        this.video.muted = clamped === 0;
      }
      
      this.stats.volumeChanges++;
      this._updateVolumeUI();
      
      console.log(`🔊 Volume: ${Math.round(clamped * 100)}%`);
      this._emit('playback:volumechange', { volume: clamped, muted: this.video ? this.video.muted : false });
    }
    
    adjustVolume(delta) {
      if (!this.video || this._isDestroyed) return;
      this.setVolume(this.video.volume + delta);
    }
    
    toggleMute() {
      if (!this.video || this._isDestroyed) return;
      if (this.video) {
        this.video.muted = !this.video.muted;
      }
      
      // If user manually unmutes, cancel pending auto-restore
      if (this.video && !this.video.muted) {
        this._pendingAudioRestore = false;
        console.log('🔊 User manually unmuted, cancelling auto-restore');
      }
      
      this._updateVolumeUI();
      console.log(`🔇 Mute: ${this.video ? this.video.muted : false}`);
      this._emit('playback:mute', { muted: this.video ? this.video.muted : false });
    }
    
    toggleFullscreen() {
      const target = this.container || this.video;
      if (!target) return;
      
      if (!this.isFullscreen) {
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
      
      this._updateFullscreenButton();
      console.log(`🖥️ Fullscreen: ${this.isFullscreen}`);
      this._emit('player:fullscreen', { isFullscreen: this.isFullscreen });
    }
    
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
    
    _updateFullscreenButton() {
      const btn = this._controlsCache ? this._controlsCache.fullscreenBtn : null;
      const icon = btn ? btn.querySelector('i') : null;
      if (icon) {
        icon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
      }
    }
    
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
    
    _initializeIntegrations() {
      console.log('🔌 Integrations initialized');
    }
    
    _initializeTelemetrySession() {
      if (!this.config.enableTelemetry || !this.supabase || !this.contentId) return;
      
      if (!this.playbackSessionId) {
        this.playbackSessionId = sessionStorage.getItem('bantu_playback_session');
        if (!this.playbackSessionId) {
          this.playbackSessionId = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('bantu_playback_session', this.playbackSessionId);
        }
      }
      
      if (typeof WatchSessionManager === 'function' && !this.watchSession) {
        try {
          this.watchSession = new WatchSessionManager({
            supabase: this.supabase,
            contentId: this.contentId,
            userId: this.userId,
            sessionId: this.playbackSessionId,
            heartbeatInterval: this.config.heartbeatInterval,
            validViewThreshold: this.config.validViewThreshold,
            collectionId: this.collectionContext.collectionId,
            playlistId: this.collectionContext.playlistId,
            sortIndex: this.collectionContext.currentSortIndex,
            episodeNumber: this.collectionContext.episodeNumber,
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
    
    async _recordView() {
      if (this.viewRecorded || !this.supabase || !this.contentId) return;
      
      this.viewRecorded = true;
      console.log('👁️ View threshold reached, recording...');
      
      try {
        const { error } = await this.supabase
          .rpc('increment_content_views', {
            content_id_input: parseInt(this.contentId)
          });
        
        if (error) {
          console.warn('⚠️ View RPC failed:', error.message);
          await this._recordViewFallback();
        } else {
          console.log('✅ View recorded via RPC');
          this.engagement.views++;
          this._updateSocialCounts();
        }
        
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
    
    async _recordViewFallback() {
      if (!this.supabase || !this.contentId) return;
      
      const { error } = await this.supabase
        .from('content_views')
        .insert({
          content_id: parseInt(this.contentId),
          viewer_id: this.userId,
          session_id: this.playbackSessionId,
          watched_seconds: Math.floor(this.video ? this.video.currentTime : 0),
          device_type: this._isMobile ? 'mobile' : 'desktop',
          created_at: new Date().toISOString()
        });
      
      if (error && error.code !== '23505') {
        console.warn('⚠️ Fallback view insert failed:', error.message);
      }
    }
    
    _autoAdvance() {
      if (!this.config.enableCollectionNav) return;
      console.log('🎬 Auto-advancing to next item...');
      
      if (this.config.enableQueueIntegration && window.QueueManager && window.QueueManager.playNext) {
        window.QueueManager.playNext();
        return;
      }
      
      if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.getNextItem) {
        const nextItem = window.ContentCollectionsEngine.getNextItem(this.contentId);
        if (nextItem) {
          window.location.href = `content-detail.html?id=${nextItem.id}`;
          return;
        }
      }
      
      this._emit('collection:auto-advance', {
        currentContentId: this.contentId,
        collectionId: this.collectionContext.collectionId
      });
    }
    
    playPrevious() {
      console.log('⏮️ Playing previous item...');
      
      if (window.QueueManager && window.QueueManager.playPrevious) {
        window.QueueManager.playPrevious();
        return;
      }
      
      if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.getPreviousItem) {
        const prevItem = window.ContentCollectionsEngine.getPreviousItem(this.contentId);
        if (prevItem) {
          window.location.href = `content-detail.html?id=${prevItem.id}`;
          return;
        }
      }
      
      this._emit('collection:previous-requested', {
        currentContentId: this.contentId
      });
    }
    
    playNext() {
      console.log('⏭️ Playing next item...');
      
      if (window.QueueManager && window.QueueManager.playNext) {
        window.QueueManager.playNext();
        return;
      }
      
      if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.getNextItem) {
        const nextItem = window.ContentCollectionsEngine.getNextItem(this.contentId);
        if (nextItem) {
          window.location.href = `content-detail.html?id=${nextItem.id}`;
          return;
        }
      }
      
      this._emit('collection:next-requested', {
        currentContentId: this.contentId
      });
    }
    
    async _toggleLike() {
      if (!this.supabase || !this.contentId || !this.userId) {
        console.warn('⚠️ Cannot toggle like: missing auth or content');
        return;
      }
      
      const willLike = !this.engagement.isLiked;
      
      this.engagement.isLiked = willLike;
      this.engagement.likes += willLike ? 1 : -1;
      this._updateSocialCounts();
      
      try {
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
        
        await this.supabase.rpc('increment_engagement_stats_likes', {
          target_content_id: parseInt(this.contentId),
          increment_value: willLike ? 1 : -1
        });
        
        console.log(`❤️ Like ${willLike ? 'added' : 'removed'}`);
        this._emit('social:like-toggled', { liked: willLike, count: this.engagement.likes });
        
      } catch (error) {
        console.error('❌ Like toggle failed:', error);
        this.engagement.isLiked = !willLike;
        this.engagement.likes += willLike ? -1 : 1;
        this._updateSocialCounts();
      }
    }
    
    async _toggleFavorite() {
      if (!this.supabase || !this.contentId || !this.userId) return;
      
      const willFav = !this.engagement.isFavorited;
      
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
    
    _shareContent() {
      const shareData = {
        title: this.contentMetadata ? (this.contentMetadata.title || 'Check this out') : 'Check this out',
        text: this.contentMetadata ? (this.contentMetadata.description || '') : '',
        url: window.location.href
      };
      
      if (navigator.share) {
        navigator.share(shareData)
          .then(() => {
            this.engagement.shares++;
            this._updateSocialCounts();
            this._emit('social:shared', { method: 'web-share' });
          })
          .catch(() => {
            this._shareFallback(shareData);
          });
      } else {
        this._shareFallback(shareData);
      }
    }
    
    _shareFallback(data) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data.url).then(() => {
          this.engagement.shares++;
          this._updateSocialCounts();
          
          if (window.state && window.state.showToast) {
            window.state.showToast('Link copied to clipboard!', { type: 'success' });
          }
          
          this._emit('social:shared', { method: 'clipboard' });
        });
      }
    }
    
    _updateSocialCounts() {
      if (!this._controlsCache || !this._controlsCache.socialPanel) return;
      
      const panel = this._controlsCache.socialPanel;
      if (!panel) return;
      
      const likeCount = panel.querySelector('.like-btn .social-count');
      if (likeCount) {
        likeCount.textContent = this._formatCount(this.engagement.likes);
      }
      
      const favCount = panel.querySelector('.favorite-btn .social-count');
      if (favCount) {
        favCount.textContent = this._formatCount(this.engagement.favorites);
      }
      
      const shareCount = panel.querySelector('.share-btn .social-count');
      if (shareCount) {
        shareCount.textContent = this._formatCount(this.engagement.shares);
      }
      
      const likeBtn = panel.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.classList.toggle('active', this.engagement.isLiked);
        likeBtn.setAttribute('aria-pressed', this.engagement.isLiked ? 'true' : 'false');
        likeBtn.setAttribute('aria-label', this.engagement.isLiked ? 'Unlike' : 'Like');
      }
      
      const favBtn = panel.querySelector('.favorite-btn');
      if (favBtn) {
        favBtn.classList.toggle('active', this.engagement.isFavorited);
        favBtn.setAttribute('aria-pressed', this.engagement.isFavorited ? 'true' : 'false');
        favBtn.setAttribute('aria-label', this.engagement.isFavorited ? 'Remove from favorites' : 'Add to favorites');
      }
    }
    
    setQuality(quality) {
      if (quality === this.currentQuality) return;
      
      console.log(`🎬 Quality: ${quality}`);
      this.currentQuality = quality;
      this.stats.qualityChanges++;
      
      this._emit('playback:quality-change', {
        from: this.currentQuality,
        to: quality
      });
      
      if (window.stateManager) {
        window.stateManager.setPreference('quality', quality);
      }
    }
    
    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.push(callback);
      }
      
      return () => {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
          const idx = callbacks.indexOf(callback);
          if (idx > -1) callbacks.splice(idx, 1);
        }
      };
    }
    
    off(event, callback) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks && callback) {
        const idx = callbacks.indexOf(callback);
        if (idx > -1) callbacks.splice(idx, 1);
      }
    }
    
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
    
    _formatCount(num) {
      if (!num) return '0';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }
    
    _cleanupAttachment() {
      if (this._listenersAttached && this.video) {
        const events = [
          'play', 'pause', 'ended', 'error', 'waiting', 'canplay',
          'canplaythrough', 'loadeddata', 'loadedmetadata',
          'timeupdate', 'progress', 'seeking', 'seeked',
          'volumechange', 'ratechange', 'durationchange',
          'click'
        ];
        
        events.forEach(event => {
          if (this.video) {
            this.video.removeEventListener(event, this._handleVideoEvent);
          }
        });
        
        this._listenersAttached = false;
      }
      
      // Clean up audio restore listeners
      this._cleanupAudioRestoreListeners();
      
      if (this.bufferingTimeout) {
        clearTimeout(this.bufferingTimeout);
        this.bufferingTimeout = null;
      }
      if (this.controlsHideTimeout) {
        clearTimeout(this.controlsHideTimeout);
        this.controlsHideTimeout = null;
      }
      if (this.networkCheckInterval) {
        clearInterval(this.networkCheckInterval);
        this.networkCheckInterval = null;
      }
      
      if (this.controls && this.controls.parentNode) {
        this.controls.parentNode.removeChild(this.controls);
      }
      
      if (this.watchSession && this.watchSession.isActive) {
        this.watchSession.end();
      }
      
      this.isPlaying = false;
      this.isBuffering = false;
      this.viewRecorded = false;
      this.viewValidated = false;
      this._audioRendererRecoveryAttempted = false;
    }
    
    destroy() {
      if (this._isDestroyed) {
        console.log('ℹ️ Player already destroyed');
        return;
      }
      
      console.log('🗑️ Destroying EnhancedVideoPlayer...');
      this._isDestroyed = true;
      
      this._preserveSource();
      this._cleanupAttachment();
      
      if (this.video) {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
        this.video.controls = true;
      }
      
      this.eventListeners.clear();
      
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
    
    getPlaybackState() {
      if (!this.video) return null;
      
      return {
        currentTime: this.video.currentTime,
        duration: this.video.duration,
        paused: this.video.paused,
        volume: this.video.volume,
        muted: this.video.muted,
        playbackRate: this.video.playbackRate,
        buffered: this.video.buffered && this.video.buffered.length > 0 ? {
          start: this.video.buffered.start(0),
          end: this.video.buffered.end(this.video.buffered.length - 1)
        } : null
      };
    }
    
    isReady() {
      return this._isAttached && !this._isDestroyed && this.video ? this.video.readyState >= 2 : false;
    }
  }
  
  // =====================================================
  // GLOBAL EXPORT & INITIALIZATION
  // =====================================================
  
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
  window.BantuVideoPlayer = EnhancedVideoPlayer;
  
  // 🎯 YOUTUBE-STYLE: Expose a helper function for content-detail to register
  window._setupPlayerEndedCallback = function(callback) {
    if (typeof callback === 'function') {
      window._playerEndedCallback = callback;
      console.log('✅ Player ended callback registered (YouTube-style)');
    }
  };
  
  document.addEventListener('DOMContentLoaded', () => {
    const videoEl = document.getElementById('inlineVideoPlayer');
    const container = videoEl ? (videoEl.closest('.video-container, .inline-player') || videoEl.parentElement) : null;
    
    if (videoEl && container) {
      const initData = {
        contentId: videoEl.dataset ? videoEl.dataset.contentId : null,
        autoplay: videoEl.dataset ? videoEl.dataset.autoplay === 'true' : false,
        muted: videoEl.dataset ? videoEl.dataset.muted === 'true' : false,
        contentMetadata: window.currentContent || null,
        collectionContext: (() => {
          if (window.currentContent && typeof window.currentContent === 'object') {
            return {
              collectionId: window.currentContent.series_id || window.currentContent.playlist_id || null,
              playlistId: window.currentContent.playlist_id || window.currentContent.series_id || null,
              currentSortIndex: window.currentContent.sort_index !== undefined ? window.currentContent.sort_index : null,
              episodeNumber: window.currentContent.episode_number !== undefined ? window.currentContent.episode_number : null,
              itemType: window.currentContent.media_type === 'audio' ? 'track' : 'episode'
            };
          }
          return {
            collectionId: null,
            playlistId: null,
            currentSortIndex: null,
            episodeNumber: null,
            itemType: null
          };
        })()
      };
      
      setTimeout(() => {
        try {
          const player = new EnhancedVideoPlayer(initData);
          player.attach(videoEl, container, initData).catch(err => {
            console.warn('⚠️ Player attach had issues:', err);
          });
          window.bantuPlayer = player;
        } catch (error) {
          console.error('❌ Failed to auto-initialize player:', error);
        }
      }, 500);
    }
  });
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedVideoPlayer;
  }
  
  console.log('✅ EnhancedVideoPlayer module loaded successfully (v2.4.0 - Desktop Autoplay Audio Fix)');
  console.log('   Features: Telemetry, Collection Nav, Audio/Video Support, Mobile Optimization');
  console.log('   🎵 AUDIO RENDERER FIX: Automatic mute fallback for AUDIO_RENDERER_ERROR');
  console.log('   🔧 CRITICAL FIX: Removed all optional chaining assignments');
  console.log('   🎯 YOUTUBE-STYLE: Player ended event triggers window.playNextPlaylistItem()');
  console.log('   🎯 YOUTUBE-STYLE: Player does NOT own playlist logic - only fires event');
  console.log('   🔊 DESKTOP AUTOPLAY: Enhanced safePlay() with user interaction audio restoration');
  
})();
