// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
console.log('🚀 Explore Screen v2.0 Initializing - Structured Discovery Mode');

// ============================================
// PERFORMANCE: Cache & Query Batcher
// ============================================
class CacheManager {
  constructor() { 
    this.cache = new Map(); 
    this.ttl = 5 * 60 * 1000; 
  }
  set(key, data, ttl) {
    this.cache.set(key, { data: data, timestamp: Date.now(), ttl: ttl || this.ttl });
  }
  get(key) {
    var item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) { 
      this.cache.delete(key); 
      return null; 
    }
    return item.data;
  }
}
window.cacheManager = new CacheManager();

// DOM Elements
var loadingScreen = document.getElementById('loading');
var loadingText = document.getElementById('loading-text');
var app = document.getElementById('app');

// State
var isLoading = true;
var currentProfile = null;
var languageFilter = 'all';
var languageMap = { 
  en: 'English', zu: 'IsiZulu', xh: 'IsiXhosa', af: 'Afrikaans', 
  nso: 'Sepedi', st: 'Sesotho', tn: 'Setswana', ss: 'siSwati', 
  ve: 'Tshivenda', ts: 'Xitsonga', nr: 'isiNdebele' 
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message, type) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  var icon = 'fa-info-circle';
  if (type === 'error') icon = 'fa-exclamation-triangle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'warning') icon = 'fa-exclamation-circle';
  toast.innerHTML = '<i class="fas ' + icon + '"></i><span>' + (message || '') + '</span>';
  container.appendChild(toast);
  setTimeout(function() { 
    toast.style.opacity = '0'; 
    setTimeout(function() { if(toast.parentNode) toast.parentNode.removeChild(toast); }, 300); 
  }, 3000);
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function escapeHtml(text) { 
  if (!text) return ''; 
  var div = document.createElement('div'); 
  div.textContent = text; 
  return div.innerHTML; 
}

function getInitials(name) { 
  if (!name) return '?'; 
  var n = name.trim().split(' '); 
  if (n.length >= 2) {
    return (n[0][0] + n[n.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase(); 
}

function setLoading(loading, text) {
  isLoading = loading;
  if (text && loadingText) loadingText.textContent = text;
  if (loading) { 
    if(loadingScreen) loadingScreen.style.display = 'flex'; 
    if(app) app.style.display = 'none'; 
  } else { 
    setTimeout(function() { 
      if(loadingScreen) loadingScreen.style.display = 'none'; 
      if(app) app.style.display = 'block'; 
    }, 300); 
  }
}

function debounce(func, wait) { 
  var timeout; 
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(timeout); 
    timeout = setTimeout(function() { func.apply(context, args); }, wait); 
  }; 
}

// ============================================
// UI SCALE CONTROLLER
// ============================================
var UIScaleController = function() {
  this.scaleKey = 'bantu_ui_scale';
  this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
  this.currentIndex = 2;
  this.init = function() {
    var saved = localStorage.getItem(this.scaleKey);
    if (saved) this.currentIndex = this.scales.indexOf(parseFloat(saved));
    if (this.currentIndex === -1) this.currentIndex = 2;
    this.applyScale();
  };
  this.applyScale = function() {
    var scale = this.scales[this.currentIndex];
    document.documentElement.style.setProperty('--ui-scale', scale);
    localStorage.setItem(this.scaleKey, scale);
    this.updateDisplay();
    document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: scale } }));
  };
  this.updateDisplay = function() {
    var p = Math.round(this.getScale() * 100) + '%';
    var sv = document.getElementById('scale-value');
    if (sv) sv.textContent = p;
    var ssv = document.getElementById('sidebar-scale-value');
    if (ssv) ssv.textContent = p;
  };
  this.getScale = function() { return this.scales[this.currentIndex]; };
  this.increase = function() { 
    if (this.currentIndex < this.scales.length - 1) { 
      this.currentIndex++; 
      this.applyScale(); 
      showToast('UI Size: ' + Math.round(this.getScale() * 100) + '%', 'info'); 
    } 
  };
  this.decrease = function() { 
    if (this.currentIndex > 0) { 
      this.currentIndex--; 
      this.applyScale(); 
      showToast('UI Size: ' + Math.round(this.getScale() * 100) + '%', 'info'); 
    } 
  };
  this.reset = function() { 
    this.currentIndex = 2; 
    this.applyScale(); 
    showToast('UI Size Reset to 100%', 'info'); 
  };
};
window.uiScaleController = new UIScaleController();

