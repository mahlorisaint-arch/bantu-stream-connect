// js/content-detail/related-content.js
// ============================================
// RELATED CONTENT MODULE - COMPLETE BRAIN
// Contains UI rendering for general related content grid
// AND its specific database logic (fetch from Content table by genre/tags)
// ============================================
console.log('🎬 Related Content Module Loading...');

/**
 * Load related content from database for a specific content
 * Uses genre matching and excludes current content
 * @param {string|number} contentId - The content ID to find related content for
 * @param {number} limit - Maximum number of items to load (default: 6)
 */
async function loadRelatedContent(contentId, limit = 6) {
    if (!contentId) {
        console.warn('⚠️ Cannot load related content: missing contentId');
        return [];
    }
    
    try {
        // First, get the current content's genre and other metadata
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
                ),
                content_engagement_stats (
                    total_views,
                    total_likes,
                    total_comments
                )
            `)
            .eq('status', 'published')
            .neq('id', parseInt(contentId))
            .limit(limit);
        
        // Prioritize by genre match if available
        if (currentContent?.genre && currentContent.genre !== 'General') {
            query = query.eq('genre', currentContent.genre);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            // Fallback: Get any popular content excluding current
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
                    ),
                    content_engagement_stats (
                        total_views,
                        total_likes,
                        total_comments
                    )
                `)
                .eq('status', 'published')
                .neq('id', parseInt(contentId))
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (fallbackError) throw fallbackError;
            
            if (!fallbackData || fallbackData.length === 0) {
                renderRelatedContent([]);
                return [];
            }
            
            // Enrich fallback data with view counts
            const enrichedFallback = await enrichContentWithViews(fallbackData);
            renderRelatedContent(enrichedFallback);
            return enrichedFallback;
        }
        
        // Enrich data with real view counts from content_views table
        const enrichedData = await enrichContentWithViews(data);
        renderRelatedContent(enrichedData);
        
        console.log(`✅ Loaded ${enrichedData.length} related content items`);
        return enrichedData;
        
    } catch (error) {
        console.error('❌ Error loading related content:', error);
        renderRelatedContent([]);
        return [];
    }
}

/**
 * Enrich content items with real view counts from content_views table
 * @param {Array} items - Array of content items
 * @returns {Promise<Array>} - Enriched items with real_views_count
 */
async function enrichContentWithViews(items) {
    if (!items || items.length === 0) return [];
    
    const enrichedItems = await Promise.all(
        items.map(async (item) => {
            // Get real view count from content_views
            const { count: realViews, error: viewsError } = await window.supabaseClient
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', item.id)
                .eq('counted_as_view', true);
            
            if (viewsError) {
                console.warn(`Failed to get view count for content ${item.id}:`, viewsError);
            }
            
            // Get engagement stats
            const totalViews = item.content_engagement_stats?.total_views || realViews || 0;
            const totalLikes = item.content_engagement_stats?.total_likes || 0;
            const totalComments = item.content_engagement_stats?.total_comments || 0;
            
            return {
                ...item,
                real_views_count: realViews || 0,
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                views_count: totalViews
            };
        })
    );
    
    return enrichedItems;
}

/**
 * Render related content into the grid
 * @param {Array} items - Array of content items to display
 */
function renderRelatedContent(items) {
    const container = document.getElementById('relatedGrid');
    if (!container) {
        console.warn('Related content grid container not found');
        return;
    }
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="related-placeholder card" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-video-slash" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
                <p style="margin-top: 15px; color: var(--slate-grey);">No related content found</p>
                <button class="btn btn-secondary" onclick="location.reload()" style="margin-top: 15px;">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const title = item.title || 'Untitled';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
        const creatorName = item.user_profiles?.full_name || item.user_profiles?.username || 'Creator';
        const duration = item.duration ? window.formatDuration(item.duration) : '';
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card related-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${window.escapeHtml(title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${window.truncateText(title, 50)}</h3>
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
    
    // Add click tracking
    container.querySelectorAll('.related-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (window.track?.relatedContentClick) {
                const contentId = card.dataset.contentId;
                window.track.relatedContentClick(contentId);
            }
        });
    });
    
    console.log('✅ Related content grid rendered');
}

/**
 * Refresh related content (reload from database)
 * @param {string|number} contentId - Optional content ID, uses currentContent if not provided
 */
async function refreshRelatedContent(contentId = null) {
    const targetId = contentId || window.currentContent?.id;
    
    if (!targetId) {
        console.warn('Cannot refresh related content: no content ID');
        return;
    }
    
    await loadRelatedContent(targetId);
}

/**
 * Show skeleton loader for related content grid
 */
function showRelatedContentSkeleton() {
    const container = document.getElementById('relatedGrid');
    if (!container) return;
    
    container.innerHTML = Array(6).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
}

// ============================================
// Initialize module - listen for content changes
// ============================================
function initRelatedContent() {
    // Listen for content changes to refresh related content
    window.addEventListener('contentIdChanged', (event) => {
        const { contentId } = event.detail;
        if (contentId) {
            showRelatedContentSkeleton();
            setTimeout(() => {
                refreshRelatedContent(contentId);
            }, 100);
        }
    });
    
    // Initial load if content exists
    if (window.currentContent?.id) {
        showRelatedContentSkeleton();
        setTimeout(() => refreshRelatedContent(window.currentContent.id), 200);
    }
    
    console.log('✅ Related Content module initialized');
}

// Auto-initialize if DOM is ready
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

console.log('✅ Related Content Module loaded (with full brain)');
