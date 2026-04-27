// js/content-detail-features.js
// FEATURE MODULE - Extracted from content-detail.js
// Contains: UI Components, Modals, Notifications, Search, Analytics, Navigation, Continue Watching
// This file is loaded alongside content-detail.js to reduce main file size

// ============================================
// HOME FEED UI INTEGRATION - SIDEBAR, HEADER, NAVIGATION, UTILITIES
// ============================================

// UI Scale Controller (from home feed)
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
    document.dispatchEvent(new CustomEvent('scaleChanged', {
      detail: { scale: this.scale }
    }));
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
  
  getScale() {
    return this.scale;
  }
  
  updateScaleDisplay(scale) {
    const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
    displays.forEach(el => {
      if (el) el.textContent = Math.round(scale * 100) + '%';
    });
  }
}

// Toast Notification System (from home feed)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' : 
                    type === 'warning' ? 'fa-exclamation-triangle' : 
                    'fa-info-circle'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Formatting Functions (from home feed)
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

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

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Debounce Function (from home feed)
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

// ============================================
// THEME SELECTOR - HOME FEED INTEGRATION
// ============================================
function initThemeSelector() {
  console.log('🎨 Initializing theme selector...');
  const themeSelector = document.getElementById('theme-selector');
  const themeToggle = document.getElementById('sidebar-theme-toggle');
  
  if (!themeSelector || !themeToggle) {
    console.warn('Theme selector elements not found');
    return;
  }
  
  // Apply saved theme on load
  const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
  applyTheme(savedTheme);
  
  // Theme option click handlers
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const theme = this.dataset.theme;
      applyTheme(theme);
      setTimeout(() => themeSelector.classList.remove('active'), 100);
    });
  });
  
  // Toggle theme selector from sidebar
  themeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    themeSelector.classList.toggle('active');
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (themeSelector.classList.contains('active') &&
        !themeSelector.contains(e.target) &&
        !themeToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
  
  console.log('✅ Theme selector initialized');
}

// ============================================
// APPLY THEME FUNCTION - HOME FEED INTEGRATION
// ============================================
function applyTheme(theme) {
  console.log('🎨 Applying theme:', theme);
  
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    console.warn('Invalid theme:', theme, 'defaulting to dark');
    theme = 'dark';
  }
  
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  root.classList.add(`theme-${theme}`);
  
  // Apply theme-specific CSS variables
  switch(theme) {
    case 'light':
      root.style.setProperty('--deep-black', '#ffffff');
      root.style.setProperty('--soft-white', '#1a1a1a');
      root.style.setProperty('--slate-grey', '#666666');
      root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
      root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
      break;
    case 'high-contrast':
      root.style.setProperty('--deep-black', '#000000');
      root.style.setProperty('--soft-white', '#ffffff');
      root.style.setProperty('--slate-grey', '#ffff00');
      root.style.setProperty('--warm-gold', '#ff0000');
      root.style.setProperty('--bantu-blue', '#00ff00');
      root.style.setProperty('--card-bg', '#000000');
      root.style.setProperty('--card-border', '#ffffff');
      break;
    default: // dark
      root.style.setProperty('--deep-black', '#0A0A0A');
      root.style.setProperty('--soft-white', '#F5F5F5');
      root.style.setProperty('--slate-grey', '#A0A0A0');
      root.style.setProperty('--warm-gold', '#F59E0B');
      root.style.setProperty('--bantu-blue', '#1D4ED8');
      root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
      root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
      break;
  }
  
  // Force CSS variable update for INSTANT visual effect
  void root.offsetWidth;
  
  // Save preference
  localStorage.setItem('bantu_theme', theme);
  
  // Update active state on theme options
  document.querySelectorAll('.theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
  
  // Show confirmation toast
  if (typeof showToast === 'function') {
    showToast(`Theme changed to ${theme}`, 'success');
  }
  
  // Dispatch custom event
  document.dispatchEvent(new CustomEvent('themeChanged', {
    detail: { theme: theme }
  }));
}

// ============================================
// SIDEBAR SETUP & FUNCTIONS (from home feed)
// ============================================
function setupCompleteSidebar() {
  setupMobileSidebar();
  fixSidebarProfileTruncation();
  setupSidebarScaleControls();
  optimizeMobileSidebar();
  window.addEventListener('resize', () => optimizeMobileSidebar());
}

