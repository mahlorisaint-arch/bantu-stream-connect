// js/content-detail.js
// ============================================
// THE LIGHTWEIGHT ORCHESTRATOR - FULLY UPDATED
// Contains global state, bootstrapping, core DB logic, and event binding.
// Delegates UI rendering to module files.
// ============================================
console.log('🎬 Content Detail Orchestrator Loading...');

// ============================================
// GLOBAL STATE
// ============================================
window.currentPlaylistItems = [];
window.currentPlaylistIndex = 0;
window.currentPlaylist = null;
window.currentContentId = null;
window.currentContent = null;
window.currentUserId = null;
window.playlistCompleting = false;
window.engagementLoadToken = null;
window.isPlaylistMode = false;
window.isTrackTransitioning = false;

// Engagement state caches
let likedContentCache = new Set();
let favoritedContentCache = new Set();
let watchLaterContentCache = new Set();

// View recording state
let viewRecordedForCurrentContent = false;
let currentSessionId = null;

// Component instances
let enhancedVideoPlayer = null;
let watchSession = null;
let playlistManager = null;
let recommendationEngine = null;
let streamingManager = null;
let keyboardShortcuts = null;
let playlistModal = null;

// ============================================
// CORE ENGAGEMENT DB FUNCTIONS
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
        
        if (data?.views !== undefined && typeof updateViewsUI === 'function') {
            updateViewsUI(data.views);
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
        
        if (checkError) console.warn('Check for existing view failed:', checkError);
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

function _forceUpdateEngagementUI(counts) {
    if (typeof updateViewsUI === 'function') updateViewsUI(counts.views);
    
    const likesEl = document.getElementById('likesCount');
    if (likesEl && counts.likes !== undefined) {
        const formatted = window.formatNumber(counts.likes);
        if (likesEl.textContent !== formatted) likesEl.textContent = formatted;
    }
    
    if (window.currentContent) {
        window.currentContent.views_count = counts.views;
        window.currentContent.likes_count = counts.likes;
    }
}

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
            _forceUpdateEngagementUI(result);
            console.log('✅ Counts from stats table:', result);
            return result;
        }

        console.log('⚠️ Stats row missing, using direct count fallback');
        
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
        
        setTimeout(() => _forceUpdateEngagementUI(result), 50);
        return result;
    } catch (error) {
        console.error('❌ Failed to load live counts:', error);
        return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
}

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
        
        return states;
    } catch (error) {
        console.error('❌ Failed to load engagement states:', error);
        return { liked: false, favorited: false, watchLater: false };
    }
}

async function toggleLike(contentId, userId, isCurrentlyLiked) {
    if (!userId) {
        window.showToast('Sign in to like content', 'warning');
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
        window.showToast('Failed to update like', 'error');
        return isCurrentlyLiked;
    }
}

async function toggleFavorite(contentId, userId, isCurrentlyFavorited) {
    if (!userId) {
        window.showToast('Sign in to favorite content', 'warning');
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
        window.showToast('Failed to update favorite', 'error');
        return isCurrentlyFavorited;
    }
}

async function toggleWatchLater(contentId, userId, isCurrentlySaved) {
    if (!userId) {
        window.showToast('Sign in to use Watch Later', 'warning');
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
        window.showToast('Failed to update Watch Later', 'error');
        return isCurrentlySaved;
    }
}

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
            window.showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
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
        
        if (typeof updateShareCountUI === 'function') updateShareCountUI(1);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
            window.showToast('Failed to share. Try copying link manually.', 'error');
        }
    }
}

function updateEngagementUI(states) {
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        if (states.liked) {
            likeBtn.classList.add('active');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
        } else {
            likeBtn.classList.remove('active');
            likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
        }
    }
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        if (states.favorited) {
            favoriteBtn.classList.add('active');
            favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
        } else {
            favoriteBtn.classList.remove('active');
            favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
        }
    }
    
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
        if (states.watchLater) {
            watchLaterBtn.classList.add('active');
            watchLaterBtn.innerHTML = '<i class="fas fa-clock"></i><span>Watch Later</span>';
        } else {
            watchLaterBtn.classList.remove('active');
            watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
        }
    }
}

async function handleLikeButtonClick() {
    if (!window.currentContent?.id) return;
    if (!window.currentUserId) {
        window.showToast('Sign in to like content', 'warning');
        return;
    }
    
    const likeBtn = document.getElementById('likeBtn');
    const likesCountEl = document.getElementById('likesCount');
    const isCurrentlyLiked = likeBtn?.classList.contains('active') || false;
    let currentCount = parseInt(likesCountEl?.textContent?.replace(/\D/g, '') || '0') || 0;
    const newCount = isCurrentlyLiked ? currentCount - 1 : currentCount + 1;
    
    if (likeBtn) {
        likeBtn.classList.toggle('active', !isCurrentlyLiked);
        likeBtn.innerHTML = !isCurrentlyLiked ? '<i class="fas fa-heart"></i><span>Liked</span>' : '<i class="far fa-heart"></i><span>Like</span>';
    }
    if (likesCountEl) likesCountEl.textContent = window.formatNumber(newCount);
    
    const newState = await toggleLike(window.currentContent.id, window.currentUserId, isCurrentlyLiked);
    
    if (newState === isCurrentlyLiked) {
        if (likeBtn) {
            likeBtn.classList.toggle('active', isCurrentlyLiked);
            likeBtn.innerHTML = isCurrentlyLiked ? '<i class="fas fa-heart"></i><span>Liked</span>' : '<i class="far fa-heart"></i><span>Like</span>';
        }
        if (likesCountEl) likesCountEl.textContent = window.formatNumber(currentCount);
    } else {
        const liveCounts = await loadLiveEngagementCounts(window.currentContent.id);
        if (likesCountEl) likesCountEl.textContent = window.formatNumber(liveCounts.likes);
        if (typeof updateViewsUI === 'function') updateViewsUI(liveCounts.views);
        if (window.currentContent) {
            window.currentContent.likes_count = liveCounts.likes;
            window.currentContent.views_count = liveCounts.views;
        }
    }
}

