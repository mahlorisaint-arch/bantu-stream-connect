// js/content-detail.js - FIXED FOR RLS POLICIES - WITH ACCURATE COUNT BYPASS - VIEWS RECORDED ON PLAY BUTTON CLICK (LIKE MOBILE APP)
// FIXED: Theme selector conflict resolved, navigation icons properly aligned
// PHASE 1 UPDATE: Watch Session Lifecycle Integration with syntax-safe WatchSession
// PHASE 2 UPDATE: Watch Later & Playlist System Integration
// PHASE 3 UPDATE: Complete Recommendation Engine Integration
// PHASE 4 UPDATE: HLS Streaming & Quality Selector Integration - COMPLETE
// FIXED: Added video load confirmation events
// PHASE 1-3 POLISH: Keyboard Shortcuts, Playlist Modal, Loading States
// FIXED: Playlist duplicate key constraint error handling
// PHASE 4 ENHANCEMENTS: Quality badge, network speed indicator, HLS.js integration
// FIXED: Quality selector initialization and rendering issue
// 🎯 YOUTUBE-STYLE HERO INTEGRATION: Video player now BEFORE hero section for prominent display
// 🎯 PROFESSIONAL LAYOUT FIX: Recommendation rails moved below comments section with proper titles
// 🎯 FIXED: Duplicate Continue Watching sections consolidated into ONE section below comments
// 🎯 MOBILE-OPTIMIZED: Full-width video player on mobile, removed "Now Playing" header
// 🎯 REDESIGN: Removed close button, full-width player, compact settings menu
// 🎵 AUDIO SUPPORT: Added MP3, WAV, OGG playback with thumbnail as poster
// 🎨 CREATOR AVATAR FIX: Show actual creator profile picture from user_profiles
// 🔄 PLATFORM CONSISTENCY: Integrated home feed sidebar, header, navigation, and utilities
// ✅ FIXED: checkConnectionStatus now returns a Promise to prevent ".then is not a function" error
// ✅ FIXED: Added missing initThemeSelector function to prevent ReferenceError
// ✅ FIXED: Sidebar profile now shows logged-in user correctly
// ✅ FIXED: Header profile icon sizing matches home feed
// ✅ FIXED: Sidebar UI resize section button overlapping
// ✅ FIXED: Navigation menu button opens sidebar instead of redirecting to dashboard
// ✅ FIXED: Comments "sign in to comment" bug when already authenticated
// ✅ FIXED: LIKE BUTTON - Proper WHERE clauses for RLS compliance
// 🎯 MOBILE FIX: Navigation button properly centered, no overflow, no horizontal scrolling
// 🎯 MOBILE FIX: Header profile picture hidden on mobile phones
// 🎯 MOBILE FIX: RSA badge stays inside header, no overflow
// 🔧 CRITICAL FIX: Added session_id to view recording system (YouTube-style validation)
// 🔧 CRITICAL FIX: REMOVED creator_id from content_views operations (column doesn't exist)
// 🔧 CRITICAL FIX: ADDED profile_id to content_views inserts (required column)
console.log('🎬 Content Detail Initializing with RLS-compliant fixes and home feed UI integration...');
// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let watchSession = null; // PHASE 1: Watch session instance
let playlistManager = null; // PHASE 2: Playlist manager instance
let recommendationEngine = null; // PHASE 3: Recommendation engine instance
let streamingManager = null; // PHASE 4: Streaming manager instance
let keyboardShortcuts = null; // PHASE 1 POLISH: Keyboard shortcuts
let playlistModal = null; // PHASE 2 POLISH: Playlist modal
let isInitialized = false;
let currentUserId = null;
let viewValidationTimer = null; // 🔧 NEW: Timer for view validation

// TEMPORARILY DISABLE the recent view check for testing
function hasViewedContentRecently(contentId) {
    console.log('🔍 hasViewedContentRecently called - returning FALSE for testing');
    return false;
}

// ============================================
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, starting initialization with home feed UI...');
    
    // Initialize Supabase client
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
    }

    // Load helpers
    if (!window.SupabaseHelper) await import('./js/supabase-helper.js');
    if (!window.AuthHelper) await import('./js/auth-helper.js');
    
    // Wait for helpers
    await waitForHelpers();

    // Setup auth listeners
    setupAuthListeners();

    // Load content
    await loadContentFromURL();

    // Setup UI
    setupEventListeners();

    // Initialize video player
    initializeEnhancedVideoPlayer();

    // Initialize streaming manager (PHASE 4)
    await initializeStreamingManager();

    // Initialize all modals/panels
    initAnalyticsModal();
    initSearchModal();
    initNotificationsPanel();
    initThemeSelector(); // ✅ FIXED: Now this function exists!
    initGlobalNavigation();

    // ============================================
    // HOME FEED UI INTEGRATION - SETUP SIDEBAR, HEADER, NAVIGATION
    // ============================================
    // Initialize UI Scale Controller
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();

    // Setup complete sidebar
    setupCompleteSidebar();
    
    // Setup sidebar navigation
    setupSidebarNavigation();
    
    // Update sidebar profile
    await updateSidebarProfile();
    
    // Update header profile
    await updateHeaderProfile();
    
    // Update profile switcher
    updateProfileSwitcher();
    
    // Setup navigation buttons
    setupNavigationButtons();
    setupNavButtonScrollAnimation();

    // ✅ After auth initialization, update sidebar profile again if needed
    if (window.AuthHelper?.isAuthenticated?.()) {
        await updateSidebarProfile();
    }

    // ✅ FIX: Update comment input state after a brief delay to ensure auth is ready
    setTimeout(updateCommentInputState, 1500);
    
    // Also update when auth state changes
    if (window.supabaseClient?.auth) {
        window.supabaseClient.auth.onAuthStateChange(async () => {
            setTimeout(updateCommentInputState, 300);
        });
    }

    // PHASE 1: Load Continue Watching section (SINGLE SECTION - now below comments)
    if (currentUserId) {
        await loadContinueWatching(currentUserId);
        setupContinueWatchingRefresh();
    }

    // PHASE 2: Initialize Playlist Manager after auth is ready
    if (window.PlaylistManager && currentUserId) {
        await initializePlaylistManager();
    }

    // ============================================
    // PHASE 3: Initialize Recommendation Engine
    // ============================================
    if (currentContent?.id) {
        await initializeRecommendationEngine();
    }

    // ============================================
    // PHASE 1 POLISH: Initialize keyboard shortcuts after video player
    // ============================================
    setTimeout(() => {
        if (enhancedVideoPlayer?.video) {
            initializeKeyboardShortcuts();
        }
    }, 1000);

    // ============================================
    // PHASE 2 POLISH: Initialize playlist modal
    // ============================================
    if (currentUserId && currentContent?.id) {
        setTimeout(() => {
            initializePlaylistModal();
        }, 500);
    }

    // Show app with fallback timeout
    setTimeout(() => {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');
        if (loading && app) {
            loading.style.display = 'none';
            app.style.display = 'block';
        }
    }, 3000); // Fallback after 3 seconds

    // Hide loading and show app
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loading && app) {
        loading.style.display = 'none';
        app.style.display = 'block';
    }

    // ✅ Apply mobile header styles after everything is loaded
    applyMobileHeaderStyles();

    console.log('✅ Content Detail fully initialized with RLS-compliant fixes, PHASE 4 Streaming, and HOME FEED UI');
});

// FINAL SAFETY: Ensure loading screen hides even if errors occur
setTimeout(() => {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loading && app && loading.style.display !== 'none') {
        console.warn('⚠️ Forcing app display after timeout');
        loading.style.display = 'none';
        app.style.display = 'block';
    }
}, 5000); // 5 second fallback

// PHASE 1: Import WatchSession class
if (!window.WatchSession) {
    console.warn('⚠️ WatchSession not loaded, will attempt to load dynamically');
    const script = document.createElement('script');
    script.src = 'js/watch-session.js';
    document.head.appendChild(script);
}

// PHASE 2: Import PlaylistManager class
if (!window.PlaylistManager) {
    console.warn('⚠️ PlaylistManager not loaded, will attempt to load dynamically');
    const script = document.createElement('script');
    script.src = 'js/playlist-manager.js';
    document.head.appendChild(script);
}