function setupMobileSidebar() {
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
  
  // Header menu button - Remove existing listeners by cloning, then open sidebar ONLY
  if (menuToggle) {
    const newMenuToggle = menuToggle.cloneNode(true);
    menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
    newMenuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📱 Header menu button clicked - opening sidebar');
      openSidebar();
    });
  }
  
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
      closeSidebar();
    }
  });
  
  // Handle safe area insets for modern mobile devices
  if (window.CSS && CSS.supports('padding-bottom', 'env(safe-area-inset-bottom)')) {
    const sidebarFooter = document.getElementById('sidebar-footer');
    if (sidebarFooter) {
      sidebarFooter.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom))';
    }
  }
}

function fixSidebarProfileTruncation() {
  const profileName = document.getElementById('sidebar-profile-name');
  const profileEmail = document.getElementById('sidebar-profile-email');
  
  if (profileName) {
    profileName.style.whiteSpace = 'nowrap';
    profileName.style.overflow = 'hidden';
    profileName.style.textOverflow = 'ellipsis';
  }
  
  if (profileEmail) {
    profileEmail.style.whiteSpace = 'nowrap';
    profileEmail.style.overflow = 'hidden';
    profileEmail.style.textOverflow = 'ellipsis';
  }
}

function setupSidebarScaleControls() {
  const decreaseBtn = document.getElementById('sidebar-scale-decrease');
  const increaseBtn = document.getElementById('sidebar-scale-increase');
  const resetBtn = document.getElementById('sidebar-scale-reset');
  const scaleValue = document.getElementById('sidebar-scale-value');
  
  if (!window.uiScaleController) return;
  
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

function setupSidebarNavigation() {
  // Analytics
  document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    if (!window.currentUser) {
      showToast('Please sign in to view analytics', 'warning');
      return;
    }
    const analyticsModal = document.getElementById('analytics-modal');
    if (analyticsModal) {
      analyticsModal.classList.add('active');
      loadPersonalAnalytics();
    }
  });
  
  // Notifications
  document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    const notificationsPanel = document.getElementById('notifications-panel');
    if (notificationsPanel) {
      notificationsPanel.classList.add('active');
      renderNotifications();
    }
  });
  
  // Badges
  document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    if (!window.currentUser) {
      showToast('Please sign in to view badges', 'warning');
      return;
    }
    const badgesModal = document.getElementById('badges-modal');
    if (badgesModal) {
      badgesModal.classList.add('active');
      loadUserBadges();
    }
  });
  
  // Watch Party
  document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    if (!window.currentUser) {
      showToast('Please sign in to start a watch party', 'warning');
      return;
    }
    const watchPartyModal = document.getElementById('watch-party-modal');
    if (watchPartyModal) {
      watchPartyModal.classList.add('active');
      loadWatchPartyContent();
    }
  });
  
  // Create Content
  document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data?.session) {
      showToast('Please sign in to upload content', 'warning');
      window.location.href = `login.html?redirect=creator-upload.html`;
    } else {
      window.location.href = 'creator-upload.html';
    }
  });
  
  // Dashboard
  document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    const { data } = await window.supabaseClient.auth.getSession();
    if (!data?.session) {
      showToast('Please sign in to access dashboard', 'warning');
      window.location.href = `login.html?redirect=creator-dashboard.html`;
    } else {
      window.location.href = 'creator-dashboard.html';
    }
  });
  
  // Watch History
  document.getElementById('sidebar-watch-history')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('sidebar-close')?.click();
    if (!window.currentUser) {
      showToast('Please sign in to view watch history', 'warning');
      window.location.href = `login.html?redirect=watch-history.html`;
      return;
    }
    window.location.href = 'watch-history.html';
  });
}

async function updateSidebarProfile() {
  const avatar = document.getElementById('sidebar-profile-avatar');
  const name = document.getElementById('sidebar-profile-name');
  const email = document.getElementById('sidebar-profile-email');
  const profileSection = document.getElementById('sidebar-profile');
  
  if (!avatar || !name || !email) return;
  
  avatar.innerHTML = '';
  
  if (window.currentUser || (window.AuthHelper?.isAuthenticated?.())) {
    try {
      const userProfile = window.AuthHelper?.getUserProfile?.() || window.currentUser;
      const userId = userProfile?.id;
      
      if (userId) {
        const { data: profile, error } = await window.supabaseClient
          .from('user_profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', userId)
          .maybeSingle();
        
        if (error || !profile) {
          renderSidebarFallback(avatar, name, email, userProfile);
          return;
        }
        
        name.textContent = profile.full_name || profile.username || 'User';
        email.textContent = userProfile.email || 'user@example.com';
        
        if (profile.avatar_url) {
          const avatarUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
          const img = document.createElement('img');
          img.src = avatarUrl;
          img.alt = profile.full_name || 'Profile';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
          img.onerror = () => renderSidebarInitials(avatar, profile);
          avatar.appendChild(img);
        } else {
          renderSidebarInitials(avatar, profile);
        }
        
        if (profileSection) {
          profileSection.onclick = () => {
            document.getElementById('sidebar-close')?.click();
            window.location.href = 'manage-profiles.html';
          };
        }
      } else {
        renderSidebarFallback(avatar, name, email, userProfile);
      }
    } catch (err) {
      console.warn('Sidebar profile fetch error:', err);
      renderSidebarFallback(avatar, name, email, window.currentUser);
    }
  } else {
    name.textContent = 'Guest';
    email.textContent = 'Sign in to continue';
    avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
    
    if (profileSection) {
      profileSection.onclick = () => {
        document.getElementById('sidebar-close')?.click();
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      };
    }
  }
}

