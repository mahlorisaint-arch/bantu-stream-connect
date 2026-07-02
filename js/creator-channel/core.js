// ============================================
// CORE - CONFIGURATION, STATE, HELPERS
// ============================================

// ===== SUPABASE CONFIGURATION =====
// Check if supabase client already exists
if (!window.supabaseClient) {
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
        console.log('✅ Supabase client initialized in core.js');
    }
}

// Use the existing client or create a reference
const supabase = window.supabaseClient;

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

function getInitials(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  return names.length >= 2 ? (names[0][0] + names[names.length-1][0]).toUpperCase() : name[0].toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return url;
  return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
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

// ===== UI SCALE CONTROLLER =====
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

// ===== THEME SYSTEM FUNCTIONS =====
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
    console.log('🎨 Theme button clicked - toggling selector');
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
      console.log('🎨 Theme selected:', theme);
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
  
  console.log('✅ Theme system initialized');
}

function applyTheme(theme) {
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    theme = 'dark';
  }
  
  console.log('🎨 Applying theme:', theme);
  
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
  
  if (typeof showToast === 'function') {
    showToast(`Theme changed to ${theme}`, 'success');
  }
  
  console.log(`✅ Theme applied: ${theme}`);
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

// Make globals available
window.showToast = showToast;
window.formatNumber = formatNumber;
window.truncateText = truncateText;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.getInitials = getInitials;
window.fixMediaUrl = fixMediaUrl;
window.showConfetti = showConfetti;
window.formatDuration = formatDuration;
window.UIScaleController = UIScaleController;
window.initThemeSystem = initThemeSystem;
window.applyTheme = applyTheme;
window.setupScaleControls = setupScaleControls;
window.supabase = supabase;
