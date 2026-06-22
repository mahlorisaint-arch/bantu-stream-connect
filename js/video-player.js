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
// 🔧 VERSION: v3.3.4 - Guard Clause Propagation Trap Fix
// ============================================
// ☁️ CLOUDFLARE STREAM SUPPORT (2026-06-18):
// - Added _currentStreamingProvider tracking in constructor
// - Updated loadSource() to handle streamingProvider and isHLS params
// - Updated updateContentId() to sync provider info with streaming manager
// - Updated _handleEnded() to pass streamingProvider context in events
// ============================================
// 🎵 AUDIO SUPPORT (2026-06-18):
// - loadSource() now detects audio and loads directly to HTML5 media element
// - Detaches HLS for audio tracks to prevent fatal crashes
// - Uses safePlay() pattern for audio playback
// ============================================
// 🚨 CSS STATE ARCHITECTURE FIX (2026-06-21):
// - Added initializePlayerStateEngine() for automatic layer management
// - Uses .is-playing, .is-paused, .audio-active classes on wrapper
// - State-driven CSS handles poster overlay visibility
// - Added guardedVideoContainerClick() to prevent control clicks from pausing
// - Clean separation of concerns: CSS manages layers, JS manages state
// ============================================
// 🚨 NUCLEAR DIAGNOSTIC ENGINE (2026-06-21):
// - Emergency force-correction loop runs every 500ms
// - Bypasses script initialization crashes
// - Injects inline CSS overrides to force-show controls and hide overlays
// - Capture-phase event listeners for mobile touch protection
// - Logs exact computed styles to identify blockers
// ============================================
// 🛡️ SAFE-GUARD COMPATIBILITY (2026-06-21):
// - Enhanced loadSource to handle both object and direct parameter calls
// - Supports window.EnhancedVideoPlayer.loadSource(videoUrl, thumbnailUrl) pattern
// - Maintains backward compatibility with existing loadSource usage
// - Ensures poster overlay updates without destroying DOM
// ============================================
// 🎯 CROSS-DEVICE CONTROL FIX (2026-06-22):
// - Converted document-level delegation to scoped wrapper capture-phase listeners
// - Bypasses parent pause guards for immediate control execution
// - Mobile Safari event drop-off protection via capture phase
// - MutationObserver ensures mobile-compatible controls survive DOM updates
// ============================================
// 🔍 THE GUARD CLAUSE PROPAGATION TRAP FIX (2026-06-22):
// - Refactored guardedVideoContainerClick() to return early without stopping propagation
// - Control clicks now bubble naturally to button handlers
// - Added _bindMobileTouchControls() for iOS/Android tap compatibility
// - Controls remain interactive while background clicks still toggle play/pause
// - Fixes failure across Android, iOS, Tablets, and Desktops
// ============================================
// 🌉 ORPHANED CONTROLS BRIDGE (2026-06-22):
// - Global document-level delegation bridge for controls outside player wrapper
// - Bypasses "ORPHANED LAYOUT DETECTED" issue where buttons live outside wrapper
// - Uses .closest() to defeat FontAwesome icon trap
// - Routes interactions directly to player instance methods
// - Decouples click capture from component layout boundaries
// - Permanent fix for controls that exist outside structural wrapper
// ============================================
// 🚀 NUCLEAR BRIDGE V2 (2026-06-22):
// - Structural Ancestral Force Loop for full-screen stacking priority
// - Background canvas/poster demotion rules
// - Ancestral upward traversal from controls to full-screen root
// - Dynamic inline style overrides for mutation resistance
// - Audio mode poster overlay stacking fix
// ============================================

