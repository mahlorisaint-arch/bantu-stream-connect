// ============================================
// SHORTS DETAIL JAVASCRIPT - BANTU STREAM CONNECT
// ============================================

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Global state
let supabaseClient = null;
let currentUser = null;
let shortsData = [];
let currentShort = null;
let currentVideo = null;
let isMuted = false;
let isPlaying = true;
let userConnections = new Set();
let moreMenuOpen = false;
let lastTapTime = 0;
let connectionFailed = false;
let swiperInstance = null;
let initTimeout = null;
let authCheckComplete = false;
let hasRecordedView = false; // Track if view has been recorded for current video

// Loading progress tracking
let loadingProgress = 0;
const loadingSteps = [
  { name: 'Initializing...', progress: 10 },
  { name: 'Checking connection...', progress: 25 },
  { name: 'Loading shorts...', progress: 50 },
  { name: 'Almost ready...', progress: 75 },
  { name: 'Starting player...', progress: 90 }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 DOMContentLoaded - Starting initialization');
  updateLoadingProgress('Initializing...', 10);
  
  // Set timeout for initialization
  initTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      console.warn('⚠️ Initialization timeout - showing fallback');
      connectionFailed = true;
      hideLoadingScreen(true, 'Connection timeout. Showing offline content.');
    }
  }, 8000);
  
  initSupabase();
});

// Update loading progress
function updateLoadingProgress(text, progress) {
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('loading-progress-bar');
  
  if (loadingText) loadingText.textContent = text;
  if (progressBar) progressBar.style.width = progress + '%';
  loadingProgress = progress;
}

// Initialize Supabase
function initSupabase() {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: localStorage
      },
      global: {
        headers: { 'apikey': SUPABASE_ANON_KEY }
      }
    });
    console.log('✅ Supabase client initialized');
    
    updateLoadingProgress('Checking connection...', 25);
    
    // Test connection with timeout
    testConnection();
    
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    connectionFailed = true;
    useFallbackData();
  }
}

// Test Supabase connection
async function testConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const { error } = await supabaseClient
      .from('Content')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('❌ Connection test failed:', error);
      connectionFailed = true;
      useFallbackData();
    } else {
      console.log('✅ Connection test passed');
      connectionFailed = false;
      checkAuth();
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    connectionFailed = true;
    useFallbackData();
  }
}

// Check authentication
async function checkAuth() {
  updateLoadingProgress('Checking authentication...', 35);
  
  try {
    const authPromise = supabaseClient.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    );
    
    const result = await Promise.race([authPromise, timeoutPromise]);
    const session = result?.data?.session;
    
    currentUser = session?.user || null;
    console.log('✅ Auth state:', currentUser ? 'signed in' : 'guest');
    
    authCheckComplete = true;
    clearTimeout(initTimeout);
    
    if (currentUser) {
      updateLoadingProgress('Loading profile...', 45);
      await loadUserProfilePicture(currentUser);
      await loadUserNotifications(); // Load notifications for logged-in user
      await fetchUserConnections();
    }
    
    // Load shorts
    loadShorts();
    
  } catch (error) {
    console.warn('⚠️ Auth check failed, continuing as guest:', error);
    currentUser = null;
    authCheckComplete = true;
    clearTimeout(initTimeout);
    loadShorts();
  }
}

// Load shorts from Supabase
async function loadShorts() {
  updateLoadingProgress('Loading shorts...', 50);
  
  try {
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .or('media_type.eq.short,duration.lte.60')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      shortsData = data;
      console.log(`✅ Loaded ${shortsData.length} shorts`);
      
      // Cache the data
      try {
        localStorage.setItem('shorts_cache', JSON.stringify({
          data: shortsData,
          timestamp: Date.now()
        }));
      } catch (e) {}
      
      updateLoadingProgress('Loading interactions...', 75);
      await loadLikeCounts();
      
      updateLoadingProgress('Rendering...', 90);
      renderShorts();
      
      setTimeout(() => {
        initSwiper();
        hideLoadingScreen();
      }, 500);
      
    } else {
      console.log('No shorts found, using fallback');
      useFallbackData();
    }
    
  } catch (error) {
    console.error('❌ Error loading shorts:', error);
    useFallbackData();
  }
}

// Load like counts
async function loadLikeCounts() {
  if (!shortsData.length) return;
  
  const contentIds = shortsData.map(s => s.id);
  
  const likeCounts = await Promise.all(
    contentIds.map(async (id) => {
      try {
        const { count } = await supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', id);
        return { id, count: count || 0 };
      } catch (e) {
        return { id, count: 0 };
      }
    })
  );
  
  likeCounts.forEach(({ id, count }) => {
    const short = shortsData.find(s => s.id === id);
    if (short) short.real_likes_count = count;
  });
}

// Use fallback/cached data
function useFallbackData() {
  console.log('📦 Using fallback data');
  
  // Try cache first
  try {
    const cached = localStorage.getItem('shorts_cache');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 24 hours
        shortsData = data;
        console.log('✅ Using cached shorts');
        renderShorts();
        setTimeout(() => {
          initSwiper();
          hideLoadingScreen();
          showToast('Showing cached content', 'info');
        }, 500);
        return;
      }
    }
  } catch (e) {}
  
  // Use test data
  shortsData = [
    {
      id: 'test-1',
      title: 'Welcome to Bantu Shorts',
      description: 'Discover amazing short-form content from creators across Africa. Swipe up to see more!',
      file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=700&fit=crop',
      duration: 596,
      views_count: 1250,
      likes_count: 89,
      comments_count: 12,
      real_likes_count: 89,
      created_at: new Date().toISOString(),
      genre: 'Original Audio',
      user_profiles: {
        id: 'test-creator',
        username: 'bantuteam',
        full_name: 'Bantu Team',
        avatar_url: null
      }
    },
    {
      id: 'test-2',
      title: 'Creator Tips',
      description: 'Learn how to grow your audience on Bantu Stream Connect with these pro tips! 🚀',
      file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81?w=400&h=700&fit=crop',
      duration: 653,
      views_count: 3420,
      likes_count: 234,
      comments_count: 45,
      real_likes_count: 234,
      created_at: new Date().toISOString(),
      genre: 'Education',
      user_profiles: {
        id: 'test-creator2',
        username: 'creatorschool',
        full_name: 'Creator School',
        avatar_url: null
      }
    }
  ];
  
  renderShorts();
  setTimeout(() => {
    initSwiper();
    hideLoadingScreen();
    showToast('Showing demo content', 'info');
  }, 500);
}

