// ============================================
// MANAGE PROFILES UI - Professional Version
// ============================================

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesUI() {
    console.log('🎯 Initializing Manage Profiles UI');
    
    setupToastContainer();
    setupBackToTop();
    setupThemeSelector();
    setupScaleControl();
    setupKeyboardShortcuts();
    setupSearchModal();
    setupNotificationsPanel();
    setupAnalyticsModal();
    setupWatchPartyModal();
    setupTipModal();
    setupBadgesModal();
}

// ============================================
// TOAST CONTAINER SETUP
// ============================================
function setupToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

// ============================================
// SHOW TOAST
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
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
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// BACK TO TOP
// ============================================
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

// ============================================
// CLOSE ALL MODALS
// ============================================
function closeAllModals() {
    const modals = [
        'profile-modal',
        'delete-modal',
        'delete-all-modal',
        'search-modal',
        'notifications-panel',
        'analytics-modal',
        'watch-party-modal',
        'tip-modal',
        'badges-modal',
        'theme-selector'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    });
    
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        profileDropdown.classList.remove('active');
    }
}

// ============================================
// THEME SELECTOR SETUP
// ============================================
function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    if (!themeSelector) return;
    
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeSelector.classList.remove('active');
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!themeSelector.contains(e.target) && !e.target.closest('#sidebar-theme-toggle')) {
            themeSelector.classList.remove('active');
        }
    });
}

// ============================================
// APPLY THEME
// ============================================
function applyTheme(theme) {
    const root = document.documentElement;
    
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    
    switch(theme) {
        case 'light':
            root.classList.add('theme-light');
            root.style.setProperty('--deep-black', '#ffffff');
            root.style.setProperty('--soft-white', '#1a1a1a');
            root.style.setProperty('--slate-grey', '#666666');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
            break;
            
        case 'high-contrast':
            root.classList.add('theme-high-contrast');
            root.style.setProperty('--deep-black', '#000000');
            root.style.setProperty('--soft-white', '#ffffff');
            root.style.setProperty('--slate-grey', '#ffff00');
            root.style.setProperty('--warm-gold', '#ff0000');
            root.style.setProperty('--bantu-blue', '#00ff00');
            root.style.setProperty('--card-bg', '#000000');
            root.style.setProperty('--card-border', '#ffffff');
            break;
            
        default:
            root.classList.add('theme-dark');
            root.style.setProperty('--deep-black', '#0A0E12');
            root.style.setProperty('--soft-white', '#F8FAFC');
            root.style.setProperty('--slate-grey', '#94A3B8');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
            root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
            break;
    }
    
    localStorage.setItem('bantu_theme', theme);
    showToast(`Theme changed to ${theme}`, 'success');
}

// ============================================
// SCALE CONTROL SETUP
// ============================================
function setupScaleControl() {
    const decreaseBtn = document.getElementById('scale-decrease');
    const increaseBtn = document.getElementById('scale-increase');
    const resetBtn = document.getElementById('scale-reset');
    const scaleValue = document.getElementById('scale-value');
    const sidebarScaleValue = document.getElementById('sidebar-scale-value');
    
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            window.uiScaleController.decrease();
            updateScaleDisplay();
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            window.uiScaleController.increase();
            updateScaleDisplay();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.uiScaleController.reset();
            updateScaleDisplay();
        });
    }
    
    function updateScaleDisplay() {
        const percentage = Math.round(window.uiScaleController.getScale() * 100) + '%';
        if (scaleValue) scaleValue.textContent = percentage;
        if (sidebarScaleValue) sidebarScaleValue.textContent = percentage;
    }
    
    document.addEventListener('scaleChanged', updateScaleDisplay);
}

// ============================================
// KEYBOARD SHORTCUTS SETUP
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) return;
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('search-btn')?.click();
        }
        
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            toggleNotifications();
        }
        
        if (e.altKey && e.key === 'a') {
            e.preventDefault();
            openAnalytics();
        }
        
        if (e.altKey && e.key === 'p') {
            e.preventDefault();
            toggleProfileDropdown();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (window.currentUser) {
                if (typeof openCreateProfileModal === 'function') {
                    openCreateProfileModal();
                }
            } else {
                showToast('Please sign in to create a profile', 'warning');
            }
        }
        
        if (e.key === 'Escape') {
            closeAllModals();
        }
        
        if (e.key === '?' && !e.shiftKey) {
            e.preventDefault();
            const shortcutsModal = document.getElementById('shortcuts-modal');
            if (shortcutsModal) {
                shortcutsModal.style.display = 'flex';
            }
        }
    });
    
    const closeShortcuts = document.getElementById('close-shortcuts');
    if (closeShortcuts) {
        closeShortcuts.addEventListener('click', () => {
            document.getElementById('shortcuts-modal').style.display = 'none';
        });
    }
}