// ============================================
// SIDEBAR MENU
// ============================================
function setupSidebar() {
  var menuToggle = document.getElementById('menu-toggle');
  var sidebarClose = document.getElementById('sidebar-close');
  var sidebarOverlay = document.getElementById('sidebar-overlay');
  var sidebarMenu = document.getElementById('sidebar-menu');
  
  function openSidebar() { 
    if (sidebarMenu) sidebarMenu.classList.add('active'); 
    if (sidebarOverlay) sidebarOverlay.classList.add('active'); 
    document.body.style.overflow = 'hidden'; 
  }
  function closeSidebarFn() { 
    if (sidebarMenu) sidebarMenu.classList.remove('active'); 
    if (sidebarOverlay) sidebarOverlay.classList.remove('active'); 
    document.body.style.overflow = ''; 
  }
  
  if (menuToggle) menuToggle.addEventListener('click', function(e) { e.stopPropagation(); openSidebar(); });
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebarFn);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarFn);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && sidebarMenu && sidebarMenu.classList.contains('active')) closeSidebarFn(); });
  
  updateSidebarProfile();
  setupSidebarNavigation();
  setupSidebarThemeToggle();
  setupSidebarScaleControls();
}

function updateSidebarProfile() {
  var avatar = document.getElementById('sidebar-profile-avatar');
  var nameEl = document.getElementById('sidebar-profile-name');
  var emailEl = document.getElementById('sidebar-profile-email');
  if (!avatar || !nameEl || !emailEl) return;
  
  if (window.currentUser && window.supabaseAuth) {
    window.supabaseAuth.from('user_profiles').select('*').eq('id', window.currentUser.id).maybeSingle().then(function(result) {
      var profile = result.data;
      if (!profile) return;
      nameEl.textContent = profile.full_name || profile.username || 'User';
      emailEl.textContent = window.currentUser.email;
      if (profile.avatar_url && window.contentSupabase) {
        avatar.innerHTML = '<img src="' + window.contentSupabase.fixMediaUrl(profile.avatar_url) + '" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      } else {
        avatar.innerHTML = '<span>' + getInitials(profile.full_name) + '</span>';
      }
    }).catch(function(e) { console.warn('Profile fetch error:', e); });
  } else { 
    nameEl.textContent = 'Guest'; 
    emailEl.textContent = 'Sign in to continue'; 
    avatar.innerHTML = '<i class="fas fa-user"></i>'; 
  }
}

function closeSidebar() { 
  var menu = document.getElementById('sidebar-menu');
  var overlay = document.getElementById('sidebar-overlay');
  if (menu) menu.classList.remove('active'); 
  if (overlay) overlay.classList.remove('active'); 
  document.body.style.overflow = ''; 
}

