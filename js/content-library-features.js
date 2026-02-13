/**
 * Feature Module
 * Handles search, notifications, analytics, and utility functions
 */

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

// Search content with filters
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
        
        return { 
          ...item, 
          real_views: viewsCount || 0, 
          real_likes: likesCount || 0 
        };
      })
    );
    
    // Additional sorting for popularity/trending
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

// Render search results into the grid
function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const creator = item.user_profiles?.full_name || 
                    item.user_profiles?.username || 
                    item.creator || 
                    'Creator';
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
  
  // Add click handlers to cards
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.creator-btn')) return;
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// Setup search modal functionality
function setupSearch() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  
  if (!searchBtn || !searchModal) return;
  
  // Open search modal
  searchBtn.addEventListener('click', () => {
    searchModal.classList.add('active');
    setTimeout(() => searchInput?.focus(), 300);
  });
  
  // Close search modal
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    });
  }
  
  // Close when clicking outside modal content
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    }
  });
  
  // Live search with debounce
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      const category = document.getElementById('category-filter')?.value;
      const sortBy = document.getElementById('sort-filter')?.value;
      
      const resultsGrid = document.getElementById('search-results-grid');
      if (!resultsGrid) return;
      
      if (query.length < 2) {
        resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
        return;
      }
      
      resultsGrid.innerHTML = `
        <div class="infinite-scroll-loading">
          <div class="infinite-scroll-spinner"></div>
          <div>Searching...</div>
        </div>
      `;
      
      const results = await searchContent(query, category, sortBy);
      renderSearchResults(results);
    }, 300));
  }
  
  // Filter change triggers search
  document.getElementById('category-filter')?.addEventListener('change', () => {
    if (searchInput && searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
  
  document.getElementById('sort-filter')?.addEventListener('change', () => {
    if (searchInput && searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
}

// ============================================
// NOTIFICATIONS FUNCTIONALITY
// ============================================

// Load user notifications from database
async function loadNotifications() {
  try {
    if (!window.currentUser) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    window.notifications = data || [];
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

// Update notification badge counts in UI
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

// Render notifications in the panel
function renderNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  if (!window.currentUser) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>Sign in to see notifications</p>
      </div>
    `;
    return;
  }
  
  if (!window.notifications || window.notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }
  
  notificationsList.innerHTML = window.notifications.map(notification => `
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

// Get appropriate icon based on notification type
function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    default: return 'fas fa-bell';
  }
}

// Setup notifications panel functionality
function setupNotifications() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const navNotificationsBtn = document.getElementById('nav-notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllRead = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  // Open notifications panel
  const openNotifications = () => {
    notificationsPanel.classList.add('active');
    renderNotifications();
  };
  
  notificationsBtn.addEventListener('click', openNotifications);
  if (navNotificationsBtn) {
    navNotificationsBtn.addEventListener('click', openNotifications);
  }
  
  // Close notifications panel
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      notificationsPanel.classList.remove('active');
    });
  }
  
  // Close when clicking outside panel
  document.addEventListener('click', (e) => {
    if (notificationsPanel.classList.contains('active') &&
        !notificationsPanel.contains(e.target) &&
        !notificationsBtn.contains(e.target) &&
        (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
      notificationsPanel.classList.remove('active');
    }
  });
  
  // Mark all notifications as read
  if (markAllRead) {
    markAllRead.addEventListener('click', async () => {
      if (!window.currentUser) return;
      
      try {
        const { error } = await window.supabaseClient
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', window.currentUser.id)
          .eq('is_read', false);
        
        if (error) throw error;
        
        if (window.notifications) {
          window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
        }
        
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

// ============================================
// ANALYTICS FUNCTIONALITY
// ============================================

// Setup analytics modal functionality
function setupAnalytics() {
  const analyticsBtn = document.getElementById('analytics-btn');
  const analyticsModal = document.getElementById('analytics-modal');
  const closeAnalytics = document.getElementById('close-analytics');
  
  if (!analyticsBtn || !analyticsModal) return;
  
  // Open analytics modal
  analyticsBtn.addEventListener('click', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      showToast('Please sign in to view analytics', 'warning');
      return;
    }
    
    analyticsModal.classList.add('active');
    
    // Load analytics data if content is available
    if (window.allContentData && window.allContentData.length > 0) {
      document.getElementById('total-views').textContent = formatNumber(
        window.allContentData.reduce((sum, item) => sum + (item.real_views || 0), 0)
      );
      
      document.getElementById('total-content').textContent = window.allContentData.length;
      
      document.getElementById('active-creators').textContent = 
        new Set(window.allContentData.map(item => item.user_id)).size;
    }
  });
  
  // Close analytics modal
  if (closeAnalytics) {
    closeAnalytics.addEventListener('click', () => {
      analyticsModal.classList.remove('active');
    });
  }
  
  // Close when clicking outside modal content
  analyticsModal.addEventListener('click', (e) => {
    if (e.target === analyticsModal) {
      analyticsModal.classList.remove('active');
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    error: 'fa-exclamation-triangle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format large numbers (1k, 1M)
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format notification timestamp
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

// Debounce function for search/input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Setup back to top button
function setupBackToTop() {
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (!backToTopBtn) return;
  
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  window.addEventListener('scroll', () => {
    backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
  });
}

// Initialize all feature modules
function initFeatures() {
  setupSearch();
  setupNotifications();
  setupAnalytics();
  setupBackToTop();
  setupThemeListeners();
}
