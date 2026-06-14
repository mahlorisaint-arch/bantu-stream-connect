// js/content-detail/more-from-this-creator.js
// ============================================
// MORE FROM THIS CREATOR MODULE - COMPLETE BRAIN
// Contains UI rendering for "More From This Creator" recommendation rail
// AND its specific database logic (fetch by creator_id from Content table)
// ============================================
console.log('🎬 More From This Creator Module Loading...');

/**
 * Load "More From This Creator" content from database
 * Fetches other published content by the same creator
 * @param {Object} options - Configuration options
 * @param {string|number} options.creatorId - Creator's user ID (required)
 * @param {string|number} options.excludeContentId - Content ID to exclude (current content)
 * @param {number} options.limit - Maximum number of items to load (default: 6)
 */
async function loadMoreFromCreatorRecommendations(options = {}) {
    const { creatorId, excludeContentId, limit = 6 } = options;
    const containerId = 'moreFromCreatorRail';
    const section = document.getElementById(containerId);
    
    if (!section) {
        console.warn('More From This Creator rail container not found');
        return;
    }
    
    // Check if we have a creator to load from
    const targetCreatorId = creatorId || window.currentContent?.creator_id || window.currentContent?.user_id;
    
    if (!targetCreatorId) {
        console.log('No creator ID available, hiding More From This Creator rail');
        section.style.display = 'none';
        return;
    }
    
    // Show skeleton loader immediately
    showMoreFromCreatorSkeleton();
    
    try {
        let creatorContent = [];
        
        // Build the query
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                file_url,
                duration,
                media_type,
                created_at,
                views_count,
                likes_count,
                comments_count,
                user_id,
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
            .eq('user_id', targetCreatorId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(limit);
        
        // Exclude current content if specified
        if (excludeContentId) {
            query = query.neq('id', excludeContentId);
        } else if (window.currentContent?.id) {
            query = query.neq('id', window.currentContent.id);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showMoreFromCreatorEmpty();
            return;
        }
        
        // Enrich with engagement stats
        const enrichedData = data.map(item => ({
            ...item,
            total_views: item.content_engagement_stats?.total_views || item.views_count || 0,
            total_likes: item.content_engagement_stats?.total_likes || item.likes_count || 0,
            total_comments: item.content_engagement_stats?.total_comments || item.comments_count || 0
        }));
        
        renderMoreFromCreatorRail(enrichedData, targetCreatorId);
        console.log(`✅ Loaded ${enrichedData.length} "More From This Creator" items for creator ${targetCreatorId}`);
        
    } catch (error) {
        console.error('❌ Failed to load More From This Creator content:', error);
        showMoreFromCreatorEmpty();
    }
}

/**
 * Render the "More From This Creator" rail with content cards
 * @param {Array} items - Array of content items to display
 * @param {string|number} creatorId - Creator ID for the "View All" link
 */
function renderMoreFromCreatorRail(items, creatorId) {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    // Get creator name for display
    let creatorName = window.currentContent?.creator_display_name || 
                     window.currentContent?.creator || 
                     'This Creator';
    
    if (items[0]?.user_profiles?.full_name) {
        creatorName = items[0].user_profiles.full_name;
    } else if (items[0]?.user_profiles?.username) {
        creatorName = items[0].user_profiles.username;
    }
    
    // Ensure section has proper structure
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From ${window.escapeHtml(creatorName)}</h2>
                ${creatorId ? `<a href="creator-channel.html?id=${creatorId}" class="view-all-link">View All <i class="fas fa-arrow-right"></i></a>` : ''}
            </div>
            <div class="content-grid" id="moreFromCreatorGrid"></div>
        `;
    } else {
        // Update title if creator name changed
        const titleEl = section.querySelector('.section-title');
        if (titleEl) {
            titleEl.textContent = `More From ${window.escapeHtml(creatorName)}`;
        }
    }
    
    const grid = document.getElementById('moreFromCreatorGrid');
    if (!grid) return;
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="empty-rail">No other content from this creator</div>';
        return;
    }
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.total_views || item.views_count || 0;
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const duration = item.duration ? window.formatDuration(item.duration) : '';
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card more-from-creator-card" data-content-id="${item.id}">
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
                    <div class="upload-date">
                        <i class="far fa-calendar-alt"></i>
                        <span>${window.formatDate(item.created_at)}</span>
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    section.style.display = 'block';
    console.log('✅ More From This Creator rail rendered');
}

/**
 * Show skeleton loader for "More From This Creator" rail
 */
function showMoreFromCreatorSkeleton() {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From This Creator</h2>
            </div>
            <div class="content-grid" id="moreFromCreatorGrid">
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
        const grid = document.getElementById('moreFromCreatorGrid');
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
 * Show empty state for "More From This Creator" rail
 */
function showMoreFromCreatorEmpty() {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From This Creator</h2>
            </div>
            <div class="content-grid" id="moreFromCreatorGrid"></div>
        `;
    }
    
    const grid = document.getElementById('moreFromCreatorGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="empty-rail" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-user-friends" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
                <h3 style="margin: 15px 0 10px;">No other content</h3>
                <p style="color: var(--slate-grey);">This creator hasn't published other content yet</p>
            </div>
        `;
    }
}

/**
 * Refresh "More From This Creator" rail (reload from database)
 */
async function refreshMoreFromCreator() {
    const creatorId = window.currentContent?.creator_id || window.currentContent?.user_id;
    const excludeId = window.currentContent?.id;
    
    if (creatorId) {
        await loadMoreFromCreatorRecommendations({ 
            creatorId: creatorId, 
            excludeContentId: excludeId,
            limit: 6 
        });
    } else {
        const section = document.getElementById('moreFromCreatorRail');
        if (section) section.style.display = 'none';
    }
}

// ============================================
// Initialize module - listen for content changes
// ============================================
function initMoreFromCreator() {
    // Listen for content changes to refresh recommendations
    window.addEventListener('contentIdChanged', () => {
        setTimeout(() => {
            refreshMoreFromCreator();
        }, 500);
    });
    
    // Initial load if content exists
    if (window.currentContent?.creator_id || window.currentContent?.user_id) {
        setTimeout(() => refreshMoreFromCreator(), 300);
    }
    
    console.log('✅ More From This Creator module initialized');
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoreFromCreator);
} else {
    initMoreFromCreator();
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadMoreFromCreatorRecommendations = loadMoreFromCreatorRecommendations;
window.renderMoreFromCreatorRail = renderMoreFromCreatorRail;
window.showMoreFromCreatorSkeleton = showMoreFromCreatorSkeleton;
window.showMoreFromCreatorEmpty = showMoreFromCreatorEmpty;
window.refreshMoreFromCreator = refreshMoreFromCreator;

console.log('✅ More From This Creator Module loaded (with full brain)');
