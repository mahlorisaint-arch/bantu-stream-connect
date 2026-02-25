// ============================================
// MANAGE PROFILES UI - Clean Version
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
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
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
            root.style.setProperty('--deep-black', '#0A0A0A');
            root.style.setProperty('--soft-white', '#F5F5F5');
            root.style.setProperty('--slate-grey', '#A0A0A0');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
            root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
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
    
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            window.uiScaleController.decrease();
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            window.uiScaleController.increase();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.uiScaleController.reset();
        });
    }
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
                openCreateProfileModal();
            } else {
                showToast('Please sign in to create a profile', 'warning');
            }
        }
        
        if (e.key === 'Escape') {
            closeAllModals();
        }
        
        if (e.key === '?' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('shortcuts-modal').style.display = 'flex';
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
// TOGGLE PROFILE DROPDOWN
// ============================================
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
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

// Export functions
window.initializeManageProfilesUI = initializeManageProfilesUI;
window.closeAllModals = closeAllModals;
window.toggleNotifications = toggleNotifications;
window.openAnalytics = openAnalytics;
window.formatTimeAgo = formatTimeAgo;
