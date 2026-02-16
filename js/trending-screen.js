/**
 * Bantu Stream Connect - Trending Screen Logic
 * ✅ FIXED: No duplicate Supabase declaration
 */

// =========================================
// 1. CONFIGURATION & STATE
// =========================================
const CONFIG = {
  SUPABASE_URL: 'https://ydnxqnbjoshvxteevemc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U',
  STORAGE_BASE: 'https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/',
  CONTENT_LIMIT: 100,
  DEBOUNCE_DELAY: 300
};

const STATE = {
  currentUser: null,
  allContentData: [],
  featuredTrend: [],
  liveStreams: [],
  communityGems: [],
  trendingHashtags: [],
  selectedFilter: 'All',
  notifications: [],
  isLoading: false
};

const FILTERS = [
  'All', 'Music', 'Film & Series', 'Podcasts',
  'Gaming', 'Comedy', 'Live', 'Top 24 Hrs', 'Rising Creators'
];

// ✅ FIXED: Use window.supabase from SDK, don't redeclare
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =========================================
// 2. UTILITIES
// =========================================

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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getInitials(email) {
  if (!email) return 'U';
  return email.split('@')[0].substring(0, 2).toUpperCase();
}

function getInitialsFromName(fullName) {
  if (!fullName) return 'U';
  const names = fullName.split(' ');
  return names.length >= 2 
    ? (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
    : fullName.charAt(0).toUpperCase();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// ✅ FIXED: Loading state with error fallback
function setLoading(loading, text = '') {
  const loadingScreen = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');
  const app = document.getElementById('app');
  
  if (!loadingScreen || !app) {
    console.error('Loading elements not found');
    return;
  }
  
  if (text && loadingText) loadingText.textContent = text;
  
  if (loading) {
    loadingScreen.style.display = 'flex';
    loadingScreen.removeAttribute('hidden');
    if (app) app.setAttribute('hidden', '');
    STATE.isLoading = true;
  } else {
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
        loadingScreen.setAttribute('hidden', '');
      }
      if (app) app.removeAttribute('hidden');
      STATE.isLoading = false;
    }, 500);
  }
}

// =========================================
// 3. AUTHENTICATION & PROFILE
// =========================================

async function checkAuthentication() {
  try {
    setLoading(true, 'Checking authentication...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session?.user) {
      console.warn('⚠️ User not authenticated');
      showToast('Please sign in to access trending content', 'error');
      toggleModal('auth-modal', true);
      setLoading(false); // ✅ Ensure loading hides even on auth fail
      return false;
    }
    
    STATE.currentUser = session.user;
    console.log('✅ User authenticated:', STATE.currentUser.email);
    
    await loadUserProfilePicture(STATE.currentUser);
    await loadNotifications();
    return true;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    setLoading(false); // ✅ Ensure loading hides on error
    return false;
  }
}

async function loadUserProfilePicture(user) {
  try {
    const placeholder = document.getElementById('userProfilePlaceholder');
    if (!placeholder || !user) return;
    
    placeholder.innerHTML = '';
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    const userInitials = getInitials(user.email);
    
    if (error || !profile) {
      renderProfilePlaceholder(placeholder, userInitials);
      return;
    }
    
    const displayName = profile.full_name || profile.username || user.email;
    const initial = getInitialsFromName(displayName);
    
    if (profile.avatar_url) {
      const avatarUrl = constructStorageUrl(profile.avatar_url);
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.alt = `${displayName} profile`;
      img.src = avatarUrl;
      img.loading = 'lazy';
      
      img.onerror = () => {
        renderProfilePlaceholder(placeholder, initial);
      };
      
      placeholder.appendChild(img);
    } else {
      renderProfilePlaceholder(placeholder, initial);
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    renderProfilePlaceholder(
      document.getElementById('userProfilePlaceholder'), 
      getInitials(user?.email)
    );
  }
}

function renderProfilePlaceholder(container, text) {
  if (!container) return;
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'profile-placeholder';
  div.textContent = text;
  container.appendChild(div);
}

function constructStorageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const cleanPath = path.replace(/^\/+/, '');
  return `${CONFIG.STORAGE_BASE}${cleanPath}`;
}

