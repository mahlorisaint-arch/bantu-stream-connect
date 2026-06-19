// js/content-detail/related-content.js
// ============================================
// RELATED CONTENT MODULE - UPDATED FOR NEW SCHEMA
// Shows correct view counts from content_engagement_stats
// ============================================
console.log('🎬 Related Content Module Loading...');

// Track current state
let currentRelatedItems = [];
let currentGenre = 'all';
let currentPage = 0;
const ITEMS_PER_PAGE = 6;

/**
 * Load related content from database
 */
async function loadRelatedContent(contentId, limit = 6, genre = 'all') {
    if (!contentId) {
        console.warn('⚠️ Cannot load related content: missing contentId');
        return [];
    }
    
    const skeleton = document.getElementById('relatedSkeleton');
    const grid = document.getElementById('relatedGrid');
    const empty = document.getElementById('relatedEmpty');
    const loadMore = document.getElementById('loadMoreContainer');
    
    // Show skeleton
    if (skeleton) skeleton.style.display = 'grid';
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (loadMore) loadMore.style.display = 'none';
    
    try {
        // First get current content's genre
        const { data: currentContent, error: currentError } = await window.supabaseClient
            .from('Content')
            .select('genre, content_type, user_id')
            .eq('id', parseInt(contentId))
            .maybeSingle();
        
        if (currentError) {
            console.warn('Could not fetch current content genre:', currentError);
        }
        
        // Build query for related content
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                thumbnail_url,
                user_id,
                genre,
                duration,
                media_type,
                status,
                created_at,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .neq('id', parseInt(contentId))
            .limit(limit);
        
        // Apply genre filter
        if (genre !== 'all' && currentContent?.genre) {
            query = query.eq('genre', genre);
        } else if (currentContent?.genre && currentContent.genre !== 'General') {
            query = query.eq('genre', currentContent.genre);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            // Fallback: Get any recent content
            const { data: fallbackData, error: fallbackError } = await window.supabaseClient
                .from('Content')
                .select(`
                    id,
                    title,
                    thumbnail_url,
                    user_id,
                    genre,
                    duration,
                    media_type,
                    status,
                    created_at,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                `)
                .eq('status', 'published')
                .neq('id', parseInt(contentId))
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (fallbackError) throw fallbackError;
            
            if (!fallbackData || fallbackData.length === 0) {
                // Hide skeleton, show empty
                if (skeleton) skeleton.style.display = 'none';
                if (grid) grid.style.display = 'none';
                if (empty) empty.style.display = 'block';
                if (loadMore) loadMore.style.display = 'none';
                return [];
            }
            
            const enrichedData = await enrichContentWithStats(fallbackData);
            currentRelatedItems = enrichedData;
            currentGenre = genre;
            renderRelatedContent(enrichedData);
            return enrichedData;
        }
        
        const enrichedData = await enrichContentWithStats(data);
        currentRelatedItems = enrichedData;
        currentGenre = genre;
        renderRelatedContent(enrichedData);
        
        console.log(`✅ Loaded ${enrichedData.length} related content items`);
        return enrichedData;
        
    } catch (error) {
        console.error('❌ Error loading related content:', error);
        if (skeleton) skeleton.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'block';
        if (loadMore) loadMore.style.display = 'none';
        return [];
    }
}

/**
 * Enrich content items with stats from content_engagement_stats
 */