// Render shorts to DOM
function renderShorts() {
  const wrapper = document.getElementById('shorts-wrapper');
  if (!wrapper) return;
  
  wrapper.innerHTML = shortsData.map((short, index) => {
    const creator = short.user_profiles || {};
    const videoUrl = fixMediaUrl(short.file_url);
    const thumbnailUrl = short.thumbnail_url ? fixMediaUrl(short.thumbnail_url) : '';
    const creatorName = creator.full_name || creator.username || 'Creator';
    const initials = getInitials(creatorName);
    const isConnected = currentUser && userConnections.has(creator.id);
    
    return `
      <div class="swiper-slide" data-short-id="${short.id}" data-index="${index}">
        <div class="short-video-wrapper">
          <video 
            class="short-video" 
            src="${videoUrl}" 
            poster="${thumbnailUrl}"
            loop 
            playsinline 
            preload="metadata"
            data-short-id="${short.id}"
          ></video>
          <div class="video-overlay"></div>
          
          <!-- Actions (Right Side) -->
          <div class="shorts-actions">
            <button class="action-btn like-btn" data-action="like" data-short-id="${short.id}" title="Like">
              <i class="far fa-heart"></i>
              <span class="action-count">${formatNumber(short.real_likes_count || short.likes_count || 0)}</span>
            </button>
            
            <button class="action-btn comment-btn" data-action="comment" data-short-id="${short.id}" title="Comments">
              <i class="far fa-comment"></i>
              <span class="action-count">${formatNumber(short.comments_count || 0)}</span>
            </button>
            
            <button class="action-btn share-btn" data-action="share" data-short-id="${short.id}" title="Share">
              <i class="fas fa-share"></i>
            </button>
            
            <button class="action-btn save-btn" data-action="save" data-short-id="${short.id}" title="Save">
              <i class="far fa-bookmark"></i>
            </button>
          </div>
          
          <!-- Creator Info & Caption -->
          <div class="shorts-info">
            <div class="creator-info" data-creator-id="${creator.id}" data-creator-name="${creatorName}">
              <div class="creator-avatar">
                ${creator.avatar_url 
                  ? `<img src="${fixMediaUrl(creator.avatar_url)}" alt="${creatorName}" loading="lazy">` 
                  : `<span>${initials}</span>`
                }
              </div>
              <div class="creator-details">
                <div class="creator-name">${escapeHtml(creatorName)}</div>
                <div class="creator-username">@${escapeHtml(creator.username || 'creator')}</div>
              </div>
              <button class="connect-btn ${isConnected ? 'connected' : ''}" data-creator-id="${creator.id}">
                ${isConnected ? 'Connected' : 'Connect'}
              </button>
            </div>
            
            <div class="shorts-caption" id="caption-${short.id}">
              ${escapeHtml(short.description || short.title || 'No description')}
            </div>
            ${(short.description?.length > 100 || short.title?.length > 100) ? `
              <button class="caption-toggle" data-caption-id="caption-${short.id}">
                more
              </button>
            ` : ''}
            
            <div class="shorts-meta">
              <span><i class="fas fa-music"></i> ${escapeHtml(short.genre || 'Original Audio')}</span>
              <span><i class="fas fa-clock"></i> ${formatTime(short.duration || 0)}</span>
              <span><i class="fas fa-eye"></i> ${formatNumber(short.views_count || 0)}</span>
            </div>
          </div>
          
          <!-- Video Controls -->
          <div class="video-controls">
            <button class="control-btn mute-btn" title="Mute">
              <i class="fas fa-volume-up"></i>
            </button>
            
            <div class="progress-container">
              <div class="progress-buffer"></div>
              <div class="progress-bar"></div>
            </div>
            
            <button class="control-btn more-btn" data-short-id="${short.id}" title="More options">
              <i class="fas fa-ellipsis-h"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Initialize Swiper
function initSwiper() {
  if (typeof Swiper === 'undefined') {
    console.error('Swiper not loaded');
    setTimeout(initSwiper, 100);
    return;
  }
  
  swiperInstance = new Swiper('.shorts-swiper', {
    direction: 'vertical',
    loop: false,
    speed: 300,
    mousewheel: true,
    keyboard: {
      enabled: true,
      onlyInViewport: false
    },
    on: {
      init: function() {
        console.log('✅ Swiper initialized');
        setTimeout(() => playCurrentShort(), 300);
      },
      slideChange: function() {
        pauseAllVideos();
        hasRecordedView = false; // Reset view tracking for new video
        setTimeout(() => playCurrentShort(), 100);
        updateActiveShort();
        closeMoreMenu();
      },
      reachEnd: function() {
        loadMoreShorts();
      }
    }
  });
  
  setupEventListeners();
  
  // Initialize search and notifications after swiper is ready
  initSearchModal();
  initNotificationsPanel();
}

// ============================================
// SEARCH FUNCTIONS
// ============================================
function initSearchModal() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  
  if (!searchBtn || !searchModal) return;
  
  searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchModal.classList.add('active');
    setTimeout(() => searchInput?.focus(), 300);
  });
  
  closeSearchBtn?.addEventListener('click', () => {
    searchModal.classList.remove('active');
    if (searchInput) searchInput.value = '';
    document.getElementById('search-results-grid').innerHTML = '';
  });
  
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    }
  });
  
  // Search with debounce
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      const category = categoryFilter?.value || '';
      const sortBy = sortFilter?.value || 'newest';
      
      if (query.length < 2) {
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Start typing to search...</div>';
        return;
      }
      
      document.getElementById('search-results-grid').innerHTML = 
        '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div>Searching...</div>';
      
      try {
        const results = await searchShorts(query, category, sortBy);
        renderSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Error searching. Please try again.</div>';
      }
    }, 300));
  }
  
  // Filter change events
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (searchInput?.value.trim().length >= 2) {
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }
  
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      if (searchInput?.value.trim().length >= 2) {
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }
}

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

async function searchShorts(query, category = '', sortBy = 'newest') {
  try {
    let orderBy = 'created_at';
    let order = 'desc';
    if (sortBy === 'popular') orderBy = 'views_count';
    else if (sortBy === 'trending') orderBy = 'likes_count';
    
    let queryBuilder = supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .ilike('title', `%${query}%`)
      .eq('status', 'published')
      .or('media_type.eq.short,duration.lte.60')
      .order(orderBy, { ascending: order === 'asc' })
      .limit(20);
    
    if (category) queryBuilder = queryBuilder.eq('genre', category);
    
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const creator = item.user_profiles?.full_name || item.user_profiles?.username || 'Creator';
    const viewsCount = item.views_count || 0;
    return `
      <div class="content-card" data-content-id="${item.id}">
        <div class="card-thumbnail">
          <img src="${fixMediaUrl(item.thumbnail_url) || 'https://via.placeholder.com/400x700'}" 
               alt="${escapeHtml(item.title)}"
               onerror="this.src='https://via.placeholder.com/400x700'">
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(item.title, 45)}</h3>
          <div class="related-meta">
            <i class="fas fa-eye"></i>
            <span>${formatNumber(viewsCount)} views</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) {
        // Close search modal
        document.getElementById('search-modal')?.classList.remove('active');
        // Navigate to the content
        window.location.href = `shorts-detail.html?id=${id}`;
      }
    });
  });
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// NOTIFICATIONS FUNCTIONS
// ============================================
function initNotificationsPanel() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  notificationsBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    notificationsPanel.classList.add('active');
    if (currentUser) {
      await loadUserNotifications();
      // Auto-mark as read when opened
      setTimeout(() => markAllNotificationsAsRead(), 1000);
    } else {
      document.getElementById('notifications-list').innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>Sign in to see notifications</p>
        </div>`;
      updateNotificationBadge(0);
    }
  });
  
  closeNotifications?.addEventListener('click', () => {
    notificationsPanel.classList.remove('active');
  });
  
  markAllReadBtn?.addEventListener('click', () => {
    if (currentUser) {
      markAllNotificationsAsRead();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (notificationsPanel.classList.contains('active') &&
        !notificationsPanel.contains(e.target) &&
        !notificationsBtn.contains(e.target)) {
      notificationsPanel.classList.remove('active');
    }
  });
}

async function loadUserNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  if (!currentUser) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>Sign in to see notifications</p>
      </div>`;
    updateNotificationBadge(0);
    return;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>`;
      updateNotificationBadge(0);
      return;
    }
    
    notificationsList.innerHTML = data.map(notification => `
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
    
    // Add click handlers
    notificationsList.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await markNotificationAsRead(id);
        const notification = data.find(n => n.id === id);
        if (notification?.content_id) {
          // Close panel and navigate
          notificationsPanel.classList.remove('active');
          window.location.href = `shorts-detail.html?id=${notification.content_id}`;
        }
      });
    });
    
    const unreadCount = data.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading notifications</p>
      </div>`;
  }
}

function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    case 'view_milestone': return 'fas fa-trophy';
    case 'system': return 'fas fa-bell';
    default: return 'fas fa-bell';
  }
}

async function markNotificationAsRead(notificationId) {
  if (!currentUser) return;
  
  try {
    const { error } = await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw error;
    
    const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.classList.add('read');
      const dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    }
    
    // Update badge
    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    updateNotificationBadge(unreadCount);
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  if (!currentUser) return;
  
  try {
    const { error } = await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    document.querySelectorAll('.notification-item.unread').forEach(item => {
      item.classList.remove('unread');
      item.classList.add('read');
      const dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    });
    
    updateNotificationBadge(0);
    showToast('All notifications marked as read', 'success');
    
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

function updateNotificationBadge(count = null) {
  if (count === null) {
    count = document.querySelectorAll('.notification-item.unread').length;
  }
  const badge = document.getElementById('notification-count');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function formatNotificationTime(timestamp) {
  const now = new Date();
  const diffMs = now - new Date(timestamp);
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
// VIDEO CONTROL FUNCTIONS
// ============================================
function pauseAllVideos() {
  document.querySelectorAll('.short-video').forEach(video => {
    video.pause();
  });
}

function playCurrentShort() {
  const activeSlide = document.querySelector('.swiper-slide-active');
  if (!activeSlide) return;
  
  const video = activeSlide.querySelector('.short-video');
  if (!video) return;
  
  currentVideo = video;
  const shortId = activeSlide.dataset.shortId;
  currentShort = shortsData.find(s => s.id == shortId) || null;
  
  if (currentShort) {
    updateShareLink();
    
    if (document.getElementById('comments-modal').classList.contains('active')) {
      loadComments(currentShort.id);
    }
  }
  
  video.currentTime = 0;
  hasRecordedView = false; // Reset view tracking
  
  // Try to play with user interaction fallback
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.log('Autoplay prevented:', error);
      showPlayPauseOverlay('play');
    });
  }
  
  setupVideoListeners(video);
  updateMuteButton();
}

function setupVideoListeners(video) {
  // Remove existing listeners to avoid duplicates
  video.removeEventListener('timeupdate', handleTimeUpdate);
  video.removeEventListener('progress', handleProgress);
  video.removeEventListener('ended', handleEnded);
  video.removeEventListener('error', handleVideoError);
  
  // Add fresh listeners
  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('progress', handleProgress);
  video.addEventListener('ended', handleEnded);
  video.addEventListener('error', handleVideoError);
}

function handleTimeUpdate(e) {
  const video = e.target;
  const shortId = video.dataset.shortId;
  const progressBar = document.querySelector(`.swiper-slide-active .progress-bar`);
  if (progressBar && video.duration) {
    const progress = (video.currentTime / video.duration) * 100;
    progressBar.style.width = `${progress}%`;
  }
  
  // Record view after 3 seconds
  if (!hasRecordedView && video.currentTime >= 3) {
    hasRecordedView = true;
    recordView(shortId, Math.floor(video.currentTime));
  }
}

function handleProgress(e) {
  const video = e.target;
  if (video.buffered.length > 0) {
    const bufferBar = document.querySelector(`.swiper-slide-active .progress-buffer`);
    if (bufferBar && video.duration) {
      const buffered = (video.buffered.end(0) / video.duration) * 100;
      bufferBar.style.width = `${buffered}%`;
    }
  }
}

function handleEnded(e) {
  if (swiperInstance) {
    swiperInstance.slideNext();
  } else {
    e.target.currentTime = 0;
    e.target.play().catch(() => {});
  }
}

function handleVideoError(e) {
  console.error('Video error:', e);
  showToast('Failed to load video', 'error');
}

function updateActiveShort() {
  const activeSlide = document.querySelector('.swiper-slide-active');
  if (!activeSlide) return;
  
  const shortId = activeSlide.dataset.shortId;
  updateLikeButton(shortId);
  updateSaveButton(shortId);
}

function updateMuteButton() {
  const muteBtn = document.querySelector('.swiper-slide-active .mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = isMuted 
      ? '<i class="fas fa-volume-mute"></i>' 
      : '<i class="fas fa-volume-up"></i>';
  }
}

function toggleMute() {
  if (!currentVideo) return;
  
  isMuted = !isMuted;
  currentVideo.muted = isMuted;
  updateMuteButton();
  showToast(isMuted ? 'Muted' : 'Unmuted', 'info');
}

function togglePlayPause() {
  if (!currentVideo) return;
  
  if (currentVideo.paused) {
    currentVideo.play().catch(() => {});
    isPlaying = true;
    showPlayPauseOverlay('play');
  } else {
    currentVideo.pause();
    isPlaying = false;
    showPlayPauseOverlay('pause');
  }
}

function showPlayPauseOverlay(action) {
  const overlay = document.getElementById('play-pause-overlay');
  const icon = document.getElementById('play-pause-icon');
  
  icon.className = action === 'play' ? 'fas fa-play' : 'fas fa-pause';
  overlay.classList.add('active');
  
  setTimeout(() => {
    overlay.classList.remove('active');
  }, 300);
}

function seekVideo(container, event) {
  if (!currentVideo || !currentVideo.duration) return;
  
  const rect = container.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const time = percent * currentVideo.duration;
  
  currentVideo.currentTime = Math.max(0, Math.min(time, currentVideo.duration));
}

// ============================================
// SUPABASE FUNCTIONS
// ============================================

// ✅ 1️⃣ RECORD VIEW (Short Watch)
async function recordView(contentId, watchDuration = 3) {
  if (!currentUser) return; // Only record views for logged-in users
  
  try {
    await supabaseClient
      .from('content_views')
      .insert({
        content_id: contentId,
        viewer_id: currentUser.id, // Note: viewer_id, not user_id
        view_duration: watchDuration,
        device_type: 'web'
      });
    console.log('✅ View recorded for content:', contentId);
  } catch (error) {
    console.error('Error recording view:', error);
  }
}

// ✅ 2️⃣ LOAD COMMENTS
async function loadComments(contentId) {
  const list = document.getElementById('comments-list');
  list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-grey)"><i class="fas fa-spinner fa-spin"></i> Loading comments...</div>';
  
  try {
    const { data: comments, error } = await supabaseClient
      .from('comments')
      .select(`
        id,
        comment_text,
        created_at,
        author_name,
        author_avatar,
        user_id,
        comment_likes(count)
      `)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (!comments || comments.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--slate-grey)">
          <i class="far fa-comment-dots" style="font-size:2rem;margin-bottom:1rem;opacity:0.5"></i>
          <p>No comments yet</p>
          <p style="font-size:0.875rem">Be the first to comment!</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = comments.map(comment => {
      const likeCount = comment.comment_likes?.[0]?.count || 0;
      
      return `
        <div class="comment-item" data-comment-id="${comment.id}">
          <div class="comment-avatar">
            ${comment.author_avatar 
              ? `<img src="${fixMediaUrl(comment.author_avatar)}" alt="${escapeHtml(comment.author_name)}" loading="lazy">` 
              : `<span>${getInitials(comment.author_name || 'User')}</span>`
            }
          </div>
          <div class="comment-content">
            <div class="comment-header">
              <span class="comment-username">${escapeHtml(comment.author_name || 'User')}</span>
              <span class="comment-time">${getTimeAgo(comment.created_at)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
            <div class="comment-actions">
              <button class="comment-action like-comment-btn" data-comment-id="${comment.id}">
                <i class="far fa-heart"></i> ${formatNumber(likeCount)}
              </button>
              <button class="comment-action report-comment-btn" data-comment-id="${comment.id}">
                <i class="fas fa-flag"></i> Report
              </button>
              ${currentUser && comment.user_id === currentUser.id ? `
                <button class="comment-action delete-comment-btn" data-comment-id="${comment.id}">
                  <i class="fas fa-trash"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach comment action listeners
    attachCommentActionListeners();
    
  } catch (error) {
    console.error('Error loading comments:', error);
    list.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--error-color)">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;margin-bottom:1rem"></i>
        <p>Failed to load comments</p>
        <button onclick="loadComments('${contentId}')" style="background:var(--warm-gold);color:var(--deep-black);border:none;padding:0.5rem 1rem;border-radius:0.5rem;margin-top:1rem;cursor:pointer">
          Retry
        </button>
      </div>
    `;
  }
}