function setupSidebarNavigation() {
  var analyticsBtn = document.getElementById('sidebar-analytics');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      var modal = document.getElementById('analytics-modal'); 
      if (modal) { modal.classList.add('active'); loadPlatformAnalytics(); } 
    });
  }
  var notifBtn = document.getElementById('sidebar-notifications');
  if (notifBtn) {
    notifBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      var panel = document.getElementById('notifications-panel'); 
      if (panel) { panel.classList.add('active'); renderNotifications(); } 
    });
  }
  var badgesBtn = document.getElementById('sidebar-badges');
  if (badgesBtn) {
    badgesBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      var modal = document.getElementById('badges-modal'); 
      if (modal && window.currentUser) { modal.classList.add('active'); loadUserBadges(); } 
    });
  }
  var watchPartyBtn = document.getElementById('sidebar-watch-party');
  if (watchPartyBtn) {
    watchPartyBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      var modal = document.getElementById('watch-party-modal'); 
      if (modal && window.currentUser) { modal.classList.add('active'); loadWatchPartyContent(); } 
    });
  }
  var createBtn = document.getElementById('sidebar-create');
  if (createBtn) {
    createBtn.addEventListener('click', async function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      if (window.supabaseAuth) {
        var sessionData = await window.supabaseAuth.auth.getSession();
        if (!sessionData.data?.session) { 
          showToast('Please sign in to upload content', 'warning'); 
          window.location.href = 'login.html?redirect=creator-upload.html'; 
        } else window.location.href = 'creator-upload.html';
      }
    });
  }
  var dashboardBtn = document.getElementById('sidebar-dashboard');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', async function(e) { 
      e.preventDefault(); 
      closeSidebar(); 
      if (window.supabaseAuth) {
        var sessionData = await window.supabaseAuth.auth.getSession();
        if (!sessionData.data?.session) { 
          showToast('Please sign in to access dashboard', 'warning'); 
          window.location.href = 'login.html?redirect=creator-dashboard.html'; 
        } else window.location.href = 'creator-dashboard.html';
      }
    });
  }
}

function setupSidebarThemeToggle() {
  var toggle = document.getElementById('sidebar-theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() { 
      closeSidebar(); 
      var selector = document.getElementById('theme-selector'); 
      if (selector) selector.classList.toggle('active'); 
    });
  }
}

function setupSidebarScaleControls() {
  if (!window.uiScaleController) return;
  var dec = document.getElementById('sidebar-scale-decrease');
  var inc = document.getElementById('sidebar-scale-increase');
  var res = document.getElementById('sidebar-scale-reset');
  function update() { 
    var val = document.getElementById('sidebar-scale-value');
    if (val) val.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%'; 
  }
  if (dec) dec.addEventListener('click', function() { window.uiScaleController.decrease(); update(); });
  if (inc) inc.addEventListener('click', function() { window.uiScaleController.increase(); update(); });
  if (res) res.addEventListener('click', function() { window.uiScaleController.reset(); update(); });
  update();
  document.addEventListener('scaleChanged', update);
}