// PHASE 3: Import RecommendationEngine class
if (!window.RecommendationEngine) {
    console.warn('⚠️ RecommendationEngine not loaded, will attempt to load dynamically');
    const script = document.createElement('script');
    script.src = 'js/recommendation-engine.js';
    document.head.appendChild(script);
}

// PHASE 4: Import StreamingManager class
if (!window.StreamingManager) {
    console.warn('⚠️ StreamingManager not loaded, will attempt to load dynamically');
    const script = document.createElement('script');
    script.src = 'js/streaming-manager.js';
    document.head.appendChild(script);
}

// ============================================
// PHASE 1 UPDATED: Initialize watch session with session ID and profile ID
// ============================================
function initializeWatchSessionOnPlay() {
    if (!currentContent || !currentUserId || !enhancedVideoPlayer?.video) {
        console.log('🚫 Cannot initialize watch session: missing content, user, or video');
        return;
    }

    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }

    try {
        if (typeof window.WatchSession === 'undefined') {
            console.warn('WatchSession not available, cannot track progress');
            return;
        }

        // ✅ Get or create session ID
        let sessionId = sessionStorage.getItem('bantu_view_session');
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            sessionStorage.setItem('bantu_view_session', sessionId);
        }

        console.log('🎬 Initializing WatchSession with session:', sessionId);
        watchSession = new window.WatchSession({
            contentId: currentContent.id,
            userId: currentUserId,
            supabase: window.supabaseClient,
            videoElement: enhancedVideoPlayer.video,
            sessionId: sessionId, // ✅ Pass session ID
            syncInterval: 10000,
            viewThreshold: 20,
            completionThreshold: 0.9,
            onProgressSync: function(data) {
                console.log('📊 Progress synced:', data);
            },
            onViewCounted: function(data) {
                console.log('👍 View counted:', data);
                refreshCountsFromSource();
            },
            onComplete: function(data) {
                console.log('🏆 Content completed:', data);
                showToast('✅ You finished this video!', 'success');
                const resumeBtn = document.getElementById('resumeBtn');
                if (resumeBtn) {
                    resumeBtn.remove();
                    const playBtn = document.getElementById('playBtn');
                    if (playBtn) playBtn.style.display = 'flex';
                }
            },
            onError: function(error) {
                console.error('❌ Watch session error:', error.context, error.error);
            }
        });
        window._watchSession = watchSession;

        setTimeout(function() {
            if (watchSession && enhancedVideoPlayer && enhancedVideoPlayer.video) {
                watchSession.start(enhancedVideoPlayer.video);
                console.log('✅ Watch session started with session ID:', sessionId);
            }
        }, 500);
    } catch (error) {
        console.error('❌ Failed to initialize watch session:', error);
    }
}

// ============================================
// 🔧 FIXED: Record view when Play button is clicked with YouTube-style validation
// ✅ ADDED: profile_id to insert
// ============================================
function handlePlay() {
    console.log('🎬 handlePlay CALLED - Starting view recording...');
    if (!currentContent) {
        showToast('No content to play', 'error');
        return;
    }
    
    const player = document.getElementById('inlinePlayer');
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!player || !videoElement) {
        showToast('Video player not available', 'error');
        return;
    }

    // ✅ GENERATE NEW SESSION FOR THIS PLAY
    const sessionId = generateNewSession();
    console.log('🎬 New viewing session:', sessionId);

    // ✅ UPDATE UI OPTIMISTICALLY
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
    const newViews = currentViews + 1;
    if (viewsEl && viewsFullEl) {
        viewsEl.textContent = `${formatNumber(newViews)} views`;
        viewsFullEl.textContent = formatNumber(newViews);
    }

    // ✅ RECORD VIEW (ALWAYS, NO CONDITION)
    const contentIdNum = parseInt(currentContent.id);
    console.log('📝 Calling recordContentView with ID:', contentIdNum);
    recordContentView(contentIdNum)
        .then(async function(returnedSessionId) {
            if (returnedSessionId) {
                console.log('✅ View recorded successfully! Session:', returnedSessionId);
                markContentAsViewed(currentContent.id);
                await refreshCountsFromSource();
                startViewValidationTimer(returnedSessionId, contentIdNum);
                if (window.track?.contentView) {
                    window.track.contentView(currentContent.id, 'video');
                }
            } else {
                console.error('❌ Failed to record view - rolling back UI');
                if (viewsEl && viewsFullEl) {
                    viewsEl.textContent = `${formatNumber(currentViews)} views`;
                    viewsFullEl.textContent = formatNumber(currentViews);
                }
            }
        })
        .catch(function(error) {
            console.error('❌ View recording promise rejected:', error);
            if (viewsEl && viewsFullEl) {
                viewsEl.textContent = `${formatNumber(currentViews)} views`;
                viewsFullEl.textContent = formatNumber(currentViews);
            }
        });

    // Continue with video playback setup
    player.style.display = 'block';
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    videoElement.muted = false;
    videoElement.defaultMuted = false;
    videoElement.volume = 1.0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Video source setup (keep your existing working code)
    let fileUrl = currentContent.file_url;
    console.log('📥 Raw file_url from database:', fileUrl);
    if (fileUrl && !fileUrl.startsWith('http')) {
        if (fileUrl.startsWith('/')) fileUrl = fileUrl.substring(1);
        fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
    }
    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined' || fileUrl === '') {
        if (currentContent.thumbnail_url && !currentContent.thumbnail_url.startsWith('http')) {
            const cleanPath = currentContent.thumbnail_url.startsWith('/') ? currentContent.thumbnail_url.substring(1) : currentContent.thumbnail_url;
            fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
        }
    }
    console.log('🎵 Final file URL:', fileUrl);

    const isAudioFile = fileUrl && (fileUrl.includes('.mp3') || fileUrl.includes('.wav') || fileUrl.includes('.ogg') || fileUrl.includes('.aac') || fileUrl.includes('.m4a'));
    const isVideoFile = fileUrl && (fileUrl.includes('.mp4') || fileUrl.includes('.webm') || fileUrl.includes('.mov'));

    if (!fileUrl || (!isAudioFile && !isVideoFile)) {
        console.error('❌ Invalid file format:', fileUrl);
        showToast('Invalid file format', 'error');
        return;
    }

    if (isAudioFile && currentContent.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(currentContent.thumbnail_url) || currentContent.thumbnail_url;
        videoElement.setAttribute('poster', imgUrl);
    } else {
        videoElement.removeAttribute('poster');
    }

    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.setAttribute('data-media-type', isAudioFile ? 'audio' : 'video');
    }

    if (enhancedVideoPlayer) {
        try { enhancedVideoPlayer.destroy(); } catch(e) {}
        enhancedVideoPlayer = null;
    }
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }

    while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
    videoElement.removeAttribute('src');
    videoElement.src = '';

    const source = document.createElement('source');
    source.src = fileUrl;
    if (isAudioFile) {
        if (fileUrl.endsWith('.mp3')) source.type = 'audio/mpeg';
        else if (fileUrl.endsWith('.wav')) source.type = 'audio/wav';
        else if (fileUrl.endsWith('.ogg')) source.type = 'audio/ogg';
        else source.type = 'audio/mpeg';
    } else {
        if (fileUrl.endsWith('.mp4')) source.type = 'video/mp4';
        else if (fileUrl.endsWith('.webm')) source.type = 'video/webm';
        else source.type = 'video/mp4';
    }
    videoElement.appendChild(source);
    videoElement.load();

    initializeEnhancedVideoPlayer();
    setTimeout(() => {
        if (streamingManager) {
            streamingManager.destroy();
            streamingManager = null;
        }
        initializeStreamingManager();
    }, 100);

    setTimeout(() => {
        if (enhancedVideoPlayer) {
            enhancedVideoPlayer.play().catch(err => console.error('Play failed:', err));
        } else {
            videoElement.play().catch(err => console.error('Autoplay failed:', err));
        }
    }, 500);

    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ============================================
// PHASE 1 POLISH: Initialize Keyboard Shortcuts
// ============================================
function initializeKeyboardShortcuts() {
    if (!window.KeyboardShortcuts) {
        console.warn('⚠️ KeyboardShortcuts not loaded yet');
        return;
    }
    if (!enhancedVideoPlayer?.video) {
        console.warn('⚠️ Video player not ready for keyboard shortcuts');
        return;
    }

    try {
        keyboardShortcuts = new window.KeyboardShortcuts({
            videoElement: enhancedVideoPlayer.video,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id
        });
        window.keyboardShortcuts = keyboardShortcuts;
        console.log('✅ Keyboard shortcuts initialized');
    } catch (error) {
        console.error('❌ Failed to initialize keyboard shortcuts:', error);
    }
}