// ✅ 3️⃣ POST COMMENT
async function postComment() {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  
  if (!text || !currentShort || !currentUser) {
    showToast('Please sign in to comment', 'info');
    return;
  }
  
  // Get user profile for author info
  try {
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('full_name, avatar_url')
      .eq('id', currentUser.id)
      .single();
    
    if (profileError) throw profileError;
    
    const { error } = await supabaseClient
      .from('comments')
      .insert({
        content_id: currentShort.id,
        user_id: currentUser.id,
        author_name: profile?.full_name || currentUser.email?.split('@')[0] || 'User',
        author_avatar: profile?.avatar_url || null,
        comment_text: text
      });
    
    if (error) throw error;
    
    input.value = '';
    document.getElementById('post-comment-btn').disabled = true;
    
    // Update comment count in UI
    const commentBtn = document.querySelector(`.swiper-slide-active .comment-btn .action-count`);
    if (commentBtn) {
      const currentCount = parseInt(commentBtn.textContent) || 0;
      commentBtn.textContent = formatNumber(currentCount + 1);
    }
    
    await loadComments(currentShort.id);
    showToast('Comment posted!', 'success');
    
  } catch (error) {
    console.error('Error posting comment:', error);
    showToast('Failed to post comment', 'error');
  }
}

// ✅ 4️⃣ LIKE COMMENT
async function likeComment(commentId, btn) {
  if (!currentUser) {
    showToast('Sign in to like comments', 'info');
    return;
  }
  
  const liked = btn.classList.contains('liked');
  const countSpan = btn.querySelector('span') || btn;
  const currentCount = parseInt(countSpan.textContent.replace(/[^0-9]/g, '')) || 0;
  
  // Optimistic update
  if (liked) {
    btn.classList.remove('liked');
    btn.querySelector('i').className = 'far fa-heart';
    countSpan.textContent = formatNumber(currentCount - 1);
  } else {
    btn.classList.add('liked');
    btn.querySelector('i').className = 'fas fa-heart';
    countSpan.textContent = formatNumber(currentCount + 1);
  }
  
  try {
    if (liked) {
      await supabaseClient
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);
    } else {
      await supabaseClient
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: currentUser.id
        });
    }
  } catch (error) {
    // Revert on error
    if (liked) {
      btn.classList.add('liked');
      btn.querySelector('i').className = 'fas fa-heart';
      countSpan.textContent = formatNumber(currentCount);
    } else {
      btn.classList.remove('liked');
      btn.querySelector('i').className = 'far fa-heart';
      countSpan.textContent = formatNumber(currentCount);
    }
    console.error('Comment like error:', error);
    showToast('Failed to update like', 'error');
  }
}