(function() {
  'use strict';
  
  console.log('🎬 EnhancedVideoPlayer module loading... (v3.3.4 - Guard Clause Propagation Trap Fix)');

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
   * This function delegates to the centralized RPC system
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

  // ============================================
  // 🚨 CRITICAL FIX: State Wrapper Engine
  // Manages player state classes for automatic layer control
  // ============================================

  /**
   * Initialize the player state engine
   * Binds state classes to play/pause events for automatic layer management
   */
  function initializePlayerStateEngine() {
    console.log('🔧 Initializing player state engine...');
    
    const wrapper = document.querySelector('.video-container') || document.querySelector('.video-player-wrapper');
    const videoElement = document.getElementById('inlineVideoPlayer');
    
    if (!wrapper || !videoElement) {
      console.warn('⚠️ Player wrapper or video element not found for state engine');
      return;
    }
    
    // Ensure wrapper has the base class
    wrapper.classList.add('video-player-wrapper');
    wrapper.classList.remove('is-playing');
    wrapper.classList.add('is-paused');
    
    // ============================================
    // STATE LISTENERS
    // ============================================
    
    // 🚀 When the media begins actively moving
    const handlePlaybackStarted = () => {
      console.log('🚀 State Engine: Playback started. Removing visual blockades.');
      wrapper.classList.remove('is-paused');
      wrapper.classList.add('is-playing');
      wrapper.classList.remove('audio-active');
    };
    
    // ⏸️ When the user or system pauses the media
    const handlePlaybackPaused = () => {
      console.log('⏸️ State Engine: Playback paused.');
      wrapper.classList.remove('is-playing');
      wrapper.classList.add('is-paused');
    };
    
    // 🏁 When content ends completely
    const handlePlaybackEnded = () => {
      console.log('🏁 State Engine: Video ended. Resetting wrapper state.');
      wrapper.classList.remove('is-playing');
      wrapper.classList.add('is-paused');
      
      // Bring the poster back only when the track is completely finished
      const posterOverlay = document.getElementById('customPosterOverlay') || document.querySelector('.player-poster-overlay');
      if (posterOverlay) {
        // Reset to base CSS rules
        posterOverlay.style.removeProperty('opacity');
        posterOverlay.style.removeProperty('visibility');
        posterOverlay.style.removeProperty('display');
        posterOverlay.style.removeProperty('z-index');
        console.log('🖼️ State Engine: Poster overlay reset for ended state');
      }
    };
    
    // 🎵 Handle audio mode detection
    const handleLoadedMetadata = () => {
      const isAudio = videoElement.classList.contains('audio-mode') || 
                      wrapper.classList.contains('audio-active') ||
                      (videoElement.src && (videoElement.src.includes('.mp3') || videoElement.src.includes('.wav')));
      
      if (isAudio) {
        console.log('🎵 State Engine: Audio mode detected. Keeping overlay visible.');
        wrapper.classList.add('audio-active');
        wrapper.classList.remove('is-playing');
        wrapper.classList.add('is-paused');
      }
    };
    
    // Remove existing listeners to prevent duplicates
    videoElement.removeEventListener('play', handlePlaybackStarted);
    videoElement.removeEventListener('playing', handlePlaybackStarted);
    videoElement.removeEventListener('pause', handlePlaybackPaused);
    videoElement.removeEventListener('ended', handlePlaybackEnded);
    videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Add the state listeners
    videoElement.addEventListener('play', handlePlaybackStarted);
    videoElement.addEventListener('playing', handlePlaybackStarted);
    videoElement.addEventListener('pause', handlePlaybackPaused);
    videoElement.addEventListener('ended', handlePlaybackEnded);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    console.log('✅ Player state engine initialized');
  }

  // ============================================
  // 🚨 CRITICAL FIX: Guarded Video Container Click Handler
  // 🔍 THE GUARD CLAUSE PROPAGATION TRAP FIX
  // Prevents control bar clicks from triggering play/pause WITHOUT stopping propagation
  // ============================================

  /**
   * Setup guarded video container click handler
   * Prevents clicks on controls, buttons, and overlays from triggering play/pause
   * Uses return early pattern instead of stopPropagation to allow event bubbling
   */
  function setupGuardedVideoClickHandler() {
    const videoContainer = document.querySelector('.video-container') || document.querySelector('.video-player-wrapper');
    const videoElement = document.getElementById('inlineVideoPlayer');
    
    if (!videoContainer || !videoElement) {
      console.warn('⚠️ Video container or element not found for click handler');
      return;
    }
    
    // Remove any existing click listeners to prevent duplicates
    videoContainer.removeEventListener('click', guardedVideoContainerClick);
    
    // Add the guarded click handler
    videoContainer.addEventListener('click', guardedVideoContainerClick);
    console.log('✅ Guarded video container click handler attached');
  }

  /**
   * 🚨 CRITICAL FIX: Guarded click handler with proper event propagation
   * 
   * 🔍 THE GUARD CLAUSE PROPAGATION TRAP FIX:
   * - When a control is clicked, the guard returns early WITHOUT stopping propagation
   * - This allows the event to bubble naturally to button handlers
   * - The background click still toggles play/pause when no control is clicked
   * - Fixes failure across Android, iOS, Tablets, and Desktops
   */
  function guardedVideoContainerClick(e) {
    // 1. Identify all interactive control element classes and selectors
    const controlSelectors = [
      '.video-controls', '.player-controls', '.control-btn', 
      '.play-pause-btn', '.player-play-btn',
      '.prev-track-btn', '.player-prev-btn', 
      '.next-track-btn', '.player-next-btn', 
      '.volume-btn', '.player-volume-btn', 
      '.volume-bar', '.progress-bar', 
      '.settings-btn', '.fullscreen-btn', '.pip-btn',
      '.enhanced-video-controls', '.controls-bar',
      '.custom-controls-container', '.vjs-control-bar',
      '.settings-menu', '.quality-option', '.speed-option',
      '.toggle-switch', '[data-action]'
    ].join(',');

    // 2. Check if the click originated from or passed through a control item
    if (e.target.closest(controlSelectors)) {
      console.log("🎯 Guard Pass-Through: Control element detected. Forwarding event to button handlers.");
      
      // 🔍 CRITICAL FIX: Remove e.stopPropagation(), e.stopImmediatePropagation(), and e.preventDefault()
      // Simply return early so the background surface doesn't toggle play/pause,
      // allowing the event to bubble up unhindered to your control listeners.
      return;
    }

    // 3. Process actual background surface taps
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    if (videoElement.paused) {
      console.log('🎯 Surface tap: Playing video');
      // Use safePlay if available, otherwise direct play
      if (typeof window.safePlay === 'function') {
        window.safePlay();
      } else if (typeof window.startPlaybackFromUserGesture === 'function') {
        window.startPlaybackFromUserGesture();
      } else {
        videoElement.play().catch(err => console.warn('Play blocked:', err));
      }
    } else {
      console.log('🎯 Surface tap: Pausing video');
      videoElement.pause();
    }
  }

  // ============================================
  // 📱 MOBILE TOUCH COMPATIBILITY
  // Ensures iOS/Android taps work on non-standard tags
  // ============================================

  /**
   * Bind mobile touch controls to ensure responsiveness on iOS and Android
   * Applies hardware interaction markers and direct touchstart bindings
   */
  function _bindMobileTouchControls() {
    const wrapper = document.querySelector('.video-container') || document.querySelector('.video-player-wrapper');
    if (!wrapper) return;

    console.log('📱 Binding mobile touch controls for iOS/Android compatibility...');

    // Apply hardware interaction markers for mobile rendering layers
    const optimizeElements = () => {
      wrapper.querySelectorAll('.prev-track-btn, .next-track-btn, .volume-btn, .play-pause-btn, .fullscreen-btn, .settings-btn, .pip-btn').forEach(btn => {
        btn.style.cursor = 'pointer';
        btn.style.touchAction = 'manipulation'; // Eliminates the native 300ms mobile tap delay
        if (!btn.getAttribute('role')) {
          btn.setAttribute('role', 'button');
        }
        if (!btn.getAttribute('aria-label')) {
          btn.setAttribute('aria-label', btn.title || 'Control button');
        }
      });
    };
    optimizeElements();

    // Directly bind touchstart to short-circuit mobile event drop-off behaviors
    wrapper.querySelectorAll('.prev-track-btn, .next-track-btn, .volume-btn, .play-pause-btn, .fullscreen-btn, .settings-btn, .pip-btn').forEach(btn => {
      // Prevent duplicate bindings if initialized multiple times
      if (btn.toetipsBound) return;
      btn.toetipsBound = true;

      btn.addEventListener('touchstart', (e) => {
        console.log("📱 Mobile Touch Engine: Fast-track hardware tap caught.");
        // Synthesize a clean click target event for your delegation layers
        btn.click();
      }, { passive: true });
    });

    console.log('✅ Mobile touch controls bound successfully');
  }

  // ============================================
  // 🌉 ORPHANED CONTROLS BRIDGE (Global Delegation)
  // Permanent fix for controls that exist outside the player wrapper
  // Bypasses "ORPHANED LAYOUT DETECTED" architectural issue
  // ============================================

  /**
   * Deploy a global document-level bridge to catch orphaned controls
   * These are buttons that exist outside the structural player wrapper
   * Uses .closest() to defeat the FontAwesome icon trap
   * Routes interactions directly to the player instance
   * Decouples click capture from component layout boundaries
   */
  function _setupOrphanedControlsBridge() {
    console.log("🌉 PLAYER ENGINE: Deploying Global Bridge for external/orphaned controls...");

    // Store the player instance reference
    let playerInstance = window.bantuPlayer || window.enhancedVideoPlayer;

    // Watch for player instance changes
    const instanceObserver = new MutationObserver(() => {
      const newInstance = window.bantuPlayer || window.enhancedVideoPlayer;
      if (newInstance !== playerInstance) {
        playerInstance = newInstance;
        console.log('🌉 Bridge: Player instance updated');
      }
    });
    instanceObserver.observe(document.documentElement, { attributes: false, childList: true, subtree: true });

    // Bind directly to document to catch events that bypass the player wrapper
    document.addEventListener('click', (e) => {
      // If no player instance, log and skip
      if (!playerInstance) {
        console.warn('🌉 Bridge: No player instance available');
        return;
      }

      // Safe check: If the video element is destroyed, abort
      if (!playerInstance.video) {
        console.warn('🌉 Bridge: Player video element not available');
        return;
      }

      // Resolve targets cleanly using .closest() to bypass the FontAwesome icon trap
      const playPauseBtn = e.target.closest('.play-pause-btn, .player-play-btn');
      const prevBtn      = e.target.closest('.prev-track-btn, .player-prev-btn');
      const nextBtn      = e.target.closest('.next-track-btn, .player-next-btn');
      const settingsBtn  = e.target.closest('.settings-btn');
      const fullscreenBtn = e.target.closest('.fullscreen-btn');
      const volumeBtn    = e.target.closest('.volume-btn, .player-volume-btn');
      const pipBtn       = e.target.closest('.pip-btn');

      // Route interactions directly to player instance methods
      if (playPauseBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Play/Pause Toggle");
        if (typeof playerInstance.togglePlay === 'function') {
          playerInstance.togglePlay();
        } else if (playerInstance.video) {
          if (playerInstance.video.paused) {
            playerInstance.video.play().catch(err => console.warn('Play blocked:', err));
          } else {
            playerInstance.video.pause();
          }
        }
        return;
      }

      if (nextBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Next Track");
        if (typeof window.playNextPlaylistItem === 'function') {
          window.playNextPlaylistItem();
        } else if (typeof playerInstance.playNext === 'function') {
          playerInstance.playNext();
        } else {
          console.warn("⚠️ Next track triggered but no playlist coordinator found.");
        }
        return;
      }

      if (prevBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Previous Track");
        if (typeof window.playPreviousPlaylistItem === 'function') {
          window.playPreviousPlaylistItem();
        } else if (typeof playerInstance.playPrevious === 'function') {
          playerInstance.playPrevious();
        } else {
          console.warn("⚠️ Previous track triggered but no playlist coordinator found.");
        }
        return;
      }

      if (settingsBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Settings Menu");
        if (typeof playerInstance._toggleSettingsMenu === 'function') {
          playerInstance._toggleSettingsMenu();
        } else {
          // Fallback toggle layout class if it's purely CSS/DOM driven
          const menu = document.querySelector('.settings-menu, .player-settings-popup');
          if (menu) {
            const isVisible = menu.style.display === 'block';
            menu.style.display = isVisible ? 'none' : 'block';
            const btn = document.querySelector('.settings-btn');
            if (btn) {
              btn.setAttribute('aria-expanded', !isVisible);
            }
          }
        }
        return;
      }

      if (fullscreenBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Fullscreen Toggle");
        if (typeof playerInstance.toggleFullscreen === 'function') {
          playerInstance.toggleFullscreen();
        } else {
          // Fallback direct API execution
          const container = playerInstance.container || playerInstance.video.parentElement;
          if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
          } else {
            document.exitFullscreen();
          }
        }
        return;
      }

      if (volumeBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Volume/Mute Toggle");
        if (playerInstance.video) {
          playerInstance.video.muted = !playerInstance.video.muted;
          if (typeof playerInstance._updateVolumeUI === 'function') {
            playerInstance._updateVolumeUI();
          }
          if (typeof playerInstance._emit === 'function') {
            playerInstance._emit('playback:mute', { muted: playerInstance.video.muted });
          }
        }
        return;
      }

      if (pipBtn) {
        e.preventDefault();
        e.stopPropagation();
        console.log("⚡ Bridge Routed: Picture-in-Picture Toggle");
        if (typeof playerInstance.togglePictureInPicture === 'function') {
          playerInstance.togglePictureInPicture();
        }
        return;
      }
    });

    console.log('✅ Global Bridge for orphaned controls deployed successfully');
  }

  // ============================================
  // 🚀 NUCLEAR BRIDGE V2: Structural Ancestral Force Loop
  // ============================================

  /**
   * Deploy the Structural Ancestral Force Loop (V2)
   * This actively crawls upward from player buttons to full-screen root
   * Demotes posters/overlays and forces controls to the top layer
   */
  function _deployNuclearBridgeV2() {
    console.log("☢️ CRITICAL SYSTEM PATCH v2: Initializing Deep Layout, Poster Overrides & Ancestral Upward Traversal Force...");

    // Clear any previous interval instances to prevent memory accumulation leaks
    if (window.__bantuVisibilityForceInterval) {
      clearInterval(window.__bantuVisibilityForceInterval);
    }

    // 1. Inject Bulletproof Atomic CSS Overrides for Fullscreen Stacking
    const styleId = 'bantu-fullscreen-force-sheet';
    let styleSheet = document.getElementById(styleId);
    if (styleSheet) styleSheet.remove();

    styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = `
        /* Force root fullscreen element boundaries */
        :fullscreen, :-webkit-full-screen {
            position: relative !important;
            background: #000 !important;
            width: 100vw !important;
            height: 100vh !important;
            display: block !important;
        }

        /* Demote ALL background visuals, posters, overlays, canvases and media tags to base layer */
        :fullscreen video, :-webkit-full-screen video,
        :fullscreen audio, :-webkit-full-screen audio,
        :fullscreen img, :-webkit-full-screen img,
        :fullscreen [class*="poster" i], :-webkit-full-screen [class*="poster" i],
        :fullscreen [class*="overlay" i], :-webkit-full-screen [class*="overlay" i],
        :fullscreen [class*="thumbnail" i], :-webkit-full-screen [class*="thumbnail" i],
        :fullscreen [class*="canvas" i], :-webkit-full-screen [class*="canvas" i] {
            z-index: 1 !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
        }

        /* Prevent browser shadow-DOM overlays from intercepting events or drawing chrome */
        video::-webkit-media-controls,
        video::-webkit-media-controls-enclosure,
        video::-webkit-media-controls-panel {
            display: none !important;
            -webkit-appearance: none !important;
        }

        /* Pull target control systems and known wrappers to the absolute front */
        :fullscreen .player-controls, 
        :fullscreen .player-controls-wrapper,
        :fullscreen .control-bar,
        :fullscreen .video-controls,
        :fullscreen .controls-container,
        :-webkit-full-screen .player-controls,
        :-webkit-full-screen .player-controls-wrapper,
        :-webkit-full-screen .control-bar,
        :-webkit-full-screen .video-controls,
        :-webkit-full-screen .controls-container,
        .enhanced-video-player:fullscreen .controls,
        :fullscreen [class*="control-bar" i],
        :fullscreen [class*="controls-container" i] {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 2147483647 !important;
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 60px !important;
            background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 70%, transparent 100%) !important;
            pointer-events: auto !important;
        }
        
        /* Maintain system cursor state control */
        :fullscreen, :-webkit-full-screen {
            cursor: default !important;
        }
    `;
    document.head.appendChild(styleSheet);
    console.log("🎨 Full-spectrum structural CSS rules and poster demotions injected.");

    // 2. Continuous Ancestral Upward Traversal Engine
    window.__bantuForceVisibilityExecutionLoop = function() {
        const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fsElement) return;

        // Locate any core player interactive nodes inside full screen context
        const rootInteractiveNode = fsElement.querySelector(
            '.play-pause-btn, .player-play-btn, .fullscreen-btn, .video-controls, .player-controls, .control-bar, .controls-container, [class*="control-bar" i], [class*="controls-container" i]'
        );
        if (!rootInteractiveNode) return;

        // Find the wrapper element block for the controls grouping context
        let controlsContainer = rootInteractiveNode.classList.contains('play-pause-btn') || 
                                rootInteractiveNode.classList.contains('fullscreen-btn') || 
                                rootInteractiveNode.classList.contains('player-play-btn')
            ? rootInteractiveNode.parentElement 
            : rootInteractiveNode;

        if (!controlsContainer) return;

        // Force explicit placement styles directly onto the target UI wrapper row
        controlsContainer.style.setProperty('display', 'flex', 'important');
        controlsContainer.style.setProperty('visibility', 'visible', 'important');
        controlsContainer.style.setProperty('opacity', '1', 'important');
        controlsContainer.style.setProperty('z-index', '2147483647', 'important');
        controlsContainer.style.setProperty('position', 'absolute', 'important');
        controlsContainer.style.setProperty('bottom', '0', 'important');
        controlsContainer.style.setProperty('left', '0', 'important');
        controlsContainer.style.setProperty('width', '100%', 'important');
        controlsContainer.style.setProperty('pointer-events', 'auto', 'important');

        // Travel up the DOM tree from the controls component to the fullscreen root element node
        let current = controlsContainer.parentElement;
        while (current && current !== fsElement && current !== document.body) {
            // Drop state machine suppression classes on sight
            current.classList.remove('hidden', 'hide', 'd-none', 'controls-hidden', 'user-inactive', 'inactive', 'fade-out', 'js-hidden');
            
            // Override frame hiding mutations written directly to elements by video-player.js loops
            const currentComputedDisplay = window.getComputedStyle(current).display;
            if (currentComputedDisplay === 'none') {
                current.style.setProperty('display', 'block', 'important');
            }
            current.style.setProperty('visibility', 'visible', 'important');
            current.style.setProperty('opacity', '1', 'important');
            current.style.setProperty('z-index', '2147483646', 'important');
            current.style.setProperty('position', 'absolute', 'important');
            current.style.setProperty('inset', '0', 'important');
            current.style.setProperty('pointer-events', 'none', 'important'); // Allow clicking through empty intermediate spaces

            current = current.parentElement;
        }
    };

    // Initialize the tight structural state correction interval routine (Runs every 150ms during active playback loops)
    window.__bantuVisibilityForceInterval = setInterval(window.__bantuForceVisibilityExecutionLoop, 150);

    // Bind execution directly to window changes or fullscreen switches
    document.addEventListener('fullscreenchange', window.__bantuForceVisibilityExecutionLoop);
    window.addEventListener('resize', window.__bantuForceVisibilityExecutionLoop);

    // 3. Fallback Click Event Interceptor Integration Setup
    const nativeMedia = document.querySelector('video') || document.querySelector('audio');
    if (!nativeMedia) {
        console.error("❌ CRITICAL: No hardware media engine detected.");
        return;
    }

    if (window.__bantuFailSafeHandler) {
        document.removeEventListener('click', window.__bantuFailSafeHandler, true);
    }

    // Custom Floating PiP Interface Fallback for Audio Assets
    window.__triggerBantuFloatPlayer = function() {
        let floatBox = document.getElementById('bantu-audio-pip-float');
        if (floatBox) {
            floatBox.remove();
            return;
        }

        const media = document.querySelector('video') || document.querySelector('audio');
        const poster = media?.getAttribute('poster') || 'https://assets.bantustreamconnect.com/logo.png';
        const title = document.querySelector('.hero-section h1, .track-title, .content-title')?.textContent || "Bantu Stream Content";

        floatBox = document.createElement('div');
        floatBox.id = 'bantu-audio-pip-float';
        floatBox.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; width: 280px; height: 160px;
            background: #121212; border: 1px solid #282828; border-radius: 12px;
            z-index: 2147483647; box-shadow: 0 12px 32px rgba(0,0,0,0.7);
            overflow: hidden; display: flex; flex-direction: column; font-family: sans-serif; color: #fff;
        `;

        floatBox.innerHTML = `
            <div style="position: relative; width: 100%; height: 110px; background: url('${poster}') center/cover no-repeat;">
                <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="this.closest('#bantu-audio-pip-float').remove()">×</div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 8px; font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${title}
                </div>
            </div>
            <div style="height: 50px; display: flex; align-items: center; justify-content: center; background: #0a0a0a; gap: 24px;">
                <button id="pip-f-prev" style="background:none; border:none; color:#fff; cursor:pointer; font-size:16px;">⏮</button>
                <button id="pip-f-play" style="background:none; border:none; color:#fff; cursor:pointer; font-size:20px;">${media && !media.paused ? '⏸' : '▶'}</button>
                <button id="pip-f-next" style="background:none; border:none; color:#fff; cursor:pointer; font-size:16px;">⏭</button>
            </div>
        `;
        document.body.appendChild(floatBox);

        floatBox.querySelector('#pip-f-play').onclick = () => media.paused ? media.play() : media.pause();
        floatBox.querySelector('#pip-f-prev').onclick = () => document.querySelector('.prev-track-btn, .player-prev-btn')?.click();
        floatBox.querySelector('#pip-f-next').onclick = () => document.querySelector('.next-track-btn, .player-next-btn')?.click();

        media.addEventListener('play', () => { const b = document.getElementById('pip-f-play'); if(b) b.textContent = '⏸'; });
        media.addEventListener('pause', () => { const b = document.getElementById('pip-f-play'); if(b) b.textContent = '▶'; });
    };

    window.__bantuFailSafeHandler = function(e) {
        const playPauseBtn  = e.target.closest('.play-pause-btn, .player-play-btn');
        const prevBtn       = e.target.closest('.prev-track-btn, .player-prev-btn');
        const nextBtn       = e.target.closest('.next-track-btn, .player-next-btn');
        const muteBtn       = e.target.closest('.mute-btn, .volume-btn, .player-mute-btn');
        const pipBtn        = e.target.closest('.pip-btn, .player-pip-btn, .picture-in-picture-btn');
        const settingsBtn   = e.target.closest('.settings-btn');
        const fullscreenBtn = e.target.closest('.fullscreen-btn');

        if (!(playPauseBtn || prevBtn || nextBtn || muteBtn || pipBtn || settingsBtn || fullscreenBtn)) return;
        
        e.preventDefault();
        e.stopPropagation();

        const activeMedia = document.querySelector('video') || document.querySelector('audio');
        if (!activeMedia) return;

        // 1. PLAY / PAUSE
        if (playPauseBtn) {
            activeMedia.paused ? activeMedia.play().catch(()=>{}) : activeMedia.pause();
        }

        // 2. NEXT TRACK
        if (nextBtn) {
            if (typeof window.playNextPlaylistItem === 'function') {
                window.playNextPlaylistItem();
            }
        }

        // 3. PREVIOUS TRACK
        if (prevBtn) {
            console.log("⚡ Nuclear Route -> Previous Track Structural Resolution");
            const activeSidebarItem = document.querySelector('.playlist-sidebar .active, .playlist-item.active, .track-item.active, [data-content-id].active');
            if (activeSidebarItem && activeSidebarItem.previousElementSibling) {
                activeSidebarItem.previousElementSibling.click();
            } else if (typeof window.playPreviousPlaylistItem === 'function' && !window.playPreviousPlaylistItem.toString().includes('Default')) {
                window.playPreviousPlaylistItem();
            } else if (typeof window.playPrevPlaylistItem === 'function') {
                window.playPrevPlaylistItem();
            } else {
                const tracks = Array.from(document.querySelectorAll('.playlist-item, .track-item'));
                const currentIndex = tracks.findIndex(t => t.classList.contains('active'));
                if (currentIndex > 0) {
                    tracks[currentIndex - 1].click();
                }
            }
        }

        // 4. MUTE / UNMUTE
        if (muteBtn) {
            activeMedia.muted = !activeMedia.muted;
            const icon = muteBtn.querySelector('i');
            if (icon) {
                icon.className = activeMedia.muted ? 
                    icon.className.replace(/fa-volume-(up|down)/g, 'fa-volume-mute') : 
                    icon.className.replace('fa-volume-mute', 'fa-volume-up');
            }
        }

        // 5. PICTURE-IN-PICTURE
        if (pipBtn) {
            if (!document.pictureInPictureElement) {
                activeMedia.requestPictureInPicture()
                    .catch(err => {
                        window.__triggerBantuFloatPlayer();
                    });
            } else {
                document.exitPictureInPicture().catch(()=>{});
                const box = document.getElementById('bantu-audio-pip-float');
                if (box) box.remove();
            }
        }

        // 6. SETTINGS VIEW
        if (settingsBtn) {
            const menu = document.querySelector('.settings-menu, .player-settings-popup, .player-settings');
            if (menu) {
                const isHidden = window.getComputedStyle(menu).display === 'none';
                menu.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
            }
        }

        // 7. FULLSCREEN LOCK HANDSHAKE REPAIR
        if (fullscreenBtn) {
            console.log("⚡ Nuclear Route -> High-Priority Fullscreen Execution Wrapper");
            const playerWrapper = activeMedia.closest('.enhanced-video-player, #videoPlayerWrapper, .player-wrapper, .video-player-section') || activeMedia.parentElement;
            
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (playerWrapper.requestFullscreen) {
                    playerWrapper.requestFullscreen().then(() => {
                        window.__bantuForceVisibilityExecutionLoop();
                        window.dispatchEvent(new Event('resize'));
                    }).catch(err => console.error("❌ Fullscreen error:", err));
                } else if (playerWrapper.webkitRequestFullscreen) {
                    playerWrapper.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        }
    };

    document.addEventListener('click', window.__bantuFailSafeHandler, true);
    console.log("🚀 VERSION 2 COOPERATION SYSTEM DEPLOYED AND FULLY OPERATIONAL.");
  }

  // ============================================
  // 🚀 INITIALIZATION: Set up all player fixes
  // ============================================

  /**
   * Initialize all player interaction fixes
   * Call this after the video element is ready
   */
  function initializePlayerInteractionFixes() {
    console.log('🔧 Initializing player interaction fixes...');
    
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) {
      console.warn('⚠️ Video element not found for interaction fixes');
      return;
    }
    
    // 1. Initialize the state engine
    initializePlayerStateEngine();
    
    // 2. Setup guarded click handler
    setupGuardedVideoClickHandler();
    
    // 3. Bind mobile touch controls for iOS/Android
    _bindMobileTouchControls();
    
    // 4. 🌉 Deploy the orphaned controls bridge
    _setupOrphanedControlsBridge();
    
    // 5. ☢️ Deploy Nuclear Bridge V2 (Ancestral Force Loop)
    _deployNuclearBridgeV2();
    
    console.log('✅ Player interaction fixes initialized');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initializePlayerInteractionFixes, 300);
    });
  } else {
    setTimeout(initializePlayerInteractionFixes, 300);
  }

  // Also re-initialize when content changes
  document.addEventListener('contentIdChanged', function() {
    setTimeout(initializePlayerInteractionFixes, 500);
  });

  document.addEventListener('playlistLoaded', function() {
    setTimeout(initializePlayerInteractionFixes, 500);
  });

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
   * 
   * ☁️ CLOUDFLARE STREAM SUPPORT (2026-06-18):
   * - Tracks streaming provider for HLS manifests
   * - Passes provider context through events
   * 
   * 🎵 AUDIO SUPPORT (2026-06-18):
   * - loadSource() detects audio and loads directly to HTML5 media element
   * - Detaches HLS for audio tracks to prevent fatal crashes
   * 
   * 🚨 CSS STATE ARCHITECTURE (2026-06-21):
   * - Uses .is-playing, .is-paused, .audio-active classes on wrapper
   * - State-driven CSS handles all layer management
   * - Clean separation: CSS manages visibility, JS manages state
   * 
   * 🛡️ SAFE-GUARD COMPATIBILITY (2026-06-21):
   * - Enhanced loadSource to handle both object and direct parameter calls
   * - Supports window.EnhancedVideoPlayer.loadSource(videoUrl, thumbnailUrl)
   * - Maintains backward compatibility with existing loadSource usage
   * 
   * 🎯 CROSS-DEVICE CONTROL FIX (2026-06-22):
   * - Scoped wrapper capture-phase listeners bypass parent pause guards
   * - Mobile Safari event drop-off protection via capture phase
   * - MutationObserver ensures mobile-compatible controls survive DOM updates
   * 
   * 🔍 GUARD CLAUSE PROPAGATION TRAP FIX (2026-06-22):
   * - guardedVideoContainerClick() returns early without stopping propagation
   * - Control clicks bubble naturally to button handlers
   * - _bindMobileTouchControls() for iOS/Android tap compatibility
   * 
   * 🌉 ORPHANED CONTROLS BRIDGE (2026-06-22):
   * - Global document-level delegation for controls outside player wrapper
   * - Bypasses "ORPHANED LAYOUT DETECTED" architectural issue
   * - Uses .closest() to defeat FontAwesome icon trap
   * - Decouples click capture from component layout boundaries
   * 
   * ☢️ NUCLEAR BRIDGE V2 (2026-06-22):
   * - Structural Ancestral Force Loop for full-screen stacking priority
   * - Background canvas/poster demotion rules
   * - Ancestral upward traversal from controls to full-screen root
   * - Dynamic inline style overrides for mutation resistance
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
      
      // ☁️ Cloudflare Stream tracking
      this._currentStreamingProvider = null;
      this._isHLSStream = false;
      this._isAudioMode = false;
      
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
      
      // Content metadata
      this.contentId = options.contentId || null;
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
      // 🎯 UPDATED: Now uses scoped wrapper capture-phase listeners instead of document delegation
      this._setupDelegatedEventListeners();
      
      // 🚨 Setup contentId change listener
      this._setupContentIdListener();
      
      console.log('✅ EnhancedVideoPlayer instantiated', {
        contentId: this.contentId,
        userId: this.userId,
        telemetry: this.config.enableTelemetry,
        collectionNav: this.config.enableCollectionNav,
        viewThreshold: this.config.minViewThresholdSeconds,
        percentageThreshold: this.config.percentageViewThreshold
      });
    }
    
    // =====================================================
    // 🔧 FIX #5: DELEGATED EVENT LISTENERS (UPDATED)
    // 🎯 CROSS-DEVICE FIX: Capture-phase listeners on scoped wrapper
    // These bypass parent pause guards and survive DOM rebuilds
    // =====================================================
    _setupDelegatedEventListeners() {
      // Get the player wrapper container (scoped, not global document)
      const wrapper = this.container || document.querySelector('.video-player-wrapper') || document.querySelector('.video-container');
      
      if (!wrapper) {
        console.warn('⚠️ EnhancedVideoPlayer: Scoped wrapper not found. Falling back to document delegation.');
        // Fallback to global document listener (legacy behavior)
        if (window._delegatedListenersSetup) return;
        window._delegatedListenersSetup = true;
        
        document.addEventListener('click', (e) => {
          const prevBtn = e.target.closest('.prev-track-btn, .player-prev-btn');
          const nextBtn = e.target.closest('.next-track-btn, .player-next-btn');
          const volumeBtn = e.target.closest('.volume-btn, .player-volume-btn');
          
          if (prevBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⏮️ Delegated (fallback): Previous button clicked');
            if (typeof window.playPreviousPlaylistItem === 'function') {
              window.playPreviousPlaylistItem();
            } else if (typeof this.playPrevious === 'function') {
              this.playPrevious();
            }
          }
          
          if (nextBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⏭️ Delegated (fallback): Next button clicked');
            if (typeof window.playNextPlaylistItem === 'function') {
              window.playNextPlaylistItem();
            } else if (typeof this.playNext === 'function') {
              this.playNext();
            }
          }
          
          if (volumeBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔊 Delegated (fallback): Volume button clicked');
            if (this.video) {
              this.video.muted = !this.video.muted;
              this._updateVolumeUI();
              this._emit('playback:mute', { muted: this.video.muted });
            }
          }
        });
        console.log('✅ Delegated event listeners (fallback) registered');
        return;
      }

      console.log('🎯 EnhancedVideoPlayer: Deploying cross-device capture listeners on player wrapper.');

      // Ensure mobile browsers recognize custom control elements as interactive targets
      const optimizeControlsForMobile = () => {
        wrapper.querySelectorAll('.prev-track-btn, .player-prev-btn, .next-track-btn, .player-next-btn, .volume-btn, .player-volume-btn, .play-pause-btn, .fullscreen-btn').forEach(btn => {
          btn.style.cursor = 'pointer';
          if (!btn.getAttribute('role')) {
            btn.setAttribute('role', 'button');
          }
        });
      };
      optimizeControlsForMobile();

      // Monitor for any skeleton updates or dynamic DOM changes to maintain mobile compliance
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => optimizeControlsForMobile());
        observer.observe(wrapper, { childList: true, subtree: true });
        // Store observer reference for cleanup if needed
        this._mutationObserver = observer;
      }

      /**
       * Capture Phase Interceptor (Notice the 'true' argument at the end of the listener)
       * Catches the interaction on the descent, executing actions before parent elements can stall them.
       */
      wrapper.addEventListener('click', (e) => {
        // Resolve target elements using precise class definitions
        const prevBtn = e.target.closest('.prev-track-btn, .player-prev-btn');
        const nextBtn = e.target.closest('.next-track-btn, .player-next-btn');
        const volumeBtn = e.target.closest('.volume-btn, .player-volume-btn');
        const playPauseBtn = e.target.closest('.play-pause-btn, .player-play-btn');

        // If a valid control button was interacted with, short-circuit the defensive parent guards
        if (prevBtn || nextBtn || volumeBtn || playPauseBtn) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault(); 
        }

        // Execute actions directly against the native video/player instances
        if (playPauseBtn) {
          console.log("🎯 Cross-Device Engine: Play/Pause Intercepted");
          const video = wrapper.querySelector('video');
          if (video) {
            if (video.paused) {
              video.play().catch(err => console.warn("Playback block checked:", err));
            } else {
              video.pause();
            }
          }
        }
        
        if (nextBtn) {
          console.log("🎯 Cross-Device Engine: Next Track Intercepted");
          if (typeof window.playNextPlaylistItem === 'function') {
            window.playNextPlaylistItem();
          } else if (typeof this.playNext === 'function') {
            this.playNext();
          }
        }

        if (prevBtn) {
          console.log("🎯 Cross-Device Engine: Previous Track Intercepted");
          if (typeof window.playPreviousPlaylistItem === 'function') {
            window.playPreviousPlaylistItem();
          } else if (typeof this.playPrevious === 'function') {
            this.playPrevious();
          }
        }

        if (volumeBtn) {
          console.log("🎯 Cross-Device Engine: Mute Toggle Intercepted");
          const video = wrapper.querySelector('video');
          if (video) {
            video.muted = !video.muted;
            this._updateVolumeUI();
            this._emit('playback:mute', { muted: video.muted });
          }
        }
      }, true); // ← CRITICAL: 'true' enables the Capture Phase to bypass parent element click blocks.

      console.log('✅ Cross-device capture-phase delegated event listeners registered on player wrapper');
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
    // MIME TYPE & MEDIA DETECTION
    // =====================================================
    
    getMediaMimeType(url = '') {
      if (!url) return 'video/mp4';
      
      const lower = url.toLowerCase();
      
      // HLS manifest
      if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
      if (lower.includes('videodelivery.net')) return 'application/vnd.apple.mpegurl';
      
      // Video types
      if (lower.endsWith('.mp4')) return 'video/mp4';
      if (lower.endsWith('.webm')) return 'video/webm';
      if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
      if (lower.endsWith('.mkv')) return 'video/x-matroska';
      if (lower.endsWith('.avi')) return 'video/x-msvideo';
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
    
    /**
     * Check if current content is audio based on streaming provider
     */
    _isContentAudio() {
      // Check if we have content metadata with streaming provider
      if (this.contentMetadata && this.contentMetadata.streaming_provider === 'cloudflare_r2') {
        return true;
      }
      // Check if we have a preserved source URL that's audio
      if (this._sourcePreserved && this._sourcePreserved.url) {
        return this.isAudioSource(this._sourcePreserved.url);
      }
      // Check video element source
      if (this.video) {
        const src = this.video.src || this.video.querySelector('source')?.src;
        if (src) return this.isAudioSource(src);
      }
      return false;
    }
    
    detectMediaType(url, metadata = {}) {
      if (metadata.media_type) return metadata.media_type;
      if (metadata.streaming_provider === 'cloudflare_r2') return 'audio';
      if (this.isAudioSource(url)) return 'audio';
      return 'video';
    }
    
    /**
     * 🚨 FIX #8: Calculate dynamic threshold based on video duration
     * Uses min(15 seconds, 30% of duration) for view recording
     */
    _getDynamicViewThreshold() {
      if (!this.video) return this.config.minViewThresholdSeconds;
      
      const duration = this.video.duration || 0;
      if (duration <= 0) return this.config.minViewThresholdSeconds;
      
      const thirtyPercentDuration = duration * this.config.percentageViewThreshold;
      const thresholdSeconds = Math.min(this.config.minViewThresholdSeconds, thirtyPercentDuration);
      
      // Ensure at least 3 seconds for very short content
      return Math.max(3, thresholdSeconds);
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
      
      // 🔧 FIX #6: Removed engagement buttons from player overlay
      // Social buttons (like, favorite, share) are now ONLY outside player
      // Only keep essential playback controls
      
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
    // 🎯 CRITICAL FIX #8: SINGLE ENDED HANDLER (NO DUPLICATES)
    // Player ONLY emits event - does NOT control playlist directly
    // This prevents the double advancement bug
    // ☁️ Updated to include streamingProvider context
    // =====================================================
    _handleEnded() {
      this.isPlaying = false;
      this._updatePlayButton(false);
      
      console.log('🏁 Media playback completed. Emitting ended event for external handler.');
      
      // 🎯 YOUTUBE-STYLE ARCHITECTURE:
      // Player ONLY emits the mediaEnded event
      // Content-detail.js owns ALL playlist navigation logic
      // This prevents duplicate advancement from video-player.js
      this._emit('mediaEnded', {
        contentId: this.contentId,
        playlistIndex: window.currentPlaylistIndex,
        currentTime: this.video ? this.video.currentTime : 0,
        duration: this.video ? this.video.duration : 0,
        streamingProvider: this._currentStreamingProvider || null,
        isAudio: this._isAudioMode
      });
      
      // For backward compatibility, also call window.playNextPlaylistItem if it exists
      // This is the ONLY place where playlist advancement is triggered
      if (typeof window.playNextPlaylistItem === 'function') {
        console.log('🎬 Invoking window.playNextPlaylistItem() (delegated to content-detail.js)');
        window.playNextPlaylistItem();
      } else {
        console.log('🎵 No playlist controller bound to window - auto-advance disabled');
      }
      
      this._emit('playback:ended', {
        totalWatchTime: this.stats.totalWatchTime,
        duration: this.video ? this.video.duration : 0,
        contentId: this.contentId,
        streamingProvider: this._currentStreamingProvider || null,
        isAudio: this._isAudioMode
      });
    }
    
    _handleTimeUpdate() {
      this._updateTimeDisplay();
      this._updateProgressBar();
      
      // 🚨 FIX #1 & #8: Record view using dynamic threshold
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
        // Note: prev/next buttons also handled by delegated listeners
        // but we keep these for direct access
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
        collectionContext = null,
        streamingProvider = null,
        isHLS = false,
        isAudio = false
      } = options;
      
      if (contentId) this.contentId = contentId;
      if (contentMetadata) this.contentMetadata = contentMetadata;
      if (collectionContext) {
        this.collectionContext = { ...this.collectionContext, ...collectionContext };
      }
      
      // 🚨 Store streaming provider for context
      if (streamingProvider) {
        this._currentStreamingProvider = streamingProvider;
        this._isHLSStream = isHLS;
      }
      this._isAudioMode = isAudio;
      
      this._audioRendererRecoveryAttempted = false;
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      
      if (this.isAudioSource(url) || isAudio) {
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
      
      console.log('✅ Source changed:', { url, contentId, streamingProvider, isHLS, isAudio });
      this._emit('source:changed', { url, contentId, type, streamingProvider, isHLS, isAudio });
      
      return Promise.resolve();
    }
    
    // =====================================================
    // 🚨 FIX #2: Update contentId for playlist track changes
    // ☁️ Updated to sync streaming provider with streaming manager
    // =====================================================
    updateContentId(newContentId) {
      if (this.contentId === newContentId) {
        console.log('⚠️ Player contentId unchanged:', newContentId);
        return;
      }
      
      console.log(`🔄 Player contentId updated: ${this.contentId} -> ${newContentId}`);
      this.contentId = newContentId;
      
      // Reset view recording state for new content
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      this.viewValidated = false;
      
      // 🚨 Update session with new content ID
      if (this.watchSession && typeof this.watchSession.updateContentId === 'function') {
        this.watchSession.updateContentId(newContentId);
      }
      
      // 🚨 If streaming provider changed, notify streaming manager
      if (window.streamingManager && typeof window.streamingManager.updateContentId === 'function') {
        window.streamingManager.updateContentId(newContentId);
      }
      
      this._emit('content:changed', { 
        contentId: newContentId,
        streamingProvider: this._currentStreamingProvider 
      });
    }
    
    /**
     * 🚨 Sync engagement state with UI (for when external changes happen)
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
    // 🔧 FIX #2 & #7: SIMPLIFIED AUDIO RESTORATION (NO FAKE SYSTEM)
    // No fake _attachAudioRestoreListeners or _restoreAudioAfterInteraction
    // Instead: direct user gesture handling in content-detail.js
    // =====================================================
    async safePlay() {
      if (!this.video || this._isDestroyed) {
        return Promise.reject('Player destroyed');
      }
      
      try {
        // First attempt: normal playback with unmuted audio
        await this.video.play();
        
        // Success! Unmute if needed (but should already be unmuted)
        if (this.video.muted) {
          this.video.muted = false;
          this.config.muted = false;
        }
        
        console.log('▶️ Playback started successfully with unmuted audio');
        this._emit('playback:success', { method: 'direct' });
        return true;
        
      } catch (error) {
        console.warn('⚠️ Initial play blocked or failed:', error.message);
        
        // Second attempt: Force mute and retry
        if (this.video) {
          this.video.muted = true;
          this.config.muted = true;
        }
        
        try {
          if (this.video) {
            await this.video.play();
            console.log('✅ Playback recovered in muted mode');
            
            // Show play overlay to prompt user to unmute
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
          
          // Show play overlay to let user initiate manually
          this._showPlayOverlay();
          
          this._emit('playback:fatal-error', { error: retryError });
          throw retryError;
        }
      }
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
          
          console.log('🎬 WatchSession initialized for telemetry');
          
        } catch (error) {
          console.warn('⚠️ Failed to initialize WatchSession:', error);
        }
      }
    }
    
    // =====================================================
    // 🚨 FIX #1 & #8: Record view using RPC with dynamic threshold
    // =====================================================
    async _recordViewViaRPC() {
      if (this.viewRecorded || !this.supabase || !this.contentId) return;
      
      this.viewRecorded = true;
      const currentProgress = this.video ? Math.floor(this.video.currentTime) : 30;
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
    
    playPrevious() {
      console.log('⏮️ Playing previous item...');
      
      // Use global playlist function if available
      if (typeof window.playPreviousPlaylistItem === 'function') {
        window.playPreviousPlaylistItem();
        return;
      }
      
      // Fallback to QueueManager
      if (window.QueueManager && window.QueueManager.playPrevious) {
        window.QueueManager.playPrevious();
        return;
      }
      
      // Fallback to ContentCollectionsEngine
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
      
      // Use global playlist function if available
      if (typeof window.playNextPlaylistItem === 'function') {
        window.playNextPlaylistItem();
        return;
      }
      
      // Fallback to QueueManager
      if (window.QueueManager && window.QueueManager.playNext) {
        window.QueueManager.playNext();
        return;
      }
      
      // Fallback to ContentCollectionsEngine
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
    
    // =====================================================
    // 🛡️ SAFE-GUARD COMPATIBILITY: Enhanced loadSource
    // Supports both object config and direct parameter calls
    // =====================================================
    
    /**
     * 🚨 CRITICAL: Load source without destroying player instance
     * Used for playlist track changes and safe-guard clause calls
     * Supports both:
     *   1. loadSource({ url, type, contentId, streamingProvider, isHLS, isAudio })
     *   2. loadSource(videoUrl, thumbnailUrl) - Safe-Guard compatible
     * 
     * ☁️ Updated to handle streamingProvider and isHLS params
     * 🎵 UPDATED: Audio detection - loads directly to HTML5 media element
     * 🛡️ SAFE-GUARD: Supports direct parameter pattern for skeleton generator
     */
    loadSource(sourceConfig, thumbnailUrl) {
      // 🛡️ SAFE-GUARD COMPATIBILITY: Handle direct parameter call
      // Pattern: loadSource(videoUrl, thumbnailUrl) from skeleton generator
      if (typeof sourceConfig === 'string') {
        const videoUrl = sourceConfig;
        console.log('🛡️ Safe-Guard Compatibility: loadSource called with direct parameters', { videoUrl, thumbnailUrl });
        
        // Convert to object format for internal processing
        sourceConfig = {
          url: videoUrl,
          type: this.getMediaMimeType(videoUrl),
          isHLS: videoUrl.includes('.m3u8') || videoUrl.includes('videodelivery.net'),
          isAudio: this.isAudioSource(videoUrl),
          streamingProvider: null
        };
        
        // If thumbnailUrl provided, update poster
        if (thumbnailUrl) {
          console.log('🛡️ Safe-Guard: Updating poster with thumbnail:', thumbnailUrl);
          const videoElement = this.video || document.getElementById('inlineVideoPlayer');
          if (videoElement) {
            videoElement.setAttribute('poster', thumbnailUrl);
            const overlay = document.getElementById('customPosterOverlay');
            if (overlay) {
              overlay.style.backgroundImage = `url('${thumbnailUrl}')`;
              overlay.classList.add('active');
            }
          }
        }
      }
      
      // Now handle the standardized object format
      if (!this.video) return Promise.reject('Player not attached');
      if (!sourceConfig || !sourceConfig.url) return Promise.reject('Invalid source config');
      
      const url = sourceConfig.url;
      const type = sourceConfig.type || this.getMediaMimeType(url);
      const contentId = sourceConfig.contentId || this.contentId;
      const streamingProvider = sourceConfig.streamingProvider || null;
      const isHLS = sourceConfig.isHLS || false;
      const isAudio = sourceConfig.isAudio || false;
      
      console.log('🔄 Loading new source without destroying player:', { 
        url, 
        contentId, 
        streamingProvider,
        isHLS,
        isAudio,
        sourceType: typeof sourceConfig === 'object' ? 'object' : 'string'
      });
      
      // Update contentId
      if (contentId && contentId !== this.contentId) {
        this.updateContentId(contentId);
      }
      
      // 🚨 Store streaming provider for context
      if (streamingProvider) {
        this._currentStreamingProvider = streamingProvider;
        this._isHLSStream = isHLS;
      }
      
      // 🎵 Check if this is audio (Cloudflare R2 or audio file extension)
      const isAudioContent = isAudio || 
                             streamingProvider === 'cloudflare_r2' || 
                             this.isAudioSource(url) ||
                             (this.contentMetadata && this.contentMetadata.streaming_provider === 'cloudflare_r2');
      
      if (isAudioContent) {
        console.log('🎵 Audio content detected - Loading directly to HTML5 media element');
        this._isAudioMode = true;
        
        // Detach HLS if it was left over from a video
        if (window.streamingManager) {
          console.log('🎵 Destroying streaming manager for audio playback');
          window.streamingManager.destroy();
          window.streamingManager = null;
        }
        
        // Reset view recording flags for new source
        this.viewRecorded = false;
        this._viewThresholdReached = false;
        
        // Pause current playback
        this.video.pause();
        
        // Clear existing source
        while (this.video.firstChild) {
          this.video.removeChild(this.video.firstChild);
        }
        this.video.removeAttribute('src');
        
        // Set direct source link on the native HTML5 media element
        this.video.src = url;
        this.video.load();
        
        // Play the audio track using our established safePlay pattern
        if (document.body.classList.contains('user-interacted')) {
          this.safePlay().catch(err => {
            console.warn('Auto-play after audio source change blocked:', err);
            this._showPlayOverlay();
          });
        } else {
          this._showPlayOverlay();
        }
        
        // Update preserved source with provider info
        this._sourcePreserved = { 
          url, 
          type, 
          method: 'loadSource',
          streamingProvider: streamingProvider,
          isHLS: isHLS,
          isAudio: true
        };
        
        this._emit('source:loaded', { url, contentId, type, streamingProvider, isHLS, isAudio: true });
        this._emit('audio:loaded', { url, contentId });
        
        return Promise.resolve();
      }
      
      // ============================================
      // VIDEO PATH - Keep existing logic
      // ============================================
      console.log('📺 Video content detected - Using HLS/video pipeline');
      this._isAudioMode = false;
      
      // Reset view recording flags for new source
      this.viewRecorded = false;
      this._viewThresholdReached = false;
      
      // Pause current playback
      this.video.pause();
      
      // Update source
      while (this.video.firstChild) {
        this.video.removeChild(this.video.firstChild);
      }
      this.video.removeAttribute('src');
      
      const source = document.createElement('source');
      source.src = url;
      source.type = type;
      this.video.appendChild(source);
      
      // 🚨 If this is an HLS stream, notify streaming manager
      if (isHLS || url.includes('videodelivery.net') || url.endsWith('.m3u8')) {
        console.log('📺 HLS stream detected - ensuring streaming manager handles it');
        if (window.streamingManager) {
          // Give streaming manager a moment to reinitialize
          setTimeout(() => {
            if (window.streamingManager && typeof window.streamingManager.reinitialize === 'function') {
              window.streamingManager.reinitialize(contentId).catch(err => {
                console.warn('Streaming manager reinit after loadSource:', err);
              });
            }
          }, 50);
        }
      }
      
      // Load and attempt to play if user has interacted
      this.video.load();
      
      if (document.body.classList.contains('user-interacted')) {
        this.play().catch(err => {
          console.warn('Auto-play after source change blocked:', err);
          this._showPlayOverlay();
        });
      }
      
      // Update preserved source with provider info
      this._sourcePreserved = { 
        url, 
        type, 
        method: 'loadSource',
        streamingProvider: streamingProvider,
        isHLS: isHLS,
        isAudio: false
      };
      
      this._emit('source:loaded', { url, contentId, type, streamingProvider, isHLS, isAudio: false });
      
      return Promise.resolve();
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
        viewValidated: this.viewValidated,
        viewThreshold: this._getDynamicViewThreshold(),
        streamingProvider: this._currentStreamingProvider,
        isHLSStream: this._isHLSStream,
        isAudioMode: this._isAudioMode
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
        } : null,
        streamingProvider: this._currentStreamingProvider,
        isHLSStream: this._isHLSStream,
        isAudioMode: this._isAudioMode
      };
    }
    
    isReady() {
      return this._isAttached && !this._isDestroyed && this.video ? this.video.readyState >= 2 : false;
    }
    
    /**
     * ☁️ Get the current streaming provider
     */
    getStreamingProvider() {
      return this._currentStreamingProvider;
    }
    
    /**
     * ☁️ Check if current stream is HLS
     */
    isHLSStream() {
      return this._isHLSStream;
    }
    
    /**
     * 🎵 Check if current content is audio mode
     */
    isAudioMode() {
      return this._isAudioMode;
    }
  }
  
  // =====================================================
  // GLOBAL EXPORT & INITIALIZATION
  // =====================================================
  
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
  window.BantuVideoPlayer = EnhancedVideoPlayer;
  
  // Expose recordView function globally for content-detail.js to use
  window._recordViewViaRPC = recordViewViaRPC;
  
  // 🎯 YOUTUBE-STYLE: Expose a helper function for content-detail to register
  window._setupPlayerEndedCallback = function(callback) {
    if (typeof callback === 'function') {
      window._playerEndedCallback = callback;
      console.log('✅ Player ended callback registered (YouTube-style)');
    }
  };
  
  // Helper for delegated prev/next functions
  window.playPreviousPlaylistItem = window.playPreviousPlaylistItem || function() {
    console.log('⏮️ Default playPreviousPlaylistItem - override in content-detail.js');
  };
  
  window.playNextPlaylistItem = window.playNextPlaylistItem || function() {
    console.log('⏭️ Default playNextPlaylistItem - override in content-detail.js');
  };
  
  // 🚨 CSS STATE ARCHITECTURE: Initialize interaction fixes when DOM is ready
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
    
    // 🚨 Initialize player interaction fixes (state engine + guarded clicks + mobile touch + orphaned bridge + nuclear bridge v2)
    initializePlayerInteractionFixes();
  });
  
  // Also initialize when content changes
  document.addEventListener('contentIdChanged', function() {
    setTimeout(initializePlayerInteractionFixes, 500);
  });
  
  document.addEventListener('playlistLoaded', function() {
    setTimeout(initializePlayerInteractionFixes, 500);
  });
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedVideoPlayer;
  }
  
  // =====================================================
  // 🚨 NUCLEAR DIAGNOSTIC ENGINE
  // Emergency self-contained diagnostic & force-correction loop
  // Bypasses script initialization crashes
  // =====================================================
  
  (function runNuclearPlayerDiagnostic() {
    console.log('🚨 EMERGENCY: Launching Video Player Diagnostic & Force-Correction Engine...');

    // Inline structural style injection to bypass broken external CSS files
    const stylePatch = document.createElement('style');
    stylePatch.innerHTML = `
        .FORCE-SHOW-CONTROLS {
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
            z-index: 2147483647 !important; /* Maximum possible z-index */
        }
        .FORCE-HIDE-OVERLAY {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            z-index: -1000 !important;
        }
    `;
    document.head.appendChild(stylePatch);
    console.log('✅ Emergency CSS Overrides Injected into Head Document.');

    // Continuous Diagnostic & Enforcement Loop (Runs every 500ms)
    setInterval(() => {
        const video = document.getElementById('inlineVideoPlayer') || document.querySelector('video');
        const overlay = document.getElementById('customPosterOverlay');
        const controls = document.querySelector('.custom-controls-container') || document.querySelector('.vjs-control-bar');

        if (!video) {
            console.warn('📊 Diagnostic Warning: <video> element cannot be found in DOM right now.');
            return;
        }

        const isPlaying = !video.paused && !video.ended;

        // 🔍 DIAGNOSTIC LOGGING: Check exactly what the elements are doing
        if (isPlaying) {
            const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;
            const controlsStyle = controls ? window.getComputedStyle(controls) : null;

            console.log('📊 PLAYER STATE: [PLAYING] | Audio/Video processing actively.');
            
            if (overlay) {
                console.log(`🖼️ Overlay Target Status -> Display: ${overlayStyle.display}, Opacity: ${overlayStyle.opacity}, Z-Index: ${overlayStyle.zIndex}`);
                
                // 🛑 FORCE CORRECTION: Smash the overlay out of the way
                if (overlayStyle.display !== 'none' || overlayStyle.opacity !== '0') {
                    console.error('🚨 CRITICAL BLOCKER DETECTED: Thumbnail overlay is blindfolding the video player! Force-hiding now.');
                    overlay.classList.add('FORCE-HIDE-OVERLAY');
                    overlay.style.setProperty('display', 'none', 'important');
                }
            }

            if (controls) {
                console.log(`🎛️ Controls Target Status -> Display: ${controlsStyle.display}, Opacity: ${controlsStyle.opacity}, Z-Index: ${controlsStyle.zIndex}`);
                
                // 🛑 FORCE CORRECTION: Force controls into view
                if (controlsStyle.opacity === '0' || controlsStyle.visibility === 'hidden' || controlsStyle.display === 'none') {
                    console.error('🚨 CRITICAL BLOCKER DETECTED: Video controls are invisible during active playback! Force-showing now.');
                    controls.classList.add('FORCE-SHOW-CONTROLS');
                }
            }
        } else {
            // Player is paused or waiting for user interaction
            if (overlay && !overlay.classList.contains('FORCE-HIDE-OVERLAY')) {
                // Ensure the overlay is interactive during initial load or pause
                overlay.style.pointerEvents = 'auto';
            }
        }
    }, 500);

    // 📱 MOBILE BUBBLING PROTECTION: Absolute interception fallback
    document.addEventListener('touchstart', function(e) {
        const controlsContainer = e.target.closest('.custom-controls-container') || e.target.closest('.vjs-control-bar');
        if (controlsContainer) {
            console.log('📱 Emergency Mobile Guard: Touch start inside controls container detected. Stopping event propagation.');
            e.stopPropagation();
        }
    }, true); // Executed during capture phase to kill event before it bubbles to the video surface

    document.addEventListener('click', function(e) {
        const controlsContainer = e.target.closest('.custom-controls-container') || e.target.closest('.vjs-control-bar') || e.target.closest('.control-btn');
        if (controlsContainer) {
            console.log('📱 Emergency Mobile Guard: Click inside controls detected. Isolating event.');
            e.stopPropagation();
        }
    }, true);

    console.log('✅ Nuclear Diagnostic Engine deployed. Scanning every 500ms for layout blockers.');
  })();
  
  console.log('✅ EnhancedVideoPlayer module loaded successfully (v3.3.4 - Guard Clause Propagation Trap Fix)');
  console.log('   🔍 GUARD CLAUSE FIX: guardedVideoContainerClick() returns early WITHOUT stopping propagation');
  console.log('   🔍 GUARD CLAUSE FIX: Control clicks bubble naturally to button handlers');
  console.log('   📱 MOBILE FIX: _bindMobileTouchControls() for iOS/Android tap compatibility');
  console.log('   📱 MOBILE FIX: touch-action: manipulation eliminates 300ms tap delay');
  console.log('   📱 MOBILE FIX: touchstart fast-track for non-standard tags');
  console.log('   🎯 CROSS-DEVICE FIX: Scoped wrapper capture-phase listeners bypass parent guards');
  console.log('   🎯 CROSS-DEVICE FIX: Mobile Safari event drop-off protection');
  console.log('   🎯 CROSS-DEVICE FIX: MutationObserver for mobile-compatible controls');
  console.log('   🛡️ SAFE-GUARD: loadSource() supports both object config AND direct parameters');
  console.log('   🛡️ SAFE-GUARD: Backward compatible with skeleton generator calls');
  console.log('   🛡️ SAFE-GUARD: Preserves poster overlay when updating source');
  console.log('   🔧 FIX #2: REMOVED fake audio restore system');
  console.log('   🔧 FIX #5: ADDED delegated event listeners for prev/next/volume (UPDATED)');
  console.log('   🔧 FIX #6: REMOVED engagement buttons from player overlay');
  console.log('   🔧 FIX #8: SINGLE ended handler (no duplicates)');
  console.log('   🔧 CRITICAL: Player ONLY emits events, NEVER controls playlist');
  console.log('   🚨 FIX #1: RPC view recording integration');
  console.log('   🚨 FIX #2: contentId synchronization (updateContentId method)');
  console.log('   🚨 FIX #8: Dynamic threshold (min 15 sec or 30% of duration)');
  console.log('   🚨 loadSource method for non-destructive source changes');
  console.log('   ☁️ Cloudflare Stream: _currentStreamingProvider tracking');
  console.log('   ☁️ Cloudflare Stream: streamingProvider context in events');
  console.log('   ☁️ Cloudflare Stream: HLS detection in loadSource');
  console.log('   🎵 AUDIO: loadSource() detects Cloudflare R2 and loads directly to HTML5');
  console.log('   🎵 AUDIO: Detaches HLS for audio tracks to prevent fatal crashes');
  console.log('   🎵 AUDIO: Uses safePlay() pattern for audio playback');
  console.log('   🎵 AUDIO RENDERER FIX: Automatic mute fallback for AUDIO_RENDERER_ERROR');
  console.log('   🎯 YOUTUBE-STYLE: Player ended event triggers window.playNextPlaylistItem()');
  console.log('   🎯 YOUTUBE-STYLE: Player does NOT own playlist logic - only fires event');
  console.log('   🔊 DESKTOP AUTOPLAY: Enhanced safePlay() with muted fallback');
  console.log('   🚨 CSS STATE ARCHITECTURE: .is-playing/.is-paused classes on wrapper');
  console.log('   🚨 CSS STATE ARCHITECTURE: State-driven CSS manages poster overlay visibility');
  console.log('   🚨 CSS STATE ARCHITECTURE: guardedVideoContainerClick() prevents pause on controls');
  console.log('   🌉 ORPHANED CONTROLS BRIDGE: Global document-level delegation for external controls');
  console.log('   🌉 ORPHANED CONTROLS BRIDGE: Bypasses "ORPHANED LAYOUT DETECTED" architectural issue');
  console.log('   🌉 ORPHANED CONTROLS BRIDGE: Uses .closest() to defeat FontAwesome icon trap');
  console.log('   ☢️ NUCLEAR BRIDGE V2: Structural Ancestral Force Loop for full-screen stacking');
  console.log('   ☢️ NUCLEAR BRIDGE V2: Background canvas/poster demotion rules');
  console.log('   ☢️ NUCLEAR BRIDGE V2: Ancestral upward traversal from controls to full-screen root');
  console.log('   ☢️ NUCLEAR BRIDGE V2: Dynamic inline style overrides for mutation resistance');
  console.log('   ☢️ NUCLEAR BRIDGE V2: Audio mode poster overlay stacking fix');
  console.log('   🚨 NUCLEAR DIAGNOSTIC: Force-correction loop runs every 500ms');
  console.log('   🚨 NUCLEAR DIAGNOSTIC: Inline CSS overrides bypass external stylesheet crashes');
  console.log('   🚨 NUCLEAR DIAGNOSTIC: Capture-phase event listeners for mobile touch protection');
  console.log('   🚀 Ready for production deployment with Guard Clause Propagation Trap Fix');
  
})();
