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
// 🚀 PERFORMANCE: YouTube-style skeleton loading, critical data parallelization, lazy heavy features
// 🔐 AUTH FIX: Ensured AuthHelper is fully initialized before UI updates
// 🔐 AUTH FIX: Added waitForAuthHelper() to prevent timing issues
// 🚀 PHASE 1D: COLLECTION-AWARE CONTENT DETAIL ENGINE
// ✅ PHASE 1D: Integrated Queue Manager and Content Collections Engine
// ✅ PHASE 1D: Next/Previous playback, queue sidebar, autoplay, active item highlighting
// ✅ PHASE 1D: Queue survives refresh via localStorage
// 🎯 PHASE 1D FINAL: Playlist/Album/Series mode integrated into content-detail architecture
// 🔧 PHASE 1D FIX: Added showLoading/hideLoading functions
// 🔧 PHASE 1D FIX: Hard block fallback during playlist mode
// 🔧 PHASE 1D FIX: Proper playlist UI rendering and queue events
// 🎵 BROWSER AUTOPLAY UNLOCK: User interaction tracker + play overlay
// ✅ CRITICAL FIX #1: markContentAsViewed array crash fixed (prevents player death)
// ✅ CRITICAL FIX #2: Album dropdown toggle button with proper event listener - FIXED: persistent expanded state
// ✅ CRITICAL FIX #3: Media type detection (audio vs video) fixed
// ✅ CRITICAL FIX #4: Album expanded state preservation - NO auto-collapse after playback
// ✅ CRITICAL FIX #5: Like button persistence - survives rerenders and playlist track switching
// 🔧 BUG FIX #1: REMOVED all auto-collapse forces in playback lifecycle
// 🔧 BUG FIX #2: REAL album tracklist rendering into dedicated external container
// 🔧 BUG FIX #3: Like button uses global likedContentCache Set for persistence
// 🔧 BUG FIX #4: View recording properly called in WatchSession start()
// 🔧 VIEWS FIX #1: Removed premature early exit in view recording
// 🔧 VIEWS FIX #2: Added proper DB confirmation handling with viewPersisted flag
// 🔧 VIEWS FIX #3: Added frontend optimistic update for views
// 🔧 VIEWS FIX #4: Added incrementContentViews RPC call for content.views_count
// 🔧 ALBUM FIX #1: Fixed DOM timing with requestAnimationFrame and retry logic
// 🔧 ALBUM FIX #2: Fixed track source detection with multiple property fallbacks
// 🔧 ALBUM FIX #3: Added comprehensive error logging for track rendering
// 🔧 VIEW SYNC FIX #1: Added global event for view count synchronization across components
// 🔧 ALBUM ARCHITECTURE FIX: Removed duplicate album systems; only one active system now
// 🔧 CRITICAL ALBUM FIX: Check playlist items FIRST, not ContentCollectionsEngine
// 🔧 VIEW RECORDING FIX: Reset viewPersisted flag when content changes

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
let _heavyVideoLoaded = false; // 🚀 Flag for lazy video features

// 🎯 PLAYLIST MODE GLOBALS
let currentPlaylist = null;
let currentPlaylistItems = [];
let isPlaylistMode = false;
let viewValidationTimer = null; // For cleanup

// 🎵 ALBUM EXPANDED STATE - PERSISTENT (FIX #4)
let isAlbumExpanded = false;

// ============================================
// 🎵 BROWSER AUTOPLAY UNLOCK — GLOBAL USER INTERACTION TRACKER
// ============================================
document.addEventListener('click', () => {
    document.body.classList.add('user-interacted');
}, { once: true });

// ============================================
// 🔧 PHASE 1D FIX 1 — ADD MISSING LOADING FUNCTIONS
// ============================================
function showLoading(message = 'Loading...') {
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        const text = loadingScreen.querySelector('.loading-text');
        if (text) {
            text.textContent = message;
        }
    }
    console.log('⏳', message);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    console.log('✅ Loading hidden');
}

// TEMPORARILY DISABLE the recent view check for testing
function hasViewedContentRecently(contentId) {
    console.log('🔍 hasViewedContentRecently called - returning FALSE for testing');
    return false;
}

// ============================================
// 🚀 OPTIMIZED: Initialize when DOM is ready with YouTube-style loading
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Content Detail: Starting optimized load sequence...');

    // 1. SHOW SKELETON INSTANTLY (0-50ms)
    const skeleton = document.getElementById('content-skeleton');
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (app) app.style.display = 'block';
    if (skeleton) skeleton.style.display = 'block';

    // Initialize Supabase client
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
    }

    // Parse URL parameters for playlist mode
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');
    const playlistId = urlParams.get('playlist_id');
    const playlistType = urlParams.get('type');

    // 2. LOAD HELPERS and WAIT for Auth Helper
    if (!window.SupabaseHelper) {
        import('./js/supabase-helper.js').catch(err => console.warn('Helper load error:', err));
    }
    if (!window.AuthHelper) {
        import('./js/auth-helper.js').catch(err => console.warn('Helper load error:', err));
    }
    
    // Wait for AuthHelper to be ready (CRITICAL FIX)
    await waitForAuthHelper();
    
    // Initialize AuthHelper if needed
    if (window.AuthHelper && !window.AuthHelper.isInitialized) {
        await window.AuthHelper.initialize();
    }
    
    // Get current user ID
    currentUserId = window.AuthHelper?.getUserProfile?.()?.id || null;
    console.log('👤 Current user ID:', currentUserId || 'Guest');

    // 3. INIT LIGHTWEIGHT UI SYSTEMS (NO AWAIT)
    initThemeSelector();
    initGlobalNavigation();
    setupCompleteSidebar();
    setupNavigationButtons();
    setupNavButtonScrollAnimation();
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
    setupAuthListeners(); // Setup listeners only, don't wait for auth

    // Force immediate profile updates (CRITICAL FIX)
    await updateSidebarProfile();
    await updateHeaderProfile();
    updateProfileSwitcher();

    // 4. LOAD CRITICAL CONTENT IN PARALLEL (0.3s - 0.8s)
    try {
        // 🎯 PLAYLIST MODE DETECTION
        if (playlistId) {
            console.log('🎵 Playlist mode detected:', playlistId, playlistType);
            await loadPlaylistMode(playlistId, playlistType);
            isPlaylistMode = true;
        } else if (contentId) {
            console.log('🎬 Single content mode detected:', contentId);
            await loadCriticalContentData(contentId);
            isPlaylistMode = false;
        } else {
            throw new Error('No content ID or playlist ID provided');
        }

        await Promise.all([
            updateSidebarProfile(), // Double-check after content loads
            updateHeaderProfile()
        ]);

        // 5. HIDE SKELETON, SHOW REAL UI
        if (skeleton) skeleton.style.display = 'none';
        
        // Update comment input state after auth is ready
        setTimeout(updateCommentInputState, 300);

        // Setup auth state change listener for comment input
        if (window.supabaseClient?.auth) {
            window.supabaseClient.auth.onAuthStateChange(async () => {
                setTimeout(updateCommentInputState, 300);
                // Re-update profiles on auth change
                await updateSidebarProfile();
                await updateHeaderProfile();
                updateProfileSwitcher();
            });
        }

        // Initialize modals/panels (non-critical)
        initAnalyticsModal();
        initSearchModal();
        initNotificationsPanel();

        // PHASE 2: Initialize Playlist Manager after auth is ready
        if (window.PlaylistManager && currentUserId) {
            await initializePlaylistManager();
        }

        // PHASE 3: Initialize Recommendation Engine (only if in single content mode)
        if (!isPlaylistMode && currentContent?.id) {
            await initializeRecommendationEngine();
        } else if (isPlaylistMode && currentPlaylistItems.length > 0) {
            // For playlist mode, load recommendations based on first item
            await initializeRecommendationEngineForPlaylist(currentPlaylistItems[0]?.id);
        }

        // PHASE 1 POLISH: Initialize keyboard shortcuts after video player
        setTimeout(() => {
            if (enhancedVideoPlayer?.video) {
                initializeKeyboardShortcuts();
            }
        }, 1000);

        // PHASE 2 POLISH: Initialize playlist modal
        if (currentUserId && (currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id))) {
            setTimeout(() => {
                initializePlaylistModal();
            }, 500);
        }

        // Apply mobile header styles
        applyMobileHeaderStyles();

        // ============================================
        // 🚀 PHASE 1D: Initialize Collection Engine
        // ============================================
        if (!isPlaylistMode && currentContent && window.ContentCollectionsEngine) {
            await window.ContentCollectionsEngine.initialize(currentContent);
        } else if (!isPlaylistMode && currentContent && !window.ContentCollectionsEngine) {
            console.warn('⚠️ ContentCollectionsEngine not loaded yet, will retry');
            // Wait for engine to load and retry
            const waitForEngine = setInterval(async () => {
                if (window.ContentCollectionsEngine) {
                    clearInterval(waitForEngine);
                    await window.ContentCollectionsEngine.initialize(currentContent);
                }
            }, 100);
            setTimeout(() => clearInterval(waitForEngine), 5000);
        }

    } catch (err) {
        console.error('❌ Critical load failed:', err);
        showToast('Failed to load content. Retrying...', 'error');
        if (skeleton) skeleton.style.display = 'none';
        
        // Fallback: try to load with old method
        try {
            await loadContentFromURL();
        } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr);
            document.getElementById('contentTitle').textContent = 'Content Unavailable';
        }
    }

    // 6. LAZY LOAD NON-CRITICAL FEATURES (Background after UI renders)
    requestIdleCallback(() => {
        setupEventListeners();
        if (isPlaylistMode && currentPlaylistItems.length > 0) {
            loadSecondaryContentDataForPlaylist();
        } else if (currentContent?.id) {
            loadSecondaryContentData(currentContent.id);
        }
        initializeVideoPlayerSkeleton(); // Prep element, DON'T load heavy HLS yet
    }, { timeout: 2000 });

    // Fallback: Force hide skeleton if something stalls
    setTimeout(() => {
        if (skeleton && skeleton.style.display !== 'none') {
            console.warn('⚠️ Forcing skeleton hide after timeout');
            skeleton.style.display = 'none';
        }
        const loading = document.getElementById('loading');
        const appElem = document.getElementById('app');
        if (loading && appElem && loading.style.display !== 'none') {
            loading.style.display = 'none';
            appElem.style.display = 'block';
        }
    }, 5000);

    console.log('✅ Content Detail initialization complete with optimized loading');
});