// ============================================
// 1. PLATFORM INSIGHTS & STATS
// ============================================
async function fetchPlatformInsights() {
  try {
    var supabase = window.supabaseAuth;
    if (!supabase) return;
    var creatorsRes = await supabase.from('user_profiles').select('id', { count: 'exact' }).eq('role', 'creator');
    var contentRes = await supabase.from('Content').select('id', { count: 'exact' }).eq('status', 'published');
    var activeRes = await supabase.from('connectors').select('connector_id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString());
    
    var insightsCreators = document.getElementById('insight-creators');
    var insightsContent = document.getElementById('insight-content');
    var insightsActive = document.getElementById('insight-active');
    var totalConnectors = document.getElementById('total-connectors');
    var totalContent = document.getElementById('total-content');
    if (insightsCreators) insightsCreators.textContent = formatNumber(creatorsRes.count || 0);
    if (insightsContent) insightsContent.textContent = formatNumber(contentRes.count || 0);
    if (insightsActive) insightsActive.textContent = formatNumber(activeRes.count || 0);
    if (totalConnectors) totalConnectors.textContent = formatNumber((creatorsRes.count || 0) * 12);
    if (totalContent) totalContent.textContent = formatNumber(contentRes.count || 0);
  } catch(e) { console.warn('Stats fetch failed', e); }
}

// ============================================
// 2. EXPLORE WORLDS
// ============================================
function renderExploreWorlds() {
  var worlds = [
    { name: 'Music', icon: 'fa-music', genre: 'Music' },
    { name: 'Movies', icon: 'fa-film', genre: 'Movies' },
    { name: 'STEM', icon: 'fa-flask', genre: 'STEM' },
    { name: 'Sports', icon: 'fa-futbol', genre: 'Sports' },
    { name: 'News', icon: 'fa-newspaper', genre: 'News' },
    { name: 'Culture', icon: 'fa-drum', genre: 'Culture' }
  ];
  var grid = document.getElementById('worlds-grid');
  if (!grid) return;
  grid.innerHTML = worlds.map(function(w) {
    return '<a href="content-library.html?genre=' + w.genre + '" class="world-card">' +
      '<div class="world-icon"><i class="fas ' + w.icon + '"></i></div>' +
      '<div class="world-name">' + w.name + '</div>' +
      '</a>';
  }).join('');
}

// ============================================
// 3. DISCOVER CREATORS
// ============================================
async function fetchCreators(type) {
  type = type || 'verified';
  var grid = document.getElementById('creators-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton-card" style="grid-column:1/-1;height:200px">Loading creators...</div>';
  try {
    var supabase = window.supabaseAuth;
    if (!supabase) throw new Error('Supabase not initialized');
    var query = supabase.from('user_profiles').select('id, username, full_name, avatar_url, role, location').eq('role', 'creator').limit(12);
    if (type === 'verified') query = query.eq('is_verified', true);
    if (type === 'rising') query = query.order('created_at', { ascending: false }).limit(12);
    if (type === 'country') query = query.not('location', 'is', null).limit(12);
    
    var result = await query;
    var data = result.data || [];
    if (data.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No creators found</div>';
      return;
    }
    grid.innerHTML = data.map(function(c) {
      var avatar = c.avatar_url && window.contentSupabase ? window.contentSupabase.fixMediaUrl(c.avatar_url) : null;
      return '<div class="creator-discovery-card" onclick="window.location.href=\'creator-channel.html?id=' + c.id + '\'">' +
        '<div class="creator-avatar-sm">' + (avatar ? '<img src="' + avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">' : getInitials(c.full_name || c.username)) + '</div>' +
        '<div class="creator-name-sm">' + (c.full_name || c.username) + '</div>' +
        '<div class="creator-role-sm">' + (c.location || 'Creator') + '</div>' +
        '<button class="creator-follow-btn" onclick="event.stopPropagation(); showToast(\'Followed!\', \'success\')">Follow</button>' +
        '</div>';
    }).join('');
  } catch(e) { 
    console.error('Failed to load creators', e); 
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Failed to load creators</div>';
  }
}

// ============================================
// 4. EXPLORE BY LANGUAGE
// ============================================
function setupLanguageFilter() {
  var chips = document.querySelectorAll('.language-chip');
  chips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      chips.forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      languageFilter = chip.dataset.lang;
      showToast('Filtering by: ' + (languageMap[languageFilter] || 'All'), 'info');
    });
  });
}

// ============================================
// 5. CURATED DISCOVERY
// ============================================
function renderCurated() {
  var curated = [
    { title: '🚀 Start Learning AI Today', genre: 'STEM', desc: 'Beginner-friendly AI tutorials' },
    { title: '🌱 Agri-Tech Changing Africa', genre: 'News', desc: 'Innovation in agriculture' },
    { title: '🎤 Underground Artists Rising', genre: 'Music', desc: 'Fresh voices from townships' },
    { title: '🎬 Hidden Film Gems', genre: 'Movies', desc: 'Underrated South African cinema' }
  ];
  var grid = document.getElementById('curated-grid');
  if (!grid) return;
  grid.innerHTML = curated.map(function(c) {
    return '<div class="curated-card" onclick="window.location.href=\'content-library.html?genre=' + c.genre + '\'">' +
      '<div class="curated-icon"><i class="fas fa-compass"></i></div>' +
      '<div><div class="curated-title">' + c.title + '</div>' +
      '<div class="curated-desc">' + c.desc + '</div></div>' +
      '</div>';
  }).join('');
}

