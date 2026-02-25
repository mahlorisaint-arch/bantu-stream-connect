// ============================================
// BANTU STREAM CONNECT - MANAGE PROFILES PAGE
// Advanced Features Implementation
// ============================================

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesFeatures() {
  console.log('🎯 Initializing Manage Profiles Features');
  
  // Setup advanced features
  setupSearch();
  setupNotifications();
  setupAnalytics();
  setupVoiceSearch();
  setupWatchParty();
  setupTipSystem();
  setupBadges();
  setupProfileContentSections();
  setupSidebar();
  setupProfileSwitcher();
  setupHeaderProfile();
  
  console.log('✅ Manage Profiles Features Initialized');
}

// ============================================
// SETUP SEARCH
// ============================================
function setupSearch() {
  const searchBtn = document.getElementById('search-btn');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  const languageFilter = document.getElementById('language-filter');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', openSearch);
  }
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      document.getElementById('search-modal')?.classList.remove('active');
    });
  }
  
  if (searchInput) {
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 300);
    });
  }
  
  [categoryFilter, sortFilter, languageFilter].forEach(filter => {
    if (filter) {
      filter.addEventListener('change', () => {
        performSearch(searchInput?.value || '');
      });
    }
  });
}

// ============================================
// OPEN SEARCH
// ============================================
function openSearch() {
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  
  if (searchModal) {
    searchModal.classList.add('active');
    setTimeout(() => searchInput?.focus(), 100);
  }
}

// ============================================
// PERFORM SEARCH
// ============================================
async function performSearch(query) {
  const resultsGrid = document.getElementById('search-results-grid');
  if (!resultsGrid) return;
  
  if (!query.trim()) {
    resultsGrid.innerHTML = `
      <div class="empty-state-small" style="grid-column: 1/-1;">
        <i class="fas fa-search"></i>
        <p>Start typing to search</p>
      </div>
    `;
    return;
  }
  
  resultsGrid.innerHTML = `
    <div class="empty-state-small" style="grid-column: 1/-1;">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Searching...</p>
    </div>
  `;
  
  try {
    const category = document.getElementById('category-filter')?.value;
    const sort = document.getElementById('sort-filter')?.value;
    const language = document.getElementById('language-filter')?.value;
    
    // Build query
    let supabaseQuery = window.supabaseAuth
      .from('content')
      .select('*')
      .ilike('title', `%${query}%`);
    
    if (category) {
      supabaseQuery = supabaseQuery.eq('category', category);
    }
    
    if (language) {
      supabaseQuery = supabaseQuery.eq('language', language);
    }
    
    if (sort === 'popular') {
      supabaseQuery = supabaseQuery.order('views', { ascending: false });
    } else {
      supabaseQuery = supabaseQuery.order('created_at', { ascending: false });
    }
    
    const { data, error } = await supabaseQuery.limit(20);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-state-small" style="grid-column: 1/-1;">
          <i class="fas fa-search"></i>
          <p>No results found for "${escapeHtml(query)}"</p>
        </div>
      `;
      return;
    }
    
    resultsGrid.innerHTML = data.map(item => `
      <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.id}'">
        <div class="thumbnail-image">
          ${item.thumbnail_url
            ? `<img src="${window.contentSupabase.fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;">`
            : `<i class="fas fa-film"></i>`
          }
        </div>
        <div class="thumbnail-info">
          <div class="thumbnail-title">${escapeHtml(item.title)}</div>
          <div class="thumbnail-meta">${item.views || 0} views • ${item.duration || '0:00'}</div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Search error:', error);
    resultsGrid.innerHTML = `
      <div class="empty-state-small" style="grid-column: 1/-1;">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error performing search</p>
      </div>
    `;
  }
}

// ============================================
// SETUP NOTIFICATIONS
// ============================================
function setupNotifications() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllRead = document.getElementById('mark-all-read');
  
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', toggleNotifications);
  }
  
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      document.getElementById('notifications-panel')?.classList.remove('active');
    });
  }
  
  if (markAllRead) {
    markAllRead.addEventListener('click', markAllNotificationsRead);
  }
}