function renderSidebarInitials(container, profile) {
  if (!container) return;
  container.innerHTML = '';
  const name = profile?.full_name || profile?.username || 'User';
  const initials = getInitials(name);
  const span = document.createElement('span');
  span.style.cssText = `
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--soft-white);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    line-height: 1;
  `;
  span.textContent = initials;
  container.appendChild(span);
}

function renderSidebarFallback(avatar, name, email, user) {
  if (avatar) avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
  if (name) name.textContent = user?.email?.split('@')[0] || 'User';
  if (email) email.textContent = user?.email || 'Sign in to continue';
}

function optimizeMobileSidebar() {
  const sidebarMenu = document.getElementById('sidebar-menu');
  if (!sidebarMenu) return;
  
  if (window.innerWidth <= 768) {
    sidebarMenu.style.width = '16rem';
  } else {
    sidebarMenu.style.width = '18rem';
  }
}

// ============================================
// HEADER FUNCTIONS (from home feed)
// ============================================
async function updateHeaderProfile() {
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  const currentProfileName = document.getElementById('current-profile-name');
  
  if (!profilePlaceholder || !currentProfileName) return;
  
  profilePlaceholder.innerHTML = '';
  
  if (window.currentUser || window.AuthHelper?.isAuthenticated?.()) {
    try {
      const userProfile = window.AuthHelper?.getUserProfile?.() || window.currentUser;
      const { data: profile } = await window.supabaseClient
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', userProfile.id)
        .maybeSingle();
      
      const displayName = profile?.full_name || profile?.username || userProfile.email?.split('@')[0] || 'User';
      currentProfileName.textContent = displayName;
      
      if (profile?.avatar_url) {
        const avatarUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
        const img = document.createElement('img');
        img.className = 'profile-img';
        img.src = avatarUrl;
        img.alt = displayName;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        img.onerror = () => renderInitialsProfile(profilePlaceholder, { full_name: displayName });
        profilePlaceholder.appendChild(img);
      } else {
        renderInitialsProfile(profilePlaceholder, { full_name: displayName });
      }
    } catch (e) {
      renderFallbackProfile(profilePlaceholder, currentProfileName, window.currentUser);
    }
  } else {
    renderGuestProfile(profilePlaceholder, currentProfileName);
  }
  
  applyMobileHeaderStyles();
}

function applyMobileHeaderStyles() {
  const isMobile = window.innerWidth <= 480;
  const profileBtn = document.querySelector('.profile-btn');
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  const profileNameSpan = document.getElementById('current-profile-name');
  
  if (isMobile) {
    if (profilePlaceholder) {
      profilePlaceholder.style.display = 'none';
    }
    if (profileBtn) {
      profileBtn.style.minWidth = 'auto';
      profileBtn.style.padding = '0.3125rem 0.75rem';
      profileBtn.style.justifyContent = 'center';
    }
    if (profileNameSpan) {
      profileNameSpan.style.display = 'inline-block';
    }
  } else {
    if (profilePlaceholder) {
      profilePlaceholder.style.display = 'flex';
    }
    if (profileBtn) {
      profileBtn.style.minWidth = '160px';
      profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
      profileBtn.style.justifyContent = 'flex-start';
    }
  }
}

function renderInitialsProfile(container, profile) {
  if (!container) return;
  container.innerHTML = '';
  const name = profile?.full_name || 'User';
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2);
  const div = document.createElement('div');
  div.className = 'profile-placeholder';
  div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;text-transform:uppercase;';
  div.textContent = initials;
  container.appendChild(div);
}