// ============================================
// SEARCH MODAL SETUP
// ============================================
function setupSearchModal() {
    const searchBtn = document.getElementById('search-btn');
    const closeSearch = document.getElementById('close-search-btn');
    const searchModal = document.getElementById('search-modal');
    
    if (searchBtn && searchModal) {
        searchBtn.addEventListener('click', () => {
            searchModal.classList.add('active');
            setTimeout(() => {
                document.getElementById('search-input')?.focus();
            }, 100);
        });
    }
    
    if (closeSearch && searchModal) {
        closeSearch.addEventListener('click', () => {
            searchModal.classList.remove('active');
        });
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
// SETUP NOTIFICATIONS PANEL
// ============================================
function setupNotificationsPanel() {
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
        markAllRead.addEventListener('click', async () => {
            if (typeof markAllNotificationsRead === 'function') {
                await markAllNotificationsRead();
            }
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
// SETUP ANALYTICS MODAL
// ============================================
function setupAnalyticsModal() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const closeAnalytics = document.getElementById('close-analytics');
    const analyticsModal = document.getElementById('analytics-modal');
    
    if (analyticsBtn && analyticsModal) {
        analyticsBtn.addEventListener('click', openAnalytics);
    }
    
    if (closeAnalytics && analyticsModal) {
        closeAnalytics.addEventListener('click', () => {
            analyticsModal.classList.remove('active');
        });
    }
}

// ============================================
// TOGGLE PROFILE DROPDOWN
// ============================================
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// ============================================
// SETUP WATCH PARTY MODAL
// ============================================
function setupWatchPartyModal() {
    const closeBtn = document.getElementById('close-watch-party');
    const startBtn = document.getElementById('start-watch-party');
    const modal = document.getElementById('watch-party-modal');
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (typeof startWatchParty === 'function') {
                startWatchParty();
            }
        });
    }
}

// ============================================
// SETUP TIP MODAL
// ============================================
function setupTipModal() {
    const closeBtn = document.getElementById('close-tip');
    const sendBtn = document.getElementById('send-tip');
    const modal = document.getElementById('tip-modal');
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            if (typeof sendTipToCreator === 'function') {
                sendTipToCreator();
            }
        });
    }
}

// ============================================
// SETUP BADGES MODAL
// ============================================
function setupBadgesModal() {
    const closeBtn = document.getElementById('close-badges');
    const modal = document.getElementById('badges-modal');
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
}

// ============================================
// ESCAPE HTML
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
// UISCALECONTROLLER CLASS
// ============================================
class UIScaleController {
    constructor() {
        this.scaleKey = 'bantu_ui_scale';
        this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
        this.currentIndex = 2;
    }

    init() {
        const savedScale = localStorage.getItem(this.scaleKey);
        if (savedScale) {
            this.currentIndex = this.scales.indexOf(parseFloat(savedScale));
            if (this.currentIndex === -1) this.currentIndex = 2;
        }
        this.applyScale();
    }

    applyScale() {
        const scale = this.scales[this.currentIndex];
        document.documentElement.style.setProperty('--ui-scale', scale);
        localStorage.setItem(this.scaleKey, scale);
        document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale } }));
    }

    getScale() {
        return this.scales[this.currentIndex];
    }

    increase() {
        if (this.currentIndex < this.scales.length - 1) {
            this.currentIndex++;
            this.applyScale();
            this.showScaleToast();
        }
    }

    decrease() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.applyScale();
            this.showScaleToast();
        }
    }

    reset() {
        this.currentIndex = 2;
        this.applyScale();
        this.showScaleToast();
    }

    showScaleToast() {
        const scale = this.getScale();
        const percentage = Math.round(scale * 100);
        showToast(`UI Size: ${percentage}%`, 'info');
    }
}

// Export functions
window.initializeManageProfilesUI = initializeManageProfilesUI;
window.closeAllModals = closeAllModals;
window.toggleNotifications = toggleNotifications;
window.openAnalytics = openAnalytics;
window.formatTimeAgo = formatTimeAgo;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.UIScaleController = UIScaleController;