// ============================================
// TOGGLE NOTIFICATIONS
// ============================================
function toggleNotifications() {
  const panel = document.getElementById('notifications-panel');
  if (panel) {
    panel.classList.toggle('active');
    if (panel.classList.contains('active') && typeof renderNotifications === 'function') {
      renderNotifications();
    }
  }
}

// ============================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================
async function markAllNotificationsRead() {
  if (!window.currentUser || !window.notifications) return;
  
  try {
    const unreadIds = window.notifications
      .filter(n => !n.is_read)
      .map(n => n.id);
    
    if (unreadIds.length === 0) {
      showToast('No unread notifications', 'info');
      return;
    }
    
    const { error } = await window.supabaseAuth
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    
    if (error) throw error;
    
    // Update local state
    window.notifications.forEach(n => n.is_read = true);
    
    // Update UI
    updateNotificationBadge(0);
    renderNotifications();
    
    showToast('All notifications marked as read', 'success');
  } catch (error) {
    console.error('Error marking all as read:', error);
    showToast('Failed to mark notifications as read', 'error');
  }
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================
function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (!window.notifications || window.notifications.length === 0) {
    list.innerHTML = `
      <div class="empty-state-small">
        <i class="fas fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = window.notifications.map(notification => `
    <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
      <div class="notification-avatar">
        <i class="fas ${notification.icon || 'fa-bell'}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${escapeHtml(notification.title)}</div>
        <div class="notification-message">${escapeHtml(notification.message)}</div>
        <div class="notification-time">${formatTimeAgo(notification.created_at)}</div>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      await markNotificationAsRead(id);
    });
  });
}

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
async function markNotificationAsRead(id) {
  try {
    const { error } = await window.supabaseAuth
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (error) throw error;
    
    // Update local state
    const notification = window.notifications.find(n => n.id === id);
    if (notification) {
      notification.is_read = true;
    }
    
    // Update badge count
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
    
    // Re-render
    renderNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// ============================================
// FORMAT TIME AGO
// ============================================
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// ============================================
// SETUP ANALYTICS
// ============================================
function setupAnalytics() {
  const analyticsBtn = document.getElementById('analytics-btn');
  const closeAnalytics = document.getElementById('close-analytics');
  
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', openAnalytics);
  }
  
  if (closeAnalytics) {
    closeAnalytics.addEventListener('click', () => {
      document.getElementById('analytics-modal')?.classList.remove('active');
    });
  }
}

// ============================================
// OPEN ANALYTICS
// ============================================
function openAnalytics() {
  if (!window.currentUser) {
    showToast('Please sign in to view analytics', 'warning');
    return;
  }
  
  const modal = document.getElementById('analytics-modal');
  if (modal) {
    modal.classList.add('active');
    if (typeof loadPersonalAnalytics === 'function') {
      loadPersonalAnalytics();
    }
  }
}

// ============================================
// LOAD PERSONAL ANALYTICS
// ============================================
async function loadPersonalAnalytics() {
  if (!window.currentUser) return;
  
  try {
    // Load watch time
    const { data: watchData } = await window.supabaseAuth
      .from('watch_history')
      .select('duration_seconds')
      .eq('user_id', window.currentUser.id);
    
    const totalSeconds = watchData?.reduce((sum, item) => sum + (item.duration_seconds || 0), 0) || 0;
    const hours = Math.floor(totalSeconds / 3600);
    document.getElementById('personal-watch-time').textContent = hours + 'h';
    
    // Load sessions count
    const { count: sessions } = await window.supabaseAuth
      .from('watch_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', window.currentUser.id);
    
    document.getElementById('personal-sessions').textContent = sessions || 0;
    
    // Load total views
    const { count: views } = await window.supabaseAuth
      .from('watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', window.currentUser.id);
    
    document.getElementById('personal-views').textContent = views || 0;
    
    // Calculate return rate (simplified)
    const returnRate = Math.floor(Math.random() * 30) + 40; // Mock data
    document.getElementById('return-rate').textContent = returnRate + '%';
    
    // Initialize chart
    initializeAnalyticsChart();
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// ============================================
// INITIALIZE ANALYTICS CHART
// ============================================
function initializeAnalyticsChart() {
  const canvas = document.getElementById('engagement-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  
  const ctx = canvas.getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Watch Time (minutes)',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#F5F5F5'
          }
        }
      },
      scales: {
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#A0A0A0'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#A0A0A0'
          }
        }
      }
    }
  });
}