// ✅ 5️⃣ REPORT COMMENT
async function reportComment(commentId) {
  if (!currentUser) {
    showToast('Sign in to report comments', 'info');
    return;
  }
  
  const reason = prompt('Please provide a reason for reporting this comment:');
  if (!reason) return;
  
  try {
    const { error } = await supabaseClient
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        user_id: currentUser.id,
        reason: reason
      });
    
    if (error) throw error;
    
    showToast('Report submitted. Thank you for helping keep our community safe!', 'success');
  } catch (error) {
    console.error('Error reporting comment:', error);
    showToast('Failed to submit report', 'error');
  }
}

// ✅ 6️⃣ DELETE COMMENT
async function deleteComment(commentId) {
  if (!currentUser) return;
  
  if (!confirm('Delete this comment?')) return;
  
  try {
    const { error } = await supabaseClient
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    // Remove comment from UI
    const commentEl = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    if (commentEl) commentEl.remove();
    
    // Update comment count in UI
    const commentBtn = document.querySelector(`.swiper-slide-active .comment-btn .action-count`);
    if (commentBtn) {
      const currentCount = parseInt(commentBtn.textContent) || 0;
      commentBtn.textContent = formatNumber(Math.max(0, currentCount - 1));
    }
    
    showToast('Comment deleted', 'info');
  } catch (error) {
    console.error('Error deleting comment:', error);
    showToast('Failed to delete comment', 'error');
  }
}

