// js/content-detail.js - MAIN ORCHESTRATOR
// FIXED FOR RLS POLICIES - WITH ACCURATE COUNT BYPASS - VIEWS RECORDED ON PLAY BUTTON CLICK (LIKE MOBILE APP)
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
// ============================================
// 🚀 PHASE 5 & 6: DATABASE MIGRATION INTEGRATION
// - Updated playlist loading to use new junction table (playlist_contents)
// - Updated content profile fetching to use content_engagement_stats
// - Updated recommendation engine to use content_public_metrics view
// - Updated view recording to use playback_sessions and playback_heartbeats
// - Updated like button to use RPC atomic counters
// ============================================
// 🔧 EMERGENCY PATCH (2026-05-19):
// - Fixed fatal syntax error in EnhancedVideoPlayer assignments (removed optional chaining)
// - Re-engineered playlist data fetches to use verified schema (status)
// - Fixed .single() crashes by switching to .maybeSingle()
// - Corrected standalone vs. album mode detection
// - REMOVED duplicate UIScaleController class (was causing "already declared" error)
// ============================================
// 🚨 CRITICAL FIX (2026-05-20): Playlist query uses explicit relation loading without fragile syntax
// - Replaced Content:content_id!inner with Content!playlist_contents_content_id_fkey
// - Added explicit .order('sort_index')
// - Fixed empty check for playlistItems
// - Added correct content mapping paths (item.Content.title)
// - Added result normalization to handle array vs object responses
// - Added two-query fallback as enterprise-safe pattern
// ============================================
// 🎯 YOUTUBE-STYLE PLAYLIST ARCHITECTURE (2026-05-21):
// - Persistent DOM sidebar (never recreated) - ADDED
// - CSS class-based toggle (max-height, opacity, NOT display:none) - ADDED
// - Single render of tracklist (albumTracksRendered flag) - ADDED
// - Global playlist state (window.currentPlaylistItems, window.currentPlaylistIndex) - ADDED
// - Centralized playNextPlaylistItem function - ADDED
// - Player only fires ended event; content-detail handles navigation - ADDED
// ============================================
// 🚨 CRITICAL AUTOPLAY SYNC FIX (2026-05-22):
// - Added syncPlaylistUI() for centralized UI updates
// - Added completion guard to prevent duplicate playlist completions
// - Enhanced playNextPlaylistItem with UI sync before navigation
// - Added playlistCompleting flag to prevent loops
// - Fixed contentId desync during autoplay
// ============================================
// 🎯 DIRECT USER GESTURE PLAYBACK FIX (2026-05-22):
// - Added startPlaybackFromUserGesture for immediate unmuted playback
// - loadContentIntoPlayer now reuses existing player instance
// - Added loadSource method for non-destructive source changes
// - Fixed autoplay blocking with user interaction tracking
// ============================================
// 🚨 ENGAGEMENT SYSTEM FIX (2026-05-22) - INTEGRATED FROM ChatGPT/Gemini:
// - Fixed view recording to use content_views table (NOT views_count column)
// - Added proper engagement state persistence (likes, favorites, watch later)
// - Added recordView() function that inserts into content_views correctly
// - Fixed toggleLike/toggleFavorite/toggleWatchLater with proper table references
// - Added loadAllEngagementStates() to restore UI after refresh
// - Added shareContent() with content_shares and content_events persistence
// ============================================
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23) - FULL PRODUCTION STABILITY:
// - FIX #1: RPC view recording (recordContentViewRPC) - atomic SQL operations
// - FIX #2: Global contentId synchronization across ALL components (updateGlobalContentId)
// - FIX #3: No 409 conflicts - toggle functions check existence before insert
// - FIX #4: Race condition protection - request token pattern in loadAllEngagementStates
// - FIX #5: Optimistic UI updates with server reconciliation
// - FIX #6: Live counts from canonical tables (loadLiveEngagementCounts)
// - FIX #7: Realtime subscriptions for instant updates
// - FIX #8: Watch session threshold recording (15 sec or 30% duration)
// ============================================
// 🚨 CRITICAL ARCHITECTURE FIX (2026-05-24): YouTube-style playlist control separation
// - REMOVED all playlist advancement from video-player.js (BIGGEST FIX)
// - ADDED transition lock (isTrackTransitioning) to prevent race conditions
// - ADDED duplicate contentId guard in updateGlobalContentId
// - ADDED singleton pattern for StreamingManager
// - FIXED player ended listener to ONLY emit events, NOT control playlists
// ============================================
// 🚨 PHASE 7: CONTENT_ENGAGEMENT_STATS CANONICAL SOURCE (2026-05-24)
// - Fixed loadLiveEngagementCounts to read from content_engagement_stats first
// - Fixed setupRealtimeSubscriptions to listen to content_engagement_stats updates
// - Fixed handleLikeButtonClick to reconcile with canonical stats table
// - Eliminated "drops to 0" bug when realtime updates race with UI
// ============================================
// 🔥 SURGICAL FIXES (2026-05-24) - Applied from emergency patch:
// - Fix #1: setupRealtimeSubscriptions - Supabase v2 compatible channel cleanup
// - Fix #2: loadLiveEngagementCounts - Reliable fallback + UI updates with _forceUpdateEngagementUI
// - Fix #3: playNextPlaylistItem - Narrow-scope transition lock
// - Fix #4: REMOVED token abort logic from loadAllEngagementStates (was killing valid requests)
// - Fix #5: setCurrentContent - Ensures count loads AFTER DOM update with setTimeout
// ============================================
// 🔥 SINGLE MODE FIX (2026-05-25) - Applied from ChatGPT + Gemini:
// - Fix #1: startPlaybackFromUserGesture - Ensures player container is visible FIRST
// - Fix #2: Added !window.isPlaylistMode guard to prevent playlist mode interference
// - Fix #3: DOMContentLoaded initialization for single mode with setTimeout guard
// ============================================
// 🧩 MODULAR ARCHITECTURE (2026-06-14):
// - Extracted all section code into separate module files
// - This file now acts as the main orchestrator
// - Modules loaded in dependency order
// ============================================
// ☁️ CLOUDFLARE STREAM INTEGRATION (2026-06-18):
// - Added streaming_provider and provider_video_id to content fetching
// - Supports Cloudflare Stream (HLS) and Cloudflare R2 (audio)
// ============================================
// 🔧 MODULE LOADING FIX (2026-06-18):
// - Removed non-existent video-player.js loading
// - Added module loading guard to prevent duplicate declarations
// - Video player already loaded via js/video-player.js and js/content-detail/video-player-section.js
// ============================================

console.log('🎬 Content Detail Main Orchestrator Initializing...');

// ============================================
// LOAD ALL MODULE DEPENDENCIES
// The order matters for function availability
// ============================================

// Track loaded modules to prevent duplicate loading
const _loadedModules = new Set();