function renderGuestProfile(container, nameElement) {
  if (!container) return;
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'profile-placeholder';
  div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
  div.textContent = 'G';
  container.appendChild(div);
  if (nameElement) nameElement.textContent = 'Guest';
}

function renderFallbackProfile(container, nameElement, user) {
  if (container) container.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
  if (nameElement) nameElement.textContent = user?.email?.split('@')[0] || 'User';
}

function updateProfileSwitcher() {
  const profileList = document.getElementById('profile-list');
  const currentProfileName = document.getElementById('current-profile-name');
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  
  if (!profileList || !currentProfileName || !profilePlaceholder) return;
  
  if (window.currentProfile) {
    currentProfileName.textContent = window.currentProfile.name || 'Profile';
    while (profilePlaceholder.firstChild) {
      profilePlaceholder.removeChild(profilePlaceholder.firstChild);
    }
    if (window.currentProfile.avatar_url) {
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.src = fixAvatarUrl(window.currentProfile.avatar_url);
      img.alt = window.currentProfile.name;
      img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
      profilePlaceholder.appendChild(img);
    } else {
      const initials = getInitials(window.currentProfile.name);
      const div = document.createElement('div');
      div.className = 'profile-placeholder';
      div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
      div.textContent = initials;
      profilePlaceholder.appendChild(div);
    }
  }
  
  profileList.innerHTML = (window.userProfiles || []).map(profile => {
    const initials = getInitials(profile.name);
    const isActive = window.currentProfile?.id === profile.id;
    return `
      <div class="profile-item ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
        <div class="profile-avatar-small">
          ${profile.avatar_url 
            ? `<img src="${fixAvatarUrl(profile.avatar_url)}" alt="${escapeHtml(profile.name)}">`
            : `<div class="profile-initials">${initials}</div>`
          }
        </div>
        <span class="profile-name">${escapeHtml(profile.name)}</span>
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
        await loadContinueWatchingSection();
        await loadForYouSection();
        showToast(`Switched to ${profile.name}`, 'success');
      }
    });
  });
  
  const profileBtn = document.getElementById('current-profile-btn');
  const dropdown = document.getElementById('profile-dropdown');
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
  
  applyMobileHeaderStyles();
}

window.addEventListener('resize', () => {
  applyMobileHeaderStyles();
});

// ============================================
// BOTTOM NAVIGATION BUTTON FUNCTIONS (from home feed)
// ============================================
function setupNavigationButtons() {
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navCreateBtn = document.getElementById('nav-create-btn');
  const navMenuBtn = document.getElementById('nav-menu-btn');
  const navHistoryBtn = document.getElementById('nav-history-btn');
  
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
  
  if (navCreateBtn) {
    navCreateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const { data } = await window.supabaseClient.auth.getSession();
      if (data?.session) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to create content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  if (navHistoryBtn) {
    navHistoryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  if (navMenuBtn) {
    const newNavMenuBtn = navMenuBtn.cloneNode(true);
    navMenuBtn.parentNode.replaceChild(newNavMenuBtn, navMenuBtn);
    newNavMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📱 Menu button clicked - opening sidebar');
      const sidebarMenu = document.getElementById('sidebar-menu');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebarMenu && sidebarOverlay) {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      } else {
        console.warn('Sidebar elements not found');
      }
    });
  }
}

function setupNavButtonScrollAnimation() {
  let lastScrollTop = 0;
  const navContainer = document.querySelector('.navigation-button-container');
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      navContainer.style.opacity = '0';
      navContainer.style.transform = 'translateY(20px)';
    } else {
      navContainer.style.opacity = '1';
      navContainer.style.transform = 'translateY(0)';
    }
    lastScrollTop = scrollTop;
  });
}

// ============================================
// PHASE 1: CONTINUE WATCHING — LOAD & RENDER (SINGLE SECTION)
// ============================================
async function loadContinueWatching(userId, limit) {
  if (limit === undefined) limit = 8;
  
  var section = document.getElementById('continueWatchingSection');
  if (!section) return;
  
  if (!userId || !window.supabaseClient) {
    section.style.display = 'none';
    return;
  }
  
  try {
    var { data, error } = await window.supabaseClient
      .from('watch_progress')
      .select(`
        content_id,
        last_position,
        is_completed,
        updated_at,
        Content (
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          status,
          user_profiles!user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .neq('last_position', 0)
      .eq('Content.status', 'published')
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    renderContinueWatching(data);
    section.style.display = 'block';
  } catch (error) {
    console.error('❌ Failed to load continue watching:', error);
    section.style.display = 'none';
  }
}

function renderContinueWatching(items) {
  var container = document.getElementById('continueGrid');
  if (!container) return;
  
  container.innerHTML = items.map(function(item) {
    var content = item.Content;
    if (!content) return '';
    
    var progress = content.duration > 0
      ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
      : 0;
    var timeWatched = formatDuration(item.last_position);
    var totalTime = formatDuration(content.duration);
    var thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url)
      || content.thumbnail_url
      || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    var creatorName = content.user_profiles?.full_name
      || content.user_profiles?.username
      || 'Creator';
    
    return `
      <a href="content-detail.html?id=${content.id}" class="content-card continue-card" data-content-id="${content.id}">
        <div class="card-thumbnail">
          <img src="${thumbnailUrl}"
               alt="${escapeHtml(content.title)}"
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          <div class="progress-bar-overlay">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <div class="resume-badge">
            <i class="fas fa-play"></i> Resume
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(content.title, 45)}</h3>
          <div class="related-meta">
            <span>${timeWatched} / ${totalTime}</span>
          </div>
          <div class="creator-chip">
            <i class="fas fa-user"></i>
            ${truncateText(creatorName, 20)}
          </div>
        </div>
      </a>
    `;
  }).join('');
  
  container.querySelectorAll('.continue-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (window.track?.continueWatchingClick) {
        var contentId = card.dataset.contentId;
        window.track.continueWatchingClick(contentId);
      }
    });
  });
}

