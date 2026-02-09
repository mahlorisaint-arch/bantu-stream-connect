// js/video-player.js - Bantu Stream Connect Enhanced Video Player
// COMPLETE VERSION WITH CUSTOM BRANDED PLAY/PAUSE/LOADING BUTTONS

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
    this.playPauseToggle = null; // Custom play/pause/loading overlay
    
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
    this.isPlaying = false; // Track play state
    
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
    
    console.log('✅ EnhancedVideoPlayer initialized with Bantu branded controls');
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
    const existingSrc = this.video.src || this.video.getAttribute('src');
    const existingSourceElements = Array.from(this.video.querySelectorAll('source'));
    
    console.log('📥 Existing video src:', existingSrc);
    console.log('📥 Existing source elements:', existingSourceElements.length);
    
    // Store existing source info before we modify anything
    let preservedSource = null;
    let preservedType = null;
    
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

    // Create custom controls and play/pause overlay
    this.createPlayPauseOverlay();
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
        const source = document.createElement('source');
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
  // BANTU BRANDED PLAY/PAUSE/LOADING OVERLAY
  // ======================
  
  createPlayPauseOverlay() {
    if (!this.container) return;
    
    // Create overlay container
    this.playPauseToggle = document.createElement('div');
    this.playPauseToggle.className = 'play-pause-toggle';
    this.playPauseToggle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      z-index: 50;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    `;
    
    // Add state containers
    this.playPauseToggle.innerHTML = `
      <!-- Play State -->
      <div class="play-state bantu-play-button" style="display: block;">
        ${this.getBantuPlaySVG(80)}
      </div>
      
      <!-- Pause State -->
      <div class="pause-state bantu-pause-button" style="display: none;">
        ${this.getBantuPauseSVG(80)}
      </div>
      
      <!-- Loading State -->
      <div class="loading-state bantu-loading-button" style="display: none;">
        ${this.getBantuLoadingSVG(80)}
        <div class="loading-text" style="
          color: var(--soft-white);
          font-size: 12px;
          font-weight: 500;
          margin-top: 8px;
          text-align: center;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        ">Buffering...</div>
      </div>
    `;
    
    // Add to container
    this.container.appendChild(this.playPauseToggle);
    
    // Show overlay on hover and when paused
    this.container.addEventListener('mouseenter', () => {
      if (this.video.paused || this.isBuffering) {
        this.playPauseToggle.style.opacity = '1';
        this.playPauseToggle.style.pointerEvents = 'auto';
      }
    });
    
    this.container.addEventListener('mouseleave', () => {
      if (!this.video.paused && !this.isBuffering) {
        this.playPauseToggle.style.opacity = '0';
        this.playPauseToggle.style.pointerEvents = 'none';
      }
    });
    
    // Click to toggle play/pause
    this.playPauseToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlay();
    });
    
    // Also click on video container to toggle
    this.container.addEventListener('click', (e) => {
      if (!e.target.closest('.enhanced-video-controls') && 
          !e.target.closest('.bantu-social-panel')) {
        this.togglePlay();
      }
    });
    
    console.log('✅ Bantu branded play/pause/loading overlay created');
  }
  
  // ======================
  // BANTU SVG ICONS
  // ======================
  
  getBantuPlaySVG(size = 80) {
    const scale = size / 120;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="africaGlowPlay" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1"/>
            <feFlood flood-color="#42F2FF" flood-opacity="0.4" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur2"/>
            <feFlood flood-color="#18E1FF" flood-opacity="0.25" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="triangleGlowPlay" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur1"/>
            <feFlood flood-color="#B6FFFB" flood-opacity="0.5" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"/>
            <feFlood flood-color="#8CFFF6" flood-opacity="0.3" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="containerGlowPlay" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
            <feFlood flood-color="#18E1FF" flood-opacity="0.2" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect width="120" height="120" rx="36" ry="36" fill="#050B1E"/>
        
        <rect x="4" y="4" width="112" height="112" rx="32" ry="32" 
              fill="none" 
              stroke="#18E1FF" 
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#containerGlowPlay)"/>
        
        <path d="M 60 28 C 58 28, 55 30, 53 32 L 48 38, 45 42, 43 46 C 42 48, 41 50, 41 52 L 41 58, 42 62, 44 66 C 45 68, 47 70, 49 71 L 52 73, 55 74, 58 75 C 60 75, 62 75, 64 74 L 67 73, 70 71, 72 69 C 74 67, 75 65, 76 63 L 77 60, 78 57, 78 54 C 78 52, 77 50, 76 48 L 74 44, 72 41, 70 38 C 68 36, 66 34, 64 33 L 62 31, 61 30, 60 28 Z M 65 45 C 66 46, 67 47, 68 48 L 69 50, 70 52, 70 54 C 70 55, 69 56, 68 57 L 67 58, 66 59, 65 60 C 64 60, 63 60, 62 59 L 61 58, 60 57, 59 56 C 58 55, 58 54, 58 53 L 59 51, 60 49, 62 47 C 63 46, 64 45, 65 45 Z"
              fill="none"
              stroke="#18E1FF"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#africaGlowPlay)"/>
        
        <line x1="68" y1="48" x2="82" y2="48" 
              stroke="#18E1FF" 
              stroke-width="2" 
              stroke-linecap="round"
              opacity="0.85"
              filter="url(#africaGlowPlay)"/>
        
        <line x1="68" y1="52" x2="80" y2="52" 
              stroke="#18E1FF" 
              stroke-width="2" 
              stroke-linecap="round"
              opacity="0.85"
              filter="url(#africaGlowPlay)"/>
        
        <line x1="68" y1="56" x2="78" y2="56" 
              stroke="#18E1FF" 
              stroke-width="2" 
              stroke-linecap="round"
              opacity="0.85"
              filter="url(#africaGlowPlay)"/>
        
        <path d="M 50 45 L 70 54 L 50 63 Z"
              fill="#8CFFF6"
              filter="url(#triangleGlowPlay)"/>
      </svg>
    `;
  }
  
  getBantuPauseSVG(size = 80) {
    const scale = size / 120;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="africaGlowPause" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1"/>
            <feFlood flood-color="#42F2FF" flood-opacity="0.4" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur2"/>
            <feFlood flood-color="#18E1FF" flood-opacity="0.25" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="pauseGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur1"/>
            <feFlood flood-color="#B6FFFB" flood-opacity="0.5" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur2"/>
            <feFlood flood-color="#8CFFF6" flood-opacity="0.3" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="containerGlowPause" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
            <feFlood flood-color="#18E1FF" flood-opacity="0.2" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect width="120" height="120" rx="36" ry="36" fill="#050B1E"/>
        
        <rect x="4" y="4" width="112" height="112" rx="32" ry="32" 
              fill="none" 
              stroke="#18E1FF" 
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#containerGlowPause)"/>
        
        <path d="M 60 28 C 58 28, 55 30, 53 32 L 48 38, 45 42, 43 46 C 42 48, 41 50, 41 52 L 41 58, 42 62, 44 66 C 45 68, 47 70, 49 71 L 52 73, 55 74, 58 75 C 60 75, 62 75, 64 74 L 67 73, 70 71, 72 69 C 74 67, 75 65, 76 63 L 77 60, 78 57, 78 54 C 78 52, 77 50, 76 48 L 74 44, 72 41, 70 38 C 68 36, 66 34, 64 33 L 62 31, 61 30, 60 28 Z M 65 45 C 66 46, 67 47, 68 48 L 69 50, 70 52, 70 54 C 70 55, 69 56, 68 57 L 67 58, 66 59, 65 60 C 64 60, 63 60, 62 59 L 61 58, 60 57, 59 56 C 58 55, 58 54, 58 53 L 59 51, 60 49, 62 47 C 63 46, 64 45, 65 45 Z"
              fill="none"
              stroke="#18E1FF"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#africaGlowPause)"/>
        
        <rect x="50" y="42" width="8" height="36" 
              rx="2" ry="2"
              fill="#8CFFF6"
              filter="url(#pauseGlow)"/>
        
        <rect x="62" y="42" width="8" height="36" 
              rx="2" ry="2"
              fill="#8CFFF6"
              filter="url(#pauseGlow)"/>
      </svg>
    `;
  }
  
  getBantuLoadingSVG(size = 80) {
    const scale = size / 120;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pulseGlowLoad" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur1"/>
            <feFlood flood-color="#B6FFFB" flood-opacity="0.6" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur2"/>
            <feFlood flood-color="#8CFFF6" flood-opacity="0.4" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="africaGlowLoad" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1"/>
            <feFlood flood-color="#42F2FF" flood-opacity="0.4" result="glowColor1"/>
            <feComposite in="glowColor1" in2="blur1" operator="in" result="innerGlow"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
            <feFlood flood-color="#18E1FF" flood-opacity="0.25" result="glowColor2"/>
            <feComposite in="glowColor2" in2="blur2" operator="in" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
              <feMergeNode in="innerGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect width="120" height="120" rx="36" ry="36" fill="#050B1E"/>
        
        <rect x="4" y="4" width="112" height="112" rx="32" ry="32" 
              fill="none" 
              stroke="#18E1FF" 
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#africaGlowLoad)"/>
        
        <path d="M 60 28 C 58 28, 55 30, 53 32 L 48 38, 45 42, 43 46 C 42 48, 41 50, 41 52 L 41 58, 42 62, 44 66 C 45 68, 47 70, 49 71 L 52 73, 55 74, 58 75 C 60 75, 62 75, 64 74 L 67 73, 70 71, 72 69 C 74 67, 75 65, 76 63 L 77 60, 78 57, 78 54 C 78 52, 77 50, 76 48 L 74 44, 72 41, 70 38 C 68 36, 66 34, 64 33 L 62 31, 61 30, 60 28 Z M 65 45 C 66 46, 67 47, 68 48 L 69 50, 70 52, 70 54 C 70 55, 69 56, 68 57 L 67 58, 66 59, 65 60 C 64 60, 63 60, 62 59 L 61 58, 60 57, 59 56 C 58 55, 58 54, 58 53 L 59 51, 60 49, 62 47 C 63 46, 64 45, 65 45 Z"
              fill="none"
              stroke="#18E1FF"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#africaGlowLoad)"/>
        
        <circle cx="60" cy="60" r="24" 
                fill="none" 
                stroke="#8CFFF6" 
                stroke-width="4"
                stroke-dasharray="30 120"
                stroke-linecap="round"
                opacity="0.9"
                filter="url(#pulseGlowLoad)">
          <animate attributeName="stroke-dashoffset" 
                   dur="1.5s" 
                   repeatCount="indefinite" 
                   values="0;150"/>
          <animate attributeName="transform" 
                   dur="2s" 
                   repeatCount="indefinite" 
                   attributeType="XML" 
                   attributeName="transform" 
                   values="rotate(0 60 60);rotate(360 60 60)"/>
        </circle>
        
        <circle cx="60" cy="60" r="12" 
                fill="none" 
                stroke="#B6FFFB" 
                stroke-width="3"
                stroke-dasharray="18 50"
                stroke-linecap="round"
                opacity="0.8">
          <animate attributeName="stroke-dashoffset" 
                   dur="1s" 
                   repeatCount="indefinite" 
                   values="0;68"/>
          <animate attributeName="opacity" 
                   dur="2s" 
                   repeatCount="indefinite" 
                   values="0.8;1;0.8"/>
        </circle>
        
        <circle cx="60" cy="60" r="4" 
                fill="#8CFFF6"
                opacity="0.9">
          <animate attributeName="r" 
                   dur="1.5s" 
                   repeatCount="indefinite" 
                   values="4;6;4"/>
          <animate attributeName="opacity" 
                   dur="1.5s" 
                   repeatCount="indefinite" 
                   values="0.9;1;0.9"/>
        </circle>
      </svg>
    `;
  }
  
  // ======================
  // STATE MANAGEMENT
  // ======================
  
  updatePlayPauseState() {
    if (!this.playPauseToggle) return;
    
    const playState = this.playPauseToggle.querySelector('.play-state');
    const pauseState = this.playPauseToggle.querySelector('.pause-state');
    const loadingState = this.playPauseToggle.querySelector('.loading-state');
    
    if (this.isBuffering) {
      // Show loading state
      playState.style.display = 'none';
      pauseState.style.display = 'none';
      loadingState.style.display = 'block';
      this.playPauseToggle.style.opacity = '1';
      this.playPauseToggle.style.pointerEvents = 'none';
    } else if (this.video.paused) {
      // Show play state
      playState.style.display = 'block';
      pauseState.style.display = 'none';
      loadingState.style.display = 'none';
      this.playPauseToggle.style.opacity = '1';
      this.playPauseToggle.style.pointerEvents = 'auto';
    } else {
      // Show pause state (or hide overlay)
      playState.style.display = 'none';
      pauseState.style.display = 'block';
      loadingState.style.display = 'none';
      this.playPauseToggle.style.opacity = '0';
      this.playPauseToggle.style.pointerEvents = 'none';
    }
  }
  
  // ======================
  // EVENT HANDLERS
  // ======================
  
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
      case 'ended':
        this.handleEnded();
        break;
    }
    
    // Always update play/pause state
    this.updatePlayPauseState();
  }
  
  handlePlay() {
    this.isPlaying = true;
    this.playbackStartTime = Date.now();
    this.stats.playCount++;
    
    this.emit('playbackstart', {
      timestamp: this.playbackStartTime,
      currentTime: this.video.currentTime
    });
  }
  
  handlePause() {
    this.isPlaying = false;
    if (this.playbackStartTime) {
      const watchTime = Date.now() - this.playbackStartTime;
      this.stats.totalWatchTime += watchTime;
      this.playbackStartTime = null;
      
      this.emit('playbackpause', {
        watchTime,
        currentTime: this.video.currentTime
      });
    }
  }
  
  handleEnded() {
    this.isPlaying = false;
    this.updatePlayPauseState();
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
        this.updatePlayPauseState();
      }
    }, 500);
    
    this.emit('bufferingstart');
  }
  
  handleCanPlay() {
    this.isBuffering = false;
    clearTimeout(this.bufferingTimeout);
    this.updatePlayPauseState();
    
    this.emit('bufferingend');
  }
  
  // ======================
  // CUSTOM CONTROLS (Compact)
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
    
    this.container.appendChild(this.controls);
    this.setupControlListeners();
    
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
        
        <div class="volume-controls">
          <button class="control-btn volume-btn" title="Volume">
            <i class="fas fa-volume-up"></i>
          </button>
          <input type="range" class="volume-bar" min="0" max="100" value="100">
        </div>
        
        <button class="control-btn settings-btn" title="Settings">
          <i class="fas fa-cog"></i>
        </button>
        
        <button class="control-btn fullscreen-btn" title="Fullscreen">
          <i class="fas fa-expand"></i>
        </button>
      </div>
      
      <div class="settings-menu" style="display: none;">
        <div class="settings-section">
          <h4><i class="fas fa-tachometer-alt"></i> Playback Speed</h4>
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
      progressBar.parentElement.style.setProperty('--progress', `${progress}%`);
    }
  }
  
  // ======================
  // PLAYER ACTIONS
  // ======================
  
  play() {
    this.isPlaying = true;
    return this.video.play().catch(error => {
      this.handleError({ target: this.video });
      throw error;
    });
  }
  
  pause() {
    this.isPlaying = false;
    this.video.pause();
  }
  
  togglePlay() {
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
    this.updatePlayPauseState();
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
  
  toggleFullscreen() {
    const playerContainer = this.container.closest('.inline-player') || this.container;
    
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
    
    setTimeout(() => {
      if (this.controls) this.controls.style.opacity = '1';
    }, 100);
  }
  
  // ======================
  // UI HELPERS
  // ======================
  
  showBufferingIndicator() {
    this.isBuffering = true;
    this.updatePlayPauseState();
  }
  
  hideBufferingIndicator() {
    this.isBuffering = false;
    this.updatePlayPauseState();
  }
  
  showErrorOverlay(message) {
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
  // DESTROY METHOD
  // ======================
  
  destroy() {
    console.log('🗑️ Destroying EnhancedVideoPlayer...');
    
    let preservedSource = null;
    let preservedType = null;
    
    if (this.video) {
        const existingSources = this.video.querySelectorAll('source');
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
    
    if (this.bufferingTimeout) clearTimeout(this.bufferingTimeout);
    if (this.networkCheckInterval) clearInterval(this.networkCheckInterval);
    
    if (this.controls && this.controls.parentNode) {
      this.controls.parentNode.removeChild(this.controls);
    }
    
    if (this.playPauseToggle && this.playPauseToggle.parentNode) {
      this.playPauseToggle.parentNode.removeChild(this.playPauseToggle);
    }
    
    if (this.socialPanel && this.socialPanel.parentNode) {
      this.socialPanel.parentNode.removeChild(this.socialPanel);
    }
    
    this.eventListeners.clear();

    if (this.video) {
        if (preservedSource) {
            console.log('🔄 Restoring video source after destroy...');
            
            while (this.video.firstChild) {
                this.video.removeChild(this.video.firstChild);
            }
            
            this.video.removeAttribute('src');
            
            const source = document.createElement('source');
            source.src = preservedSource;
            source.type = preservedType || 'video/mp4';
            
            this.video.appendChild(source);
            
            this.video.load();
        }
        
        this.video.controls = true;
        
        console.log('✅ Video source preserved after destroy');
    }

    this.video = null;
    this.container = null;
    
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
window.BantuVideoPlayer = EnhancedVideoPlayer;

console.log('✅ Enhanced Video Player with Bantu branded controls loaded successfully');
