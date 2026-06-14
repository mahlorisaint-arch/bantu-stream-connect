// js/content-detail/stats-grid.js
// ============================================
// STATS GRID MODULE
// Contains UI rendering for engagement stats (views, likes, shares)
// AND its specific data-fetching logic for count synchronization
// ============================================
console.log('🎬 Stats Grid Module Loading...');

/**
 * Update the entire stats grid with content data
 */
function updateStatsGrid(content) {
    if (!content) return;
    
    updateViewsUI(content.views_count);
    updateLikesUI(content.likes_count);
    if (typeof updateShareCountUI === 'function') {
        updateShareCountUI(0); // Just to initialize, actual shares count from elsewhere
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
 * Update share count UI with delta (increment by 1 for new shares)
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
 * Force update engagement UI with counts (bypasses state checks)
 * Used by loadLiveEngagementCounts for bulletproof sync
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
 * Used for immediate UI feedback before DB confirmation
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
            console.log(`📊 Updated view count for ${selector}: ${newViews}`);
        });
    });
    
    if (window.currentContent) {
        window.currentContent.views_count = (window.currentContent.views_count || 0) + 1;
    }
}

/**
 * Refresh counts from source (database) - calls loadLiveEngagementCounts
 */
async function refreshCountsFromSource() {
    const contentIdForRefresh = window.currentContent?.id || 
        (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
    
    if (!contentIdForRefresh) return;
    
    try {
        const liveCounts = await window.loadLiveEngagementCounts(contentIdForRefresh);
        
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
 * Setup view sync listener for cross-component view count updates
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
                console.log('👁️ Frontend views synced via fetch:', liveCounts.views);
            }
        }
        
        updateCountsUI(window.currentContent);
    });
}

/**
 * Record view increment via RPC (called from content-detail orchestration)
 * This is a convenience wrapper
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
window._forceUpdateEngagementUI = _forceUpdateEngagementUI;
window.incrementFrontendViewCount = incrementFrontendViewCount;
window.refreshCountsFromSource = refreshCountsFromSource;
window.setupViewSyncListener = setupViewSyncListener;
window.incrementContentViews = incrementContentViews;

console.log('✅ Stats Grid Module loaded');