async function handleFavoriteButtonClick() {
    if (!window.currentContent?.id) return;
    if (!window.currentUserId) {
        window.showToast('Sign in to favorite content', 'warning');
        return;
    }
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    const favCountEl = document.getElementById('favoritesCount');
    const isCurrentlyFavorited = favoriteBtn?.classList.contains('active') || false;
    let currentCount = parseInt(favCountEl?.textContent?.replace(/\D/g, '') || '0') || 0;
    const newCount = isCurrentlyFavorited ? currentCount - 1 : currentCount + 1;
    
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('active', !isCurrentlyFavorited);
        favoriteBtn.innerHTML = !isCurrentlyFavorited ? '<i class="fas fa-star"></i><span>Favorited</span>' : '<i class="far fa-star"></i><span>Favorite</span>';
    }
    if (favCountEl) favCountEl.textContent = window.formatNumber(newCount);
    
    const newState = await toggleFavorite(window.currentContent.id, window.currentUserId, isCurrentlyFavorited);
    
    if (newState === isCurrentlyFavorited) {
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('active', isCurrentlyFavorited);
            favoriteBtn.innerHTML = isCurrentlyFavorited ? '<i class="fas fa-star"></i><span>Favorited</span>' : '<i class="far fa-star"></i><span>Favorite</span>';
        }
        if (favCountEl) favCountEl.textContent = window.formatNumber(currentCount);
    }
}

async function handleWatchLaterButtonClick() {
    if (!window.currentContent?.id) return;
    if (!window.currentUserId) {
        window.showToast('Sign in to use Watch Later', 'warning');
        return;
    }
    
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    const isCurrentlySaved = watchLaterBtn?.classList.contains('active') || false;
    
    if (watchLaterBtn) {
        watchLaterBtn.classList.toggle('active', !isCurrentlySaved);
        watchLaterBtn.innerHTML = !isCurrentlySaved ? '<i class="fas fa-clock"></i><span>Watch Later</span>' : '<i class="far fa-clock"></i><span>Watch Later</span>';
    }
    
    const newState = await toggleWatchLater(window.currentContent.id, window.currentUserId, isCurrentlySaved);
    
    if (newState === isCurrentlySaved && watchLaterBtn) {
        watchLaterBtn.classList.toggle('active', isCurrentlySaved);
        watchLaterBtn.innerHTML = isCurrentlySaved ? '<i class="fas fa-clock"></i><span>Watch Later</span>' : '<i class="far fa-clock"></i><span>Watch Later</span>';
    }
}

function setupRealtimeSubscriptions() {
    if (!window.supabaseClient || !window.currentContent?.id) return;
    
    const channels = ['stats-channel', 'likes-channel', 'views-channel'];
    channels.forEach(name => {
        const ch = window.supabaseClient.channel(name);
        if (ch?.status !== 'CLOSED') window.supabaseClient.removeChannel(ch);
    });
    
    const statsChannel = window.supabaseClient
        .channel('stats-channel')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'content_engagement_stats',
            filter: `content_id=eq.${window.currentContent.id}`
        }, (payload) => {
            if (payload.new && window.currentContent?.id === payload.new.content_id) {
                if (typeof updateViewsUI === 'function') updateViewsUI(payload.new.total_views || 0);
                const likesEl = document.getElementById('likesCount');
                if (likesEl) likesEl.textContent = window.formatNumber(payload.new.total_likes || 0);
                if (window.currentContent) {
                    window.currentContent.views_count = payload.new.total_views || 0;
                    window.currentContent.likes_count = payload.new.total_likes || 0;
                }
            }
        })
        .subscribe();
}

// ============================================
// GLOBAL SYNC FUNCTIONS
// ============================================

function updateGlobalContentId(contentId) {
    if (window.currentContentId === contentId) {
        console.log('⏭️ Skipping duplicate contentId update');
        return;
    }
    
    console.log(`🔄 Updating global contentId from ${window.currentContentId} to ${contentId}`);
    window.currentContentId = contentId;
    
    if (enhancedVideoPlayer) enhancedVideoPlayer.contentId = contentId;
    if (streamingManager) streamingManager.contentId = contentId;
    if (watchSession) {
        watchSession.contentId = contentId;
        watchSession.viewRecorded = false;
        watchSession.viewThresholdReached = false;
    }
    if (recommendationEngine) recommendationEngine.currentContentId = contentId;
    
    viewRecordedForCurrentContent = false;
    window.dispatchEvent(new CustomEvent('contentIdChanged', { detail: { contentId: contentId } }));
}

async function setCurrentContent(content, index = null) {
    if (!content) return;
    
    updateGlobalContentId(content.id);
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    window.currentContent = content;
    if (index !== undefined && index !== null) window.currentPlaylistIndex = index;
    
    if (typeof updateContentUI === 'function') updateContentUI(content);
    
    if (window.currentUserId) {
        try {
            const states = await loadAllEngagementStates(content.id, window.currentUserId);
            updateEngagementUI(states);
        } catch (e) {}
    }
    
    setTimeout(async () => {
        try {
            const liveCounts = await loadLiveEngagementCounts(content.id);
            if (window.currentContent?.id === content.id) _forceUpdateEngagementUI(liveCounts);
        } catch (error) {}
    }, 100);
    
    const favCountEl = document.getElementById('favoritesCount');
    if (favCountEl && content.favorites_count !== undefined) {
        favCountEl.textContent = window.formatNumber(content.favorites_count);
    }
}

