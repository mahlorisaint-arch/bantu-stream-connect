/**
 * content-library-features.js - Feature-specific functionality for Content Library
 * Bantu Stream Connect
 */

// This file contains the feature-specific functions that were defined in the original HTML
// These functions are called from the main content-library.js file

// Note: The functions in this file rely on variables and functions defined in content-library.js
// They should be included after content-library.js in the HTML

// ============================================================================
// NOTIFICATION FUNCTIONS (additional)
// ============================================================================

/**
 * Get notification icon based on type
 * @param {string} type - Notification type
 * @returns {string} Font Awesome icon class
 */
function getNotificationIcon(type) {
    switch(type) {
        case 'like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'follow': return 'fas fa-user-plus';
        default: return 'fas fa-bell';
    }
}

/**
 * Format notification time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time
 */
function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// SEARCH FUNCTIONALITY (additional)
// ============================================================================

/**
 * Search content
 * @param {string} query - Search query
 * @param {string} category - Category filter
 * @param {string} sortBy - Sort option
 * @returns {Promise<Array>} Search results
 */
async function searchContent(query, category = '', sortBy = 'newest') {
    try {
        let queryBuilder = window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published');
        
        if (category) {
            queryBuilder = queryBuilder.eq('genre', category);
        }
        
        if (sortBy === 'newest') {
            queryBuilder = queryBuilder.order('created_at', { ascending: false });
        } else if (sortBy === 'popular') {
            // Will sort by views after fetching
        }
        
        const { data, error } = await queryBuilder.limit(50);
        
        if (error) throw error;
        
        // Enrich with real counts
        const enriched = await Promise.all(
            (data || []).map(async (item) => {
                const { count: viewsCount } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                const { count: likesCount } = await window.supabaseClient
                    .from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                return { ...item, real_views: viewsCount || 0, real_likes: likesCount || 0 };
            })
        );
        
        // Sort by popularity if needed
        if (sortBy === 'popular') {
            enriched.sort((a, b) => (b.real_views || 0) - (a.real_views || 0));
        } else if (sortBy === 'trending') {
            enriched.sort((a, b) => {
                const aScore = (a.real_views || 0) + ((a.real_likes || 0) * 2);
                const bScore = (b.real_views || 0) + ((b.real_likes || 0) * 2);
                return bScore - aScore;
            });
        }
        
        return enriched;
        
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

/**
 * Render search results
 * @param {Array} results - Search results
 */
function renderSearchResults(results) {
    const grid = document.getElementById('search-results-grid');
    if (!grid) return;
    
    if (!results || results.length === 0) {
        grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
        return;
    }
    
    grid.innerHTML = results.map(item => {
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
        const creatorId = item.user_profiles?.id || item.user_id;
        
        return `
            <div class="content-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${fixMediaUrl(item.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${escapeHtml(item.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <button class="creator-btn" 
                            onclick="event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
                        <i class="fas fa-user"></i>
                        ${truncateText(creator, 15)}
                    </button>
                    <div class="card-stats">
                        <div class="card-stat">
                            <i class="fas fa-eye"></i>
                            ${formatNumber(item.real_views || 0)}
                        </div>
                        <div class="card-stat">
                            <i class="fas fa-heart"></i>
                            ${formatNumber(item.real_likes || 0)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.creator-btn')) return;
            const id = card.dataset.contentId;
            if (id) window.location.href = `content-detail.html?id=${id}`;
        });
    });
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Update analytics modal with data
 * @param {Array} contentData - All content data
 */
function updateAnalytics(contentData) {
    const totalViews = contentData.reduce((sum, item) => sum + (item.real_views || 0), 0);
    const totalContent = contentData.length;
    const activeCreators = new Set(contentData.map(item => item.user_id)).size;
    
    document.getElementById('total-views').textContent = formatNumber(totalViews);
    document.getElementById('total-content').textContent = totalContent;
    document.getElementById('active-creators').textContent = activeCreators;
    
    // Calculate engagement rate
    const totalEngagement = contentData.reduce((sum, item) => sum + (item.real_likes || 0), 0);
    const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(1) : '0.0';
    document.getElementById('engagement-rate').textContent = engagementRate + '%';
    
    // Update trends (simulated)
    document.getElementById('views-trend').textContent = '+12%';
    document.getElementById('content-trend').textContent = '+8%';
    document.getElementById('creators-trend').textContent = '+15%';
    document.getElementById('engagement-trend').textContent = '+5%';
}

// ============================================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================================

/**
 * Mark all notifications as read
 * @param {Object} currentUser - Current user object
 * @param {Array} notifications - Notifications array
 * @returns {Promise<void>}
 */
async function markAllNotificationsRead(currentUser, notifications) {
    if (!currentUser) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        notifications = notifications.map(n => ({ ...n, is_read: true }));
        renderNotifications();
        updateNotificationBadge(0);
        showToast('All notifications marked as read', 'success');
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
    }
}

// ============================================================================
// FEATURE-SPECIFIC EVENT LISTENERS SETUP
// ============================================================================

/**
 * Setup feature-specific event listeners
 * This function should be called after the main initialization
 */
function setupFeatureEventListeners() {
    // This function is implemented in the main content-library.js
    // but we're keeping it here for completeness
    console.log('Feature event listeners setup');
}

// Export functions for use in other files
window.features = {
    getNotificationIcon,
    formatNotificationTime,
    searchContent,
    renderSearchResults,
    updateAnalytics,
    markAllNotificationsRead
};
