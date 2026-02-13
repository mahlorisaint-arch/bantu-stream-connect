/**
 * CONTENT LIBRARY - FEATURES MODULE
 * Bantu Stream Connect
 * 
 * Handles search, analytics, notifications, theme switching, and event listeners
 */

import { 
    showToast, 
    formatNumber, 
    escapeHtml, 
    truncateText, 
    fixMediaUrl,
    debounce,
    updateNotificationBadge
} from './content-library.js';

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentUser = null;
let allContentData = [];
let notifications = [];

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

/**
 * Initialize search functionality
 */
export function initSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    
    if (!searchBtn || !searchModal) return;
    
    searchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 300);
    });
    
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        });
    }
    
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        }
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const category = document.getElementById('category-filter')?.value;
            const sortBy = document.getElementById('sort-filter')?.value;
            
            if (query.length < 2) {
                document.getElementById('search-results-grid').innerHTML = 
                    '<div class="no-results">Start typing to search...</div>';
                return;
            }
            
            document.getElementById('search-results-grid').innerHTML = 
                '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
            
            const results = await searchContent(query, category, sortBy);
            renderSearchResults(results);
        }, 300));
    }
    
    document.getElementById('category-filter')?.addEventListener('change', () => {
        if (searchInput) searchInput.dispatchEvent(new Event('input'));
    });
    
    document.getElementById('sort-filter')?.addEventListener('change', () => {
        if (searchInput) searchInput.dispatchEvent(new Event('input'));
    });
}

/**
 * Search content from Supabase
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

// ============================================
// NOTIFICATIONS PANEL
// ============================================

/**
 * Initialize notifications panel
 */
export function initNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    
    if (!notificationsBtn || !notificationsPanel) return;
    
    const openNotifications = () => {
        notificationsPanel.classList.add('active');
        renderNotifications();
    };
    
    notificationsBtn.addEventListener('click', openNotifications);
    if (navNotificationsBtn) {
        navNotificationsBtn.addEventListener('click', openNotifications);
    }
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            notificationsPanel.classList.remove('active');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (notificationsPanel.classList.contains('active') && 
            !notificationsPanel.contains(e.target) && 
            !notificationsBtn.contains(e.target) && 
            (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
            notificationsPanel.classList.remove('active');
        }
    });
    
    // Mark all as read
    const markAllRead = document.getElementById('mark-all-read');
    if (markAllRead) {
        markAllRead.addEventListener('click', async () => {
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
        });
    }
}

/**
 * Render notifications in panel
 */
function renderNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    if (!currentUser) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>Sign in to see notifications</p>
            </div>
        `;
        return;
    }
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
            <div class="notification-icon">
                <i class="${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${escapeHtml(notification.title)}</h4>
                <p>${escapeHtml(notification.message)}</p>
                <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
            </div>
            ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
        </div>
    `).join('');
}

/**
 * Get notification icon based on type
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

// ============================================
// ANALYTICS MODAL
// ============================================

/**
 * Initialize analytics modal
 */
export function initAnalytics(contentData) {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !analyticsModal) return;
    
    analyticsBtn.addEventListener('click', async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            showToast('Please sign in to view analytics', 'warning');
            return;
        }
        
        analyticsModal.classList.add('active');
        
        // Load analytics data
        document.getElementById('total-views').textContent = formatNumber(
            contentData.reduce((sum, item) => sum + (item.real_views || 0), 0)
        );
        document.getElementById('total-content').textContent = contentData.length;
        document.getElementById('active-creators').textContent = 
            new Set(contentData.map(item => item.user_id)).size;
    });
    
    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', () => {
            analyticsModal.classList.remove('active');
        });
    }
    
    analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) {
            analyticsModal.classList.remove('active');
        }
    });
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

/**
 * Initialize navigation buttons
 */
export function initNavigation() {
    // Home button
    const homeBtn = document.getElementById('nav-home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Create button
    const createBtn = document.getElementById('nav-create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            }
        });
    }
    
    // Dashboard button
    const dashboardBtn = document.getElementById('nav-dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'creator-dashboard.html';
            } else {
                showToast('Please sign in to access dashboard', 'warning');
                window.location.href = `login.html?redirect=creator-dashboard.html`;
            }
        });
    }
}

// ============================================
// BACK TO TOP BUTTON
// ============================================

/**
 * Initialize back to top button
 */
export function initBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    window.addEventListener('scroll', () => {
        backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    });
}

// ============================================
// PROFILE BUTTON
// ============================================

/**
 * Initialize profile button
 */
export function initProfileButton() {
    const profileBtn = document.getElementById('profile-btn');
    if (!profileBtn) return;
    
    profileBtn.addEventListener('click', async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'profile.html';
        } else {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }
    });
}

// ============================================
// SEE ALL BUTTONS
// ============================================

/**
 * Initialize see all buttons (delegated)
 */
export function initSeeAllButtons() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) {
            const action = e.target.closest('[data-action]').dataset.action;
            showToast(`Viewing all ${action.replace('view-all-', '')} content`, 'info');
        }
    });
}

// ============================================
// BROWSE ALL BUTTON
// ============================================

/**
 * Initialize browse all button
 */
export function initBrowseAllButton(contentData) {
    const browseAllBtn = document.getElementById('browse-all-btn');
    if (!browseAllBtn) return;
    
    browseAllBtn.addEventListener('click', () => {
        if (contentData.length > 0) {
            window.location.href = `content-detail.html?id=${contentData[0].id}`;
        }
    });
}

// ============================================
// SETUP ALL EVENT LISTENERS
// ============================================

/**
 * Initialize all feature event listeners
 */
export function setupFeatureEventListeners(contentData, userData, notificationData) {
    allContentData = contentData;
    currentUser = userData;
    notifications = notificationData;
    
    initSearch();
    initNotifications();
    initAnalytics(contentData);
    initNavigation();
    initBackToTop();
    initProfileButton();
    initSeeAllButtons();
    initBrowseAllButton(contentData);
}