function setupContinueWatchingRefresh() {
  var refreshBtn = document.getElementById('refreshContinueBtn');
  if (!refreshBtn) return;
  
  refreshBtn.addEventListener('click', async function() {
    if (!window.currentUserId) return;
    showToast('Refreshing...', 'info');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
      await loadContinueWatching(window.currentUserId);
      showToast('Updated!', 'success');
    } catch (error) {
      console.error('Refresh failed:', error);
      showToast('Refresh failed', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fas fa-redo"></i>';
    }
  });
}

// ============================================
// PHASE 4: QUALITY INDICATOR UPDATE FUNCTION
// ============================================
function updateQualityIndicator(quality) {
  const indicator = document.getElementById('qualityBadge');
  const dataSaverBadge = document.getElementById('dataSaverBadge');
  
  if (!indicator) return;
  
  indicator.style.display = 'block';
  indicator.textContent = quality.toUpperCase();
  
  indicator.classList.remove('auto', 'hd');
  if (quality === 'auto') {
    indicator.classList.add('auto');
  } else if (['720p', '1080p'].includes(quality)) {
    indicator.classList.add('hd');
  }
  
  if (window.streamingManager?.isDataSaverEnabled()) {
    dataSaverBadge?.style.setProperty('display', 'block');
  } else {
    dataSaverBadge?.style.setProperty('display', 'none');
  }
  
  setTimeout(() => {
    if (indicator && !window.streamingManager?.isDataSaverEnabled()) {
      indicator.style.display = 'none';
    }
  }, 5000);
}

// ============================================
// PHASE 4: NETWORK SPEED INDICATOR UPDATE
// ============================================
function updateNetworkSpeedIndicator(speedMbps) {
  const indicator = document.getElementById('networkSpeedIndicator');
  const valueSpan = document.getElementById('networkSpeedValue');
  
  if (!indicator || !valueSpan) return;
  
  if (speedMbps) {
    valueSpan.textContent = speedMbps.toFixed(1) + ' Mbps';
    indicator.style.display = 'flex';
    
    indicator.classList.remove('good', 'fair', 'poor');
    if (speedMbps > 5) {
      indicator.classList.add('good');
    } else if (speedMbps > 2) {
      indicator.classList.add('fair');
    } else {
      indicator.classList.add('poor');
    }
  } else {
    indicator.style.display = 'none';
  }
}

