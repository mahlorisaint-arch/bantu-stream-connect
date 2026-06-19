// js/content-detail/more-from-this-creator.js
// ============================================
// MORE FROM THIS CREATOR MODULE - COMPLETE FIX
// Uses correct IDs and class names to match HTML
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
    
    // Show skeleton
    showMoreFromCreatorSkeleton();
    
    try {
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
                content_format,
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
            showMoreFromCreatorEmpty(targetCreatorId);
            return;
        }
        
        // Get engagement stats separately
        const contentIds = data.map(item => item.id);
        const { data: statsData, error: statsError } = await window.supabaseClient
            .from('content_engagement_stats')
            .select('content_id, total_views, total_likes, total_comments')
            .in('content_id', contentIds);
        
        if (statsError) throw statsError;
        
        const statsMap = new Map();
        statsData?.forEach(stat => {
            statsMap.set(stat.content_id, {
                total_views: stat.total_views || 0,
                total_likes: stat.total_likes || 0,
                total_comments: stat.total_comments || 0
            });
        });
        
        const enrichedData = data.map(item => ({
            ...item,
            total_views: statsMap.get(item.id)?.total_views || 0,
            total_likes: statsMap.get(item.id)?.total_likes || 0,
            total_comments: statsMap.get(item.id)?.total_comments || 0,
            views_count: statsMap.get(item.id)?.total_views || 0,
            likes_count: statsMap.get(item.id)?.total_likes || 0
        }));
        
        renderMoreFromCreatorRail(enrichedData, targetCreatorId);
        console.log(`✅ Loaded ${enrichedData.length} "More From This Creator" items`);
        
    } catch (error) {
        console.error('❌ Failed to load More From This Creator content:', error);
        showMoreFromCreatorEmpty(targetCreatorId);
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
    
    // Update title
    const nameSpan = document.getElementById('moreFromCreatorName');
    if (nameSpan) {
        nameSpan.textContent = creatorName;
    }
    
    // Update avatar
    const avatarContainer = document.getElementById('moreFromCreatorAvatar');
    if (avatarContainer) {
        const avatarUrl = items[0]?.user_profiles?.avatar_url || 
                         window.currentContent?.user_profiles?.avatar_url ||
                         null;
        if (avatarUrl && avatarUrl !== 'null') {
            const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            avatarContainer.innerHTML = `<img src="${fixedUrl}" alt="${creatorName}" onerror="this.onerror=null; this.parentElement.innerHTML='<span>${creatorName.charAt(0).toUpperCase()}</span>';">`;
        } else {
            avatarContainer.innerHTML = `<span>${creatorName.charAt(0).toUpperCase()}</span>`;
        }
    }
    
    // Update View All link
    const viewAllLink = document.getElementById('moreFromCreatorViewAll');
    if (viewAllLink && creatorId) {
        viewAllLink.href = `creator-channel.html?id=${creatorId}`;
        viewAllLink.style.display = 'flex';
    } else if (viewAllLink) {
        viewAllLink.style.display = 'none';
    }
    
    const grid = document.getElementById('moreFromCreatorGrid');
    const empty = document.getElementById('moreFromCreatorEmpty');
    const skeleton = document.getElementById('moreFromCreatorSkeleton');
    
    if (!grid) return;
    
    // Hide skeleton and empty
    if (skeleton) skeleton.style.display = 'none';
    if (empty) empty.style.display = 'none';
    
    if (!items || items.length === 0) {
        if (empty) empty.style.display = 'block';
        grid.innerHTML = '';
        return;
    }
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.total_views || 0;
        const likesCount = item.total_likes || 0;
        const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                         item.thumbnail_url || 
                         'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        const duration = item.duration ? window.formatDuration(item.duration) : '';
        const mediaType = item.media_type || item.content_format || 'video';
        const isAudio = mediaType === 'audio';
        
        return `
            <a href="content-detail.html?id=${item.id}" class="creator-content-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${window.escapeHtml(item.title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
                    <span class="media-type-badge ${isAudio ? 'audio' : 'video'}">
                        <i class="fas ${isAudio ? 'fa-headphones' : 'fa-play'}"></i>
                        <span>${isAudio ? 'Audio' : 'Video'}</span>
                    </span>
                    <span class="same-creator-badge">
                        <i class="fas fa-user-check"></i>
                        <span>Same Creator</span>
                    </span>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${window.truncateText(item.title, 45)}</h3>
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
    const skeleton = document.getElementById('moreFromCreatorSkeleton');
    const grid = document.getElementById('moreFromCreatorGrid');
    const empty = document.getElementById('moreFromCreatorEmpty');
    
    if (!section) return;
    
    section.style.display = 'block';
    if (skeleton) skeleton.style.display = 'grid';
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';
}

/**
 * Show empty state
 */
function showMoreFromCreatorEmpty(creatorId) {
    const section = document.getElementById('moreFromCreatorRail');
    const empty = document.getElementById('moreFromCreatorEmpty');
    const skeleton = document.getElementById('moreFromCreatorSkeleton');
    const grid = document.getElementById('moreFromCreatorGrid');
    
    if (!section) return;
    
    section.style.display = 'block';
    if (skeleton) skeleton.style.display = 'none';
    if (grid) grid.style.display = 'none';
    if (empty) {
        empty.style.display = 'block';
        // Update follow button if needed
        const followBtn = document.getElementById('followCreatorFromRail');
        if (followBtn && creatorId) {
            followBtn.style.display = 'inline-flex';
        } else if (followBtn) {
            followBtn.style.display = 'none';
        }
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
    
    // Listen for auth changes
    document.addEventListener('authStateChanged', () => {
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

console.log('✅ More From This Creator Module loaded (Complete fix)');