async function enrichContentWithStats(items) {
    if (!items || items.length === 0) return [];
    
    const contentIds = items.map(item => item.id);
    
    const { data: statsData, error: statsError } = await window.supabaseClient
        .from('content_engagement_stats')
        .select('content_id, total_views, total_likes, total_comments')
        .in('content_id', contentIds);
    
    if (statsError) {
        console.warn('Failed to fetch engagement stats:', statsError);
        return items.map(item => ({
            ...item,
            total_views: 0,
            total_likes: 0,
            total_comments: 0,
            views_count: 0
        }));
    }
    
    const statsMap = new Map();
    statsData?.forEach(stat => {
        statsMap.set(stat.content_id, {
            total_views: stat.total_views || 0,
            total_likes: stat.total_likes || 0,
            total_comments: stat.total_comments || 0
        });
    });
    
    return items.map(item => ({
        ...item,
        total_views: statsMap.get(item.id)?.total_views || 0,
        total_likes: statsMap.get(item.id)?.total_likes || 0,
        total_comments: statsMap.get(item.id)?.total_comments || 0,
        views_count: statsMap.get(item.id)?.total_views || 0,
        likes_count: statsMap.get(item.id)?.total_likes || 0
    }));
}

/**
 * Render related content into the grid
 */
function renderRelatedContent(items) {
    const container = document.getElementById('relatedGrid');
    const skeleton = document.getElementById('relatedSkeleton');
    const empty = document.getElementById('relatedEmpty');
    const loadMore = document.getElementById('loadMoreContainer');
    
    if (!container) {
        console.warn('Related content grid container not found');
        return;
    }
    
    // Hide skeleton
    if (skeleton) skeleton.style.display = 'none';
    
    if (!items || items.length === 0) {
        container.style.display = 'none';
        if (empty) empty.style.display = 'block';
        if (loadMore) loadMore.style.display = 'none';
        return;
    }
    
    container.style.display = 'grid';
    if (empty) empty.style.display = 'none';
    
    // Show load more if we have items and they might be more
    if (loadMore && items.length >= 6) {
        loadMore.style.display = 'block';
    } else if (loadMore) {
        loadMore.style.display = 'none';
    }
    
    container.innerHTML = items.map(item => {
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const title = item.title || 'Untitled';
        const viewsCount = item.total_views || 0;
        const likesCount = item.total_likes || 0;
        const creatorName = item.user_profiles?.full_name || 
                           item.user_profiles?.username || 
                           'Creator';
        const duration = item.duration ? window.formatDuration(item.duration) : '';
        const genre = item.genre || '';
        
        // Check if content is new (less than 7 days old)
        const isNew = item.created_at && (new Date() - new Date(item.created_at)) < 7 * 24 * 60 * 60 * 1000;
        // Check if content is trending (high views)
        const isTrending = viewsCount > 1000;
        
        return `
            <a href="content-detail.html?id=${item.id}" class="related-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${window.escapeHtml(title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
                    ${isNew ? `<span class="new-badge">New</span>` : ''}
                    ${isTrending ? `<span class="trending-badge"><i class="fas fa-fire"></i> Trending</span>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${window.truncateText(title, 50)}</h3>
                    <div class="card-meta">
                        <span class="views-count">
                            <i class="fas fa-eye"></i>
                            ${window.formatNumber(viewsCount)} views
                        </span>
                        ${likesCount > 0 ? `
                            <span class="like-count">
                                <i class="fas fa-heart"></i>
                                <span>${window.formatNumber(likesCount)}</span>
                            </span>
                        ` : ''}
                    </div>
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${window.truncateText(creatorName, 20)}
                    </div>
                    ${genre && genre !== 'General' ? `
                        <div class="genre-tag">
                            <i class="fas fa-tag"></i>
                            <span>${window.escapeHtml(genre)}</span>
                        </div>
                    ` : ''}
                </div>
            </a>
        `;
    }).join('');
    
    // Add click tracking
    container.querySelectorAll('.related-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (window.track?.relatedContentClick) {
                const contentId = card.dataset.contentId;
                window.track.relatedContentClick(contentId);
            }
        });
    });
    
    console.log('✅ Related content grid rendered with correct view counts');
}

/**
 * Refresh related content
 */
async function refreshRelatedContent(contentId = null) {
    const targetId = contentId || window.currentContent?.id;
    
    if (!targetId) {
        console.warn('Cannot refresh related content: no content ID');
        return;
    }
    
    await loadRelatedContent(targetId, ITEMS_PER_PAGE, currentGenre);
}

/**
 * Show skeleton loader
 */
function showRelatedContentSkeleton() {
    const container = document.getElementById('relatedGrid');
    const skeleton = document.getElementById('relatedSkeleton');
    const empty = document.getElementById('relatedEmpty');
    const loadMore = document.getElementById('loadMoreContainer');
    
    if (!container) return;
    
    if (skeleton) {
        skeleton.style.display = 'grid';
        // Ensure skeleton has items
        if (skeleton.children.length === 0) {
            skeleton.innerHTML = Array(6).fill().map(() => `
                <div class="related-skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-meta"></div>
                    <div class="skeleton-creator"></div>
                </div>
            `).join('');
        }
    }
    if (container) container.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (loadMore) loadMore.style.display = 'none';
}

/**
 * Setup genre filter listeners
 */
function setupGenreFilters() {
    const filters = document.querySelectorAll('.genre-filter-pill');
    if (!filters.length) return;
    
    filters.forEach(filter => {
        const newFilter = filter.cloneNode(true);
        filter.parentNode.replaceChild(newFilter, filter);
        
        newFilter.addEventListener('click', function() {
            // Remove active from all
            filters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            const genre = this.dataset.genre;
            currentGenre = genre;
            currentPage = 0;
            
            // Reload with genre filter
            if (window.currentContent?.id) {
                const limit = genre === 'all' ? ITEMS_PER_PAGE : ITEMS_PER_PAGE;
                loadRelatedContent(window.currentContent.id, limit, genre);
            }
        });
    });
}

/**
 * Setup load more button
 */
function setupLoadMoreButton() {
    const btn = document.getElementById('loadMoreRelatedBtn');
    if (!btn) return;
    
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', function() {
        // Load more items (increment page)
        currentPage++;
        const newLimit = (currentPage + 1) * ITEMS_PER_PAGE;
        if (window.currentContent?.id) {
            loadRelatedContent(window.currentContent.id, newLimit, currentGenre);
        }
    });
}

// Initialize module
function initRelatedContent() {
    console.log('🎬 Initializing Related Content module...');
    
    // Setup genre filters
    setupGenreFilters();
    
    // Setup load more button
    setupLoadMoreButton();
    
    window.addEventListener('contentIdChanged', (event) => {
        const { contentId } = event.detail;
        if (contentId) {
            currentPage = 0;
            currentGenre = 'all';
            showRelatedContentSkeleton();
            setTimeout(() => {
                refreshRelatedContent(contentId);
                // Reset genre filters
                document.querySelectorAll('.genre-filter-pill').forEach(p => p.classList.remove('active'));
                const allFilter = document.querySelector('.genre-filter-pill[data-genre="all"]');
                if (allFilter) allFilter.classList.add('active');
            }, 100);
        }
    });
    
    window.addEventListener('playlistLoaded', () => {
        if (window.currentContent?.id) {
            currentPage = 0;
            currentGenre = 'all';
            showRelatedContentSkeleton();
            setTimeout(() => {
                refreshRelatedContent(window.currentContent.id);
            }, 200);
        }
    });
    
    if (window.currentContent?.id) {
        showRelatedContentSkeleton();
        setTimeout(() => refreshRelatedContent(window.currentContent.id), 200);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRelatedContent);
} else {
    initRelatedContent();
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadRelatedContent = loadRelatedContent;
window.renderRelatedContent = renderRelatedContent;
window.refreshRelatedContent = refreshRelatedContent;
window.showRelatedContentSkeleton = showRelatedContentSkeleton;
window.enrichContentWithStats = enrichContentWithStats;
window.setupGenreFilters = setupGenreFilters;
window.setupLoadMoreButton = setupLoadMoreButton;

console.log('✅ Related Content Module loaded (Updated for new schema with correct view counts)');