// Helper function to dynamically load scripts with duplicate prevention
function loadScript(src) {
    // Check if this module is already loading or loaded
    if (_loadedModules.has(src)) {
        console.log(`⏭️ Module already loaded: ${src}`);
        return Promise.resolve();
    }
    
    // Mark as loading to prevent duplicates
    _loadedModules.add(src);
    
    return new Promise((resolve, reject) => {
        // Check if script already exists in DOM
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            console.log(`⏭️ Script already in DOM: ${src}`);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`✅ Loaded: ${src}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`❌ Failed to load: ${src}`);
            // Remove from loaded set so we can retry if needed
            _loadedModules.delete(src);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

// Load all section modules in correct dependency order
async function loadAllModules() {
    console.log('📦 Loading section modules...');
    
    // Core UI modules (no dependencies)
    await loadScript('js/content-detail/hero-section.js');
    await loadScript('js/content-detail/creator-section.js');
    await loadScript('js/content-detail/stats-grid.js');
    await loadScript('js/content-detail/description-section.js');
    
    // Interactive modules
    await loadScript('js/content-detail/comments-section.js');
    await loadScript('js/content-detail/continue-watching.js');
    
    // Recommendation modules
    await loadScript('js/content-detail/because-you-watched.js');
    await loadScript('js/content-detail/more-from-this-creator.js');
    await loadScript('js/content-detail/related-content.js');
    
    // Playlist modules
    await loadScript('js/content-detail/playlist-queue.js');
    await loadScript('js/content-detail/legacy-playlist.js');
    await loadScript('js/content-detail/playlist-sidebar.js');
    
    // 🎯 VIDEO PLAYER - Already loaded globally via js/video-player.js
    // The section module below contains the player implementation
    // DO NOT load js/content-detail/video-player.js - it doesn't exist
    console.log('📺 Video player already loaded globally, loading section module...');
    await loadScript('js/content-detail/video-player-section.js');
    
    console.log('✅ All section modules loaded');
}

// Start loading modules immediately, but catch errors gracefully
loadAllModules().catch(err => {
    console.warn('⚠️ Module loading warning (non-critical):', err.message);
});

// ============================================
// GLOBAL VARIABLES (Maintained from original)
// ============================================

window.currentPlaylistItems = [];
window.currentPlaylistIndex = 0;
window.currentPlaylist = null;
window.currentContentId = null;
window.playlistCompleting = false;
window.engagementLoadToken = null;
window.isPlaylistMode = false;
window.currentUserId = null;
window.currentContent = null;

// Session tracking
let currentSessionId = null;
let viewRecordedForCurrentContent = false;
let isTrackTransitioning = false;

// Managers
let watchSession = null;
let playlistManager = null;
let recommendationEngine = null;
let streamingManager = null;
let keyboardShortcuts = null;
let playlistModal = null;
let enhancedVideoPlayer = null;
let isInitialized = false;
let _heavyVideoLoaded = false;

// Engagement caches
let likedContentCache = new Set();
let favoritedContentCache = new Set();
let watchLaterContentCache = new Set();

// ============================================
// 🚨 ENGAGEMENT SYSTEM FUNCTIONS (Core)
// ============================================

/**
 * Record view using RPC (content_views table)
 */
async function recordContentViewRPC(contentId, userId, sessionId, deviceType = 'web') {
    if (!contentId) {
        console.error('❌ Cannot record view: missing contentId');
        return { success: false, views: 0 };
    }
    
    try {
        const finalDeviceType = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        const finalSessionId = sessionId || currentSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const { data, error } = await window.supabaseClient.rpc('record_content_view', {
            p_content_id: parseInt(contentId),
            p_user_id: userId || null,
            p_session_id: finalSessionId,
            p_device_type: finalDeviceType
        });
        
        if (error) {
            console.error('❌ RPC view recording failed:', error);
            return await recordViewFallback(contentId, userId, finalSessionId, finalDeviceType);
        }
        
        console.log(`✅ View recorded via RPC for content ${contentId}, total views: ${data?.views || 0}`);
        
        if (data?.views !== undefined) {
            if (typeof updateViewsUI === 'function') {
                updateViewsUI(data.views);
            }
        }
        
        window.dispatchEvent(new CustomEvent('content-views-updated', {
            detail: { contentId: contentId, viewsCount: data?.views || 0 }
        }));
        
        return { success: true, views: data?.views || 0 };
    } catch (error) {
        console.error('❌ RPC view recording error:', error);
        return { success: false, views: 0 };
    }
}

async function recordViewFallback(contentId, userId, sessionId, deviceType) {
    try {
        const { data: existing, error: checkError } = await window.supabaseClient
            .from('content_views')
            .select('id')
            .eq('content_id', parseInt(contentId))
            .eq('session_id', sessionId)
            .maybeSingle();
        
        if (existing) {
            console.log('⏭️ View already recorded for this session, skipping');
            return { success: true, views: null };
        }
        
        const { error: insertError } = await window.supabaseClient
            .from('content_views')
            .insert({
                content_id: parseInt(contentId),
                user_id: userId || null,
                session_id: sessionId,
                counted_as_view: true,
                view_duration: 30,
                device_type: deviceType,
                viewed_at: new Date().toISOString()
            });
        
        if (insertError) throw insertError;
        
        const { count, error: countError } = await window.supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', parseInt(contentId))
            .eq('counted_as_view', true);
        
        if (!countError && count !== null && typeof updateViewsUI === 'function') {
            updateViewsUI(count);
        }
        
        console.log(`✅ View recorded via fallback for content ${contentId}`);
        return { success: true, views: count || 0 };
    } catch (error) {
        console.error('❌ Fallback view recording failed:', error);
        return { success: false, views: 0 };
    }
}

/**
 * Load LIVE counts from canonical tables
 */
async function loadLiveEngagementCounts(contentId) {
    if (!contentId) return { views: 0, likes: 0, comments: 0, shares: 0 };
    
    try {
        const { data: stats, error: statsError } = await window.supabaseClient
            .from('content_engagement_stats')
            .select('total_views, total_likes, total_comments')
            .eq('content_id', parseInt(contentId))
            .maybeSingle();

        if (!statsError && stats && (stats.total_views !== null || stats.total_likes !== null)) {
            const result = {
                views: stats.total_views || 0,
                likes: stats.total_likes || 0,
                comments: stats.total_comments || 0,
                shares: 0
            };
            if (typeof _forceUpdateEngagementUI === 'function') {
                _forceUpdateEngagementUI(result);
            }
            console.log('✅ Counts from stats table:', result);
            return result;
        }

        const [viewsRes, likesRes] = await Promise.all([
            window.supabaseClient.from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', parseInt(contentId))
                .eq('counted_as_view', true),
            window.supabaseClient.from('content_likes')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', parseInt(contentId))
        ]);

        const result = {
            views: viewsRes.count || 0,
            likes: likesRes.count || 0,
            comments: 0,
            shares: 0
        };
        
        setTimeout(() => {
            if (typeof _forceUpdateEngagementUI === 'function') {
                _forceUpdateEngagementUI(result);
            }
        }, 50);
        
        return result;
    } catch (error) {
        console.error('❌ Failed to load live counts:', error);
        return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
}

/**
 * Load all engagement states with race condition protection
 */
async function loadAllEngagementStates(contentId, userId) {
    if (!userId || !contentId) {
        return { liked: false, favorited: false, watchLater: false };
    }
    
    const token = crypto.randomUUID();
    window.engagementLoadToken = token;
    
    try {
        const [likeRes, favRes, wlRes] = await Promise.all([
            window.supabaseClient.from('content_likes').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle(),
            window.supabaseClient.from('favorites').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle(),
            window.supabaseClient.from('watch_later').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle()
        ]);
        
        const states = {
            liked: !!likeRes.data,
            favorited: !!favRes.data,
            watchLater: !!wlRes.data
        };
        
        if (states.liked) likedContentCache.add(contentId);
        else likedContentCache.delete(contentId);
        
        if (states.favorited) favoritedContentCache.add(contentId);
        else favoritedContentCache.delete(contentId);
        
        if (states.watchLater) watchLaterContentCache.add(contentId);
        else watchLaterContentCache.delete(contentId);
        
        // Update engagement buttons UI
        if (typeof updateEngagementButtonsUI === 'function') {
            updateEngagementButtonsUI(states);
        }
        
        return states;
    } catch (error) {
        console.error('❌ Failed to load engagement states:', error);
        return { liked: false, favorited: false, watchLater: false };
    }
}

/**
 * Update global contentId across all components
 */
function updateGlobalContentId(contentId) {
    if (window.currentContentId === contentId) {
        console.log('⏭️ Skipping duplicate contentId update');
        return;
    }
    
    console.log(`🔄 Updating global contentId from ${window.currentContentId} to ${contentId}`);
    window.currentContentId = contentId;
    
    if (enhancedVideoPlayer) {
        enhancedVideoPlayer.contentId = contentId;
    }
    if (streamingManager) {
        streamingManager.contentId = contentId;
    }
    if (watchSession) {
        watchSession.contentId = contentId;
        watchSession.viewRecorded = false;
        watchSession.viewThresholdReached = false;
    }
    if (recommendationEngine) {
        recommendationEngine.currentContentId = contentId;
    }
    
    viewRecordedForCurrentContent = false;
    
    window.dispatchEvent(new CustomEvent('contentIdChanged', {
        detail: { contentId: contentId }
    }));
}

/**
 * Set current content
 */
async function setCurrentContent(content, index = null) {
    if (!content) return;
    
    updateGlobalContentId(content.id);
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    window.currentContent = content;
    
    if (index !== undefined && index !== null) {
        window.currentPlaylistIndex = index;
    }
    
    if (typeof updateContentUI === 'function') {
        updateContentUI(content);
    }
    
    if (window.currentUserId && content.id) {
        setTimeout(async () => {
            await loadAndUpdateEngagementStates();
        }, 100);
    }
    
    setTimeout(async () => {
        try {
            const liveCounts = await loadLiveEngagementCounts(content.id);
            if (window.currentContent?.id === content.id && typeof _forceUpdateEngagementUI === 'function') {
                _forceUpdateEngagementUI(liveCounts);
            }
        } catch (error) {
            console.error('❌ Count load failed:', error);
        }
    }, 100);
}

/**
 * Toggle like with no 409 conflicts
 */
async function toggleLike(contentId, userId, isCurrentlyLiked) {
    if (!userId) {
        if (typeof showToast === 'function') showToast('Sign in to like content', 'warning');
        return false;
    }
    
    try {
        if (isCurrentlyLiked) {
            const { error } = await window.supabaseClient
                .from('content_likes')
                .delete()
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId));
            if (error) throw error;
            likedContentCache.delete(contentId);
            return false;
        } else {
            const { data: existing } = await window.supabaseClient
                .from('content_likes')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId))
                .maybeSingle();
            
            if (existing) {
                const { error } = await window.supabaseClient
                    .from('content_likes')
                    .delete()
                    .eq('id', existing.id);
                if (error) throw error;
                likedContentCache.delete(contentId);
                return false;
            }
            
            const { error } = await window.supabaseClient
                .from('content_likes')
                .insert({ user_id: userId, content_id: parseInt(contentId) });
            if (error) throw error;
            likedContentCache.add(contentId);
            return true;
        }
    } catch (error) {
        console.error('❌ Like toggle failed:', error);
        if (typeof showToast === 'function') showToast('Failed to update like', 'error');
        return isCurrentlyLiked;
    }
}

/**
 * Toggle favorite
 */
async function toggleFavorite(contentId, userId, isCurrentlyFavorited) {
    if (!userId) {
        if (typeof showToast === 'function') showToast('Sign in to favorite content', 'warning');
        return false;
    }
    
    try {
        if (isCurrentlyFavorited) {
            const { error } = await window.supabaseClient
                .from('favorites')
                .delete()
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId));
            if (error) throw error;
            favoritedContentCache.delete(contentId);
            return false;
        } else {
            const { data: existing } = await window.supabaseClient
                .from('favorites')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId))
                .maybeSingle();
            
            if (existing) {
                const { error } = await window.supabaseClient
                    .from('favorites')
                    .delete()
                    .eq('id', existing.id);
                if (error) throw error;
                favoritedContentCache.delete(contentId);
                return false;
            }
            
            const { error } = await window.supabaseClient
                .from('favorites')
                .insert({ user_id: userId, content_id: parseInt(contentId) });
            if (error) throw error;
            favoritedContentCache.add(contentId);
            return true;
        }
    } catch (error) {
        console.error('❌ Favorite toggle failed:', error);
        if (typeof showToast === 'function') showToast('Failed to update favorite', 'error');
        return isCurrentlyFavorited;
    }
}

/**
 * Toggle watch later
 */
async function toggleWatchLater(contentId, userId, isCurrentlySaved) {
    if (!userId) {
        if (typeof showToast === 'function') showToast('Sign in to use Watch Later', 'warning');
        return false;
    }
    
    try {
        if (isCurrentlySaved) {
            const { error } = await window.supabaseClient
                .from('watch_later')
                .delete()
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId));
            if (error) throw error;
            watchLaterContentCache.delete(contentId);
            return false;
        } else {
            const { data: existing } = await window.supabaseClient
                .from('watch_later')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', parseInt(contentId))
                .maybeSingle();
            
            if (existing) {
                const { error } = await window.supabaseClient
                    .from('watch_later')
                    .delete()
                    .eq('id', existing.id);
                if (error) throw error;
                watchLaterContentCache.delete(contentId);
                return false;
            }
            
            const { error } = await window.supabaseClient
                .from('watch_later')
                .insert({ user_id: userId, content_id: parseInt(contentId) });
            if (error) throw error;
            watchLaterContentCache.add(contentId);
            return true;
        }
    } catch (error) {
        console.error('❌ Watch Later toggle failed:', error);
        if (typeof showToast === 'function') showToast('Failed to update Watch Later', 'error');
        return isCurrentlySaved;
    }
}

/**
 * Share content
 */
async function shareContent(contentId, userId) {
    if (!contentId) return;
    
    const shareText = `📺 ${window.currentContent?.title || 'Check this out!'}\nWatch on Bantu Stream Connect\nNO DNA, JUST RSA`;
    const shareUrl = window.location.href;
    
    try {
        if (navigator.share && navigator.canShare?.({ text: shareText, url: shareUrl })) {
            await navigator.share({
                title: 'Bantu Stream Connect',
                text: shareText,
                url: shareUrl
            });
        } else {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
            if (typeof showToast === 'function') showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
        }
        
        if (userId) {
            await window.supabaseClient
                .from('content_shares')
                .insert({
                    content_id: parseInt(contentId),
                    user_id: userId,
                    shared_at: new Date().toISOString()
                });
            
            await window.supabaseClient
                .from('content_events')
                .insert({
                    content_id: parseInt(contentId),
                    user_id: userId,
                    event_type: 'share',
                    created_at: new Date().toISOString()
                });
        }
        
        if (typeof updateShareCountUI === 'function') {
            updateShareCountUI(1);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
            if (typeof showToast === 'function') showToast('Failed to share. Try copying link manually.', 'error');
        }
    }
}

// ============================================
// WATCH SESSION MANAGER CLASS
// ============================================
class WatchSessionManager {
    constructor(contentId, userId) {
        this.contentId = contentId;
        this.userId = userId || null;
        this.playbackSessionId = this._generateUUID();
        this.sequenceNumber = 0;
        this.totalWatchTimeMs = 0;
        this.maxProgressSeconds = 0;
        this.heartbeatInterval = null;
        this.lastHeartbeatTime = Date.now();
        this.isActive = false;
        this.viewRecorded = false;
        this.viewThresholdReached = false;
    }
    
    _generateUUID() {
        return crypto.randomUUID ? crypto.randomUUID() : 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async initializeSession(platform = 'Web', deviceType = 'Desktop') {
        try {
            const { error } = await window.supabaseClient
                .from('playback_sessions')
                .insert({
                    playback_session_id: this.playbackSessionId,
                    content_id: parseInt(this.contentId),
                    user_id: this.userId,
                    session_id: currentSessionId || this._generateUUID(),
                    platform: platform,
                    device_type: deviceType,
                    started_at: new Date().toISOString()
                });
            if (error) throw error;
            this.isActive = true;
            return true;
        } catch (error) {
            console.error('Session init error:', error);
            return false;
        }
    }
    
    startHeartbeatLoop(videoElement) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (!this.isActive) return;
            if (!videoElement || videoElement.paused) return;
            
            const currentTime = Math.floor(videoElement.currentTime);
            const now = Date.now();
            const deltaWatchTimeMs = now - this.lastHeartbeatTime;
            this.sequenceNumber++;
            this.totalWatchTimeMs += deltaWatchTimeMs;
            if (currentTime > this.maxProgressSeconds) {
                this.maxProgressSeconds = currentTime;
            }
            this.lastHeartbeatTime = now;
            
            await window.supabaseClient
                .from('playback_heartbeats')
                .insert({
                    playback_session_id: this.playbackSessionId,
                    content_id: parseInt(this.contentId),
                    user_id: this.userId,
                    sequence_number: this.sequenceNumber,
                    progress_seconds: currentTime,
                    cumulative_watch_time_ms: this.totalWatchTimeMs,
                    playback_state: 'PLAYING'
                });
            
            await window.supabaseClient
                .from('playback_sessions')
                .update({
                    total_watch_time_ms: this.totalWatchTimeMs,
                    max_progress_seconds: this.maxProgressSeconds,
                    heartbeat_count: this.sequenceNumber,
                    last_heartbeat_at: new Date().toISOString()
                })
                .eq('playback_session_id', this.playbackSessionId);
            
            const duration = videoElement.duration || 0;
            const thirtyPercentDuration = duration * 0.3;
            const thresholdSeconds = Math.min(15, thirtyPercentDuration);
            
            if (!this.viewRecorded && this.totalWatchTimeMs >= thresholdSeconds * 1000) {
                this.viewRecorded = true;
                this.viewThresholdReached = true;
                await recordContentViewRPC(this.contentId, this.userId, this.playbackSessionId);
            }
        }, 10000);
    }
    
    start(videoElement) {
        if (!videoElement) return;
        this.startHeartbeatLoop(videoElement);
    }
    
    stop() {
        this.isActive = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        window.supabaseClient
            .from('playback_sessions')
            .update({ completed: true, exited_at: new Date().toISOString() })
            .eq('playback_session_id', this.playbackSessionId)
            .then(({ error }) => {
                if (error) console.error('Session close error:', error);
            });
    }
}

window.WatchSessionManager = WatchSessionManager;

// ============================================
// PLAYLIST LOADING FUNCTIONS
// ============================================
async function loadPlaylistMode(playlistId, playlistType) {
    try {
        if (typeof showLoading === 'function') showLoading('Loading playlist...');
        
        const { data: playlistItems, error } = await window.supabaseClient
            .from('playlist_contents')
            .select(`
                playlist_id,
                content_id,
                sort_index,
                item_type,
                track_number,
                disc_number,
                season_number,
                display_title_override,
                Content!playlist_contents_content_id_fkey(
                    id,
                    title,
                    description,
                    thumbnail_url,
                    file_url,
                    duration,
                    media_type,
                    status,
                    user_id,
                    content_type,
                    content_format,
                    content_metadata,
                    favorites_count,
                    comments_count,
                    shares_count,
                    live_views,
                    creator_display_name,
                    streaming_provider,
                    provider_video_id
                )
            `)
            .eq('playlist_id', playlistId)
            .eq('Content.status', 'published')
            .order('sort_index', { ascending: true });
        
        if (error) throw error;
        
        if (!playlistItems || playlistItems.length === 0) {
            throw new Error('Playlist contains no published items');
        }
        
        const normalizedItems = playlistItems
            .map(item => {
                let contentData = item.Content;
                if (Array.isArray(contentData) && contentData.length > 0) {
                    contentData = contentData[0];
                }
                if (!contentData) return null;
                if (contentData.status !== 'published') return null;
                return {
                    ...contentData,
                    streaming_provider: contentData.streaming_provider || null,
                    provider_video_id: contentData.provider_video_id || null,
                    playlist_relation: {
                        sort_index: item.sort_index,
                        item_type: item.item_type,
                        track_number: item.track_number,
                        disc_number: item.disc_number,
                        season_number: item.season_number
                    }
                };
            })
            .filter(Boolean);
        
        if (normalizedItems.length === 0) {
            throw new Error('No valid published content items in playlist');
        }
        
        window.currentPlaylistItems = normalizedItems;
        
        // 🎯 Dispatch playlistLoaded event for other components to listen to
        window.dispatchEvent(new CustomEvent('playlistLoaded', {
            detail: { playlistId: playlistId, itemCount: window.currentPlaylistItems.length }
        }));
        
        window.currentPlaylistIndex = 0;
        if (typeof resetPlaylistCompletionLock === 'function') resetPlaylistCompletionLock();
        
        const { data: playlistMeta, error: metaError } = await window.supabaseClient
            .from('creator_playlists')
            .select(`
                *,
                user_profiles!creator_id (
                    username,
                    full_name,
                    avatar_url
                )
            `)
            .eq('id', playlistId)
            .maybeSingle();
        
        if (!metaError && playlistMeta) {
            window.currentPlaylist = {
                ...playlistMeta,
                creator_name: playlistMeta.user_profiles?.full_name || playlistMeta.user_profiles?.username || 'Unknown Creator',
                creator_username: playlistMeta.user_profiles?.username || 'unknown',
                creator_avatar: playlistMeta.user_profiles?.avatar_url || null
            };
        }
        
        if (typeof renderAlbumTracks === 'function') {
            renderAlbumTracks(window.currentPlaylistItems);
        }
        
        if (window.currentPlaylistItems.length > 0) {
            await setCurrentContent(window.currentPlaylistItems[0], 0);
            if (typeof loadContentIntoPlayer === 'function') {
                await loadContentIntoPlayer(window.currentPlaylistItems[0]);
            }
        }
        
        if (typeof hideLoading === 'function') hideLoading();
        
    } catch (error) {
        console.error('❌ Playlist mode failed:', error);
        await loadPlaylistModeTwoQueryFallback(playlistId, playlistType);
    }
}

async function loadPlaylistModeTwoQueryFallback(playlistId, playlistType) {
    const { data: playlistRows, error: playlistError } = await window.supabaseClient
        .from('playlist_contents')
        .select('playlist_id, content_id, sort_index, item_type, track_number, disc_number, season_number, display_title_override')
        .eq('playlist_id', playlistId)
        .order('sort_index', { ascending: true });
    
    if (playlistError || !playlistRows || playlistRows.length === 0) {
        throw new Error('Playlist has no content');
    }
    
    const contentIds = playlistRows.map(row => row.content_id).filter(Boolean);
    
    const { data: contentRows, error: contentError } = await window.supabaseClient
        .from('Content')
        .select('*, streaming_provider, provider_video_id')
        .in('id', contentIds)
        .eq('status', 'published');
    
    if (contentError) throw contentError;
    
    const contentMap = new Map();
    contentRows?.forEach(content => {
        contentMap.set(String(content.id), content);
    });
    
    const normalizedItems = playlistRows
        .map(row => {
            const content = contentMap.get(String(row.content_id));
            if (!content) return null;
            return {
                ...content,
                streaming_provider: content.streaming_provider || null,
                provider_video_id: content.provider_video_id || null,
                playlist_relation: {
                    sort_index: row.sort_index,
                    item_type: row.item_type,
                    track_number: row.track_number,
                    disc_number: row.disc_number,
                    season_number: row.season_number
                }
            };
        })
        .filter(Boolean);
    
    window.currentPlaylistItems = normalizedItems;
    
    // 🎯 Dispatch playlistLoaded event for other components to listen to
    window.dispatchEvent(new CustomEvent('playlistLoaded', {
        detail: { playlistId: playlistId, itemCount: window.currentPlaylistItems.length }
    }));
    
    window.currentPlaylistIndex = 0;
    if (typeof resetPlaylistCompletionLock === 'function') resetPlaylistCompletionLock();
    
    if (typeof renderAlbumTracks === 'function') {
        renderAlbumTracks(window.currentPlaylistItems);
    }
    
    if (window.currentPlaylistItems.length > 0) {
        await setCurrentContent(window.currentPlaylistItems[0], 0);
        if (typeof loadContentIntoPlayer === 'function') {
            await loadContentIntoPlayer(window.currentPlaylistItems[0]);
        }
    }
    
    if (typeof hideLoading === 'function') hideLoading();
}

// ============================================
// CENTRALIZED NEXT TRACK FUNCTION
// ============================================
window.playNextPlaylistItem = async function() {
    if (window._isNavigatingToNext) {
        console.log('⏭️ Already navigating to next, skipping');
        return;
    }
    
    if (window.playlistCompleting) {
        console.log('🚫 Playlist completion in progress, skipping');
        return;
    }
    
    const items = window.currentPlaylistItems || [];
    let index = window.currentPlaylistIndex ?? 0;
    
    if (!items.length) return;
    
    const nextIndex = index + 1;
    if (nextIndex >= items.length) {
        window.playlistCompleting = true;
        setTimeout(() => { window.playlistCompleting = false; }, 1000);
        return;
    }
    
    window._isNavigatingToNext = true;
    
    try {
        window.currentPlaylistIndex = nextIndex;
        const nextItem = items[nextIndex];
        await setCurrentContent(nextItem, nextIndex);
        if (typeof loadContentIntoPlayer === 'function') {
            await loadContentIntoPlayer(nextItem, nextIndex);
        }
        if (typeof syncPlaylistUI === 'function') {
            syncPlaylistUI();
        }
    } catch (error) {
        console.error('❌ Playlist advance error:', error);
    } finally {
        setTimeout(() => { window._isNavigatingToNext = false; }, 300);
    }
};

window.playPlaylistItemByIndex = async function(index) {
    if (window._isNavigatingToNext) {
        console.warn('🚫 Track transition already in progress');
        return;
    }
    
    if (!window.currentPlaylistItems?.[index]) return;
    
    const nextTrackId = window.currentPlaylistItems[index]?.id;
    if (window.currentContentId === nextTrackId) {
        console.log('⏭️ Track matches current active content. Skipping reload.');
        return;
    }
    
    window._isNavigatingToNext = true;
    
    try {
        const item = window.currentPlaylistItems[index];
        window.currentPlaylistIndex = index;
        await setCurrentContent(item, index);
        if (typeof loadContentIntoPlayer === 'function') {
            await loadContentIntoPlayer(item);
        }
        if (typeof syncPlaylistUI === 'function') {
            syncPlaylistUI();
        }
    } catch (error) {
        console.error('❌ Error playing playlist item:', error);
    } finally {
        setTimeout(() => { window._isNavigatingToNext = false; }, 500);
    }
};

function resetPlaylistCompletionLock() {
    window.playlistCompleting = false;
    window._isNavigatingToNext = false;
}

// ============================================
// DIRECT USER GESTURE PLAYBACK
// ============================================
const startPlaybackFromUserGesture = async () => {
    try {
        const player = document.getElementById('inlinePlayer');
        const placeholder = document.getElementById('videoPlaceholder');
        const heroPoster = document.getElementById('heroPoster');
        
        if (player) {
            player.style.display = 'block';
            player.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (placeholder) placeholder.style.display = 'none';
        if (heroPoster) heroPoster.style.opacity = '0.3';
        
        const playerInstance = window.enhancedVideoPlayer || enhancedVideoPlayer;
        if (!playerInstance || !playerInstance.video) {
            console.error('❌ Player instance not found.');
            return;
        }
        
        const video = playerInstance.video;
        
        if (!video.src && !window.isPlaylistMode && window.currentContent) {
            const fileUrl = getPlayableMediaUrl(window.currentContent);
            if (fileUrl) {
                video.src = fileUrl;
                video.load();
            }
        }
        
        video.muted = false;
        video.volume = 1.0;
        window.userHasInteractedWithMedia = true;
        document.body.classList.add('user-interacted');
        
        await video.play().catch(async (err) => {
            console.warn('⚠️ Unmuted play failed, trying muted fallback:', err.message);
            video.muted = true;
            await video.play();
        });
        
        const overlay = document.getElementById('initialPlayOverlay');
        if (overlay) overlay.classList.add('hidden');
        
        if (window.currentContent?.id && !watchSession) {
            initializeWatchSessionOnPlay();
        }
        
    } catch (error) {
        console.warn('⚠️ Direct playback failed:', error.message);
        if (typeof showToast === 'function') {
            showToast('Unable to start playback. Please try again.', 'error');
        }
    }
};

function initializeWatchSessionOnPlay() {
    if (!window.currentContent || !window.currentUserId) return;
    
    const player = window.enhancedVideoPlayer || enhancedVideoPlayer;
    if (!player?.video) return;
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    try {
        currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        watchSession = new WatchSessionManager(window.currentContentId, window.currentUserId);
        watchSession.initializeSession('Web', 'Desktop');
        watchSession.start(player.video);
        window._watchSession = watchSession;
    } catch (error) {
        console.error('❌ Failed to initialize watch session:', error);
    }
}

// ============================================
// LOADING FUNCTIONS
// ============================================
function showLoading(message = 'Loading...') {
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        const text = loadingScreen.querySelector('.loading-text');
        if (text) text.textContent = message;
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) loadingScreen.style.display = 'none';
}

// ============================================
// FETCH CONTENT PROFILE DETAILS
// ============================================
async function fetchContentProfileDetails(contentId) {
    try {
        const { data: mediaAsset, error: fetchError } = await window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                file_url,
                duration,
                media_type,
                content_format,
                created_at,
                user_id,
                streaming_provider,
                provider_video_id,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                ),
                content_engagement_stats (
                    total_views,
                    total_valid_views,
                    total_likes,
                    total_comments
                )
            `)
            .eq('id', contentId)
            .maybeSingle();
        
        if (fetchError) throw fetchError;
        if (!mediaAsset) return null;
        
        return {
            ...mediaAsset,
            streaming_provider: mediaAsset.streaming_provider || null,
            provider_video_id: mediaAsset.provider_video_id || null,
            views_count: mediaAsset.content_engagement_stats?.total_views || 0,
            likes_count: mediaAsset.content_engagement_stats?.total_likes || 0,
            valid_views_count: mediaAsset.content_engagement_stats?.total_valid_views || 0,
            comments_count: mediaAsset.content_engagement_stats?.total_comments || 0,
            creator: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || 'Creator',
            creator_display_name: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || 'Creator',
            creator_id: mediaAsset.user_id
        };
    } catch (error) {
        console.error("Critical Profile Fetch Interruption:", error.message);
        return null;
    }
}

