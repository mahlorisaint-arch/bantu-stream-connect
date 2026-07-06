(function() {
// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL STATE =====
window.currentUser = null;
window.notifications = [];
window.creatorId = null;
window.creatorProfile = null;
window.isConnected = false;
window.connectorCount = 0;
window.creatorContent = [];
window.playlists = [];
window.loadingText = null;
window.currentPlaylist = null;
window.playlistItems = [];
window.creatorLibrary = [];
window.currentTab = 'home';
window.streakCount = 0;
window.fanComments = [];
window.pollData = null;
window.creatorPosts = [];
window.contentTypeColors = {
  'Series': '#04342C',
  'Short': '#712B13',
  'Podcast': '#26215C',
  'Video': '#1D4ED8',
  'Music': '#EC4899',
  'Film': '#8B5CF6',
  'Documentary': '#0F766E',
  'STEM': '#0E7490',
  'Culture': '#B45309',
  'News': '#1F2937',
  'Sports': '#DC2626',
  'Other': '#6B7280'
};

// ===== HELPER FUNCTIONS =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {error:'fa-exclamation-triangle', success:'fa-check-circle', warning:'fa-exclamation-circle', info:'fa-info-circle'};
  toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatNumber(num) {
  if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num/1000).toFixed(1) + 'K';
  return num.toString();
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays/7)} week${Math.floor(diffDays/7)>1?'s':''} ago`;
    return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  } catch { return ''; }
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs/60000);
  const diffHours = Math.floor(diffMs/3600000);
  const diffDays = Math.floor(diffMs/86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function getInitials(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  return names.length >= 2 ? (names[0][0] + names[names.length-1][0]).toUpperCase() : name[0].toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return url;
  return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function showConfetti() {
  const colors = ['#F59E0B', '#1D4ED8', '#10B981', '#EC4899', '#8B5CF6'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3000);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getContentType(content) {
  return content.content_format || content.media_type || 'Video';
}

function getContentTypeColor(type) {
  return window.contentTypeColors[type] || '#6B7280';
}

// ===== COMPUTE REAL STREAK COUNT =====
function computeStreakCount(contentArray) {
  if (!contentArray || contentArray.length === 0) return 0;
  
  // Get unique dates of uploads
  const dates = contentArray
    .map(c => new Date(c.created_at))
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a);
  
  if (dates.length === 0) return 0;
  
  // Check for consecutive days from most recent
  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const mostRecent = new Date(dates[0]);
  mostRecent.setHours(0, 0, 0, 0);
  
  // If most recent upload is more than 1 day ago, streak is 0
  const daysSinceLastUpload = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24));
  if (daysSinceLastUpload > 1) return 0;
  
  // Count consecutive days backwards
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i]);
    current.setHours(0, 0, 0, 0);
    const prev = new Date(dates[i-1]);
    prev.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((prev - current) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else if (diffDays > 1) {
      break;
    }
  }
  
  return streak;
}

// ===== COMPUTE CONTENT MIX =====
function computeContentMix(contentArray) {
  const mix = {};
  contentArray.forEach(c => {
    const type = getContentType(c);
    mix[type] = (mix[type] || 0) + 1;
  });
  
  const total = contentArray.length || 1;
  const result = [];
  Object.keys(mix).forEach(type => {
    result.push({
      type: type,
      count: mix[type],
      percentage: Math.round((mix[type] / total) * 100),
      color: getContentTypeColor(type)
    });
  });
  
  return result.sort((a, b) => b.count - a.count);
}

// ===== LOAD CONTENT WITH ENGAGEMENT STATS =====
async function loadContentWithEngagementStats(creatorId, limit = 50) {
  const { data, error } = await supabase
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
      genre,
      created_at,
      user_id,
      is_pinned,
      is_channel_trailer,
      is_original,
      status,
      live_views,
      favorites_count,
      comments_count,
      shares_count,
      season_number,
      episode_number,
      episode_title,
      user_profiles!user_id (
        id,
        full_name,
        username,
        avatar_url
      ),
      content_engagement_stats (
        total_views,
        total_likes,
        total_comments,
        total_valid_views
      )
    `)
    .eq('user_id', creatorId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error loading content with engagement stats:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    ...item,
    views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
    likes_count: item.content_engagement_stats?.total_likes || 0,
    comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
    favorites_count: item.favorites_count || 0,
    valid_views_count: item.content_engagement_stats?.total_valid_views || 0
  }));
}

// ===== LOAD CREATOR POSTS =====
async function loadCreatorPosts(creatorId) {
  try {
    const { data, error } = await supabase
      .from('creator_posts')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) throw error;
    window.creatorPosts = data || [];
    return window.creatorPosts;
  } catch (error) {
    console.error('Error loading creator posts:', error);
    window.creatorPosts = [];
    return [];
  }
}

// ===== LOAD POLL DATA =====
async function loadPollData(creatorId) {
  try {
    const { data, error } = await supabase
      .from('polls')
      .select(`
        *,
        poll_options (*),
        poll_votes (count)
      `)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error) throw error;
    
    if (data && data.length > 0) {
      const poll = data[0];
      const options = poll.poll_options || [];
      const totalVotes = poll.poll_votes?.[0]?.count || 0;
      
      window.pollData = {
        id: poll.id,
        question: poll.question,
        options: options.map(o => ({
          id: o.id,
          label: o.option_text,
          votes: o.vote_count || 0
        })),
        totalVotes: totalVotes,
        daysLeft: Math.max(0, Math.floor((new Date(poll.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
      };
    } else {
      // Create default poll if none exists
      window.pollData = null;
    }
    
    return window.pollData;
  } catch (error) {
    console.error('Error loading poll data:', error);
    window.pollData = null;
    return null;
  }
}

// ===== LOAD PLAYLISTS WITH JUNCTION TABLE =====
async function loadPlaylistsWithItems(creatorId) {
  console.log('🔄 Loading playlists using TWO-QUERY approach...');
  
  let playlistsQuery = supabase
    .from('creator_playlists')
    .select('*')
    .eq('creator_id', creatorId);
    
  if (!window.currentUser || window.currentUser.id !== creatorId) {
    playlistsQuery = playlistsQuery.eq('visibility', 'public');
  }
  
  const { data: playlistsData, error: playlistsError } = await playlistsQuery.order('created_at', { ascending: false });
  
  if (playlistsError || !playlistsData || playlistsData.length === 0) {
    return [];
  }
  
  const playlistIds = playlistsData.map(p => p.id);
  
  const { data: playlistContentsRows, error: contentsError } = await supabase
    .from('playlist_contents')
    .select(`
      id,
      playlist_id,
      content_id,
      sort_index,
      item_type,
      track_number,
      disc_number,
      season_number,
      display_title_override
    `)
    .in('playlist_id', playlistIds)
    .order('sort_index', { ascending: true });
    
  if (contentsError || !playlistContentsRows || playlistContentsRows.length === 0) {
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  const contentIds = [...new Set(playlistContentsRows.map(row => row.content_id).filter(Boolean))];
  
  if (contentIds.length === 0) {
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  const { data: contentRows, error: contentError } = await supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      content_format,
      status,
      live_views,
      favorites_count,
      comments_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .in('id', contentIds)
    .eq('status', 'published');
    
  if (contentError) {
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  const contentMap = new Map();
  (contentRows || []).forEach(content => {
    contentMap.set(String(content.id), {
      ...content,
      views_count: content.content_engagement_stats?.total_views || content.live_views || 0,
      likes_count: content.content_engagement_stats?.total_likes || 0,
      favorites_count: content.favorites_count || 0
    });
  });
  
  const itemsByPlaylist = {};
  playlistContentsRows.forEach(row => {
    const content = contentMap.get(String(row.content_id));
    if (!content) return;
    if (!itemsByPlaylist[row.playlist_id]) {
      itemsByPlaylist[row.playlist_id] = [];
    }
    itemsByPlaylist[row.playlist_id].push({
      ...row,
      Content: content
    });
  });
  
  Object.keys(itemsByPlaylist).forEach(playlistId => {
    itemsByPlaylist[playlistId].sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
  });
  
  return playlistsData.map(playlist => ({
    ...playlist,
    playlist_contents: itemsByPlaylist[playlist.id] || [],
    item_count: itemsByPlaylist[playlist.id]?.length || 0
  }));
}

// ===== THEME SYSTEM =====
function initThemeSystem() {
  console.log('🎨 Initializing theme system...');
  const sidebarThemeToggle = document.getElementById('sidebar-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  
  if (!sidebarThemeToggle || !themeSelector) {
    console.warn('Theme elements not found');
    return;
  }
  
  const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
  applyTheme(savedTheme);
  
  const newToggle = sidebarThemeToggle.cloneNode(true);
  sidebarThemeToggle.parentNode.replaceChild(newToggle, sidebarThemeToggle);
  
  newToggle.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    themeSelector.classList.toggle('active');
  });
  
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    const newOption = option.cloneNode(true);
    option.parentNode.replaceChild(newOption, option);
    
    newOption.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const theme = this.dataset.theme;
      applyTheme(theme);
      themeSelector.classList.remove('active');
    });
  });
  
  document.addEventListener('click', function(e) {
    if (themeSelector.classList.contains('active') &&
        !themeSelector.contains(e.target) &&
        e.target !== newToggle &&
        !newToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
}

function applyTheme(theme) {
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    theme = 'dark';
  }
  
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  document.body.classList.add(`theme-${theme}`);
  
  document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  document.documentElement.classList.add(`theme-${theme}`);
  
  const root = document.documentElement;
  
  if (theme === 'light') {
    root.style.setProperty('--deep-black', '#F8FAFC');
    root.style.setProperty('--deep-navy', '#E2E8F0');
    root.style.setProperty('--soft-white', '#0F172A');
    root.style.setProperty('--slate-grey', '#475569');
    root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.85)');
    root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--bantu-blue', '#1D4ED8');
    root.style.setProperty('--warm-gold', '#F59E0B');
  } else if (theme === 'high-contrast') {
    root.style.setProperty('--deep-black', '#000000');
    root.style.setProperty('--deep-navy', '#050505');
    root.style.setProperty('--soft-white', '#FFFFFF');
    root.style.setProperty('--slate-grey', '#CCCCCC');
    root.style.setProperty('--bantu-blue', '#FFD700');
    root.style.setProperty('--warm-gold', '#00FFFF');
    root.style.setProperty('--card-bg', '#0A0A0A');
    root.style.setProperty('--card-border', '#FFFFFF');
  } else {
    root.style.setProperty('--deep-black', '#0A0E12');
    root.style.setProperty('--deep-navy', '#0F172A');
    root.style.setProperty('--soft-white', '#F8FAFC');
    root.style.setProperty('--slate-grey', '#94A3B8');
    root.style.setProperty('--bantu-blue', '#1D4ED8');
    root.style.setProperty('--warm-gold', '#F59E0B');
    root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
    root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
  }
  
  localStorage.setItem('bantu_theme', theme);
  
  document.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === theme) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// ===== UI SCALE CONTROLS =====
class UIScaleController {
  constructor() {
    this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
    this.minScale = 0.8;
    this.maxScale = 1.4;
    this.step = 0.1;
  }
  
  init() {
    this.applyScale();
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('scaleChanged', (e) => {
      this.updateScaleDisplay(e.detail.scale);
    });
  }
  
  applyScale() {
    document.documentElement.style.setProperty('--ui-scale', this.scale);
    localStorage.setItem('bantu_ui_scale', this.scale.toString());
    document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: this.scale } }));
  }
  
  increase() {
    if (this.scale < this.maxScale) {
      this.scale = Math.min(this.maxScale, this.scale + this.step);
      this.applyScale();
    }
  }
  
  decrease() {
    if (this.scale > this.minScale) {
      this.scale = Math.max(this.minScale, this.scale - this.step);
      this.applyScale();
    }
  }
  
  reset() {
    this.scale = 1;
    this.applyScale();
  }
  
  getScale() { return this.scale; }
  
  updateScaleDisplay(scale) {
    const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
    displays.forEach(el => {
      if (el) el.textContent = Math.round(scale * 100) + '%';
    });
  }
}

