// ============================================
// HOME FEED UI - Complete Version with Mobile Sidebar Fixes
// ============================================

// ============================================
// UI SCALE CONTROLLER - Add this class
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
        // Listen for scale change events to update UI
        document.addEventListener('scaleChanged', (e) => {
            this.updateScaleDisplay(e.detail.scale);
        });
    }

    applyScale() {
        document.documentElement.style.setProperty('--ui-scale', this.scale);
        localStorage.setItem('bantu_ui_scale', this.scale.toString());
        
        // Dispatch custom event for other components to react
        document.dispatchEvent(new CustomEvent('scaleChanged', {
            detail: { scale: this.scale }
        }));
        
        console.log('📏 Scale applied:', this.scale);
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

// Initialize UIScaleController if not already done
if (!window.uiScaleController) {
    window.uiScaleController = new UIScaleController();
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.uiScaleController.init();
        });
    } else {
        window.uiScaleController.init();
    }
}

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesUI() {
    console.log('🎯 Initializing Manage Profiles UI');
    
    setupToastContainer();
    setupBackToTop();
    setupThemeSelector();
    setupSidebarThemeToggle(); // ✅ Enhanced sidebar theme toggle
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
// THEME SELECTOR SETUP - FIXED VERSION (INSTANT APPLY, NO REFRESH)
// ============================================
function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    console.log('🎨 Theme Setup - Selector:', !!themeSelector, 'Toggle:', !!themeToggle);
    
    if (!themeSelector) {
        console.error('❌ Theme selector element not found!');
        return;
    }
    
    // Apply saved theme IMMEDIATELY on load
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    // Theme option click handlers - Use event delegation for reliability
    const themeOptions = document.querySelectorAll('.theme-option');
    console.log('🎨 Theme Options Found:', themeOptions.length);
    
    themeOptions.forEach((option, index) => {
        // Remove any existing listeners by cloning
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        newOption.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const theme = this.dataset.theme;
            console.log('🎨 Theme clicked:', theme);
            applyTheme(theme);
            setTimeout(() => {
                themeSelector.classList.remove('active');
            }, 100);
            if (typeof showToast === 'function') {
                showToast(`Theme changed to ${theme}`, 'success');
            }
        });
        
        console.log(`🎨 Theme option ${index + 1} listener attached`);
    });
    
    // Toggle theme selector visibility from sidebar
    if (themeToggle) {
        themeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎨 Theme toggle clicked');
            themeSelector.classList.toggle('active');
        });
    }
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (themeSelector.classList.contains('active') && 
            !themeSelector.contains(e.target) && 
            !e.target.closest('#sidebar-theme-toggle') &&
            !e.target.closest('.sidebar-theme-toggle')) {
            themeSelector.classList.remove('active');
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && themeSelector.classList.contains('active')) {
            themeSelector.classList.remove('active');
        }
    });
}

// ============================================
// SIDEBAR THEME TOGGLE - FIXED VERSION (Enhanced)
// ============================================
function setupSidebarThemeToggle() {
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    const themeSelector = document.getElementById('theme-selector');
    const sidebarClose = document.getElementById('sidebar-close');
    
    console.log('🎨 Sidebar Theme Toggle Setup - Toggle:', !!themeToggle, 'Selector:', !!themeSelector);
    
    if (!themeToggle) {
        console.error('❌ Sidebar theme toggle not found!');
        return;
    }
    
    // Remove existing listener by cloning
    const newToggle = themeToggle.cloneNode(true);
    themeToggle.parentNode.replaceChild(newToggle, themeToggle);
    
    newToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎨 Sidebar theme toggle clicked');
        
        // Close sidebar first for smooth transition
        if (sidebarClose) {
            sidebarClose.click();
        }
        
        // Small delay to ensure sidebar overlay is removed before showing theme selector
        setTimeout(() => {
            if (themeSelector) {
                const isActive = themeSelector.classList.contains('active');
                themeSelector.classList.toggle('active');
                console.log('🎨 Theme selector active:', !isActive);
                
                // Force reflow to ensure CSS applies
                void themeSelector.offsetWidth;
            }
        }, 150); // 150ms delay for smooth transition
    });
}