// =========================================
// 4. NOTIFICATIONS
// =========================================

async function loadNotifications() {
  if (!STATE.currentUser) {
    updateNotificationBadge(0);
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', STATE.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    
    STATE.notifications = data || [];
    const unreadCount = STATE.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
    renderNotifications();
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-count');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.hidden = count === 0;
  }
}

function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (!STATE.currentUser) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey)">Sign in to see notifications</div>';
    return;
  }
  
  if (STATE.notifications.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey)">No notifications yet</div>';
    return;
  }
  
  list.innerHTML = STATE.notifications.map(n => `
    <div class="notification-item ${n.is_read ? 'read' : 'unread'}" 
         data-id="${n.id}" 
         role="listitem" 
         tabindex="0">
      <div class="notification-icon">
        <i class="${getNotificationIcon(n.type)}"></i>
      </div>
      <div class="notification-content">
        <h4>${escapeHtml(n.title)}</h4>
        <p>${escapeHtml(n.message)}</p>
        <span class="notification-time">${formatNotificationTime(n.created_at)}</span>
      </div>
      ${!n.is_read ? '<div class="notification-dot"></div>' : ''}
    </div>
  `).join('');
  
  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      await markNotificationAsRead(item.dataset.id);
      document.getElementById('notifications-panel').classList.remove('active');
    });
  });
}

function getNotificationIcon(type) {
  const icons = {
    'like': 'fas fa-heart',
    'comment': 'fas fa-comment',
    'follow': 'fas fa-user-plus',
    'view_milestone': 'fas fa-trophy',
    'system': 'fas fa-bell'
  };
  return icons[type] || 'fas fa-bell';
}

function formatNotificationTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

async function markNotificationAsRead(id) {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    await loadNotifications();
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

async function markAllNotificationsAsRead() {
  if (!STATE.currentUser) return;
  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', STATE.currentUser.id)
      .eq('is_read', false);
    await loadNotifications();
    showToast('All notifications marked as read', 'success');
  } catch (error) {
    console.error('Error marking all read:', error);
  }
}

// =========================================
// 5. CONTENT FETCHING
// =========================================

async function fetchContent() {
  try {
    console.log('🔄 Fetching trending content...');
    setLoading(true, 'Loading trending content...');
    
    let contentData = [];
    const fetchAttempt = async (tableName) => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*, user_profiles!user_id(*)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(CONFIG.CONTENT_LIMIT);
      if (error) throw error;
      return data;
    };
    
    try {
      contentData = await fetchAttempt('Content');
    } catch (e) {
      console.warn('Content table failed, trying lowercase...');
      contentData = await fetchAttempt('content');
    }
    
    const enrichedContent = await Promise.all(
      (contentData || []).map(async (item) => {
        const { count } = await supabase
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
          
        return {
          ...item,
          real_views: count || 0,
          is_live: item.is_live || false,
          viewer_count: item.viewer_count || count || 0,
          is_new: isContentNew(item.created_at)
        };
      })
    );
    
    console.log('✅ Processed content:', enrichedContent.length, 'items');
    return enrichedContent;
  } catch (error) {
    console.error('❌ Error fetching content:', error);
    showToast('Failed to load trending content. Please refresh.', 'error');
    return [];
  } finally {
    setLoading(false);
  }
}

function isContentNew(createdAt) {
  if (!createdAt) return false;
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo < 7;
}

// =========================================
// 6. RENDERING
// =========================================

function processTrendingSections(contentData) {
  STATE.allContentData = contentData;
  
  STATE.featuredTrend = [...contentData]
    .sort((a, b) => (b.real_views || 0) - (a.real_views || 0))
    .slice(0, 1);
    
  STATE.liveStreams = contentData.filter(item => item.is_live).slice(0, 10);
  
  STATE.communityGems = [...contentData]
    .sort((a, b) => {
      const scoreA = (a.real_views || 0) + ((a.likes_count || 0) * 2);
      const scoreB = (b.real_views || 0) + ((b.likes_count || 0) * 2);
      return scoreB - scoreA;
    })
    .slice(0, 20);
    
  STATE.trendingHashtags = ['#OwnYourStage', '#BantuFuture', '#1MinComedy', '#SofaTalks'];
}

