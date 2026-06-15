// js/content-detail/because-you-watched.js
// ============================================
// BECAUSE YOU WATCHED MODULE - COMPLETE BRAIN WITH PROPER RECOMMENDATIONS
// Contains UI rendering for "Because You Watched" recommendation rail
// AND its specific database logic (fetch from RecommendationEngine + fallback)
// ============================================
console.log('🎬 Because You Watched Module Loading...');

// Module state
let currentRecommendations = [];
let isLoading = false;
let lastRefreshTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load "Because You Watched" recommendations
 * Uses RecommendationEngine if available, otherwise falls back to smart queries
 */
async function loadBecauseYouWatchedRecommendations(options = {}) {
    const { limit = 8, forceRefresh = false } = options;
    const containerId = 'becauseYouWatchedRail';
    const section = document.getElementById(containerId);
    
    if (!section) {
        console.warn('⚠️ Because You Watched rail container not found');
        return;
    }
    
    // Check cache
    const now = Date.now();
    if (!forceRefresh && currentRecommendations.length > 0 && (now - lastRefreshTime) < CACHE_DURATION) {
        console.log('📦 Using cached recommendations (', currentRecommendations.length, 'items)');
        renderBecauseYouWatchedRail(currentRecommendations);
        return;
    }
    
    // Prevent multiple simultaneous loads
    if (isLoading) {
        console.log('⏳ Recommendations already loading, skipping');
        return;
    }
    
    isLoading = true;
    showBecauseYouWatchedSkeleton();
    
    try {
        let recommendations = [];
        const excludeContentId = window.currentContent?.id;
        
        // STRATEGY 1: Use RecommendationEngine if available
        if (window.recommendationEngine && typeof window.recommendationEngine.getRecommendations === 'function') {
            console.log('🎯 Getting recommendations from RecommendationEngine...');
            
            try {
                const allRecs = await window.recommendationEngine.getRecommendations({
                    type: 'because_you_watched',
                    limit: limit + 2, // Get extras in case we need to exclude current
                    userId: window.currentUserId
                });
                
                // Filter out current content and limit
                recommendations = allRecs.filter(rec => rec.id !== excludeContentId);
                recommendations = recommendations.slice(0, limit);
                
                if (recommendations.length > 0) {
                    console.log('✅ Got', recommendations.length, 'recommendations from RecommendationEngine');
                }
            } catch (engineError) {
                console.warn('⚠️ RecommendationEngine failed, using fallback:', engineError);
            }
        }
        
        // STRATEGY 2: Fallback - Smart query based on user's watch history and likes
        if (recommendations.length === 0 && window.currentUserId) {
            console.log('🔄 Using smart fallback recommendations based on user history...');
            recommendations = await getSmartRecommendations(limit, excludeContentId);
        }
        
        // STRATEGY 3: Final fallback - Popular content in same genre
        if (recommendations.length === 0) {
            console.log('🔄 Using genre-based popular recommendations...');
            recommendations = await getGenreBasedRecommendations(limit, excludeContentId);
        }
        
        // STRATEGY 4: Last resort - Recent popular content
        if (recommendations.length === 0) {
            console.log('🔄 Using recent popular content...');
            recommendations = await getRecentPopularRecommendations(limit, excludeContentId);
        }
        
        if (recommendations.length === 0) {
            showBecauseYouWatchedEmpty();
            return;
        }
        
        // Cache results
        currentRecommendations = recommendations;
        lastRefreshTime = now;
        
        renderBecauseYouWatchedRail(recommendations);
        console.log(`✅ Loaded ${recommendations.length} "Because You Watched" recommendations`);
        
    } catch (error) {
        console.error('❌ Failed to load Because You Watched recommendations:', error);
        showBecauseYouWatchedEmpty();
    } finally {
        isLoading = false;
    }
}

/**
 * Get smart recommendations based on user's watch history and likes
 */
