/**
 * content-library-features.js - Feature-specific functionality for Content Library
 * Bantu Stream Connect
 */

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Load user notifications
 */
async function loadNotifications() {
    try {
        if (!currentUser) {
            updateNotificationBadge(0);
            return;
        }
        
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        notifications = data || [];
        const unreadCount = notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
}

/**
 * Update notification badge
 * @param {number} count - Unread count
 */
function updateNotificationBadge(count) {
    const mainBadge = document.getElementById('notification-count');
    const navBadge = document.getElementById('nav-notification-count');
    
    [mainBadge, navBadge].forEach(badge => {
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    });
}

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

// ============================================================================
// SEARCH FUNCTIONALITY
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
 */
function updateAnalytics() {
    const totalViews = allContentData.reduce((sum, item) => sum + (item.real_views || 0), 0);
    const totalContent = allContentData.length;
    const activeCreators = new Set(allContentData.map(item => item.user_id)).size;
    
    document.getElementById('total-views').textContent = formatNumber(totalViews);
    document.getElementById('total-content').textContent = totalContent;
    document.getElementById('active-creators').textContent = activeCreators;
    
    // Calculate engagement rate
    const totalEngagement = allContentData.reduce((sum, item) => sum + (item.real_likes || 0), 0);
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
 */
async function markAllNotificationsRead() {
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
// FEATURE EVENT LISTENERS SETUP
// ============================================================================

/**
 * Setup feature-specific event listeners
 */
function setupFeatureEventListeners() {
    // Search button and modal
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    
    if (searchBtn && searchModal) {
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
    
    // Notifications button and panel
    const notificationsBtn = document.getElementById('notifications-btn');
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    
    if (notificationsBtn && notificationsPanel) {
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
    }
    
    // Mark all as read
    const markAllRead = document.getElementById('mark-all-read');
    if (markAllRead) {
        markAllRead.addEventListener('click', markAllNotificationsRead);
    }
    
    // Analytics button and modal
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (analyticsBtn && analyticsModal) {
        analyticsBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                showToast('Please sign in to view analytics', 'warning');
                return;
            }
            
            analyticsModal.classList.add('active');
            updateAnalytics();
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
    
    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'profile.html';
            } else {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            }
        });
    }
    
    // Back to top
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        window.addEventListener('scroll', () => {
            backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        });
    }
    
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
    
    // Browse all button
    const browseAllBtn = document.getElementById('browse-all-btn');
    if (browseAllBtn) {
        browseAllBtn.addEventListener('click', () => {
            if (allContentData.length > 0) {
                window.location.href = `content-detail.html?id=${allContentData[0].id}`;
            }
        });
    }
    
    // See all buttons (delegated)
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) {
            const action = e.target.closest('[data-action]').dataset.action;
            showToast(`Viewing all ${action.replace('view-all-', '')} content`, 'info');
        }
    });
}