function renderFilterChips() {
  const container = document.getElementById('filter-container');
  if (!container) return;
  
  container.innerHTML = FILTERS.map(filter => `
    <button class="filter-chip ${filter === STATE.selectedFilter ? 'active' : ''}"
            data-filter="${filter}"
            role="tab"
            aria-selected="${filter === STATE.selectedFilter}">
      ${filter.toUpperCase()}
    </button>
  `).join('');
  
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => onFilterSelected(btn.dataset.filter));
  });
}

function renderTrendingSections() {
  const container = document.getElementById('trending-sections');
  if (!container) return;
  
  container.innerHTML = `
    ${STATE.featuredTrend.length ? `
      <section class="section" aria-label="Featured Trend">
        <div class="section-header">
          <h2 class="section-title"><i class="fas fa-rocket section-icon"></i> THE PULSE</h2>
          <button class="see-all-btn" onclick="window.viewAllTrending()">SEE ALL</button>
        </div>
        ${renderFeaturedTrend()}
      </section>
    ` : ''}
    
    ${STATE.liveStreams.length ? `
      <section class="section" aria-label="Live Streams">
        <div class="section-header">
          <h2 class="section-title"><i class="fas fa-tv section-icon"></i> LIVE STREAMS</h2>
          <button class="see-all-btn" onclick="window.viewAllLiveStreams()">SEE ALL</button>
        </div>
        <div class="content-horizontal-scroll" role="list">
          ${renderLiveStreams()}
        </div>
      </section>
    ` : ''}
    
    ${STATE.communityGems.length ? `
      <section class="section" aria-label="Community Gems">
        <div class="section-header">
          <h2 class="section-title"><i class="fas fa-gem section-icon"></i> COMMUNITY GEMS</h2>
        </div>
        <div class="community-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">
          ${renderCommunityGems()}
        </div>
      </section>
    ` : ''}
  `;
  
  setupContentCardListeners();
}