// ============================================
// 6. LIVE EXPERIENCES
// ============================================
async function fetchLiveExperiences(type) {
  type = type || 'streams';
  var grid = document.getElementById('live-content-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton-card" style="grid-column:1/-1;height:150px">Loading live content...</div>';
  try {
    var supabase = window.supabaseAuth;
    var items = [];
    if (type === 'streams' && supabase) {
      var result = await supabase.from('Content').select('id, title, creator_display_name, thumbnail_url').eq('media_type', 'live').eq('status', 'published').limit(6);
      items = (result.data || []).map(function(d) { return { type: 'Stream', title: d.title || 'Live Stream', meta: d.creator_display_name || 'Live Creator' }; });
    } else if (type === 'parties' && supabase) {
      var partyResult = await supabase.from('watch_parties').select('id, title, participant_count').eq('status', 'waiting').limit(6);
      items = (partyResult.data || []).map(function(d) { return { type: 'Watch Party', title: d.title || 'Community Watch Party', meta: (d.participant_count || 1) + ' watching' }; });
    } else if (type === 'events') {
      items = [
        { type: 'Event', title: 'African Music Festival Live', meta: 'Tomorrow 7:00 PM' },
        { type: 'Event', title: 'Tech Startup Pitch Comp', meta: 'Friday 3:00 PM' }
      ];
    }
    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No live content right now</div>';
      return;
    }
    grid.innerHTML = items.map(function(i) {
      return '<div class="live-item">' +
        '<div class="live-badge">' + i.type + '</div>' +
        '<div class="live-title">' + i.title + '</div>' +
        '<div class="live-meta">' + i.meta + '</div>' +
        '</div>';
    }).join('');
  } catch(e) { 
    console.error('Failed to load live experiences', e); 
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Failed to load live content</div>';
  }
}

// ============================================
// TABS & EVENT LISTENERS
// ============================================
function setupTabsAndActions() {
  var creatorTabs = document.querySelectorAll('.creator-tab');
  creatorTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      creatorTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      fetchCreators(tab.dataset.type);
    });
  });
  
  var liveTabs = document.querySelectorAll('.live-tab');
  liveTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      liveTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      fetchLiveExperiences(tab.dataset.type);
    });
  });
  
  var heroBtns = document.querySelectorAll('.hero-action-btn');
  heroBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var action = btn.dataset.action;
      if (action === 'watch') window.location.href = 'content-library.html';
      else if (action === 'stem') window.location.href = 'content-library.html?genre=STEM';
      else if (action === 'creators') {
        var section = document.getElementById('discover-creators-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
      else if (action === 'live') {
        var liveSection = document.getElementById('live-experiences-section');
        if (liveSection) liveSection.scrollIntoView({ behavior: 'smooth' });
        fetchLiveExperiences('streams');
      }
    });
  });
  
  var exploreBtn = document.getElementById('explore-all-btn');
  if (exploreBtn) exploreBtn.addEventListener('click', function() { window.location.href = 'content-library.html'; });
}

// ============================================
// AUTH & PROFILE
// ============================================
async function checkAuth() {
  try {
    var supabase = window.supabaseAuth;
    if (!supabase) return;
    var result = await supabase.auth.getSession();
    var session = result.data?.session;
    window.currentUser = session?.user || null;
    if (window.currentUser) { 
      await loadUserProfile(); 
      showToast('Welcome back!', 'success'); 
    } else { 
      showToast('Sign in for personalized discovery.', 'info'); 
    }
  } catch(e) { console.warn('Auth check failed', e); }
}

async function loadUserProfile() {
  if (!window.currentUser) return;
  var supabase = window.supabaseAuth;
  if (!supabase) return;
  var result = await supabase.from('user_profiles').select('*').eq('id', window.currentUser.id).maybeSingle();
  var profile = result.data;
  if (profile) {
    currentProfile = profile;
    updateHeaderProfile();
    updateSidebarProfile();
  }
}

