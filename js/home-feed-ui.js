// ============================================
// HOME FEED UI - CORE UTILITIES & INTERACTIONS
// ============================================
// Cleaned: Removed migrated header, nav, sidebar, footer, and section logic.
// Preserved: Skeleton loading, UI scale, theme management, modals, shortcuts, and utilities.

// ============================================
// UI SCALE CONTROLLER
// ============================================
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
            if (typeof window.showToast === 'function') window.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    decrease() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.step);
            this.applyScale();
            if (typeof window.showToast === 'function') window.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    reset() {
        this.scale = 1;
        this.applyScale();
        if (typeof window.showToast === 'function') window.showToast('UI Size reset to default', 'success');
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

// Initialize globally if not already done
if (!window.uiScaleController) {
    window.uiScaleController = new UIScaleController();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.uiScaleController.init());
    } else {
        window.uiScaleController.init();
    }
}

// ============================================
// TOAST & UI CONTAINER SETUP
// ============================================
function setupToastContainer() {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }
}

function showToast(message, type = 'info') {
    setupToastContainer();
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: var(--card-bg, rgba(15,23,42,0.9));
        backdrop-filter: blur(10px);
        border: 1px solid var(--card-border, rgba(148,163,184,0.2));
        border-radius: 50px;
        padding: 12px 24px;
        color: var(--soft-white, #F8FAFC);
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
        animation: toastSlideIn 0.3s ease;
    `;

    const icons = {
        success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
    };
    toast.innerHTML = `<span style="font-size:16px;">${icons[type] || icons.info}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;

// ============================================
// MODAL MANAGEMENT
// ============================================
function closeAllModals() {
    const modalIds = [
        'search-modal', 'notifications-panel', 'analytics-modal', 
        'watch-party-modal', 'tip-modal', 'badges-modal', 'theme-selector'
    ];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    const dropdowns = ['profile-dropdown'];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
}

// ============================================
// THEME MANAGEMENT (INSTANT APPLY)
// ============================================
function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);
    
    // Apply inline variables for instant visual update
    const themes = {
        'dark': { '--deep-black': '#0A0E12', '--soft-white': '#F8FAFC', '--slate-grey': '#94A3B8', '--card-bg': 'rgba(15, 23, 42, 0.6)', '--card-border': 'rgba(148, 163, 184, 0.2)' },
        'light': { '--deep-black': '#F8FAFC', '--soft-white': '#0F172A', '--slate-grey': '#64748B', '--card-bg': 'rgba(255, 255, 255, 0.9)', '--card-border': 'rgba(100, 116, 139, 0.2)' },
        'high-contrast': { '--deep-black': '#000000', '--soft-white': '#FFFFFF', '--slate-grey': '#E5E7EB', '--warm-gold': '#FFD700', '--bantu-blue': '#00BFFF', '--card-bg': 'rgba(17, 24, 39, 0.95)', '--card-border': '#FFFFFF' }
    };
    
    if (themes[theme]) {
        Object.entries(themes[theme]).forEach(([key, value]) => root.style.setProperty(key, value));
    }
    
    void root.offsetWidth; // Force reflow
    localStorage.setItem('bantu_theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    if (typeof window.showToast === 'function') window.showToast(`Theme changed to ${theme}`, 'success');
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    if (!themeSelector) return;

    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-option').forEach(option => {
        const newOption = option.cloneNode(true);
        option.parentNode?.replaceChild(newOption, option);
        newOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            applyTheme(newOption.dataset.theme);
            setTimeout(() => themeSelector.classList.remove('active'), 100);
        });
    });

    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') && !themeSelector.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && themeSelector.classList.contains('active')) themeSelector.classList.remove('active');
    });
}

// ============================================
// SKELETON LOADING UI HELPER (PRESERVED)
// ============================================
function showSkeletonLoading(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container || container.children.length > 0) return;
    
    container.innerHTML = Array(count).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('search-btn')?.click();
        }
        if (e.key === 'Escape') closeAllModals();
    });
}

// ============================================
// BACK TO TOP
// ============================================
function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;
    
    backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    });
}

// ============================================
// UTILITY HELPERS
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
}
window.getInitials = getInitials;

// ============================================
// INITIALIZATION
// ============================================
function initializeHomeFeedUI() {
    console.log('🎨 Initializing Core UI System...');
    setupToastContainer();
    setupThemeSelector();
    setupKeyboardShortcuts();
    setupBackToTop();
    console.log('✅ Core UI System initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHomeFeedUI);
} else {
    initializeHomeFeedUI();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UIScaleController,
        showToast,
        closeAllModals,
        applyTheme,
        setupThemeSelector,
        showSkeletonLoading,
        setupKeyboardShortcuts,
        setupBackToTop,
        formatTimeAgo,
        escapeHtml,
        getInitials,
        initializeHomeFeedUI
    };
}