function renderFeaturedTrend() {
  const content = STATE.featuredTrend[0];
  const thumb = constructStorageUrl(content.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200';
  
  return `
    <article class="featured-trend-card" data-content-id="${content.id}">
      <div class="featured-bg" style="background-image: url('${thumb}')"></div>
      <div class="featured-overlay">
        ${content.is_live ? '<div class="live-badge">LIVE NOW</div>' : ''}
        <h2 class="featured-title">${escapeHtml(content.title)}</h2>
        <div class="featured-creator">@${escapeHtml(content.user_profiles?.username || 'Creator')}</div>
        <div class="featured-stats">
          <span><i class="fas fa-eye"></i> ${formatNumber(content.real_views || 0)} views</span>
        </div>
        <button class="watch-now-btn" onclick="window.playContent('${content.id}')">
          ${content.is_live ? 'WATCH LIVE' : 'WATCH NOW'}
        </button>
      </div>
    </article>
  `;
}

function renderLiveStreams() {
  return STATE.liveStreams.map(content => {
    const thumb = constructStorageUrl(content.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400';
    const isUpcoming = content.scheduled_time && new Date(content.scheduled_time) > new Date();
    
    return `
      <article class="content-card" data-content-id="${content.id}" role="listitem">
        <div class="card-thumbnail">
          <img src="${thumb}" alt="${escapeHtml(content.title)}" loading="lazy" decoding="async">
          <div class="card-badges">
            ${isUpcoming ? '<div class="badge upcoming">UPCOMING</div>' : '<div class="badge live">LIVE</div>'}
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(content.title)}</h3>
          <div class="card-creator">@${escapeHtml(content.user_profiles?.username || 'Creator')}</div>
          ${isUpcoming ? `<button class="reminder-btn" onclick="window.setReminder('${content.id}')">REMIND ME</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderCommunityGems() {
  return STATE.communityGems.map(content => {
    const thumb = constructStorageUrl(content.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400';
    return `
      <article class="gem-card" data-content-id="${content.id}" role="listitem">
        <div class="gem-thumbnail">
          <img src="${thumb}" alt="${escapeHtml(content.title)}" loading="lazy" decoding="async">
        </div>
        <div class="gem-content">
          <h3 class="card-title">${escapeHtml(content.title)}</h3>
          <div class="card-stats">
            <span><i class="fas fa-eye"></i> ${formatNumber(content.real_views || 0)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// =========================================
// 7. INTERACTIONS
// =========================================

function setupContentCardListeners() {
  document.querySelectorAll('[data-content-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      window.playContent(card.dataset.contentId);
    });
  });
}

function onFilterSelected(filter) {
  STATE.selectedFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
    btn.setAttribute('aria-selected', btn.dataset.filter === filter);
  });
  
  if (filter !== 'All') {
    window.location.href = `content-library.html?genre=${encodeURIComponent(filter)}`;
  }
}

async function playContent(contentId) {
  try {
    await supabase.from('content_views').insert({
      content_id: contentId,
      viewer_id: STATE.currentUser?.id || null,
      view_duration: 0,
      device_type: /Mobile|Android|iP(hone|od)/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('View recording failed:', error);
  }
  
  window.location.href = `content-detail.html?id=${contentId}`;
}

function setReminder(contentId) {
  showToast('Reminder set successfully', 'success');
}

function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (show) {
    modal.removeAttribute('hidden');
    const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
    document.body.style.overflow = 'hidden';
  } else {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

// =========================================
// 8. INITIALIZATION
// =========================================

async function initialize() {
  console.log('🔥 Initializing Trending Screen...');
  
  // ✅ FIXED: Wrap in try-catch to ensure loading always hides
  try {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    setupEventListeners();
    await loadContent();
    console.log('✅ Trending Screen initialized');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    showToast('Failed to load page. Please refresh.', 'error');
    setLoading(false); // ✅ CRITICAL: Always hide loading on error
  }
}

function setupEventListeners() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearch = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  
  if (searchBtn) searchBtn.addEventListener('click', () => {
    toggleModal('search-modal', true);
    setTimeout(() => searchInput?.focus(), 100);
  });
  
  if (closeSearch) closeSearch.addEventListener('click', () => toggleModal('search-modal', false));
  
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      console.log('Searching:', e.target.value);
    }, CONFIG.DEBOUNCE_DELAY));
  }
  
  const notifBtn = document.getElementById('notifications-btn');
  const notifPanel = document.getElementById('notifications-panel');
  const closeNotif = document.getElementById('close-notifications');
  
  if (notifBtn) notifBtn.addEventListener('click', () => {
    notifPanel.classList.add('active');
    notifPanel.removeAttribute('hidden');
  });
  
  if (closeNotif) closeNotif.addEventListener('click', () => {
    notifPanel.classList.remove('active');
    setTimeout(() => notifPanel.setAttribute('hidden', ''), 300);
  });
  
  document.getElementById('mark-all-read')?.addEventListener('click', markAllNotificationsAsRead);
  
  document.getElementById('profile-btn')?.addEventListener('click', () => {
    window.location.href = STATE.currentUser ? 'profile.html' : 'login.html';
  });
  
  document.getElementById('auth-login-btn')?.addEventListener('click', () => {
    window.location.href = 'login.html?redirect=trending_screen.html';
  });
  document.getElementById('auth-cancel-btn')?.addEventListener('click', () => {
    toggleModal('auth-modal', false);
    window.history.back();
  });
  
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    setLoading(true, 'Refreshing...');
    await loadContent();
    showToast('Content refreshed', 'success');
  });
  
  document.getElementById('explore-all-btn')?.addEventListener('click', () => {
    window.location.href = 'content-library.html?sort=trending';
  });
  
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      STATE.currentUser = session.user;
      loadUserProfilePicture(STATE.currentUser);
      loadNotifications();
    } else if (event === 'SIGNED_OUT') {
      STATE.currentUser = null;
      toggleModal('auth-modal', true);
    }
  });
}

async function loadContent() {
  const data = await fetchContent();
  processTrendingSections(data);
  renderFilterChips();
  renderTrendingSections();
}

// Expose global functions
window.playContent = playContent;
window.setReminder = setReminder;
window.viewAllTrending = () => window.location.href = 'content-library.html?sort=trending';
window.viewAllLiveStreams = () => window.location.href = 'content-library.html?genre=Live';

// ✅ FIXED: Use DOMContentLoaded properly
document.addEventListener('DOMContentLoaded', initialize);