// ============================================
// PHASE 2 POLISH: Initialize Playlist Modal
// ============================================
function initializePlaylistModal() {
    if (!window.PlaylistModal) {
        console.warn('⚠️ PlaylistModal not loaded yet');
        return;
    }
    if (!currentUserId || !currentContent?.id) {
        console.warn('⚠️ Cannot initialize playlist modal: missing user or content');
        return;
    }

    try {
        playlistModal = new window.PlaylistModal({
            supabase: window.supabaseClient,
            userId: currentUserId,
            contentId: currentContent.id
        });
        window.playlistModal = playlistModal;

        // Update Watch Later button to open modal
        const watchLaterBtn = document.getElementById('watchLaterBtn');
        if (watchLaterBtn) {
            // Clone to remove existing listeners
            const newBtn = watchLaterBtn.cloneNode(true);
            watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!currentUserId) {
                    showToast('Please sign in to use playlists', 'warning');
                    const redirect = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${redirect}`;
                    return;
                }
                playlistModal.open();
            });
        }
        console.log('✅ Playlist modal initialized');
    } catch (error) {
        console.error('❌ Failed to initialize playlist modal:', error);
    }
}

async function waitForHelpers() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.SupabaseHelper?.isInitialized && window.AuthHelper?.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

// ============================================
// PHASE 2: PLAYLIST MANAGER INITIALIZATION
// ============================================
async function initializePlaylistManager() {
    if (typeof window.PlaylistManager !== 'function') {
        console.warn('⚠️ PlaylistManager class not found — check script load order');
        return;
    }
    if (!currentUserId) {
        console.log('🔓 Guest user — playlist features disabled');
        return;
    }

    try {
        playlistManager = new window.PlaylistManager({
            supabase: window.supabaseClient,
            userId: currentUserId,
            watchLaterName: 'Watch Later',
            onPlaylistUpdated: function(data) {
                console.log('📋 Playlist updated:', data);
                updateWatchLaterButtonState();
            },
            onError: function(err) {
                console.error('❌ Playlist error:', err);
                showToast('Playlist error: ' + (err.error || err.message), 'error');
            }
        });
        await updateWatchLaterButtonState();
        console.log('✅ PlaylistManager initialized');
    } catch (error) {
        console.error('❌ Failed to initialize PlaylistManager:', error);
        showToast('Watch Later unavailable', 'warning');
    }
}

// ============================================
// PHASE 3: RECOMMENDATION ENGINE INITIALIZATION
// ============================================
async function initializeRecommendationEngine() {
    if (!window.RecommendationEngine) {
        console.warn('⚠️ RecommendationEngine not loaded');
        return;
    }
    if (!currentContent?.id) {
        console.warn('⚠️ No content loaded for recommendations');
        return;
    }

    try {
        recommendationEngine = new window.RecommendationEngine({
            supabase: window.supabaseClient,
            userId: currentUserId,
            currentContentId: currentContent.id,
            limit: 8,
            minWatchThreshold: 0.5,
            cacheDuration: 60000
        });
        await loadRecommendationRails();
        console.log('✅ RecommendationEngine initialized');
    } catch (error) {
        console.error('❌ Failed to initialize RecommendationEngine:', error);
    }
}

// ============================================
// PHASE 4: STREAMING MANAGER INITIALIZATION
// ============================================
async function initializeStreamingManager() {
    if (!window.StreamingManager) {
        console.warn('⚠️ StreamingManager not loaded');
        return;
    }

    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;

    try {
        streamingManager = new window.StreamingManager({
            videoElement: videoElement,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id,
            userId: currentUserId,
            onQualityChange: function(data) {
                console.log('📺 Quality changed:', data);
                updateQualityIndicator(data.quality);
                showToast('Quality: ' + data.quality, 'info');
                // Refresh quality selector UI
                setupQualitySelector();
            },
            onDataSaverToggle: function(data) {
                console.log('💾 Data saver:', data.enabled ? 'ON' : 'OFF');
                updateQualityIndicator(streamingManager.getCurrentQuality());
                showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
            },
            onError: function(err) {
                console.error('❌ Streaming error:', err);
            }
        });
        await streamingManager.initialize();

        // Set up periodic network speed updates
        setInterval(() => {
            if (streamingManager) {
                const speed = streamingManager.getNetworkSpeed();
                if (speed) {
                    updateNetworkSpeedIndicator(speed / 1000000);
                }
            }
        }, 5000);

        // ✅ CRITICAL: Setup quality selector AFTER streaming manager is ready
        setupQualitySelector();
        setupDataSaverToggle();

        // Initialize quality indicator with current quality
        setTimeout(() => {
            if (streamingManager) {
                updateQualityIndicator(streamingManager.getCurrentQuality());
            }
        }, 1000);

        console.log('✅ StreamingManager initialized');
    } catch (error) {
        console.error('❌ Failed to initialize StreamingManager:', error);
    }
}

// ============================================
// PHASE 4: Setup quality selector UI with streaming manager integration
// ============================================
function setupQualitySelector() {
    const qualityContainer = document.getElementById('qualityOptions');
    if (!qualityContainer) {
        console.warn('⚠️ Quality options container not found');
        return;
    }

    // Get available qualities from streaming manager
    const qualities = streamingManager?.getAvailableQualities?.() || [
        { label: 'Auto', value: 'auto' },
        { label: '1080p', value: '1080p' },
        { label: '720p', value: '720p' },
        { label: '480p', value: '480p' },
        { label: '360p', value: '360p' }
    ];

    console.log('📺 Setting up quality selector with', qualities.length, 'qualities');

    // Render quality options
    qualityContainer.innerHTML = qualities.map(q => `
        <button class="quality-option ${q.value === streamingManager?.getCurrentQuality?.() ? 'active' : ''}"
                data-quality="${q.value}">
            ${q.label}
        </button>
    `).join('');

    // Attach click handlers
    qualityContainer.querySelectorAll('.quality-option').forEach(btn => {
        btn.addEventListener('click', async function() {
            const quality = this.dataset.quality;
            // Update UI
            qualityContainer.querySelectorAll('.quality-option').forEach(b =>
                b.classList.remove('active')
            );
            this.classList.add('active');

            // Change quality via streaming manager
            if (streamingManager) {
                await streamingManager.setQuality(quality);
                console.log('📺 Quality changed to:', quality);
                showToast('Quality: ' + quality.toUpperCase(), 'info');
            }

            // Close settings menu
            const settingsMenu = document.querySelector('.settings-menu');
            if (settingsMenu) {
                settingsMenu.classList.remove('active');
            }
        });
    });
    console.log('✅ Quality selector initialized');
}

// PHASE 4: Setup data saver toggle
function setupDataSaverToggle() {
    const toggle = document.getElementById('dataSaverToggle');
    if (!toggle) return;

    if (streamingManager?.isDataSaverEnabled()) {
        toggle.checked = true;
    }

    toggle.addEventListener('change', async function() {
        if (streamingManager) {
            streamingManager.toggleDataSaver(this.checked);
        }
    });
}

// Authentication setup
function setupAuthListeners() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await window.AuthHelper.initialize();
            currentUserId = window.AuthHelper.getUserProfile()?.id || null;
            updateProfileUI();
            showToast('Welcome back!', 'success');
            
            if (currentUserId) {
                await loadContinueWatching(currentUserId);
            }
            if (window.PlaylistManager && !playlistManager) {
                await initializePlaylistManager();
            }
            if (recommendationEngine) {
                recommendationEngine.userId = currentUserId;
                await loadRecommendationRails();
            }
            if (streamingManager) {
                streamingManager.userId = currentUserId;
            }
            
            // Re-initialize playlist modal if needed
            if (currentContent?.id && !playlistModal) {
                setTimeout(initializePlaylistModal, 500);
            }

            // Update home feed UI components
            await updateSidebarProfile();
            await updateHeaderProfile();
            updateProfileSwitcher();
            
            // ✅ Update comment input state after sign in
            setTimeout(updateCommentInputState, 300);

        } else if (event === 'SIGNED_OUT') {
            currentUserId = null;
            playlistManager = null;
            playlistModal = null;
            resetProfileUI();
            showToast('Signed out successfully', 'info');
            
            const continueSection = document.getElementById('continueWatchingSection');
            if (continueSection) continueSection.style.display = 'none';
            
            if (watchSession) {
                watchSession.stop();
                watchSession = null;
            }

            const watchLaterBtn = document.getElementById('watchLaterBtn');
            if (watchLaterBtn) {
                watchLaterBtn.classList.remove('active');
                watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
            }

            if (recommendationEngine) {
                recommendationEngine.userId = null;
                await loadRecommendationRails();
            }
            if (streamingManager) {
                streamingManager.userId = null;
            }

            // Reset home feed UI components
            resetSidebarProfile();
            resetHeaderProfile();
            
            // ✅ Update comment input state after sign out
            setTimeout(updateCommentInputState, 300);
        }
    });

    if (window.AuthHelper?.isAuthenticated?.()) {
        currentUserId = window.AuthHelper.getUserProfile()?.id || null;
        updateProfileUI();
    } else {
        resetProfileUI();
    }
    
    // ✅ Initial comment input state update
    setTimeout(updateCommentInputState, 500);
}

function updateProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
    if (!profileBtn || !userProfilePlaceholder) return;

    if (window.AuthHelper?.isAuthenticated?.()) {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        const initial = displayName.charAt(0).toUpperCase();

        if (avatarUrl) {
            userProfilePlaceholder.innerHTML = `
                <img src="${avatarUrl}" alt="${displayName}"
                     class="profile-img"
                     style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
            `;
        } else {
            userProfilePlaceholder.innerHTML = `
                <div class="profile-placeholder" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                ">${initial}</div>
            `;
        }

        profileBtn.onclick = () => {
            window.location.href = 'profile.html';
        };
    } else {
        userProfilePlaceholder.innerHTML = `
            <div class="profile-placeholder">
                <i class="fas fa-user"></i>
            </div>
        `;
        profileBtn.onclick = () => {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        };
    }
    
    // ✅ Apply mobile header styles after updating profile UI
    applyMobileHeaderStyles();
    // ✅ Update comment input state directly (no duplicate check)
    updateCommentInputState();
}

function resetProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
    if (!profileBtn || !userProfilePlaceholder) return;

    userProfilePlaceholder.innerHTML = `
        <div class="profile-placeholder">
            <i class="fas fa-user"></i>
        </div>
    `;
    profileBtn.onclick = () => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    };
    // ✅ Apply mobile header styles after reset
    applyMobileHeaderStyles();
    // ✅ Update comment input state for guest
    updateCommentInputState();
}

// Reset sidebar profile for guest state
function resetSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    if (name) name.textContent = 'Guest';
    if (email) email.textContent = 'Sign in to continue';
    if (avatar) avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
}

// Reset header profile for guest state
function resetHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const currentProfileName = document.getElementById('current-profile-name');
    if (profilePlaceholder) {
        profilePlaceholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
    }
    if (currentProfileName) {
        currentProfileName.textContent = 'Guest';
    }
    // ✅ Apply mobile header styles after reset
    applyMobileHeaderStyles();
}

// ============================================
// FIXED: Load content with ACCURATE counts from source tables
// ✅ CRITICAL: Include user_profiles with avatar_url
// ============================================
async function loadContentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id') || '68';
    
    try {
        // ✅ CRITICAL: Ensure user_profiles includes avatar_url
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('id', contentId)
            .single();

        if (contentError) throw contentError;

        const { count: viewsCount, error: viewsError } = await window.supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentId);

        const { count: likesCount, error: likesError } = await window.supabaseClient
            .from('content_likes')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentId);

        let watchProgress = null;
        if (currentUserId) {
            const { data: progressData } = await window.supabaseClient
                .from('watch_progress')
                .select('last_position, is_completed')
                .eq('user_id', currentUserId)
                .eq('content_id', contentId)
                .maybeSingle();
            watchProgress = progressData;
        }

        // Get quality profiles and HLS manifest URL (PHASE 4)
        const { data: streamingData } = await window.supabaseClient
            .from('Content')
            .select('quality_profiles, hls_manifest_url, data_saver_url')
            .eq('id', contentId)
            .single();

        currentContent = {
            id: contentData.id,
            title: contentData.title || 'Untitled',
            description: contentData.description || '',
            thumbnail_url: contentData.thumbnail_url,
            file_url: contentData.file_url,
            media_type: contentData.media_type || 'video',
            genre: contentData.genre || 'General',
            created_at: contentData.created_at,
            duration: contentData.duration || contentData.duration_seconds || 3600,
            language: contentData.language || 'English',
            views_count: viewsCount || 0,
            likes_count: likesCount || 0,
            favorites_count: contentData.favorites_count || 0,
            comments_count: contentData.comments_count || 0,
            creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_id: contentData.user_profiles?.id || contentData.user_id,
            user_id: contentData.user_id,
            // ✅ CRITICAL: Include full user_profiles object with avatar_url
            user_profiles: contentData.user_profiles,
            watch_progress: watchProgress?.last_position || 0,
            is_completed: watchProgress?.is_completed || false,
            // PHASE 4: Streaming data
            quality_profiles: streamingData?.quality_profiles || [],
            hls_manifest_url: streamingData?.hls_manifest_url || null,
            data_saver_url: streamingData?.data_saver_url || null
        };

        console.log('📥 Content loaded with ACCURATE counts and creator data:', {
            views: currentContent.views_count,
            likes: currentContent.likes_count,
            creator: currentContent.creator,
            creator_id: currentContent.creator_id,
            has_avatar: !!currentContent.user_profiles?.avatar_url,
            avatar_url: currentContent.user_profiles?.avatar_url,
            watch_progress: currentContent.watch_progress,
            hls_available: !!currentContent.hls_manifest_url
        });

        updateContentUI(currentContent);
        
        if (currentContent.watch_progress > 10 && !currentContent.is_completed) {
            addResumeButton(currentContent.watch_progress);
        }
        
        if (currentUserId) {
            await initializeLikeButton(contentId, currentUserId);
            await initializeFavoriteButton(contentId, currentUserId);
        }
        
        if (playlistManager) {
            await updateWatchLaterButtonState();
        }
        
        await loadComments(contentId);
        await loadRelatedContent(contentId);
    } catch (error) {
        console.error('❌ Content load failed:', error);
        showToast('Content not available. Please try again.', 'error');
        document.getElementById('contentTitle').textContent = 'Content Unavailable';
    }
}

// PHASE 1: Add resume button to hero actions
function addResumeButton(progressSeconds) {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    if (document.getElementById('resumeBtn')) return;

    const resumeBtn = document.createElement('button');
    resumeBtn.id = 'resumeBtn';
    resumeBtn.className = 'btn btn-primary resume-btn';
    resumeBtn.innerHTML = `
        <i class="fas fa-play"></i>
        <span>Resume (${formatDuration(progressSeconds)})</span>
    `;
    resumeBtn.addEventListener('click', handlePlay);

    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        heroActions.insertBefore(resumeBtn, playBtn);
        playBtn.style.display = 'none';
    } else {
        heroActions.prepend(resumeBtn);
    }
}

async function checkUserLike(contentId, userId) {
    if (!userId) return false;
    try {
        const { data, error } = await window.supabaseClient
            .from('content_likes')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .single();
        if (error?.code === 'PGRST116') return false;
        if (error) {
            console.warn('Like check failed:', error.message);
            return false;
        }
        return !!data;
    } catch (error) {
        console.error('Like check error:', error);
        return false;
    }
}

async function initializeLikeButton(contentId, userId) {
    const likeBtn = document.getElementById('likeBtn');
    if (!likeBtn) return;

    likeBtn.classList.remove('active');
    likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
    if (!userId) return;

    const isLiked = await checkUserLike(contentId, userId);
    if (isLiked) {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
    }
}

async function checkUserFavorite(contentId, userId) {
    if (!userId) return false;
    try {
        const { data, error } = await window.supabaseClient
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .single();
        if (error?.code === 'PGRST116') return false;
        if (error) {
            console.warn('Favorite check failed:', error.message);
            return false;
        }
        return !!data;
    } catch (error) {
        console.error('Favorite check error:', error);
        return false;
    }
}

async function initializeFavoriteButton(contentId, userId) {
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (!favoriteBtn) return;

    favoriteBtn.classList.remove('active');
    favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
    if (!userId) return;

    const isFavorited = await checkUserFavorite(contentId, userId);
    if (isFavorited) {
        favoriteBtn.classList.add('active');
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
    }
}

// ============================================
// 🎯 FIXED: Update Content UI with Creator Avatar
// ============================================
function updateContentUI(content) {
    if (!content) return;
    
    safeSetText('contentTitle', content.title);
    safeSetText('creatorName', content.creator);
    safeSetText('creatorDisplayName', content.creator_display_name);
    safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
    safeSetText('viewsCountFull', formatNumber(content.views_count));
    safeSetText('likesCount', formatNumber(content.likes_count));
    safeSetText('favoritesCount', formatNumber(content.favorites_count));
    safeSetText('commentsCount', `(${formatNumber(content.comments_count)})`);
    
    const duration = formatDuration(content.duration || 3600);
    safeSetText('durationText', duration);
    safeSetText('contentDurationFull', duration);
    safeSetText('uploadDate', formatDate(content.created_at));
    safeSetText('contentGenre', content.genre || 'General');
    safeSetText('contentDescriptionShort', truncateText(content.description, 150));
    safeSetText('contentDescriptionFull', content.description);

    // ============================================
    // ✅ CRITICAL FIX: SET CREATOR AVATAR
    // ============================================
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (creatorAvatar && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || 'Creator';
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            // ✅ Use actual avatar URL
            const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}"
                     alt="${escapeHtml(displayName)}"
                     style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
            console.log('✅ Creator avatar set from URL:', fixedAvatarUrl);
        } else {
            // ✅ Fallback to initials with gradient
            creatorAvatar.innerHTML = `
                <div style="
                    width:100%;
                    height:100%;
                    border-radius:50%;
                    background:linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:white;
                    font-weight:bold;
                    font-size:1.5rem;
                ">${initial}</div>
            `;
            console.log('✅ Creator avatar fallback to initials:', initial);
        }
    } else {
        console.warn('⚠️ Creator avatar element or user_profiles not found:', {
            hasCreatorAvatar: !!document.getElementById('creatorAvatar'),
            hasUserProfiles: !!content.user_profiles
        });
    }

    // ============================================
    // ✅ CRITICAL FIX: MAKE CREATOR SECTION CLICKABLE
    // ============================================
    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    if (creatorSection && content.creator_id) {
        creatorSection.style.cursor = 'pointer';
        if (creatorInfo) {
            // Remove existing listeners by cloning
            const newCreatorInfo = creatorInfo.cloneNode(true);
            creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
            newCreatorInfo.addEventListener('click', function(e) {
                // Don't trigger if clicking connect button
                if (e.target.closest('.connect-btn')) return;
                window.location.href = `creator-channel.html?id=${content.creator_id}&name=${encodeURIComponent(content.creator_display_name)}`;
            });
        }
    }

    const posterPlaceholder = document.getElementById('posterPlaceholder');
    if (posterPlaceholder && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        posterPlaceholder.innerHTML = `
            <img src="${imgUrl}" alt="${content.title}"
                 style="width:100%; height:100%; object-fit:cover; border-radius: 12px;"
                 onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop'">
            <div class="play-overlay">
                <div class="play-icon-large">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }

    // 🎯 REMOVED: Player title "Now Playing" header - no longer used
}

// ✅ FIXED: loadComments - REMOVED creator_id from update
async function loadComments(contentId) {
    try {
        console.log('💬 Loading comments for content:', contentId);
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', contentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`✅ Loaded ${comments.length} comments`);
        renderComments(comments || []);

        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments.length})`;
        }

        // ✅ FIXED: Update comments_count - NO creator_id condition
        if (currentContent) {
            const { error: updateError } = await window.supabaseClient
                .from('Content')
                .update({ comments_count: comments.length })
                .eq('id', currentContent.id);  // ✅ Only use id, NOT creator_id
            if (updateError) {
                console.warn('Failed to update comments_count:', updateError);
            }
        }
    } catch (error) {
        console.error('❌ Comments load failed:', error);
        showToast('Failed to load comments', 'error');
        renderComments([]);
    }
}

function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    if (!container) return;

    container.innerHTML = '';
    if (!comments || comments.length === 0) {
        if (noComments) noComments.style.display = 'flex';
        if (countEl) countEl.textContent = '(0)';
        return;
    }
    if (noComments) noComments.style.display = 'none';
    if (countEl) countEl.textContent = `(${comments.length})`;

    const fragment = document.createDocumentFragment();
    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        fragment.appendChild(commentEl);
    });
    container.appendChild(fragment);
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    let authorName = comment.author_name || 'User';
    let avatarUrl = comment.author_avatar || null;
    const time = formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    const initial = authorName.charAt(0).toUpperCase();

    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl ? 
                    `<img src="${avatarUrl}" alt="${authorName}"
                          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);">` : 
                    `<div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        border: 2px solid rgba(29, 78, 216, 0.2);
                    ">
                        ${initial}
                    </div>`
                }
            </div>
            <div class="comment-user">
                <strong>${escapeHtml(authorName)}</strong>
                <div class="comment-time">${time}</div>
            </div>
        </div>
        <div class="comment-content">
            ${escapeHtml(commentText)}
        </div>
    `;
    return div;
}

// ============================================
// FIXED: Load related content with REAL view counts from source table
// ============================================
async function loadRelatedContent(contentId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('id, title, thumbnail_url, user_id, genre, duration, media_type, status, user_profiles!user_id(full_name, username)')
            .neq('id', contentId)
            .eq('status', 'published')
            .limit(6);

        if (error) throw error;

        const relatedWithViews = await Promise.all(
            (data || []).map(async (item) => {
                const { count: realViews } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                return { ...item, real_views_count: realViews || 0 };
            })
        );
        renderRelatedContent(relatedWithViews);
    } catch (error) {
        console.error('Error loading related content:', error);
        renderRelatedContent([]);
    }
}

// ============================================
// FIXED: Render related content with REAL view counts
// ============================================
function renderRelatedContent(items) {
    const container = document.getElementById('relatedGrid');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="related-placeholder card">
                <i class="fas fa-video-slash"></i>
                <p>No related content found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${item.id}`;
        card.onclick = function(e) {
            e.preventDefault();
            window.location.href = `content-detail.html?id=${item.id}`;
        };

        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
        const title = item.title || 'Untitled';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : 0;

        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${imgUrl}" alt="${title}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${truncateText(title, 50)}</h3>
                <div class="related-meta">
                    <i class="fas fa-eye"></i>
                    <span>${formatNumber(viewsCount)} views</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ====================================================