// ============================================
// SETUP VOICE SEARCH
// ============================================
function setupVoiceSearch() {
  const voiceBtn = document.getElementById('voice-search-btn');
  const voiceModalBtn = document.getElementById('voice-search-modal-btn');
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    // Voice search not supported
    [voiceBtn, voiceModalBtn].forEach(btn => {
      if (btn) {
        btn.style.display = 'none';
      }
    });
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  
  const startVoiceSearch = () => {
    const status = document.getElementById('voice-search-status');
    const statusText = document.getElementById('voice-status-text');
    
    if (status && statusText) {
      status.classList.add('active');
      statusText.textContent = 'Listening...';
    }
    
    recognition.start();
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const searchInput = document.getElementById('search-input');
    const status = document.getElementById('voice-search-status');
    
    if (searchInput) {
      searchInput.value = transcript;
      performSearch(transcript);
    }
    
    if (status) {
      status.classList.remove('active');
    }
    
    showToast(`"${transcript}"`, 'info');
  };
  
  recognition.onerror = (event) => {
    const status = document.getElementById('voice-search-status');
    if (status) {
      status.classList.remove('active');
    }
    showToast('Voice search failed: ' + event.error, 'error');
  };
  
  recognition.onend = () => {
    const status = document.getElementById('voice-search-status');
    if (status) {
      status.classList.remove('active');
    }
  };
  
  if (voiceBtn) {
    voiceBtn.addEventListener('click', startVoiceSearch);
  }
  
  if (voiceModalBtn) {
    voiceModalBtn.addEventListener('click', startVoiceSearch);
  }
}

// ============================================
// SETUP WATCH PARTY
// ============================================
function setupWatchParty() {
  const watchPartyBtn = document.getElementById('sidebar-watch-party');
  const closeWatchParty = document.getElementById('close-watch-party');
  const startParty = document.getElementById('start-watch-party');
  const searchInput = document.getElementById('watch-party-search');
  
  if (closeWatchParty) {
    closeWatchParty.addEventListener('click', () => {
      document.getElementById('watch-party-modal')?.classList.remove('active');
    });
  }
  
  if (startParty) {
    startParty.addEventListener('click', startWatchParty);
  }
  
  if (searchInput) {
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        loadWatchPartyContent(e.target.value);
      }, 300);
    });
  }
}

// ============================================
// LOAD WATCH PARTY CONTENT
// ============================================
async function loadWatchPartyContent(search = '') {
  const list = document.getElementById('watch-party-content-list');
  if (!list) return;
  
  list.innerHTML = '<div class="empty-state-small"><i class="fas fa-spinner fa-spin"></i><p>Loading content...</p></div>';
  
  try {
    let query = window.supabaseAuth
      .from('content')
      .select('*')
      .limit(10);
    
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      list.innerHTML = '<div class="empty-state-small"><i class="fas fa-film"></i><p>No content found</p></div>';
      return;
    }
    
    list.innerHTML = data.map(item => `
      <div class="watch-party-item" data-id="${item.id}">
        <div class="watch-party-thumb">
          ${item.thumbnail_url
            ? `<img src="${window.contentSupabase.fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;">`
            : `<i class="fas fa-film"></i>`
          }
        </div>
        <div class="watch-party-info">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${item.creator_name || 'Unknown'} • ${item.duration || '0:00'}</p>
        </div>
      </div>
    `).join('');
    
    // Add selection handler
    document.querySelectorAll('.watch-party-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.watch-party-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
    
  } catch (error) {
    console.error('Error loading watch party content:', error);
    list.innerHTML = '<div class="empty-state-small"><i class="fas fa-exclamation-triangle"></i><p>Error loading content</p></div>';
  }
}

// ============================================
// START WATCH PARTY
// ============================================
function startWatchParty() {
  const selected = document.querySelector('.watch-party-item.selected');
  if (!selected) {
    showToast('Please select content to watch', 'warning');
    return;
  }
  
  const contentId = selected.dataset.id;
  const syncPlayback = document.getElementById('party-sync-playback')?.checked;
  const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
  
  // Generate party code
  const partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  showToast(`Watch party created! Code: ${partyCode}`, 'success');
  
  // Close modal
  document.getElementById('watch-party-modal')?.classList.remove('active');
  
  // Navigate to watch page with party params
  setTimeout(() => {
    window.location.href = `watch.html?id=${contentId}&party=${partyCode}&sync=${syncPlayback}&chat=${chatEnabled}`;
  }, 1500);
}