// ============================================
// CRITICAL CONTENT LOADING
// ============================================
async function loadCriticalContentData(contentId) {
    const cached = localStorage.getItem(`content_${contentId}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed._cachedAt && Date.now() - parsed._cachedAt < 300000) {
                await setCurrentContent(parsed);
                refreshContentInBackground(contentId);
                return;
            }
        } catch(e) { console.warn('Cache parse error:', e); }
    }
    
    const profileData = await fetchContentProfileDetails(contentId);
    if (!profileData) {
        await loadContentFromURLLegacy();
        return;
    }
    
    let watchProgress = null;
    if (window.currentUserId) {
        const { data: progressData } = await window.supabaseClient
            .from('watch_progress')
            .select('last_position, is_completed')
            .eq('user_id', window.currentUserId)
            .eq('content_id', contentId)
            .maybeSingle();
        watchProgress = progressData;
    }
    
    const { data: streamingData } = await window.supabaseClient
        .from('Content')
        .select('quality_profiles, hls_manifest_url, data_saver_url')
        .eq('id', contentId)
        .maybeSingle();
    
    const contentObj = {
        id: profileData.id,
        title: profileData.title || 'Untitled',
        description: profileData.description || '',
        thumbnail_url: profileData.thumbnail_url,
        file_url: profileData.file_url,
        media_type: profileData.media_type || 'video',
        streaming_provider: profileData.streaming_provider || null,
        provider_video_id: profileData.provider_video_id || null,
        genre: profileData.genre || 'General',
        created_at: profileData.created_at,
        duration: profileData.duration || 3600,
        language: profileData.language || 'English',
        views_count: profileData.views_count,
        likes_count: profileData.likes_count,
        valid_views_count: profileData.valid_views_count,
        favorites_count: profileData.favorites_count || 0,
        comments_count: profileData.comments_count,
        creator: profileData.creator,
        creator_display_name: profileData.creator_display_name,
        creator_id: profileData.creator_id,
        user_id: profileData.user_id,
        user_profiles: profileData.user_profiles,
        watch_progress: watchProgress?.last_position || 0,
        is_completed: watchProgress?.is_completed || false,
        quality_profiles: streamingData?.quality_profiles || [],
        hls_manifest_url: streamingData?.hls_manifest_url || null,
        data_saver_url: streamingData?.data_saver_url || null,
        _cachedAt: Date.now()
    };
    
    await setCurrentContent(contentObj);
    localStorage.setItem(`content_${contentId}`, JSON.stringify(contentObj));
    
    if (window.currentContent.watch_progress > 10 && !window.currentContent.is_completed) {
        if (typeof addResumeButton === 'function') {
            addResumeButton(window.currentContent.watch_progress);
        }
    }
    
    if (window.currentUserId && typeof initializeLikeButton === 'function') {
        await initializeLikeButton(contentId, window.currentUserId);
        await initializeFavoriteButton(contentId, window.currentUserId);
    }
}

async function loadContentFromURLLegacy() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id') || '68';
    
    try {
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select('*, streaming_provider, provider_video_id, user_profiles!user_id(*)')
            .eq('id', contentId)
            .maybeSingle();
        
        if (contentError || !contentData) throw contentError || new Error('Content not found');
        
        const liveCounts = await loadLiveEngagementCounts(contentId);
        
        let watchProgress = null;
        if (window.currentUserId) {
            const { data: progressData } = await window.supabaseClient
                .from('watch_progress')
                .select('last_position, is_completed')
                .eq('user_id', window.currentUserId)
                .eq('content_id', contentId)
                .maybeSingle();
            watchProgress = progressData;
        }
        
        const contentObj = {
            id: contentData.id,
            title: contentData.title || 'Untitled',
            description: contentData.description || '',
            thumbnail_url: contentData.thumbnail_url,
            file_url: contentData.file_url,
            media_type: contentData.media_type || 'video',
            streaming_provider: contentData.streaming_provider || null,
            provider_video_id: contentData.provider_video_id || null,
            genre: contentData.genre || 'General',
            created_at: contentData.created_at,
            duration: contentData.duration || 3600,
            language: contentData.language || 'English',
            views_count: liveCounts.views,
            likes_count: liveCounts.likes,
            favorites_count: contentData.favorites_count || 0,
            comments_count: liveCounts.comments,
            creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_id: contentData.user_profiles?.id || contentData.user_id,
            user_id: contentData.user_id,
            user_profiles: contentData.user_profiles,
            watch_progress: watchProgress?.last_position || 0,
            is_completed: watchProgress?.is_completed || false
        };
        
        await setCurrentContent(contentObj);
        
        if (window.currentContent.watch_progress > 10 && !window.currentContent.is_completed && typeof addResumeButton === 'function') {
            addResumeButton(window.currentContent.watch_progress);
        }
        
        if (typeof loadComments === 'function') await loadComments(contentId);
        if (typeof loadRelatedContent === 'function') await loadRelatedContent(contentId);
        
    } catch (error) {
        console.error('❌ Content load failed:', error);
        if (typeof showToast === 'function') showToast('Content not available. Please try again.', 'error');
        document.getElementById('contentTitle').textContent = 'Content Unavailable';
    }
}

function refreshContentInBackground(contentId) {
    setTimeout(async () => {
        const liveCounts = await loadLiveEngagementCounts(contentId);
        if (window.currentContent && window.currentContent.id == contentId) {
            window.currentContent.views_count = liveCounts.views;
            window.currentContent.likes_count = liveCounts.likes;
            if (typeof updateCountsUI === 'function') updateCountsUI(window.currentContent);
            window.currentContent._cachedAt = Date.now();
            localStorage.setItem(`content_${contentId}`, JSON.stringify(window.currentContent));
        }
    }, 100);
}

// ============================================
// SECONDARY DATA LOADING
// ============================================
async function loadSecondaryContentData(contentId) {
    if (!contentId) return;
    Promise.all([
        typeof loadComments === 'function' ? loadComments(contentId) : Promise.resolve(),
        typeof loadRelatedContent === 'function' ? loadRelatedContent(contentId) : Promise.resolve(),
        window.currentUserId && typeof loadContinueWatching === 'function' ? loadContinueWatching(window.currentUserId) : Promise.resolve(),
        window.currentUserId && window.PlaylistManager && !playlistManager && typeof initializePlaylistManager === 'function' ? initializePlaylistManager() : Promise.resolve()
    ]).catch(err => console.warn('⚠️ Secondary data load failed:', err));
}

async function loadSecondaryContentDataForPlaylist() {
    if (!window.currentPlaylistItems || !window.currentPlaylistItems.length) return;
    const firstItemId = window.currentPlaylistItems[0]?.id;
    if (firstItemId) {
        Promise.all([
            typeof loadComments === 'function' ? loadComments(firstItemId) : Promise.resolve(),
            window.currentUserId && typeof loadContinueWatching === 'function' ? loadContinueWatching(window.currentUserId) : Promise.resolve(),
            window.currentUserId && window.PlaylistManager && !playlistManager && typeof initializePlaylistManager === 'function' ? initializePlaylistManager() : Promise.resolve()
        ]).catch(err => console.warn('⚠️ Playlist secondary data load failed:', err));
    }
}

// ============================================
// STREAMING MANAGER INITIALIZATION
// ============================================
async function initializeStreamingManager() {
    if (!window.StreamingManager) {
        console.warn('⚠️ StreamingManager not loaded');
        return;
    }
    
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    if (streamingManager) {
        streamingManager.updateContent(window.currentContent?.id);
        return;
    }
    
    try {
        streamingManager = new window.StreamingManager({
            videoElement: videoElement,
            supabaseClient: window.supabaseClient,
            contentId: window.currentContent?.id,
            userId: window.currentUserId,
            onQualityChange: function(data) {
                if (typeof updateQualityIndicator === 'function') updateQualityIndicator(data.quality);
                if (typeof showToast === 'function') showToast('Quality: ' + data.quality, 'info');
            },
            onDataSaverToggle: function(data) {
                if (typeof updateQualityIndicator === 'function') updateQualityIndicator(streamingManager.getCurrentQuality());
                if (typeof showToast === 'function') showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
            },
            onError: function(err) {
                console.error('❌ Streaming error:', err);
            }
        });
        await streamingManager.initialize();
        console.log('✅ StreamingManager initialized');
    } catch (error) {
        console.error('❌ Failed to initialize StreamingManager:', error);
    }
}

// ============================================
// AUTHENTICATION & PROFILE FUNCTIONS
// ============================================
async function waitForAuthHelper() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.AuthHelper && window.AuthHelper.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 50);
        setTimeout(() => {
            clearInterval(check);
            console.warn('⚠️ AuthHelper not loaded within timeout, continuing anyway');
            resolve();
        }, 2000);
    });
}

async function updateSidebarProfile() {
    if (typeof window.updateSidebarProfile === 'function') {
        await window.updateSidebarProfile();
    }
}

async function updateHeaderProfile() {
    if (typeof window.updateHeaderProfile === 'function') {
        await window.updateHeaderProfile();
    }
}

function updateProfileSwitcher() {
    if (typeof window.updateProfileSwitcher === 'function') {
        window.updateProfileSwitcher();
    }
}

function setupAuthListeners() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await window.AuthHelper.initialize();
            window.currentUserId = window.AuthHelper.getUserProfile()?.id || null;
            await updateSidebarProfile();
            await updateHeaderProfile();
            updateProfileSwitcher();
            if (typeof showToast === 'function') showToast('Welcome back!', 'success');
            if (window.currentUserId && typeof loadContinueWatching === 'function') {
                await loadContinueWatching(window.currentUserId);
            }
            if (window.currentContent?.id && typeof loadAllEngagementStates === 'function') {
                const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
                if (typeof updateEngagementUI === 'function') updateEngagementUI(states);
            }
            if (typeof updateCommentInputState === 'function') updateCommentInputState();
        } else if (event === 'SIGNED_OUT') {
            window.currentUserId = null;
            await updateSidebarProfile();
            await updateHeaderProfile();
            updateProfileSwitcher();
            if (typeof showToast === 'function') showToast('Signed out successfully', 'info');
            if (typeof updateCommentInputState === 'function') updateCommentInputState();
        }
    });
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        window.currentUserId = window.AuthHelper.getUserProfile()?.id || null;
    }
    
    if (typeof updateCommentInputState === 'function') updateCommentInputState();
}

// ============================================
// ENGAGEMENT BUTTON HANDLERS - FIXED
// ============================================

/**
 * Handle Like button click
 */
async function handleLikeButtonClick() {
    console.log('❤️ Like button clicked');
    
    if (!window.currentContent?.id) {
        console.warn('No current content for like action');
        if (typeof window.showToast === 'function') {
            window.showToast('No content selected', 'error');
        }
        return;
    }
    
    if (!window.currentUserId) {
        if (typeof window.showToast === 'function') {
            window.showToast('Sign in to like content', 'warning');
        }
        // Redirect to login after a moment
        setTimeout(() => {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }, 1500);
        return;
    }
    
    const likeBtn = document.getElementById('likeBtn');
    const likesCountEl = document.getElementById('likesCount');
    const isCurrentlyLiked = likeBtn?.classList.contains('active') || false;
    
    // Get current count for optimistic update
    let currentCount = parseInt(likesCountEl?.textContent?.replace(/\D/g, '') || '0') || 0;
    const newCount = isCurrentlyLiked ? currentCount - 1 : currentCount + 1;
    
    // Optimistic UI update
    if (likeBtn) {
        likeBtn.classList.toggle('active', !isCurrentlyLiked);
        likeBtn.innerHTML = !isCurrentlyLiked 
            ? '<i class="fas fa-heart"></i><span>Liked</span>' 
            : '<i class="far fa-heart"></i><span>Like</span>';
        likeBtn.disabled = true;
    }
    if (likesCountEl) {
        likesCountEl.textContent = window.formatNumber ? window.formatNumber(newCount) : newCount;
    }
    
    try {
        const newState = await toggleLike(window.currentContent.id, window.currentUserId, isCurrentlyLiked);
        
        if (newState === isCurrentlyLiked) {
            // Revert on failure
            if (likeBtn) {
                likeBtn.classList.toggle('active', isCurrentlyLiked);
                likeBtn.innerHTML = isCurrentlyLiked 
                    ? '<i class="fas fa-heart"></i><span>Liked</span>' 
                    : '<i class="far fa-heart"></i><span>Like</span>';
            }
            if (likesCountEl) {
                likesCountEl.textContent = window.formatNumber ? window.formatNumber(currentCount) : currentCount;
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Failed to update like', 'error');
            }
        } else {
            // Success - refresh counts from server
            const liveCounts = await loadLiveEngagementCounts(window.currentContent.id);
            if (likesCountEl) {
                likesCountEl.textContent = window.formatNumber ? window.formatNumber(liveCounts.likes) : liveCounts.likes;
            }
            if (typeof updateViewsUI === 'function') {
                updateViewsUI(liveCounts.views);
            }
            if (window.currentContent) {
                window.currentContent.likes_count = liveCounts.likes;
                window.currentContent.views_count = liveCounts.views;
            }
            
            // Update engagement cache
            if (typeof updateEngagementButtonsUI === 'function') {
                const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
                updateEngagementButtonsUI(states);
            }
            
            if (typeof window.showToast === 'function') {
                window.showToast(newState ? 'Liked!' : 'Unliked', 'success');
            }
        }
    } catch (error) {
        console.error('❌ Like button error:', error);
        if (likeBtn) {
            likeBtn.classList.toggle('active', isCurrentlyLiked);
            likeBtn.innerHTML = isCurrentlyLiked 
                ? '<i class="fas fa-heart"></i><span>Liked</span>' 
                : '<i class="far fa-heart"></i><span>Like</span>';
        }
        if (likesCountEl) {
            likesCountEl.textContent = window.formatNumber ? window.formatNumber(currentCount) : currentCount;
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to update like', 'error');
        }
    } finally {
        if (likeBtn) {
            likeBtn.disabled = false;
        }
    }
}

/**
 * Handle Favorite button click
 */
async function handleFavoriteButtonClick() {
    console.log('⭐ Favorite button clicked');
    
    if (!window.currentContent?.id) {
        console.warn('No current content for favorite action');
        return;
    }
    
    if (!window.currentUserId) {
        if (typeof window.showToast === 'function') {
            window.showToast('Sign in to favorite content', 'warning');
        }
        setTimeout(() => {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }, 1500);
        return;
    }
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    const favCountEl = document.getElementById('favoritesCount');
    const isCurrentlyFavorited = favoriteBtn?.classList.contains('active') || false;
    
    let currentCount = parseInt(favCountEl?.textContent?.replace(/\D/g, '') || '0') || 0;
    const newCount = isCurrentlyFavorited ? currentCount - 1 : currentCount + 1;
    
    // Optimistic UI
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('active', !isCurrentlyFavorited);
        favoriteBtn.innerHTML = !isCurrentlyFavorited 
            ? '<i class="fas fa-star"></i><span>Favorited</span>' 
            : '<i class="far fa-star"></i><span>Favorite</span>';
        favoriteBtn.disabled = true;
    }
    if (favCountEl) {
        favCountEl.textContent = window.formatNumber ? window.formatNumber(newCount) : newCount;
    }
    
    try {
        const newState = await toggleFavorite(window.currentContent.id, window.currentUserId, isCurrentlyFavorited);
        
        if (newState === isCurrentlyFavorited) {
            if (favoriteBtn) {
                favoriteBtn.classList.toggle('active', isCurrentlyFavorited);
                favoriteBtn.innerHTML = isCurrentlyFavorited 
                    ? '<i class="fas fa-star"></i><span>Favorited</span>' 
                    : '<i class="far fa-star"></i><span>Favorite</span>';
            }
            if (favCountEl) {
                favCountEl.textContent = window.formatNumber ? window.formatNumber(currentCount) : currentCount;
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Failed to update favorite', 'error');
            }
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast(newState ? 'Added to Favorites!' : 'Removed from Favorites', 'success');
            }
            // Update engagement cache
            if (typeof updateEngagementButtonsUI === 'function') {
                const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
                updateEngagementButtonsUI(states);
            }
        }
    } catch (error) {
        console.error('❌ Favorite button error:', error);
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('active', isCurrentlyFavorited);
            favoriteBtn.innerHTML = isCurrentlyFavorited 
                ? '<i class="fas fa-star"></i><span>Favorited</span>' 
                : '<i class="far fa-star"></i><span>Favorite</span>';
        }
        if (favCountEl) {
            favCountEl.textContent = window.formatNumber ? window.formatNumber(currentCount) : currentCount;
        }
    } finally {
        if (favoriteBtn) {
            favoriteBtn.disabled = false;
        }
    }
}

/**
 * Handle Watch Later button click
 */
async function handleWatchLaterButtonClick() {
    console.log('⏰ Watch Later button clicked');
    
    if (!window.currentContent?.id) {
        console.warn('No current content for watch later action');
        return;
    }
    
    if (!window.currentUserId) {
        if (typeof window.showToast === 'function') {
            window.showToast('Sign in to use Watch Later', 'warning');
        }
        setTimeout(() => {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }, 1500);
        return;
    }
    
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    const isCurrentlySaved = watchLaterBtn?.classList.contains('active') || false;
    
    // Optimistic UI
    if (watchLaterBtn) {
        watchLaterBtn.classList.toggle('active', !isCurrentlySaved);
        watchLaterBtn.innerHTML = !isCurrentlySaved 
            ? '<i class="fas fa-clock"></i><span>Watch Later</span>' 
            : '<i class="far fa-clock"></i><span>Watch Later</span>';
        watchLaterBtn.disabled = true;
    }
    
    try {
        const newState = await toggleWatchLater(window.currentContent.id, window.currentUserId, isCurrentlySaved);
        
        if (newState === isCurrentlySaved) {
            if (watchLaterBtn) {
                watchLaterBtn.classList.toggle('active', isCurrentlySaved);
                watchLaterBtn.innerHTML = isCurrentlySaved 
                    ? '<i class="fas fa-clock"></i><span>Watch Later</span>' 
                    : '<i class="far fa-clock"></i><span>Watch Later</span>';
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Failed to update Watch Later', 'error');
            }
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast(newState ? 'Added to Watch Later!' : 'Removed from Watch Later', 'success');
            }
            // Update engagement cache
            if (typeof updateEngagementButtonsUI === 'function') {
                const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
                updateEngagementButtonsUI(states);
            }
        }
    } catch (error) {
        console.error('❌ Watch Later button error:', error);
        if (watchLaterBtn) {
            watchLaterBtn.classList.toggle('active', isCurrentlySaved);
            watchLaterBtn.innerHTML = isCurrentlySaved 
                ? '<i class="fas fa-clock"></i><span>Watch Later</span>' 
                : '<i class="far fa-clock"></i><span>Watch Later</span>';
        }
    } finally {
        if (watchLaterBtn) {
            watchLaterBtn.disabled = false;
        }
    }
}

/**
 * Handle Share button click
 */
async function handleShareButtonClick() {
    console.log('📤 Share button clicked');
    
    if (!window.currentContent?.id) {
        console.warn('No current content for share action');
        return;
    }
    
    const shareBtn = document.getElementById('shareBtn');
    const originalHTML = shareBtn?.innerHTML;
    
    if (shareBtn) {
        shareBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Sharing...</span>';
        shareBtn.disabled = true;
    }
    
    try {
        await shareContent(window.currentContent.id, window.currentUserId);
    } catch (error) {
        console.error('Share error:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to share', 'error');
        }
    } finally {
        if (shareBtn) {
            shareBtn.innerHTML = originalHTML;
            shareBtn.disabled = false;
        }
    }
}

/**
 * Load all engagement states and update UI
 */
async function loadAndUpdateEngagementStates() {
    if (!window.currentContent?.id || !window.currentUserId) return;
    
    try {
        const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
        if (typeof updateEngagementButtonsUI === 'function') {
            updateEngagementButtonsUI(states);
        }
        console.log('✅ Engagement states loaded and UI updated:', states);
    } catch (error) {
        console.error('Failed to load engagement states:', error);
    }
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================
function setupEventListeners() {
    console.log('🔧 Setting up event listeners for engagement buttons...');
    
    // Like button
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        const newLikeBtn = likeBtn.cloneNode(true);
        likeBtn.parentNode?.replaceChild(newLikeBtn, likeBtn);
        newLikeBtn.addEventListener('click', handleLikeButtonClick);
        console.log('✅ Like button listener attached');
    }
    
    // Favorite button
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        const newFavoriteBtn = favoriteBtn.cloneNode(true);
        favoriteBtn.parentNode?.replaceChild(newFavoriteBtn, favoriteBtn);
        newFavoriteBtn.addEventListener('click', handleFavoriteButtonClick);
        console.log('✅ Favorite button listener attached');
    }
    
    // Watch Later button
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
        const newWatchLaterBtn = watchLaterBtn.cloneNode(true);
        watchLaterBtn.parentNode?.replaceChild(newWatchLaterBtn, watchLaterBtn);
        newWatchLaterBtn.addEventListener('click', handleWatchLaterButtonClick);
        console.log('✅ Watch Later button listener attached');
    }
    
    // Share button
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        const newShareBtn = shareBtn.cloneNode(true);
        shareBtn.parentNode?.replaceChild(newShareBtn, shareBtn);
        newShareBtn.addEventListener('click', handleShareButtonClick);
        console.log('✅ Share button listener attached');
    }
    
    // Play button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        const newPlayBtn = playBtn.cloneNode(true);
        playBtn.parentNode?.replaceChild(newPlayBtn, playBtn);
        newPlayBtn.addEventListener('click', startPlaybackFromUserGesture);
    }
    
    const poster = document.getElementById('heroPoster');
    if (poster) {
        const newPoster = poster.cloneNode(true);
        poster.parentNode.replaceChild(newPoster, poster);
        newPoster.addEventListener('click', startPlaybackFromUserGesture);
    }
    
    // Close player button
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.addEventListener('click', function() {
            if (typeof closeVideoPlayer === 'function') closeVideoPlayer();
        });
    }
    
    if (typeof setupConnectButtons === 'function') {
        setupConnectButtons();
    }
    
    if (typeof setupCommentEventListeners === 'function') {
        setupCommentEventListeners();
    }
    
    if (typeof setupContinueWatchingRefresh === 'function') {
        setupContinueWatchingRefresh();
    }
    
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', function() {
            backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        });
    }
    
    // Setup player ended listener
    setupPlayerEndedListener();
    
    console.log('✅ All event listeners setup complete');
}

function setupPlayerEndedListener() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) {
        setTimeout(setupPlayerEndedListener, 500);
        return;
    }
    
    const handleEnded = () => {
        if (typeof window.playNextPlaylistItem === 'function') {
            window.playNextPlaylistItem();
        }
    };
    
    videoElement.removeEventListener('ended', handleEnded);
    videoElement.addEventListener('ended', handleEnded);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Content Detail: Starting optimized load sequence...');
    
    const skeleton = document.getElementById('content-skeleton');
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (app) app.style.display = 'block';
    if (skeleton) skeleton.style.display = 'block';
    
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');
    const playlistId = urlParams.get('playlist_id') || urlParams.get('albumId');
    const playlistType = urlParams.get('type');
    
    currentSessionId = localStorage.getItem('bantu_view_session');
    if (!currentSessionId) {
        currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('bantu_view_session', currentSessionId);
    }
    
    await waitForAuthHelper();
    if (window.AuthHelper && !window.AuthHelper.isInitialized) {
        await window.AuthHelper.initialize();
    }
    window.currentUserId = window.AuthHelper?.getUserProfile?.()?.id || null;
    
    if (typeof initThemeSelector === 'function') initThemeSelector();
    if (typeof initGlobalNavigation === 'function') initGlobalNavigation();
    if (typeof setupCompleteSidebar === 'function') setupCompleteSidebar();
    if (typeof setupNavigationButtons === 'function') setupNavigationButtons();
    if (typeof setupNavButtonScrollAnimation === 'function') setupNavButtonScrollAnimation();
    
    if (typeof UIScaleController !== 'undefined') {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    setupAuthListeners();
    await updateSidebarProfile();
    await updateHeaderProfile();
    updateProfileSwitcher();
    
    if (typeof setupAlbumToggle === 'function') setupAlbumToggle();
    
    try {
        if (playlistId) {
            window.isPlaylistMode = true;
            await loadPlaylistMode(playlistId, playlistType);
            if (typeof syncPlaylistUI === 'function') syncPlaylistUI();
        } else if (contentId) {
            await loadCriticalContentData(contentId);
            window.isPlaylistMode = false;
        } else {
            throw new Error('No content ID or playlist ID provided');
        }
        
        await Promise.all([
            updateSidebarProfile(),
            updateHeaderProfile()
        ]);
        
        if (skeleton) skeleton.style.display = 'none';
        if (typeof updateCommentInputState === 'function') updateCommentInputState();
        
        if (typeof initAnalyticsModal === 'function') initAnalyticsModal();
        if (typeof initSearchModal === 'function') initSearchModal();
        if (typeof initNotificationsPanel === 'function') initNotificationsPanel();
        
        if (window.PlaylistManager && window.currentUserId && typeof initializePlaylistManager === 'function') {
            await initializePlaylistManager();
        }
        
        if (typeof initializeRecommendationEngine === 'function') {
            if (!window.isPlaylistMode && window.currentContent?.id) {
                await initializeRecommendationEngine();
            } else if (window.isPlaylistMode && window.currentPlaylistItems?.length > 0) {
                await initializeRecommendationEngineForPlaylist(window.currentPlaylistItems[0]?.id);
            }
        }
        
        if (typeof applyMobileHeaderStyles === 'function') applyMobileHeaderStyles();
        
        if (!window.isPlaylistMode && window.currentContent && window.ContentCollectionsEngine) {
            await window.ContentCollectionsEngine.initialize(window.currentContent);
        }
        
        if (!window.isPlaylistMode && window.currentContent?.id) {
            setTimeout(() => {
                const player = document.getElementById('inlinePlayer');
                const video = document.getElementById('inlineVideoPlayer');
                if (player && video && !window.enhancedVideoPlayer && typeof initializeEnhancedVideoPlayer === 'function') {
                    initializeEnhancedVideoPlayer();
                }
            }, 300);
        }
        
    } catch (err) {
        console.error('❌ Critical load failed:', err);
        if (typeof showToast === 'function') showToast('Failed to load content. Retrying...', 'error');
        if (skeleton) skeleton.style.display = 'none';
        try {
            await loadContentFromURLLegacy();
        } catch (fallbackErr) {
            console.error('Fallback also failed:', fallbackErr);
            document.getElementById('contentTitle').textContent = 'Content Unavailable';
        }
    }
    
    requestIdleCallback(() => {
        setupEventListeners();
        if (window.isPlaylistMode && window.currentPlaylistItems?.length > 0) {
            loadSecondaryContentDataForPlaylist();
        } else if (window.currentContent?.id) {
            loadSecondaryContentData(window.currentContent.id);
        }
        if (typeof initializeVideoPlayerSkeleton === 'function') initializeVideoPlayerSkeleton();
    }, { timeout: 2000 });
    
    setTimeout(() => {
        if (skeleton && skeleton.style.display !== 'none') skeleton.style.display = 'none';
        const loading = document.getElementById('loading');
        const appElem = document.getElementById('app');
        if (loading && appElem && loading.style.display !== 'none') {
            loading.style.display = 'none';
            appElem.style.display = 'block';
        }
    }, 5000);
    
    console.log('✅ Content Detail initialization complete with modular architecture');
});

// ============================================
// PLACEHOLDER FUNCTIONS FOR MODULES TO OVERRIDE
// ============================================
async function initializeRecommendationEngine() {
    if (window.RecommendationEngine && window.currentContent?.id) {
        try {
            recommendationEngine = new window.RecommendationEngine({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                currentContentId: window.currentContent.id,
                limit: 8,
                minWatchThreshold: 0.5,
                cacheDuration: 60000
            });
            if (typeof loadRecommendationRails === 'function') await loadRecommendationRails();
        } catch (error) {
            console.error('Failed to initialize RecommendationEngine:', error);
        }
    }
}

async function initializeRecommendationEngineForPlaylist(contentId) {
    if (window.RecommendationEngine && contentId) {
        try {
            recommendationEngine = new window.RecommendationEngine({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                currentContentId: contentId,
                limit: 8,
                minWatchThreshold: 0.5,
                cacheDuration: 60000
            });
            if (typeof loadRecommendationRails === 'function') await loadRecommendationRails();
        } catch (error) {
            console.error('Failed to initialize RecommendationEngine:', error);
        }
    }
}

async function initializePlaylistManager() {
    if (typeof window.PlaylistManager === 'function' && window.currentUserId) {
        try {
            playlistManager = new window.PlaylistManager({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                watchLaterName: 'Watch Later'
            });
            if (typeof updateWatchLaterButtonState === 'function') await updateWatchLaterButtonState();
        } catch (error) {
            console.error('Failed to initialize PlaylistManager:', error);
        }
    }
}

function initializePlaylistModal() {
    if (window.PlaylistModal && window.currentUserId && window.currentContent?.id) {
        try {
            playlistModal = new window.PlaylistModal({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                contentId: window.currentContent.id
            });
            window.playlistModal = playlistModal;
        } catch (error) {
            console.error('Failed to initialize PlaylistModal:', error);
        }
    }
}

function initializeKeyboardShortcuts() {
    if (window.KeyboardShortcuts && (window.enhancedVideoPlayer || enhancedVideoPlayer)) {
        const player = window.enhancedVideoPlayer || enhancedVideoPlayer;
        if (player?.video) {
            try {
                keyboardShortcuts = new window.KeyboardShortcuts({
                    videoElement: player.video,
                    supabaseClient: window.supabaseClient,
                    contentId: window.currentContent?.id
                });
                window.keyboardShortcuts = keyboardShortcuts;
            } catch (error) {
                console.error('Failed to initialize KeyboardShortcuts:', error);
            }
        }
    }
}

function initAnalyticsModal() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    if (analyticsBtn && analyticsModal) {
        analyticsBtn.addEventListener('click', () => analyticsModal.classList.add('active'));
        if (closeAnalytics) closeAnalytics.addEventListener('click', () => analyticsModal.classList.remove('active'));
    }
}

function initSearchModal() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', () => searchModal.classList.add('active'));
        if (closeSearchBtn) closeSearchBtn.addEventListener('click', () => searchModal.classList.remove('active'));
    }
}

function initNotificationsPanel() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    if (notificationsBtn && notificationsPanel) {
        notificationsBtn.addEventListener('click', () => notificationsPanel.classList.add('active'));
        if (closeNotifications) closeNotifications.addEventListener('click', () => notificationsPanel.classList.remove('active'));
    }
}

function applyMobileHeaderStyles() {
    if (typeof window.applyMobileHeaderStyles === 'function') {
        window.applyMobileHeaderStyles();
    }
}

function initGlobalNavigation() {
    if (typeof window.initGlobalNavigation === 'function') {
        window.initGlobalNavigation();
    }
}

function initThemeSelector() {
    if (typeof window.initThemeSelector === 'function') {
        window.initThemeSelector();
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.recordView = recordContentViewRPC;
window.loadAllEngagementStates = loadAllEngagementStates;
window.toggleLike = toggleLike;
window.toggleFavorite = toggleFavorite;
window.toggleWatchLater = toggleWatchLater;
window.shareContent = shareContent;
window.updateGlobalContentId = updateGlobalContentId;
window.setCurrentContent = setCurrentContent;
window.loadLiveEngagementCounts = loadLiveEngagementCounts;
window.startPlaybackFromUserGesture = startPlaybackFromUserGesture;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.resetPlaylistCompletionLock = resetPlaylistCompletionLock;
window.streamingManager = streamingManager;
window.enhancedVideoPlayer = enhancedVideoPlayer;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;
window.watchSession = watchSession;
window.handleLikeButtonClick = handleLikeButtonClick;
window.handleFavoriteButtonClick = handleFavoriteButtonClick;
window.handleWatchLaterButtonClick = handleWatchLaterButtonClick;
window.handleShareButtonClick = handleShareButtonClick;
window.loadAndUpdateEngagementStates = loadAndUpdateEngagementStates;

console.log('✅ Content Detail Main Orchestrator ready');