// Helper function to wait for AuthHelper
async function waitForAuthHelper() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.AuthHelper && window.AuthHelper.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 50);
        // Timeout after 2 seconds
        setTimeout(() => {
            clearInterval(check);
            console.warn('⚠️ AuthHelper not loaded within timeout, continuing anyway');
            resolve();
        }, 2000);
    });
}

// Helper to wait for helpers (legacy)
async function waitForHelpers() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.SupabaseHelper?.isInitialized && window.AuthHelper?.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 50);
        setTimeout(() => {
            clearInterval(check);
            resolve();
        }, 500);
    });
}

// ============================================
// 🎯 PLAYLIST MODE: Load playlist data (FIX 4 & 3 applied)
// ============================================
async function loadPlaylistMode(playlistId, playlistType) {
    try {
        showLoading('Loading playlist...');

        console.log('📀 Loading playlist:', playlistId, 'Type:', playlistType);

        // Fetch playlist with items
        let query = window.supabaseClient
            .from('creator_playlists')
            .select(`
                *,
                items:Content (
                    id,
                    title,
                    description,
                    thumbnail_url,
                    file_url,
                    duration,
                    content_format,
                    media_type,
                    episode_number,
                    season_number,
                    views_count,
                    likes_count,
                    user_id,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    ),
                    created_at
                )
            `)
            .eq('id', playlistId);

        // Add type filter if specified
        if (playlistType) {
            query = query.eq('playlist_type', playlistType);
        }

        const { data: playlist, error } = await query.single();

        if (error) throw error;

        if (!playlist) {
            showToast('Playlist not found', 'error');
            return;
        }

        // 🔧 FIX 4: Ensure playlist has items and set globals
        if (!playlist.items || !playlist.items.length) {
            throw new Error('Playlist contains no published items');
        }

        currentPlaylist = playlist;
        currentPlaylistItems = playlist.items || [];

        window.currentPlaylist = playlist;
        window.currentPlaylistIndex = 0;
        window.currentContent = playlist.items[0];

        console.log(
            '🎵 Playlist initialized:',
            playlist.name,
            'Items:',
            playlist.items.length
        );
        console.log(`📀 Loaded playlist: ${playlist.name} with ${currentPlaylistItems.length} items`);

        // Render playlist UI
        renderPlaylistHero(playlist);
        renderPlaylistQueue(currentPlaylistItems);

        // Set current content to first item for player
        if (currentPlaylistItems.length > 0) {
            await setCurrentContentFromPlaylistItem(currentPlaylistItems[0], 0);
            await loadContentIntoPlayer(currentPlaylistItems[0]);
        } else {
            showToast('This playlist has no items', 'warning');
        }

        hideLoading();

    } catch (error) {
        // 🔧 FIX 3: Hard block fallback during playlist mode
        console.error('❌ Playlist mode failed:', error);
        showToast('Failed to load playlist', 'error');
        hideLoading();

        const hero = document.getElementById('contentHero');
        if (hero) {
            hero.innerHTML = `
                <div class="playlist-error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Failed to load playlist</h2>
                    <p>${error.message}</p>
                </div>
            `;
        }
        // IMPORTANT: return prevents fallback execution
        return;
    }
}

// ============================================
// 🎯 PLAYLIST MODE: Set current content from playlist item (with view reset)
// ============================================
async function setCurrentContentFromPlaylistItem(item, index) {
    if (!item) return;

    // 🔧 VIEW RECORDING FIX: Reset view recording state before switching content
    resetViewRecordingState();

    currentContent = {
        id: item.id,
        title: item.title || 'Untitled',
        description: item.description || '',
        thumbnail_url: item.thumbnail_url,
        file_url: item.file_url,
        media_type: item.media_type || item.content_format || 'video',
        genre: item.genre || 'General',
        created_at: item.created_at,
        duration: item.duration || 3600,
        language: item.language || 'English',
        views_count: item.views_count || 0,
        likes_count: item.likes_count || 0,
        favorites_count: item.favorites_count || 0,
        comments_count: item.comments_count || 0,
        creator: item.user_profiles?.full_name || item.user_profiles?.username || 'Creator',
        creator_display_name: item.user_profiles?.full_name || item.user_profiles?.username || 'Creator',
        creator_id: item.user_id,
        user_profiles: item.user_profiles,
        episode_number: item.episode_number,
        season_number: item.season_number,
        _playlistIndex: index,
        _playlistId: currentPlaylist?.id
    };

    // Update UI with current content info
    updateContentUI(currentContent);
    
    // Highlight active item in queue
    highlightActivePlaylistItem(item.id);
    
    // ✅ FIX #5: Re-initialize like button for new content (persistence)
    if (currentUserId && currentContent?.id) {
        initializeLikeButton(currentContent.id, currentUserId);
        initializeFavoriteButton(currentContent.id, currentUserId);
    }
    
    console.log('🎵 Set current content from playlist:', currentContent.title, 'Index:', index);
}

// ============================================
// 🎯 PLAYLIST MODE: Play playlist item by index (with view reset)
// ============================================
async function playPlaylistItemByIndex(index) {
    if (!window.currentPlaylist?.items?.[index]) return;

    const item = window.currentPlaylist.items[index];

    window.currentPlaylistIndex = index;
    window.currentContent = item;

    // Update active class in queue
    document.querySelectorAll('.playlist-queue-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.playlist-queue-item[data-index="${index}"]`)?.classList.add('active');

    await setCurrentContentFromPlaylistItem(item, index);
    await loadContentIntoPlayer(item);

    console.log('▶️ Playing playlist item:', item.title);
}

// Make function globally accessible for onclick handlers
window.playPlaylistItemByIndex = playPlaylistItemByIndex;
window.playPlaylistItem = async (contentId, index) => {
    if (currentPlaylistItems && currentPlaylistItems[index] && currentPlaylistItems[index].id === contentId) {
        await playPlaylistItemByIndex(index);
    } else {
        // Fallback: find item by ID
        const foundIndex = currentPlaylistItems.findIndex(i => i.id === contentId);
        if (foundIndex !== -1) {
            await playPlaylistItemByIndex(foundIndex);
        }
    }
};

// ============================================
// 🎯 PLAYLIST MODE: Render playlist hero section (FIX 5)
// ============================================
function renderPlaylistHero(playlist) {
    const firstItem = playlist.items?.[0] || {};
    
    safeSetText('contentTitle', playlist.name || 'Playlist');
    safeSetText('contentDescription', playlist.description || 'Playlist collection');
    
    // Update hero poster
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.src = playlist.custom_thumbnail_url || firstItem.thumbnail_url || '';
    }
    
    // Show playlist badge in hero
    const playlistBadge = document.createElement('div');
    playlistBadge.className = 'playlist-badge';
    playlistBadge.innerHTML = `
        <i class="fas fa-list-ul"></i>
        <span>${playlist.playlist_type || 'Playlist'}</span>
    `;
    
    const heroActions = document.querySelector('.hero-actions');
    if (heroActions && !document.querySelector('.playlist-badge')) {
        heroActions.insertBefore(playlistBadge, heroActions.firstChild);
    }
    
    // Update total items in playlist header
    const totalItemsEl = document.getElementById('playlistTotalItems');
    if (totalItemsEl && playlist.items) {
        totalItemsEl.textContent = `${playlist.items.length} items`;
    }
}