function setupScaleControls() {
  const decreaseBtn = document.getElementById('sidebar-scale-decrease');
  const increaseBtn = document.getElementById('sidebar-scale-increase');
  const resetBtn = document.getElementById('sidebar-scale-reset');
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.decrease();
    });
  }
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.increase();
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.reset();
    });
  }
}

// ===== SIDEBAR SETUP =====
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
    e.preventDefault();
    e.stopPropagation();
    openSidebar();
  });
  
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) closeSidebar();
  });
}

// ===== NAVIGATION BUTTONS =====
function setupNavigationButtons() {
  const navHome = document.getElementById('nav-home-btn');
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
  
  const navHistory = document.getElementById('nav-history-btn');
  if (navHistory) {
    navHistory.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const navCreate = document.getElementById('nav-create-btn');
  if (navCreate) {
    navCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to create content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  const navMenu = document.getElementById('nav-menu-btn');
  if (navMenu) {
    navMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sidebarMenu = document.getElementById('sidebar-menu');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebarMenu && sidebarOverlay) {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }
}

// ===== TABS SETUP (FIXED - ALL TABS WORK) =====
function setupTabs() {
  const tabs = document.querySelectorAll('.channel-tab');
  const panels = document.querySelectorAll('.tab-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      tabs.forEach(t => {
        t.classList.remove('is-active');
      });
      tab.classList.add('is-active');
      
      panels.forEach(panel => {
        if (panel.dataset.panel === target) {
          panel.hidden = false;
          // Render the appropriate tab
          switch(target) {
            case 'home': renderHomeTab(); break;
            case 'series': renderSeriesTab(); break;
            case 'shorts': renderShortsTab(); break;
            case 'podcast': renderPodcastTab(); break;
            case 'community': renderCommunityTab(); break;
            case 'about': renderAboutTab(); break;
            default: break;
          }
        } else {
          panel.hidden = true;
        }
      });
      
      window.currentTab = target;
    });
  });
}

// ===== RENDER HOME TAB =====
function renderHomeTab() {
  renderFeaturedCard();
  renderWorldRow();
  renderUploadGrid('all');
}