// ============================================
// SETUP TIP SYSTEM
// ============================================
function setupTipSystem() {
  const closeTip = document.getElementById('close-tip');
  const sendTip = document.getElementById('send-tip');
  
  if (closeTip) {
    closeTip.addEventListener('click', () => {
      document.getElementById('tip-modal')?.classList.remove('active');
    });
  }
  
  if (sendTip) {
    sendTip.addEventListener('click', sendTipToCreator);
  }
  
  // Tip amount selection
  document.querySelectorAll('.tip-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

// ============================================
// SEND TIP TO CREATOR
// ============================================
async function sendTipToCreator() {
  if (!window.currentUser) {
    showToast('Please sign in to send tips', 'warning');
    return;
  }
  
  const selectedAmount = document.querySelector('.tip-option.selected');
  if (!selectedAmount) {
    showToast('Please select an amount', 'warning');
    return;
  }
  
  const amount = selectedAmount.dataset.amount;
  const message = document.getElementById('tip-message')?.value;
  
  // Here you would integrate with a payment processor
  showToast(`Thank you for your tip of R${amount}!`, 'success');
  
  // Close modal
  document.getElementById('tip-modal')?.classList.remove('active');
}

// ============================================
// SETUP BADGES
// ============================================
function setupBadges() {
  const badgesBtn = document.getElementById('sidebar-badges');
  const closeBadges = document.getElementById('close-badges');
  
  if (badgesBtn) {
    badgesBtn.addEventListener('click', () => {
      if (!window.currentUser) {
        showToast('Please sign in to view badges', 'warning');
        return;
      }
      document.getElementById('badges-modal')?.classList.add('active');
      loadUserBadges();
    });
  }
  
  if (closeBadges) {
    closeBadges.addEventListener('click', () => {
      document.getElementById('badges-modal')?.classList.remove('active');
    });
  }
}

// ============================================
// LOAD USER BADGES
// ============================================
async function loadUserBadges() {
  const grid = document.getElementById('badges-grid');
  const countEl = document.getElementById('badges-earned');
  
  if (!grid) return;
  
  // Mock badges data
  const badges = [
    { id: 1, name: 'First Watch', description: 'Watched your first video', icon: 'fa-play', earned: true },
    { id: 2, name: 'Early Adopter', description: 'Joined in the first month', icon: 'fa-rocket', earned: true },
    { id: 3, name: 'Super Fan', description: 'Watched 100 hours', icon: 'fa-heart', earned: false },
    { id: 4, name: 'Social Butterfly', description: 'Shared 10 videos', icon: 'fa-share-alt', earned: false },
    { id: 5, name: 'Commentator', description: 'Posted 50 comments', icon: 'fa-comment', earned: false },
    { id: 6, name: 'Creator', description: 'Uploaded your first video', icon: 'fa-video', earned: false }
  ];
  
  const earned = badges.filter(b => b.earned).length;
  if (countEl) countEl.textContent = earned;
  
  grid.innerHTML = badges.map(badge => `
    <div class="badge-item ${badge.earned ? '' : 'locked'}">
      <div class="badge-icon">
        <i class="fas ${badge.icon}"></i>
      </div>
      <div class="badge-name">${badge.name}</div>
      <div class="badge-description">${badge.description}</div>
    </div>
  `).join('');
}

// ============================================
// SETUP PROFILE CONTENT SECTIONS
// ============================================
function setupProfileContentSections() {
  // This would be called when viewing a specific profile
  if (window.currentProfile) {
    loadProfileFavorites();
    loadProfileWatchHistory();
  }
}

// ============================================
// LOAD PROFILE FAVORITES
// ============================================
async function loadProfileFavorites() {
  const container = document.getElementById('profile-favorites');
  if (!container || !window.currentProfile) return;
  
  try {
    const { data, error } = await window.supabaseAuth
      .from('favorites')
      .select('*, content:content_id(*)')
      .eq('user_id', window.currentProfile.id)
      .limit(10);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small">
          <i class="fas fa-heart"></i>
          <p>No favorites yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.map(item => `
      <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.content_id}'">
        <div class="thumbnail-image">
          ${item.content?.thumbnail_url
            ? `<img src="${window.contentSupabase.fixMediaUrl(item.content.thumbnail_url)}" alt="${escapeHtml(item.content.title)}" style="width:100%;height:100%;object-fit:cover;">`
            : `<i class="fas fa-film"></i>`
          }
        </div>
        <div class="thumbnail-info">
          <div class="thumbnail-title">${escapeHtml(item.content?.title || 'Unknown')}</div>
          <div class="thumbnail-meta">Added ${formatTimeAgo(item.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}

// ============================================
// LOAD PROFILE WATCH HISTORY
// ============================================
async function loadProfileWatchHistory() {
  const container = document.getElementById('profile-history');
  if (!container || !window.currentProfile) return;
  
  try {
    const { data, error } = await window.supabaseAuth
      .from('watch_history')
      .select('*, content:content_id(*)')
      .eq('user_id', window.currentProfile.id)
      .order('watched_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state-small">
          <i class="fas fa-history"></i>
          <p>No watch history yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = data.map(item => `
      <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.content_id}'">
        <div class="thumbnail-image">
          ${item.content?.thumbnail_url
            ? `<img src="${window.contentSupabase.fixMediaUrl(item.content.thumbnail_url)}" alt="${escapeHtml(item.content.title)}" style="width:100%;height:100%;object-fit:cover;">`
            : `<i class="fas fa-film"></i>`
          }
        </div>
        <div class="thumbnail-info">
          <div class="thumbnail-title">${escapeHtml(item.content?.title || 'Unknown')}</div>
          <div class="thumbnail-meta">Watched ${formatTimeAgo(item.watched_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading watch history:', error);
  }
}

// ============================================
// SETUP SIDEBAR
// ============================================
function setupSidebar() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;
  
  const openSidebar = () => {
    sidebarMenu.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  
  const closeSidebar = () => {
    sidebarMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    openSidebar();
  });
  
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
      closeSidebar();
    }
  });
  
  updateSidebarProfile();
  setupSidebarNavigation();
  setupSidebarThemeToggle();
  setupSidebarScaleControls();
}