// ============================================
// 🎯 PLAYLIST MODE: Render playlist queue (FIX 6 & 7)
// ============================================
function renderPlaylistQueue(items) {
    const container = document.getElementById('playlistQueue');
    if (!container) {
        console.warn('⚠️ Playlist queue container not found');
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="playlist-empty">
                <i class="fas fa-music"></i>
                <p>No items in this playlist</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, index) => `
        <div
            class="playlist-queue-item ${index === 0 ? 'active' : ''}"
            data-index="${index}"
            data-content-id="${item.id}"
        >
            <div class="playlist-thumb">
                <img
                    src="${item.thumbnail_url || 'assets/default-thumbnail.jpg'}"
                    alt="${escapeHtml(item.title || 'Untitled')}"
                    onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=140&h=80&fit=crop'"
                >
            </div>
            <div class="playlist-meta">
                <div class="playlist-item-title">
                    ${escapeHtml(item.title || 'Untitled')}
                </div>
                <div class="playlist-item-subtitle">
                    ${formatDuration(item.duration || 0)}
                </div>
            </div>
        </div>
    `).join('');

    setupPlaylistQueueEvents();
}

// ============================================
// 🎯 PLAYLIST MODE: Setup queue click events (FIX 7)
// ============================================
function setupPlaylistQueueEvents() {
    document.querySelectorAll('.playlist-queue-item').forEach(item => {
        item.addEventListener('click', async () => {
            const index = Number(item.dataset.index);
            await playPlaylistItemByIndex(index);
        });
    });
}