function updateHeaderProfile() {
  var placeholder = document.getElementById('userProfilePlaceholder');
  var nameEl = document.getElementById('current-profile-name');
  if (!placeholder || !nameEl) return;
  if (window.currentUser) {
    var p = currentProfile || {};
    if (p.avatar_url && window.contentSupabase) {
      placeholder.innerHTML = '<img src="' + window.contentSupabase.fixMediaUrl(p.avatar_url) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      placeholder.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));color:white;font-weight:bold">' + getInitials(p.full_name) + '</div>';
    }
    nameEl.textContent = p.full_name || p.username || 'User';
  } else {
    placeholder.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));color:white;font-weight:bold">G</div>';
    nameEl.textContent = 'Guest';
  }
}

// ============================================
// MODALS, SEARCH, NOTIFICATIONS, ANALYTICS
// ============================================
function setupSearch() {
  var btn = document.getElementById('search-btn');
  var modal = document.getElementById('search-modal');
  var input = document.getElementById('search-input');
  var close = document.getElementById('close-search-btn');
  if (!btn || !modal) return;
  btn.addEventListener('click', function() { 
    modal.classList.add('active'); 
    setTimeout(function() { if (input) input.focus(); }, 300); 
  });
  if (close) {
    close.addEventListener('click', function() { 
      modal.classList.remove('active'); 
      if (input) input.value = ''; 
      var grid = document.getElementById('search-results-grid');
      if (grid) grid.innerHTML = ''; 
    });
  }
  modal.addEventListener('click', function(e) { 
    if (e.target === modal) { 
      modal.classList.remove('active'); 
      if (input) input.value = ''; 
      var grid = document.getElementById('search-results-grid');
      if (grid) grid.innerHTML = ''; 
    } 
  });
  if (input) {
    input.addEventListener('input', debounce(async function(e) {
      var q = e.target.value.trim();
      var grid = document.getElementById('search-results-grid');
      if (!grid) return;
      if (q.length < 2) {
        grid.innerHTML = '<div class="no-results">Start typing...</div>';
        return;
      }
      var res = await searchContent(q);
      if (res.length === 0) {
        grid.innerHTML = '<div class="no-results">No results found</div>';
        return;
      }
      grid.innerHTML = res.map(function(c) {
        var thumb = c.thumbnail_url || 'https://via.placeholder.com/400x225';
        return '<a href="content-detail.html?id=' + c.id + '" class="content-card">' +
          '<img src="' + thumb + '" alt="' + escapeHtml(c.title) + '">' +
          '<h3>' + escapeHtml(c.title) + '</h3></a>';
      }).join('');
    }, 300));
  }
}

async function searchContent(query) {
  try {
    var supabase = window.supabaseAuth;
    if (!supabase) return [];
    var result = await supabase.from('Content').select('id, title, thumbnail_url').ilike('title', '%' + query + '%').eq('status', 'published').limit(10);
    return result.data || [];
  } catch(e) { return []; }
}

function setupNotifications() {
  var btn = document.getElementById('notifications-btn');
  var panel = document.getElementById('notifications-panel');
  var close = document.getElementById('close-notifications');
  if (!btn || !panel) return;
  btn.addEventListener('click', function() { panel.classList.add('active'); renderNotifications(); });
  if (close) close.addEventListener('click', function() { panel.classList.remove('active'); });
}

function renderNotifications() {
  var list = document.getElementById('notifications-list');
  if (!list) return;
  list.innerHTML = '<div class="notification-item"><div class="notification-content"><h4>Welcome to Explore</h4><p>Discover new creators and content today.</p></div></div>';
}