// ============================================
// PHASE 4: Setup quality selector UI
// ============================================
function setupQualitySelector() {
  const qualityContainer = document.getElementById('qualityOptions');
  if (!qualityContainer) {
    console.warn('⚠️ Quality options container not found');
    return;
  }
  
  const qualities = window.streamingManager?.getAvailableQualities?.() || [
    { label: 'Auto', value: 'auto' },
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
    { label: '480p', value: '480p' },
    { label: '360p', value: '360p' }
  ];
  
  console.log('📺 Setting up quality selector with', qualities.length, 'qualities');
  
  qualityContainer.innerHTML = qualities.map(q => `
    <button class="quality-option ${q.value === window.streamingManager?.getCurrentQuality?.() ? 'active' : ''}"
            data-quality="${q.value}">
      ${q.label}
    </button>
  `).join('');
  
  qualityContainer.querySelectorAll('.quality-option').forEach(btn => {
    btn.addEventListener('click', async function() {
      const quality = this.dataset.quality;
      
      qualityContainer.querySelectorAll('.quality-option').forEach(b =>
        b.classList.remove('active')
      );
      this.classList.add('active');
      
      if (window.streamingManager) {
        await window.streamingManager.setQuality(quality);
        console.log('📺 Quality changed to:', quality);
        showToast('Quality: ' + quality.toUpperCase(), 'info');
      }
      
      const settingsMenu = document.querySelector('.settings-menu');
      if (settingsMenu) {
        settingsMenu.classList.remove('active');
      }
    });
  });
  
  console.log('✅ Quality selector initialized');
}

function setupDataSaverToggle() {
  const toggle = document.getElementById('dataSaverToggle');
  if (!toggle) return;
  
  if (window.streamingManager?.isDataSaverEnabled()) {
    toggle.checked = true;
  }
  
  toggle.addEventListener('change', async function() {
    if (window.streamingManager) {
      window.streamingManager.toggleDataSaver(this.checked);
    }
  });
}

// ======================
// ANALYTICS MODAL
// ======================
function initAnalyticsModal() {
  const analyticsBtn = document.getElementById('analytics-btn');
  const analyticsModal = document.getElementById('analytics-modal');
  const closeAnalytics = document.getElementById('close-analytics');
  
  if (!analyticsBtn || !analyticsModal) return;
  
  analyticsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    analyticsModal.classList.add('active');
    loadContentAnalytics();
  });
  
  if (closeAnalytics) {
    closeAnalytics.addEventListener('click', function() {
      analyticsModal.classList.remove('active');
    });
  }
  
  analyticsModal.addEventListener('click', function(e) {
    if (e.target === analyticsModal) {
      analyticsModal.classList.remove('active');
    }
  });
}

async function loadContentAnalytics() {
  if (!window.currentContent) return;
  
  try {
    const { data: viewsData } = await window.supabaseClient
      .from('content_views')
      .select('id, viewed_at')
      .eq('content_id', window.currentContent.id)
      .order('viewed_at', { ascending: false })
      .limit(100);
    
    const { data: commentsData } = await window.supabaseClient
      .from('comments')
      .select('id, created_at')
      .eq('content_id', window.currentContent.id);
    
    const totalViews = viewsData?.length || 0;
    const totalComments = commentsData?.length || 0;
    
    document.getElementById('content-total-views').textContent = formatNumber(totalViews);
    document.getElementById('total-comments').textContent = formatNumber(totalComments);
    document.getElementById('avg-watch-time').textContent = '4m 23s';
    document.getElementById('engagement-rate').textContent = '68%';
    document.getElementById('views-trend').textContent = '+12%';
    document.getElementById('comments-trend').textContent = '+8%';
    document.getElementById('watch-time-trend').textContent = '+5%';
    document.getElementById('engagement-trend').textContent = '+3%';
    
    if (typeof Chart !== 'undefined') {
      initEngagementChart();
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

function initEngagementChart() {
  const ctx = document.getElementById('content-engagement-chart');
  if (!ctx) return;
  
  if (window.contentEngagementChart) {
    window.contentEngagementChart.destroy();
  }
  
  window.contentEngagementChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Views',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true
      }, {
        label: 'Comments',
        data: [28, 48, 40, 19, 86, 27, 90],
        borderColor: '#1D4ED8',
        backgroundColor: 'rgba(29, 78, 216, 0.1)',
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
            color: 'var(--soft-white)'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        }
      }
    }
  });
}

function loadPersonalAnalytics() {
  console.log('Loading personal analytics...');
}

function renderNotifications() {
  console.log('Rendering notifications...');
}

function loadUserBadges() {
  console.log('Loading user badges...');
}

function loadWatchPartyContent() {
  console.log('Loading watch party content...');
}

function loadContinueWatchingSection() {
  if (window.currentUserId) {
    loadContinueWatching(window.currentUserId);
  }
}

function loadForYouSection() {
  console.log('Loading for you section...');
}

function fixAvatarUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return window.SupabaseHelper?.fixMediaUrl?.(url) || url;
}