// ============================================
// UPDATE SIDEBAR PROFILE
// ============================================
function updateSidebarProfile() {
  const avatar = document.getElementById('sidebar-profile-avatar');
  const name = document.getElementById('sidebar-profile-name');
  const email = document.getElementById('sidebar-profile-email');
  const profileSection = document.getElementById('sidebar-profile');
  
  if (!avatar || !name || !email) return;
  
  if (window.currentUser) {
    window.supabaseAuth.from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle()
      .then(({ data: profile }) => {
        if (profile) {
          name.textContent = profile.full_name || profile.username || 'User';
          email.textContent = window.currentUser.email;
          
          if (profile.avatar_url) {
            avatar.innerHTML = `<img src="${window.contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          } else {
            const initials = getInitials(profile.full_name || profile.username);
            avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
          }
        } else {
          const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : '?';
          avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
          name.textContent = window.currentUser.email?.split('@')[0] || 'User';
          email.textContent = window.currentUser.email || 'Signed in';
        }
      });
    
    if (profileSection) {
      profileSection.addEventListener('click', () => {
        closeSidebar();
        window.location.href = 'manage-profiles.html';
      });
    }
  } else {
    name.textContent = 'Guest';
    email.textContent = 'Sign in to continue';
    avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;"></i>';
    
    if (profileSection) {
      profileSection.addEventListener('click', () => {
        closeSidebar();
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      });
    }
  }
}

// ============================================
// SETUP SIDEBAR NAVIGATION
// ============================================
function setupSidebarNavigation() {
  document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    if (!window.currentUser) {
      showToast('Please sign in to view analytics', 'warning');
      return;
    }
    const analyticsModal = document.getElementById('analytics-modal');
    if (analyticsModal) {
      analyticsModal.classList.add('active');
      if (typeof loadPersonalAnalytics === 'function') {
        loadPersonalAnalytics();
      }
    }
  });
  
  document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    const notificationsPanel = document.getElementById('notifications-panel');
    if (notificationsPanel) {
      notificationsPanel.classList.add('active');
      if (typeof renderNotifications === 'function') {
        renderNotifications();
      }
    }
  });
  
  document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    if (!window.currentUser) {
      showToast('Please sign in to view badges', 'warning');
      return;
    }
    const badgesModal = document.getElementById('badges-modal');
    if (badgesModal) {
      badgesModal.classList.add('active');
      if (typeof loadUserBadges === 'function') {
        loadUserBadges();
      }
    }
  });
  
  document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    if (!window.currentUser) {
      showToast('Please sign in to start a watch party', 'warning');
      return;
    }
    const watchPartyModal = document.getElementById('watch-party-modal');
    if (watchPartyModal) {
      watchPartyModal.classList.add('active');
      if (typeof loadWatchPartyContent === 'function') {
        loadWatchPartyContent();
      }
    }
  });
  
  document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    const { data } = await window.supabaseAuth.auth.getSession();
    if (!data?.session) {
      showToast('Please sign in to upload content', 'warning');
      window.location.href = `login.html?redirect=creator-upload.html`;
    } else {
      window.location.href = 'creator-upload.html';
    }
  });
  
  document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    const { data } = await window.supabaseAuth.auth.getSession();
    if (!data?.session) {
      showToast('Please sign in to access dashboard', 'warning');
      window.location.href = `login.html?redirect=creator-dashboard.html`;
    } else {
      window.location.href = 'creator-dashboard.html';
    }
  });
}

// ============================================
// SETUP SIDEBAR THEME TOGGLE
// ============================================
function setupSidebarThemeToggle() {
  const themeToggle = document.getElementById('sidebar-theme-toggle');
  if (!themeToggle) return;
  
  themeToggle.addEventListener('click', () => {
    closeSidebar();
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
      themeSelector.classList.toggle('active');
    }
  });
}

// ============================================
// SETUP SIDEBAR SCALE CONTROLS
// ============================================
function setupSidebarScaleControls() {
  if (!window.uiScaleController) return;
  
  const decreaseBtn = document.getElementById('sidebar-scale-decrease');
  const increaseBtn = document.getElementById('sidebar-scale-increase');
  const resetBtn = document.getElementById('sidebar-scale-reset');
  const scaleValue = document.getElementById('sidebar-scale-value');
  
  const updateDisplay = () => {
    if (scaleValue) {
      scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
    }
  };
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      window.uiScaleController.decrease();
      updateDisplay();
    });
  }
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      window.uiScaleController.increase();
      updateDisplay();
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.uiScaleController.reset();
      updateDisplay();
    });
  }
  
  updateDisplay();
  
  document.addEventListener('scaleChanged', updateDisplay);
}

// ============================================
// CLOSE SIDEBAR
// ============================================
function closeSidebar() {
  const sidebarMenu = document.getElementById('sidebar-menu');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  
  if (sidebarMenu && sidebarOverlay) {
    sidebarMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================
// SETUP PROFILE SWITCHER
// ============================================
function setupProfileSwitcher() {
  const profileBtn = document.getElementById('current-profile-btn');
  const dropdown = document.getElementById('profile-dropdown');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (profileBtn && dropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseAuth.auth.signOut();
      window.currentUser = null;
      window.currentProfile = null;
      window.userProfiles = [];
      localStorage.removeItem('currentProfileId');
      showToast('Signed out successfully', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    });
  }
  
  updateProfileSwitcher();
}

// ============================================
// UPDATE PROFILE SWITCHER
// ============================================
function updateProfileSwitcher() {
  const profileList = document.getElementById('profile-list');
  const currentProfileName = document.getElementById('current-profile-name');
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  
  if (!profileList || !currentProfileName || !profilePlaceholder) return;
  
  if (window.currentProfile) {
    currentProfileName.textContent = window.currentProfile.full_name || window.currentProfile.name || 'Profile';
    
    while (profilePlaceholder.firstChild) {
      profilePlaceholder.removeChild(profilePlaceholder.firstChild);
    }
    
    if (window.currentProfile.avatar_url) {
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.src = window.contentSupabase.fixMediaUrl(window.currentProfile.avatar_url);
      img.alt = window.currentProfile.full_name || 'Profile';
      img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
      profilePlaceholder.appendChild(img);
    } else {
      const initials = getInitials(window.currentProfile.full_name || window.currentProfile.name);
      const div = document.createElement('div');
      div.className = 'profile-placeholder';
      div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
      div.textContent = initials;
      profilePlaceholder.appendChild(div);
    }
  }
  
  profileList.innerHTML = (window.userProfiles || []).map(profile => {
    const initials = getInitials(profile.full_name || profile.name);
    const isActive = window.currentProfile?.id === profile.id;
    
    return `
      <div class="profile-item ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
        <div class="profile-avatar-small">
          ${profile.avatar_url
            ? `<img src="${window.contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="${escapeHtml(profile.full_name || profile.name)}">`
            : `<div class="profile-initials">${initials}</div>`
          }
        </div>
        <span class="profile-name">${escapeHtml(profile.full_name || profile.name)}</span>
        ${isActive ? '<i class="fas fa-check"></i>' : ''}
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.profile-item').forEach(item => {
    item.addEventListener('click', async () => {
      const profileId = item.dataset.profileId;
      const profile = window.userProfiles.find(p => p.id === profileId);
      
      if (profile) {
        window.currentProfile = profile;
        localStorage.setItem('currentProfileId', profileId);
        updateProfileSwitcher();
        updateHeaderProfile();
        showToast(`Switched to ${profile.full_name || profile.name}`, 'success');
      }
    });
  });
}

// ============================================
// UPDATE HEADER PROFILE
// ============================================
async function updateHeaderProfile() {
  try {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const currentProfileName = document.getElementById('current-profile-name');
    
    if (!profilePlaceholder || !currentProfileName) return;
    
    if (window.currentUser) {
      const { data: profile } = await window.supabaseAuth
        .from('user_profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .maybeSingle();
      
      if (profile) {
        profilePlaceholder.innerHTML = '';
        
        if (profile.avatar_url) {
          const img = document.createElement('img');
          img.className = 'profile-img';
          img.src = window.contentSupabase.fixMediaUrl(profile.avatar_url);
          img.alt = profile.full_name || 'Profile';
          img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
          profilePlaceholder.appendChild(img);
        } else {
          const initials = getInitials(profile.full_name || profile.username || 'User');
          const div = document.createElement('div');
          div.className = 'profile-placeholder';
          div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
          div.textContent = initials;
          profilePlaceholder.appendChild(div);
        }
        
        currentProfileName.textContent = profile.full_name || profile.username || 'Profile';
      } else {
        const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : 'U';
        profilePlaceholder.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'profile-placeholder';
        div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
        div.textContent = initials;
        profilePlaceholder.appendChild(div);
        currentProfileName.textContent = window.currentUser.email?.split('@')[0] || 'User';
      }
    } else {
      profilePlaceholder.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'profile-placeholder';
      div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
      div.textContent = 'G';
      profilePlaceholder.appendChild(div);
      currentProfileName.textContent = 'Guest';
    }
  } catch (error) {
    console.error('Error updating header profile:', error);
  }
}

// ============================================
// EXPORT FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.initializeManageProfilesFeatures = initializeManageProfilesFeatures;
window.setupSearch = setupSearch;
window.openSearch = openSearch;
window.performSearch = performSearch;
window.setupNotifications = setupNotifications;
window.toggleNotifications = toggleNotifications;
window.renderNotifications = renderNotifications;
window.loadPersonalAnalytics = loadPersonalAnalytics;
window.setupAnalytics = setupAnalytics;
window.openAnalytics = openAnalytics;
window.setupVoiceSearch = setupVoiceSearch;
window.setupWatchParty = setupWatchParty;
window.loadWatchPartyContent = loadWatchPartyContent;
window.startWatchParty = startWatchParty;
window.setupTipSystem = setupTipSystem;
window.sendTipToCreator = sendTipToCreator;
window.setupBadges = setupBadges;
window.loadUserBadges = loadUserBadges;
window.setupSidebar = setupSidebar;
window.closeSidebar = closeSidebar;
window.setupProfileSwitcher = setupProfileSwitcher;
window.updateProfileSwitcher = updateProfileSwitcher;
window.updateHeaderProfile = updateHeaderProfile;
window.formatTimeAgo = formatTimeAgo;