async function getSmartRecommendations(limit, excludeContentId) {
    if (!window.currentUserId) return [];
    
    try {
        // Get user's watch history (completed content)
        const { data: watchHistory, error: watchError } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                content_id,
                is_completed,
                last_position,
                Content!inner (
                    id,
                    genre,
                    user_id,
                    content_type
                )
            `)
            .eq('user_id', window.currentUserId)
            .eq('is_completed', true)
            .limit(20);
        
        if (watchError) throw watchError;
        
        // Get user's liked content
        const { data: likedContent, error: likeError } = await window.supabaseClient
            .from('content_likes')
            .select('content_id')
            .eq('user_id', window.currentUserId)
            .limit(20);
        
        if (likeError) throw likeError;
        
        // Collect genres from user's history
        const watchedGenres = new Map();
        const watchedCreators = new Set();
        
        watchHistory?.forEach(item => {
            const genre = item.Content?.genre;
            if (genre && genre !== 'General') {
                watchedGenres.set(genre, (watchedGenres.get(genre) || 0) + 1);
            }
            if (item.Content?.user_id) {
                watchedCreators.add(item.Content.user_id);
            }
        });
        
        likedContent?.forEach(item => {
            // Also get genres from liked content if we have it
        });
        
        // Find top genres
        const topGenres = Array.from(watchedGenres.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre]) => genre);
        
        if (topGenres.length === 0) {
            return [];
        }
        
        // Build query for recommendations based on top genres
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                thumbnail_url,
                duration,
                user_id,
                genre,
                created_at,
                views_count,
                likes_count,
                user_profiles!user_id (
                    id,
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
            .neq('id', excludeContentId || 0)
            .in('genre', topGenres)
            .order('created_at', { ascending: false })
            .limit(limit * 2);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return [];
        }
        
        // Enrich with real view counts
        const enrichedData = await enrichContentWithEngagement(data);
        
        // Sort by engagement score (likes + views)
        const sorted = enrichedData.sort((a, b) => {
            const scoreA = (a.total_likes || 0) + (a.total_views || 0);
            const scoreB = (b.total_likes || 0) + (b.total_views || 0);
            return scoreB - scoreA;
        });
        
        return sorted.slice(0, limit);
        
    } catch (error) {
        console.error('Smart recommendations failed:', error);
        return [];
    }
}

/**
 * Get genre-based recommendations (fallback when no user history)
 */
async function getGenreBasedRecommendations(limit, excludeContentId) {
    try {
        const currentGenre = window.currentContent?.genre || 'General';
        
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                thumbnail_url,
                duration,
                user_id,
                genre,
                created_at,
                views_count,
                likes_count,
                user_profiles!user_id (
                    id,
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
            .neq('id', excludeContentId || 0)
            .limit(limit);
        
        // If genre is not General, filter by it
        if (currentGenre !== 'General') {
            query = query.eq('genre', currentGenre);
        }
        
        // Order by popularity
        query = query.order('views_count', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return [];
        }
        
        return await enrichContentWithEngagement(data);
        
    } catch (error) {
        console.error('Genre-based recommendations failed:', error);
        return [];
    }
}

/**
 * Get recent popular content (last resort)
 */
async function getRecentPopularRecommendations(limit, excludeContentId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                thumbnail_url,
                duration,
                user_id,
                genre,
                created_at,
                views_count,
                likes_count,
                user_profiles!user_id (
                    id,
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
            .neq('id', excludeContentId || 0)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return [];
        }
        
        return await enrichContentWithEngagement(data);
        
    } catch (error) {
        console.error('Recent popular recommendations failed:', error);
        return [];
    }
}

/**
 * Enrich content items with engagement stats
 */
async function enrichContentWithEngagement(items) {
    if (!items || items.length === 0) return [];
    
    const enrichedItems = await Promise.all(
        items.map(async (item) => {
            // Get engagement stats
            const totalViews = item.content_engagement_stats?.total_views || item.views_count || 0;
            const totalLikes = item.content_engagement_stats?.total_likes || item.likes_count || 0;
            
            // Get creator name
            const creatorName = item.user_profiles?.full_name || 
                               item.user_profiles?.username || 
                               'Creator';
            
            return {
                ...item,
                total_views: totalViews,
                total_likes: totalLikes,
                views_count: totalViews,
                likes_count: totalLikes,
                creator_name: creatorName,
                user_profiles: item.user_profiles
            };
        })
    );
    
    return enrichedItems;
}

/**
 * Render the "Because You Watched" rail with content cards
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
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="content-grid" id="becauseYouWatchedGrid"></div>
        `;
        
        // Attach refresh button handler
        const refreshBtn = section.querySelector('.refresh-rail-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBecauseYouWatched();
                if (typeof window.showToast === 'function') {
                    window.showToast('Refreshing recommendations...', 'info');
                }
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
        const viewsCount = item.total_views || item.views_count || 0;
        const creatorName = item.creator_name || 
                           item.user_profiles?.full_name || 
                           item.user_profiles?.username || 
                           'Creator';
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const duration = item.duration ? window.formatDuration(item.duration) : '';
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card because-you-watched-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${window.escapeHtml(item.title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
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
                    ${item.genre && item.genre !== 'General' ? `
                        <div class="genre-tag">
                            <i class="fas fa-tag"></i>
                            <span>${window.escapeHtml(item.genre)}</span>
                        </div>
                    ` : ''}
                </div>
            </a>
        `;
    }).join('');
    
    section.style.display = 'block';
    console.log('✅ Because You Watched rail rendered with', items.length, 'items');
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
                <button class="refresh-rail-btn" aria-label="Refresh recommendations" style="opacity:0.5; pointer-events:none;">
                    <i class="fas fa-sync-alt"></i> Loading...
                </button>
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
        const refreshBtn = section.querySelector('.refresh-rail-btn');
        if (refreshBtn) {
            refreshBtn.style.opacity = '0.5';
            refreshBtn.style.pointerEvents = 'none';
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
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
                <button class="refresh-rail-btn" aria-label="Refresh recommendations">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="content-grid" id="becauseYouWatchedGrid"></div>
        `;
        
        const refreshBtn = section.querySelector('.refresh-rail-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBecauseYouWatched();
            });
        }
    }
    
    const grid = document.getElementById('becauseYouWatchedGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="empty-rail" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-magic" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
                <h3 style="margin: 15px 0 10px; color: var(--soft-white);">No recommendations yet</h3>
                <p style="color: var(--slate-grey);">Watch and like more content to get personalized recommendations</p>
                <button class="btn btn-secondary" onclick="document.getElementById('relatedGrid')?.scrollIntoView({behavior:'smooth'})" style="margin-top: 15px;">
                    Browse Related Content
                </button>
            </div>
        `;
    }
    
    // Restore refresh button
    const refreshBtn = section.querySelector('.refresh-rail-btn');
    if (refreshBtn) {
        refreshBtn.style.opacity = '';
        refreshBtn.style.pointerEvents = '';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
}

/**
 * Refresh "Because You Watched" rail (reload from database)
 */
async function refreshBecauseYouWatched() {
    console.log('🔄 Refreshing Because You Watched recommendations...');
    currentRecommendations = [];
    lastRefreshTime = 0;
    await loadBecauseYouWatchedRecommendations({ forceRefresh: true });
}

/**
 * Initialize the module - listen for content and auth changes
 */
function initBecauseYouWatched() {
    console.log('🎬 Initializing Because You Watched module...');
    
    // Listen for content changes to refresh recommendations
    window.addEventListener('contentIdChanged', () => {
        console.log('🔄 Content changed, refreshing Because You Watched');
        setTimeout(() => {
            currentRecommendations = [];
            loadBecauseYouWatchedRecommendations();
        }, 500);
    });
    
    // Listen for auth changes (user logged in/out)
    window.addEventListener('authReady', () => {
        console.log('🔄 Auth state changed, refreshing Because You Watched');
        setTimeout(() => {
            currentRecommendations = [];
            loadBecauseYouWatchedRecommendations({ forceRefresh: true });
        }, 500);
    });
    
    // Also listen for like events (user liked content - can affect recommendations)
    window.addEventListener('contentLiked', () => {
        console.log('🔄 Content liked, recommendations may update');
        setTimeout(() => {
            if (Date.now() - lastRefreshTime > 60000) { // Only refresh if older than 1 minute
                currentRecommendations = [];
                loadBecauseYouWatchedRecommendations();
            }
        }, 1000);
    });
    
    // Initial load if content exists
    setTimeout(() => {
        if (window.currentContent?.id) {
            loadBecauseYouWatchedRecommendations();
        }
    }, 500);
    
    console.log('✅ Because You Watched module initialized');
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBecauseYouWatched);
} else {
    initBecauseYouWatched();
}

// Also listen for playlist mode (reload recommendations when playlist loads)
window.addEventListener('playlistLoaded', () => {
    console.log('🔄 Playlist loaded, refreshing Because You Watched');
    setTimeout(() => {
        currentRecommendations = [];
        loadBecauseYouWatchedRecommendations();
    }, 500);
});

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadBecauseYouWatchedRecommendations = loadBecauseYouWatchedRecommendations;
window.renderBecauseYouWatchedRail = renderBecauseYouWatchedRail;
window.showBecauseYouWatchedSkeleton = showBecauseYouWatchedSkeleton;
window.showBecauseYouWatchedEmpty = showBecauseYouWatchedEmpty;
window.refreshBecauseYouWatched = refreshBecauseYouWatched;
window.getSmartRecommendations = getSmartRecommendations;
window.getGenreBasedRecommendations = getGenreBasedRecommendations;

console.log('✅ Because You Watched Module loaded (with smart personalization)');