// ======================
// SEARCH MODAL
// ======================
function initSearchModal() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  
  if (!searchBtn || !searchModal) return;
  
  searchBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    searchModal.classList.add('active');
    setTimeout(function() {
      if (searchInput) searchInput.focus();
    }, 300);
  });
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', function() {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    });
  }
  
  searchModal.addEventListener('click', function(e) {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    }
  });
  
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async function(e) {
      var query = e.target.value.trim();
      var category = document.getElementById('category-filter')?.value;
      var sortBy = document.getElementById('sort-filter')?.value;
      
      if (query.length < 2) {
        document.getElementById('search-results-grid').innerHTML =
          '<div class="no-results">Start typing to search...</div>';
        return;
      }
      
      document.getElementById('search-results-grid').innerHTML =
        '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
      
      try {
        var results = await searchContent(query, category, sortBy);
        renderSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        document.getElementById('search-results-grid').innerHTML =
          '<div class="no-results">Error searching. Please try again.</div>';
      }
    }, 300));
  }
  
  var categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', triggerSearch);
  }
  
  var sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', triggerSearch);
  }
}

function triggerSearch() {
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    var event = new Event('input');
    searchInput.dispatchEvent(event);
  }
}

async function searchContent(query, category, sortBy) {
  try {
    var orderBy = 'created_at';
    var order = 'desc';
    
    if (sortBy === 'popular') {
      orderBy = 'views_count';
    } else if (sortBy === 'trending') {
      orderBy = 'likes_count';
    }
    
    var queryBuilder = window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .ilike('title', `%${query}%`)
      .eq('status', 'published')
      .order(orderBy, { ascending: order === 'asc' })
      .limit(20);
    
    if (category) {
      queryBuilder = queryBuilder.eq('genre', category);
    }
    
    var { data, error } = await queryBuilder;
    if (error) throw error;
    
    var enrichedResults = await Promise.all(
      (data || []).map(async function(item) {
        var { count: realViews } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        return Object.assign({}, item, { real_views_count: realViews || 0 });
      })
    );
    
    return enrichedResults || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function renderSearchResults(results) {
  var grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(function(item) {
    var creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
    var viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
    
    return `
      <div class="content-card" data-content-id="${item.id}">
        <div class="card-thumbnail">
          <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}"
               alt="${item.title}"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          <div class="thumbnail-overlay"></div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(item.title, 45)}</h3>
          <div class="related-meta">
            <i class="fas fa-eye"></i>
            <span>${formatNumber(viewsCount)} views</span>
          </div>
          <button class="creator-btn" data-creator-id="${item.user_id}" data-creator-name="${creator}">
            <i class="fas fa-user"></i>
            ${truncateText(creator, 15)}
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  grid.querySelectorAll('.content-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.creator-btn')) return;
      var id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
  
  grid.querySelectorAll('.creator-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.dataset.creatorId;
      var name = btn.dataset.creatorName;
      if (id) window.location.href = `creator-channel.html?id=${id}&name=${encodeURIComponent(name)}`;
    });
  });
}

// ======================
// NOTIFICATIONS PANEL
// ======================
function initNotificationsPanel() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const navNotificationsBtn = document.getElementById('nav-notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationsPanel.classList.add('active');
      loadUserNotifications();
      markAllNotificationsAsRead();
    });
  }
  
  if (navNotificationsBtn) {
    navNotificationsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationsPanel.classList.add('active');
      loadUserNotifications();
      markAllNotificationsAsRead();
    });
  }
  
  if (closeNotifications) {
    closeNotifications.addEventListener('click', function() {
      notificationsPanel.classList.remove('active');
    });
  }
  
  document.addEventListener('click', function(e) {
    if (notificationsPanel.classList.contains('active') &&
        !notificationsPanel.contains(e.target) &&
        !notificationsBtn.contains(e.target) &&
        (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
      notificationsPanel.classList.remove('active');
    }
  });
  
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async function() {
      await markAllNotificationsAsRead();
      await loadUserNotifications();
    });
  }
  
  if (window.AuthHelper?.isAuthenticated()) {
    loadUserNotifications();
    updateNotificationBadge();
  }
  
  document.addEventListener('authReady', loadUserNotifications);
}

async function loadUserNotifications() {
  var notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  try {
    if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>Sign in to see notifications</p>
        </div>
      `;
      updateNotificationBadge(0);
      return;
    }
    
    var userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-exclamation-triangle"></i>
          <p>User profile not found</p>
        </div>
      `;
      return;
    }
    
    var { data, error } = await window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;
      updateNotificationBadge(0);
      return;
    }
    
    notificationsList.innerHTML = data.map(function(notification) {
      return `
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
      `;
    }).join('');
    
    notificationsList.querySelectorAll('.notification-item').forEach(function(item) {
      item.addEventListener('click', async function() {
        var id = item.dataset.id;
        await markNotificationAsRead(id);
        var notification = data.find(function(n) { return n.id === id; });
        if (notification?.content_id) {
          window.location.href = `content-detail.html?id=${notification.content_id}`;
        }
        notificationsPanel.classList.remove('active');
      });
    });
    
    var unreadCount = data.filter(function(n) { return !n.is_read; }).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading notifications</p>
      </div>
    `;
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
  try {
    var { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    
    var item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.classList.add('read');
      var dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    }
    
    await loadUserNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  try {
    if (!window.AuthHelper?.isAuthenticated()) return;
    var userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) return;
    
    var { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userProfile.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    document.querySelectorAll('.notification-item.unread').forEach(function(item) {
      item.classList.remove('unread');
      item.classList.add('read');
      var dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    });
    
    updateNotificationBadge(0);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

function updateNotificationBadge(count) {
  if (count === undefined || count === null) {
    count = document.querySelectorAll('.notification-item.unread').length;
  }
  
  var mainBadge = document.getElementById('notification-count');
  var navBadge = document.getElementById('nav-notification-count');
  
  if (mainBadge) {
    mainBadge.textContent = count > 99 ? '99+' : count;
    mainBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  if (navBadge) {
    navBadge.textContent = count > 99 ? '99+' : count;
    navBadge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function formatNotificationTime(timestamp) {
  var now = new Date();
  var diffMs = now - new Date(timestamp);
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

// ======================
// GLOBAL NAVIGATION - FIXED: Clean event listeners and centered icons
// ======================
function initGlobalNavigation() {
  var homeBtn = document.querySelector('.nav-icon:nth-child(1)');
  if (homeBtn) {
    var newHomeBtn = homeBtn.cloneNode(true);
    homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
    newHomeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = 'https://bantustreamconnect.com/';
    });
  }
  
  var createBtn = document.querySelector('.nav-icon:nth-child(3)');
  if (createBtn) {
    var newCreateBtn = createBtn.cloneNode(true);
    createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
    newCreateBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  var dashboardBtn = document.querySelector('.nav-icon:nth-child(4)');
  if (dashboardBtn) {
    var newDashboardBtn = dashboardBtn.cloneNode(true);
    dashboardBtn.parentNode.replaceChild(newDashboardBtn, dashboardBtn);
    newDashboardBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-dashboard.html';
      } else {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = `login.html?redirect=creator-dashboard.html`;
      }
    });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function safeSetText(id, text) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = text || '';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return '-';
  }
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatCommentTime(timestamp) {
  if (!timestamp) return 'Just now';
  try {
    var date = new Date(timestamp);
    var now = new Date();
    var diffMs = now - date;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
    if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Recently';
  }
}

// Export key functions
window.UIScaleController = UIScaleController;
window.showToast = showToast;
window.formatDuration = formatDuration;
window.formatNumber = formatNumber;
window.formatTimeAgo = formatTimeAgo;
window.getInitials = getInitials;
window.debounce = debounce;
window.initThemeSelector = initThemeSelector;
window.applyTheme = applyTheme;
window.setupCompleteSidebar = setupCompleteSidebar;
window.updateSidebarProfile = updateSidebarProfile;
window.updateHeaderProfile = updateHeaderProfile;
window.updateProfileSwitcher = updateProfileSwitcher;
window.setupNavigationButtons = setupNavigationButtons;
window.setupNavButtonScrollAnimation = setupNavButtonScrollAnimation;
window.loadContinueWatching = loadContinueWatching;
window.setupContinueWatchingRefresh = setupContinueWatchingRefresh;
window.updateQualityIndicator = updateQualityIndicator;
window.updateNetworkSpeedIndicator = updateNetworkSpeedIndicator;
window.setupQualitySelector = setupQualitySelector;
window.setupDataSaverToggle = setupDataSaverToggle;
window.initAnalyticsModal = initAnalyticsModal;
window.initSearchModal = initSearchModal;
window.initNotificationsPanel = initNotificationsPanel;
window.initGlobalNavigation = initGlobalNavigation;
window.safeSetText = safeSetText;
window.formatDate = formatDate;
window.truncateText = truncateText;
window.escapeHtml = escapeHtml;
window.formatCommentTime = formatCommentTime;

console.log('✅ content-detail-features.js loaded - UI components, modals, and utility functions');