// VIDEO PLAYER INITIALIZATION - WITH LOAD CONFIRMATION
// ====================================================
function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');
    if (!videoElement || !videoContainer) {
        console.warn('⚠️ Video elements not found');
        return;
    }

    try {
        const preferences = window.state ? window.state.getPreferences() : {
            autoplay: false,
            playbackSpeed: 1.0,
            quality: 'auto'
        };

        console.log('🎬 Creating EnhancedVideoPlayer with content:', currentContent?.id);
        enhancedVideoPlayer = new EnhancedVideoPlayer({
            autoplay: preferences.autoplay,
            defaultSpeed: preferences.playbackSpeed,
            defaultQuality: preferences.quality,
            defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
            muted: window.stateManager ? window.stateManager.getState('session.muted') : false,
            contentId: currentContent?.id || null,
            supabaseClient: window.supabaseClient,
            userId: currentUserId
        });
        enhancedVideoPlayer.attach(videoElement, videoContainer);

        enhancedVideoPlayer.on('play', () => {
            console.log('▶️ Video playing...');
            if (window.stateManager) {
                window.stateManager.setState('session.playing', true);
            }
            initializeWatchSessionOnPlay();
        });

        enhancedVideoPlayer.on('pause', () => {
            if (window.stateManager) {
                window.stateManager.setState('session.playing', false);
            }
        });

        enhancedVideoPlayer.on('volumechange', (volume) => {
            if (window.stateManager) {
                window.stateManager.setState('session.volume', volume);
            }
        });

        enhancedVideoPlayer.on('error', (error) => {
            console.error('🔴 Video player error:', error);
            showToast('Playback error occurred', 'error');
        });

        // ✅ FIXED: Add video load confirmation events
        enhancedVideoPlayer.on('loadeddata', () => {
            console.log('✅ Video metadata loaded, ready to play');
            // Hide any loading indicators
            const placeholder = document.getElementById('videoPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });

        enhancedVideoPlayer.on('canplay', () => {
            console.log('✅ Video can start playing');
        });

        console.log('✅ Enhanced video player initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
        showToast('Video player failed to load. Using basic player.', 'warning');
        videoElement.controls = true;
    }
}

// ============================================
// 🎯 CLOSE PLAYER FUNCTION (UPDATED)
// ============================================
function closeVideoPlayer() {
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');

    // Hide player
    if (player) {
        player.style.display = 'none';
    }

    // Stop video
    if (video) {
        video.pause();
        video.currentTime = 0;
    }

    // Clean up sessions
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    if (enhancedVideoPlayer) {
        if (enhancedVideoPlayer.video) {
            enhancedVideoPlayer.video.pause();
            enhancedVideoPlayer.video.currentTime = 0;
        }
        enhancedVideoPlayer.destroy();
        enhancedVideoPlayer = null;
    }
    if (streamingManager) {
        streamingManager.destroy();
        streamingManager = null;
    }

    // Clear view validation timer
    if (viewValidationTimer) {
        clearTimeout(viewValidationTimer);
        viewValidationTimer = null;
    }

    // Show placeholder again
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }

    // ✅ Restore hero poster opacity
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.style.opacity = '1';
    }

    // ✅ Hide close button in hero actions
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.style.display = 'none';
    }

    // Scroll to hero section (now visible again)
    const hero = document.querySelector('.content-hero');
    if (hero) {
        hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', handlePlay);
    }

    const poster = document.getElementById('heroPoster');
    if (poster) {
        poster.addEventListener('click', handlePlay);
    }

    // ✅ Close player from hero actions button
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.addEventListener('click', function() {
            closeVideoPlayer();
        });
    }
    
    // ❌ Old close button removed - no longer in DOM
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullPlayerBtn = document.getElementById('fullPlayerBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (enhancedVideoPlayer) {
                enhancedVideoPlayer.toggleFullscreen();
            }
        });
    }
    if (fullPlayerBtn) {
        fullPlayerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (enhancedVideoPlayer) {
                enhancedVideoPlayer.toggleFullscreen();
            }
        });
    }

    // ============================================
    // LIKE BUTTON - RLS-COMPLIANT, TRIGGER-INDEPENDENT ✅
    // ============================================
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async function() {
            // Guard clauses
            if (!currentContent) return;
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to like content', 'warning');
                return;
            }
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            // Get current state
            const isLiked = likeBtn.classList.contains('active');
            const likesCountEl = document.getElementById('likesCount');
            const currentLikes = parseInt(likesCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;

            try {
                // ===== OPTIMISTIC UI UPDATE =====
                likeBtn.classList.toggle('active', !isLiked);
                likeBtn.innerHTML = !isLiked
                    ? '<i class="fas fa-heart"></i><span>Liked</span>'
                    : '<i class="far fa-heart"></i><span>Like</span>';
                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(newLikes);
                }

                // ===== DATABASE OPERATION: Insert/Delete Like =====
                if (!isLiked) {
                    // LIKE: Insert new record
                    const { error: insertError } = await window.supabaseClient
                        .from('content_likes')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });
                    if (insertError) throw insertError;
                } else {
                    // UNLIKE: Delete record with BOTH WHERE clauses (RLS compliant)
                    const { error: deleteError } = await window.supabaseClient
                        .from('content_likes')
                        .delete()
                        .eq('user_id', userProfile.id)      // ← WHERE clause #1
                        .eq('content_id', currentContent.id); // ← WHERE clause #2
                    if (deleteError) throw deleteError;
                }

                // ===== FETCH UPDATED COUNT FROM SOURCE TABLE =====
                // This bypasses any trigger issues by counting directly
                const { count, error: countError } = await window.supabaseClient
                    .from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', currentContent.id);
                if (countError) throw countError;

                // ===== UPDATE UI WITH ACCURATE COUNT =====
                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(count || 0);
                }

                // Show success message
                showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');

                // Optional: Track analytics
                if (window.track?.contentLike) {
                    window.track.contentLike(currentContent.id, !isLiked);
                }
            } catch (error) {
                console.error('Like operation failed:', error);
                // ===== ROLLBACK UI ON ERROR =====
                likeBtn.classList.toggle('active', isLiked);
                likeBtn.innerHTML = isLiked
                    ? '<i class="fas fa-heart"></i><span>Liked</span>'
                    : '<i class="far fa-heart"></i><span>Like</span>';
                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(currentLikes);
                }
                showToast('Failed: ' + error.message, 'error');
            }
        });
    }

    // ============================================
    // FAVORITE BUTTON
    // ============================================
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async function() {
            if (!currentContent) return;
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to favorite content', 'warning');
                return;
            }
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            const isFavorited = favoriteBtn.classList.contains('active');
            const favCountEl = document.getElementById('favoritesCount');
            const currentFavorites = parseInt(favCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newFavorites = isFavorited ? currentFavorites - 1 : currentFavorites + 1;

            try {
                favoriteBtn.classList.toggle('active', !isFavorited);
                favoriteBtn.innerHTML = !isFavorited
                    ? '<i class="fas fa-star"></i><span>Favorited</span>'
                    : '<i class="far fa-star"></i><span>Favorite</span>';
                if (favCountEl) {
                    favCountEl.textContent = formatNumber(newFavorites);
                }

                if (!isFavorited) {
                    const { error } = await window.supabaseClient
                        .from('favorites')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });
                    if (error) throw error;
                } else {
                    const { error } = await window.supabaseClient
                        .from('favorites')
                        .delete()
                        .eq('user_id', userProfile.id)
                        .eq('content_id', currentContent.id);
                    if (error) throw error;
                }

                const { error: updateError } = await window.supabaseClient
                    .from('Content')
                    .update({ favorites_count: newFavorites })
                    .eq('id', currentContent.id);
                if (updateError) {
                    console.warn('Favorites count update failed:', updateError);
                }

                currentContent.favorites_count = newFavorites;
                showToast(!isFavorited ? 'Added to favorites!' : 'Removed from favorites', !isFavorited ? 'success' : 'info');
                await refreshCountsFromSource();
            } catch (error) {
                console.error('Favorite update failed:', error);
                favoriteBtn.classList.toggle('active', isFavorited);
                favoriteBtn.innerHTML = isFavorited
                    ? '<i class="fas fa-star"></i><span>Favorited</span>'
                    : '<i class="far fa-star"></i><span>Favorite</span>';
                if (favCountEl) {
                    favCountEl.textContent = formatNumber(currentFavorites);
                }
                showToast('Failed to update favorite', 'error');
            }
        });
    }

    // ============================================
    // PHASE 2: WATCH LATER BUTTON (uses modal now)
    // ============================================
    // The Watch Later button is now handled in initializePlaylistModal
    // This is a fallback in case modal isn't initialized yet
    setupWatchLaterButton();
    
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            if (currentContent) {
                showToast('Refreshing comments...', 'info');
                await loadComments(currentContent.id);
                showToast('Comments refreshed!', 'success');
            }
        });
    }

    // ============================================
    // COMMENT SUBMISSION HANDLER
    // ============================================
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');
    if (sendBtn && commentInput) {
        sendBtn.addEventListener('click', async function() {
            const text = commentInput.value.trim();
            if (!text) {
                showToast('Please enter a comment', 'warning');
                return;
            }
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('You need to sign in to comment', 'warning');
                return;
            }
            if (!currentContent) return;

            const originalHTML = sendBtn.innerHTML;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            sendBtn.disabled = true;

            try {
                const userProfile = window.AuthHelper.getUserProfile();
                const displayName = window.AuthHelper.getDisplayName();
                const avatarUrl = window.AuthHelper.getAvatarUrl();
                if (!userProfile?.id) {
                    throw new Error('User profile not found');
                }

                const { data: newComment, error: insertError } = await window.supabaseClient
                    .from('comments')
                    .insert({
                        content_id: currentContent.id,
                        user_id: userProfile.id,
                        author_name: displayName,
                        comment_text: text,
                        author_avatar: avatarUrl || null,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Comment insert error:', insertError);
                    throw insertError;
                }

                console.log('✅ Comment inserted:', newComment);
                await loadComments(currentContent.id);
                await refreshCountsFromSource();
                commentInput.value = '';
                showToast('Comment added!', 'success');
                if (window.track?.contentComment) {
                    window.track.contentComment(currentContent.id);
                }
            } catch (error) {
                console.error('❌ Comment submission failed:', error);
                showToast(error.message || 'Failed to add comment', 'error');
            } finally {
                sendBtn.innerHTML = originalHTML;
                sendBtn.disabled = false;
            }
        });

        commentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    }

    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopBtn.style.display = 'flex';
            } else {
                backToTopBtn.style.display = 'none';
            }
        });
    }

    const pipBtn = document.getElementById('pipBtn');
    if (pipBtn) {
        pipBtn.addEventListener('click', function() {
            const video = document.getElementById('inlineVideoPlayer');
            if (video.requestPictureInPicture && document.pictureInPictureElement !== video) {
                video.requestPictureInPicture();
            }
        });
    }

    // ============================================
    // FIXED: SHARE BUTTON WITH BRAND IDENTITY
    // ============================================
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async function() {
            if (!currentContent) return;
            
            const shareText = `📺 ${currentContent.title}
${currentContent.description || 'Check out this amazing content!'}
👉 Watch on Bantu Stream Connect
NO DNA, JUST RSA
`;
            const shareUrl = window.location.href;

            try {
                if (navigator.share && navigator.canShare({ text: shareText, url: shareUrl })) {
                    await navigator.share({
                        title: 'Bantu Stream Connect',
                        text: shareText,
                        url: shareUrl
                    });
                } else {
                    await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
                    showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
                    if (window.track?.contentShare) {
                        window.track.contentShare(currentContent.id, 'clipboard');
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    showToast('Failed to share. Try copying link manually.', 'error');
                }
            }
        });
    }

    setupConnectButtons();
    console.log('✅ Event listeners setup complete');
}