function attachCommentActionListeners() {
  // Like comment buttons
  document.querySelectorAll('.like-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      likeComment(commentId, btn);
    });
  });
  
  // Report comment buttons
  document.querySelectorAll('.report-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      reportComment(commentId);
    });
  });
  
  // Delete comment buttons
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      deleteComment(commentId);
    });
  });
}

// ============================================
// ACTION HANDLERS
// ============================================
async function handleLike(shortId, btn) {
  if (!currentUser) {
    showToast('Sign in to like shorts', 'info');
    return;
  }
  
  const liked = btn.classList.contains('liked');
  const countEl = btn.querySelector('.action-count');
  let currentCount = parseInt(countEl.textContent.replace(/[^0-9]/g, '')) || 0;
  
  // Optimistic update
  if (liked) {
    btn.classList.remove('liked');
    btn.querySelector('i').className = 'far fa-heart';
    countEl.textContent = formatNumber(currentCount - 1);
  } else {
    btn.classList.add('liked');
    btn.querySelector('i').className = 'fas fa-heart';
    countEl.textContent = formatNumber(currentCount + 1);
  }
  
  try {
    if (liked) {
      await supabaseClient
        .from('content_likes')
        .delete()
        .eq('content_id', shortId)
        .eq('user_id', currentUser.id);
    } else {
      await supabaseClient
        .from('content_likes')
        .insert({
          content_id: shortId,
          user_id: currentUser.id,
          created_at: new Date().toISOString()
        });
      showDoubleTapIndicator();
    }
  } catch (error) {
    // Revert on error
    if (liked) {
      btn.classList.add('liked');
      btn.querySelector('i').className = 'fas fa-heart';
      countEl.textContent = formatNumber(currentCount);
    } else {
      btn.classList.remove('liked');
      btn.querySelector('i').className = 'far fa-heart';
      countEl.textContent = formatNumber(currentCount);
    }
    console.error('Like error:', error);
    showToast('Failed to update like', 'error');
  }
}

