// ============================================
// HOME FEED UI - MIGRATION WRAPPER
// ============================================
// All UI functionality has been migrated to:
// - shared-components.js (header, sidebar, theme, scale)
// - Individual module CSS files
// ============================================

console.log('🎨 home-feed-ui.js - Migration wrapper active');

// UI Scale Controller - kept for backward compatibility
class UIScaleController {
    constructor() {
        this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
        this.minScale = 0.8;
        this.maxScale = 1.4;
        this.step = 0.1;
    }

    init() {
        this.applyScale();
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
}

// Initialize UI Scale Controller if needed
if (!window.uiScaleController && typeof window !== 'undefined') {
    window.uiScaleController = new UIScaleController();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.uiScaleController.init());
    } else {
        window.uiScaleController.init();
    }
}

// Toast container setup (fallback)
function setupToastContainer() {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
}

// Close all modals helper
function closeAllModals() {
    const selectors = [
        '.analytics-modal.active', '.search-modal.active', 
        '.notifications-panel.active', '.watch-party-modal.active',
        '.tip-modal.active', '.badges-modal.active', '#profile-dropdown.active'
    ];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.classList.remove('active'));
    });
}

// Export to window
if (typeof window !== 'undefined') {
    window.UIScaleController = UIScaleController;
    window.closeAllModals = closeAllModals;
    window.setupToastContainer = setupToastContainer;
    
    // Run setup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupToastContainer);
    } else {
        setupToastContainer();
    }
}

console.log('✅ UI migration wrapper ready');