// ====================================================
// SINGLE-TABLE FIX: CONNECT BUTTONS WITH CONNECTORS TABLE
// ✅ FIXED: Always returns a Promise to prevent ".then is not a function" error
// ====================================================
function setupConnectButtons() {
    // ✅ FIXED: Always return a Promise
    function checkConnectionStatus(creatorId) {
        return new Promise(async (resolve) => {
            if (!window.AuthHelper?.isAuthenticated() || !creatorId) {
                resolve(false);
                return;
            }
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                resolve(false);
                return;
            }

            try {
                const { data, error } = await window.supabaseClient
                    .from('connectors')
                    .select('id')
                    .eq('connector_id', userProfile.id)
                    .eq('connected_id', creatorId)
                    .single();
                resolve(!error && data !== null);
            } catch (err) {
                console.warn('Connection check error:', err);
                resolve(false);
            }
        });
    }

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn && currentContent?.creator_id) {
        // ✅ Now .then() will always work
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });

        connectBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }

            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            const isConnected = connectBtn.classList.contains('connected');
            try {
                if (isConnected) {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    if (error) throw error;
                    connectBtn.classList.remove('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    if (error) throw error;
                    connectBtn.classList.add('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }

    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectCreatorBtn && currentContent?.creator_id) {
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });

        connectCreatorBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }

            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            const isConnected = connectCreatorBtn.classList.contains('connected');
            try {
                if (isConnected) {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    if (error) throw error;
                    connectCreatorBtn.classList.remove('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    const { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    if (error) throw error;
                    connectCreatorBtn.classList.add('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }
}

// ===================================================================
// MODAL & PANEL SYSTEMS
// ===================================================================
// ======================
// ANALYTICS MODAL
// ======================
function initAnalyticsModal() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    if (!analyticsBtn || !analyticsModal) return;

    analyticsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        analyticsModal.classList.add('active');
        loadContentAnalytics();
    });

    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', function() {
            analyticsModal.classList.remove('active');
        });
    }

    analyticsModal.addEventListener('click', function(e) {
        if (e.target === analyticsModal) {
            analyticsModal.classList.remove('active');
        }
    });
}