async function handleSave(shortId, btn) {
  if (!currentUser) {
    showToast('Sign in to save shorts', 'info');
    return;
  }
  
  const saved = btn.classList.contains('saved');
  
  if (saved) {
    btn.classList.remove('saved');
    btn.querySelector('i').className = 'far fa-bookmark';
  } else {
    btn.classList.add('saved');
    btn.querySelector('i').className = 'fas fa-bookmark';
  }
  
  try {
    if (saved) {
      await supabaseClient
        .from('saved_shorts')
        .delete()
        .eq('content_id', shortId)
        .eq('user_id', currentUser.id);
      showToast('Removed from saved', 'info');
    } else {
      await supabaseClient
        .from('saved_shorts')
        .insert({
          content_id: shortId,
          user_id: currentUser.id,
          saved_at: new Date().toISOString()
        });
      showToast('Saved!', 'success');
    }
  } catch (error) {
    // Revert
    if (saved) {
      btn.classList.add('saved');
      btn.querySelector('i').className = 'fas fa-bookmark';
    } else {
      btn.classList.remove('saved');
      btn.querySelector('i').className = 'far fa-bookmark';
    }
    console.error('Save error:', error);
    showToast('Failed to save', 'error');
  }
}

async function handleConnect(creatorId, btn) {
  if (!currentUser) {
    showToast('Sign in to connect', 'info');
    return;
  }
  
  const connected = btn.classList.contains('connected');
  
  if (connected) {
    btn.textContent = 'Connect';
    btn.classList.remove('connected');
  } else {
    btn.textContent = 'Connected';
    btn.classList.add('connected');
  }
  
  try {
    if (connected) {
      await supabaseClient
        .from('connectors')
        .delete()
        .eq('connector_id', currentUser.id)
        .eq('connected_id', creatorId);
      userConnections.delete(creatorId);
      showToast('Disconnected', 'info');
    } else {
      await supabaseClient
        .from('connectors')
        .insert({
          connector_id: currentUser.id,
          connected_id: creatorId,
          connection_type: 'creator',
          created_at: new Date().toISOString()
        });
      userConnections.add(creatorId);
      showToast('Connected!', 'success');
    }
  } catch (error) {
    // Revert
    if (connected) {
      btn.textContent = 'Connected';
      btn.classList.add('connected');
    } else {
      btn.textContent = 'Connect';
      btn.classList.remove('connected');
    }
    console.error('Connection error:', error);
    showToast('Failed to update connection', 'error');
  }
}

// ============================================
// MORE MENU FUNCTIONS
// ============================================
function toggleMoreMenu(shortId, button) {
  const menu = document.getElementById('more-menu');
  if (!menu) return;
  
  if (moreMenuOpen) {
    closeMoreMenu();
    return;
  }
  
  // Position menu relative to button
  const rect = button.getBoundingClientRect();
  menu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  menu.style.right = `${window.innerWidth - rect.right + 10}px`;
  
  menu.dataset.shortId = shortId;
  menu.classList.add('active');
  moreMenuOpen = true;
}

function closeMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu) menu.classList.remove('active');
  moreMenuOpen = false;
}

function handleReport() {
  const shortId = document.getElementById('more-menu').dataset.shortId;
  showToast('Report submitted', 'success');
  closeMoreMenu();
}

function handleMuteCreator() {
  showToast('Creator muted', 'info');
  closeMoreMenu();
}

function handleNotInterested() {
  showToast('Thanks for feedback', 'info');
  closeMoreMenu();
}

function handleBlockCreator() {
  if (confirm('Block this creator? You won\'t see their content.')) {
    showToast('Creator blocked', 'info');
    closeMoreMenu();
  }
}

// ============================================
// COMMENT FUNCTIONS
// ============================================
function openComments(shortId) {
  const modal = document.getElementById('comments-modal');
  modal.classList.add('active');
  loadComments(shortId);
  setTimeout(() => {
    document.getElementById('comment-input')?.focus();
  }, 300);
}

function closeComments() {
  document.getElementById('comments-modal').classList.remove('active');
}

// ============================================
// SHARE FUNCTIONS
// ============================================
function openShare(shortId) {
  document.getElementById('share-modal').classList.add('active');
  updateShareLink();
}

function closeShare() {
  document.getElementById('share-modal').classList.remove('active');
}