// ===== RENDER SERIES TAB (NEW) =====
function renderSeriesTab() {
  const main = document.querySelector('[data-panel="series"] .channel-main');
  if (!main) return;
  
  const seriesContent = window.creatorContent.filter(c => 
    getContentType(c) === 'Series' || c.content_format === 'series'
  );
  
  if (seriesContent.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-tv"></i></div>
        <h3>No Series Yet</h3>
        <p>This creator hasn't published any series content</p>
      </div>
    `;
    return;
  }
  
  // Group by season
  const seasons = {};
  seriesContent.forEach(c => {
    const season = c.season_number || 1;
    if (!seasons[season]) seasons[season] = [];
    seasons[season].push(c);
  });
  
  const sortedSeasons = Object.keys(seasons).sort((a, b) => b - a);
  
  let html = `<div class="series-container">`;
  
  sortedSeasons.forEach(season => {
    const episodes = seasons[season].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
    html += `
      <div class="series-season">
        <div class="season-header">
          <h3 class="season-title">Season ${season}</h3>
          <span class="season-episode-count">${episodes.length} episode${episodes.length > 1 ? 's' : ''}</span>
        </div>
        <div class="upload-grid">
    `;
    
    episodes.forEach(item => {
      html += createUploadCardHTML(item);
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  main.innerHTML = html;
  
  // Add click handlers
  main.querySelectorAll('.upload-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// ===== RENDER SHORTS TAB (NEW) =====
function renderShortsTab() {
  const main = document.querySelector('[data-panel="shorts"] .channel-main');
  if (!main) return;
  
  const shortsContent = window.creatorContent.filter(c => 
    getContentType(c) === 'Short' || c.media_type === 'short'
  );
  
  if (shortsContent.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-bolt"></i></div>
        <h3>No Shorts Yet</h3>
        <p>This creator hasn't published any shorts</p>
      </div>
    `;
    return;
  }
  
  let html = `<div class="upload-grid">`;
  shortsContent.forEach(item => {
    html += createUploadCardHTML(item);
  });
  html += `</div>`;
  main.innerHTML = html;
  
  main.querySelectorAll('.upload-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// ===== RENDER PODCAST TAB (NEW) =====
function renderPodcastTab() {
  const main = document.querySelector('[data-panel="podcast"] .channel-main');
  if (!main) return;
  
  const podcastContent = window.creatorContent.filter(c => 
    getContentType(c) === 'Podcast' || c.content_format === 'podcast'
  );
  
  if (podcastContent.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-podcast"></i></div>
        <h3>No Podcasts Yet</h3>
        <p>This creator hasn't published any podcasts</p>
      </div>
    `;
    return;
  }
  
  let html = `<div class="upload-grid podcast-grid">`;
  podcastContent.forEach(item => {
    // Podcasts get a slightly different card with episode number
    html += `
      <div class="upload-card podcast-card" data-content-id="${item.id}">
        <div class="upload-card__thumb" style="background-image:url(${fixMediaUrl(item.thumbnail_url || 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=225&fit=crop')});">
          <span class="upload-card__badge" style="background:#26215C;color:#CECBF6;">Podcast</span>
          ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
        </div>
        <p class="upload-card__title">${escapeHtml(item.episode_title || item.title || 'Untitled')}</p>
        <p class="upload-card__meta">Episode ${item.episode_number || 1} · ${formatNumber(item.views_count || 0)} views · ${formatTimeAgo(item.created_at)}</p>
      </div>
    `;
  });
  html += `</div>`;
  main.innerHTML = html;
  
  main.querySelectorAll('.upload-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// ===== CREATE UPLOAD CARD HTML (REUSABLE) =====
function createUploadCardHTML(item) {
  const type = getContentType(item);
  const color = getContentTypeColor(type);
  const thumbnail = fixMediaUrl(item.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop');
  
  return `
    <div class="upload-card" data-content-id="${item.id}">
      <div class="upload-card__thumb" style="background-image:url(${thumbnail});">
        <span class="upload-card__badge" style="background:${color};color:white;">${escapeHtml(type)}</span>
        ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
      </div>
      <p class="upload-card__title">${escapeHtml(item.title || 'Untitled')}</p>
      <p class="upload-card__meta">${formatNumber(item.views_count || 0)} views · ${formatTimeAgo(item.created_at)}</p>
    </div>
  `;
}

// ===== RENDER FEATURED CARD =====
function renderFeaturedCard() {
  const card = document.getElementById('featured-card');
  if (!card) return;
  
  const pinned = window.creatorContent.find(c => c.is_pinned === true);
  const featured = pinned || (window.creatorContent.length > 0 ? window.creatorContent[0] : null);
  
  if (!featured) {
    card.style.display = 'none';
    return;
  }
  
  card.style.display = 'block';
  card.style.backgroundImage = `url(${fixMediaUrl(featured.thumbnail_url || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&h=450&fit=crop')})`;
  
  const badge = document.getElementById('featured-badge');
  if (badge) {
    badge.textContent = featured.is_pinned ? '📌 Pinned' : 'New';
  }
  
  const duration = document.getElementById('featured-duration');
  if (duration) {
    duration.textContent = featured.duration ? formatDuration(featured.duration) : '0:00';
  }
  
  const title = document.getElementById('featured-title');
  if (title) {
    title.textContent = featured.title || 'Featured Content';
  }
  
  const meta = document.getElementById('featured-meta');
  if (meta) {
    meta.textContent = `${formatNumber(featured.views_count || 0)} views · ${formatTimeAgo(featured.created_at)}`;
  }
  
  card.onclick = () => {
    window.location.href = `content-detail.html?id=${featured.id}`;
  };
}

// ===== RENDER WORLD ROW (FIXED - USES CONTENT TYPE COLORS) =====
function renderWorldRow() {
  const mobileRow = document.getElementById('world-row-mobile');
  const desktopRow = document.getElementById('world-row-desktop');
  
  if (!mobileRow && !desktopRow) return;
  
  // Get unique content types from actual content
  const typeCounts = {};
  window.creatorContent.forEach(c => {
    const type = getContentType(c);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  const worldItems = Object.keys(typeCounts)
    .sort((a, b) => typeCounts[b] - typeCounts[a])
    .slice(0, 6)
    .map(type => ({
      label: type,
      color: getContentTypeColor(type)
    }));
  
  if (worldItems.length === 0) {
    if (mobileRow) mobileRow.style.display = 'none';
    if (desktopRow) desktopRow.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">No content types yet</p>';
    return;
  }
  
  const renderItems = (container) => {
    if (!container) return;
    container.innerHTML = worldItems.map(item => `
      <div class="world-item">
        <div class="world-item__thumb" style="background:${item.color};"></div>
        <p class="world-item__label">${escapeHtml(item.label)}</p>
      </div>
    `).join('');
  };
  
  if (mobileRow) {
    mobileRow.style.display = 'block';
    renderItems(mobileRow);
  }
  
  if (desktopRow) {
    renderItems(desktopRow);
  }
}

// ===== RENDER UPLOAD GRID =====
function renderUploadGrid(filter = 'all') {
  const grid = document.getElementById('upload-grid');
  const noContent = document.getElementById('no-content');
  
  if (!grid) return;
  
  let content = window.creatorContent || [];
  
  // Apply filter
  if (filter !== 'all') {
    content = content.filter(c => getContentType(c).toLowerCase() === filter);
  }
  
  if (content.length === 0) {
    grid.innerHTML = '';
    if (noContent) noContent.style.display = 'block';
    return;
  }
  
  if (noContent) noContent.style.display = 'none';
  
  const sorted = [...content].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  }).slice(0, 6);
  
  grid.innerHTML = sorted.map(item => createUploadCardHTML(item)).join('');
  
  grid.querySelectorAll('.upload-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// ===== RENDER COMMUNITY TAB =====
function renderCommunityTab() {
  renderPinnedPost();
  renderPoll();
  renderFanWall();
  renderLeaderboard();
}

// ===== RENDER PINNED POST (FIXED - USES CREATOR POSTS) =====
function renderPinnedPost() {
  const post = document.getElementById('pinned-post');
  if (!post) return;
  
  // Check for pinned creator post
  const pinnedPost = window.creatorPosts.find(p => p.is_pinned === true);
  
  if (pinnedPost) {
    post.style.display = 'flex';
    const creator = document.getElementById('pinned-post-creator');
    if (creator) {
      creator.textContent = window.creatorProfile?.full_name || window.creatorProfile?.username || 'Creator';
    }
    const content = document.getElementById('pinned-post-content');
    if (content) {
      content.textContent = pinnedPost.content || 'No content';
    }
    return;
  }
  
  // Fallback: use pinned content or fan comment
  const pinnedContent = window.creatorContent.find(c => c.is_pinned === true);
  
  if (!pinnedContent && window.fanComments.length === 0) {
    post.style.display = 'none';
    return;
  }
  
  post.style.display = 'flex';
  
  const creator = document.getElementById('pinned-post-creator');
  if (creator) {
    creator.textContent = window.creatorProfile?.full_name || window.creatorProfile?.username || 'Creator';
  }
  
  const content = document.getElementById('pinned-post-content');
  if (content) {
    if (pinnedContent) {
      content.textContent = `Check out "${pinnedContent.title}" - ${truncateText(pinnedContent.description || 'Featured content from the creator', 100)}`;
    } else if (window.fanComments.length > 0) {
      content.textContent = `"${truncateText(window.fanComments[0].comment_text || 'Fan comment', 100)}"`;
    } else {
      content.textContent = 'Welcome to the community!';
    }
  }
}

// ===== RENDER POLL (FIXED - REAL DATA) =====
function renderPoll() {
  const pollSection = document.getElementById('poll-section');
  if (!pollSection) return;
  
  if (!window.pollData) {
    pollSection.style.display = 'none';
    return;
  }
  
  pollSection.style.display = 'block';
  
  const label1 = document.getElementById('poll-option-1-label');
  const pct1 = document.getElementById('poll-option-1-pct');
  const fill1 = document.getElementById('poll-option-1-fill');
  const label2 = document.getElementById('poll-option-2-label');
  const pct2 = document.getElementById('poll-option-2-pct');
  const fill2 = document.getElementById('poll-option-2-fill');
  const meta = document.getElementById('poll-meta');
  const question = pollSection.querySelector('.section-label');
  
  if (question) {
    question.textContent = window.pollData.question || 'What should we make next?';
  }
  
  if (window.pollData.options.length >= 2) {
    const total = window.pollData.totalVotes || 1;
    const pct1Val = Math.round((window.pollData.options[0].votes / total) * 100);
    const pct2Val = 100 - pct1Val;
    
    if (label1) label1.textContent = window.pollData.options[0].label;
    if (pct1) pct1.textContent = `${pct1Val}%`;
    if (fill1) fill1.style.width = `${pct1Val}%`;
    
    if (label2) label2.textContent = window.pollData.options[1].label;
    if (pct2) pct2.textContent = `${pct2Val}%`;
    if (fill2) fill2.style.width = `${pct2Val}%`;
  }
  
  if (meta) {
    meta.textContent = `${formatNumber(window.pollData.totalVotes)} votes · ${window.pollData.daysLeft} days left`;
  }
}

// ===== RENDER FAN WALL =====
async function renderFanWall() {
  const wall = document.getElementById('fan-wall');
  if (!wall) return;
  
  const contentIds = window.creatorContent.map(c => c.id);
  
  if (contentIds.length === 0) {
    wall.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px;">No fan comments yet</p>';
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        comment_text,
        created_at,
        likes_count,
        user_id,
        user_profiles!user_id (
          full_name,
          username,
          avatar_url
        )
      `)
      .in('content_id', contentIds)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) throw error;
    
    window.fanComments = data || [];
    
    if (window.fanComments.length === 0) {
      wall.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px;">Be the first to comment!</p>';
      return;
    }
    
    wall.innerHTML = window.fanComments.map(comment => {
      const name = comment.user_profiles?.full_name || comment.user_profiles?.username || 'Fan';
      const avatar = comment.user_profiles?.avatar_url ? fixMediaUrl(comment.user_profiles.avatar_url) : null;
      const avatarBg = ['#4A1B0C', '#26215C', '#04342C', '#1D4ED8', '#F59E0B'][Math.floor(Math.random() * 5)];
      
      return `
        <div class="fan-post">
          <div class="fan-post__avatar" style="background:${avatarBg};${avatar ? `background-image:url(${avatar});background-size:cover;` : ''}"></div>
          <div class="fan-post__bubble">
            <p class="fan-name">${escapeHtml(name)}</p>
            <p class="fan-comment">${escapeHtml(truncateText(comment.comment_text || '', 100))}</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading fan comments:', error);
    wall.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px;">Could not load comments</p>';
  }
}

// ===== RENDER LEADERBOARD =====
async function renderLeaderboard() {
  const board = document.getElementById('leaderboard');
  if (!board) return;
  
  const contentIds = window.creatorContent.map(c => c.id);
  
  if (contentIds.length === 0) {
    board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">No activity yet</p>';
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        user_id,
        user_profiles!user_id (
          full_name,
          username,
          avatar_url
        )
      `)
      .in('content_id', contentIds);
      
    if (error) throw error;
    
    const userCounts = {};
    (data || []).forEach(comment => {
      if (comment.user_id) {
        userCounts[comment.user_id] = (userCounts[comment.user_id] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (sorted.length === 0) {
      board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">No top voices yet</p>';
      return;
    }
    
    const userIds = sorted.map(([id]) => id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds);
      
    const profileMap = {};
    (profiles || []).forEach(p => {
      profileMap[p.id] = p;
    });
    
    board.innerHTML = sorted.map(([userId, count], index) => {
      const profile = profileMap[userId];
      const name = profile?.full_name || profile?.username || 'User';
      const avatar = profile?.avatar_url ? fixMediaUrl(profile.avatar_url) : null;
      const avatarBg = ['#085041', '#26215C', '#4A1B0C', '#1D4ED8', '#F59E0B'][index % 5];
      
      return `
        <div class="leaderboard-row">
          <span class="leaderboard-rank">${index + 1}</span>
          <div class="leaderboard-avatar" style="background:${avatarBg};${avatar ? `background-image:url(${avatar});background-size:cover;` : ''}"></div>
          <div>
            <p class="leaderboard-name">${escapeHtml(name)}</p>
            <p class="leaderboard-meta">${count} comment${count > 1 ? 's' : ''}</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Could not load leaderboard</p>';
  }
}

// ===== RENDER ABOUT TAB (FIXED - REAL DATA) =====
function renderAboutTab() {
  const bioText = document.getElementById('about-bio-text');
  const joined = document.getElementById('about-joined');
  const totalViews = document.getElementById('about-total-views');
  const totalUploads = document.getElementById('about-total-uploads');
  const streak = document.getElementById('about-streak');
  const originals = document.getElementById('about-originals');
  const timeline = document.getElementById('journey-timeline');
  const contentMixBar = document.getElementById('content-mix-bar');
  const contentMixLegend = document.getElementById('content-mix-legend');
  
  // Bio
  if (bioText && window.creatorProfile) {
    bioText.textContent = window.creatorProfile.bio || 'Passionate content creator sharing authentic African stories.';
  }
  
  // Joined
  if (joined && window.creatorProfile) {
    const date = window.creatorProfile.created_at ? new Date(window.creatorProfile.created_at) : new Date();
    const location = window.creatorProfile.location || 'Johannesburg, South Africa';
    joined.textContent = `Joined Bantu Stream Connect · ${date.toLocaleString('default', { month: 'long', year: 'numeric' })} · ${location}`;
  }
  
  // Total Views
  if (totalViews) {
    const sum = window.creatorContent.reduce((s, c) => s + (c.views_count || 0), 0);
    totalViews.textContent = formatNumber(sum);
  }
  
  // Total Uploads
  if (totalUploads) {
    totalUploads.textContent = window.creatorContent.length;
  }
  
  // REAL Streak Count
  if (streak) {
    window.streakCount = computeStreakCount(window.creatorContent);
    streak.textContent = window.streakCount;
  }
  
  // REAL Originals Count
  if (originals) {
    const originalsCount = window.creatorContent.filter(c => c.is_original === true).length;
    originals.textContent = originalsCount || 0;
  }
  
  // CONTENT MIX BAR (FIXED - REAL DATA)
  if (contentMixBar && contentMixLegend) {
    const mix = computeContentMix(window.creatorContent);
    
    if (mix.length === 0) {
      contentMixBar.innerHTML = '<div style="width:100%;background:#6B7280;"></div>';
      contentMixLegend.innerHTML = '<span>No content yet</span>';
    } else {
      // Build the bar
      contentMixBar.innerHTML = mix.map(item => `
        <div style="width:${item.percentage}%;background:${item.color};"></div>
      `).join('');
      
      // Build the legend
      contentMixLegend.innerHTML = mix.map(item => `
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:4px;"></span> ${escapeHtml(item.type)} ${item.percentage}%</span>
      `).join('');
    }
  }
  
  // Journey Timeline
  if (timeline) {
    const milestones = [];
    
    if (window.creatorProfile?.created_at) {
      const startDate = new Date(window.creatorProfile.created_at);
      milestones.push({
        date: startDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
        title: 'First upload',
        desc: 'Started creating on Bantu Stream Connect',
        color: '#5DCAA5'
      });
    }
    
    if (window.creatorContent.length >= 10) {
      milestones.push({
        date: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        title: '10+ uploads',
        desc: 'Building the content library',
        color: '#7F77DD'
      });
    }
    
    if (window.connectorCount >= 100) {
      milestones.push({
        date: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        title: '100+ connectors',
        desc: 'Growing the community',
        color: 'var(--accent-streak)'
      });
    }
    
    if (window.creatorContent.some(c => c.is_original === true)) {
      milestones.push({
        date: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        title: 'Bantu Original created',
        desc: 'Official Bantu Stream Connect original content',
        color: '#F59E0B'
      });
    }
    
    if (milestones.length === 0) {
      milestones.push({
        date: 'Just getting started',
        title: 'Welcome!',
        desc: 'The journey begins here',
        color: '#6B7280'
      });
    }
    
    timeline.innerHTML = milestones.map((m, index) => `
      <div class="journey-item">
        <div class="journey-dot" style="background:${m.color};"></div>
        <div>
          <p class="journey-item__title">${escapeHtml(m.date)} — ${escapeHtml(m.title)}</p>
          <p class="journey-item__desc">${escapeHtml(m.desc)}</p>
        </div>
      </div>
    `).join('');
  }
}

// ===== ANALYTICS FUNCTIONS =====
function initAnalyticsModal() {
  const modal = document.getElementById('analytics-modal');
  if (!modal) return;
  
  const analyticsBtn = document.getElementById('analytics-btn');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => {
      // Check if user is the owner
      if (window.currentUser?.id !== window.creatorId) {
        showToast('Analytics are only available to the channel owner', 'warning');
        return;
      }
      modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const closeBtn = document.getElementById('close-analytics');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

async function loadChannelAnalytics() {
  if (!window.currentUser || !window.creatorContent) return;
  
  const totalViews = window.creatorContent.reduce((s,c) => s + (c.views_count || 0), 0);
  const totalLikes = window.creatorContent.reduce((s,c) => s + (c.likes_count || 0), 0);
  const engagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) + '%' : '0%';
  
  const viewsEl = document.getElementById('analytics-views');
  const connectorsEl = document.getElementById('analytics-connectors');
  const engagementEl = document.getElementById('analytics-engagement');
  const watchTimeEl = document.getElementById('analytics-watch-time');
  
  if (viewsEl) viewsEl.textContent = formatNumber(totalViews);
  if (connectorsEl) connectorsEl.textContent = formatNumber(window.connectorCount || 0);
  if (engagementEl) engagementEl.textContent = engagement;
  if (watchTimeEl) watchTimeEl.textContent = Math.floor(totalViews * 0.65 / 60) + 'm';
  
  const ctx = document.getElementById('channel-engagement-chart');
  if (!ctx) return;
  
  if (window._analyticsChart) window._analyticsChart.destroy();
  
  window._analyticsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Views',
          data: [65, 80, 50, 90, 110, 75, 120],
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Connects',
          data: [12, 19, 15, 25, 22, 30, 35],
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29,78,216,0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'var(--soft-white)'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        }
      }
    }
  });
}

// ===== EDIT ABOUT MODAL (WIRED UP) =====
function showEditAboutModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  const quoteInput = document.getElementById('edit-quote');
  const missionInput = document.getElementById('edit-mission');
  const locationInput = document.getElementById('edit-location');
  const websiteInput = document.getElementById('edit-website');
  const scheduleInput = document.getElementById('edit-schedule');
  const tagsInput = document.getElementById('edit-tags');
  const socialInput = document.getElementById('edit-social');
  const modal = document.getElementById('edit-about-modal');
  
  if (quoteInput) quoteInput.value = window.creatorProfile?.quote || '';
  if (missionInput) missionInput.value = window.creatorProfile?.mission || '';
  if (locationInput) locationInput.value = window.creatorProfile?.location || '';
  if (websiteInput) websiteInput.value = window.creatorProfile?.website_url || '';
  if (scheduleInput) scheduleInput.value = window.creatorProfile?.upload_schedule || '';
  if (tagsInput) tagsInput.value = window.creatorProfile?.interests || '';
  if (socialInput) socialInput.value = window.creatorProfile?.social_links ? JSON.stringify(window.creatorProfile.social_links, null, 2) : '';
  
  if (modal) modal.classList.add('active');
}

function hideEditAboutModal() {
  const modal = document.getElementById('edit-about-modal');
  if (modal) modal.classList.remove('active');
}

async function saveAboutSection() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  try {
    const updates = { updated_at: new Date().toISOString() };
    
    const fields = [
      { id: 'edit-quote', key: 'quote' },
      { id: 'edit-mission', key: 'mission' },
      { id: 'edit-location', key: 'location' },
      { id: 'edit-website', key: 'website_url' },
      { id: 'edit-schedule', key: 'upload_schedule' },
      { id: 'edit-tags', key: 'interests' }
    ];
    
    fields.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value.trim();
        if (val) updates[key] = val;
      }
    });
    
    const socialInput = document.getElementById('edit-social');
    if (socialInput) {
      const socialValue = socialInput.value.trim();
      if (socialValue) {
        try {
          updates.social_links = JSON.parse(socialValue);
        } catch (e) {
          showToast('Invalid JSON for social links', 'warning');
          return;
        }
      }
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', window.creatorId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (data) window.creatorProfile = { ...window.creatorProfile, ...data };
    
    renderAboutTab();
    hideEditAboutModal();
    showToast('About section updated successfully! ✨', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed: ' + (error.message || error.hint || 'Unknown'), 'error');
  }
}

// ===== BANNER FUNCTIONS =====
async function handleBannerUpload(file) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    showToast('Please upload a valid image (JPEG, PNG, or WEBP)', 'error');
    return false;
  }
  
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Image must be less than 20MB', 'error');
    return false;
  }
  
  const progressContainer = document.getElementById('banner-upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');
  
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressText) progressText.textContent = 'Requesting upload URL...';
  
  try {
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('get-upload-url', {
      body: { mediaType: 'banner', fileName: file.name }
    });
    
    if (uploadError) throw new Error(uploadError.message);
    if (!uploadData?.uploadUrl) throw new Error('No upload URL received');
    
    if (progressText) progressText.textContent = 'Uploading to CDN...';
    
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadData.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressFill) {
        const percent = (e.loaded / e.total) * 100;
        progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = `Uploading: ${Math.round(percent)}%`;
      }
    };
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
    
    if (progressText) progressText.textContent = 'Updating profile...';
    
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({ channel_banner_url: uploadData.fileUrl })
      .eq('id', window.creatorId);
      
    if (dbError) throw dbError;
    
    setBannerImage(uploadData.fileUrl);
    showToast('Banner updated successfully! 🎉', 'success');
    
    if (window.creatorProfile) {
      window.creatorProfile.channel_banner_url = uploadData.fileUrl;
    }
    
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
      }, 1000);
    }
    
    return true;
    
  } catch (error) {
    console.error('Banner upload error:', error);
    showToast('Failed to upload banner: ' + error.message, 'error');
    if (progressContainer) progressContainer.style.display = 'none';
    return false;
  }
}