// ============================================
// 🎯 Highlight active playlist item
// ============================================
function highlightActivePlaylistItem(contentId) {
    document.querySelectorAll('.playlist-queue-item').forEach(el => {
        if (el.dataset.contentId === contentId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// ============================================
// 🎵 SHOW INITIAL PLAY OVERLAY (BROWSER AUTOPLAY UNLOCK)
// ============================================
function showInitialPlayOverlay() {
    const overlay = document.getElementById('initialPlayOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
}

// ============================================
// 🎯 Load content into video player (SAFE AUTOPLAY)
// ============================================
async function loadContentIntoPlayer(content) {
    if (!content) return;
    
    const player = document.getElementById('inlinePlayer');
    const videoElement = document.getElementById('inlineVideoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (!player || !videoElement) {
        console.warn('Player elements not ready');
        return;
    }
    
    // Show player
    player.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    
    // Update hero poster opacity
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    
    // Show close button
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    
    // Prepare video URL using the universal helper
    let fileUrl = getPlayableMediaUrl(content);
    console.log('📥 Loading media URL:', fileUrl);
    
    if (fileUrl && !fileUrl.startsWith('http')) {
        if (fileUrl.startsWith('/')) fileUrl = fileUrl.substring(1);
        fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
    }
    
    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined') {
        if (content.thumbnail_url) {
            const cleanPath = content.thumbnail_url.startsWith('/') ? content.thumbnail_url.substring(1) : content.thumbnail_url;
            fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
        }
    }
    
    // ✅ FIX #3: PROPER MEDIA DETECTION - Don't assume audio mode
    const isAudio = detectMediaType(content) === 'audio';
    
    // Set poster and class based on media type
    if (isAudio && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        videoElement.setAttribute('poster', imgUrl);
        videoElement.classList.add('audio-mode');
    } else {
        videoElement.removeAttribute('poster');
        videoElement.classList.remove('audio-mode');
    }
    
    // ✅ FIX #3: PROPER SOURCE MIME TYPE
    function getMediaMimeType(url = '') {
        const lower = url.toLowerCase();
        if (lower.endsWith('.mp4')) return 'video/mp4';
        if (lower.endsWith('.webm')) return 'video/webm';
        if (lower.endsWith('.mov')) return 'video/quicktime';
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.m4a')) return 'audio/mp4';
        return 'video/mp4';
    }
    
    // Clean up existing players
    if (enhancedVideoPlayer) {
        try { enhancedVideoPlayer.destroy(); } catch(e) {}
        enhancedVideoPlayer = null;
    }
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    // Set video source
    while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
    videoElement.removeAttribute('src');
    
    const source = document.createElement('source');
    source.src = fileUrl;
    source.type = getMediaMimeType(fileUrl);
    videoElement.appendChild(source);
    videoElement.load();
    
    // Initialize players
    initializeEnhancedVideoPlayer();
    setTimeout(() => {
        if (streamingManager) {
            streamingManager.destroy();
            streamingManager = null;
        }
        initializeStreamingManager();
    }, 100);
    
    // 🎵 PHASE 1D FIX — SAFE AUTOPLAY
    setTimeout(async () => {
        try {
            // Only autoplay if user already interacted
            const canAutoplay = document.body.classList.contains('user-interacted');
            if (!canAutoplay) {
                console.log('⛔ Autoplay blocked until user interaction');
                showInitialPlayOverlay();
                return;
            }
            if (enhancedVideoPlayer) {
                await enhancedVideoPlayer.play();
            } else {
                await videoElement.play();
            }
            console.log('▶️ Playback started successfully');
            // Hide overlay if visible
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
        } catch (error) {
            console.warn('⚠️ Playback blocked:', error);
            showInitialPlayOverlay();
        }
    }, 300);
    
    // Scroll to player
    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ============================================
// 🎯 MEDIA-FIRST HELPER FUNCTIONS (CRITICAL FIX)
// ============================================

/**
 * Gets a playable media URL from any content object
 * Supports: file_url, audio_url, video_url, media_url
 */
function getPlayableMediaUrl(content) {
    if (!content) return null;
    
    return (
        content.file_url ||
        content.audio_url ||
        content.video_url ||
        content.media_url ||
        null
    );
}

/**
 * Detects media type from content metadata or file extension
 * Returns: 'audio' or 'video'
 */
function detectMediaType(content) {
    if (!content) return 'video';
    
    // Check explicit media_type field first
    if (content.media_type) {
        if (content.media_type.toLowerCase() === 'audio') return 'audio';
        if (content.media_type.toLowerCase() === 'video') return 'video';
    }
    
    // Check content_format field
    const format = (content.content_format || '').toLowerCase();
    if (format.includes('audio') || format.includes('podcast') || format.includes('music')) {
        return 'audio';
    }
    
    // Check file URL extension
    const url = getPlayableMediaUrl(content);
    if (url) {
        const ext = url.split('.').pop()?.toLowerCase();
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'aac' || ext === 'm4a') {
            return 'audio';
        }
    }
    
    // Default to video
    return 'video';
}

// 🎯 NEW: Load only what's needed to render the page (modified for playlist mode compatibility)
async function loadCriticalContentData(contentId) {
    // Check cache first
    const cached = localStorage.getItem(`content_${contentId}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            // Validate cache age (5 minutes)
            if (parsed._cachedAt && Date.now() - parsed._cachedAt < 300000) {
                currentContent = parsed;
                updateContentUI(currentContent);
                console.log('📦 Loaded from cache:', contentId);
                
                // Still refresh in background
                refreshContentInBackground(contentId);
                return;
            }
        } catch(e) { console.warn('Cache parse error:', e); }
    }

    // Fetch critical data in PARALLEL - REMOVED video_url, using file_url
    const [contentRes, viewsRes, likesRes] = await Promise.all([
        window.supabaseClient.from('Content').select(`
            *, user_profiles!user_id(id, full_name, username, avatar_url)
        `).eq('id', contentId).single(),
        window.supabaseClient.from('content_views').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
        window.supabaseClient.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', contentId)
    ]);

    if (contentRes.error) throw contentRes.error;

    // Get watch progress if user is logged in
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

    // PHASE 1D: Get series/collection info
    const { data: seriesData } = await window.supabaseClient
        .from('Content')
        .select('series_id, episode_number')
        .eq('id', contentId)
        .single();

    currentContent = {
        id: contentRes.data.id,
        title: contentRes.data.title || 'Untitled',
        description: contentRes.data.description || '',
        thumbnail_url: contentRes.data.thumbnail_url,
        file_url: contentRes.data.file_url,
        media_type: contentRes.data.media_type || 'video',
        genre: contentRes.data.genre || 'General',
        created_at: contentRes.data.created_at,
        duration: contentRes.data.duration || contentRes.data.duration_seconds || 3600,
        language: contentRes.data.language || 'English',
        views_count: viewsRes.count || 0,
        likes_count: likesRes.count || 0,
        favorites_count: contentRes.data.favorites_count || 0,
        comments_count: contentRes.data.comments_count || 0,
        creator: contentRes.data.user_profiles?.full_name || contentRes.data.user_profiles?.username || 'Creator',
        creator_display_name: contentRes.data.user_profiles?.full_name || contentRes.data.user_profiles?.username || 'Creator',
        creator_id: contentRes.data.user_profiles?.id || contentRes.data.user_id,
        user_id: contentRes.data.user_id,
        user_profiles: contentRes.data.user_profiles,
        watch_progress: watchProgress?.last_position || 0,
        is_completed: watchProgress?.is_completed || false,
        quality_profiles: streamingData?.quality_profiles || [],
        hls_manifest_url: streamingData?.hls_manifest_url || null,
        data_saver_url: streamingData?.data_saver_url || null,
        series_id: seriesData?.series_id || null,
        episode_number: seriesData?.episode_number || null,
        _cachedAt: Date.now()
    };

    // Cache for 5 minutes
    localStorage.setItem(`content_${contentId}`, JSON.stringify(currentContent));
    
    updateContentUI(currentContent);
    if (currentContent.watch_progress > 10 && !currentContent.is_completed) {
        addResumeButton(currentContent.watch_progress);
    }
    
    // Initialize like/favorite buttons if user is logged in
    if (currentUserId) {
        await initializeLikeButton(contentId, currentUserId);
        await initializeFavoriteButton(contentId, currentUserId);
    }
    
    if (playlistManager) {
        await updateWatchLaterButtonState();
    }
}

// Background refresh to keep cache fresh
async function refreshContentInBackground(contentId) {
    try {
        const [viewsRes, likesRes] = await Promise.all([
            window.supabaseClient.from('content_views').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
            window.supabaseClient.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', contentId)
        ]);
        
        if (currentContent) {
            currentContent.views_count = viewsRes.count || 0;
            currentContent.likes_count = likesRes.count || 0;
            updateCountsUI(currentContent);
            // Update cache
            currentContent._cachedAt = Date.now();
            localStorage.setItem(`content_${contentId}`, JSON.stringify(currentContent));
        }
    } catch(e) { console.warn('Background refresh failed:', e); }
}

// Update only counts in UI
function updateCountsUI(content) {
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const likesEl = document.getElementById('likesCount');
    
    if (viewsEl) viewsEl.textContent = formatNumber(content.views_count) + ' views';
    if (viewsFullEl) viewsFullEl.textContent = formatNumber(content.views_count);
    if (likesEl) likesEl.textContent = formatNumber(content.likes_count);
}

// 🎯 NEW: Load non-critical data in background (single content mode)
async function loadSecondaryContentData(contentId) {
    if (!contentId) return;
    
    // Run non-blocking
    Promise.all([
        loadComments(contentId),
        loadRelatedContent(contentId),
        currentUserId ? loadContinueWatching(currentUserId) : Promise.resolve(),
        currentUserId && window.PlaylistManager && !playlistManager ? initializePlaylistManager() : Promise.resolve()
    ]).catch(err => console.warn('⚠️ Secondary data load failed:', err));
}

// 🎯 NEW: Load secondary data for playlist mode
async function loadSecondaryContentDataForPlaylist() {
    if (!currentPlaylistItems.length) return;
    
    // Load comments for first item
    const firstItemId = currentPlaylistItems[0]?.id;
    if (firstItemId) {
        Promise.all([
            loadComments(firstItemId),
            currentUserId ? loadContinueWatching(currentUserId) : Promise.resolve(),
            currentUserId && window.PlaylistManager && !playlistManager ? initializePlaylistManager() : Promise.resolve()
        ]).catch(err => console.warn('⚠️ Playlist secondary data load failed:', err));
    }
}

// ============================================
// 🎵 INITIAL PLAY BUTTON HANDLER (Browser autoplay unlock)
// ============================================
function setupInitialPlayButton() {
    const playButton = document.getElementById('initialPlayButton');
    if (!playButton) return;
    
    playButton.addEventListener('click', async () => {
        const video = document.getElementById('inlineVideoPlayer');
        if (!video) return;
        
        try {
            if (enhancedVideoPlayer) {
                await enhancedVideoPlayer.play();
            } else {
                await video.play();
            }
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
            console.log('▶️ User initiated playback');
        } catch (error) {
            console.error('❌ User playback failed:', error);
            showToast('Playback failed. Please try again.', 'error');
        }
    });
}

// ============================================
// PHASE 1: Import WatchSession class
// ============================================
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
// 🔧 VIEW RECORDING FIX: Reset viewPersisted flag when content changes
// ============================================
function resetViewRecordingState() {
    if (window._watchSession) {
        console.log('🔄 Resetting view recording state for new content');
        window._watchSession.viewPersisted = false;
        window._watchSession.viewAttempted = false;
        window._watchSession.viewCounted = false;
        window._watchSession.viewRetryCount = 0;
        window._watchSession._isRecordingView = false;
    }
    // Also clear the session storage flag for this content
    if (currentContent?.id) {
        const sessionKey = `view_recorded_${currentContent.id}_`;
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(`view_recorded_${currentContent.id}`)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    console.log('✅ View recording state reset for new content');
}

// ============================================
// PHASE 1 UPDATED: Initialize watch session with session ID and profile ID
// 🔧 BUG FIX #4: View recording now properly called inside WatchSession.start()
// 🔧 VIEWS FIX #1-4: Fixed view recording with proper deduplication and DB confirmation
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

        const sessionKey = `bantu_view_session_${parseInt(currentContent.id)}`;
        const sessionId = sessionStorage.getItem(sessionKey);

        console.log('🎬 Initializing WatchSession with session:', sessionId);
        watchSession = new window.WatchSession({
            contentId: currentContent.id,
            userId: currentUserId,
            supabase: window.supabaseClient,
            videoElement: enhancedVideoPlayer.video,
            sessionId: sessionId,
            syncInterval: 10000,
            viewThreshold: 20,
            completionThreshold: 0.9,
            // 🔧 VIEWS FIX: Added onViewRecorded callback for frontend update
            onViewRecorded: async function(data) {
                console.log('✅ View recorded by WatchSession:', data);
                // Increment frontend view count
                incrementFrontendViewCount();
                // Call RPC to update content.views_count
                await incrementContentViews(currentContent.id);
                // Refresh counts from source for accuracy
                await refreshCountsFromSource();
                // 🔧 VIEW SYNC FIX #1: Dispatch global event for view count synchronization
                window.dispatchEvent(new CustomEvent('content-views-updated', {
                    detail: {
                        contentId: currentContent.id,
                        viewsCount: currentContent.views_count + 1
                    }
                }));
            },
            onProgressSync: function(data) {
                console.log('📊 Progress synced:', data);
            },
            onViewCounted: function(data) {
                console.log('👍 View counted by WatchSession:', data);
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
                
                // Auto-play next in playlist mode
                if (isPlaylistMode && currentPlaylistItems.length > 0) {
                    const currentIndex = currentPlaylistItems.findIndex(i => i.id === currentContent?.id);
                    if (currentIndex >= 0 && currentIndex + 1 < currentPlaylistItems.length) {
                        setTimeout(() => {
                            playPlaylistItem(currentPlaylistItems[currentIndex + 1].id, currentIndex + 1);
                        }, 3000);
                    }
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
                console.log('✅ Watch session started - view recording will happen after threshold');
            }
        }, 500);
    } catch (error) {
        console.error('❌ Failed to initialize watch session:', error);
    }
}

// ============================================
// 🔧 VIEWS FIX: Increment frontend view count
// ============================================
function incrementFrontendViewCount() {
    const selectors = [
        '.view-count',
        '.views-count',
        '[data-view-count]',
        '#viewsCount',
        '#viewsCountFull'
    ];

    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const current = parseInt(el.textContent.replace(/\D/g, '')) || 0;
            const newViews = current + 1;
            // Format the text based on what the element contains
            if (el.textContent.includes('views')) {
                el.textContent = `${formatNumber(newViews)} views`;
            } else {
                el.textContent = formatNumber(newViews);
            }
            console.log(`📊 Updated view count for ${selector}: ${newViews}`);
        });
    });
}

// ============================================
// 🔧 VIEWS FIX: Increment content.views_count via RPC
// ============================================
async function incrementContentViews(contentId) {
    if (!contentId) return false;
    
    try {
        // Try RPC first (recommended)
        const { error: rpcError } = await window.supabaseClient.rpc('increment_content_views', {
            content_id_input: contentId
        });
        
        if (rpcError) {
            console.warn('RPC increment failed, trying direct update:', rpcError);
            // Fallback: direct update
            const { error: updateError } = await window.supabaseClient
                .from('Content')
                .update({ views_count: window.supabaseClient.rpc('increment', { x: 1 }) })
                .eq('id', contentId);
            
            if (updateError) {
                console.error('Direct update also failed:', updateError);
                return false;
            }
        }
        
        console.log('✅ Content views_count incremented for:', contentId);
        return true;
    } catch (error) {
        console.error('❌ Failed to increment content views:', error);
        return false;
    }
}

// ============================================
// 🔧 FIXED: Record view when Play button is clicked with YouTube-style validation
// 🔧 VIEWS FIX: Removed premature early exit, added proper DB confirmation
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

    // ✅ UPDATE UI OPTIMISTICALLY (now handled by WatchSession's onViewRecorded)
    // This is immediate frontend feedback while waiting for DB confirmation
    
    console.log('🎬 View recording will be handled by WatchSession after 20 seconds threshold');
    
    // ✅ FIX #1: CRITICAL VIEWED ARRAY FIX - Mark as viewed safely
    markContentAsViewed(currentContent.id);

    // 🚀 Load heavy video features on-demand
    loadHeavyVideoFeatures().then(() => {
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

        // Video source setup using universal helper
        let fileUrl = getPlayableMediaUrl(currentContent);
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

        // ✅ FIX #3: PROPER MEDIA DETECTION - Don't assume audio mode
        const mediaType = detectMediaType(currentContent);
        const isAudioFile = mediaType === 'audio';
        const isVideoFile = !isAudioFile;

        if (!fileUrl || (!isAudioFile && !isVideoFile)) {
            console.error('❌ Invalid file format:', fileUrl);
            showToast('Invalid file format', 'error');
            return;
        }

        // Set poster and class based on media type
        if (isAudioFile && currentContent.thumbnail_url) {
            const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(currentContent.thumbnail_url) || currentContent.thumbnail_url;
            videoElement.setAttribute('poster', imgUrl);
            videoElement.classList.add('audio-mode');
        } else {
            videoElement.removeAttribute('poster');
            videoElement.classList.remove('audio-mode');
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

        // ✅ FIX #3: PROPER SOURCE MIME TYPE
        function getMediaMimeType(url = '') {
            const lower = url.toLowerCase();
            if (lower.endsWith('.mp4')) return 'video/mp4';
            if (lower.endsWith('.webm')) return 'video/webm';
            if (lower.endsWith('.mov')) return 'video/quicktime';
            if (lower.endsWith('.mp3')) return 'audio/mpeg';
            if (lower.endsWith('.wav')) return 'audio/wav';
            if (lower.endsWith('.ogg')) return 'audio/ogg';
            if (lower.endsWith('.m4a')) return 'audio/mp4';
            return 'video/mp4';
        }

        const source = document.createElement('source');
        source.src = fileUrl;
        source.type = getMediaMimeType(fileUrl);
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

        // 🎵 SAFE AUTOPLAY with user interaction check
        setTimeout(async () => {
            try {
                const canAutoplay = document.body.classList.contains('user-interacted');
                if (!canAutoplay) {
                    console.log('⛔ Autoplay blocked until user interaction');
                    showInitialPlayOverlay();
                    return;
                }
                if (enhancedVideoPlayer) {
                    await enhancedVideoPlayer.play();
                } else {
                    await videoElement.play();
                }
                console.log('▶️ Playback started successfully');
            } catch (error) {
                console.warn('⚠️ Playback blocked:', error);
                showInitialPlayOverlay();
            }
        }, 500);

        setTimeout(() => {
            player.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }).catch(err => {
        console.error('Failed to load video features:', err);
        showToast('Video player error', 'error');
    });
}

// 🚀 Prepares video element without heavy libraries
function initializeVideoPlayerSkeleton() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (videoElement) {
        videoElement.preload = 'none'; // ⚡ CRITICAL: Don't fetch video on load
        videoElement.controls = false;
        console.log('🎥 Video skeleton ready (preload=none)');
    }
}

// 🚀 Load heavy video features on-demand (called inside handlePlay)
async function loadHeavyVideoFeatures() {
    if (_heavyVideoLoaded) return;
    _heavyVideoLoaded = true;

    console.log('🚀 Loading heavy video features on-demand...');
    try {
        await initializeEnhancedVideoPlayer();
        await initializeStreamingManager();
        console.log('✅ Heavy video features ready');
    } catch (error) {
        console.error('❌ Failed to load heavy video features:', error);
        _heavyVideoLoaded = false; // Allow retry
    }
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
    if (!currentUserId || !(currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id))) {
        console.warn('⚠️ Cannot initialize playlist modal: missing user or content');
        return;
    }

    const contentIdForModal = currentContent?.id || (currentPlaylistItems[0]?.id);
    if (!contentIdForModal) return;

    try {
        playlistModal = new window.PlaylistModal({
            supabase: window.supabaseClient,
            userId: currentUserId,
            contentId: contentIdForModal
        });
        window.playlistModal = playlistModal;

        const watchLaterBtn = document.getElementById('watchLaterBtn');
        if (watchLaterBtn) {
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

// For playlist mode recommendations
async function initializeRecommendationEngineForPlaylist(contentId) {
    if (!window.RecommendationEngine || !contentId) return;
    
    try {
        recommendationEngine = new window.RecommendationEngine({
            supabase: window.supabaseClient,
            userId: currentUserId,
            currentContentId: contentId,
            limit: 8,
            minWatchThreshold: 0.5,
            cacheDuration: 60000
        });
        await loadRecommendationRails();
        console.log('✅ RecommendationEngine initialized for playlist');
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

        setInterval(() => {
            if (streamingManager) {
                const speed = streamingManager.getNetworkSpeed();
                if (speed) {
                    updateNetworkSpeedIndicator(speed / 1000000);
                }
            }
        }, 5000);

        setupQualitySelector();
        setupDataSaverToggle();

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

    const qualities = streamingManager?.getAvailableQualities?.() || [
        { label: 'Auto', value: 'auto' },
        { label: '1080p', value: '1080p' },
        { label: '720p', value: '720p' },
        { label: '480p', value: '480p' },
        { label: '360p', value: '360p' }
    ];

    console.log('📺 Setting up quality selector with', qualities.length, 'qualities');

    qualityContainer.innerHTML = qualities.map(q => `
        <button class="quality-option ${q.value === streamingManager?.getCurrentQuality?.() ? 'active' : ''}"
                data-quality="${q.value}">
            ${q.label}
        </button>
    `).join('');

    qualityContainer.querySelectorAll('.quality-option').forEach(btn => {
        btn.addEventListener('click', async function() {
            const quality = this.dataset.quality;
            qualityContainer.querySelectorAll('.quality-option').forEach(b =>
                b.classList.remove('active')
            );
            this.classList.add('active');

            if (streamingManager) {
                await streamingManager.setQuality(quality);
                console.log('📺 Quality changed to:', quality);
                showToast('Quality: ' + quality.toUpperCase(), 'info');
            }

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

// ============================================
// AUTHENTICATION & PROFILE FUNCTIONS (CRITICAL FIXES)
// ============================================

// Update sidebar profile with logged-in user info
async function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    
    if (!avatar || !name || !email) return;
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const userEmail = userProfile?.email || 'User';
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
            avatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            const initial = displayName.charAt(0).toUpperCase();
            avatar.innerHTML = `<div style="width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg, #1D4ED8, #F59E0B); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:1.5rem;">${initial}</div>`;
        }
        name.textContent = displayName;
        email.textContent = userEmail;
    } else {
        avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
    }
}

// Update header profile with logged-in user info
async function updateHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileName = document.getElementById('current-profile-name');
    
    if (!profilePlaceholder) return;
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
            profilePlaceholder.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">`;
        } else {
            profilePlaceholder.innerHTML = `<div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, #1D4ED8, #F59E0B); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:14px;">${initial}</div>`;
        }
        if (profileName) profileName.textContent = displayName;
    } else {
        profilePlaceholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
        if (profileName) profileName.textContent = 'Guest';
    }
    
    applyMobileHeaderStyles();
}

// Update profile switcher dropdown
function updateProfileSwitcher() {
    const profileList = document.getElementById('profile-list');
    if (!profileList) return;
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        const initial = displayName.charAt(0).toUpperCase();
        
        let avatarHtml = '';
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
            avatarHtml = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            avatarHtml = `<div style="width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg, #1D4ED8, #F59E0B); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">${initial}</div>`;
        }
        
        profileList.innerHTML = `
            <div class="profile-item active" data-profile="main">
                <div class="profile-avatar">
                    ${avatarHtml}
                </div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(displayName)}</div>
                    <div class="profile-type">Main Profile</div>
                </div>
            </div>
        `;
    } else {
        profileList.innerHTML = `
            <div class="profile-item" onclick="window.location.href='login.html'">
                <div class="profile-avatar">
                    <i class="fas fa-sign-in-alt"></i>
                </div>
                <div class="profile-info">
                    <div class="profile-name">Sign In</div>
                    <div class="profile-type">To access your profile</div>
                </div>
            </div>
        `;
    }
}

// Update comment input state based on authentication
function updateCommentInputState() {
    const commentInput = document.getElementById('commentInput');
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentAuthMessage = document.getElementById('commentAuthMessage');
    
    if (!commentInput) return;
    
    const isAuthenticated = window.AuthHelper?.isAuthenticated?.();
    
    if (isAuthenticated) {
        commentInput.disabled = false;
        commentInput.placeholder = 'Add a comment...';
        if (sendBtn) sendBtn.disabled = false;
        if (commentAuthMessage) commentAuthMessage.style.display = 'none';
    } else {
        commentInput.disabled = true;
        commentInput.placeholder = 'Sign in to comment';
        if (sendBtn) sendBtn.disabled = true;
        if (commentAuthMessage) commentAuthMessage.style.display = 'block';
    }
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
    applyMobileHeaderStyles();
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
            
            if ((currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id)) && !playlistModal) {
                setTimeout(initializePlaylistModal, 500);
            }

            await updateSidebarProfile();
            await updateHeaderProfile();
            updateProfileSwitcher();
            
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

            resetSidebarProfile();
            resetHeaderProfile();
            
            setTimeout(updateCommentInputState, 300);
        }
    });

    if (window.AuthHelper?.isAuthenticated?.()) {
        currentUserId = window.AuthHelper.getUserProfile()?.id || null;
        updateProfileUI();
    } else {
        resetProfileUI();
    }
    
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

        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
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
    
    applyMobileHeaderStyles();
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
    applyMobileHeaderStyles();
    updateCommentInputState();
}

