// js/content-detail/stats-grid.js
// ============================================
// STATS GRID MODULE - FIXED ENGAGEMENT BUTTONS
// Contains UI rendering for engagement stats (views, likes, shares)
// AND its specific data-fetching logic for count synchronization
// ============================================
console.log('🎬 Stats Grid Module Loading...');

// Cache for engagement states
let engagementStateCache = {
    liked: false,
    favorited: false,
    watchLater: false
};

/**
 * Update the entire stats grid with content data
 */
function updateStatsGrid(content) {
    if (!content) return;
    
    updateViewsUI(content.views_count);
    updateLikesUI(content.likes_count);
    if (typeof updateShareCountUI === 'function') {
        updateShareCountUI(0);
    }
    updateCountsUI(content);
}

/**
 * Update views UI elements
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
 * Update likes UI element
 */
function updateLikesUI(likesCount) {
    const likesEl = document.getElementById('likesCount');
    if (likesEl) {
        likesEl.textContent = window.formatNumber(likesCount);
    }
    
    if (window.currentContent) {
        window.currentContent.likes_count = likesCount;
    }
}

/**
 * Update share count UI with delta
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
 * Update all counts UI from content object
 */
function updateCountsUI(content) {
    if (!content) return;
    
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const likesEl = document.getElementById('likesCount');
    const favoritesEl = document.getElementById('favoritesCount');
    const commentsEl = document.getElementById('commentsCount');
    
    if (viewsEl) viewsEl.textContent = window.formatNumber(content.views_count) + ' views';
    if (viewsFullEl) viewsFullEl.textContent = window.formatNumber(content.views_count);
    if (likesEl) likesEl.textContent = window.formatNumber(content.likes_count);
    if (favoritesEl && content.favorites_count !== undefined) {
        favoritesEl.textContent = window.formatNumber(content.favorites_count);
    }
    if (commentsEl && content.comments_count !== undefined) {
        commentsEl.textContent = `(${window.formatNumber(content.comments_count)})`;
    }
}

/**
 * Update engagement button UI based on states
 */
function updateEngagementButtonsUI(states) {
    console.log('🎨 Updating engagement buttons UI:', states);
    
    // Like button
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        if (states.liked) {
            likeBtn.classList.add('active');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
            likeBtn.setAttribute('data-liked', 'true');
        } else {
            likeBtn.classList.remove('active');
            likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
            likeBtn.setAttribute('data-liked', 'false');
        }
    }
    
    // Favorite button
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        if (states.favorited) {
            favoriteBtn.classList.add('active');
            favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
            favoriteBtn.setAttribute('data-favorited', 'true');
        } else {
            favoriteBtn.classList.remove('active');
            favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
            favoriteBtn.setAttribute('data-favorited', 'false');
        }
    }
    
    // Watch Later button
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
        if (states.watchLater) {
            watchLaterBtn.classList.add('active');
            watchLaterBtn.innerHTML = '<i class="fas fa-clock"></i><span>Watch Later</span>';
            watchLaterBtn.setAttribute('data-watchlater', 'true');
        } else {
            watchLaterBtn.classList.remove('active');
            watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
            watchLaterBtn.setAttribute('data-watchlater', 'false');
        }
    }
    
    // Update cache
    engagementStateCache = { ...states };
}

/**
 * Force update engagement UI with counts
 */
function _forceUpdateEngagementUI(counts) {
    updateViewsUI(counts.views);
    
    const likesEl = document.getElementById('likesCount');
    if (likesEl && counts.likes !== undefined) {
        const formatted = window.formatNumber(counts.likes);
        if (likesEl.textContent !== formatted) {
            likesEl.textContent = formatted;
            console.log('🔧 Likes UI forced to:', formatted);
        }
    }
    
    if (window.currentContent) {
        window.currentContent.views_count = counts.views;
        window.currentContent.likes_count = counts.likes;
    }
}

/**
 * Increment frontend view count optimistically
 */
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
            if (el.textContent.includes('views')) {
                el.textContent = `${window.formatNumber(newViews)} views`;
            } else {
                el.textContent = window.formatNumber(newViews);
            }
        });
    });
    
    if (window.currentContent) {
        window.currentContent.views_count = (window.currentContent.views_count || 0) + 1;
    }
}

/**
 * Refresh counts from source
 */
async function refreshCountsFromSource() {
    const contentId = window.currentContent?.id;
    if (!contentId) return;
    
    try {
        const liveCounts = await window.loadLiveEngagementCounts(contentId);
        
        if (window.currentContent && liveCounts.views !== undefined) {
            window.currentContent.views_count = liveCounts.views;
            updateCountsUI(window.currentContent);
        }
        
        if (window.currentContent && liveCounts.likes !== undefined) {
            window.currentContent.likes_count = liveCounts.likes;
            const likesEl = document.getElementById('likesCount');
            if (likesEl) likesEl.textContent = window.formatNumber(liveCounts.likes);
        }
        
        console.log('✅ Counts refreshed from source:', liveCounts);
    } catch (error) {
        console.warn('Failed to refresh counts:', error);
    }
}

/**
 * Setup view sync listener
 */
function setupViewSyncListener() {
    window.addEventListener('content-views-updated', async (event) => {
        const { contentId, viewsCount } = event.detail;
        
        if (String(contentId) !== String(window.currentContent?.id)) return;
        
        if (window.currentContent && viewsCount !== undefined) {
            window.currentContent.views_count = viewsCount;
            updateViewsUI(viewsCount);
            console.log('👁️ Frontend views synced via global event:', viewsCount);
        } else {
            const liveCounts = await window.loadLiveEngagementCounts(contentId);
            if (window.currentContent) {
                window.currentContent.views_count = liveCounts.views;
                updateViewsUI(liveCounts.views);
            }
        }
        
        updateCountsUI(window.currentContent);
    });
}

/**
 * Record view increment via RPC
 */
async function incrementContentViews(contentId) {
    if (!contentId) return false;
    
    try {
        const { error: rpcError } = await window.supabaseClient.rpc('increment_content_views', {
            content_id_input: parseInt(contentId)
        });
        
        if (rpcError) {
            console.warn('RPC increment failed, trying direct update:', rpcError);
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
        incrementFrontendViewCount();
        return true;
    } catch (error) {
        console.error('❌ Failed to increment content views:', error);
        return false;
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.updateStatsGrid = updateStatsGrid;
window.updateViewsUI = updateViewsUI;
window.updateLikesUI = updateLikesUI;
window.updateShareCountUI = updateShareCountUI;
window.updateCountsUI = updateCountsUI;
window.updateEngagementButtonsUI = updateEngagementButtonsUI;
window._forceUpdateEngagementUI = _forceUpdateEngagementUI;
window.incrementFrontendViewCount = incrementFrontendViewCount;
window.refreshCountsFromSource = refreshCountsFromSource;
window.setupViewSyncListener = setupViewSyncListener;
window.incrementContentViews = incrementContentViews;

console.log('✅ Stats Grid Module loaded');