// ============================================
// APPLY THEME - FIXED VERSION (Instant Apply)
// ============================================
function applyTheme(theme) {
    const root = document.documentElement;
    console.log('🎨 Applying theme:', theme);
    
    // Remove all theme classes first
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    
    // Apply new theme class
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
    
    console.log('🎨 Theme applied successfully:', theme);
    console.log('🎨 Current classes:', root.className);
    
    // Show confirmation toast
    if (typeof showToast === 'function') {
        showToast(`Theme changed to ${theme}`, 'success');
    }
    
    // Dispatch custom event for other components to react
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: theme }
    }));
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
            const shortcutsModal = document.getElementById('shortcuts-modal');
            if (shortcutsModal) {
                shortcutsModal.style.display = 'flex';
            }
        }
    });
    
    const closeShortcuts = document.getElementById('close-shortcuts');
    if (closeShortcuts) {
        closeShortcuts.addEventListener('click', () => {
            const shortcutsModal = document.getElementById('shortcuts-modal');
            if (shortcutsModal) {
                shortcutsModal.style.display = 'none';
            }
        });
    }
    
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) {
                shortcutsModal.style.display = 'none';
            }
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
// OPEN CREATE PROFILE MODAL
// ============================================
function openCreateProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.add('active');
        
        // Reset form
        const nameInput = document.getElementById('profile-name');
        if (nameInput) nameInput.value = '';
        
        const avatarInput = document.getElementById('profile-avatar');
        if (avatarInput) avatarInput.value = '';
        
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) {
            avatarPreview.style.display = 'none';
            avatarPreview.querySelector('img')?.remove();
        }
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
// SHOW TOAST (if not already defined)
// ============================================
if (typeof window.showToast === 'undefined') {
    window.showToast = function(message, type = 'info') {
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
    };
}

// ============================================
// ESCAPE HTML (helper for toast)
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// GET INITIALS (if not already defined)
// ============================================
if (typeof window.getInitials === 'undefined') {
    window.getInitials = function(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };
}

// ============================================
// SIDEBAR PROFILE TRUNCATION FIX
// ============================================
function fixSidebarProfileTruncation() {
    const profileName = document.getElementById('sidebar-profile-name');
    const profileEmail = document.getElementById('sidebar-profile-email');
    
    if (profileName) {
        // Ensure text truncation works with CSS
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

// ============================================
// SIDEBAR SCALE CONTROLS SETUP
// ============================================
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

// ============================================
// MOBILE SIDEBAR OPTIMIZATION
// ============================================
function optimizeMobileSidebar() {
    if (window.innerWidth <= 768) {
        // Ensure sidebar content doesn't overflow on mobile
        const sidebarProfile = document.getElementById('sidebar-profile');
        const sidebarNav = document.getElementById('sidebar-nav');
        
        if (sidebarProfile) {
            sidebarProfile.style.minWidth = '0';
        }
        
        if (sidebarNav) {
            sidebarNav.style.overflowY = 'auto';
            sidebarNav.style.WebkitOverflowScrolling = 'touch';
        }
    }
}

// ============================================
// SETUP MOBILE SIDEBAR BEHAVIOR (YouTube-like)
// ============================================
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
    
    // Handle safe area insets for modern mobile devices
    if (window.CSS && CSS.supports('padding-bottom', 'env(safe-area-inset-bottom)')) {
        const sidebarFooter = document.getElementById('sidebar-footer');
        if (sidebarFooter) {
            sidebarFooter.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom))';
        }
    }
}

// ============================================
// COMPLETE SIDEBAR SETUP (All mobile fixes)
// ============================================
function setupCompleteSidebar() {
    setupMobileSidebar();
    fixSidebarProfileTruncation();
    setupSidebarScaleControls();
    optimizeMobileSidebar();
    
    // Listen for resize events to re-apply mobile optimizations
    window.addEventListener('resize', () => {
        optimizeMobileSidebar();
    });
}

// ============================================
// EXPORT FUNCTIONS
// ============================================
window.initializeManageProfilesUI = initializeManageProfilesUI;
window.closeAllModals = closeAllModals;
window.toggleNotifications = toggleNotifications;
window.openAnalytics = openAnalytics;
window.openCreateProfileModal = openCreateProfileModal;
window.formatTimeAgo = formatTimeAgo;
window.applyTheme = applyTheme;
window.setupThemeSelector = setupThemeSelector;
window.setupSidebarThemeToggle = setupSidebarThemeToggle;
window.setupCompleteSidebar = setupCompleteSidebar;
window.setupMobileSidebar = setupMobileSidebar;
window.fixSidebarProfileTruncation = fixSidebarProfileTruncation;
window.setupSidebarScaleControls = setupSidebarScaleControls;
window.optimizeMobileSidebar = optimizeMobileSidebar;
window.UIScaleController = UIScaleController;

// ============================================
// AUTO-INITIALIZE ON DOM READY
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeManageProfilesUI();
        setupCompleteSidebar();
    });
} else {
    initializeManageProfilesUI();
    setupCompleteSidebar();
}