function setBannerImage(url) {
  if (!url) return;
  const banner = document.getElementById('channel-banner');
  if (banner) {
    const cleanUrl = url.replace(/^["']|["']$/g, '');
    banner.style.backgroundImage = `linear-gradient(rgba(10, 14, 18, 0.85), rgba(15, 23, 42, 0.95)), url('${cleanUrl}')`;
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = 'center';
  }
}

function showBannerUploadModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can change the banner', 'warning');
    return;
  }
  
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.add('active');
}

function hideBannerUploadModal() {
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.remove('active');
}

// ===== PROFILE UPDATE (FIXED - FOUNDER + VERIFIED BADGES) =====
async function updateProfileUI() {
  const placeholder = document.getElementById('userProfilePlaceholder');
  const nameEl = document.getElementById('current-profile-name');
  const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
  const sidebarName = document.getElementById('sidebar-profile-name');
  const sidebarEmail = document.getElementById('sidebar-profile-email');
  const creatorAvatar = document.getElementById('creator-avatar-container');
  const creatorInitials = document.getElementById('creator-initials');
  const creatorName = document.getElementById('creator-name');
  const creatorUsername = document.getElementById('creator-username');
  const connectorDisplay = document.getElementById('connector-count-display');
  const streakCount = document.getElementById('streak-count');
  const founderBadge = document.getElementById('founder-badge');
  const verifiedBadge = document.getElementById('verified-badge');
  const creatorBadge = document.getElementById('creator-badge');
  
  if (!placeholder || !nameEl) return;
  
  placeholder.innerHTML = '';
  
  if (window.currentUser) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', window.currentUser.id)
        .maybeSingle();
        
      const displayName = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
      
      nameEl.textContent = displayName;
      if (sidebarName) sidebarName.textContent = displayName;
      if (sidebarEmail) sidebarEmail.textContent = window.currentUser.email || 'user@example.com';
      
      if (profile?.avatar_url) {
        const avatarUrl = fixMediaUrl(profile.avatar_url);
        const img = document.createElement('img');
        img.className = 'profile-img';
        img.src = avatarUrl;
        img.alt = displayName;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        
        img.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'profile-placeholder';
          fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
          fallback.textContent = getInitials(displayName);
          placeholder.innerHTML = '';
          placeholder.appendChild(fallback);
          if (sidebarAvatar) {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback.cloneNode(true));
          }
        };
        
        placeholder.appendChild(img);
        
        if (sidebarAvatar) {
          const sidebarImg = img.cloneNode(true);
          sidebarImg.onload = () => {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(sidebarImg);
          };
          sidebarImg.onerror = () => {
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
            fallback.textContent = getInitials(displayName);
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback);
          };
        }
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
        fallback.textContent = getInitials(displayName);
        placeholder.appendChild(fallback);
        if (sidebarAvatar) {
          const sidebarFallback = fallback.cloneNode(true);
          sidebarAvatar.innerHTML = '';
          sidebarAvatar.appendChild(sidebarFallback);
        }
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    }
  } else {
    nameEl.textContent = 'Guest';
    if (sidebarName) sidebarName.textContent = 'Guest';
    if (sidebarEmail) sidebarEmail.textContent = 'Sign in to continue';
    placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
    if (sidebarAvatar) sidebarAvatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
  }
  
  // Update creator profile section
  if (window.creatorProfile) {
    const displayName = window.creatorProfile.full_name || window.creatorProfile.username || 'Creator';
    if (creatorName) creatorName.textContent = displayName;
    if (creatorUsername) creatorUsername.textContent = `@${window.creatorProfile.username || 'creator'}`;
    if (creatorInitials) creatorInitials.textContent = getInitials(displayName);
    if (connectorDisplay) connectorDisplay.textContent = formatNumber(window.connectorCount || 0);
    
    // REAL streak count
    if (streakCount) {
      window.streakCount = computeStreakCount(window.creatorContent);
      streakCount.textContent = window.streakCount;
    }
    
    // FOUNDER BADGE (FIXED)
    if (founderBadge) {
      founderBadge.style.display = window.creatorProfile.is_founder === true ? 'block' : 'none';
    }
    
    // VERIFIED BADGE (FIXED)
    if (verifiedBadge) {
      verifiedBadge.style.display = window.creatorProfile.is_verified === true ? 'inline' : 'none';
    }
    
    // CREATOR BADGE - derive from dominant content type
    if (creatorBadge) {
      const mix = computeContentMix(window.creatorContent);
      if (mix.length > 0) {
        const dominantType = mix[0].type;
        const labels = {
          'Series': 'Series Creator',
          'Podcast': 'Podcaster',
          'Short': 'Short Creator',
          'Film': 'Filmmaker',
          'Music': 'Musician',
          'Documentary': 'Documentarian',
          'STEM': 'STEM Creator',
          'Culture': 'Cultural Storyteller'
        };
        creatorBadge.textContent = labels[dominantType] || 'Content Creator';
      } else {
        creatorBadge.textContent = 'Content Creator';
      }
    }
    
    // Update avatar
    if (creatorAvatar && window.creatorProfile.avatar_url) {
      const avatarUrl = fixMediaUrl(window.creatorProfile.avatar_url);
      creatorAvatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">`;
    }
  }
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
  try {
    if (!window.currentUser) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await supabase
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

function updateNotificationBadge(count) {
  const mainBadge = document.getElementById('notification-count');
  const sidebarBadge = document.getElementById('sidebar-notification-count');
  
  [mainBadge, sidebarBadge].forEach(badge => {
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (!window.currentUser) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i><p>Sign in to see notifications</p></div>`;
    return;
  }
  
  if (!window.notifications || window.notifications.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3;"></i><p>No notifications yet</p></div>`;
    return;
  }
  
  list.innerHTML = window.notifications.map(n => {
    const icon = getNotificationIcon(n.type);
    const readClass = n.is_read ? 'opacity:0.7;' : 'background:rgba(245,158,11,0.1);';
    const unreadDot = !n.is_read ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--warm-gold);margin-top:5px;"></div>' : '';
    
    return `<div style="padding:15px;border-bottom:1px solid var(--card-border);${readClass}"><div style="display:flex;gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="${icon}" style="font-size:18px;"></i></div><div style="flex:1;"><div style="font-weight:600;margin-bottom:5px;color:var(--soft-white);">${escapeHtml(n.title)}</div><div style="font-size:14px;color:var(--slate-grey);margin-bottom:8px;">${escapeHtml(n.message)}</div><div style="font-size:12px;color:var(--warm-gold);">${formatTimeAgo(n.created_at)}</div></div>${unreadDot}</div></div>`;
  }).join('');
}

function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    default: return 'fas fa-bell';
  }
}