async function loadPlatformAnalytics() {
  try {
    var supabase = window.supabaseAuth;
    if (!supabase) return;
    var viewsRes = await supabase.from('content_views').select('*', { count: 'exact', head: true });
    var contentRes = await supabase.from('Content').select('*', { count: 'exact', head: true }).eq('status', 'published');
    var creatorsRes = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'creator');
    var connectorsRes = await supabase.from('connectors').select('*', { count: 'exact', head: true });
    
    var totalViews = document.getElementById('total-views');
    var totalContentAnalytics = document.getElementById('total-content-analytics');
    var activeCreators = document.getElementById('active-creators');
    var totalConnectorsAnalytics = document.getElementById('total-connectors-analytics');
    if (totalViews) totalViews.textContent = formatNumber(viewsRes.count || 0);
    if (totalContentAnalytics) totalContentAnalytics.textContent = formatNumber(contentRes.count || 0);
    if (activeCreators) activeCreators.textContent = formatNumber(creatorsRes.count || 0);
    if (totalConnectorsAnalytics) totalConnectorsAnalytics.textContent = formatNumber(connectorsRes.count || 0);
  } catch(e) { console.warn('Analytics failed', e); }
}

// ============================================
// WATCH PARTY & TIPS STUBS
// ============================================
function setupWatchParty() {
  var modal = document.getElementById('watch-party-modal');
  var close = document.getElementById('close-watch-party');
  if (close) close.addEventListener('click', function() { if (modal) modal.classList.remove('active'); });
}
function loadWatchPartyContent() { }
function setupTipSystem() {
  var modal = document.getElementById('tip-modal');
  var close = document.getElementById('close-tip');
  if (close) close.addEventListener('click', function() { if (modal) modal.classList.remove('active'); });
}
async function loadUserBadges() {
  var grid = document.getElementById('badges-grid');
  if (grid) grid.innerHTML = '<div class="badge-item earned"><div class="badge-icon earned"><i class="fas fa-compass"></i></div><div class="badge-info"><h4>Explorer</h4><p>First steps in discovery</p></div></div>';
}

// ============================================
// KEYBOARD, BACK TO TOP
// ============================================
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') { 
      document.querySelectorAll('.modal.active, .search-modal.active, .notifications-panel.active, .watch-party-modal.active, .tip-modal.active, .badges-modal.active, .analytics-modal.active').forEach(function(el) { if (el) el.classList.remove('active'); }); 
      closeSidebar(); 
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { 
      e.preventDefault(); 
      var modal = document.getElementById('search-modal'); 
      if (modal) modal.classList.add('active'); 
      var input = document.getElementById('search-input');
      if (input) setTimeout(function() { input.focus(); }, 100);
    }
    if (e.altKey && e.key === 'n') { 
      e.preventDefault(); 
      var panel = document.getElementById('notifications-panel'); 
      if (panel) panel.classList.toggle('active'); 
    }
  });
}

function setupBackToTop() {
  var btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', function() { 
    btn.style.display = window.pageYOffset > 300 ? 'flex' : 'none'; 
  });
  btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

// ============================================
// INITIALIZATION SEQUENCE
// ============================================
async function initializeExploreScreen() {
  console.log('Initializing Explore Screen...');
  setLoading(true, 'Preparing your discovery journey...');
  if (window.uiScaleController) window.uiScaleController.init();
  renderExploreWorlds();
  renderCurated();
  setupLanguageFilter();
  setupTabsAndActions();
  setupKeyboardNavigation();
  setupBackToTop();
  setupSearch();
  setupNotifications();
  setupWatchParty();
  setupTipSystem();
  setupSidebar();

  await Promise.all([
    checkAuth(),
    fetchPlatformInsights(),
    fetchCreators('verified'),
    fetchLiveExperiences('streams')
  ]);
  setLoading(false);
  console.log('Explore Screen Initialized Successfully');
}

// Start everything
initializeExploreScreen();

// Auth state listener
if (window.supabaseAuth) {
  window.supabaseAuth.auth.onAuthStateChange(function(event, session) {
    console.log('Auth state changed:', event);
    if (event === 'SIGNED_IN') { 
      window.currentUser = session.user; 
      loadUserProfile(); 
      showToast('Welcome back!', 'success'); 
    } else if (event === 'SIGNED_OUT') { 
      window.currentUser = null; 
      currentProfile = null; 
      updateHeaderProfile(); 
      showToast('You have been signed out', 'info'); 
    }
  });
}

}); // END OF DOMContentLoaded - THIS CLOSING BRACKET WAS MISSING