async function loadContentAnalytics() {
    if (!currentContent) return;
    try {
        const { data: viewsData } = await window.supabaseClient
            .from('content_views')
            .select('id, viewed_at')
            .eq('content_id', currentContent.id)
            .order('viewed_at', { ascending: false })
            .limit(100);

        const { data: commentsData } = await window.supabaseClient
            .from('comments')
            .select('id, created_at')
            .eq('content_id', currentContent.id);

        const totalViews = viewsData?.length || 0;
        const totalComments = commentsData?.length || 0;

        document.getElementById('content-total-views').textContent = formatNumber(totalViews);
        document.getElementById('total-comments').textContent = formatNumber(totalComments);
        document.getElementById('avg-watch-time').textContent = '4m 23s';
        document.getElementById('engagement-rate').textContent = '68%';
        document.getElementById('views-trend').textContent = '+12%';
        document.getElementById('comments-trend').textContent = '+8%';
        document.getElementById('watch-time-trend').textContent = '+5%';
        document.getElementById('engagement-trend').textContent = '+3%';

        if (typeof Chart !== 'undefined') {
            initEngagementChart();
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function initEngagementChart() {
    const ctx = document.getElementById('content-engagement-chart');
    if (!ctx) return;

    if (window.contentEngagementChart) {
        window.contentEngagementChart.destroy();
    }

    window.contentEngagementChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Views',
                data: [65, 59, 80, 81, 56, 55, 40],
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Comments',
                data: [28, 48, 40, 19, 86, 27, 90],
                borderColor: '#1D4ED8',
                backgroundColor: 'rgba(29, 78, 216, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'var(--soft-white)'
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'var(--slate-grey)' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'var(--slate-grey)' }
                }
            }
        }
    });
}