// ===== AUTH CHECK =====
async function checkAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    window.currentUser = data?.session?.user || null;
    
    if (window.currentUser) {
      console.log('✅ User authenticated:', window.currentUser.email);
      await loadUserProfile();
    }
    
    return window.currentUser;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

async function loadUserProfile() {
  try {
    if (!window.currentUser) return;
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle();
      
    if (error) throw error;
    
    updateProfileUI();
    await loadNotifications();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// ===== DATA LOADING FUNCTIONS =====
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

async function loadCreatorData() {
  try {
    window.creatorId = getUrlParam('id');
    if (!window.creatorId) {
      showToast('Creator ID not found', 'error');
      window.location.href = 'content-library.html';
      return;
    }
    
    window.loadingText = document.getElementById('loading-text');
    if (window.loadingText) window.loadingText.textContent = 'Loading creator profile...';
    
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', window.creatorId)
      .maybeSingle();
      
    if (profileError || !profile) {
      showToast('Creator not found', 'error');
      window.location.href = 'content-library.html';
      return;
    }
    
    window.creatorProfile = profile;
    
    // Load banner
    if (profile.channel_banner_url) {
      setBannerImage(profile.channel_banner_url);
    }
    
    if (window.loadingText) window.loadingText.textContent = 'Loading creator content...';
    
    window.creatorContent = await loadContentWithEngagementStats(window.creatorId, 50);
    
    // Compute real streak count
    window.streakCount = computeStreakCount(window.creatorContent);
    
    const { count: connectorCount, error: countError } = await supabase
      .from('connectors')
      .select('*', { count: 'exact', head: true })
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (countError) throw countError;
    window.connectorCount = connectorCount || 0;
    
    if (window.currentUser) {
      const { data: connections } = await supabase
        .from('connectors')
        .select('*')
        .eq('connector_id', window.currentUser.id)
        .eq('connected_id', window.creatorId)
        .eq('connection_type', 'creator')
        .limit(1);
      window.isConnected = connections && connections.length > 0;
    } else {
      window.isConnected = false;
    }
    
    if (window.loadingText) window.loadingText.textContent = 'Loading community data...';
    
    // Load creator posts
    await loadCreatorPosts(window.creatorId);
    
    // Load poll data
    await loadPollData(window.creatorId);
    
    if (window.loadingText) window.loadingText.textContent = 'Loading playlists...';
    
    window.playlists = await loadPlaylistsWithItems(window.creatorId);
    
    const { data: badges } = await supabase.from('user_badges').select('*').eq('user_id', window.creatorId);
    window.achievements = badges || [];
    
    console.log('✅ Creator data loaded:', {
      profile: window.creatorProfile,
      contentCount: window.creatorContent.length,
      connectorCount: window.connectorCount,
      isConnected: window.isConnected,
      playlists: window.playlists.length,
      streakCount: window.streakCount,
      posts: window.creatorPosts.length,
      pollData: window.pollData
    });
    
    // Update all UI
    updateProfileUI();
    updateConnectButton();
    renderHomeTab();
    renderAboutTab();
    
    // Load community data
    await renderCommunityTab();
    
    // Hide loading screen
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loading) loading.style.display = 'none';
    if (app) app.style.display = 'block';
    
  } catch (error) {
    console.error('❌ Error loading creator channel:', error);
    showToast('Failed to load creator channel', 'error');
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 2000);
  }
}

// ===== UPDATE CONNECT BUTTON =====
function updateConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (!btn) return;
  
  if (!window.currentUser) {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Connect';
    btn.onclick = handleLoginRequired;
    return;
  }
  
  if (window.currentUser.id === window.creatorId) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-user"></i> You';
    return;
  }
  
  if (window.isConnected) {
    btn.innerHTML = 'Connected';
    btn.classList.add('connected');
    btn.onclick = handleDisconnect;
  } else {
    btn.innerHTML = 'Connect';
    btn.classList.remove('connected');
    btn.onclick = handleConnect;
  }
}

function handleLoginRequired() {
  showToast('Please log in to connect', 'info');
  window.location.href = `login.html?redirect=creator-channel.html?id=${window.creatorId}`;
}

async function handleConnect() {
  if (!window.currentUser) {
    handleLoginRequired();
    return;
  }
  
  if (window.currentUser.id === window.creatorId) {
    showToast('You cannot connect to your own channel', 'info');
    return;
  }
  
  try {
    const { error } = await supabase.from('connectors').insert({
      connector_id: window.currentUser.id,
      connected_id: window.creatorId,
      connection_type: 'creator',
      created_at: new Date().toISOString()
    });
    
    if (error) throw error;
    
    window.isConnected = true;
    window.connectorCount++;
    updateConnectButton();
    updateProfileUI();
    showConfetti();
    showToast(`Connected with ${window.creatorProfile.full_name || window.creatorProfile.username}!`, 'success');
  } catch (error) {
    console.error('Error connecting:', error);
    showToast('Failed to connect', 'error');
  }
}

