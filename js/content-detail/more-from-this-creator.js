// js/content-detail/more-from-this-creator.js
// ============================================
// MORE FROM THIS CREATOR MODULE - UPDATED FOR NEW SCHEMA
// Uses content_engagement_stats for ALL metrics
// ============================================
console.log('🎬 More From This Creator Module Loading...');

/**
 * Load "More From This Creator" content from database
 * Fetches other published content by the same creator
 */
async function loadMoreFromCreatorRecommendations(options = {}) {
    const { creatorId, excludeContentId, limit = 6 } = options;
    const section = document.getElementById('moreFromCreatorRail');
    
    if (!section) {
        console.warn('More From This Creator rail container not found');
        return;
    }
    
    // Get creator ID from various sources
    const targetCreatorId = creatorId || 
                           window.currentContent?.creator_id || 
                           window.currentContent?.user_id ||
                           window.currentPlaylist?.creator_id ||
                           (window.currentPlaylistItems && window.currentPlaylistItems[0]?.user_id);
    
    if (!targetCreatorId) {
        console.log('No creator ID available, hiding More From This Creator rail');
        section.style.display = 'none';
        return;
    }
    
    showMoreFromCreatorSkeleton();
    
    try {
        // Query Content table WITHOUT views_count/likes_count
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
                user_id,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('user_id', targetCreatorId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(limit);
        
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
        
        // Get engagement stats separately
        const contentIds = data.map(item => item.id);
        const { data: statsData, error: statsError } = await window.supabaseClient
            .from('content_engagement_stats')
            .select('content_id, total_views, total_likes, total_comments')
            .in('content_id', contentIds);
        
        if (statsError) throw statsError;
        
        // Create stats map
        const statsMap = new Map();
        statsData?.forEach(stat => {
            statsMap.set(stat.content_id, {
                total_views: stat.total_views || 0,
                total_likes: stat.total_likes || 0,
                total_comments: stat.total_comments || 0
            });
        });
        
        // Enrich data with stats
        const enrichedData = data.map(item => ({
            ...item,
            total_views: statsMap.get(item.id)?.total_views || 0,
            total_likes: statsMap.get(item.id)?.total_likes || 0,
            total_comments: statsMap.get(item.id)?.total_comments || 0,
            views_count: statsMap.get(item.id)?.total_views || 0,
            likes_count: statsMap.get(item.id)?.total_likes || 0
        }));
        
        renderMoreFromCreatorRail(enrichedData, targetCreatorId);
        console.log(`✅ Loaded ${enrichedData.length} "More From This Creator" items for creator ${targetCreatorId}`);
        
    } catch (error) {
        console.error('❌ Failed to load More From This Creator content:', error);
        showMoreFromCreatorEmpty();
    }
}

/**
 * Render the "More From This Creator" rail
 */
function renderMoreFromCreatorRail(items, creatorId) {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    // Get creator name
    let creatorName = window.currentContent?.creator_display_name || 
                     window.currentContent?.creator || 
                     window.currentContent?.user_profiles?.full_name ||
                     window.currentContent?.user_profiles?.username ||
                     (window.currentPlaylist?.creator_name) ||
                     'This Creator';
    
    if (items[0]?.user_profiles?.full_name) {
        creatorName = items[0].user_profiles.full_name;
    } else if (items[0]?.user_profiles?.username) {
        creatorName = items[0].user_profiles.username;
    }
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From ${window.escapeHtml(creatorName)}</h2>
                ${creatorId ? `<a href="creator-channel.html?id=${creatorId}" class="view-all-link">View All <i class="fas fa-arrow-right"></i></a>` : ''}
            </div>
            <div class="content-grid" id="moreFromCreatorGrid"></div>
        `;
    } else {
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
        const viewsCount = item.total_views || 0;
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
 * Show skeleton loader
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
 * Show empty state
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
 * Refresh the rail
 */
async function refreshMoreFromCreator() {
    const creatorId = window.currentContent?.creator_id || 
                     window.currentContent?.user_id ||
                     window.currentPlaylist?.creator_id;
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

// Initialize module
function initMoreFromCreator() {
    window.addEventListener('contentIdChanged', () => {
        setTimeout(() => {
            refreshMoreFromCreator();
        }, 500);
    });
    
    window.addEventListener('playlistLoaded', () => {
        setTimeout(() => {
            refreshMoreFromCreator();
        }, 500);
    });
    
    setTimeout(() => {
        if (window.currentContent?.creator_id || window.currentContent?.user_id) {
            refreshMoreFromCreator();
        }
    }, 500);
}

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

console.log('✅ More From This Creator Module loaded (Updated for new schema)');
