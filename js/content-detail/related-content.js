// js/content-detail/related-content.js
// ============================================
// RELATED CONTENT MODULE - UPDATED FOR NEW SCHEMA
// Shows correct view counts from content_engagement_stats
// ============================================
console.log('🎬 Related Content Module Loading...');

/**
 * Load related content from database
 */
async function loadRelatedContent(contentId, limit = 6) {
    if (!contentId) {
        console.warn('⚠️ Cannot load related content: missing contentId');
        return [];
    }
    
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
        
        // Build query for related content (without views_count/likes_count)
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
        
        // Prioritize by genre match
        if (currentContent?.genre && currentContent.genre !== 'General') {
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
                renderRelatedContent([]);
                return [];
            }
            
            // Get stats for fallback data
            const enrichedData = await enrichContentWithStats(fallbackData);
            renderRelatedContent(enrichedData);
            return enrichedData;
        }
        
        // Enrich data with real stats from content_engagement_stats
        const enrichedData = await enrichContentWithStats(data);
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
 * Enrich content items with stats from content_engagement_stats
 */
async function enrichContentWithStats(items) {
    if (!items || items.length === 0) return [];
    
    // Get all content IDs
    const contentIds = items.map(item => item.id);
    
    // Fetch stats from content_engagement_stats
    const { data: statsData, error: statsError } = await window.supabaseClient
        .from('content_engagement_stats')
        .select('content_id, total_views, total_likes, total_comments')
        .in('content_id', contentIds);
    
    if (statsError) {
        console.warn('Failed to fetch engagement stats:', statsError);
        // Return items with zero views if stats fetch fails
        return items.map(item => ({
            ...item,
            total_views: 0,
            total_likes: 0,
            total_comments: 0,
            views_count: 0
        }));
    }
    
    // Create stats map
    const statsMap = new Map();
    statsData?.forEach(stat => {
        statsMap.set(stat.content_id, {
            total_views: stat.total_views || 0,
            total_likes: stat.total_likes || 0,
            total_comments: stat.total_comments || 0
        });
    });
    
    // Enrich items
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
        const viewsCount = item.total_views || 0;  // From content_engagement_stats
        const creatorName = item.user_profiles?.full_name || 
                           item.user_profiles?.username || 
                           'Creator';
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
    
    await loadRelatedContent(targetId);
}

/**
 * Show skeleton loader
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

// Initialize module
function initRelatedContent() {
    window.addEventListener('contentIdChanged', (event) => {
        const { contentId } = event.detail;
        if (contentId) {
            showRelatedContentSkeleton();
            setTimeout(() => {
                refreshRelatedContent(contentId);
            }, 100);
        }
    });
    
    window.addEventListener('playlistLoaded', () => {
        if (window.currentContent?.id) {
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

console.log('✅ Related Content Module loaded (Updated for new schema with correct view counts)');