// ============================================
// PLAYLIST CONTROL DB FUNCTIONS
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
                    id, title, description, thumbnail_url, file_url, duration,
                    media_type, status, user_id, content_type, content_format,
                    content_metadata, favorites_count, comments_count, shares_count,
                    live_views, creator_display_name
                )
            `)
            .eq('playlist_id', playlistId)
            .eq('Content.status', 'published')
            .order('sort_index', { ascending: true });
        
        if (error || !playlistItems?.length) throw error || new Error('No items');
        
        const normalizedItems = playlistItems.map(item => {
            let contentData = item.Content;
            if (Array.isArray(contentData) && contentData.length > 0) contentData = contentData[0];
            if (!contentData || contentData.status !== 'published') return null;
            return { ...contentData, playlist_relation: { sort_index: item.sort_index, item_type: item.item_type, track_number: item.track_number, disc_number: item.disc_number, season_number: item.season_number } };
        }).filter(Boolean);
        
        if (!normalizedItems.length) throw new Error('No valid published content items');
        
        window.currentPlaylistItems = normalizedItems;
        window.currentPlaylistIndex = 0;
        resetPlaylistCompletionLock();
        
        const { data: playlistMeta, error: metaError } = await window.supabaseClient
            .from('creator_playlists')
            .select(`*, user_profiles!creator_id (username, full_name, avatar_url)`)
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
        
        if (typeof renderAlbumTracks === 'function') renderAlbumTracks(window.currentPlaylistItems);
        if (window.currentPlaylistItems.length > 0) {
            await setCurrentContent(window.currentPlaylistItems[0], 0);
            if (typeof loadContentIntoPlayer === 'function') await loadContentIntoPlayer(window.currentPlaylistItems[0]);
        }
        if (typeof hideLoading === 'function') hideLoading();
    } catch (error) {
        console.error('Playlist mode failed:', error);
        await loadPlaylistModeTwoQueryFallback(playlistId, playlistType);
    }
}

async function loadPlaylistModeTwoQueryFallback(playlistId, playlistType) {
    const { data: playlistRows, error: playlistError } = await window.supabaseClient
        .from('playlist_contents')
        .select(`playlist_id, content_id, sort_index, item_type, track_number, disc_number, season_number, display_title_override`)
        .eq('playlist_id', playlistId)
        .order('sort_index', { ascending: true });
    
    if (playlistError || !playlistRows?.length) throw playlistError || new Error('No content');
    
    const contentIds = playlistRows.map(row => row.content_id).filter(Boolean);
    const { data: contentRows, error: contentError } = await window.supabaseClient
        .from('Content')
        .select(`id, title, description, thumbnail_url, file_url, duration, media_type, status, user_id, content_type, content_format, content_metadata, favorites_count, comments_count, shares_count, live_views, creator_display_name, user_profiles!user_id (id, full_name, username, avatar_url)`)
        .in('id', contentIds)
        .eq('status', 'published');
    
    if (contentError) throw contentError;
    
    const contentMap = new Map();
    contentRows?.forEach(content => contentMap.set(String(content.id), content));
    
    const normalizedItems = playlistRows.map(row => {
        const content = contentMap.get(String(row.content_id));
        if (!content) return null;
        return { ...content, playlist_relation: { sort_index: row.sort_index, item_type: row.item_type, track_number: row.track_number, disc_number: row.disc_number, season_number: row.season_number } };
    }).filter(Boolean);
    
    if (!normalizedItems.length) throw new Error('No valid published content items');
    
    window.currentPlaylistItems = normalizedItems;
    window.currentPlaylistIndex = 0;
    resetPlaylistCompletionLock();
    
    if (typeof renderAlbumTracks === 'function') renderAlbumTracks(window.currentPlaylistItems);
    if (window.currentPlaylistItems.length > 0) {
        await setCurrentContent(window.currentPlaylistItems[0], 0);
        if (typeof loadContentIntoPlayer === 'function') await loadContentIntoPlayer(window.currentPlaylistItems[0]);
    }
    if (typeof hideLoading === 'function') hideLoading();
}

window.playNextPlaylistItem = async function() {
    if (window._isNavigatingToNext || window.playlistCompleting) return;
    
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
        if (typeof loadContentIntoPlayer === 'function') await loadContentIntoPlayer(nextItem, nextIndex);
        if (typeof syncPlaylistUI === 'function') syncPlaylistUI();
    } catch (error) {
        console.error('Playlist advance error:', error);
    } finally {
        setTimeout(() => { window._isNavigatingToNext = false; }, 300);
    }
};

async function playPlaylistItemByIndex(index) {
    if (window._isNavigatingToNext) return;
    if (!window.currentPlaylistItems?.[index]) return;
    if (window.currentContentId === window.currentPlaylistItems[index]?.id) return;
    
    window._isNavigatingToNext = true;
    try {
        const item = window.currentPlaylistItems[index];
        window.currentPlaylistIndex = index;
        await setCurrentContent(item, index);
        if (typeof loadContentIntoPlayer === 'function') await loadContentIntoPlayer(item);
        if (typeof syncPlaylistUI === 'function') syncPlaylistUI();
    } catch (error) {
        console.error('Error playing playlist item:', error);
    } finally {
        setTimeout(() => { window._isNavigatingToNext = false; }, 500);
    }
}

function resetPlaylistCompletionLock() {
    window.playlistCompleting = false;
    window._isNavigatingToNext = false;
}

// ============================================
// LOADING UI FUNCTIONS
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
// DELEGATED FUNCTIONS (Call module functions)
// ============================================

/**
 * Load comments - delegates to comments module
 */
async function loadComments(contentId) {
    if (typeof window.loadComments === 'function') {
        return await window.loadComments(contentId);
    }
    console.warn('⚠️ loadComments not available in comments module');
    return [];
}

/**
 * Refresh content in background for cache
 */
function refreshContentInBackground(contentId) {
    try {
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
    } catch(e) { console.warn('Background refresh failed:', e); }
}

/**
 * Setup connect buttons - delegates to creator module
 */
function setupConnectButtons() {
    if (typeof window.setupConnectButtons === 'function') {
        window.setupConnectButtons();
    } else {
        console.warn('⚠️ setupConnectButtons not available in creator module');
    }
}

/**
 * Setup initial play overlay button - delegates to video-player module
 */
function setupInitialPlayButton() {
    if (typeof window.setupInitialPlayButton === 'function') {
        window.setupInitialPlayButton();
    }
}

/**
 * Setup view sync listener - delegates to stats-grid module
 */
function setupViewSyncListener() {
    if (typeof window.setupViewSyncListener === 'function') {
        window.setupViewSyncListener();
    }
}

/**
 * Update watch later button state - delegates to features
 */
async function updateWatchLaterButtonState() {
    if (typeof window.updateWatchLaterButtonState === 'function') {
        await window.updateWatchLaterButtonState();
    }
}

/**
 * Load secondary content data (comments, related, continue watching)
 */
async function loadSecondaryContentData(contentId) {
    if (!contentId) return;
    
    try {
        await loadComments(contentId);
        
        if (typeof window.loadRelatedContent === 'function') {
            await window.loadRelatedContent(contentId);
        }
        
        if (window.currentUserId && typeof window.loadContinueWatching === 'function') {
            await window.loadContinueWatching(window.currentUserId);
        }
        
        if (window.currentUserId && window.PlaylistManager && !playlistManager) {
            await initializePlaylistManager();
        }
    } catch (err) {
        console.warn('⚠️ Secondary data load failed:', err);
    }
}

/**
 * Load secondary content data for playlist mode
 */
async function loadSecondaryContentDataForPlaylist() {
    if (!window.currentPlaylistItems || !window.currentPlaylistItems.length) return;
    const firstItemId = window.currentPlaylistItems[0]?.id;
    if (firstItemId) {
        await loadSecondaryContentData(firstItemId);
    }
}

/**
 * Add resume button - delegates to hero module
 */
function addResumeButton(progressSeconds) {
    if (typeof window.addResumeButton === 'function') {
        window.addResumeButton(progressSeconds);
    }
}

/**
 * Remove resume button - delegates to hero module
 */
function removeResumeButton() {
    if (typeof window.removeResumeButton === 'function') {
        window.removeResumeButton();
    }
}

/**
 * Update content UI - delegates to hero module
 */
function updateContentUI(content) {
    if (typeof window.updateContentUI === 'function') {
        window.updateContentUI(content);
    } else {
        // Fallback basic implementation
        if (!content) return;
        window.safeSetText('contentTitle', content.title);
        const creatorName = content.creator || (window.currentPlaylist?.creator_name || 'Creator');
        window.safeSetText('creatorName', creatorName);
        window.safeSetText('viewsCount', window.formatNumber(content.views_count) + ' views');
        window.safeSetText('likesCount', window.formatNumber(content.likes_count));
        window.safeSetText('commentsCount', `(${window.formatNumber(content.comments_count)})`);
        window.safeSetText('durationText', window.formatDuration(content.duration || 3600));
        window.safeSetText('uploadDate', window.formatDate(content.created_at));
        window.safeSetText('contentDescriptionShort', window.truncateText(content.description, 150));
        window.safeSetText('contentDescriptionFull', content.description);
    }
}

/**
 * Update content details (alias)
 */
function updateContentDetails(content) {
    updateContentUI(content);
}

/**
 * Load related content - delegates to related-content module
 */
async function loadRelatedContent(contentId) {
    if (typeof window.loadRelatedContent === 'function') {
        return await window.loadRelatedContent(contentId);
    }
    console.warn('⚠️ loadRelatedContent not available');
    return [];
}

/**
 * Load continue watching - delegates to continue-watching module
 */
async function loadContinueWatching(userId, limit = 8) {
    if (typeof window.loadContinueWatching === 'function') {
        return await window.loadContinueWatching(userId, limit);
    }
    console.warn('⚠️ loadContinueWatching not available');
    return [];
}

/**
 * Initialize recommendation engine for playlist
 */
async function initializeRecommendationEngineForPlaylist(contentId) {
    if (!window.RecommendationEngine || !contentId) return;
    try {
        recommendationEngine = new window.RecommendationEngine({
            supabase: window.supabaseClient,
            userId: window.currentUserId,
            currentContentId: contentId,
            limit: 8,
            minWatchThreshold: 0.5,
            cacheDuration: 60000
        });
        if (typeof window.loadRecommendationRails === 'function') {
            await window.loadRecommendationRails();
        }
        console.log('✅ RecommendationEngine initialized for playlist');
    } catch (error) {
        console.error('❌ Failed to initialize RecommendationEngine:', error);
    }
}

/**
 * Load recommendation rails - delegates to features
 */
async function loadRecommendationRails() {
    if (typeof window.loadRecommendationRails === 'function') {
        await window.loadRecommendationRails();
    }
}

/**
 * Update counts UI
 */
function updateCountsUI(content) {
    if (!content) return;
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const likesEl = document.getElementById('likesCount');
    const commentsEl = document.getElementById('commentsCount');
    
    if (viewsEl) viewsEl.textContent = window.formatNumber(content.views_count) + ' views';
    if (viewsFullEl) viewsFullEl.textContent = window.formatNumber(content.views_count);
    if (likesEl) likesEl.textContent = window.formatNumber(content.likes_count);
    if (commentsEl && content.comments_count !== undefined) {
        commentsEl.textContent = `(${window.formatNumber(content.comments_count)})`;
    }
}

/**
 * Update views UI
 */
function updateViewsUI(viewsCount) {
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    
    if (viewsEl) {
        viewsEl.textContent = window.formatNumber(viewsCount) + ' views';
    }
    if (viewsFullEl) {
        viewsFullEl.textContent = window.formatNumber(viewsCount);
    }
    
    if (window.currentContent) {
        window.currentContent.views_count = viewsCount;
    }
}

/**
 * Update share count UI
 */
function updateShareCountUI(delta) {
    const shareCountEl = document.getElementById('sharesCount');
    if (shareCountEl) {
        let current = parseInt(shareCountEl.textContent?.replace(/\D/g, '') || '0');
        let newCount = current + delta;
        shareCountEl.textContent = window.formatNumber(newCount);
    }
}

/**
 * Initialize enhanced video player - delegates to video-player module
 */
function initializeEnhancedVideoPlayer() {
    if (typeof window.initializeEnhancedVideoPlayer === 'function') {
        window.initializeEnhancedVideoPlayer();
    }
}

/**
 * Initialize streaming manager - delegates to video-player module
 */
function initializeStreamingManager() {
    if (typeof window.initializeStreamingManager === 'function') {
        window.initializeStreamingManager();
    } else if (typeof window.StreamingManager !== 'undefined') {
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
                },
                onDataSaverToggle: function(data) {
                    if (typeof updateQualityIndicator === 'function') updateQualityIndicator(streamingManager?.getCurrentQuality());
                },
                onError: function(err) { console.error('Streaming error:', err); }
            });
            streamingManager.initialize();
        } catch (error) { console.error('Failed to initialize StreamingManager:', error); }
    }
}

/**
 * Initialize playlist manager
 */
async function initializePlaylistManager() {
    if (typeof window.initializePlaylistManager === 'function') {
        await window.initializePlaylistManager();
    } else if (typeof window.PlaylistManager !== 'undefined' && window.currentUserId) {
        try {
            playlistManager = new window.PlaylistManager({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                watchLaterName: 'Watch Later',
                onPlaylistUpdated: function() { updateWatchLaterButtonState(); },
                onError: function(err) { window.showToast('Playlist error: ' + (err.error || err.message), 'error'); }
            });
            await updateWatchLaterButtonState();
        } catch (error) { console.error('Failed to initialize PlaylistManager:', error); }
    }
}

/**
 * Initialize playlist modal
 */
function initializePlaylistModal() {
    if (typeof window.initializePlaylistModal === 'function') {
        window.initializePlaylistModal();
    } else if (typeof window.PlaylistModal !== 'undefined' && window.currentUserId) {
        const contentIdForModal = window.currentContent?.id || 
            (window.currentPlaylistItems && window.currentPlaylistItems[0]?.id);
        if (!contentIdForModal) return;
        try {
            playlistModal = new window.PlaylistModal({
                supabase: window.supabaseClient,
                userId: window.currentUserId,
                contentId: contentIdForModal
            });
            window.playlistModal = playlistModal;
        } catch (error) { console.error('Failed to initialize playlist modal:', error); }
    }
}

/**
 * Sync playlist UI - delegates to playlist-sidebar module
 */
function syncPlaylistUI() {
    if (typeof window.syncPlaylistUI === 'function') {
        window.syncPlaylistUI();
    }
}

/**
 * Render album tracks - delegates to playlist-sidebar module
 */
function renderAlbumTracks(tracks) {
    if (typeof window.renderAlbumTracks === 'function') {
        window.renderAlbumTracks(tracks);
    }
}

/**
 * Setup album toggle - delegates to playlist-sidebar module
 */
function setupAlbumToggle() {
    if (typeof window.setupAlbumToggle === 'function') {
        window.setupAlbumToggle();
    }
}

// ============================================
// LOAD CRITICAL CONTENT DATA
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
        console.warn('Profile fetch failed, falling back to legacy method');
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
    
    const { data: seriesData } = await window.supabaseClient
        .from('Content')
        .select('series_id, episode_number')
        .eq('id', contentId)
        .maybeSingle();
    
    const contentObj = {
        id: profileData.id,
        title: profileData.title || 'Untitled',
        description: profileData.description || '',
        thumbnail_url: profileData.thumbnail_url,
        file_url: profileData.file_url,
        media_type: profileData.media_type || 'video',
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
        series_id: seriesData?.series_id || null,
        episode_number: seriesData?.episode_number || null,
        _cachedAt: Date.now()
    };
    
    await setCurrentContent(contentObj);
    localStorage.setItem(`content_${contentId}`, JSON.stringify(contentObj));
    
    if (contentObj.watch_progress > 10 && !contentObj.is_completed) {
        addResumeButton(contentObj.watch_progress);
    }
}

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
        
        const clientPayload = {
            ...mediaAsset,
            views_count: mediaAsset.content_engagement_stats?.total_views || 0,
            likes_count: mediaAsset.content_engagement_stats?.total_likes || 0,
            valid_views_count: mediaAsset.content_engagement_stats?.total_valid_views || 0,
            comments_count: mediaAsset.content_engagement_stats?.total_comments || 0,
            creator: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || (window.isPlaylistMode && window.currentPlaylist ? window.currentPlaylist.creator_name : 'Creator'),
            creator_display_name: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || (window.isPlaylistMode && window.currentPlaylist ? window.currentPlaylist.creator_name : 'Creator'),
            creator_id: mediaAsset.user_id
        };
        
        return clientPayload;
    } catch (error) {
        console.error("Critical Profile Fetch Interruption:", error.message);
        return null;
    }
}

async function loadContentFromURLLegacy() {
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
        
        const { data: streamingData } = await window.supabaseClient
            .from('Content')
            .select('quality_profiles, hls_manifest_url, data_saver_url')
            .eq('id', contentId)
            .maybeSingle();
        
        const { data: seriesData } = await window.supabaseClient
            .from('Content')
            .select('series_id, episode_number')
            .eq('id', contentId)
            .maybeSingle();
        
        const contentObj = {
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
            is_completed: watchProgress?.is_completed || false,
            quality_profiles: streamingData?.quality_profiles || [],
            hls_manifest_url: streamingData?.hls_manifest_url || null,
            data_saver_url: streamingData?.data_saver_url || null,
            series_id: seriesData?.series_id || null,
            episode_number: seriesData?.episode_number || null
        };
        
        await setCurrentContent(contentObj);
        
        if (contentObj.watch_progress > 10 && !contentObj.is_completed) {
            addResumeButton(contentObj.watch_progress);
        }
    } catch (error) {
        console.error('❌ Content load failed:', error);
        window.showToast('Content not available. Please try again.', 'error');
        document.getElementById('contentTitle').textContent = 'Content Unavailable';
    }
}

// ============================================
// BOOTSTRAPPING & AUTH
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
            resolve();
        }, 2000);
    });
}

function setupAuthListeners() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await window.AuthHelper.initialize();
            window.currentUserId = window.AuthHelper.getUserProfile()?.id || null;
            if (typeof updateSidebarProfile === 'function') await updateSidebarProfile();
            if (typeof updateHeaderProfile === 'function') await updateHeaderProfile();
            if (typeof updateProfileSwitcher === 'function') updateProfileSwitcher();
            if (typeof updateCommentInputState === 'function') setTimeout(updateCommentInputState, 300);
            window.showToast('Welcome back!', 'success');
            
            if (window.currentUserId && typeof loadContinueWatching === 'function') {
                await loadContinueWatching(window.currentUserId);
            }
            if (window.currentContent?.id) {
                const states = await loadAllEngagementStates(window.currentContent.id, window.currentUserId);
                updateEngagementUI(states);
            }
            if (typeof initializePlaylistManager === 'function') await initializePlaylistManager();
            if (recommendationEngine) {
                recommendationEngine.userId = window.currentUserId;
                if (typeof loadRecommendationRails === 'function') await loadRecommendationRails();
            }
            if (streamingManager) streamingManager.userId = window.currentUserId;
            if (typeof initializePlaylistModal === 'function') setTimeout(initializePlaylistModal, 500);
        } else if (event === 'SIGNED_OUT') {
            window.currentUserId = null;
            playlistManager = null;
            playlistModal = null;
            window.showToast('Signed out successfully', 'info');
            
            if (watchSession) { watchSession.stop(); watchSession = null; }
            if (recommendationEngine) {
                recommendationEngine.userId = null;
                if (typeof loadRecommendationRails === 'function') await loadRecommendationRails();
            }
            if (streamingManager) streamingManager.userId = null;
            if (typeof updateSidebarProfile === 'function') await updateSidebarProfile();
            if (typeof updateHeaderProfile === 'function') await updateHeaderProfile();
            if (typeof updateCommentInputState === 'function') setTimeout(updateCommentInputState, 300);
        }
    });
}

// ============================================
// EVENT BINDING
// ============================================

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        const newPlayBtn = playBtn.cloneNode(true);
        playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
        newPlayBtn.addEventListener('click', () => {
            if (typeof startPlaybackFromUserGesture === 'function') startPlaybackFromUserGesture();
        });
    }
    
    const playAlbumBtn = document.getElementById('playAlbumBtn');
    if (playAlbumBtn) {
        const newPlayAlbumBtn = playAlbumBtn.cloneNode(true);
        playAlbumBtn.parentNode.replaceChild(newPlayAlbumBtn, playAlbumBtn);
        newPlayAlbumBtn.addEventListener('click', () => {
            if (typeof startPlaybackFromUserGesture === 'function') startPlaybackFromUserGesture();
        });
    }
    
    const poster = document.getElementById('heroPoster');
    if (poster) {
        const newPoster = poster.cloneNode(true);
        poster.parentNode.replaceChild(newPoster, poster);
        newPoster.addEventListener('click', () => {
            if (typeof startPlaybackFromUserGesture === 'function') startPlaybackFromUserGesture();
        });
    }
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.addEventListener('click', () => {
            if (typeof closeVideoPlayer === 'function') closeVideoPlayer();
        });
    }
    
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        const newLikeBtn = likeBtn.cloneNode(true);
        likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
        newLikeBtn.addEventListener('click', handleLikeButtonClick);
    }
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        const newFavoriteBtn = favoriteBtn.cloneNode(true);
        favoriteBtn.parentNode.replaceChild(newFavoriteBtn, favoriteBtn);
        newFavoriteBtn.addEventListener('click', handleFavoriteButtonClick);
    }
    
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
        const newWatchLaterBtn = watchLaterBtn.cloneNode(true);
        watchLaterBtn.parentNode.replaceChild(newWatchLaterBtn, watchLaterBtn);
        newWatchLaterBtn.addEventListener('click', handleWatchLaterButtonClick);
    }
    
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        const newShareBtn = shareBtn.cloneNode(true);
        shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
        newShareBtn.addEventListener('click', async () => {
            if (window.currentContent?.id) await shareContent(window.currentContent.id, window.currentUserId);
        });
    }
    
    setupPlayerEndedListener();
    setupRealtimeSubscriptions();
    setupConnectButtons();
    setupInitialPlayButton();
    setupViewSyncListener();
    if (typeof setupAlbumToggle === 'function') requestAnimationFrame(() => setupAlbumToggle());
    
    console.log('✅ Event listeners setup complete');
}

function setupPlayerEndedListener() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) { setTimeout(setupPlayerEndedListener, 500); return; }
    
    const handleEnded = () => {
        console.log('Media track completed. Checking for playlist progression...');
        if (typeof window.playNextPlaylistItem === 'function') window.playNextPlaylistItem();
    };
    
    videoElement.removeEventListener('ended', handleEnded);
    videoElement.addEventListener('ended', handleEnded);
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
            if (error) return false;
            this.isActive = true;
            return true;
        } catch (error) { return false; }
    }
    
    startHeartbeatLoop(videoElement) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (!this.isActive || !videoElement || videoElement.paused) return;
            const currentTime = Math.floor(videoElement.currentTime);
            const now = Date.now();
            const deltaWatchTimeMs = now - this.lastHeartbeatTime;
            this.sequenceNumber++;
            this.totalWatchTimeMs += deltaWatchTimeMs;
            if (currentTime > this.maxProgressSeconds) this.maxProgressSeconds = currentTime;
            this.lastHeartbeatTime = now;
            
            await window.supabaseClient.from('playback_heartbeats').insert({
                playback_session_id: this.playbackSessionId,
                content_id: parseInt(this.contentId),
                user_id: this.userId,
                sequence_number: this.sequenceNumber,
                progress_seconds: currentTime,
                cumulative_watch_time_ms: this.totalWatchTimeMs,
                playback_state: 'PLAYING'
            });
            
            await window.supabaseClient.from('playback_sessions').update({
                total_watch_time_ms: this.totalWatchTimeMs,
                max_progress_seconds: this.maxProgressSeconds,
                heartbeat_count: this.sequenceNumber,
                last_heartbeat_at: new Date().toISOString()
            }).eq('playback_session_id', this.playbackSessionId);
            
            const duration = videoElement.duration || 0;
            const thresholdSeconds = Math.min(15, duration * 0.3);
            if (!this.viewRecorded && this.totalWatchTimeMs >= thresholdSeconds * 1000) {
                this.viewRecorded = true;
                this.viewThresholdReached = true;
                await recordContentViewRPC(this.contentId, this.userId, this.playbackSessionId);
            }
        }, 10000);
    }
    
    start(videoElement) { if (videoElement) this.startHeartbeatLoop(videoElement); }
    
    stop() {
        this.isActive = false;
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
        window.supabaseClient.from('playback_sessions').update({ completed: true, exited_at: new Date().toISOString() }).eq('playback_session_id', this.playbackSessionId);
    }
}

function initializeWatchSessionOnPlay() {
    if (!window.currentContent || !window.currentUserId) return;
    const player = window.enhancedVideoPlayer || enhancedVideoPlayer;
    if (!player?.video) return;
    if (watchSession) { watchSession.stop(); watchSession = null; }
    
    try {
        currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        watchSession = new WatchSessionManager(window.currentContentId, window.currentUserId);
        watchSession.initializeSession('Web', 'Desktop');
        watchSession.start(player.video);
        window._watchSession = watchSession;
    } catch (error) { console.error('Failed to initialize watch session:', error); }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

window.recordContentViewRPC = recordContentViewRPC;
window.loadLiveEngagementCounts = loadLiveEngagementCounts;
window.loadAllEngagementStates = loadAllEngagementStates;
window.updateEngagementUI = updateEngagementUI;
window.toggleLike = toggleLike;
window.toggleFavorite = toggleFavorite;
window.toggleWatchLater = toggleWatchLater;
window.shareContent = shareContent;
window.updateGlobalContentId = updateGlobalContentId;
window.setCurrentContent = setCurrentContent;
window.playNextPlaylistItem = window.playNextPlaylistItem;
window.playPlaylistItemByIndex = playPlaylistItemByIndex;
window.resetPlaylistCompletionLock = resetPlaylistCompletionLock;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.setupEventListeners = setupEventListeners;
window.initializeStreamingManager = initializeStreamingManager;
window.initializePlaylistManager = initializePlaylistManager;
window.initializeRecommendationEngineForPlaylist = initializeRecommendationEngineForPlaylist;
window.initializePlaylistModal = initializePlaylistModal;
window.initAnalyticsModal = initAnalyticsModal;
window.initSearchModal = initSearchModal;
window.initNotificationsPanel = initNotificationsPanel;
window.WatchSessionManager = WatchSessionManager;
window.initializeWatchSessionOnPlay = initializeWatchSessionOnPlay;

// These functions are exported for module delegation
window.loadComments = loadComments;
window.refreshContentInBackground = refreshContentInBackground;
window.setupConnectButtons = setupConnectButtons;
window.setupInitialPlayButton = setupInitialPlayButton;
window.setupViewSyncListener = setupViewSyncListener;
window.updateWatchLaterButtonState = updateWatchLaterButtonState;
window.loadSecondaryContentData = loadSecondaryContentData;
window.loadSecondaryContentDataForPlaylist = loadSecondaryContentDataForPlaylist;
window.addResumeButton = addResumeButton;
window.removeResumeButton = removeResumeButton;
window.updateContentUI = updateContentUI;
window.updateContentDetails = updateContentDetails;
window.loadRelatedContent = loadRelatedContent;
window.loadContinueWatching = loadContinueWatching;
window.loadRecommendationRails = loadRecommendationRails;
window.updateCountsUI = updateCountsUI;
window.updateViewsUI = updateViewsUI;
window.updateShareCountUI = updateShareCountUI;
window.initializeEnhancedVideoPlayer = initializeEnhancedVideoPlayer;
window.syncPlaylistUI = syncPlaylistUI;
window.renderAlbumTracks = renderAlbumTracks;
window.setupAlbumToggle = setupAlbumToggle;

// ============================================
// MODAL & PANEL STUBS (delegated to features)
// ============================================

function initAnalyticsModal() {
    if (typeof window.initAnalyticsModal === 'function') {
        window.initAnalyticsModal();
    }
}

function initSearchModal() {
    if (typeof window.initSearchModal === 'function') {
        window.initSearchModal();
    }
}

function initNotificationsPanel() {
    if (typeof window.initNotificationsPanel === 'function') {
        window.initNotificationsPanel();
    }
}

// ============================================
// DOMContentLoaded BOOTSTRAPPER
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Orchestrator: Starting content detail with modular architecture...');
    
    // Inject YouTube-style CSS for persistent sidebar
    if (!document.getElementById('youtube-sidebar-styles')) {
        const style = document.createElement('style');
        style.id = 'youtube-sidebar-styles';
        style.textContent = `
            .album-sidebar { width: 100%; max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.35s ease, opacity 0.25s ease; display: flex; flex-direction: column; }
            .album-sidebar.expanded { max-height: 1200px; opacity: 1; }
            .album-track-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; }
            .album-track-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--card-bg, rgba(255,255,255,0.05)); border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; width: 100%; text-align: left; }
            .album-track-item:hover { background: var(--hover-bg, rgba(255,255,255,0.1)); }
            .album-track-item.active, .album-track-item.playing { background: rgba(245, 158, 11, 0.2); border-left: 3px solid #F59E0B; }
            .track-num { color: var(--text-secondary, #aaa); font-size: 14px; min-width: 32px; }
            .track-title { flex: 1; color: var(--text-primary, white); font-size: 14px; }
            .track-duration { color: var(--text-secondary, #aaa); font-size: 12px; }
            .playlist-playing #playAlbumBtn { display: none !important; }
        `;
        document.head.appendChild(style);
    }
    
    // Create persistent sidebar if missing
    let albumSidebar = document.getElementById('album-sidebar');
    if (!albumSidebar) {
        const targetContainer = document.querySelector('.content-detail-container') || document.querySelector('.main-content');
        if (targetContainer) {
            albumSidebar = document.createElement('div');
            albumSidebar.id = 'album-sidebar';
            albumSidebar.className = 'album-sidebar collapsed';
            albumSidebar.innerHTML = '<div id="album-track-list" class="album-track-list"></div>';
            const playerContainer = document.getElementById('inlinePlayer');
            if (playerContainer?.parentNode) playerContainer.parentNode.insertBefore(albumSidebar, playerContainer.nextSibling);
            else targetContainer.appendChild(albumSidebar);
        }
    }
    
    // Show skeleton
    const skeleton = document.getElementById('content-skeleton');
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (app) app.style.display = 'block';
    if (skeleton) skeleton.style.display = 'block';
    
    // Initialize Supabase client if needed
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
    if (window.AuthHelper && !window.AuthHelper.isInitialized) await window.AuthHelper.initialize();
    window.currentUserId = window.AuthHelper?.getUserProfile?.()?.id || null;
    
    // Initialize lightweight UI systems
    if (typeof initThemeSelector === 'function') initThemeSelector();
    if (typeof setupCompleteSidebar === 'function') setupCompleteSidebar();
    if (typeof setupNavigationButtons === 'function') setupNavigationButtons();
    if (typeof setupNavButtonScrollAnimation === 'function') setupNavButtonScrollAnimation();
    if (typeof setupAuthListeners === 'function') setupAuthListeners();
    if (typeof updateSidebarProfile === 'function') await updateSidebarProfile();
    if (typeof updateHeaderProfile === 'function') await updateHeaderProfile();
    if (typeof updateProfileSwitcher === 'function') updateProfileSwitcher();
    
    // Load critical content
    try {
        if (playlistId) {
            window.isPlaylistMode = true;
            await loadPlaylistMode(playlistId, playlistType);
            if (typeof syncPlaylistUI === 'function') syncPlaylistUI();
        } else if (contentId) {
            if (typeof loadCriticalContentData === 'function') await loadCriticalContentData(contentId);
            window.isPlaylistMode = false;
        } else throw new Error('No content ID or playlist ID provided');
        
        if (skeleton) skeleton.style.display = 'none';
        if (typeof updateCommentInputState === 'function') setTimeout(updateCommentInputState, 300);
        
        if (typeof initAnalyticsModal === 'function') initAnalyticsModal();
        if (typeof initSearchModal === 'function') initSearchModal();
        if (typeof initNotificationsPanel === 'function') initNotificationsPanel();
        
        if (typeof initializePlaylistManager === 'function') await initializePlaylistManager();
        if (!window.isPlaylistMode && window.currentContent?.id) {
            if (typeof initializeRecommendationEngine === 'function') {
                await initializeRecommendationEngine();
            }
        } else if (window.isPlaylistMode && window.currentPlaylistItems?.length > 0) {
            await initializeRecommendationEngineForPlaylist(window.currentPlaylistItems[0]?.id);
        }
        
        if (window.currentUserId && (window.currentContent?.id || window.currentPlaylistItems?.length > 0)) {
            setTimeout(() => initializePlaylistModal(), 500);
        }
        
        if (typeof applyMobileHeaderStyles === 'function') applyMobileHeaderStyles();
        
        // Single mode fix: ensure player is ready
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
        console.error('Critical load failed:', err);
        window.showToast('Failed to load content. Retrying...', 'error');
        if (skeleton) skeleton.style.display = 'none';
        if (typeof loadContentFromURLLegacy === 'function') await loadContentFromURLLegacy();
    }
    
    // Lazy load secondary features
    requestIdleCallback(() => {
        if (typeof setupEventListeners === 'function') setupEventListeners();
        if (typeof initializeVideoPlayerSkeleton === 'function') initializeVideoPlayerSkeleton();
        if (window.isPlaylistMode && window.currentPlaylistItems?.length > 0 && typeof loadSecondaryContentDataForPlaylist === 'function') {
            loadSecondaryContentDataForPlaylist();
        } else if (window.currentContent?.id && typeof loadSecondaryContentData === 'function') {
            loadSecondaryContentData(window.currentContent.id);
        }
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
    
    console.log('✅ Orchestrator initialization complete');
});

console.log('✅ content-detail.js (Orchestrator) loaded');
