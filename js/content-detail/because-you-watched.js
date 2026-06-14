// js/content-detail/because-you-watched.js
// ============================================
// BECAUSE YOU WATCHED MODULE - COMPLETE BRAIN
// Contains UI rendering for "Because You Watched" recommendation rail
// AND its specific database logic (fetch from RecommendationEngine)
// ============================================
console.log('🎬 Because You Watched Module Loading...');

/**
 * Load "Because You Watched" recommendations from RecommendationEngine
 * Uses content-based filtering on user's watch history
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum number of items to load (default: 8)
 * @param {string} options.excludeContentId - Content ID to exclude from results
 */
async function loadBecauseYouWatchedRecommendations(options = {}) {
    const { limit = 8, excludeContentId = null } = options;
    const containerId = 'becauseYouWatchedRail';
    const section = document.getElementById(containerId);
    
    if (!section) {
        console.warn('Because You Watched rail container not found');
        return;
    }
    
    // Show skeleton loader immediately
    showBecauseYouWatchedSkeleton();
    
    try {
        let recommendations = [];
        
        // Use RecommendationEngine if available
        if (window.recommendationEngine && typeof window.recommendationEngine.getRecommendations === 'function') {
            // Get recommendations from the engine (content-based filtering)
            const allRecs = await window.recommendationEngine.getRecommendations({
                type: 'because_you_watched',
                limit: limit + 1 // Add 1 in case we need to exclude current content
            });
            
            recommendations = allRecs.filter(rec => rec.id !== excludeContentId);
            recommendations = recommendations.slice(0, limit);
            
        } else if (window.supabaseClient) {
            // Fallback: Fetch popular content in same genre as current content
            const currentContentGenre = window.currentContent?.genre || 'General';
            const excludeId = excludeContentId || window.currentContent?.id;
            
            const { data, error } = await window.supabaseClient
                .from('Content')
                .select(`
                    id,
                    title,
                    thumbnail_url,
                    duration,
                    user_id,
                    genre,
                    user_profiles!user_id (
                        full_name,
                        username,
                        avatar_url
                    ),
                    content_engagement_stats (
                        total_views,
                        total_likes
                    )
                `)
                .eq('status', 'published')
                .eq('genre', currentContentGenre)
                .neq('id', excludeId || 0)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (!error && data) {
                recommendations = data.map(item => ({
                    ...item,
                    total_views: item.content_engagement_stats?.total_views || 0,
                    total_likes: item.content_engagement_stats?.total_likes || 0,
                    views_count: item.content_engagement_stats?.total_views || 0
                }));
            }
        }
        
        if (!recommendations || recommendations.length === 0) {
            showBecauseYouWatchedEmpty();
            return;
        }
        
        renderBecauseYouWatchedRail(recommendations);
        console.log(`✅ Loaded ${recommendations.length} "Because You Watched" recommendations`);
        
    } catch (error) {
        console.error('❌ Failed to load Because You Watched recommendations:', error);
        showBecauseYouWatchedEmpty();
    }
}

/**
 * Render the "Because You Watched" rail with content cards
 * @param {Array} items - Array of content items to display
 */
function renderBecauseYouWatchedRail(items) {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    // Ensure section has proper structure
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Because You Watched</h2>
                <button class="refresh-rail-btn" aria-label="Refresh recommendations">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            <div class="content-grid" id="becauseYouWatchedGrid"></div>
        `;
        
        // Attach refresh button handler
        const refreshBtn = section.querySelector('.refresh-rail-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                loadBecauseYouWatchedRecommendations();
                window.showToast('Refreshing recommendations...', 'info');
            });
        }
    }
    
    const grid = document.getElementById('becauseYouWatchedGrid');
    if (!grid) return;
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="empty-rail">No recommendations available</div>';
        return;
    }
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.total_views || item.views_count || item.real_views_count || 0;
        const creatorName = item.user_profiles?.full_name || item.user_profiles?.username || 'Creator';
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card because-you-watched-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${window.escapeHtml(item.title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${item.duration ? `<span class="duration-badge">${window.formatDuration(item.duration)}</span>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${window.truncateText(item.title, 45)}</h3>
                    <div class="related-meta">
                        <i class="fas fa-eye"></i>
                        <span>${window.formatNumber(viewsCount)} views</span>
                    </div>
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${window.truncateText(creatorName, 20)}
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    section.style.display = 'block';
    console.log('✅ Because You Watched rail rendered');
}

/**
 * Show skeleton loader for "Because You Watched" rail
 */
function showBecauseYouWatchedSkeleton() {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Because You Watched</h2>
            </div>
            <div class="content-grid" id="becauseYouWatchedGrid">
                ${Array(6).fill().map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-thumbnail"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-creator"></div>
                        <div class="skeleton-stats"></div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        const grid = document.getElementById('becauseYouWatchedGrid');
        if (grid) {
            grid.innerHTML = Array(6).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-creator"></div>
                    <div class="skeleton-stats"></div>
                </div>
            `).join('');
        }
    }
}

/**
 * Show empty state for "Because You Watched" rail
 */
function showBecauseYouWatchedEmpty() {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Because You Watched</h2>
            </div>
            <div class="content-grid" id="becauseYouWatchedGrid"></div>
        `;
    }
    
    const grid = document.getElementById('becauseYouWatchedGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="empty-rail" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-magic" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
                <h3 style="margin: 15px 0 10px;">No recommendations yet</h3>
                <p style="color: var(--slate-grey);">Watch more content to get personalized recommendations</p>
                <button class="btn btn-secondary" onclick="document.getElementById('relatedGrid')?.scrollIntoView({behavior:'smooth'})" style="margin-top: 15px;">
                    Browse Related Content
                </button>
            </div>
        `;
    }
}

/**
 * Refresh "Because You Watched" rail (reload from database)
 */
async function refreshBecauseYouWatched() {
    const excludeId = window.currentContent?.id;
    await loadBecauseYouWatchedRecommendations({ excludeContentId: excludeId });
}

// ============================================
// Initialize module - listen for content changes
// ============================================
function initBecauseYouWatched() {
    // Listen for content changes to refresh recommendations
    window.addEventListener('contentIdChanged', () => {
        setTimeout(() => {
            refreshBecauseYouWatched();
        }, 500);
    });
    
    // Also refresh after auth changes (user-specific recommendations)
    window.addEventListener('authReady', () => {
        refreshBecauseYouWatched();
    });
    
    console.log('✅ Because You Watched module initialized');
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBecauseYouWatched);
} else {
    initBecauseYouWatched();
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadBecauseYouWatchedRecommendations = loadBecauseYouWatchedRecommendations;
window.renderBecauseYouWatchedRail = renderBecauseYouWatchedRail;
window.showBecauseYouWatchedSkeleton = showBecauseYouWatchedSkeleton;
window.showBecauseYouWatchedEmpty = showBecauseYouWatchedEmpty;
window.refreshBecauseYouWatched = refreshBecauseYouWatched;

console.log('✅ Because You Watched Module loaded (with full brain)');