async function handleDisconnect() {
  try {
    const { error } = await supabase.from('connectors').delete()
      .eq('connector_id', window.currentUser.id)
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (error) throw error;
    
    window.isConnected = false;
    window.connectorCount = Math.max(0, window.connectorCount - 1);
    updateConnectButton();
    updateProfileUI();
    showToast('Disconnected', 'info');
  } catch (error) {
    console.error('Error disconnecting:', error);
    showToast('Failed to disconnect', 'error');
  }
}

// ===== PLAYLIST BUILDER FUNCTIONS =====
async function loadPlaylistItemsForBuilder(playlistId) {
  const { data: items, error: itemsError } = await supabase
    .from('playlist_contents')
    .select(`
      id,
      playlist_id,
      content_id,
      sort_index,
      item_type,
      track_number,
      disc_number,
      season_number,
      display_title_override
    `)
    .eq('playlist_id', playlistId)
    .order('sort_index', { ascending: true });
    
  if (itemsError || !items || items.length === 0) return [];
  
  const contentIds = items.map(item => item.content_id).filter(Boolean);
  if (contentIds.length === 0) return [];
  
  const { data: contentRows, error: contentError } = await supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      content_format,
      status,
      live_views,
      favorites_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .in('id', contentIds)
    .eq('status', 'published');
    
  if (contentError) return [];
  
  const contentMap = new Map();
  (contentRows || []).forEach(content => {
    contentMap.set(String(content.id), {
      ...content,
      views_count: content.content_engagement_stats?.total_views || content.live_views || 0,
      likes_count: content.content_engagement_stats?.total_likes || 0,
      favorites_count: content.favorites_count || 0
    });
  });
  
  return items.map(item => {
    const content = contentMap.get(String(item.content_id));
    if (!content) return null;
    return {
      ...item,
      Content: content
    };
  }).filter(Boolean);
}

async function addItemToPlaylist(playlistId, contentId, sortIndex = null) {
  let maxSortIndex = 0;
  if (sortIndex === null) {
    const { data: existing } = await supabase
      .from('playlist_contents')
      .select('sort_index')
      .eq('playlist_id', playlistId)
      .order('sort_index', { ascending: false })
      .limit(1);
    maxSortIndex = (existing && existing[0]?.sort_index) || 0;
    sortIndex = maxSortIndex + 1;
  }
  
  const { error } = await supabase
    .from('playlist_contents')
    .insert({
      playlist_id: playlistId,
      content_id: parseInt(contentId),
      sort_index: sortIndex,
      created_at: new Date().toISOString()
    });
    
  if (error) throw error;
  return true;
}

async function removeItemFromPlaylist(playlistContentId) {
  const { error } = await supabase
    .from('playlist_contents')
    .delete()
    .eq('id', playlistContentId);
    
  if (error) throw error;
  return true;
}

async function updatePlaylistItemOrder(playlistId, orderedItemIds) {
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from('playlist_contents')
      .update({ sort_index: i + 1 })
      .eq('id', orderedItemIds[i])
      .eq('playlist_id', playlistId);
      
    if (error) {
      console.error('Error updating item order:', error);
      return false;
    }
  }
  return true;
}

async function savePlaylistV2(playlistData, playlistId = null) {
  const now = new Date().toISOString();
  const data = {
    creator_id: window.creatorId,
    name: playlistData.name,
    description: playlistData.description || '',
    playlist_type: playlistData.playlist_type || 'playlist',
    visibility: playlistData.visibility || 'public',
    is_featured: playlistData.is_featured || false,
    updated_at: now
  };
  
  if (playlistData.custom_thumbnail_url) {
    data.custom_thumbnail_url = playlistData.custom_thumbnail_url;
  }
  
  let result;
  if (playlistId) {
    result = await supabase
      .from('creator_playlists')
      .update(data)
      .eq('id', playlistId)
      .eq('creator_id', window.creatorId)
      .select()
      .single();
  } else {
    data.created_at = now;
    result = await supabase
      .from('creator_playlists')
      .insert([data])
      .select()
      .single();
  }
  
  if (result.error) throw result.error;
  return result.data;
}

async function deletePlaylistV2(playlistId) {
  await supabase
    .from('playlist_contents')
    .delete()
    .eq('playlist_id', playlistId);
    
  const { error } = await supabase
    .from('creator_playlists')
    .delete()
    .eq('id', playlistId)
    .eq('creator_id', window.creatorId);
    
  if (error) throw error;
  return true;
}

function initPlaylistBuilder() {
  const modal = document.getElementById('playlist-builder-modal');
  if (!modal) return;
  
  const newBtn = document.getElementById('new-playlist-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => openPlaylistBuilder());
  }
  
  const closeBtn = document.getElementById('close-pl-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  const saveBtn = document.getElementById('pl-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', savePlaylistV2Wrapper);
  }
  
  const deleteBtn = document.getElementById('pl-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deletePlaylistV2Wrapper);
  }
  
  setupPlaylistTabs();
}

async function openPlaylistBuilder(id = null) {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Creator only', 'warning');
    return;
  }
  
  const plIdInput = document.getElementById('pl-id');
  const plTitleInput = document.getElementById('pl-title');
  const plDescInput = document.getElementById('pl-desc');
  const plTypeSelect = document.getElementById('pl-type');
  const plVisSelect = document.getElementById('pl-vis');
  const plFeaturedCheck = document.getElementById('pl-featured');
  const plDeleteBtn = document.getElementById('pl-delete-btn');
  const plItemsPanel = document.getElementById('pl-items-panel');
  const plCountSpan = document.getElementById('pl-count');
  const plModalTitle = document.getElementById('pl-modal-title');
  
  if (plIdInput) plIdInput.value = '';
  if (plTitleInput) plTitleInput.value = '';
  if (plDescInput) plDescInput.value = '';
  if (plTypeSelect) plTypeSelect.value = 'playlist';
  if (plVisSelect) plVisSelect.value = 'public';
  if (plFeaturedCheck) plFeaturedCheck.checked = false;
  if (plDeleteBtn) plDeleteBtn.style.display = 'none';
  if (plItemsPanel) plItemsPanel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);">Loading...</div>`;
  if (plCountSpan) plCountSpan.textContent = '0';
  
  window._plItems = [];
  
  if (id) {
    if (plModalTitle) plModalTitle.textContent = 'Edit Playlist';
    if (plDeleteBtn) plDeleteBtn.style.display = 'block';
    
    const { data: pl, error } = await supabase
      .from('creator_playlists')
      .select('*')
      .eq('id', id)
      .eq('creator_id', window.creatorId)
      .maybeSingle();
      
    if (error || !pl) {
      showToast('Not found', 'error');
      return;
    }
    
    if (plIdInput) plIdInput.value = pl.id;
    if (plTitleInput) plTitleInput.value = pl.name || '';
    if (plDescInput) plDescInput.value = pl.description || '';
    if (plTypeSelect) plTypeSelect.value = pl.playlist_type || 'playlist';
    if (plVisSelect) plVisSelect.value = pl.visibility || 'public';
    if (plFeaturedCheck) plFeaturedCheck.checked = pl.is_featured || false;
    
    await loadPLItemsV2(pl.id);
  } else {
    if (plModalTitle) plModalTitle.textContent = 'Create Playlist';
    if (plItemsPanel) {
      plItemsPanel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-list" style="font-size:32px;margin-bottom:15px;opacity:0.5;"></i><p>Add videos from your library</p></div>`;
    }
  }
  
  await loadPLLibraryV2();
  
  const modal = document.getElementById('playlist-builder-modal');
  if (modal) modal.classList.add('active');
}

async function loadPLItemsV2(plId) {
  const items = await loadPlaylistItemsForBuilder(plId);
  window._plItems = items;
  renderPLItemsV2();
}

function renderPLItemsV2() {
  const panel = document.getElementById('pl-items-panel');
  const countSpan = document.getElementById('pl-count');
  
  if (!panel) return;
  if (countSpan) countSpan.textContent = window._plItems.length;
  
  if (!window._plItems.length) {
    panel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);">Add videos to your playlist</div>`;
    return;
  }
  
  panel.innerHTML = '';
  
  window._plItems.forEach((item, i) => {
    const c = item.Content;
    const tmplt = document.getElementById('pl-item-tmpl');
    if (!tmplt) return;
    
    const clone = tmplt.content.cloneNode(true);
    
    const thumb = clone.querySelector('.pl-thumb');
    if (thumb) {
      thumb.src = c?.thumbnail_url ? fixMediaUrl(c.thumbnail_url) : 'https://via.placeholder.com/80x45/111/444';
    }
    
    const title = clone.querySelector('.pl-title');
    if (title) title.textContent = c?.title || 'Untitled';
    
    const meta = clone.querySelector('.pl-meta');
    if (meta) {
      meta.innerHTML = `<span><i class="fas fa-eye"></i>${formatNumber(c?.views_count||0)}</span><span>${formatDuration(c?.duration)}</span>`;
    }
    
    const el = clone.querySelector('.pl-item');
    if (el) {
      el.dataset.id = item.id;
      el.dataset.pos = i + 1;
    }
    
    const removeBtn = clone.querySelector('.pl-remove');
    if (removeBtn) {
      removeBtn.onclick = () => removePLItemV2(item.id);
    }
    
    if (el && panel) {
      setupPLDragDropV2(el, panel);
      panel.appendChild(el);
    }
  });
}

function setupPLDragDropV2(el, container) {
  if (!el || !container) return;
  
  el.setAttribute('draggable', 'true');
  
  el.addEventListener('dragstart', e => {
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id || '');
  });
  
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    savePLOrderV2();
  });
  
  if (container && !container.hasDragOverListener) {
    container.hasDragOverListener = true;
    container.addEventListener('dragover', e => {
      e.preventDefault();
      const draggable = document.querySelector('.pl-item.dragging');
      if (!draggable) return;
      
      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggable);
      } else {
        container.insertBefore(draggable, afterElement);
      }
    });
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.pl-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function savePLOrderV2() {
  const plId = document.getElementById('pl-id')?.value;
  if (!plId) return;
  
  const items = document.querySelectorAll('.pl-item');
  const orderedItemIds = [];
  
  for (let i = 0; i < items.length; i++) {
    orderedItemIds.push(items[i].dataset.id);
  }
  
  await updatePlaylistItemOrder(plId, orderedItemIds);
}

