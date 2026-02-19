// Content Card System
class ContentCardSystem {
    constructor() {
        this.renderedCards = new Set();
        this.virtualScrollObserver = null;
    }
    
    init() {
        this.setupVirtualScrolling();
        this.setupCardStats();
    }
    
    setupVirtualScrolling() {
        if ('IntersectionObserver' in window) {
            this.virtualScrollObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        this.loadCardContent(card);
                    }
                });
            }, { threshold: 0.1 });
        }
    }
    
    loadCardContent(card) {
        const contentId = card.dataset.contentId;
        if (!contentId || this.renderedCards.has(contentId)) return;
        
        // Lazy load images
        const images = card.querySelectorAll('img[data-src]');
        images.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
        
        this.renderedCards.add(contentId);
    }
    
    createContentCard(item, options = {}) {
        const {
            showTrendingBadge = false,
            showRecommendedBadge = false,
            showContinueWatching = false,
            continueWatchingProgress = 0
        } = options;
        
        // Safety check for continueWatchingSystem
        const progress = continueWatchingProgress || (typeof continueWatchingSystem !== 'undefined' && continueWatchingSystem ? continueWatchingSystem.getWatchProgress(item.id) : 0);
        
        return `
            <div class="content-card ${showTrendingBadge ? 'trending-card' : ''}" 
                 data-content-id="${item.id}" 
                 data-views="${item.views || 0}" 
                 data-likes="${item.likes || 0}">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="video-preview-container">
                        <video class="video-preview" muted preload="metadata">
                            <source src="${item.file_url || ''}" type="video/mp4">
                        </video>
                    </div>
                    
                    ${showTrendingBadge ? `
                        <div class="trending-badge">
                            <i class="fas fa-fire"></i> Trending
                        </div>
                    ` : ''}
                    
                    ${showRecommendedBadge ? `
                        <div class="recommended-badge">
                            <i class="fas fa-star"></i> Recommended
                        </div>
                    ` : ''}
                    
                    ${showContinueWatching && progress > 0 && progress < 90 ? `
                        <div class="continue-watching-badge">
                            <i class="fas fa-play-circle"></i>
                            Continue
                        </div>
                        <div class="continue-watching-progress">
                            <div class="continue-watching-progress-fill" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                    
                    <button class="share-btn" title="Share" data-content-id="${item.id}">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${this.truncateText(item.title, 50)}
                    </h3>
                    <div class="card-stats">
                        <span class="stat" title="Views">
                            <i class="fas fa-eye"></i> ${this.formatNumber(item.views || 0)}
                        </span>
                        <span class="stat" title="Likes">
                            <i class="fas fa-heart"></i> ${this.formatNumber(item.likes || 0)}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id}"
                            data-creator-name="${item.creator}">
                        <i class="fas fa-user"></i>
                        ${this.truncateText(item.creator, 15)}
                    </button>
                </div>
            </div>
        `;
    }
    
    createTrendingCard(item) {
        return this.createContentCard(item, { showTrendingBadge: true });
    }
    
    createRecommendedCard(item) {
        return this.createContentCard(item, { showRecommendedBadge: true });
    }
    
    setupCardStats() {
        document.querySelectorAll('.content-card').forEach(card => {
            this.addStatsToCard(card);
        });
        
        // Observe for new cards
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList?.contains('content-card')) {
                        this.addStatsToCard(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    addStatsToCard(card) {
        if (card.classList.contains('stats-added')) return;
        
        const views = card.dataset.views || 0;
        const likes = card.dataset.likes || 0;
        
        // Find or create stats element
        let statsElement = card.querySelector('.card-stats');
        if (!statsElement) {
            statsElement = document.createElement('div');
            statsElement.className = 'card-stats';
            const creatorBtn = card.querySelector('.creator-btn');
            if (creatorBtn) {
                card.querySelector('.card-content').insertBefore(statsElement, creatorBtn);
            }
        }
        
        statsElement.innerHTML = `
            <span class="stat" title="Views">
                <i class="fas fa-eye"></i> ${this.formatNumber(views)}
            </span>
            <span class="stat" title="Likes">
                <i class="fas fa-heart"></i> ${this.formatNumber(likes)}
            </span>
        `;
        
        card.classList.add('stats-added');
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    formatNumber(num) {
        const n = parseInt(num);
        if (isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }
}

// Navigation System
class NavigationSystem {
    constructor() {
        this.navigationButton = null;
        this.themeSelector = null;
    }
    
    init() {
        this.setupNavigationButton();
        this.setupThemeSelector();
        this.updateNavigationBadge();
    }
    
    setupNavigationButton() {
        this.navigationButton = document.querySelector('.navigation-button');
        this.setupNavigationEventListeners();
    }
    
    setupNavigationEventListeners() {
        const navThemeToggle = document.getElementById('nav-theme-toggle');
        const navNotificationsBtn = document.getElementById('nav-notifications-btn');
        
        if (navThemeToggle) {
            navThemeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const themeSelector = document.getElementById('theme-selector');
                if (themeSelector) themeSelector.classList.toggle('active');
            });
        }
        
        if (navNotificationsBtn) {
            navNotificationsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationsPanel = document.getElementById('notifications-panel');
                if (notificationsPanel) {
                    notificationsPanel.classList.toggle('active');
                    if (notificationsPanel.classList.contains('active')) {
                        // Safety check for notificationSystem
                        if (typeof notificationSystem !== 'undefined' && notificationSystem && typeof notificationSystem.markAllAsRead === 'function') {
                            notificationSystem.markAllAsRead();
                        }
                    }
                }
            });
        }
        
        // Close theme selector when clicking outside
        document.addEventListener('click', (e) => {
            const themeSelector = document.getElementById('theme-selector');
            const navThemeToggle = document.getElementById('nav-theme-toggle');
            if (themeSelector && navThemeToggle && !navThemeToggle.contains(e.target) && !themeSelector.contains(e.target)) {
                themeSelector.classList.remove('active');
            }
        });
    }
    
    setupThemeSelector() {
        this.themeSelector = document.getElementById('theme-selector');
        this.setupThemeOptions();
    }
    
    setupThemeOptions() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = option.dataset.theme;
                this.setTheme(theme);
                if (this.themeSelector) this.themeSelector.classList.remove('active');
            });
        });
    }
    
    setTheme(theme) {
        document.body.className = `theme-${theme}`;
        localStorage.setItem('theme', theme);
        this.updateThemeSelector(theme);
    }
    
    updateThemeSelector(theme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
    }
    
    updateNavigationBadge() {
        const badge = document.getElementById('nav-notification-count');
        
        // SAFETY CHECK: Ensure notificationSystem exists before accessing unreadCount
        const unreadCount = typeof notificationSystem !== 'undefined' && notificationSystem 
            ? notificationSystem.unreadCount 
            : 0;
        
        if (badge) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }
}

// Theme System
class ThemeSystem {
    constructor() {
        this.currentTheme = 'dark';
    }
    
    init() {
        this.loadTheme();
        this.applyTheme();
        this.setupEventListeners();
    }
    
    loadTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.currentTheme = saved || (prefersDark ? 'dark' : 'light');
    }
    
    applyTheme() {
        document.body.className = `theme-${this.currentTheme}`;
        this.updateThemeSelector();
    }
    
    setupEventListeners() {
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
        
        // Keyboard shortcut: Alt+T
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const themes = ['dark', 'light', 'high-contrast'];
                const currentIndex = themes.indexOf(this.currentTheme);
                const nextIndex = (currentIndex + 1) % themes.length;
                this.setTheme(themes[nextIndex]);
            }
        });
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme();
    }
    
    updateThemeSelector() {
        document.querySelectorAll('.theme-option').forEach(option => {
            const isActive = option.dataset.theme === this.currentTheme;
            option.classList.toggle('active', isActive);
        });
    }
}

// Search Modal
class SearchModal {
    constructor() {
        this.modal = null;
        this.searchInput = null;
    }
    
    init() {
        this.modal = document.getElementById('search-modal');
        this.searchInput = document.getElementById('search-input');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const closeBtn = document.getElementById('close-search-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
                this.close();
            }
        });
        
        // Close modal on outside click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }
    }
    
    open() {
        if (!this.modal || !this.searchInput) return;
        this.modal.classList.add('active');
        // Delay focus for mobile compatibility
        setTimeout(() => {
            this.searchInput.focus();
        }, 350);
    }
    
    close() {
        if (!this.modal || !this.searchInput) return;
        this.modal.classList.remove('active');
        this.searchInput.value = '';
    }
}

// Analytics Modal
class AnalyticsModal {
    constructor() {
        this.modal = null;
    }
    
    init() {
        this.modal = document.getElementById('analytics-modal');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const closeBtn = document.getElementById('close-analytics');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }
    }
    
    open() {
        if (!this.modal) return;
        this.modal.classList.add('active');
        // Safety check for analyticsSystem
        if (typeof analyticsSystem !== 'undefined' && analyticsSystem && typeof analyticsSystem.updateAnalyticsDisplay === 'function') {
            analyticsSystem.updateAnalyticsDisplay();
        }
    }
    
    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }
}

// Development Window
class DevelopmentWindow {
    constructor() {
        this.card = null;
        this.pulseIcon = null;
        this.dismissed = false;
    }
    
    init() {
        this.card = document.getElementById('development-status-card');
        this.pulseIcon = document.getElementById('pulse-icon-container');
        
        this.checkDismissedState();
        this.setupEventListeners();
    }
    
    checkDismissedState() {
        const dismissedTime = localStorage.getItem('development_card_dismissed');
        if (dismissedTime) {
            const hoursSinceDismissal = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
            // Show again after 24 hours
            if (hoursSinceDismissal < 24) {
                this.dismissed = true;
                if (this.card) this.card.style.display = 'none';
                return;
            }
        }
        
        this.showCard();
    }
    
    showCard() {
        if (this.card) {
            this.card.style.display = 'block';
            // Add dismiss button if not present
            if (!this.card.querySelector('.dismiss-dev-btn')) {
                this.addDismissButton();
            }
        }
    }
    
    addDismissButton() {
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dismiss-dev-btn';
        dismissBtn.setAttribute('aria-label', 'Dismiss development message');
        dismissBtn.innerHTML = '<i class="fas fa-times"></i>';
        
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dismissCard();
        });
        
        this.card.style.position = 'relative';
        this.card.appendChild(dismissBtn);
        
        // Add CSS for dismiss button
        const style = document.createElement('style');
        style.textContent = `
            .dismiss-dev-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: var(--soft-white);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 10;
            }
            
            .dismiss-dev-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
        `;
        document.head.appendChild(style);
    }
    
    dismissCard() {
        if (this.card) this.card.style.display = 'none';
        this.dismissed = true;
        localStorage.setItem('development_card_dismissed', Date.now().toString());
    }
    
    redirectToPulse() {
        window.location.href = 'pulse-feed.html';
    }
    
    setupEventListeners() {
        if (this.pulseIcon) {
            this.pulseIcon.addEventListener('click', () => {
                this.redirectToPulse();
            });
        }
    }
}

// Initialize all UI components
function initializeUI() {
    console.log('🎨 Initializing Home Feed UI...');
    
    // Initialize all systems
    if (typeof contentCardSystem !== 'undefined') {
        contentCardSystem.init();
    }
    
    if (typeof navigationSystem !== 'undefined') {
        navigationSystem.init();
    }
    
    if (typeof themeSystem !== 'undefined') {
        themeSystem.init();
    }
    
    if (typeof searchModal !== 'undefined') {
        searchModal.init();
    }
    
    if (typeof analyticsModal !== 'undefined') {
        analyticsModal.init();
    }
    
    if (typeof developmentWindow !== 'undefined') {
        developmentWindow.init();
    }
    
    console.log('✅ Home Feed UI initialized');
}

// Export instances
const contentCardSystem = new ContentCardSystem();
const navigationSystem = new NavigationSystem();
const themeSystem = new ThemeSystem();
const searchModal = new SearchModal();
const analyticsModal = new AnalyticsModal();
const developmentWindow = new DevelopmentWindow();

// Export to window for global access
window.contentCardSystem = contentCardSystem;
window.navigationSystem = navigationSystem;
window.themeSystem = themeSystem;
window.searchModal = searchModal;
window.analyticsModal = analyticsModal;
window.developmentWindow = developmentWindow;

console.log('✅ Home Feed UI components created');

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
} else {
    initializeUI();
}
