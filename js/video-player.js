// js/video-player.js — Enhanced Video Player with Cloudflare Stream & R2 Integration
// Bantu Stream Connect — Phase 3 Telemetry + Phase 1D Collection Intelligence
// ✅ CLOUDFLARE STREAM INTEGRATION: Native Cloudflare Stream SDK support with iframe
// ✅ CLOUDFLARE R2 SUPPORT: Direct audio playback from custom domain
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
// 🔧 FIX #2: REMOVED fake audio restore system (conflicts with direct user gesture)
// 🔧 FIX #5: ADDED delegated event listeners for prev/next/volume (survives DOM rebuilds)
// 🔧 FIX #8: REMOVED duplicate ended handlers - only ONE progression owner
// 🚨 ENGAGEMENT SYSTEM FIX (2026-05-22): 
// - Fixed view recording to use content_views table (NOT views_count column)
// - Added proper engagement state persistence integration
// - Fixed recordView to insert into content_views correctly
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23):
// - FIX #1: RPC view recording integration (recordContentViewRPC)
// - FIX #2: Global contentId synchronization
// - FIX #8: Threshold-based view recording (15 sec or 30% duration)
// - Added updateContentId method for playlist track changes
// - Added syncEngagementState method for UI consistency
// 🚨 CRITICAL ARCHITECTURE FIX (2026-05-24):
// - SINGLE ended handler (NO duplicate playlist progression)
// - Player ONLY emits events, NEVER controls playlist directly
// - Added loadSource method for non-destructive source changes
// - Removed all engagement buttons from player overlay (now outside only)
// ============================================
// ☁️ CLOUDFLARE STREAM INTEGRATION (2026-06-17):
// - Cloudflare Stream iframe rendering with SDK
// - Event bridging: timeupdate → watch session, ended → playlist progression
// - Dynamic SDK loading with retry logic
// - Provider-based branching (cloudflare_stream, cloudflare_r2, fallback)
// - R2 audio direct playback with full HTML5 audio controls
// - LoadContent() method as main entry point for Cloudflare content
// - Full preservation of all UI controls and keyboard shortcuts
// ============================================
// 🔧 VERSION: v4.0.0 - Cloudflare Stream & R2 Integration
// ============================================