async function loadPLLibraryV2(filter = 'all', search = '') {
  let query = supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      genre,
      live_views,
      favorites_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .eq('user_id', window.creatorId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (filter !== 'all') {
    if (filter === 'short') {
      query = query.eq('media_type', 'short');
    } else {
      query = query.or('media_type.eq.video,media_type.is.null');
    }
  }
  
  if (search) query = query.ilike('title', `%${search}%`);
  
  const { data } = await query;
  
  window._plLib = (data || []).map(item => ({
    ...item,
    views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
    likes_count: item.content_engagement_stats?.total_likes || 0,
    favorites_count: item.favorites_count || 0
  }));
  
  renderPLLibV2(filter, search);
}

function renderPLLibV2(filter, search) {
  const grid = document.getElementById('pl-lib-grid');
  if (!grid) return;
  
  const added = new Set(window._plItems.map(i => i.content_id));
  const lib = window._plLib.filter(c => !added.has(c.id));
  
  const searchInput = document.getElementById('pl-lib-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(window._libTimer);
      window._libTimer = setTimeout(() => loadPLLibraryV2(filter, e.target.value), 300);
    };
  }
  
  const filters = document.querySelectorAll('.pl-filter');
  filters.forEach(b => {
    b.onclick = () => {
      filters.forEach(x => {
        x.classList.remove('active');
        x.style.color = 'var(--slate-grey)';
        x.style.borderBottomColor = 'transparent';
      });
      b.classList.add('active');
      b.style.color = 'var(--soft-white)';
      b.style.borderBottomColor = 'var(--warm-gold)';
      
      const searchVal = document.getElementById('pl-lib-search')?.value || '';
      loadPLLibraryV2(b.dataset.f, searchVal);
    };
  });
  
  grid.innerHTML = lib.map(c => {
    const tmplt = document.getElementById('pl-lib-tmpl');
    if (!tmplt) return '';
    
    const clone = tmplt.content.cloneNode(true);
    
    const thumb = clone.querySelector('.lb-thumb');
    if (thumb) {
      thumb.src = c.thumbnail_url ? fixMediaUrl(c.thumbnail_url) : 'https://via.placeholder.com/160x90/111/444';
    }
    
    const title = clone.querySelector('.lb-title');
    if (title) title.textContent = c.title;
    
    const views = clone.querySelector('.lb-views');
    if (views) views.textContent = `${formatNumber(c.views_count||0)} views`;
    
    const addBtn = clone.querySelector('.lb-add');
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        addPLItemV2(c.id);
      };
    }
    
    const card = clone.querySelector('.pl-lib-card');
    return card ? card.outerHTML : '';
  }).join('');
}

async function addPLItemV2(contentId) {
  const plId = document.getElementById('pl-id')?.value;
  if (!plId) {
    showToast('Save playlist first', 'warning');
    return;
  }
  
  try {
    await addItemToPlaylist(plId, contentId);
    await loadPLItemsV2(plId);
    loadPLLibraryV2();
    showToast('Added!', 'success');
  } catch (error) {
    console.error('Error adding item:', error);
    showToast('Failed to add item', 'error');
  }
}

async function removePLItemV2(playlistContentId) {
  await removeItemFromPlaylist(playlistContentId);
  const plId = document.getElementById('pl-id')?.value;
  if (plId) {
    await loadPLItemsV2(plId);
    loadPLLibraryV2();
  }
}

function setupPlaylistTabs() {
  const tabs = document.querySelectorAll('.pl-tab');
  tabs.forEach(t => {
    t.onclick = () => {
      tabs.forEach(x => {
        x.classList.remove('active');
        x.style.color = 'var(--slate-grey)';
        x.style.borderBottomColor = 'transparent';
      });
      t.classList.add('active');
      t.style.color = 'var(--soft-white)';
      t.style.borderBottomColor = 'var(--warm-gold)';
      
      const itemsPanel = document.getElementById('pl-items-panel');
      const libraryPanel = document.getElementById('pl-library-panel');
      
      if (itemsPanel) itemsPanel.style.display = t.dataset.tab === 'items' ? 'block' : 'none';
      if (libraryPanel) libraryPanel.style.display = t.dataset.tab === 'library' ? 'block' : 'none';
    };
  });
}