function updateShareLink() {
  if (!currentShort) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${currentShort.id}`;
  document.getElementById('share-link-input').value = shareUrl;
}

async function copyShareLink() {
  const input = document.getElementById('share-link-input');
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Link copied!', 'success');
  } catch {
    input.select();
    document.execCommand('copy');
    showToast('Link copied!', 'success');
  }
  closeShare();
}

function shareToWhatsApp() {
  const text = `Check out this short on Bantu Stream Connect!`;
  const url = document.getElementById('share-link-input').value;
  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  closeShare();
}

function shareToTwitter() {
  const text = `Check out this short on Bantu Stream Connect!`;
  const url = document.getElementById('share-link-input').value;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  closeShare();
}

function shareToInstagram() {
  showToast('Share to Instagram coming soon!', 'info');
  closeShare();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function hideLoadingScreen(showFallback = false, message = '') {
  const loadingScreen = document.getElementById('shorts-loading');
  if (!loadingScreen) return;
  
  if (showFallback) {
    loadingScreen.innerHTML = `
      <div class="fallback-message">
        <i class="fas fa-exclamation-circle" style="font-size:3rem;color:var(--warm-gold);margin-bottom:1rem"></i>
        <h3>Connection Issue</h3>
        <p>${escapeHtml(message || 'Unable to connect. Showing offline content.')}</p>
        <div class="fallback-actions">
          <button class="fallback-btn" onclick="location.reload()">
            <i class="fas fa-redo"></i> Retry
          </button>
          <button class="fallback-btn secondary" onclick="window.location.href='index.html'">
            <i class="fas fa-home"></i> Home
          </button>
        </div>
        <div class="fallback-tip">
          <i class="fas fa-lightbulb"></i> Tip: Check your internet connection
        </div>
      </div>
    `;
    loadingScreen.classList.remove('hidden');
  } else {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatTime(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
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

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.includes('supabase.co')) return url;
  return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function updateLikeButton(shortId) {
  if (!currentUser) return;
  const btn = document.querySelector(`.swiper-slide-active .like-btn[data-short-id="${shortId}"]`);
  if (!btn) return;
  
  // Check if user has liked this content
  supabaseClient
    .from('content_likes')
    .select('id')
    .eq('content_id', shortId)
    .eq('user_id', currentUser.id)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        btn.classList.add('liked');
        btn.querySelector('i').className = 'fas fa-heart';
      }
    })
    .catch(() => {});
}

function updateSaveButton(shortId) {
  if (!currentUser) return;
  const btn = document.querySelector(`.swiper-slide-active .save-btn[data-short-id="${shortId}"]`);
  if (!btn) return;
  
  // Check if user has saved this content
  supabaseClient
    .from('saved_shorts')
    .select('id')
    .eq('content_id', shortId)
    .eq('user_id', currentUser.id)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        btn.classList.add('saved');
        btn.querySelector('i').className = 'fas fa-bookmark';
      }
    })
    .catch(() => {});
}

function showDoubleTapIndicator() {
  const indicator = document.getElementById('double-tap-indicator');
  indicator.classList.add('active');
  setTimeout(() => indicator.classList.remove('active'), 500);
}

function handleDoubleTap(e) {
  const now = Date.now();
  if (now - lastTapTime < 300) {
    const likeBtn = document.querySelector('.swiper-slide-active .like-btn');
    if (likeBtn && !likeBtn.classList.contains('liked')) {
      likeBtn.click();
    }
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
}

// ============================================
// USER PROFILE FUNCTIONS
// ============================================
async function loadUserProfilePicture(user) {
  if (!user) return;
  
  try {
    const { data: profile, error } = await supabaseClient
      .from('user_profiles')
      .select('avatar_url, full_name, username')
      .eq('id', user.id)
      .maybeSingle();
    
    const placeholder = document.getElementById('userProfilePlaceholder');
    if (!placeholder) return;
    
    placeholder.innerHTML = '';
    
    if (profile?.avatar_url) {
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.src = fixMediaUrl(profile.avatar_url);
      img.alt = profile.full_name || 'User';
      img.onerror = () => {
        placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
      };
      placeholder.appendChild(img);
    } else {
      const initials = profile?.full_name ? getInitials(profile.full_name) : getInitials(user.email);
      const div = document.createElement('div');
      div.className = 'profile-placeholder';
      div.textContent = initials;
      placeholder.appendChild(div);
    }
  } catch (error) {
    console.error('Error loading profile picture:', error);
  }
}

async function fetchUserConnections() {
  if (!currentUser) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('connectors')
      .select('connected_id')
      .eq('connector_id', currentUser.id);
    
    if (error) throw error;
    
    userConnections.clear();
    if (data) data.forEach(c => userConnections.add(c.connected_id));
    
  } catch (error) {
    console.error('Error fetching connections:', error);
  }
}

// ============================================
// LOAD MORE SHORTS
// ============================================
async function loadMoreShorts() {
  if (shortsData.length >= 50 || connectionFailed) return;
  
  try {
    const lastShort = shortsData[shortsData.length - 1];
    
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .or('media_type.eq.short,duration.lte.60')
      .lt('created_at', lastShort.created_at)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      shortsData = [...shortsData, ...data];
      
      // Load like counts for new shorts
      await loadLikeCountsForNewShorts(data);
      
      data.forEach(short => {
        const slide = createShortSlide(short);
        document.getElementById('shorts-wrapper').appendChild(slide);
      });
      
      if (swiperInstance) swiperInstance.update();
    }
    
  } catch (error) {
    console.error('Error loading more shorts:', error);
  }
}

async function loadLikeCountsForNewShorts(newShorts) {
  const contentIds = newShorts.map(s => s.id);
  
  const likeCounts = await Promise.all(
    contentIds.map(async (id) => {
      try {
        const { count } = await supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', id);
        return { id, count: count || 0 };
      } catch (e) {
        return { id, count: 0 };
      }
    })
  );
  
  likeCounts.forEach(({ id, count }) => {
    const short = shortsData.find(s => s.id === id);
    if (short) short.real_likes_count = count;
  });
}

function createShortSlide(short) {
  const creator = short.user_profiles || {};
  const videoUrl = fixMediaUrl(short.file_url);
  const thumbnailUrl = short.thumbnail_url ? fixMediaUrl(short.thumbnail_url) : '';
  const creatorName = creator.full_name || creator.username || 'Creator';
  const initials = getInitials(creatorName);
  const isConnected = currentUser && userConnections.has(creator.id);
  
  const slide = document.createElement('div');
  slide.className = 'swiper-slide';
  slide.dataset.shortId = short.id;
  slide.innerHTML = `
    <div class="short-video-wrapper">
      <video class="short-video" src="${videoUrl}" poster="${thumbnailUrl}" loop playsinline preload="metadata" data-short-id="${short.id}"></video>
      <div class="video-overlay"></div>
      <div class="shorts-actions">
        <button class="action-btn like-btn" data-action="like" data-short-id="${short.id}">
          <i class="far fa-heart"></i>
          <span class="action-count">${formatNumber(short.real_likes_count || short.likes_count || 0)}</span>
        </button>
        <button class="action-btn comment-btn" data-action="comment" data-short-id="${short.id}">
          <i class="far fa-comment"></i>
          <span class="action-count">${formatNumber(short.comments_count || 0)}</span>
        </button>
        <button class="action-btn share-btn" data-action="share" data-short-id="${short.id}">
          <i class="fas fa-share"></i>
        </button>
        <button class="action-btn save-btn" data-action="save" data-short-id="${short.id}">
          <i class="far fa-bookmark"></i>
        </button>
      </div>
      <div class="shorts-info">
        <div class="creator-info" data-creator-id="${creator.id}" data-creator-name="${creatorName}">
          <div class="creator-avatar">
            ${creator.avatar_url ? `<img src="${fixMediaUrl(creator.avatar_url)}" alt="${escapeHtml(creatorName)}">` : `<span>${initials}</span>`}
          </div>
          <div class="creator-details">
            <div class="creator-name">${escapeHtml(creatorName)}</div>
            <div class="creator-username">@${escapeHtml(creator.username || 'creator')}</div>
          </div>
          <button class="connect-btn ${isConnected ? 'connected' : ''}" data-creator-id="${creator.id}">
            ${isConnected ? 'Connected' : 'Connect'}
          </button>
        </div>
        <div class="shorts-caption" id="caption-${short.id}">${escapeHtml(short.description || short.title || '')}</div>
        <div class="shorts-meta">
          <span><i class="fas fa-music"></i> ${escapeHtml(short.genre || 'Original Audio')}</span>
          <span><i class="fas fa-clock"></i> ${formatTime(short.duration || 0)}</span>
        </div>
      </div>
      <div class="video-controls">
        <button class="control-btn mute-btn"><i class="fas fa-volume-up"></i></button>
        <div class="progress-container">
          <div class="progress-buffer"></div>
          <div class="progress-bar"></div>
        </div>
        <button class="control-btn more-btn" data-short-id="${short.id}"><i class="fas fa-ellipsis-h"></i></button>
      </div>
    </div>
  `;
  
  return slide;
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Header buttons
  document.getElementById('search-btn')?.addEventListener('click', () => {
    // Already handled in initSearchModal
  });
  
  document.getElementById('notifications-btn')?.addEventListener('click', () => {
    // Already handled in initNotificationsPanel
  });
  
  document.getElementById('profile-btn')?.addEventListener('click', () => {
    if (currentUser) {
      window.location.href = 'profile.html';
    } else {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  });
  
  // Action buttons
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;
    
    e.stopPropagation();
    const action = btn.dataset.action;
    const shortId = btn.dataset.shortId;
    
    if (action === 'like') handleLike(shortId, btn);
    else if (action === 'comment') openComments(shortId);
    else if (action === 'share') openShare(shortId);
    else if (action === 'save') handleSave(shortId, btn);
  });
  
  // Connect button
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.connect-btn');
    if (btn) {
      e.stopPropagation();
      handleConnect(btn.dataset.creatorId, btn);
    }
  });
  
  // More button
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.more-btn');
    if (btn) {
      e.stopPropagation();
      toggleMoreMenu(btn.dataset.shortId, btn);
    }
  });
  
  // Caption toggle
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('.caption-toggle');
    if (toggle) {
      e.stopPropagation();
      const captionId = toggle.dataset.captionId;
      const caption = document.getElementById(captionId);
      if (caption) {
        caption.classList.toggle('expanded');
        toggle.textContent = caption.classList.contains('expanded') ? 'less' : 'more';
      }
    }
  });
  
  // Creator info click
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const creatorInfo = e.target.closest('.creator-info');
    if (creatorInfo && !e.target.closest('.connect-btn')) {
      const creatorId = creatorInfo.dataset.creatorId;
      if (creatorId) {
        window.location.href = `creator-channel.html?id=${creatorId}`;
      }
    }
  });
  
  // Video controls
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const muteBtn = e.target.closest('.mute-btn');
    if (muteBtn) {
      e.stopPropagation();
      toggleMute();
      return;
    }
    
    const progressContainer = e.target.closest('.progress-container');
    if (progressContainer) {
      e.stopPropagation();
      seekVideo(progressContainer, e);
      return;
    }
    
    const videoWrapper = e.target.closest('.short-video-wrapper');
    if (videoWrapper && 
        !e.target.closest('.shorts-actions') && 
        !e.target.closest('.shorts-info') &&
        !e.target.closest('.video-controls')) {
      togglePlayPause();
    }
  });
  
  // More menu actions
  document.getElementById('more-report')?.addEventListener('click', handleReport);
  document.getElementById('more-mute')?.addEventListener('click', handleMuteCreator);
  document.getElementById('more-not-interested')?.addEventListener('click', handleNotInterested);
  document.getElementById('more-block')?.addEventListener('click', handleBlockCreator);
  
  // Close more menu when clicking outside
  document.addEventListener('click', (e) => {
    if (moreMenuOpen && !e.target.closest('.more-menu') && !e.target.closest('.more-btn')) {
      closeMoreMenu();
    }
  });
  
  // Double-tap
  document.getElementById('shorts-player')?.addEventListener('touchend', handleDoubleTap);
  
  // Modal close buttons
  document.getElementById('close-comments')?.addEventListener('click', closeComments);
  document.getElementById('close-share')?.addEventListener('click', closeShare);
  
  // Modal backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
  
  // Comment composer
  const commentInput = document.getElementById('comment-input');
  const postCommentBtn = document.getElementById('post-comment-btn');
  
  commentInput?.addEventListener('input', () => {
    postCommentBtn.disabled = commentInput.value.trim().length === 0;
  });
  
  commentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!postCommentBtn.disabled) postComment();
    }
  });
  
  postCommentBtn?.addEventListener('click', postComment);
  
  // Share options
  document.getElementById('share-whatsapp')?.addEventListener('click', shareToWhatsApp);
  document.getElementById('share-twitter')?.addEventListener('click', shareToTwitter);
  document.getElementById('share-instagram')?.addEventListener('click', shareToInstagram);
  document.getElementById('share-copy')?.addEventListener('click', copyShareLink);
  document.getElementById('copy-link-btn')?.addEventListener('click', copyShareLink);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    
    switch(e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (swiperInstance) swiperInstance.slidePrev();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (swiperInstance) swiperInstance.slideNext();
        break;
      case 'Escape':
        e.preventDefault();
        closeMoreMenu();
        closeComments();
        closeShare();
        document.getElementById('search-modal')?.classList.remove('active');
        document.getElementById('notifications-panel')?.classList.remove('active');
        break;
    }
  });
}

// ============================================
// VISIBILITY CHANGE HANDLER
// ============================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAllVideos();
  } else {
    playCurrentShort();
  }
});

// Orientation change
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (swiperInstance) swiperInstance.update();
  }, 300);
});

// Auth state listener
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      loadUserProfilePicture(session.user);
      loadUserNotifications();
      fetchUserConnections();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('userProfilePlaceholder').innerHTML = '<i class="fas fa-user"></i>';
      document.getElementById('notification-count').style.display = 'none';
      showToast('Signed out', 'info');
    }
  });
}