(function() {
  'use strict';
  
  console.log('🎬 EnhancedVideoPlayer module loading... (v4.0.0 - Cloudflare Stream & R2)');

  // ============================================
  // CLOUDFLARE STREAM SDK LOADER
  // ============================================

  function loadCloudflareStreamSDK() {
    return new Promise((resolve, reject) => {
      if (window.Stream) {
        console.log('✅ Cloudflare Stream SDK already loaded');
        resolve(window.Stream);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
      script.async = true;
      script.onload = () => {
        console.log('✅ Cloudflare Stream SDK loaded successfully');
        resolve(window.Stream);
      };
      script.onerror = () => {
        console.error('❌ Cloudflare Stream SDK load failed');
        reject(new Error('Cloudflare Stream SDK load failed'));
      };
      document.head.appendChild(script);
      
      // Timeout fallback
      setTimeout(() => {
        if (!window.Stream) {
          reject(new Error('Cloudflare Stream SDK load timeout'));
        }
      }, 15000);
    });
  }

  // Global reference for RPC view recording
  let _globalRecordContentViewRPC = null;

  /**
   * 🚨 FIX #1: Get the global RPC view recording function
   */
  function getRecordContentViewRPC() {
    if (_globalRecordContentViewRPC) return _globalRecordContentViewRPC;
    if (window.recordContentViewRPC) {
      _globalRecordContentViewRPC = window.recordContentViewRPC;
      return _globalRecordContentViewRPC;
    }
    if (window.recordView) {
      _globalRecordContentViewRPC = window.recordView;
      return _globalRecordContentViewRPC;
    }
    return null;
  }

  /**
   * 🚨 FIX #1 & #8: Record view using RPC with dynamic threshold
   */
  async function recordViewViaRPC(contentId, userId, sessionId, progressSeconds, deviceType) {
    if (!contentId) {
      console.error('❌ Cannot record view: missing contentId');
      return false;
    }
    
    const recordFn = getRecordContentViewRPC();
    if (!recordFn) {
      console.warn('⚠️ No RPC view recording function available, using fallback');
      return await recordViewFallback(contentId, userId, sessionId, progressSeconds, deviceType);
    }
    
    try {
      const finalDeviceType = deviceType || (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
      const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await recordFn(contentId, userId, finalSessionId, finalDeviceType);
      
      if (result && result.success) {
        console.log(`✅ View recorded via RPC for content ${contentId} at ${progressSeconds}s`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ RPC view recording error:', error);
      return await recordViewFallback(contentId, userId, sessionId, progressSeconds, deviceType);
    }
  }

  /**
   * Fallback view recording if RPC is not available
   */
  async function recordViewFallback(contentId, userId, sessionId, progressSeconds, deviceType) {
    if (!contentId) return false;
    
    try {
      const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const finalDeviceType = deviceType || (/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
      
      const { error: insertError } = window.supabaseClient
        ? await window.supabaseClient
            .from('content_views')
            .insert({
              content_id: parseInt(contentId),
              user_id: userId || null,
              session_id: finalSessionId,
              counted_as_view: true,
              view_duration: Math.min(progressSeconds || 30, 300),
              device_type: finalDeviceType,
              viewed_at: new Date().toISOString()
            })
        : { error: new Error('Supabase client not available') };
      
      if (insertError) {
        console.error('❌ View insert failed:', insertError);
        return false;
      }
      
      console.log(`✅ View recorded via fallback for content ${contentId} (duration: ${progressSeconds || 30}s)`);
      
      // Increment the aggregated counter via RPC
      try {
        if (window.supabaseClient) {
          await window.supabaseClient.rpc('increment_content_views', {
            content_id_input: parseInt(contentId)
          });
        }
      } catch (rpcError) {
        console.warn('⚠️ RPC increment failed (non-critical):', rpcError.message);
      }
      
      return true;
    } catch (error) {
      console.error('❌ View recording error:', error);
      return false;
    }
  }

  /**
   * EnhancedVideoPlayer — Production video/audio player with telemetry,
   * collection awareness, and robust media handling
   * 
   * ☁️ CLOUDFLARE SUPPORT:
   * - Cloudflare Stream via iframe + SDK
   * - Cloudflare R2 audio via HTML5 audio
   * - Fallback HTML5 video for legacy content
   * - Provider-based branching
   * - Event bridging to existing engagement systems
   * 
   * 🎯 YOUTUBE-STYLE ARCHITECTURE:
   * - Player ONLY handles playback
   * - On 'ended', calls window.playNextPlaylistItem() if available
   * - Content-detail.js owns all playlist navigation logic
   * - Single source of truth: window.currentPlaylistItems/Index
   * 
   * 🚨 ENGAGEMENT SYSTEM (2026-05-23):
   * - RPC view recording integration
   * - Dynamic threshold (min 15 seconds or 30% of duration)
   * - contentId synchronization with global state
   * - Engagement state sync with UI
   * 
   * 🚨 CRITICAL ARCHITECTURE FIX (2026-05-24):
   * - SINGLE ended handler (NO duplicate playlist progression)
   * - Player NEVER controls playlist directly
   * - loadSource method for non-destructive source changes
   */
  class EnhancedVideoPlayer {
    constructor(options = {}) {
      // Configuration with Phase 3/1D defaults + Cloudflare
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
        
        // 🚨 FIX #8: Dual threshold for view recording
        minViewThresholdSeconds: options.minViewThreshold ?? 15,
        percentageViewThreshold: options.percentageViewThreshold ?? 0.3, // 30%
        
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
      
      // ☁️ Cloudflare Stream specific
      this.isCloudflareStream = false;
      this.cloudflareBridge = null;
      this.cloudflareIframe = null;
      this.cloudflarePlayer = null;
      this._cloudflareSDKLoaded = false;
      this._cloudflareInitialized = false;
      
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
      this._viewThresholdReached = false;
      
      // Audio restoration tracking (simplified - no fake restore system)
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
      
      // Content metadata with Cloudflare fields
      this.contentId = options.contentId || null;
      this.content = options.content || null;
      this.streamingProvider = options.content?.streaming_provider || null;
      this.providerVideoId = options.content?.provider_video_id || null;
      this.fileUrl = options.content?.file_url || null;
      this.contentMetadata = options.contentMetadata || null;
      
      // Supabase integration
      this.supabase = options.supabase || window.supabaseClient || window.supabase;
      this.userId = options.userId || window.AuthHelper?.getUserProfile?.()?.id || null;
      
      // Social engagement state (removed from overlay - kept for telemetry)
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
      
      // 🔧 FIX #5: Setup delegated event listeners for buttons (survives DOM rebuilds)
      this._setupDelegatedEventListeners();
      
      // 🚨 Setup contentId change listener
      this._setupContentIdListener();
      
      console.log('✅ EnhancedVideoPlayer instantiated (Cloudflare Edition)', {
        contentId: this.contentId,
        streamingProvider: this.streamingProvider,
        providerVideoId: this.providerVideoId,
        userId: this.userId,
        telemetry: this.config.enableTelemetry,
        collectionNav: this.config.enableCollectionNav,
        viewThreshold: this.config.minViewThresholdSeconds,
        percentageThreshold: this.config.percentageViewThreshold
      });
    }
    
    // =====================================================
    // 🔧 FIX #5: DELEGATED EVENT LISTENERS
    // These survive DOM rebuilds and player destruction/recreation
    // =====================================================
    _setupDelegatedEventListeners() {
      // Only setup once globally
      if (window._delegatedListenersSetup) return;
      window._delegatedListenersSetup = true;
      
      console.log('🎯 Setting up delegated event listeners for player controls (survives DOM rebuilds)');
      
      document.addEventListener('click', (e) => {
        // Find closest matching buttons
        const prevBtn = e.target.closest('.prev-track-btn, .player-prev-btn');
        const nextBtn = e.target.closest('.next-track-btn, .player-next-btn');
        const volumeBtn = e.target.closest('.volume-btn, .player-volume-btn');
        
        if (prevBtn) {
          e.preventDefault();
          e.stopPropagation();
          console.log('⏮️ Delegated: Previous button clicked');
          if (typeof window.playPreviousPlaylistItem === 'function') {
            window.playPreviousPlaylistItem();
          } else if (typeof this.playPrevious === 'function') {
            this.playPrevious();
          }
        }
        
        if (nextBtn) {
          e.preventDefault();
          e.stopPropagation();
          console.log('⏭️ Delegated: Next button clicked');
          if (typeof window.playNextPlaylistItem === 'function') {
            window.playNextPlaylistItem();
          } else if (typeof this.playNext === 'function') {
            this.playNext();
          }
        }
        
        if (volumeBtn) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔊 Delegated: Volume button clicked');
          if (this.isCloudflareStream && this.cloudflarePlayer) {
            if (this.cloudflarePlayer.muted !== undefined) {
              this.cloudflarePlayer.muted = !this.cloudflarePlayer.muted;
            }
          } else if (this.video) {
            this.video.muted = !this.video.muted;
            this._updateVolumeUI();
            this._emit('playback:mute', { muted: this.video.muted });
          }
        }
      });
      
      console.log('✅ Delegated event listeners registered');
    }
    
    // =====================================================
    // 🚨 FIX #2: Setup contentId change listener
    // =====================================================
    _setupContentIdListener() {
      window.addEventListener('contentIdChanged', (event) => {
        if (event.detail && event.detail.contentId) {
          const newContentId = event.detail.contentId;
          if (this.contentId !== newContentId) {
            console.log(`📡 Player received contentIdChanged event: ${this.contentId} -> ${newContentId}`);
            this.updateContentId(newContentId);
          }
        }
      });
    }
    
    // =====================================================
    // ☁️ CLOUDFLARE STREAM HELPERS
    // =====================================================
    
    _isCloudflareStreamContent() {
      return this.streamingProvider === 'cloudflare_stream' && this.providerVideoId;
    }
    
    _isCloudflareR2Content() {
      return this.streamingProvider === 'cloudflare_r2' && this.fileUrl;
    }
    
    _isAudioContent() {
      if (this.content?.media_type === 'audio') return true;
      if (this.fileUrl && this.isAudioSource(this.fileUrl)) return true;
      return false;
    }
    
    // =====================================================
    // ☁️ LOAD CONTENT (Main entry point for Cloudflare content)
    // =====================================================
    
    async loadContent(content) {
      if (!content) {
        console.error('❌ loadContent: No content provided');
        return;
      }
      
      console.log('📦 Loading content:', {
        id: content.id,
        title: content.title,
        streamingProvider: content.streaming_provider,
        providerVideoId: content.provider_video_id,
        fileUrl: content.file_url ? 'present' : 'null'
      });
      
      // Update content references
      this.content = content;
      this.contentId = content.id;
      this.streamingProvider = content.streaming_provider || null;
      this.providerVideoId = content.provider_video_id || null;
      this.fileUrl = content.file_url || null;
      
      // Reset view recording flags
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      
      // Branch based on streaming provider
      if (this._isCloudflareStreamContent()) {
        await this._loadCloudflareStream(content);
      } else if (this._isCloudflareR2Content()) {
        await this._loadCloudflareR2(content);
      } else if (this.fileUrl) {
        await this._loadFallback(content);
      } else {
        console.error('❌ No playable media source found for content');
        this._emit('error', { message: 'No playable media source' });
      }
    }
    
    // =====================================================
    // ☁️ CLOUDFLARE STREAM LOADER (Branch A)
    // =====================================================
    
    async _loadCloudflareStream(content) {
      console.log('☁️ Loading Cloudflare Stream content:', content.provider_video_id);
      
      // Ensure container exists
      if (!this.container) {
        console.warn('⚠️ No container for Cloudflare Stream, creating one');
        this._createContainer();
      }
      
      try {
        // Load Cloudflare Stream SDK
        if (!window.Stream) {
          await loadCloudflareStreamSDK();
        }
        
        // Clean up any existing Cloudflare player
        if (this.cloudflarePlayer) {
          try {
            this.cloudflarePlayer.destroy();
          } catch (e) {
            console.warn('Cloudflare player destroy error:', e);
          }
          this.cloudflarePlayer = null;
        }
        
        // Remove existing video element if present
        if (this.video && this.video.parentNode) {
          this.video.style.display = 'none';
        }
        
        // Create Cloudflare iframe wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'cloudflare-stream-wrapper';
        wrapper.style.cssText = 'position:relative;padding-top:56.25%;width:100%;height:0;background:#000;';
        wrapper.id = `cloudflare-wrapper-${content.id}`;
        
        const iframe = document.createElement('iframe');
        iframe.id = `cloudflare-player-${content.id}`;
        iframe.src = `https://iframe.videodelivery.net/${content.provider_video_id}?preload=true&autoplay=true`;
        iframe.style.cssText = 'border:none;position:absolute;top:0;left:0;width:100%;height:100%;';
        iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.setAttribute('loading', 'eager');
        iframe.setAttribute('playsinline', 'true');
        
        wrapper.appendChild(iframe);
        
        // Replace container content with wrapper
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
        this.container.style.position = 'relative';
        this.container.style.background = '#000';
        
        this.cloudflareIframe = iframe;
        
        // Initialize Cloudflare Stream player
        this.cloudflarePlayer = window.Stream(iframe);
        this.isCloudflareStream = true;
        this._cloudflareInitialized = true;
        
        console.log('✅ Cloudflare Stream player initialized');
        
        // Setup event listeners on Cloudflare player
        this._setupCloudflareEventListeners();
        
        // If autoplay is enabled, attempt to play
        if (this.config.autoplay) {
          try {
            await this.cloudflarePlayer.play();
            this.isPlaying = true;
            this._emit('play', { contentId: this.contentId });
          } catch (e) {
            console.warn('Cloudflare autoplay blocked:', e);
            this._emit('autoplay:blocked', { error: e });
          }
        }
        
        this._emit('loaded', { 
          contentId: this.contentId,
          provider: 'cloudflare_stream',
          providerVideoId: content.provider_video_id
        });
        
      } catch (error) {
        console.error('❌ Cloudflare Stream load failed:', error);
        this._handleError({ type: 'cloudflare_load', error });
        throw error;
      }
    }
    
    _setupCloudflareEventListeners() {
      if (!this.cloudflarePlayer) return;
      
      // Play event
      this.cloudflarePlayer.addEventListener('play', () => {
        this.isPlaying = true;
        this.playbackStartTime = Date.now();
        this.stats.playCount++;
        this._emit('play', { contentId: this.contentId });
        this._scheduleControlsHide();
        this._initializeTelemetrySession();
      });
      
      // Pause event
      this.cloudflarePlayer.addEventListener('pause', () => {
        this.isPlaying = false;
        if (this.playbackStartTime) {
          this.stats.totalWatchTime += Date.now() - this.playbackStartTime;
          this.playbackStartTime = null;
        }
        this._emit('pause', { contentId: this.contentId });
        this._showControls();
      });
      
      // Time update - bridge to our engagement system
      this.cloudflarePlayer.addEventListener('timeupdate', () => {
        const currentTime = this.cloudflarePlayer.currentTime || 0;
        const duration = this.cloudflarePlayer.duration || 0;
        
        // Emit for external listeners
        this._emit('timeupdate', { 
          currentTime, 
          duration, 
          contentId: this.contentId 
        });
        
        // Check view threshold
        if (!this.viewRecorded && currentTime > 0) {
          const threshold = this._getDynamicViewThreshold();
          if (currentTime >= threshold && !this._viewThresholdReached) {
            this._viewThresholdReached = true;
            this._recordViewViaRPC(Math.floor(currentTime));
          }
        }
        
        // Update UI (using existing methods)
        this._updateTimeDisplay();
        this._updateProgressBar();
      });
      
      // Ended - trigger playlist progression
      this.cloudflarePlayer.addEventListener('ended', () => {
        this.isPlaying = false;
        console.log('🏁 Cloudflare Stream ended');
        
        // Emit ended event for our system
        this._emit('ended', { 
          contentId: this.contentId,
          duration: this.cloudflarePlayer.duration || 0
        });
        
        // Direct call to playlist progression
        if (typeof window.playNextPlaylistItem === 'function') {
          console.log('🎬 Invoking window.playNextPlaylistItem() from Cloudflare ended');
          window.playNextPlaylistItem();
        }
        
        this._emit('playback:ended', {
          totalWatchTime: this.stats.totalWatchTime,
          duration: this.cloudflarePlayer.duration || 0,
          contentId: this.contentId
        });
      });
      
      // Error event
      this.cloudflarePlayer.addEventListener('error', (e) => {
        console.error('❌ Cloudflare Stream error:', e);
        this._handleError({ type: 'cloudflare_error', error: e });
        this._emit('error', { error: e });
      });
      
      // Progress/buffering
      this.cloudflarePlayer.addEventListener('progress', () => {
        const buffered = this.cloudflarePlayer.buffered;
        if (buffered && buffered.length > 0) {
          this._emit('progress', { 
            buffered: buffered.end(buffered.length - 1),
            contentId: this.contentId
          });
        }
      });
      
      console.log('✅ Cloudflare Stream event listeners setup complete');
    }
    
    // =====================================================
    // ☁️ CLOUDFLARE R2 LOADER (Branch B - Audio)
    // =====================================================
    
    async _loadCloudflareR2(content) {
      console.log('☁️ Loading Cloudflare R2 audio content:', content.file_url);
      
      // Ensure video element exists
      if (!this.video) {
        console.warn('⚠️ No video element for R2 audio, creating one');
        this._createVideoElement();
      }
      
      if (!this.video) {
        console.error('❌ Could not create video element for R2 audio');
        return;
      }
      
      // Reset video element
      this.video.style.display = 'block';
      this.video.controls = false;
      this.video.classList.add('audio-mode');
      
      // Set audio source
      this.video.src = content.file_url;
      this.video.type = this.getMediaMimeType(content.file_url);
      this.video.load();
      
      this.isCloudflareStream = false;
      this._cloudflareInitialized = false;
      
      // Apply audio mode
      this._applyAudioMode();
      
      // Setup standard video event listeners
      this._setupEventListeners();
      
      // If autoplay is enabled, attempt to play
      if (this.config.autoplay) {
        try {
          await this.video.play();
          this.isPlaying = true;
          this._emit('play', { contentId: this.contentId });
        } catch (e) {
          console.warn('R2 audio autoplay blocked:', e);
          this._emit('autoplay:blocked', { error: e });
        }
      }
      
      this._emit('loaded', { 
        contentId: this.contentId,
        provider: 'cloudflare_r2',
        fileUrl: content.file_url
      });
      
      console.log('✅ Cloudflare R2 audio loaded');
    }
    
    // =====================================================
    // ☁️ FALLBACK LOADER (Branch C)
    // =====================================================
    
    async _loadFallback(content) {
      console.log('📁 Loading fallback content:', content.file_url);
      
      if (!this.video) {
        console.warn('⚠️ No video element for fallback, creating one');
        this._createVideoElement();
      }
      
      if (!this.video) {
        console.error('❌ Could not create video element for fallback');
        return;
      }
      
      this.video.style.display = 'block';
      this.video.classList.remove('audio-mode');
      
      // Set video source
      this.video.src = content.file_url;
      this.video.type = this.getMediaMimeType(content.file_url);
      this.video.load();
      
      this.isCloudflareStream = false;
      this._cloudflareInitialized = false;
      
      // Setup standard video event listeners
      this._setupEventListeners();
      
      if (this.config.autoplay) {
        try {
          await this.video.play();
          this.isPlaying = true;
          this._emit('play', { contentId: this.contentId });
        } catch (e) {
          console.warn('Fallback autoplay blocked:', e);
          this._emit('autoplay:blocked', { error: e });
        }
      }
      
      this._emit('loaded', { 
        contentId: this.contentId,
        provider: 'fallback',
        fileUrl: content.file_url
      });
      
      console.log('✅ Fallback content loaded');
    }
    
    // =====================================================
    // VIDEO ELEMENT CREATION HELPERS
    // =====================================================
    
    _createContainer() {
      this.container = document.createElement('div');
      this.container.className = 'enhanced-video-container';
      this.container.style.cssText = 'position:relative;width:100%;background:#000;';
      
      const target = document.getElementById('inlinePlayer');
      if (target) {
        target.appendChild(this.container);
      } else {
        document.body.appendChild(this.container);
      }
    }
    
    _createVideoElement() {
      const video = document.createElement('video');
      video.id = 'inlineVideoPlayer';
      video.className = 'enhanced-video-player';
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = this.config.preload;
      video.muted = this.config.muted;
      
      if (!this.container) {
        this._createContainer();
      }
      
      this.container.innerHTML = '';
      this.container.appendChild(video);
      this.video = video;
      
      return video;
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
    
    /**
     * 🚨 FIX #8: Calculate dynamic threshold based on video duration
     */
    _getDynamicViewThreshold() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const duration = this.cloudflarePlayer.duration || 0;
        if (duration <= 0) return this.config.minViewThresholdSeconds;
        const thirtyPercentDuration = duration * this.config.percentageViewThreshold;
        return Math.max(3, Math.min(this.config.minViewThresholdSeconds, thirtyPercentDuration));
      }
      
      if (!this.video) return this.config.minViewThresholdSeconds;
      const duration = this.video.duration || 0;
      if (duration <= 0) return this.config.minViewThresholdSeconds;
      const thirtyPercentDuration = duration * this.config.percentageViewThreshold;
      return Math.max(3, Math.min(this.config.minViewThresholdSeconds, thirtyPercentDuration));
    }
    
    // =====================================================
    // ATTACHMENT & INITIALIZATION
    // =====================================================
    
    attach(videoElement, container, options = {}) {
      if (this._isDestroyed) {
        console.warn('⚠️ Cannot attach: player has been destroyed');
        return Promise.reject(new Error('Player destroyed'));
      }
      
      if (!videoElement && !container) {
        throw new Error('Video element or container is required');
      }
      
      if (this._isAttached && this.video === videoElement) {
        console.log('ℹ️ Player already attached to this element');
        return Promise.resolve(this);
      }
      
      if (this._isAttached) {
        console.log('🔄 Cleaning up previous attachment');
        this._cleanupAttachment();
      }
      
      this.video = videoElement || null;
      this.container = container || videoElement?.parentElement || null;
      
      if (options.contentId) this.contentId = options.contentId;
      if (options.content) {
        this.content = options.content;
        this.streamingProvider = options.content.streaming_provider || null;
        this.providerVideoId = options.content.provider_video_id || null;
        this.fileUrl = options.content.file_url || null;
      }
      if (options.contentMetadata) this.contentMetadata = options.contentMetadata;
      if (options.collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...options.collectionContext };
      }
      
      // If we have content, load it
      if (this.content) {
        this.loadContent(this.content);
      } else {
        // Fallback to legacy behavior
        this._preserveSource();
        this._configureVideoElement();
        this._applyAudioMode();
        this._createControls();
        this._setupEventListeners();
        this._setupControlInteractions();
        this._initializeIntegrations();
        this._restoreAndLoadSource();
      }
      
      this._isAttached = true;
      
      console.log('✅ EnhancedVideoPlayer attached', {
        contentId: this.contentId,
        streamingProvider: this.streamingProvider,
        mediaType: this.detectMediaType(this._sourcePreserved?.url)
      });
      
      this._emit('player:attached', {
        contentId: this.contentId,
        container: this.container,
        streamingProvider: this.streamingProvider,
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
      const isAudio = this._isAudioContent();
      
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
            <button class="control-btn volume-btn player-volume-btn" 
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
          <button class="control-btn prev-track-btn player-prev-btn" 
                  title="Previous (P)"
                  aria-label="Play previous item">
            <i class="fas fa-step-backward" aria-hidden="true"></i>
          </button>
          <button class="control-btn next-track-btn player-next-btn" 
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
        errorOverlay: this.controls.querySelector('.error-overlay')
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
      if (this.isCloudflareStream) return; // Cloudflare uses its own listeners
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
    
    _handleEnded() {
      this.isPlaying = false;
      this._updatePlayButton(false);
      
      console.log('🏁 Media playback completed. Emitting ended event for external handler.');
      
      this._emit('mediaEnded', {
        contentId: this.contentId,
        playlistIndex: window.currentPlaylistIndex,
        currentTime: this.video ? this.video.currentTime : 0,
        duration: this.video ? this.video.duration : 0
      });
      
      if (typeof window.playNextPlaylistItem === 'function') {
        console.log('🎬 Invoking window.playNextPlaylistItem() (delegated to content-detail.js)');
        window.playNextPlaylistItem();
      } else {
        console.log('🎵 No playlist controller bound to window - auto-advance disabled');
      }
      
      this._emit('playback:ended', {
        totalWatchTime: this.stats.totalWatchTime,
        duration: this.video ? this.video.duration : 0,
        contentId: this.contentId
      });
    }
    
    _handleTimeUpdate() {
      this._updateTimeDisplay();
      this._updateProgressBar();
      
      if (!this.viewRecorded && this.video && this.video.currentTime > 0) {
        const dynamicThreshold = this._getDynamicViewThreshold();
        if (this.video.currentTime >= dynamicThreshold && !this._viewThresholdReached) {
          this._viewThresholdReached = true;
          this._recordViewViaRPC();
        }
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
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const current = this._formatTime(this.cloudflarePlayer.currentTime || 0);
        if (this._controlsCache && this._controlsCache.currentTime) {
          this._controlsCache.currentTime.textContent = current;
        }
        return;
      }
      
      if (!this._controlsCache || !this._controlsCache.currentTime || !this.video) return;
      const current = this._formatTime(this.video.currentTime);
      this._controlsCache.currentTime.textContent = current;
    }
    
    _updateDurationDisplay() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const duration = this.cloudflarePlayer.duration || 0;
        if (duration && isFinite(duration)) {
          if (this._controlsCache && this._controlsCache.duration) {
            this._controlsCache.duration.textContent = this._formatTime(duration);
          }
        }
        return;
      }
      
      if (!this._controlsCache || !this._controlsCache.duration || !this.video) return;
      const duration = this.video.duration;
      if (duration && isFinite(duration)) {
        this._controlsCache.duration.textContent = this._formatTime(duration);
      }
    }
    
    _updateProgressBar() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const currentTime = this.cloudflarePlayer.currentTime || 0;
        const duration = this.cloudflarePlayer.duration || 0;
        if (this._controlsCache && this._controlsCache.progressBar && duration > 0) {
          const percent = (currentTime / duration) * 100;
          this._controlsCache.progressBar.value = percent;
          this._controlsCache.progressBar.setAttribute('aria-valuenow', Math.round(percent));
        }
        return;
      }
      
      if (!this._controlsCache || !this._controlsCache.progressBar || !this.video) return;
      const { currentTime, duration } = this.video;
      if (duration && isFinite(duration)) {
        const percent = (currentTime / duration) * 100;
        this._controlsCache.progressBar.value = percent;
        this._controlsCache.progressBar.setAttribute('aria-valuenow', Math.round(percent));
      }
    }
    
    _updateBufferedProgress() {
      if (this.isCloudflareStream) return;
      if (!this._controlsCache || !this._controlsCache.progressBuffer || !this.video) return;
      const { buffered, duration } = this.video;
      if (duration && isFinite(duration) && buffered && buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const percent = (end / duration) * 100;
        this._controlsCache.progressBuffer.style.width = `${percent}%`;
      }
    }
    
    _updateVolumeUI() {
      if (this.isCloudflareStream) return;
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
      if (this.isCloudflareStream) return;
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
      if (this.isCloudflareStream) {
        console.warn('⚠️ setSource called on Cloudflare Stream player - use loadContent() instead');
        return Promise.resolve();
      }
      
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
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      
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
      
      if (this.video) this.video.load();
      
      this._sourcePreserved = { url, type, method: 'setSource' };
      
      console.log('✅ Source changed:', { url, contentId });
      this._emit('source:changed', { url, contentId, type });
      
      return Promise.resolve();
    }
    
    /**
     * 🚨 CRITICAL: Load source without destroying player instance
     * Used for playlist track changes to preserve player state
     */
    loadSource(sourceConfig) {
      if (this.isCloudflareStream) {
        console.warn('⚠️ loadSource called on Cloudflare Stream player - use loadContent() instead');
        return Promise.resolve();
      }
      
      if (!this.video) return Promise.reject('Player not attached');
      if (!sourceConfig || !sourceConfig.url) return Promise.reject('Invalid source config');
      
      const url = sourceConfig.url;
      const type = sourceConfig.type || this.getMediaMimeType(url);
      const contentId = sourceConfig.contentId || this.contentId;
      
      console.log('🔄 Loading new source without destroying player:', { url, contentId });
      
      if (contentId && contentId !== this.contentId) {
        this.updateContentId(contentId);
      }
      
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      
      this.video.pause();
      
      while (this.video.firstChild) {
        this.video.removeChild(this.video.firstChild);
      }
      this.video.removeAttribute('src');
      
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      this.video.appendChild(source);
      
      this.video.load();
      
      if (document.body.classList.contains('user-interacted')) {
        this.play().catch(err => {
          console.warn('Auto-play after source change blocked:', err);
          this._showPlayOverlay();
        });
      }
      
      this._sourcePreserved = { url, type, method: 'loadSource' };
      
      this._emit('source:loaded', { url, contentId, type });
      
      return Promise.resolve();
    }
    
    // =====================================================
    // UPDATE CONTENT ID
    // =====================================================
    
    updateContentId(newContentId) {
      if (this.contentId === newContentId) {
        console.log('⚠️ Player contentId unchanged:', newContentId);
        return;
      }
      
      console.log(`🔄 Player contentId updated: ${this.contentId} -> ${newContentId}`);
      this.contentId = newContentId;
      
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      this.viewValidated = false;
      
      if (this.watchSession && typeof this.watchSession.updateContentId === 'function') {
        this.watchSession.updateContentId(newContentId);
      }
      
      this._emit('content:changed', { contentId: newContentId });
    }
    
    /**
     * 🚨 Sync engagement state with UI
     */
    syncEngagementState(engagementData) {
      if (engagementData) {
        if (engagementData.isLiked !== undefined) this.engagement.isLiked = engagementData.isLiked;
        if (engagementData.isFavorited !== undefined) this.engagement.isFavorited = engagementData.isFavorited;
        if (engagementData.views !== undefined) this.engagement.views = engagementData.views;
        if (engagementData.likes !== undefined) this.engagement.likes = engagementData.likes;
      }
      
      this._emit('engagement:synced', { engagement: this.engagement });
    }
    
    // =====================================================
    // PLAYBACK CONTROLS (Abstracted for both modes)
    // =====================================================
    
    async safePlay() {
      if (this._isDestroyed) {
        return Promise.reject('Player destroyed');
      }
      
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        try {
          await this.cloudflarePlayer.play();
          this.isPlaying = true;
          this._emit('play', { contentId: this.contentId });
          return true;
        } catch (error) {
          console.warn('Cloudflare play error:', error);
          throw error;
        }
      }
      
      if (!this.video) {
        return Promise.reject('No video element');
      }
      
      try {
        await this.video.play();
        
        if (this.video.muted) {
          this.video.muted = false;
          this.config.muted = false;
        }
        
        console.log('▶️ Playback started successfully with unmuted audio');
        this._emit('playback:success', { method: 'direct' });
        return true;
        
      } catch (error) {
        console.warn('⚠️ Initial play blocked or failed:', error.message);
        
        if (this.video) {
          this.video.muted = true;
          this.config.muted = true;
        }
        
        try {
          if (this.video) {
            await this.video.play();
            console.log('✅ Playback recovered in muted mode');
            this._showPlayOverlay();
            this._emit('playback:audio-muted', { 
              reason: error.message,
              willRestoreOnInteraction: true 
            });
            return true;
          }
          throw new Error('Video element not available');
          
        } catch (retryError) {
          console.error('❌ Hard playback failure:', retryError);
          this._showPlayOverlay();
          this._emit('playback:fatal-error', { error: retryError });
          throw retryError;
        }
      }
    }
    
    async play() {
      return this.safePlay();
    }
    
    pause() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        this.cloudflarePlayer.pause();
        this.isPlaying = false;
        this._emit('pause', { contentId: this.contentId });
        return;
      }
      
      if (this.video && !this._isDestroyed) {
        this.video.pause();
      }
    }
    
    togglePlay() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        if (this.cloudflarePlayer.paused) {
          this.play().catch(() => {});
        } else {
          this.pause();
        }
        return;
      }
      
      if (!this.video || this._isDestroyed) return;
      if (this.video.paused) {
        this.play().catch(() => {});
      } else {
        this.pause();
      }
    }
    
    seek(time) {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        this.cloudflarePlayer.currentTime = time;
        this._emit('seeked', { time, contentId: this.contentId });
        return;
      }
      
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
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const current = this.cloudflarePlayer.currentTime || 0;
        this.seek(current + seconds);
        return;
      }
      
      if (!this.video || this._isDestroyed) return;
      this.seek(this.video.currentTime + seconds);
    }
    
    seekPercent(percent) {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const duration = this.cloudflarePlayer.duration || 0;
        this.seek((percent / 100) * duration);
        return;
      }
      
      if (!this.video || this._isDestroyed) return;
      const time = (percent / 100) * (this.video.duration || 0);
      this.seek(time);
    }
    
    setPlaybackRate(rate) {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        // Cloudflare Stream may support playbackRate, but it's not guaranteed
        if (this.cloudflarePlayer.playbackRate !== undefined) {
          const clamped = Math.max(0.25, Math.min(4, rate));
          this.cloudflarePlayer.playbackRate = clamped;
          this.playbackRate = clamped;
          console.log(`⚡ Cloudflare playback rate: ${clamped}x`);
          this._emit('playback:ratechange', { rate: clamped });
        } else {
          console.warn('⚠️ Cloudflare Stream playback rate not supported');
        }
        return;
      }
      
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
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        if (this.cloudflarePlayer.volume !== undefined) {
          const clamped = Math.max(0, Math.min(1, volume));
          this.cloudflarePlayer.volume = clamped;
          console.log(`🔊 Cloudflare volume: ${Math.round(clamped * 100)}%`);
          this._emit('playback:volumechange', { volume: clamped, muted: false });
        }
        return;
      }
      
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
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        const current = this.cloudflarePlayer.volume || 0.5;
        this.setVolume(current + delta);
        return;
      }
      
      if (!this.video || this._isDestroyed) return;
      this.setVolume(this.video.volume + delta);
    }
    
    toggleMute() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        if (this.cloudflarePlayer.muted !== undefined) {
          this.cloudflarePlayer.muted = !this.cloudflarePlayer.muted;
          this._emit('playback:mute', { muted: this.cloudflarePlayer.muted });
        }
        return;
      }
      
      if (!this.video || this._isDestroyed) return;
      if (this.video) {
        this.video.muted = !this.video.muted;
      }
      
      this._updateVolumeUI();
      console.log(`🔇 Mute: ${this.video ? this.video.muted : false}`);
      this._emit('playback:mute', { muted: this.video ? this.video.muted : false });
    }
    
    toggleFullscreen() {
      const target = this.container || this.video || this.cloudflareIframe;
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
      if (this.isCloudflareStream) {
        console.warn('⚠️ PiP not supported for Cloudflare Stream');
        return;
      }
      
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
    // QUALITY
    // =====================================================
    
    setQuality(quality) {
      if (this.isCloudflareStream) {
        console.log('☁️ Cloudflare Stream - quality switching handled internally');
        this.currentQuality = quality;
        this._emit('playback:quality-change', {
          from: this.currentQuality,
          to: quality,
          provider: 'cloudflare_stream'
        });
        return;
      }
      
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
    
    // =====================================================
    // NAVIGATION
    // =====================================================
    
    playPrevious() {
      console.log('⏮️ Playing previous item...');
      
      if (typeof window.playPreviousPlaylistItem === 'function') {
        window.playPreviousPlaylistItem();
        return;
      }
      
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
      
      if (typeof window.playNextPlaylistItem === 'function') {
        window.playNextPlaylistItem();
        return;
      }
      
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
    
    // =====================================================
    // TELEMETRY
    // =====================================================
    
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
            minViewThreshold: this.config.minViewThresholdSeconds,
            percentageViewThreshold: this.config.percentageViewThreshold,
            collectionId: this.collectionContext.collectionId,
            playlistId: this.collectionContext.playlistId,
            sortIndex: this.collectionContext.currentSortIndex,
            episodeNumber: this.collectionContext.episodeNumber,
            onViewRecorded: (data) => {
              this.viewRecorded = true;
              console.log('✅ View recorded via telemetry');
              this._emit('telemetry:view-recorded', data);
            },
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
          
          if (this.isCloudflareStream && this.cloudflarePlayer) {
            this.watchSession.start(null, this);
          } else if (this.video) {
            this.watchSession.start(this.video);
          }
          
          console.log('🎬 WatchSession initialized for telemetry');
          
        } catch (error) {
          console.warn('⚠️ Failed to initialize WatchSession:', error);
        }
      }
    }
    
    async _recordViewViaRPC(progressSeconds) {
      if (this.viewRecorded || !this.supabase || !this.contentId) return;
      
      this.viewRecorded = true;
      const currentProgress = progressSeconds || (this.isCloudflareStream ? 
        Math.floor(this.cloudflarePlayer?.currentTime || 0) : 
        Math.floor(this.video?.currentTime || 30));
      const dynamicThreshold = this._getDynamicViewThreshold();
      
      console.log(`👁️ View threshold reached (${dynamicThreshold}s), recording via RPC for content ${this.contentId}...`);
      
      const success = await recordViewViaRPC(
        this.contentId,
        this.userId,
        this.playbackSessionId,
        currentProgress,
        this._isMobile ? 'mobile' : 'desktop'
      );
      
      if (success) {
        console.log('✅ View recorded via RPC successfully');
        this.engagement.views++;
      } else {
        console.warn('⚠️ View recording via RPC failed');
      }
      
      if (window.stateManager) {
        window.stateManager.markContentAsViewed(this.contentId, true);
      }
      
      this._emit('telemetry:view-recorded', {
        contentId: this.contentId,
        sessionId: this.playbackSessionId,
        progressSeconds: currentProgress,
        threshold: dynamicThreshold,
        timestamp: Date.now(),
        success: success
      });
    }
    
    // =====================================================
    // INTEGRATIONS
    // =====================================================
    
    _initializeIntegrations() {
      console.log('🔌 Integrations initialized');
    }
    
    // =====================================================
    // EVENT SYSTEM
    // =====================================================
    
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
    
    // =====================================================
    // UTILITY
    // =====================================================
    
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
    
    // =====================================================
    // CLEANUP & DESTROY
    // =====================================================
    
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
        this.watchSession.stop();
      }
      
      this.isPlaying = false;
      this.isBuffering = false;
      this.viewRecorded = false;
      this._viewThresholdReached = false;
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
      
      // Clean up Cloudflare Stream
      if (this.cloudflarePlayer) {
        try {
          this.cloudflarePlayer.destroy();
        } catch (e) {
          console.warn('Cloudflare player destroy error:', e);
        }
        this.cloudflarePlayer = null;
        this.cloudflareIframe = null;
      }
      
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
      this.cloudflareBridge = null;
      
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
        viewValidated: this.viewValidated,
        viewThreshold: this._getDynamicViewThreshold(),
        isCloudflareStream: this.isCloudflareStream,
        streamingProvider: this.streamingProvider
      };
    }
    
    getPlaybackState() {
      if (this.isCloudflareStream && this.cloudflarePlayer) {
        return {
          currentTime: this.cloudflarePlayer.currentTime || 0,
          duration: this.cloudflarePlayer.duration || 0,
          paused: this.cloudflarePlayer.paused !== false,
          volume: this.cloudflarePlayer.volume || 0.5,
          muted: this.cloudflarePlayer.muted || false,
          playbackRate: this.cloudflarePlayer.playbackRate || 1,
          buffered: null,
          isCloudflareStream: true
        };
      }
      
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
        } : null,
        isCloudflareStream: false
      };
    }
    
    isReady() {
      if (this.isCloudflareStream) {
        return this._cloudflareInitialized && this.cloudflarePlayer !== null;
      }
      return this._isAttached && !this._isDestroyed && this.video ? this.video.readyState >= 2 : false;
    }
  }
  
  // ====================================================
  // GLOBAL EXPORTS
  // ====================================================
  
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
  window.BantuVideoPlayer = EnhancedVideoPlayer;
  window._recordViewViaRPC = recordViewViaRPC;
  window.loadCloudflareStreamSDK = loadCloudflareStreamSDK;
  
  // 🎯 YOUTUBE-STYLE: Expose helper function for content-detail to register
  window._setupPlayerEndedCallback = function(callback) {
    if (typeof callback === 'function') {
      window._playerEndedCallback = callback;
      console.log('✅ Player ended callback registered (YouTube-style)');
    }
  };
  
  window.playPreviousPlaylistItem = window.playPreviousPlaylistItem || function() {
    console.log('⏮️ Default playPreviousPlaylistItem - override in content-detail.js');
  };
  
  window.playNextPlaylistItem = window.playNextPlaylistItem || function() {
    console.log('⏭️ Default playNextPlaylistItem - override in content-detail.js');
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
          window.enhancedVideoPlayer = player;
        } catch (error) {
          console.error('❌ Failed to auto-initialize player:', error);
        }
      }, 500);
    }
  });
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedVideoPlayer;
  }
  
  console.log('✅ EnhancedVideoPlayer module loaded successfully (v4.0.0 - Cloudflare Stream & R2)');
  console.log('   ☁️ CLOUDFLARE STREAM: Native iframe + SDK integration');
  console.log('   ☁️ CLOUDFLARE R2: Direct audio playback from custom domain');
  console.log('   🔧 Event bridging: timeupdate → watch session, ended → playlist progression');
  console.log('   🎯 Provider-based branching: cloudflare_stream, cloudflare_r2, fallback');
  console.log('   🔧 FIX #2: REMOVED fake audio restore system');
  console.log('   🔧 FIX #5: ADDED delegated event listeners for prev/next/volume');
  console.log('   🔧 FIX #6: REMOVED engagement buttons from player overlay');
  console.log('   🔧 FIX #8: SINGLE ended handler (no duplicates)');
  console.log('   🔧 CRITICAL: Player ONLY emits events, NEVER controls playlist');
  console.log('   🚨 FIX #1: RPC view recording integration');
  console.log('   🚨 FIX #2: contentId synchronization (updateContentId method)');
  console.log('   🚨 FIX #8: Dynamic threshold (min 15 sec or 30% of duration)');
  console.log('   🚨 loadSource method for non-destructive source changes');
  console.log('   Features: Telemetry, Collection Nav, Audio/Video Support, Mobile Optimization');
  console.log('   🎵 AUDIO RENDERER FIX: Automatic mute fallback for AUDIO_RENDERER_ERROR');
  console.log('   🎯 YOUTUBE-STYLE: Player ended event triggers window.playNextPlaylistItem()');
  console.log('   🎯 YOUTUBE-STYLE: Player does NOT own playlist logic - only fires event');
  console.log('   🔊 DESKTOP AUTOPLAY: Enhanced safePlay() with muted fallback');
  console.log('   🚀 Ready for production deployment with Cloudflare Integration');
  
})();