// Apply mobile header styles (hide profile picture on mobile, keep RSA badge)
function applyMobileHeaderStyles() {
    const headerProfile = document.querySelector('.header-profile');
    if (!headerProfile) return;
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        const profileImg = headerProfile.querySelector('#userProfilePlaceholder img, #userProfilePlaceholder .profile-placeholder');
        if (profileImg) {
            profileImg.style.display = 'none';
        }
        const rsaBadge = headerProfile.querySelector('.rsa-badge');
        if (rsaBadge) {
            rsaBadge.style.display = 'flex';
        }
    } else {
        const profileImg = headerProfile.querySelector('#userProfilePlaceholder img, #userProfilePlaceholder .profile-placeholder');
        if (profileImg) {
            profileImg.style.display = '';
        }
    }
}

window.addEventListener('resize', applyMobileHeaderStyles);

// ============================================
// FALLBACK: Load content with ACCURATE counts from source tables (used if critical fails)
// ============================================
async function loadContentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id') || '68';
    
    try {
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

        const { data: streamingData } = await window.supabaseClient
            .from('Content')
            .select('quality_profiles, hls_manifest_url, data_saver_url')
            .eq('id', contentId)
            .single();

        const { data: seriesData } = await window.supabaseClient
            .from('Content')
            .select('series_id, episode_number')
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
            user_profiles: contentData.user_profiles,
            watch_progress: watchProgress?.last_position || 0,
            is_completed: watchProgress?.is_completed || false,
            quality_profiles: streamingData?.quality_profiles || [],
            hls_manifest_url: streamingData?.hls_manifest_url || null,
            data_saver_url: streamingData?.data_saver_url || null,
            series_id: seriesData?.series_id || null,
            episode_number: seriesData?.episode_number || null
        };

        console.log('📥 Content loaded with ACCURATE counts and creator data:', {
            views: currentContent.views_count,
            likes: currentContent.likes_count,
            creator: currentContent.creator,
            creator_id: currentContent.creator_id,
            has_avatar: !!currentContent.user_profiles?.avatar_url,
            avatar_url: currentContent.user_profiles?.avatar_url,
            watch_progress: currentContent.watch_progress,
            hls_available: !!currentContent.hls_manifest_url,
            series_id: currentContent.series_id
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

// ============================================
// ✅ FIX #5: IMPROVED LIKE BUTTON PERSISTENCE with global cache
// 🔧 BUG FIX #3: Added likedContentCache Set for persistence across rerenders
// ============================================
let likedContentCache = new Set();
let favoritedContentCache = new Set();

async function checkUserLike(contentId, userId) {
    if (!userId) return false;
    try {
        const { data, error } = await window.supabaseClient
            .from('content_likes')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .maybeSingle();  // ✅ Use maybeSingle to avoid PGRST116 error
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

    // Reset to default state
    likeBtn.classList.remove('active');
    likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
    
    if (!userId || !contentId) return;

    // Check cache first
    let isLiked = likedContentCache.has(contentId);
    if (!isLiked) {
        isLiked = await checkUserLike(contentId, userId);
        if (isLiked) {
            likedContentCache.add(contentId);
        }
    }
    
    if (isLiked) {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
    }
    console.log(`✅ Like button initialized for content ${contentId}: ${isLiked ? 'liked' : 'not liked'}`);
}

async function checkUserFavorite(contentId, userId) {
    if (!userId) return false;
    try {
        const { data, error } = await window.supabaseClient
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .maybeSingle();  // ✅ Use maybeSingle to avoid PGRST116 error
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
    
    if (!userId || !contentId) return;

    // Check cache first
    let isFavorited = favoritedContentCache.has(contentId);
    if (!isFavorited) {
        isFavorited = await checkUserFavorite(contentId, userId);
        if (isFavorited) {
            favoritedContentCache.add(contentId);
        }
    }

    if (isFavorited) {
        favoriteBtn.classList.add('active');
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
    }
    console.log(`✅ Favorite button initialized for content ${contentId}: ${isFavorited ? 'favorited' : 'not favorited'}`);
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

    const creatorAvatar = document.getElementById('creatorAvatar');
    if (creatorAvatar && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || 'Creator';
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}"
                     alt="${escapeHtml(displayName)}"
                     style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
            console.log('✅ Creator avatar set from URL:', fixedAvatarUrl);
        } else {
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

    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    if (creatorSection && content.creator_id) {
        creatorSection.style.cursor = 'pointer';
        if (creatorInfo) {
            const newCreatorInfo = creatorInfo.cloneNode(true);
            creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
            newCreatorInfo.addEventListener('click', function(e) {
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

        if (currentContent) {
            const { error: updateError } = await window.supabaseClient
                .from('Content')
                .update({ comments_count: comments.length })
                .eq('id', currentContent.id);
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

        enhancedVideoPlayer.on('error', (event) => {
            const media = enhancedVideoPlayer?.video;
            // Ignore autoplay blocking errors
            if (media && media.error === null && media.networkState !== 3) {
                return;
            }
            console.error('🔴 Video player error:', event);
            showToast('Playback error occurred', 'error');
        });

        enhancedVideoPlayer.on('loadeddata', () => {
            console.log('✅ Video metadata loaded, ready to play');
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

    if (player) {
        player.style.display = 'none';
    }

    if (video) {
        video.pause();
        video.currentTime = 0;
    }

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

    if (viewValidationTimer) {
        clearTimeout(viewValidationTimer);
        viewValidationTimer = null;
    }

    if (window._currentPlayingContentId) {
        if (window.cleanupContentSession) {
            window.cleanupContentSession(window._currentPlayingContentId);
        }
        window._currentPlayingContentId = null;
    }

    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }

    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.style.opacity = '1';
    }

    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.style.display = 'none';
    }

    const hero = document.querySelector('.content-hero');
    if (hero) {
        hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// 🎯 FIX #2 & #4: ALBUM DROPDOWN BUTTON - PERSISTENT EXPANDED STATE
// 🔧 BUG FIX #1 & #2: REMOVED all auto-collapse forces and added REAL container rendering
// 🔧 ALBUM FIX #1: Fixed DOM timing with requestAnimationFrame and retry logic
// 🔧 ALBUM FIX #2: Fixed track source detection with multiple property fallbacks
// 🔧 ALBUM FIX #3: Added comprehensive error logging for track rendering
// 🔧 ALBUM ARCHITECTURE FIX: Single source of truth for album rendering
// 🔧 CRITICAL ALBUM FIX: Check playlist items FIRST, not ContentCollectionsEngine
// ============================================
function setupAlbumToggle() {
    const albumToggleBtn = document.getElementById('albumToggleBtn');
    const albumTrackList = document.getElementById('albumTrackList');
    
    if (!albumToggleBtn || !albumTrackList) {
        console.warn('⚠️ Album toggle elements not found - album feature may not be present');
        // 🔧 ALBUM FIX #1: Retry after DOM is ready
        setTimeout(() => {
            const retryBtn = document.getElementById('albumToggleBtn');
            const retryList = document.getElementById('albumTrackList');
            if (retryBtn && retryList) {
                console.log('🔄 Retrying album toggle setup after timeout...');
                setupAlbumToggle();
            }
        }, 500);
        return;
    }

    console.log('🎵 Setting up album toggle button with persistent state...');
    
    // ✅ FIX #4: Restore expanded state from global variable
    if (isAlbumExpanded) {
        albumTrackList.classList.remove('hidden');
        albumTrackList.classList.add('expanded');
        renderAlbumTracks();
        console.log('📀 Album restored to expanded state');
    }
    
    // ✅ FIX #2 & #4: Use stopPropagation to prevent event bubbling
    albumToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();  // ✅ CRITICAL: Prevents event bubbling
        
        const expanded = albumTrackList.classList.contains('expanded');
        
        if (expanded) {
            albumTrackList.classList.remove('expanded');
            albumTrackList.classList.add('hidden');
            isAlbumExpanded = false;
            console.log('📀 Album collapsed');
        } else {
            albumTrackList.classList.remove('hidden');
            albumTrackList.classList.add('expanded');
            renderAlbumTracks();
            isAlbumExpanded = true;
            console.log('📀 Album expanded and tracks rendered');
        }
    });
    
    console.log('✅ Album toggle initialized with persistent state');
}

// ============================================
// 🎯 FIX #2: RENDER ALBUM TRACKS into dedicated container
// 🔧 ALBUM FIX #2: Fixed track source detection with multiple property fallbacks
// 🔧 ALBUM FIX #3: Added comprehensive error logging
// 🔧 ALBUM ARCHITECTURE FIX: Single source of truth for track data
// 🔧 CRITICAL ALBUM FIX: Check playlist items FIRST - ContentCollectionsEngine is secondary
// ============================================
function renderAlbumTracks() {
    const container = document.getElementById('albumTrackList');
    if (!container) {
        console.warn('⚠️ Album track list container not found');
        return;
    }
    
    // 🔧 CRITICAL ALBUM FIX: Check playlist items FIRST (MOST IMPORTANT)
    // The console shows playlist has 9 items loaded into currentPlaylistItems
    let tracks = [];
    
    // Log all possible track sources for debugging
    console.log('🔍 Album track source detection:', {
        currentPlaylistItemsLength: currentPlaylistItems?.length,
        currentPlaylistItemsExists: !!currentPlaylistItems,
        currentPlaylistExists: !!currentPlaylist,
        currentPlaylistItemsCount: currentPlaylist?.items?.length,
        hasWindowCurrentPlaylist: !!window.currentPlaylist,
        windowCurrentPlaylistItemsCount: window.currentPlaylist?.items?.length,
        isPlaylistMode: isPlaylistMode,
        hasContentCollectionsEngine: !!window.ContentCollectionsEngine,
        collectionsItemsLength: window.ContentCollectionsEngine?.items?.length,
        currentContentHasPlaylistItems: !!(currentContent && currentContent._playlistItems)
    });
    
    // 🔧 FIX: Check playlist mode sources FIRST (highest priority)
    if (currentPlaylistItems && currentPlaylistItems.length) {
        tracks = currentPlaylistItems;
        console.log('📀 Tracks from currentPlaylistItems:', tracks.length);
    } 
    else if (currentPlaylist && currentPlaylist.items && currentPlaylist.items.length) {
        tracks = currentPlaylist.items;
        console.log('📀 Tracks from currentPlaylist.items:', tracks.length);
    } 
    else if (window.currentPlaylist && window.currentPlaylist.items && window.currentPlaylist.items.length) {
        tracks = window.currentPlaylist.items;
        console.log('📀 Tracks from window.currentPlaylist.items:', tracks.length);
    }
    // THEN try other sources (lower priority)
    else if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.items && window.ContentCollectionsEngine.items.length) {
        tracks = window.ContentCollectionsEngine.items;
        console.log('📀 Tracks from ContentCollectionsEngine:', tracks.length);
    }
    else if (currentContent && currentContent._playlistItems && currentContent._playlistItems.length) {
        tracks = currentContent._playlistItems;
        console.log('📀 Tracks from currentContent._playlistItems:', tracks.length);
    }
    else if (currentContent && currentContent.tracks && currentContent.tracks.length) {
        tracks = currentContent.tracks;
        console.log('📀 Tracks from currentContent.tracks:', tracks.length);
    }
    
    // 🔧 ALBUM FIX #3: Comprehensive error logging with actionable data
    if (!tracks || !tracks.length) {
        console.error('❌ No tracks available to render - Album tracklist empty', {
            currentPlaylistItemsLength: currentPlaylistItems?.length,
            currentPlaylistItemsArray: currentPlaylistItems ? 'exists' : 'null',
            currentPlaylistItemsFirstItem: currentPlaylistItems?.[0]?.title,
            currentPlaylistExists: !!currentPlaylist,
            currentPlaylistItemsCount: currentPlaylist?.items?.length,
            isPlaylistMode: isPlaylistMode,
            // Log the actual values to help debug
            currentPlaylistItemsValue: currentPlaylistItems,
            currentPlaylistValue: currentPlaylist
        });
        
        container.innerHTML = `
            <div class="empty-playlist">
                <i class="fas fa-music"></i>
                <p>No tracks found in this album</p>
            </div>
        `;
        return;
    }
    
    // Sort tracks by track_number if available from content_metadata
    const sortedTracks = [...tracks].sort((a, b) => {
        const aTrackNum = a.content_metadata?.track_number || a.track_number || 0;
        const bTrackNum = b.content_metadata?.track_number || b.track_number || 0;
        return aTrackNum - bTrackNum;
    });
    
    console.log(`📀 Rendering ${sortedTracks.length} album tracks (sorted by track number)`);
    
    container.innerHTML = sortedTracks.map((item, index) => `
        <div class="album-track-item ${currentContent?.id === item.id ? 'playing' : ''}" 
             data-index="${index}" 
             data-content-id="${item.id}">
            <div class="album-track-thumb-wrapper">
                <img src="${item.thumbnail_url || 'assets/default-thumbnail.jpg'}" 
                     class="album-track-thumb" 
                     alt="${escapeHtml(item.title || 'Untitled')}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=80&fit=crop'">
                ${currentContent?.id === item.id ? '<div class="now-playing-indicator"><i class="fas fa-play"></i></div>' : ''}
            </div>
            <div class="album-track-info">
                <div class="album-track-title">${escapeHtml(item.title || 'Untitled')}</div>
                <div class="album-track-meta">
                    ${item.content_metadata?.track_number || item.track_number ? `Track ${item.content_metadata?.track_number || item.track_number} • ` : ''}
                    ${formatDuration(item.duration || 0)}
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers with stopPropagation
    container.querySelectorAll('.album-track-item').forEach(trackItem => {
        trackItem.addEventListener('click', async (event) => {
            event.stopPropagation();  // ✅ CRITICAL: Prevents event bubbling
            const index = Number(trackItem.dataset.index);
            const contentId = trackItem.dataset.contentId;
            console.log('🎵 Playing album track:', index, contentId);
            
            // Use playlist mode playback (priority)
            if (currentPlaylistItems && currentPlaylistItems[index]) {
                await playPlaylistItemByIndex(index);
            }
            // Try to use collection engine if available
            else if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.playItem) {
                await window.ContentCollectionsEngine.playItem(index);
            }
            // Last resort: navigate to content detail
            else if (contentId && contentId !== currentContent?.id) {
                window.location.href = `content-detail.html?id=${contentId}`;
            }
            
            // ✅ FIX #4: Keep album expanded on track selection (don't auto-collapse)
            console.log('📀 Album remains expanded after track selection');
        });
    });
    
    console.log('✅ Album track list rendered:', sortedTracks.length, 'tracks');
}

// ============================================
// Setup event listeners (UPDATED with album toggle and view sync)
// ============================================
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

    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.addEventListener('click', function() {
            closeVideoPlayer();
        });
    }
    
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

    // ✅ FIX #2 & #4: SETUP ALBUM TOGGLE BUTTON with persistent state
    // 🔧 ALBUM FIX #1: Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        setupAlbumToggle();
    });

    // ✅ FIX #5: LIKE BUTTON with improved persistence using cache
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async function() {
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

            const isLiked = likeBtn.classList.contains('active');
            const likesCountEl = document.getElementById('likesCount');
            const currentLikes = parseInt(likesCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;

            try {
                // Optimistic UI update
                likeBtn.classList.toggle('active', !isLiked);
                likeBtn.innerHTML = !isLiked
                    ? '<i class="fas fa-heart"></i><span>Liked</span>'
                    : '<i class="far fa-heart"></i><span>Like</span>';
                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(newLikes);
                }

                // Update cache immediately
                if (!isLiked) {
                    likedContentCache.add(currentContent.id);
                    const { error: insertError } = await window.supabaseClient
                        .from('content_likes')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });
                    if (insertError) throw insertError;
                } else {
                    likedContentCache.delete(currentContent.id);
                    const { error: deleteError } = await window.supabaseClient
                        .from('content_likes')
                        .delete()
                        .eq('user_id', userProfile.id)
                        .eq('content_id', currentContent.id);
                    if (deleteError) throw deleteError;
                }

                // Refresh counts from source
                const { count, error: countError } = await window.supabaseClient
                    .from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', currentContent.id);
                if (countError) throw countError;

                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(count || 0);
                }
                if (currentContent) {
                    currentContent.likes_count = count || 0;
                }

                showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');

                if (window.track?.contentLike) {
                    window.track.contentLike(currentContent.id, !isLiked);
                }
            } catch (error) {
                console.error('Like operation failed:', error);
                // Rollback optimistic update
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

    // FAVORITE BUTTON with cache
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

                // Update cache immediately
                if (!isFavorited) {
                    favoritedContentCache.add(currentContent.id);
                    const { error } = await window.supabaseClient
                        .from('favorites')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });
                    if (error) throw error;
                } else {
                    favoritedContentCache.delete(currentContent.id);
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

    setupWatchLaterButton();
    
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            const contentIdForComments = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
            if (contentIdForComments) {
                showToast('Refreshing comments...', 'info');
                await loadComments(contentIdForComments);
                showToast('Comments refreshed!', 'success');
            }
        });
    }

    // COMMENT SUBMISSION HANDLER
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
            const contentIdForComment = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
            if (!contentIdForComment) return;

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
                        content_id: contentIdForComment,
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
                await loadComments(contentIdForComment);
                await refreshCountsFromSource();
                commentInput.value = '';
                showToast('Comment added!', 'success');
                if (window.track?.contentComment) {
                    window.track.contentComment(contentIdForComment);
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
    
    // Setup initial play button for autoplay unlock
    setupInitialPlayButton();
    
    // 🔧 VIEW SYNC FIX #1: Add global listener for view count updates
    setupViewSyncListener();
    
    console.log('✅ Event listeners setup complete');
}

// ============================================
// 🔧 VIEW SYNC FIX: Setup view sync listener
// ============================================
function setupViewSyncListener() {
    window.addEventListener('content-views-updated', async (event) => {
        const { contentId, viewsCount } = event.detail;
        if (String(contentId) !== String(currentContent?.id)) return;
        
        // Update currentContent with new view count
        if (currentContent && viewsCount !== undefined) {
            currentContent.views_count = viewsCount;
            console.log('👁️ Frontend views synced via global event:', viewsCount);
        } else {
            // Fetch fresh view count if not provided
            const { data, error } = await window.supabaseClient
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', contentId);
            if (!error && currentContent) {
                currentContent.views_count = data?.length || 0;
                console.log('👁️ Frontend views synced via fetch:', currentContent.views_count);
            }
        }
        
        // Update UI elements
        updateCountsUI(currentContent);
    });
}

// ====================================================
// SINGLE-TABLE FIX: CONNECT BUTTONS WITH CONNECTORS TABLE
// ====================================================
function setupConnectButtons() {
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
    const contentIdForAnalytics = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
    if (!contentIdForAnalytics) return;
    try {
        const { data: viewsData } = await window.supabaseClient
            .from('content_views')
            .select('id, viewed_at')
            .eq('content_id', contentIdForAnalytics)
            .order('viewed_at', { ascending: false })
            .limit(100);

        const { data: commentsData } = await window.supabaseClient
            .from('comments')
            .select('id, created_at')
            .eq('content_id', contentIdForAnalytics);

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

// ============================================
// 🚀 PHASE 1D: Collection Playback Actions
// ============================================
function setupCollectionPlaybackActions() {
    const playAllBtn = document.getElementById('playAllBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    
    if (playAllBtn) {
        playAllBtn.addEventListener('click', () => {
            if (window.QueueManager) {
                window.QueueManager.currentIndex = 0;
                window.QueueManager.loadCurrentItem();
            }
        });
    }
    
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
            if (window.QueueManager && window.QueueManager.shuffleQueue) {
                window.QueueManager.shuffleQueue();
                showToast('Queue shuffled!', 'success');
            }
        });
    }
}

// PHASE 1D: Setup watch later button (fallback)
function setupWatchLaterButton() {
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (!watchLaterBtn) return;
    
    watchLaterBtn.addEventListener('click', async function() {
        if (!currentUserId) {
            showToast('Please sign in to use Watch Later', 'warning');
            return;
        }
        
        const contentIdForWatchLater = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
        if (!contentIdForWatchLater) return;
        
        if (playlistModal) {
            playlistModal.open();
        } else {
            try {
                const { data: existingList } = await window.supabaseClient
                    .from('playlists')
                    .select('id')
                    .eq('user_id', currentUserId)
                    .eq('name', 'Watch Later')
                    .maybeSingle();
                
                let playlistId = existingList?.id;
                if (!playlistId) {
                    const { data: newPlaylist } = await window.supabaseClient
                        .from('playlists')
                        .insert({
                            user_id: currentUserId,
                            name: 'Watch Later',
                            description: 'Content to watch later',
                            is_public: false
                        })
                        .select()
                        .single();
                    playlistId = newPlaylist.id;
                }
                
                const { data: existing } = await window.supabaseClient
                    .from('playlist_items')
                    .select('id')
                    .eq('playlist_id', playlistId)
                    .eq('content_id', contentIdForWatchLater)
                    .maybeSingle();
                
                if (existing) {
                    showToast('Already in Watch Later', 'info');
                    return;
                }
                
                await window.supabaseClient
                    .from('playlist_items')
                    .insert({
                        playlist_id: playlistId,
                        content_id: contentIdForWatchLater,
                        added_at: new Date().toISOString()
                    });
                
                showToast('Added to Watch Later!', 'success');
            } catch (error) {
                console.error('Watch Later fallback failed:', error);
                showToast('Failed to add to Watch Later', 'error');
            }
        }
    });
}

// PHASE 1D: Update watch later button state
async function updateWatchLaterButtonState() {
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (!watchLaterBtn || !playlistManager || !currentUserId) return;
    
    const contentIdForWatchLater = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
    if (!contentIdForWatchLater) return;
    
    try {
        const isInWatchLater = await playlistManager.isInWatchLater(contentIdForWatchLater);
        if (isInWatchLater) {
            watchLaterBtn.classList.add('active');
            watchLaterBtn.innerHTML = '<i class="fas fa-clock"></i><span>Watch Later</span>';
        } else {
            watchLaterBtn.classList.remove('active');
            watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
        }
    } catch (error) {
        console.warn('Failed to check watch later state:', error);
    }
}

// PHASE 1D: Refresh counts from source
async function refreshCountsFromSource() {
    const contentIdForRefresh = currentContent?.id || (currentPlaylistItems.length > 0 && currentPlaylistItems[0]?.id);
    if (!contentIdForRefresh) return;
    try {
        const { count: viewsCount } = await window.supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentIdForRefresh);
        
        const { count: likesCount } = await window.supabaseClient
            .from('content_likes')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentIdForRefresh);
        
        if (currentContent && viewsCount !== undefined) {
            currentContent.views_count = viewsCount;
            updateCountsUI(currentContent);
        }
        if (currentContent && likesCount !== undefined) {
            currentContent.likes_count = likesCount;
            const likesEl = document.getElementById('likesCount');
            if (likesEl) likesEl.textContent = formatNumber(likesCount);
        }
    } catch (error) {
        console.warn('Failed to refresh counts:', error);
    }
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

// ✅ FIX #1: CRITICAL VIEWED ARRAY FIX - MARK CONTENT AS VIEWED (SAFE VERSION)
function markContentAsViewed(contentId) {
    try {
        // Get from localStorage
        let viewed = localStorage.getItem('bantu_viewed_content');
        
        // Parse safely
        try {
            viewed = JSON.parse(viewed || '[]');
        } catch (e) {
            console.warn('⚠️ Failed to parse viewed content:', e);
            viewed = [];
        }
        
        // ✅ CRITICAL FIX: Ensure array
        if (!Array.isArray(viewed)) {
            console.warn('⚠️ viewed content was not an array, resetting...');
            viewed = [];
        }
        
        // Prevent duplicates
        if (viewed.includes(contentId)) {
            return;
        }
        
        viewed.push(contentId);
        
        // Keep storage clean (limit to 500 items)
        if (viewed.length > 500) {
            viewed = viewed.slice(-500);
        }
        
        localStorage.setItem('bantu_viewed_content', JSON.stringify(viewed));
        
        console.log('✅ Marked content as viewed:', contentId);
        
    } catch (error) {
        console.error('❌ Failed to mark viewed content:', error);
        // Don't let this crash the playback flow
    }
}

// Export key functions
window.hasViewedContentRecently = hasViewedContentRecently;
window.streamingManager = streamingManager;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;
window.closeVideoPlayer = closeVideoPlayer;
window.refreshCountsFromSource = refreshCountsFromSource;
window.markContentAsViewed = markContentAsViewed;
window.renderAlbumTracks = renderAlbumTracks; // Expose for debugging
window.incrementFrontendViewCount = incrementFrontendViewCount;
window.incrementContentViews = incrementContentViews;
window.resetViewRecordingState = resetViewRecordingState; // Expose for debugging

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

console.log('✅ Content detail script loaded with CRITICAL FIXES:');
console.log('  ✅ FIX #1: markContentAsViewed array crash fixed');
console.log('  ✅ FIX #2: Album dropdown toggle button functional with stopPropagation');
console.log('  ✅ FIX #3: Media type detection (audio vs video) fixed');
console.log('  ✅ FIX #4: Album expanded state preservation - NO auto-collapse after playback');
console.log('  ✅ FIX #5: Like button persistence - survives rerenders and playlist track switching');
console.log('  🔧 BUG FIX #1: REMOVED all auto-collapse forces in playback lifecycle');
console.log('  🔧 BUG FIX #2: REAL album tracklist rendering with persistent state');
console.log('  🔧 BUG FIX #3: Like button uses global likedContentCache Set for persistence');
console.log('  🔧 BUG FIX #4: View recording properly called in WatchSession.start()');
console.log('  🔧 VIEWS FIX #1: Removed premature early exit in view recording');
console.log('  🔧 VIEWS FIX #2: Added proper DB confirmation handling with viewPersisted flag');
console.log('  🔧 VIEWS FIX #3: Added frontend optimistic update for views');
console.log('  🔧 VIEWS FIX #4: Added incrementContentViews RPC call for content.views_count');
console.log('  🔧 ALBUM FIX #1: Fixed DOM timing with requestAnimationFrame and retry logic');
console.log('  🔧 ALBUM FIX #2: Fixed track source detection with multiple property fallbacks');
console.log('  🔧 ALBUM FIX #3: Added comprehensive error logging for track rendering');
console.log('  🔧 VIEW SYNC FIX #1: Added global content-views-updated event for cross-component sync');
console.log('  🔧 ALBUM ARCHITECTURE FIX: Single source of truth for album rendering');
console.log('  🔧 CRITICAL ALBUM FIX: Check playlist items FIRST, not ContentCollectionsEngine');
console.log('  🔧 VIEW RECORDING FIX: Reset viewPersisted flag when content changes');
console.log('✅ Content detail script loaded with PHASE 4 STREAMING MANAGER integration, PHASE 1-3 POLISH, 🎵 AUDIO SUPPORT, 🎨 CREATOR AVATAR FIX, 🔧 VIEW VALIDATION WITH SESSION_ID, 🔧 PROFILE_ID FIX, 🔐 AUTH FIXES, and YOUTUBE-STYLE PERFORMANCE OPTIMIZATIONS');
console.log('🚀 PHASE 1D FINAL: Playlist/Album/Series mode integrated into content-detail architecture');
console.log('🎯 MEDIA-FIRST ARCHITECTURE: Universal media support (audio, video, podcasts, albums) with file_url');
console.log('🎵 BROWSER AUTOPLAY UNLOCK: User interaction tracker + play overlay integrated');