// ======================
// SEARCH MODAL
// ======================
function initSearchModal() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    if (!searchBtn || !searchModal) return;

    searchBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        searchModal.classList.add('active');
        setTimeout(function() {
            if (searchInput) searchInput.focus();
        }, 300);
    });

    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', function() {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        });
    }

    searchModal.addEventListener('click', function(e) {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', debounce(async function(e) {
            const query = e.target.value.trim();
            const category = document.getElementById('category-filter')?.value;
            const sortBy = document.getElementById('sort-filter')?.value;

            if (query.length < 2) {
                document.getElementById('search-results-grid').innerHTML = '<div class="no-results">Start typing to search...</div>';
                return;
            }

            document.getElementById('search-results-grid').innerHTML = '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
            try {
                const results = await searchContent(query, category, sortBy);
                renderSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                document.getElementById('search-results-grid').innerHTML = '<div class="no-results">Error searching. Please try again.</div>';
            }
        }, 300));
    }

    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', triggerSearch);
    }
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        sortFilter.addEventListener('change', triggerSearch);
    }
}

function triggerSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        const event = new Event('input');
        searchInput.dispatchEvent(event);
    }
}

// ============================================
// FIXED: Search content with REAL view counts from source table
// ============================================
async function searchContent(query, category, sortBy) {
    try {
        let orderBy = 'created_at';
        let order = 'desc';
        if (sortBy === 'popular') {
            orderBy = 'views_count';
        } else if (sortBy === 'trending') {
            orderBy = 'likes_count';
        }

        let queryBuilder = window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published')
            .order(orderBy, { ascending: order === 'asc' })
            .limit(20);

        if (category) {
            queryBuilder = queryBuilder.eq('genre', category);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        const enrichedResults = await Promise.all(
            (data || []).map(async (item) => {
                const { count: realViews } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                return { ...item, real_views_count: realViews || 0 };
            })
        );
        return enrichedResults || [];
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// ============================================
// FIXED: Render search results with REAL view counts
// ============================================
function renderSearchResults(results) {
    const grid = document.getElementById('search-results-grid');
    if (!grid) return;

    if (!results || results.length === 0) {
        grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
        return;
    }

    grid.innerHTML = results.map(item => {
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
        return `
            <div class="content-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}"
                         alt="${item.title}"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <div class="related-meta">
                        <i class="fas fa-eye"></i>
                        <span>${formatNumber(viewsCount)} views</span>
                    </div>
                    <button class="creator-btn" data-creator-id="${item.user_id}" data-creator-name="${creator}">
                        <i class="fas fa-user"></i>
                        ${truncateText(creator, 15)}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.creator-btn')) return;
            const id = card.dataset.contentId;
            if (id) window.location.href = `content-detail.html?id=${id}`;
        });
    });

    grid.querySelectorAll('.creator-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = btn.dataset.creatorId;
            const name = btn.dataset.creatorName;
            if (id) window.location.href = `creator-channel.html?id=${id}&name=${encodeURIComponent(name)}`;
        });
    });
}

// ======================
// NOTIFICATIONS PANEL
// ======================
function initNotificationsPanel() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllReadBtn = document.getElementById('mark-all-read');
    if (!notificationsBtn || !notificationsPanel) return;

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationsPanel.classList.add('active');
            loadUserNotifications();
            markAllNotificationsAsRead();
        });
    }
    if (navNotificationsBtn) {
        navNotificationsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationsPanel.classList.add('active');
            loadUserNotifications();
            markAllNotificationsAsRead();
        });
    }
    if (closeNotifications) {
        closeNotifications.addEventListener('click', function() {
            notificationsPanel.classList.remove('active');
        });
    }
    document.addEventListener('click', function(e) {
        if (notificationsPanel.classList.contains('active') &&
            !notificationsPanel.contains(e.target) &&
            !notificationsBtn.contains(e.target) &&
            (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
            notificationsPanel.classList.remove('active');
        }
    });

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async function() {
            await markAllNotificationsAsRead();
            await loadUserNotifications();
        });
    }

    if (window.AuthHelper?.isAuthenticated()) {
        loadUserNotifications();
        updateNotificationBadge();
    }

    document.addEventListener('authReady', loadUserNotifications);
}

async function loadUserNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    try {
        if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>Sign in to see notifications</p>
                </div>
            `;
            updateNotificationBadge(0);
            return;
        }

        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>User profile not found</p>
                </div>
            `;
            return;
        }

        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            updateNotificationBadge(0);
            return;
        }

        notificationsList.innerHTML = data.map(notification => `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h4>${escapeHtml(notification.title)}</h4>
                    <p>${escapeHtml(notification.message)}</p>
                    <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
                </div>
                ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');

        notificationsList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async function() {
                const id = item.dataset.id;
                await markNotificationAsRead(id);
                const notification = data.find(n => n.id === id);
                if (notification?.content_id) {
                    window.location.href = `content-detail.html?id=${notification.content_id}`;
                }
                notificationsPanel.classList.remove('active');
            });
        });

        const unreadCount = data.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

function getNotificationIcon(type) {
    switch(type) {
        case 'like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'follow': return 'fas fa-user-plus';
        case 'view_milestone': return 'fas fa-trophy';
        case 'system': return 'fas fa-bell';
        default: return 'fas fa-bell';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        if (error) throw error;

        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('.notification-dot');
            if (dot) dot.remove();
        }
        await loadUserNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        if (!window.AuthHelper?.isAuthenticated()) return;
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return;

        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userProfile.id)
            .eq('is_read', false);
        if (error) throw error;

        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('.notification-dot');
            if (dot) dot.remove();
        });
        updateNotificationBadge(0);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function updateNotificationBadge(count) {
    if (count === undefined || count === null) {
        count = document.querySelectorAll('.notification-item.unread').length;
    }
    const mainBadge = document.getElementById('notification-count');
    const navBadge = document.getElementById('nav-notification-count');
    if (mainBadge) {
        mainBadge.textContent = count > 99 ? '99+' : count;
        mainBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (navBadge) {
        navBadge.textContent = count > 99 ? '99+' : count;
        navBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function formatNotificationTime(timestamp) {
    const now = new Date();
    const diffMs = now - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return new Date(timestamp).toLocaleDateString();
}

// ======================
// GLOBAL NAVIGATION - FIXED: Clean event listeners and centered icons
// ======================
function initGlobalNavigation() {
    const homeBtn = document.querySelector('.nav-icon:nth-child(1)');
    if (homeBtn) {
        const newHomeBtn = homeBtn.cloneNode(true);
        homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
        newHomeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            window.location.href = 'https://bantustreamconnect.com/';
        });
    }

    const createBtn = document.querySelector('.nav-icon:nth-child(3)');
    if (createBtn) {
        const newCreateBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
        newCreateBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (window.AuthHelper?.isAuthenticated()) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            }
        });
    }

    const dashboardBtn = document.querySelector('.nav-icon:nth-child(4)');
    if (dashboardBtn) {
        const newDashboardBtn = dashboardBtn.cloneNode(true);
        dashboardBtn.parentNode.replaceChild(newDashboardBtn, dashboardBtn);
        newDashboardBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (window.AuthHelper?.isAuthenticated()) {
                window.location.href = 'creator-dashboard.html';
            } else {
                showToast('Please sign in to access dashboard', 'warning');
                window.location.href = `login.html?redirect=creator-dashboard.html`;
            }
        });
    }
}