async function savePlaylistV2Wrapper() {
  const title = document.getElementById('pl-title')?.value.trim();
  if (!title) {
    showToast('Title required', 'warning');
    return;
  }
  
  const id = document.getElementById('pl-id')?.value;
  
  const playlistData = {
    name: title,
    description: document.getElementById('pl-desc')?.value || '',
    playlist_type: document.getElementById('pl-type')?.value || 'playlist',
    visibility: document.getElementById('pl-vis')?.value || 'public',
    is_featured: document.getElementById('pl-featured')?.checked || false
  };
  
  try {
    await savePlaylistV2(playlistData, id);
    await loadCreatorData();
    
    const modal = document.getElementById('playlist-builder-modal');
    if (modal) modal.classList.remove('active');
    
    showToast(id ? 'Updated!' : 'Created!', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save playlist', 'error');
  }
}

async function deletePlaylistV2Wrapper() {
  const id = document.getElementById('pl-id')?.value;
  if (!id || !confirm('Delete playlist?')) return;
  
  try {
    await deletePlaylistV2(id);
    await loadCreatorData();
    
    const modal = document.getElementById('playlist-builder-modal');
    if (modal) modal.classList.remove('active');
    
    showToast('Deleted', 'info');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete playlist', 'error');
  }
}

// ===== SEARCH =====
async function searchContent(query, category = '', sortBy = 'newest') {
  try {
    let qb = supabase.from('Content')
      .select(`
        *,
        user_profiles!user_id(*),
        live_views,
        favorites_count,
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments
        )
      `)
      .ilike('title', `%${query}%`)
      .eq('status', 'published');
      
    if (category) qb = qb.eq('genre', category);
    
    const { data, error } = await qb.limit(50);
    if (error) throw error;
    
    const enriched = (data || []).map(item => ({
      ...item,
      views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
      likes_count: item.content_engagement_stats?.total_likes || 0,
      comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
      favorites_count: item.favorites_count || 0
    }));
    
    if (sortBy === 'popular') enriched.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    else if (sortBy === 'trending') enriched.sort((a, b) => ((b.views_count || 0) + ((b.likes_count || 0) * 2)) - ((a.views_count || 0) + ((a.likes_count || 0) * 2)));
    else enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return enriched;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const thumbnailUrl = item.thumbnail_url ? fixMediaUrl(item.thumbnail_url) : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    return `<div class="content-card" data-content-id="${item.id}"><div class="card-thumbnail"><img src="${thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy"><div class="thumbnail-overlay"></div><div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div></div><div class="card-content"><h3 class="card-title">${truncateText(escapeHtml(item.title), 45)}</h3><div class="card-meta"><span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span><span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span></div></div></div>`;
  }).join('');
  
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// ===== SHOW CONNECTORS MODAL =====
async function showConnectorsModal() {
  try {
    const { data: connectors, error } = await supabase
      .from('connectors')
      .select(`connector_id, user_profiles!inner(id, full_name, username, avatar_url)`)
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (error) throw error;
    
    const title = document.getElementById('modal-title');
    const list = document.getElementById('connectors-list');
    const profiles = connectors.map(c => c.user_profiles);
    
    if (title) title.textContent = `Connectors (${profiles.length})`;
    
    if (list) {
      if (profiles.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No connectors yet</div>';
      } else {
        list.innerHTML = profiles.map(p => {
          const avatarUrl = p.avatar_url ? fixMediaUrl(p.avatar_url) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop';
          return `
            <div style="display:flex;align-items:center;gap:15px;padding:15px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--warm-gold);"><img src="${avatarUrl}" alt="${p.full_name || p.username}" style="width:100%;height:100%;object-fit:cover;"></div>
              <div><div style="font-weight:600;color:var(--soft-white);">${escapeHtml(p.full_name || p.username)}</div><div style="font-size:14px;color:var(--slate-grey);">@${escapeHtml(p.username || 'user')}</div></div>
            </div>
          `;
        }).join('');
      }
    }
    
    const modal = document.getElementById('connectors-modal');
    if (modal) modal.classList.add('active');
  } catch (error) {
    console.error('Error loading connectors:', error);
    showToast('Failed to load connectors', 'error');
  }
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  // Profile button
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
      const { data } = await supabase.auth.getSession();
      data?.session ? window.location.href = 'profile.html' : window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    });
  }
  
  const currentProfileBtn = document.getElementById('current-profile-btn');
  if (currentProfileBtn) {
    currentProfileBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) dropdown.classList.toggle('active');
    });
  }
  
  const manageProfilesBtn = document.getElementById('manage-profiles-btn');
  if (manageProfilesBtn) {
    manageProfilesBtn.addEventListener('click', () => {
      window.location.href = 'manage-profiles.html';
    });
  }
  
  document.addEventListener('click', (e) => {
    const profileBtnEl = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const currentProfileBtnEl = document.getElementById('current-profile-btn');
    
    if (profileDropdown && profileBtnEl && currentProfileBtnEl) {
      if (!profileBtnEl.contains(e.target) && !profileDropdown.contains(e.target) && !currentProfileBtnEl.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    }
  });
  
  // Edit About - WIRED UP
  const editAboutBtn = document.getElementById('edit-about-btn');
  if (editAboutBtn) {
    editAboutBtn.addEventListener('click', showEditAboutModal);
  }
  
  // Cancel About
  const cancelAboutBtn = document.getElementById('cancel-about-btn');
  if (cancelAboutBtn) {
    cancelAboutBtn.addEventListener('click', hideEditAboutModal);
  }
  
  // Save About
  const saveAboutBtn = document.getElementById('save-about-btn');
  if (saveAboutBtn) {
    saveAboutBtn.addEventListener('click', saveAboutSection);
  }
  
  // Banner edit
  const bannerEditBtn = document.getElementById('banner-edit-btn');
  if (bannerEditBtn) bannerEditBtn.addEventListener('click', showBannerUploadModal);
  
  // Banner file upload
  const bannerFileUpload = document.getElementById('banner-file-upload');
  const bannerFileInput = document.getElementById('banner-file-input');
  if (bannerFileUpload && bannerFileInput) {
    bannerFileUpload.addEventListener('click', () => { bannerFileInput.click(); });
    
    bannerFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewImg = document.getElementById('banner-preview-img');
        const placeholder = document.getElementById('banner-preview-placeholder');
        if (previewImg && placeholder) {
          previewImg.src = event.target.result;
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
      
      await handleBannerUpload(file);
      e.target.value = '';
    });
  }
  
  // Banner URL apply
  const bannerUrlApply = document.getElementById('banner-url-apply');
  if (bannerUrlApply) {
    bannerUrlApply.addEventListener('click', async () => {
      const url = document.getElementById('banner-url-input')?.value.trim();
      if (!url) {
        showToast('Please enter a URL', 'warning');
        return;
      }
      
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          showToast('URL must point to an image', 'error');
          return;
        }
        
        const contentLength = parseInt(response.headers.get('content-length'));
        const maxSize = 20 * 1024 * 1024;
        if (contentLength > maxSize) {
          showToast('Image must be less than 20MB', 'error');
          return;
        }
      } catch (error) {
        showToast('Could not validate image URL', 'error');
        return;
      }
      
      const previewImg = document.getElementById('banner-preview-img');
      const placeholder = document.getElementById('banner-preview-placeholder');
      if (previewImg && placeholder) {
        previewImg.src = url;
        previewImg.onload = () => {
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        };
        previewImg.onerror = () => {
          showToast('Failed to load image from URL', 'error');
        };
      }
    });
  }
  
  // Banner save
  const bannerSave = document.getElementById('banner-save');
  if (bannerSave) {
    bannerSave.addEventListener('click', async () => {
      const previewImg = document.getElementById('banner-preview-img');
      if (previewImg && previewImg.style.display === 'block' && previewImg.src) {
        if (previewImg.src.startsWith('data:image')) {
          const response = await fetch(previewImg.src);
          const blob = await response.blob();
          const file = new File([blob], 'banner.jpg', { type: blob.type });
          await handleBannerUpload(file);
        } else {
          try {
            const { error: dbError } = await supabase
              .from('user_profiles')
              .update({ channel_banner_url: previewImg.src })
              .eq('id', window.creatorId);
              
            if (dbError) throw dbError;
            
            setBannerImage(previewImg.src);
            showToast('Banner updated successfully! 🎉', 'success');
            hideBannerUploadModal();
          } catch (error) {
            console.error('Error saving banner:', error);
            showToast('Failed to save banner', 'error');
          }
        }
      } else {
        showToast('Please select or enter an image first', 'warning');
      }
    });
  }
  
  // Banner cancel
  const bannerCancel = document.getElementById('banner-cancel');
  if (bannerCancel) bannerCancel.addEventListener('click', hideBannerUploadModal);
  
  // Search
  const searchBtn = document.getElementById('search-btn');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchModal = document.getElementById('search-modal');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.add('active');
      setTimeout(() => document.getElementById('search-input')?.focus(), 300);
    });
  }
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.remove('active');
      const searchInputEl = document.getElementById('search-input');
      const searchResultsGrid = document.getElementById('search-results-grid');
      if (searchInputEl) searchInputEl.value = '';
      if (searchResultsGrid) searchResultsGrid.innerHTML = '';
    });
  }
  
  if (searchModal) {
    searchModal.addEventListener('click', e => {
      if (e.target === searchModal) {
        searchModal.classList.remove('active');
        const searchInputEl = document.getElementById('search-input');
        const searchResultsGrid = document.getElementById('search-results-grid');
        if (searchInputEl) searchInputEl.value = '';
        if (searchResultsGrid) searchResultsGrid.innerHTML = '';
      }
    });
  }
  
  const searchInputElement = document.getElementById('search-input');
  if (searchInputElement) {
    let timeout;
    searchInputElement.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          const resultsGrid = document.getElementById('search-results-grid');
          if (resultsGrid) resultsGrid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">Start typing to search...</div>';
          return;
        }
        
        const resultsGrid = document.getElementById('search-results-grid');
        if (resultsGrid) {
          resultsGrid.innerHTML = `<div style="text-align:center;padding:40px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-radius:50%;border-top-color:var(--warm-gold);animation:spin 1s linear infinite;margin:0 auto 15px;"></div><div style="color:var(--slate-grey);">Searching...</div></div>`;
        }
        
        const categoryFilter = document.getElementById('category-filter')?.value;
        const sortFilter = document.getElementById('sort-filter')?.value;
        const results = await searchContent(query, categoryFilter, sortFilter);
        renderSearchResults(results);
      }, 300);
    });
  }
  
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  // Notifications
  const notificationsBtn = document.getElementById('notifications-btn');
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const closeNotifications = document.getElementById('close-notifications');
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.remove('active');
    });
  }
  
  const notificationsPanel = document.getElementById('notifications-panel');
  if (notificationsPanel) {
    notificationsPanel.addEventListener('click', e => {
      if (e.target === notificationsPanel) notificationsPanel.classList.remove('active');
    });
  }
  
  const markAllRead = document.getElementById('mark-all-read');
  if (markAllRead) {
    markAllRead.addEventListener('click', async () => {
      if (!window.currentUser) return;
      try {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', window.currentUser.id).eq('is_read', false);
        if (error) throw error;
        window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
        renderNotifications();
        updateNotificationBadge(0);
        showToast('All notifications marked as read', 'success');
      } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
      }
    });
  }
  
  // Analytics
  initAnalyticsModal();
  
  // Playlist builder
  initPlaylistBuilder();
  
  // Connectors
  const connectorsStatCard = document.getElementById('connectors-stat-card');
  if (connectorsStatCard) {
    connectorsStatCard.addEventListener('click', showConnectorsModal);
  }
  
  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('connectors-modal');
      if (modal) modal.classList.remove('active');
    });
  }
  
  const connectorsModal = document.getElementById('connectors-modal');
  if (connectorsModal) {
    connectorsModal.addEventListener('click', e => {
      if (e.target === connectorsModal) connectorsModal.classList.remove('active');
    });
  }
  
  // Voice search
  const voiceSearchBtn = document.getElementById('voice-search-btn');
  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', () => {
      showToast('Voice search coming soon!', 'info');
    });
  }
  
  // Sidebar nav items
  const sidebarCreate = document.getElementById('sidebar-create');
  if (sidebarCreate) {
    sidebarCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      } else {
        window.location.href = 'creator-upload.html';
      }
    });
  }
  
  const sidebarDashboard = document.getElementById('sidebar-dashboard');
  if (sidebarDashboard) {
    sidebarDashboard.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = `login.html?redirect=creator-dashboard.html`;
      } else {
        window.location.href = 'creator-dashboard.html';
      }
    });
  }
  
  const sidebarWatchHistory = document.getElementById('sidebar-watch-history');
  if (sidebarWatchHistory) {
    sidebarWatchHistory.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const sidebarAnalytics = document.getElementById('sidebar-analytics');
  if (sidebarAnalytics) {
    sidebarAnalytics.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const modal = document.getElementById('analytics-modal');
      if (modal) modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const sidebarNotifications = document.getElementById('sidebar-notifications');
  if (sidebarNotifications) {
    sidebarNotifications.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const sidebarBadges = document.getElementById('sidebar-badges');
  if (sidebarBadges) {
    sidebarBadges.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Badges coming soon!', 'info');
    });
  }
  
  const sidebarWatchParty = document.getElementById('sidebar-watch-party');
  if (sidebarWatchParty) {
    sidebarWatchParty.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Watch Party coming soon!', 'info');
    });
  }
}

// ===== FIX MOBILE HORIZONTAL SCROLL =====
function fixMobileHorizontalScroll() {
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  
  const checkOverflow = () => {
    const maxWidth = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > maxWidth) {
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > maxWidth + 5) {
          el.style.maxWidth = '100%';
          el.style.overflow = 'hidden';
        }
      });
    }
  };
  
  checkOverflow();
  window.addEventListener('resize', checkOverflow);
}

// ===== INITIALIZE =====
async function initializeCreatorChannel() {
  try {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loading) loading.style.display = 'flex';
    if (app) app.style.display = 'none';
    
    window.loadingText = document.getElementById('loading-text');
    
    initThemeSystem();
    
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
    setupScaleControls();
    
    fixMobileHorizontalScroll();
    
    setupSidebar();
    setupNavigationButtons();
    setupTabs();
    
    await checkAuth();
    await loadCreatorData();
    setupEventListeners();
    
    setTimeout(() => {
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 500);
    
    console.log('✅ Creator channel initialized - ALL FIXES APPLIED!');
    console.log('   🚀 All 6 tabs now work (Home, Series, Shorts, Podcast, Community, About)');
    console.log('   🎯 REAL streak count computed from upload history');
    console.log('   📊 REAL content mix bar from actual content');
    console.log('   🎨 Consistent content-type colors everywhere');
    console.log('   ✏️ Edit About modal fully wired up');
    console.log('   👑 Founder & Verified badges toggle correctly');
    console.log('   🔒 Analytics: owner-only access');
    console.log('   📝 Creator posts from database');
    console.log('   📊 Poll data from database (real votes)');
    console.log('   🎯 Creator badge auto-generates from dominant type');
    
  } catch (error) {
    console.error('❌ Error initializing:', error);
    showToast('Failed to initialize', 'error');
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 1000);
  }
}

// ===== AUTH STATE CHANGE =====
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    window.currentUser = session.user;
    loadUserProfile();
    showToast('Welcome back!', 'success');
  } else if (event === 'SIGNED_OUT') {
    window.currentUser = null;
    updateProfileUI();
    updateNotificationBadge(0);
    window.notifications = [];
    showToast('Signed out', 'info');
  }
});

// Start the application
initializeCreatorChannel();
})();
