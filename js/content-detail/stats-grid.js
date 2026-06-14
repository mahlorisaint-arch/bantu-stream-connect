// js/content-detail/stats-grid.js
// Extracted from content-detail.js - Stats Grid Management

console.log('📊 Stats Grid module loading...');

// ============================================
// UPDATE STATS GRID UI
// ============================================
function updateStatsGrid(content) {
    if (!content) return;
    
    // Update views
    safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
    safeSetText('viewsCountFull', formatNumber(content.views_count));
    
    // Update likes
    safeSetText('likesCount', formatNumber(content.likes_count));
    
    // Update favorites
    safeSetText('favoritesCount', formatNumber(content.favorites_count));
    
    // Update comments count (for the badge)
    const commentsCountSpan = document.getElementById('commentsCount');
    if (commentsCountSpan) {
        commentsCountSpan.textContent = `(${formatNumber(content.comments_count)})`;
    }
    
    // Update duration
    const duration = formatDuration(content.duration || 3600);
    safeSetText('durationText', duration);
    safeSetText('contentDurationFull', duration);
    
    // Update genre
    safeSetText('contentGenre', content.genre || 'General');
    
    // Update upload date
    safeSetText('uploadDate', formatDate(content.created_at));
    
    console.log('✅ Stats grid updated:', {
        views: content.views_count,
        likes: content.likes_count,
        favorites: content.favorites_count,
        duration: duration,
        genre: content.genre
    });
}

// ============================================
// UPDATE VIEWS UI (separate function for real-time updates)
// ============================================
function updateViewsUI(viewsCount) {
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    
    if (viewsEl) {
        viewsEl.textContent = formatNumber(viewsCount) + ' views';
    }
    if (viewsFullEl) {
        viewsFullEl.textContent = formatNumber(viewsCount);
    }
    
    if (window.currentContent) {
        window.currentContent.views_count = viewsCount;
    }
    
    console.log(`👁️ Views UI updated: ${formatNumber(viewsCount)}`);
}

// ============================================
// UPDATE LIKES UI (separate function for real-time updates)
// ============================================
function updateLikesUI(likesCount) {
    const likesEl = document.getElementById('likesCount');
    if (likesEl) {
        likesEl.textContent = formatNumber(likesCount);
    }
    
    if (window.currentContent) {
        window.currentContent.likes_count = likesCount;
    }
    
    console.log(`❤️ Likes UI updated: ${formatNumber(likesCount)}`);
}

// ============================================
// UPDATE SHARE COUNT UI
// ============================================
function updateShareCountUI(delta) {
    const shareCountEl = document.getElementById('sharesCount');
    if (shareCountEl) {
        let current = parseInt(shareCountEl.textContent?.replace(/\D/g, '') || '0');
        let newCount = current + delta;
        shareCountEl.textContent = formatNumber(newCount);
        
        if (window.currentContent) {
            window.currentContent.shares_count = newCount;
        }
    }
}

// ============================================
// UPDATE ALL COUNTS UI (batch update)
// ============================================
function updateCountsUI(content) {
    if (!content) return;
    
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const likesEl = document.getElementById('likesCount');
    
    if (viewsEl) viewsEl.textContent = formatNumber(content.views_count) + ' views';
    if (viewsFullEl) viewsFullEl.textContent = formatNumber(content.views_count);
    if (likesEl) likesEl.textContent = formatNumber(content.likes_count);
}

// ============================================
// FORCE UPDATE ENGAGEMENT UI (for race condition fixes)
// ============================================
function _forceUpdateEngagementUI(counts) {
    // Update views
    if (counts.views !== undefined) {
        updateViewsUI(counts.views);
    }
    
    // Update likes - DIRECT DOM manipulation
    const likesEl = document.getElementById('likesCount');
    if (likesEl && counts.likes !== undefined) {
        const formatted = formatNumber(counts.likes);
        if (likesEl.textContent !== formatted) {
            likesEl.textContent = formatted;
            console.log('🔧 Likes UI forced to:', formatted);
        }
    }
    
    // Update currentContent cache
    if (window.currentContent) {
        if (counts.views !== undefined) window.currentContent.views_count = counts.views;
        if (counts.likes !== undefined) window.currentContent.likes_count = counts.likes;
    }
}

// ============================================
// INCREMENT FRONTEND VIEW COUNT (optimistic update)
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
// SAFE SET TEXT UTILITY
// ============================================
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text || '';
}

// ============================================
// FORMAT NUMBER
// ============================================
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ============================================
// FORMAT DURATION
// ============================================
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// FORMAT DATE
// ============================================
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

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.updateStatsGrid = updateStatsGrid;
window.updateViewsUI = updateViewsUI;
window.updateLikesUI = updateLikesUI;
window.updateShareCountUI = updateShareCountUI;
window.updateCountsUI = updateCountsUI;
window._forceUpdateEngagementUI = _forceUpdateEngagementUI;
window.incrementFrontendViewCount = incrementFrontendViewCount;

console.log('✅ Stats Grid module loaded');