// ============================================
// PHASE 1: CONTINUE WATCHING — LOAD & RENDER (SINGLE SECTION)
// ============================================
async function loadContinueWatching(userId, limit) {
    if (limit === undefined) limit = 8;
    const section = document.getElementById('continueWatchingSection');
    if (!section) return;

    if (!userId || !window.supabaseClient) {
        section.style.display = 'none';
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                content_id,
                last_position,
                is_completed,
                updated_at,
                Content (
                    id,
                    title,
                    thumbnail_url,
                    genre,
                    duration,
                    status,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .eq('Content.status', 'published')
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        if (!data || data.length === 0) {
            section.style.display = 'none';
            return;
        }

        renderContinueWatching(data);
        section.style.display = 'block';
    } catch (error) {
        console.error('❌ Failed to load continue watching:', error);
        section.style.display = 'none';
    }
}

function renderContinueWatching(items) {
    const container = document.getElementById('continueGrid');
    if (!container) return;

    container.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';

        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;
        const timeWatched = formatDuration(item.last_position);
        const totalTime = formatDuration(content.duration);
        const thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url)
                           || content.thumbnail_url
                           || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        const creatorName = content.user_profiles?.full_name
                          || content.user_profiles?.username
                          || 'Creator';

        return `
            <a href="content-detail.html?id=${content.id}" class="content-card continue-card" data-content-id="${content.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}"
                         alt="${escapeHtml(content.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="progress-bar-overlay">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                    <div class="resume-badge">
                        <i class="fas fa-play"></i> Resume
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(content.title, 45)}</h3>
                    <div class="related-meta">
                        <span>${timeWatched} / ${totalTime}</span>
                    </div>
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${truncateText(creatorName, 20)}
                    </div>
                </div>
            </a>
        `;
    }).join('');

    container.querySelectorAll('.continue-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (window.track?.continueWatchingClick) {
                const contentId = card.dataset.contentId;
                window.track.continueWatchingClick(contentId);
            }
        });
    });
}

function setupContinueWatchingRefresh() {
    const refreshBtn = document.getElementById('refreshContinueBtn');
    if (!refreshBtn) return;

    refreshBtn.addEventListener('click', async function() {
        if (!currentUserId) return;
        showToast('Refreshing...', 'info');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            await loadContinueWatching(currentUserId);
            showToast('Updated!', 'success');
        } catch (error) {
            console.error('Refresh failed:', error);
            showToast('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
    });
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return '-';
    }
}

function formatCommentTime(timestamp) {
    if (!timestamp) return 'Just now';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + ' min ago';
        if (diffHours < 24) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
        if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Recently';
    }
}

// Export key functions
window.hasViewedContentRecently = hasViewedContentRecently;
window.streamingManager = streamingManager;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;
window.closeVideoPlayer = closeVideoPlayer; // ✅ Export close function
window.debugSessionData = debugSessionData; // 🔧 Export debug function

// 🔧 PHASE 1: Page unload handler - clean up watch session and validation timer
window.addEventListener('beforeunload', function() {
    if (viewValidationTimer) {
        clearTimeout(viewValidationTimer);
    }
    if (watchSession) {
        watchSession.stop();
    }
    if (window._watchSession) {
        window._watchSession.stop();
    }
    if (streamingManager) {
        streamingManager.destroy();
    }
});

console.log('✅ Content detail script loaded with PHASE 4 STREAMING MANAGER integration, PHASE 1-3 POLISH, 🎵 AUDIO SUPPORT, 🎨 CREATOR AVATAR FIX, 🔧 VIEW VALIDATION WITH SESSION_ID, 🔧 PROFILE_ID FIX, and HOME FEED UI INTEGRATION');
