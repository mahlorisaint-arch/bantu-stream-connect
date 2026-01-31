// Enhanced Supabase client with caching
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
    }
    
    async query(table, options = {}) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = 100,
            offset = 0
        } = options;
        
        // Generate cache key
        const cacheKey = this.generateCacheKey(table, options);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log('✅ Serving from cache:', cacheKey);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        
        // Build query URL
        let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;
        
        // Add filters
        Object.keys(where).forEach(key => {
            queryUrl += `&${key}=eq.${encodeURIComponent(where[key])}`;
        });
        
        // Add ordering
        if (orderBy) {
            queryUrl += `&order=${orderBy}.${order}`;
        }
        
        // Add limit and offset
        queryUrl += `&limit=${limit}&offset=${offset}`;
        
        try {
            const response = await fetch(queryUrl, {
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Store in cache
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            // Also store in localStorage for offline use
            try {
                localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.log('Could not cache in localStorage:', e);
            }
            
            return data;
        } catch (error) {
            console.error('Supabase query error:', error);
            
            // Try to get from localStorage cache
            try {
                const offlineCache = localStorage.getItem(`cache_${cacheKey}`);
                if (offlineCache) {
                    const parsed = JSON.parse(offlineCache);
                    if (Date.now() - parsed.timestamp < this.cacheTTL * 2) {
                        console.log('⚠️ Using offline cache:', cacheKey);
                        return parsed.data;
                    }
                }
            } catch (e) {
                console.log('Could not read from localStorage cache:', e);
            }
            
            throw error;
        }
    }
    
    generateCacheKey(table, options) {
        return `${table}_${JSON.stringify(options)}`;
    }
    
    clearCache() {
        this.cache.clear();
    }
    
    async preloadContent() {
        // Preload trending content
        try {
            await this.query('Content', {
                select: '*',
                where: { status: 'published' },
                orderBy: 'views',
                order: 'desc',
                limit: 10
            });
            console.log('✅ Preloaded trending content');
        } catch (error) {
            console.log('⚠️ Preloading failed, will load on demand');
        }
    }
}

// Initialize content Supabase client
const contentSupabase = new ContentSupabaseClient(
    'https://ydnxqnbjoshvxteevemc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
);

console.log('✅ Enhanced Supabase client initialized with caching');

// Supabase Configuration (same as login.html)
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Auth client initialized');

// Global variables
let allContentData = [];
let filteredContentData = [];
let selectedCategoryIndex = 0;

// Development Window Manager - UPDATED TO ALWAYS BE VISIBLE
const DevelopmentWindow = {
    init() {
        this.card = document.getElementById('development-status-card');
        this.pulseIcon = document.getElementById('pulse-icon-container');
        
        // Always show the card - no dismissal logic
        this.showCard();
        this.setupEventListeners();
    },
    
    showCard() {
        if (this.card) {
            this.card.style.display = 'block';
            // Add entrance animation
            setTimeout(() => {
                this.card.style.animation = 'cardEntrance 0.6s ease-out';
            }, 100);
        }
    },
    
    redirectToPulse() {
        // Redirect to pulse-feed.html
        window.location.href = 'pulse-feed.html';
    },
    
    setupEventListeners() {
        // Pulse icon click - redirect to pulse-feed.html
        if (this.pulseIcon) {
            this.pulseIcon.addEventListener('click', () => {
                this.redirectToPulse();
            });
        }
    }
};

// Add this new system for navigation button functionality
const NavigationButtonSystem = {
    init() {
        this.setupNavigationButton();
        this.updateNavigationBadge();
    },
    
    setupNavigationButton() {
        // Theme toggle from navigation button
        const navThemeToggle = document.getElementById('nav-theme-toggle');
        const themeSelector = document.getElementById('theme-selector');
        
        if (navThemeToggle) {
            navThemeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                themeSelector.classList.toggle('active');
            });
        }
        
        // Notifications from navigation button
        const navNotificationsBtn = document.getElementById('nav-notifications-btn');
        const notificationsPanel = document.getElementById('notifications-panel');
        
        if (navNotificationsBtn) {
            navNotificationsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationsPanel.classList.toggle('active');
                if (notificationsPanel.classList.contains('active')) {
                    NotificationSystem.markAllAsRead();
                }
            });
        }
    },
    
    updateNavigationBadge() {
        const badge = document.getElementById('nav-notification-count');
        const unreadCount = NotificationSystem.unreadCount;
        
        if (badge) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }
};

// Updated ThemeSystem to work with navigation button
const ThemeSystem = {
    currentTheme: 'dark',
    
    init() {
        this.loadTheme();
        this.applyTheme();
        this.setupEventListeners();
    },
    
    loadTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.currentTheme = saved || (prefersDark ? 'dark' : 'light');
    },
    
    saveTheme() {
        localStorage.setItem('theme', this.currentTheme);
    },
    
    applyTheme() {
        document.body.className = `theme-${this.currentTheme}`;
        
        // Update theme selector
        this.updateThemeSelector();
        
        // Track theme change
        AnalyticsSystem.trackEvent('theme_changed', { theme: this.currentTheme });
    },
    
    setTheme(theme) {
        this.currentTheme = theme;
        this.saveTheme();
        this.applyTheme();
    },
    
    setupEventListeners() {
        // Theme toggle from navigation button
        const navThemeToggle = document.getElementById('nav-theme-toggle');
        const themeSelector = document.getElementById('theme-selector');
        
        if (navThemeToggle) {
            navThemeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                themeSelector.classList.toggle('active');
            });
        }
        
        // Theme options
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = option.dataset.theme;
                this.setTheme(theme);
                themeSelector.classList.remove('active');
            });
        });
        
        // Close theme selector when clicking outside
        document.addEventListener('click', (e) => {
            if (!navThemeToggle?.contains(e.target) && !themeSelector?.contains(e.target)) {
                themeSelector?.classList.remove('active');
            }
        });
        
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
    },
    
    updateThemeSelector() {
        document.querySelectorAll('.theme-option').forEach(option => {
            const isActive = option.dataset.theme === this.currentTheme;
            option.classList.toggle('active', isActive);
        });
    }
};

// 1. REAL-TIME NOTIFICATIONS SYSTEM - UPDATED to update navigation badge
const NotificationSystem = {
    notifications: [],
    unreadCount: 0,
    realtimeChannel: null,
    
    async init() {
        await this.loadNotifications();
        this.setupRealtime();
        this.renderNotifications();
        this.setupEventListeners();
        this.updateBadge();
        NavigationButtonSystem.updateNavigationBadge(); // Update navigation badge too
    },
    
    async loadNotifications() {
        try {
            // Load from localStorage
            const saved = localStorage.getItem('notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.unreadCount = this.notifications.filter(n => !n.read).length;
            }
            
            // Fetch new notifications from server
            await this.fetchNewNotifications();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },
    
    async fetchNewNotifications() {
        // Simulated notifications for demo
        const mockNotifications = [
            {
                id: 1,
                type: 'new_content',
                title: 'New Content Available',
                message: '5 new videos uploaded in your favorite categories',
                timestamp: Date.now() - 3600000,
                read: false,
                icon: 'fas fa-video'
            },
            {
                id: 2,
                type: 'trending',
                title: 'Content is Trending',
                message: 'Your video "African Sunrise" is trending now!',
                timestamp: Date.now() - 7200000,
                read: false,
                icon: 'fas fa-fire'
            },
            {
                id: 3,
                type: 'creator',
                title: 'New Creator Alert',
                message: 'Tech Africa just started following you',
                timestamp: Date.now() - 10800000,
                read: true,
                icon: 'fas fa-user-plus'
            }
        ];
        
        // Add new notifications
        mockNotifications.forEach(notification => {
            if (!this.notifications.find(n => n.id === notification.id)) {
                this.notifications.unshift(notification);
            }
        });
        
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    },
    
    setupRealtime() {
        // Simulate real-time updates
        setInterval(() => {
            this.simulateRealtimeUpdate();
        }, 30000); // Every 30 seconds
    },
    
    simulateRealtimeUpdate() {
        if (Math.random() > 0.7) { // 30% chance of new notification
            const newNotification = {
                id: Date.now(),
                type: 'realtime',
                title: 'Live Update',
                message: 'New content trending right now!',
                timestamp: Date.now(),
                read: false,
                icon: 'fas fa-bolt'
            };
            
            this.addNotification(newNotification);
            
            // Show desktop notification if permitted
            if (Notification.permission === 'granted') {
                new Notification(newNotification.title, {
                    body: newNotification.message,
                    icon: '/icon.png'
                });
            }
        }
    },
    
    addNotification(notification) {
        this.notifications.unshift(notification);
        if (!notification.read) {
            this.unreadCount++;
        }
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    },
    
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount--;
            this.saveNotifications();
            this.renderNotifications();
            this.updateBadge();
        }
    },
    
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    },
    
    updateBadge() {
        const badge = document.getElementById('notification-count');
        const navBadge = document.getElementById('nav-notification-count');
        
        if (badge) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
        
        if (navBadge) {
            navBadge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            navBadge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    },
    
    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    },
    
    renderNotifications() {
        const container = document.getElementById('notifications-list');
        if (!container) return;
        
        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="${notification.icon}"></i>
                </div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.message}</p>
                    <span class="notification-time">${this.formatTime(notification.timestamp)}</span>
                </div>
                ${!notification.read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = parseInt(item.dataset.id);
                this.markAsRead(id);
            });
        });
    },
    
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    },
    
    setupEventListeners() {
        // Notifications button
        const notificationsBtn = document.getElementById('notifications-btn');
        const notificationsPanel = document.getElementById('notifications-panel');
        const closeNotifications = document.getElementById('close-notifications');
        const markAllRead = document.getElementById('mark-all-read');
        
        if (notificationsBtn && notificationsPanel) {
            notificationsBtn.addEventListener('click', () => {
                notificationsPanel.classList.toggle('active');
                if (notificationsPanel.classList.contains('active')) {
                    this.markAllAsRead();
                }
            });
        }
        
        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationsPanel.classList.remove('active');
            });
        }
        
        if (markAllRead) {
            markAllRead.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            const notificationsPanel = document.getElementById('notifications-panel');
            const notificationsBtn = document.getElementById('notifications-btn');
            
            if (notificationsPanel && notificationsBtn &&
                !notificationsPanel.contains(e.target) && 
                !notificationsBtn.contains(e.target) &&
                notificationsPanel.classList.contains('active')) {
                notificationsPanel.classList.remove('active');
            }
        });
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                Notification.requestPermission();
            }, 3000);
        }
    }
};

// 2. ADVANCED ANALYTICS SYSTEM
const AnalyticsSystem = {
    userId: null,
    sessionId: null,
    sessionStart: null,
    watchTime: 0,
    sessions: [],
    chart: null,
    
    init() {
        this.userId = localStorage.getItem('analytics_user_id') || this.generateId();
        this.sessionId = this.generateId();
        this.sessionStart = Date.now();
        
        localStorage.setItem('analytics_user_id', this.userId);
        
        this.trackSessionStart();
        this.setupEventTracking();
        this.updateAnalyticsDisplay();
        this.setupAnalyticsChart();
        this.setupEventListeners();
    },
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },
    
    trackSessionStart() {
        // Load previous sessions
        const previousSessions = JSON.parse(localStorage.getItem('user_sessions') || '[]');
        this.sessions = previousSessions;
        
        // Add current session
        this.sessions.push({
            id: this.sessionId,
            startTime: this.sessionStart,
            endTime: null,
            duration: null
        });
        
        // Keep only last 30 sessions
        if (this.sessions.length > 30) {
            this.sessions = this.sessions.slice(-30);
        }
        
        localStorage.setItem('user_sessions', JSON.stringify(this.sessions));
        
        // Track return rate
        const isReturnUser = previousSessions.length > 0;
        this.trackEvent('session_start', { return_user: isReturnUser });
    },
    
    trackEvent(event, properties = {}) {
        const eventData = {
            event,
            properties: {
                ...properties,
                userId: this.userId,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                page: window.location.pathname
            }
        };
        
        // Store event locally
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push(eventData);
        if (events.length > 1000) events.shift();
        localStorage.setItem('analytics_events', JSON.stringify(events));
        
        console.log(`📊 Tracked: ${event}`, eventData.properties);
    },
    
    trackWatchTime(duration) {
        this.watchTime += duration;
        this.trackEvent('watch_time', { duration, total_watch_time: this.watchTime });
        this.updateAnalyticsDisplay();
    },
    
    trackContentInteraction(contentId, type, details = {}) {
        this.trackEvent('content_interaction', {
            content_id: contentId,
            interaction_type: type,
            ...details
        });
    },
    
    updateAnalyticsDisplay() {
        // Update watch time
        const hours = Math.floor(this.watchTime / 3600000);
        const minutes = Math.floor((this.watchTime % 3600000) / 60000);
        document.getElementById('total-watch-time').textContent = `${hours}h ${minutes}m`;
        
        // Update sessions per user
        const totalSessions = this.sessions.length;
        document.getElementById('sessions-per-user').textContent = totalSessions;
        
        // Update return rate
        const uniqueSessions = [...new Set(this.sessions.map(s => s.id))].length;
        const returnRate = totalSessions > 1 ? Math.round(((totalSessions - 1) / totalSessions) * 100) : 0;
        document.getElementById('return-rate').textContent = `${returnRate}%`;
        
        // Update total views
        const totalViews = parseInt(localStorage.getItem('total_views') || '0');
        document.getElementById('total-views').textContent = totalViews.toLocaleString();
        
        // Update trends (simulated)
        document.getElementById('watch-time-trend').textContent = '+12%';
        document.getElementById('sessions-trend').textContent = '+5%';
        document.getElementById('return-rate-trend').textContent = '+3%';
        document.getElementById('views-trend').textContent = '+8%';
    },
    
    setupAnalyticsChart() {
        const ctx = document.getElementById('engagement-chart');
        if (!ctx) return;
        
        // Sample data for chart
        const data = {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                {
                    label: 'Watch Time (hours)',
                    data: [2.5, 3.2, 4.1, 3.8, 4.5, 5.2, 4.8],
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Sessions',
                    data: [12, 15, 18, 14, 20, 22, 19],
                    borderColor: '#1D4ED8',
                    backgroundColor: 'rgba(29, 78, 216, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: data,
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
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--slate-grey)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--slate-grey)'
                        }
                    }
                }
            }
        });
    },
    
    setupEventTracking() {
        // Track content views
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.content-card');
            if (card) {
                const contentId = card.dataset.contentId;
                if (contentId) {
                    this.trackContentInteraction(contentId, 'view');
                    
                    // Increment view count
                    let totalViews = parseInt(localStorage.getItem('total_views') || '0');
                    totalViews++;
                    localStorage.setItem('total_views', totalViews.toString());
                    this.updateAnalyticsDisplay();
                }
            }
        });
        
        // Track video plays
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                const video = e.target;
                const contentId = video.closest('.content-card')?.dataset.contentId;
                if (contentId) {
                    this.trackContentInteraction(contentId, 'video_play');
                    
                    // Start tracking watch time
                    const startTime = Date.now();
                    video.addEventListener('pause', () => {
                        const duration = Date.now() - startTime;
                        this.trackWatchTime(duration);
                    });
                    
                    video.addEventListener('ended', () => {
                        const duration = Date.now() - startTime;
                        this.trackWatchTime(duration);
                    });
                }
            }
        }, true);
        
        // Track search
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('search', (e) => {
                this.trackEvent('search', { query: e.target.value });
            });
        }
        
        // Track page load performance
        window.addEventListener('load', () => {
            const loadTime = Date.now() - this.sessionStart;
            this.trackEvent('page_load', { load_time: loadTime });
        });
    },
    
    setupEventListeners() {
        const analyticsBtn = document.getElementById('analytics-btn');
        const analyticsModal = document.getElementById('analytics-modal');
        const closeAnalytics = document.getElementById('close-analytics');
        
        if (analyticsBtn && analyticsModal) {
            analyticsBtn.addEventListener('click', () => {
                analyticsModal.classList.add('active');
                this.updateAnalyticsDisplay();
            });
        }
        
        if (closeAnalytics) {
            closeAnalytics.addEventListener('click', () => {
                analyticsModal.classList.remove('active');
            });
        }
        
        // Close modal on outside click
        analyticsModal?.addEventListener('click', (e) => {
            if (e.target === analyticsModal) {
                analyticsModal.classList.remove('active');
            }
        });
    }
};

// 4. ACCESSIBILITY ENHANCEMENTS
const AccessibilitySystem = {
    init() {
        this.setupSkipLink();
        this.setupFocusManagement();
        this.setupKeyboardNavigation();
        this.setupAriaLabels();
        this.setupReducedMotion();
    },
    
    setupSkipLink() {
        const skipLink = document.getElementById('skip-link');
        if (skipLink) {
            skipLink.addEventListener('click', (e) => {
                e.preventDefault();
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.tabIndex = -1;
                    mainContent.focus();
                    setTimeout(() => {
                        mainContent.removeAttribute('tabindex');
                    }, 1000);
                }
            });
        }
    },
    
    setupFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabKey(e);
            }
        });
    },
    
    handleTabKey(e) {
        const modal = document.querySelector('.search-modal.active, .analytics-modal.active, .notifications-panel.active');
        if (!modal) return;
        
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    },
    
    setupKeyboardNavigation() {
        // Enhanced keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger if user is typing
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            // Alt+N for notifications
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('notifications-btn')?.click();
            }
            
            // Alt+A for analytics
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                document.getElementById('analytics-btn')?.click();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    },
    
    closeAllModals() {
        document.querySelectorAll('.search-modal.active, .analytics-modal.active, .notifications-panel.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('theme-selector')?.classList.remove('active');
    },
    
    setupAriaLabels() {
        // Ensure all interactive elements have proper labels
        document.querySelectorAll('button:not([aria-label]), a:not([aria-label])').forEach(element => {
            const text = element.textContent.trim();
            if (text && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', text);
            }
        });
    },
    
    setupReducedMotion() {
        // Check user's motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            // Disable all animations
            const style = document.createElement('style');
            style.textContent = `
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
};

// 5. ADVANCED CACHING STRATEGIES
const CachingSystem = {
    cacheName: 'bantu-stream-connect-v1',
    
    init() {
        this.setupServiceWorker();
        this.setupCacheMonitoring();
        this.precacheCriticalAssets();
    },
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Don't register service worker for now to avoid MIME type error
                // const registration = await navigator.serviceWorker.register('/sw.js');
                // console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.log('ServiceWorker registration skipped:', error);
            }
        }
    },
    
    setupCacheMonitoring() {
        // Update cache status
        this.updateCacheStatus('ready');
        
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.updateCacheStatus('online');
            showToast('Back online', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.updateCacheStatus('offline');
            showToast('You are offline. Using cached content.', 'warning');
        });
    },
    
    updateCacheStatus(status) {
        const statusElement = document.getElementById('cache-status-text');
        if (statusElement) {
            statusElement.textContent = `Cache: ${status}`;
        }
    },
    
    precacheCriticalAssets() {
        // Preload critical images
        const criticalImages = [
            'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'
        ];
        
        criticalImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    },
    
    async cacheContent(content) {
        try {
            // Cache content in localStorage
            localStorage.setItem('cached_content', JSON.stringify(content));
            localStorage.setItem('cached_content_timestamp', Date.now().toString());
            
            // Cache thumbnails
            await this.cacheThumbnails(content);
        } catch (error) {
            console.error('Failed to cache content:', error);
        }
    },
    
    async cacheThumbnails(content) {
        // Cache thumbnails using Cache API if available
        if ('caches' in window) {
            try {
                const cache = await caches.open('thumbnails');
                const thumbnailUrls = content.map(item => item.thumbnail_url).filter(url => url);
                
                await Promise.all(
                    thumbnailUrls.map(url => 
                        cache.add(url).catch(e => console.log('Failed to cache thumbnail:', url))
                    )
                );
            } catch (error) {
                console.error('Failed to cache thumbnails:', error);
            }
        }
    },
    
    getCachedContent() {
        try {
            const cached = localStorage.getItem('cached_content');
            const timestamp = localStorage.getItem('cached_content_timestamp');
            
            if (cached && timestamp) {
                const age = Date.now() - parseInt(timestamp);
                // Use cache if less than 1 hour old
                if (age < 60 * 60 * 1000) {
                    return JSON.parse(cached);
                }
            }
        } catch (error) {
            console.error('Failed to get cached content:', error);
        }
        return null;
    }
};

// 6. ERROR RECOVERY SYSTEM
const ErrorRecoverySystem = {
    errors: [],
    
    init() {
        this.setupErrorHandling();
        this.setupNetworkMonitoring();
        this.setupEventListeners();
    },
    
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleError(event.error || event);
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason);
        });
        
        // Fetch errors
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                return await originalFetch(...args);
            } catch (error) {
                this.handleError(error);
                throw error;
            }
        };
    },
    
    handleError(error) {
        const errorData = {
            type: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            url: window.location.href
        };
        
        this.errors.push(errorData);
        this.logError(errorData);
        
        // Show error to user if it's critical
        if (this.isCriticalError(error)) {
            this.showErrorModal(error);
        }
        
        // Track error in analytics
        AnalyticsSystem.trackEvent('error', errorData);
    },
    
    isCriticalError(error) {
        const criticalErrors = [
            'NetworkError',
            'TypeError',
            'SyntaxError',
            'ReferenceError'
        ];
        return criticalErrors.includes(error.name) || 
               error.message.includes('network') ||
               error.message.includes('connection');
    },
    
    showErrorModal(error) {
        const modal = document.getElementById('error-recovery-modal');
        if (!modal) return;
        
        const message = document.getElementById('error-recovery-message');
        if (message) {
            message.textContent = this.getUserFriendlyMessage(error);
        }
        
        modal.style.display = 'flex';
    },
    
    getUserFriendlyMessage(error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
            return 'We\'re having trouble connecting to the server. You can continue using cached content.';
        }
        if (error.message.includes('fetch')) {
            return 'Unable to load content. Please check your connection.';
        }
        return 'Something went wrong. Please try again.';
    },
    
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            showToast('Connection restored', 'success');
        });
        
        window.addEventListener('offline', () => {
            showToast('You are offline. Using cached content.', 'warning');
        });
    },
    
    setupEventListeners() {
        const retryBtn = document.getElementById('retry-connection');
        const continueBtn = document.getElementById('continue-offline');
        const reportBtn = document.getElementById('report-issue');
        const errorModal = document.getElementById('error-recovery-modal');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                errorModal.style.display = 'none';
                // Load cached content
                const cachedContent = CachingSystem.getCachedContent();
                if (cachedContent) {
                    allContentData = cachedContent;
                    filteredContentData = cachedContent;
                    renderContentSections();
                }
            });
        }
        
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                // In a real app, this would send error report to server
                showToast('Issue reported. Thank you!', 'success');
                errorModal.style.display = 'none';
            });
        }
        
        // Close modal on outside click
        errorModal?.addEventListener('click', (e) => {
            if (e.target === errorModal) {
                errorModal.style.display = 'none';
            }
        });
    },
    
    logError(error) {
        console.error('❌ Error:', error);
        
        // Store errors in localStorage (limited to last 50)
        const stored = JSON.parse(localStorage.getItem('error_log') || '[]');
        stored.push(error);
        if (stored.length > 50) stored.shift();
        localStorage.setItem('error_log', JSON.stringify(stored));
    }
};

// 7. PERFORMANCE MONITORING
const PerformanceMonitor = {
    metrics: {
        fcp: 0,
        lcp: 0,
        cls: 0
    },
    
    init() {
        this.setupObservers();
        this.setupEventListeners();
        this.reportMetrics();
    },
    
    setupObservers() {
        // FCP Observer
        if ('PerformanceObserver' in window) {
            try {
                const fcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.fcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('fcp', this.metrics.fcp);
                    }
                });
                fcpObserver.observe({ entryTypes: ['paint'] });
            } catch (e) {}
            
            // LCP Observer
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.lcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('lcp', this.metrics.lcp);
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {}
            
            // CLS Observer
            try {
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        this.metrics.cls += entry.value;
                    }
                    this.updateMetricDisplay('cls', this.metrics.cls);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {}
        }
    },
    
    updateMetricDisplay(metric, value) {
        const element = document.getElementById(`${metric}-metric`);
        if (element) {
            if (metric === 'cls') {
                element.textContent = value.toFixed(3);
            } else {
                element.textContent = `${(value / 1000).toFixed(2)}s`;
            }
        }
    },
    
    reportMetrics() {
        // Report after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.checkPerformanceTargets();
                AnalyticsSystem.trackEvent('performance_metrics', this.metrics);
            }, 1000);
        });
    },
    
    checkPerformanceTargets() {
        // FCP < 1.5s
        if (this.metrics.fcp > 1500) {
            console.warn(`⚠️ FCP ${this.metrics.fcp}ms exceeds target 1500ms`);
        }
        
        // LCP < 2.5s
        if (this.metrics.lcp > 2500) {
            console.warn(`⚠️ LCP ${this.metrics.lcp}ms exceeds target 2500ms`);
        }
        
        // CLS < 0.1
        if (this.metrics.cls > 0.1) {
            console.warn(`⚠️ CLS ${this.metrics.cls} exceeds target 0.1`);
        }
    },
    
    setupEventListeners() {
        const toggleBtn = document.getElementById('toggle-performance');
        const metricsDisplay = document.getElementById('performance-metrics');
        
        if (toggleBtn && metricsDisplay) {
            toggleBtn.addEventListener('click', () => {
                metricsDisplay.classList.toggle('active');
            });
        }
    }
};

// 8. ENGAGEMENT TRACKING
const EngagementTracker = {
    init() {
        this.setupEngagementTracking();
        this.setupSessionTracking();
    },
    
    setupEngagementTracking() {
        // Track time spent on page
        let startTime = Date.now();
        
        window.addEventListener('beforeunload', () => {
            const timeSpent = Date.now() - startTime;
            AnalyticsSystem.trackEvent('page_engagement', {
                time_spent: timeSpent,
                scroll_depth: this.getScrollDepth()
            });
        });
        
        // Track scroll depth
        let maxScrollDepth = 0;
        window.addEventListener('scroll', () => {
            const scrollDepth = this.getScrollDepth();
            if (scrollDepth > maxScrollDepth) {
                maxScrollDepth = scrollDepth;
            }
        });
    },
    
    getScrollDepth() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        
        if (scrollHeight === clientHeight) return 0;
        return (scrollTop / (scrollHeight - clientHeight)) * 100;
    },
    
    setupSessionTracking() {
        // Track session duration
        setInterval(() => {
            const sessionDuration = Date.now() - AnalyticsSystem.sessionStart;
            if (sessionDuration > 300000) { // 5 minutes
                AnalyticsSystem.trackEvent('session_heartbeat', {
                    duration: sessionDuration
                });
            }
        }, 60000); // Every minute
    }
};

// 9. TRENDING NOW REAL-TIME SECTION
const TrendingSystem = {
    trendingContent: [],
    updateInterval: 30000, // 30 seconds
    
    init() {
        this.loadTrendingContent();
        this.startAutoRefresh();
    },
    
    async loadTrendingContent() {
        try {
            // Get content from last 24 hours
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            const content = await contentSupabase.query('Content', {
                select: '*',
                where: { 
                    status: 'published',
                    created_at: `gte.${oneDayAgo.toISOString()}`
                },
                orderBy: 'views',
                order: 'desc',
                limit: 10
            });
            
            // Calculate trending score
            this.trendingContent = content.map(item => ({
                ...item,
                trendingScore: this.calculateTrendingScore(item)
            })).sort((a, b) => b.trendingScore - a.trendingScore);
            
            this.updateTrendingSection();
            
        } catch (error) {
            console.error('Failed to load trending content:', error);
        }
    },
    
    calculateTrendingScore(item) {
        // Base score from views and likes
        let score = (item.views || 0) + ((item.likes || 0) * 2);
        
        // Recency boost
        const created = new Date(item.created_at);
        const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 1) score *= 1.5;
        if (hoursAgo < 0.25) score *= 2;
        
        return Math.round(score);
    },
    
    updateTrendingSection() {
        const trendingSection = document.querySelector('.section[data-type="trending"]');
        if (!trendingSection) return;
        
        const grid = trendingSection.querySelector('.content-grid');
        if (!grid) return;
        
        // Take top 5 trending items
        const topTrending = this.trendingContent.slice(0, 5);
        
        grid.innerHTML = topTrending.map(item => this.createTrendingCard(item)).join('');
        
        // Setup event listeners
        this.setupTrendingCardListeners(grid);
    },
    
    createTrendingCard(item) {
        return `
            <div class="content-card trending-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="trending-badge">🔥 Trending</div>
                    <div class="video-preview-container">
                        <video class="video-preview" muted preload="metadata">
                            <source src="${item.file_url || ''}" type="video/mp4">
                        </video>
                    </div>
                    <button class="share-btn" title="Share" data-content-id="${item.id}">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${this.formatNumber(item.views || 0)}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${this.formatNumber(item.likes || 0)}
                        </span>
                        <span class="stat">
                            <i class="fas fa-fire"></i> ${this.formatNumber(item.trendingScore)}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id}"
                            data-creator-name="${item.creator}">
                        <i class="fas fa-user"></i>
                        ${item.creator.length > 15 ? item.creator.substring(0, 15) + '...' : item.creator}
                    </button>
                </div>
            </div>
        `;
    },
    
    setupTrendingCardListeners(grid) {
        grid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.share-btn') || e.target.closest('.creator-btn')) {
                    return;
                }
                
                const contentId = card.dataset.contentId;
                if (contentId) {
                    window.location.href = `content-detail.html?id=${contentId}`;
                }
            });
        });
    },
    
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },
    
    startAutoRefresh() {
        // Refresh trending content every 5 minutes
        setInterval(() => {
            this.loadTrendingContent();
        }, 5 * 60 * 1000);
        
        // Real-time updates every 30 seconds
        setInterval(() => {
            this.simulateRealTimeUpdate();
        }, 30000);
    },
    
    simulateRealTimeUpdate() {
        // Randomly update trending scores for demo
        this.trendingContent = this.trendingContent.map(item => ({
            ...item,
            trendingScore: item.trendingScore + Math.floor(Math.random() * 10),
            views: item.views + Math.floor(Math.random() * 5)
        })).sort((a, b) => b.trendingScore - a.trendingScore);
        
        this.updateTrendingSection();
    }
};

// 10. VIDEO PREVIEW ON HOVER - IMPROVED FOR MOBILE
const VideoPreviewSystem = {
    hoverTimeout: null,
    currentPreview: null,
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchMoved: false,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    
    init() {
        this.setupEventDelegation();
    },
    
    setupEventDelegation() {
        // Mouse events for desktop
        if (!this.isMobile) {
            document.addEventListener('mouseover', (e) => {
                const card = e.target.closest('.content-card');
                if (card && !card.classList.contains('video-hover')) {
                    this.handleCardHover(card);
                }
            });
            
            document.addEventListener('mouseout', (e) => {
                const card = e.target.closest('.content-card');
                if (card && card.classList.contains('video-hover')) {
                    this.handleCardLeave(card);
                }
            });
        }
        
        // Touch events for mobile - improved
        document.addEventListener('touchstart', (e) => {
            this.touchStartTime = Date.now();
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.touchMoved = false;
            
            const card = e.target.closest('.content-card');
            if (card) {
                // Don't prevent default on search results or other interactive elements
                if (!e.target.closest('.share-btn') && 
                    !e.target.closest('.creator-btn') &&
                    !e.target.closest('input') &&
                    !e.target.closest('button') &&
                    !e.target.closest('a')) {
                    
                    e.preventDefault();
                    this.handleCardHover(card);
                }
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const deltaX = Math.abs(touchX - this.touchStartX);
                const deltaY = Math.abs(touchY - this.touchStartY);
                
                // If user moved significantly, cancel the hover
                if (deltaX > 10 || deltaY > 10) {
                    this.touchMoved = true;
                    this.handleCardLeaveAll();
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - this.touchStartTime;
            
            // If touch was short and didn't move, treat as click
            if (touchDuration < 300 && !this.touchMoved) {
                const card = e.target.closest('.content-card');
                if (card && card.classList.contains('video-hover')) {
                    this.handleCardLeave(card);
                    
                    // Allow click to proceed naturally
                    setTimeout(() => {
                        const contentId = card.dataset.contentId;
                        if (contentId) {
                            window.location.href = `content-detail.html?id=${contentId}`;
                        }
                    }, 50);
                }
            } else {
                this.handleCardLeaveAll();
            }
            
            this.touchMoved = false;
        }, { passive: true });
        
        // Prevent video preview on scroll
        let isScrolling;
        window.addEventListener('scroll', () => {
            clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                this.handleCardLeaveAll();
            }, 100);
        }, false);
    },
    
    handleCardHover(card) {
        clearTimeout(this.hoverTimeout);
        
        this.hoverTimeout = setTimeout(() => {
            const videoElement = card.querySelector('.video-preview');
            if (videoElement && videoElement.src) {
                card.classList.add('video-hover');
                this.currentPreview = videoElement;
                
                // Play video preview
                videoElement.currentTime = 0;
                const playPromise = videoElement.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.log('Video autoplay prevented:', e);
                        card.classList.remove('video-hover');
                    });
                }
                
                // Track preview view
                const contentId = card.dataset.contentId;
                if (contentId) {
                    AnalyticsSystem.trackContentInteraction(contentId, 'video_preview');
                }
            }
        }, this.isMobile ? 100 : 500); // Faster on mobile
    },
    
    handleCardLeave(card) {
        clearTimeout(this.hoverTimeout);
        
        const videoElement = card.querySelector('.video-preview');
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
        
        card.classList.remove('video-hover');
        this.currentPreview = null;
    },
    
    handleCardLeaveAll() {
        clearTimeout(this.hoverTimeout);
        
        document.querySelectorAll('.content-card.video-hover').forEach(card => {
            const videoElement = card.querySelector('.video-preview');
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
            card.classList.remove('video-hover');
        });
        
        this.currentPreview = null;
    }
};

// 11. CONTINUE WATCHING SYSTEM
const ContinueWatchingSystem = {
    watchHistory: {},
    
    init() {
        this.loadWatchHistory();
        this.setupProgressTracking();
    },
    
    loadWatchHistory() {
        try {
            const history = localStorage.getItem('watch_history');
            if (history) {
                this.watchHistory = JSON.parse(history);
            }
        } catch (error) {
            console.error('Error loading watch history:', error);
            this.watchHistory = {};
        }
    },
    
    saveWatchHistory() {
        try {
            localStorage.setItem('watch_history', JSON.stringify(this.watchHistory));
        } catch (error) {
            console.error('Error saving watch history:', error);
        }
    },
    
    updateWatchProgress(contentId, progress) {
        this.watchHistory[contentId] = {
            progress: progress,
            lastWatched: Date.now()
        };
        this.saveWatchHistory();
        
        // Update local storage for progress bars
        localStorage.setItem(`watch_progress_${contentId}`, progress.toString());
        
        // Update UI
        this.updateContinueWatchingSection();
    },
    
    getContinueWatchingContent(allContent) {
        const continueWatching = [];
        
        for (const [contentId, data] of Object.entries(this.watchHistory)) {
            if (data.progress > 0 && data.progress < 90) {
                const content = allContent.find(c => c.id == contentId);
                if (content) {
                    continueWatching.push({
                        ...content,
                        watchProgress: data.progress,
                        lastWatched: data.lastWatched
                    });
                }
            }
        }
        
        // Sort by most recently watched
        return continueWatching.sort((a, b) => b.lastWatched - a.lastWatched);
    },
    
    setupProgressTracking() {
        // Listen for video play events
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                const video = e.target;
                const contentId = video.closest('.content-card')?.dataset.contentId;
                
                if (contentId) {
                    // Start tracking progress
                    video.addEventListener('timeupdate', () => {
                        if (video.duration) {
                            const progress = (video.currentTime / video.duration) * 100;
                            this.updateWatchProgress(contentId, progress);
                        }
                    });
                }
            }
        }, true);
    },
    
    updateContinueWatchingSection() {
        const continueWatching = this.getContinueWatchingContent(allContentData);
        
        // Find or create continue watching section
        let continueWatchingSection = document.querySelector('.section[data-type="continue-watching"]');
        
        if (continueWatching.length > 0) {
            if (!continueWatchingSection) {
                continueWatchingSection = this.createContinueWatchingSection();
            }
            
            // Update continue watching grid
            const grid = continueWatchingSection.querySelector('.content-grid');
            if (grid) {
                grid.innerHTML = continueWatching.slice(0, 5).map(item => this.createContinueWatchingCard(item)).join('');
                this.setupContinueWatchingCardListeners(grid);
            }
        } else if (continueWatchingSection) {
            continueWatchingSection.remove();
        }
    },
    
    createContinueWatchingSection() {
        const sectionHTML = `
            <section class="section" data-type="continue-watching">
                <div class="section-header">
                    <h2 class="section-title">Continue Watching</h2>
                    <button class="see-all-btn" data-action="see-all" data-target="continue-watching">See All</button>
                </div>
                <div class="content-grid">
                    <!-- Continue watching will be loaded here -->
                </div>
            </section>
        `;
        
        const contentSections = document.getElementById('content-sections');
        if (contentSections) {
            contentSections.insertAdjacentHTML('afterbegin', sectionHTML);
        }
        
        return document.querySelector('.section[data-type="continue-watching"]');
    },
    
    createContinueWatchingCard(item) {
        return `
            <div class="content-card" data-content-id="${item.id}">
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
                    <div class="continue-watching-badge">
                        <i class="fas fa-play-circle"></i>
                        Continue
                    </div>
                    <div class="continue-watching-progress">
                        <div class="continue-watching-progress-fill" style="width: ${item.watchProgress}%"></div>
                    </div>
                    <button class="share-btn" title="Share" data-content-id="${item.id}">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${item.views || 0}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id}"
                            data-creator-name="${item.creator}">
                        <i class="fas fa-user"></i>
                        ${item.creator.length > 15 ? item.creator.substring(0, 15) + '...' : item.creator}
                    </button>
                </div>
            </div>
        `;
    },
    
    setupContinueWatchingCardListeners(grid) {
        grid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.share-btn') || e.target.closest('.creator-btn')) {
                    return;
                }
                
                const contentId = card.dataset.contentId;
                if (contentId) {
                    localStorage.setItem('continue_watching_id', contentId);
                    window.location.href = `content-detail.html?id=${contentId}`;
                }
            });
        });
    },
    
    getWatchProgress(contentId) {
        const entry = this.watchHistory[contentId];
        return entry ? entry.progress : 0;
    }
};

// 12. LIKES AND VIEWS DISPLAY SYSTEM
const ContentStatsSystem = {
    init() {
        this.setupStatsDisplay();
        this.setupStatsTracking();
    },
    
    setupStatsDisplay() {
        // Update all existing cards with stats
        document.querySelectorAll('.content-card').forEach(card => {
            this.addStatsToCard(card);
        });
        
        // Observe for new cards
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList?.contains('.content-card')) {
                        this.addStatsToCard(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    
    addStatsToCard(card) {
        if (card.classList.contains('stats-added')) return;
        
        const contentId = card.dataset.contentId;
        if (!contentId) return;
        
        // Get stats from data attributes
        const views = card.dataset.views || 0;
        const likes = card.dataset.likes || 0;
        
        // Create stats element
        const statsElement = document.createElement('div');
        statsElement.className = 'card-stats';
        statsElement.innerHTML = `
            <span class="stat" title="Views">
                <i class="fas fa-eye"></i> ${this.formatNumber(views)}
            </span>
            <span class="stat" title="Likes">
                <i class="fas fa-heart"></i> ${this.formatNumber(likes)}
            </span>
        `;
        
        // Insert before creator button
        const creatorBtn = card.querySelector('.creator-btn');
        if (creatorBtn) {
            card.querySelector('.card-content').insertBefore(statsElement, creatorBtn);
        }
        
        card.classList.add('stats-added');
    },
    
    setupStatsTracking() {
        // Track when cards come into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const card = entry.target;
                    const contentId = card.dataset.contentId;
                    
                    if (contentId && !card.dataset.viewTracked) {
                        this.trackView(contentId, card);
                        card.dataset.viewTracked = 'true';
                    }
                }
            });
        }, { threshold: 0.5 });
        
        // Observe all content cards
        document.querySelectorAll('.content-card').forEach(card => {
            observer.observe(card);
        });
    },
    
    trackView(contentId, card) {
        // Increment view count locally
        let views = parseInt(card.dataset.views || '0');
        views++;
        card.dataset.views = views.toString();
        
        // Update stats display
        const statsElement = card.querySelector('.card-stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <span class="stat" title="Views">
                    <i class="fas fa-eye"></i> ${this.formatNumber(views)}
                </span>
                <span class="stat" title="Likes">
                    <i class="fas fa-heart"></i> ${this.formatNumber(card.dataset.likes || 0)}
                </span>
            `;
        }
        
        // Track in analytics
        AnalyticsSystem.trackContentInteraction(contentId, 'view');
    },
    
    formatNumber(num) {
        const n = parseInt(num);
        if (isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }
};

// Search System
const SearchSystem = {
    modal: null,
    searchInput: null,
    resultsGrid: null,
    currentResults: [],
    searchTimeout: null,
    
    init() {
        this.modal = document.getElementById('search-modal');
        this.searchInput = document.getElementById('search-input');
        this.resultsGrid = document.getElementById('search-results-grid');
        
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // Search input event
        this.searchInput?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        // Filter changes
        document.getElementById('category-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        document.getElementById('media-type-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        // Close search modal
        document.getElementById('close-search-btn')?.addEventListener('click', () => {
            this.closeSearch();
        });
    },
    
    openSearch() {
        this.modal?.classList.add('active');
        this.searchInput?.focus();
    },
    
    closeSearch() {
        this.modal?.classList.remove('active');
        this.searchInput.value = '';
        this.resultsGrid.innerHTML = '';
    },
    
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        this.searchTimeout = setTimeout(async () => {
            if (!query.trim()) {
                this.resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
                return;
            }
            
            // Show loading
            this.resultsGrid.innerHTML = '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
            
            try {
                // Get filters
                const category = document.getElementById('category-filter')?.value;
                const mediaType = document.getElementById('media-type-filter')?.value;
                const sortBy = document.getElementById('sort-filter')?.value;
                
                // Build query
                let whereClause = {};
                
                if (category) {
                    whereClause.genre = category;
                }
                
                if (mediaType) {
                    whereClause.media_type = mediaType;
                }
                
                // Get order by
                let orderBy = 'created_at';
                let order = 'desc';
                
                if (sortBy === 'oldest') {
                    order = 'asc';
                } else if (sortBy === 'popular') {
                    orderBy = 'views';
                    order = 'desc';
                }
                
                // Search in database
                const results = await contentSupabase.query('Content', {
                    select: '*',
                    where: whereClause,
                    orderBy: orderBy,
                    order: order,
                    limit: 50
                });
                
                // Filter by search query
                const filteredResults = results.filter(item => {
                    const searchText = query.toLowerCase();
                    return (
                        (item.title && item.title.toLowerCase().includes(searchText)) ||
                        (item.description && item.description.toLowerCase().includes(searchText)) ||
                        (item.genre && item.genre.toLowerCase().includes(searchText)) ||
                        (item.creator && item.creator.toLowerCase().includes(searchText))
                    );
                });
                
                this.currentResults = filteredResults;
                this.renderSearchResults(filteredResults);
                
            } catch (error) {
                console.error('Search error:', error);
                this.resultsGrid.innerHTML = '<div class="no-results">Error searching. Please try again.</div>';
            }
        }, 500);
    },
    
    renderSearchResults(results) {
        if (results.length === 0) {
            this.resultsGrid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
            return;
        }
        
        this.resultsGrid.innerHTML = results.map(item => {
            // Get the correct creator name from the data
            const creatorName = item.creator || item.creator_display_name || item.user_profiles?.username || item.user_profiles?.full_name || 'Creator';
            
            return `
            <div class="content-card" data-content-id="${item.id}" data-views="${item.views || 0}" data-likes="${item.likes || 0}">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${item.views || 0}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id || item.user_id}"
                            data-creator-name="${creatorName}">
                        <i class="fas fa-user"></i>
                        ${creatorName.length > 15 ? creatorName.substring(0, 15) + '...' : creatorName}
                    </button>
                </div>
            </div>
            `;
        }).join('');
        
        // Add click listeners
        this.setupSearchResultListeners();
    },
    
    setupSearchResultListeners() {
        this.resultsGrid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Check if clicking on interactive elements
                if (e.target.closest('.creator-btn') || 
                    e.target.closest('.share-btn') ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'A') {
                    return;
                }
                
                const contentId = card.dataset.contentId;
                if (contentId) {
                    window.location.href = `content-detail.html?id=${contentId}`;
                }
            });
        });
    }
};

// Infinite Scroll System
const InfiniteScrollSystem = {
    isLoading: false,
    currentPage: 0,
    itemsPerPage: 10,
    renderedItems: new Set(),
    
    init() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.isLoading) {
                        this.loadMoreContent();
                    }
                });
            },
            { threshold: 0.5 }
        );
        
        // Start observing the loading indicator
        const loadingIndicator = document.getElementById('infinite-scroll-loading');
        if (loadingIndicator) {
            this.observer.observe(loadingIndicator);
        }
        
        // Listen for content updates
        document.addEventListener('contentLoaded', (e) => {
            this.allItems = e.detail.content;
            this.currentPage = 0;
            this.renderedItems.clear();
        });
    },
    
    async loadMoreContent() {
        if (this.isLoading || !allContentData || allContentData.length === 0) return;
        
        this.isLoading = true;
        const loadingIndicator = document.getElementById('infinite-scroll-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        try {
            // Calculate start and end indices
            const start = this.currentPage * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            
            // Get items for this page
            const itemsToLoad = allContentData.slice(start, end);
            
            // Filter out already rendered items
            const newItems = itemsToLoad.filter(item => !this.renderedItems.has(item.id));
            
            if (newItems.length > 0) {
                // Add to main content grid
                this.appendContentToGrid(newItems);
                
                // Mark as rendered
                newItems.forEach(item => this.renderedItems.add(item.id));
                
                // Increment page
                this.currentPage++;
            }
            
            // Hide loading indicator if no more items
            if (end >= allContentData.length && loadingIndicator) {
                loadingIndicator.innerHTML = '<div>No more content to load</div>';
                this.observer.unobserve(loadingIndicator);
            }
            
        } catch (error) {
            console.error('Error loading more content:', error);
            showToast('Failed to load more content', 'error');
        } finally {
            this.isLoading = false;
            if (loadingIndicator && this.currentPage * this.itemsPerPage < allContentData.length) {
                loadingIndicator.style.display = 'none';
            }
        }
    },
    
    appendContentToGrid(items) {
        const contentGrids = document.querySelectorAll('.content-grid:not(#search-results-grid)');
        
        contentGrids.forEach(grid => {
            // Find the last grid to append to (usually the latest uploads section)
            if (grid.closest('.section:first-of-type')) {
                const newCards = items.map(item => this.createContentCard(item)).join('');
                grid.innerHTML += newCards;
                this.setupNewCardListeners(grid);
            }
        });
    },
    
    createContentCard(item) {
        return `
            <div class="content-card" data-content-id="${item.id}" data-views="${item.views || 0}" data-likes="${item.likes || 0}">
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
                    ${this.getContinueWatchingBadge(item.id)}
                    <button class="share-btn" title="Share" data-content-id="${item.id}">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${item.views || 0}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id}"
                            data-creator-name="${item.creator}">
                        <i class="fas fa-user"></i>
                        ${item.creator.length > 15 ? item.creator.substring(0, 15) + '...' : item.creator}
                    </button>
                </div>
            </div>
        `;
    },
    
    getContinueWatchingBadge(contentId) {
        const progress = this.getWatchProgress(contentId);
        if (progress > 0 && progress < 90) {
            return `
                <div class="continue-watching-badge">
                    <i class="fas fa-play-circle"></i>
                    Continue
                </div>
                <div class="continue-watching-progress">
                    <div class="continue-watching-progress-fill" style="width: ${progress}%"></div>
                </div>
            `;
        }
        return '';
    },
    
    getWatchProgress(contentId) {
        const progress = localStorage.getItem(`watch_progress_${contentId}`);
        return progress ? parseInt(progress) : 0;
    },
    
    setupNewCardListeners(grid) {
        const newCards = grid.querySelectorAll('.content-card:not(.initialized)');
        newCards.forEach(card => {
            card.classList.add('initialized');
            VideoPreviewSystem.handleCardHover(card);
        });
    }
};

// UPDATED: Recommended For You System (replaces PersonalizedRecommendationsSystem)
const RecommendedForYouSystem = {
    isUserLoggedIn: false,
    userLikedGenres: [],
    fallbackToTrending: true,
    
    init() {
        this.checkUserStatus();
        this.loadUserPreferences();
    },
    
    async checkUserStatus() {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        this.isUserLoggedIn = !!session;
    },
    
    loadUserPreferences() {
        try {
            // Load user's liked content genres from localStorage
            const likedContent = JSON.parse(localStorage.getItem('user_liked_content') || '[]');
            this.userLikedGenres = [];
            
            // Extract unique genres from liked content
            likedContent.forEach(content => {
                if (content.genre && !this.userLikedGenres.includes(content.genre)) {
                    this.userLikedGenres.push(content.genre);
                }
            });
            
            // If no liked genres, fall back to trending
            this.fallbackToTrending = this.userLikedGenres.length === 0;
            
        } catch (error) {
            console.error('Error loading user preferences:', error);
            this.fallbackToTrending = true;
        }
    },
    
    getRecommendedContent(allContent) {
        if (!allContent || allContent.length === 0) return [];
        
        // For new users or users without liked content, show trending content
        if (!this.isUserLoggedIn || this.fallbackToTrending) {
            console.log('Showing trending content for new/user without preferences');
            return this.getTrendingContent(allContent);
        }
        
        // For logged-in users with liked genres
        const scoredContent = allContent.map(content => {
            let score = 0;
            
            // Score based on liked genres
            if (content.genre && this.userLikedGenres.includes(content.genre)) {
                score += 5;
            }
            
            // Score based on recency (last 7 days gets bonus)
            if (content.created_at) {
                const daysOld = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld < 7) score += 2;
                if (daysOld < 1) score += 3;
            }
            
            // Score based on popularity
            if (content.views) {
                score += Math.min(Math.floor(content.views / 1000), 3);
            }
            
            if (content.likes) {
                score += Math.min(Math.floor(content.likes / 100), 2);
            }
            
            return { ...content, recommendationScore: score };
        });
        
        // Sort by score and take top 5
        return scoredContent
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, 5);
    },
    
    getTrendingContent(contentData) {
        if (!contentData || contentData.length === 0) return [];
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentContent = contentData.filter(item => {
            try {
                const createdAt = new Date(item.created_at);
                return createdAt >= oneWeekAgo;
            } catch {
                return false;
            }
        });
        
        return recentContent.sort((a, b) => {
            const aScore = (a.views || 0) + ((a.likes || 0) * 2);
            const bScore = (b.views || 0) + ((b.likes || 0) * 2);
            return bScore - aScore;
        }).slice(0, 5);
    },
    
    shouldDisplaySection() {
        // Only display if user is logged in OR we have trending content to show
        return this.isUserLoggedIn || this.fallbackToTrending;
    },
    
    getSectionDescription() {
        if (!this.isUserLoggedIn) {
            return 'Trending content for new users. <span class="highlight">Sign in for personalized recommendations!</span>';
        }
        
        if (this.fallbackToTrending) {
            return 'Based on trending content. <span class="highlight">Like some content to get personalized recommendations!</span>';
        }
        
        return `Based on your liked ${this.userLikedGenres.join(', ')} content`;
    },
    
    createRecommendedCard(item) {
        return `
            <div class="content-card" data-content-id="${item.id}" data-views="${item.views || 0}" data-likes="${item.likes || 0}">
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
                    <div class="recommended-badge">
                        <i class="fas fa-star"></i> Recommended
                    </div>
                    <button class="share-btn" title="Share" data-content-id="${item.id}">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${item.views || 0}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id}"
                            data-creator-name="${item.creator}">
                        <i class="fas fa-user"></i>
                        ${item.creator.length > 15 ? item.creator.substring(0, 15) + '...' : item.creator}
                    </button>
                </div>
            </div>
        `;
    }
};

// Keyboard Shortcuts System
const KeyboardShortcutsSystem = {
    init() {
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Setup shortcuts help modal
        document.getElementById('close-shortcuts-btn')?.addEventListener('click', () => {
            this.closeShortcutsHelp();
        });
    },
    
    handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+K or Cmd+K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            SearchSystem.openSearch();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            this.handleEscape();
        }
        
        // Space to play/pause video preview
        if (e.key === ' ' && !e.target.tagName === 'BUTTON') {
            e.preventDefault();
            this.handleSpaceKey();
        }
        
        // Question mark for shortcuts help
        if (e.key === '?') {
            e.preventDefault();
            this.toggleShortcutsHelp();
        }
        
        // Alt+H for home
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            window.location.href = 'index.html';
        }
        
        // Alt+P for profile
        if (e.altKey && e.key === 'p') {
            e.preventDefault();
            const profileBtn = document.getElementById('profile-btn');
            if (profileBtn) profileBtn.click();
        }
    },
    
    handleEscape() {
        SearchSystem.closeSearch();
        document.getElementById('analytics-modal')?.classList.remove('active');
        document.getElementById('notifications-panel')?.classList.remove('active');
        document.getElementById('theme-selector')?.classList.remove('active');
        this.closeShortcutsHelp();
    },
    
    handleSpaceKey() {
        const currentPreview = VideoPreviewSystem.currentPreview;
        if (currentPreview) {
            if (currentPreview.paused) {
                currentPreview.play();
            } else {
                currentPreview.pause();
            }
        }
    },
    
    toggleShortcutsHelp() {
        const helpModal = document.getElementById('keyboard-shortcuts-help');
        if (helpModal) {
            if (helpModal.classList.contains('active')) {
                this.closeShortcutsHelp();
            } else {
                helpModal.classList.add('active');
            }
        }
    },
    
    closeShortcutsHelp() {
        const helpModal = document.getElementById('keyboard-shortcuts-help');
        if (helpModal) {
            helpModal.classList.remove('active');
        }
    }
};

// ✅ SHOW TOAST MESSAGE
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        document.body.appendChild(newContainer);
        newContainer.appendChild(toast);
    } else {
        container.appendChild(toast);
    }
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ✅ LOAD USER PROFILE PICTURE
async function loadUserProfilePicture(user) {
    try {
        const profileBtn = document.getElementById('profile-btn');
        if (!user || !profileBtn) return;
        
        const userInitials = getInitials(user.email);
        profileBtn.innerHTML = `
            <div class="profile-placeholder">
                ${userInitials}
            </div>
        `;
        
        try {
            const { data: profile, error: profileError } = await supabaseAuth
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (profileError) {
                console.log('Profile query error:', profileError);
                return;
            }
            
            if (profile && profile.avatar_url) {
                let avatarUrl = profile.avatar_url;
                if (!avatarUrl.startsWith('http')) {
                    if (avatarUrl.startsWith('avatars/')) {
                        avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
                    } else {
                        avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
                    }
                }
                
                const profileImg = document.createElement('img');
                profileImg.className = 'profile-img';
                profileImg.src = avatarUrl;
                profileImg.alt = 'Profile Picture';
                profileImg.onerror = function() {
                    this.parentElement.innerHTML = `
                        <div class="profile-placeholder">
                            ${userInitials}
                        </div>
                    `;
                };
                
                profileBtn.innerHTML = '';
                profileBtn.appendChild(profileImg);
            }
            
        } catch (error) {
            console.log('No user profile found:', error);
        }
        
    } catch (error) {
        console.error('Error loading user profile picture:', error);
    }
}

function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    if (parts.length >= 2) {
        return parts.substring(0, 2).toUpperCase();
    }
    return email.charAt(0).toUpperCase();
}

// ✅ FETCH HOME FEED CONTENT
async function fetchHomeFeedContent() {
    try {
        console.log('🔄 Fetching content from Supabase...');
        
        let contentData = [];
        
        try {
            contentData = await contentSupabase.query('Content', {
                select: '*,user_profiles!user_id(*)',
                where: { status: 'published' },
                orderBy: 'created_at',
                order: 'desc',
                limit: 100
            });
            console.log('✅ Fetched from Content table:', contentData.length, 'items');
        } catch (error) {
            console.log('⚠️ Content table failed, trying content table...');
            
            try {
                contentData = await contentSupabase.query('content', {
                    select: '*',
                    where: { status: 'published' },
                    orderBy: 'created_at',
                    order: 'desc',
                    limit: 100
                });
                console.log('✅ Fetched from content table:', contentData.length, 'items');
            } catch (error2) {
                console.log('⚠️ Both table names failed, using test data');
                return getTestContent();
            }
        }
        
        const processedData = contentData.map(item => {
            let creatorName = 'Content Creator';
            
            if (item.user_profiles) {
                creatorName = item.user_profiles.full_name || 
                            item.user_profiles.username || 
                            'Content Creator';
            } else if (item.creator) {
                creatorName = item.creator;
            }
            
            return {
                id: item.id,
                title: item.title || 'Untitled',
                description: item.description || '',
                thumbnail_url: item.thumbnail_url,
                file_url: item.file_url,
                media_type: item.media_type || 'video',
                genre: item.genre,
                created_at: item.created_at,
                creator: creatorName,
                creator_display_name: creatorName,
                creator_id: item.creator_id || item.user_id,
                user_id: item.user_id,
                views: item.views_count || item.views || 0,
                likes: item.likes_count || item.likes || 0
            };
        });
        
        console.log('✅ Processed content:', processedData.length, 'items');
        
        // Cache the content
        await CachingSystem.cacheContent(processedData);
        
        return processedData;
        
    } catch (error) {
        console.error('❌ Error fetching content:', error);
        showToast('Failed to load content. Showing sample data.', 'error');
        
        return getTestContent();
    }
}

// ✅ GET TEST CONTENT (fallback)
function getTestContent() {
    return [
        {
            id: 1,
            title: 'African Music Festival Highlights',
            description: 'Highlights from the biggest African music festival',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            media_type: 'video',
            genre: 'Music',
            created_at: new Date().toISOString(),
            creator: '@music_africa',
            creator_display_name: 'Music Africa',
            creator_id: '1',
            user_id: '1',
            views: 12500,
            likes: 890
        },
        {
            id: 2,
            title: 'Tech Innovation in Africa',
            description: 'How technology is transforming African economies',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            media_type: 'video',
            genre: 'STEM',
            created_at: new Date().toISOString(),
            creator: '@tech_africa',
            creator_display_name: 'Tech Africa',
            creator_id: '2',
            user_id: '2',
            views: 8900,
            likes: 650
        },
        {
            id: 3,
            title: 'Traditional Dance Performance',
            description: 'Beautiful traditional dance from West Africa',
            thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            media_type: 'video',
            genre: 'Culture',
            created_at: new Date().toISOString(),
            creator: '@cultural_hub',
            creator_display_name: 'Cultural Hub',
            creator_id: '3',
            user_id: '3',
            views: 15600,
            likes: 1200
        },
        {
            id: 4,
            title: 'African Cuisine Cooking Show',
            description: 'Learn to make traditional African dishes',
            thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            media_type: 'video',
            genre: 'Food',
            created_at: new Date().toISOString(),
            creator: '@chef_amina',
            creator_display_name: 'Chef Amina',
            creator_id: '4',
            user_id: '4',
            views: 7800,
            likes: 540
        },
        {
            id: 5,
            title: 'Startup Success Stories',
            description: 'African entrepreneurs building successful businesses',
            thumbnail_url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w-400&h=225&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            media_type: 'video',
            genre: 'Business',
            created_at: new Date().toISOString(),
            creator: '@startup_africa',
            creator_display_name: 'Startup Africa',
            creator_id: '5',
            user_id: '5',
            views: 11200,
            likes: 890
        }
    ];
}

// ✅ GET MOST VIEWED CONTENT
function getMostViewedContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    return [...contentData].sort((a, b) => b.views - a.views).slice(0, 5);
}

// ✅ GET MOST LIKED CONTENT
function getMostLikedContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    return [...contentData].sort((a, b) => b.likes - a.likes).slice(0, 5);
}

// ✅ GET TRENDING CONTENT
function getTrendingContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentContent = contentData.filter(item => {
        try {
            const createdAt = new Date(item.created_at);
            return createdAt >= oneWeekAgo;
        } catch {
            return false;
        }
    });
    
    return recentContent.sort((a, b) => {
        const aScore = (a.views || 0) + ((a.likes || 0) * 2);
        const bScore = (b.views || 0) + ((b.likes || 0) * 2);
        return bScore - aScore;
    }).slice(0, 5);
}

// ✅ RENDER CONTENT CARDS
function renderContentCards(contentItems) {
    if (!contentItems || contentItems.length === 0) {
        return '<div class="empty-state">No content available</div>';
    }
    
    return contentItems.map(content => `
        <div class="content-card" data-content-id="${content.id}" data-views="${content.views || 0}" data-likes="${content.likes || 0}">
            <div class="card-thumbnail">
                <img src="${content.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                     alt="${content.title}"
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
                <div class="video-preview-container">
                    <video class="video-preview" muted preload="metadata">
                        <source src="${content.file_url || ''}" type="video/mp4">
                    </video>
                </div>
                ${InfiniteScrollSystem.getContinueWatchingBadge(content.id)}
                <button class="share-btn" title="Share" data-content-id="${content.id}">
                    <i class="fas fa-share"></i>
                </button>
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${content.title}">
                    ${content.title.length > 50 ? content.title.substring(0, 50) + '...' : content.title}
                </h3>
                <div class="card-stats">
                    <span class="stat">
                        <i class="fas fa-eye"></i> ${content.views || 0}
                    </span>
                    <span class="stat">
                        <i class="fas fa-heart"></i> ${content.likes || 0}
                    </span>
                </div>
                <button class="creator-btn" 
                        data-creator-id="${content.creator_id}"
                        data-creator-name="${content.creator}">
                    <i class="fas fa-user"></i>
                    ${content.creator.length > 15 ? content.creator.substring(0, 15) + '...' : content.creator}
                </button>
            </div>
        </div>
    `).join('');
}

// UPDATED: RENDER CONTENT SECTIONS with new Recommended For You section
function renderContentSections() {
    const contentSections = document.getElementById('content-sections');
    if (!contentSections) return;
    
    if (filteredContentData.length === 0) {
        contentSections.innerHTML = `
            <div class="empty-state">
                <h3>No Content Available</h3>
                <p>Check back later for new content!</p>
            </div>
        `;
        return;
    }
    
    // Get recommended content
    const recommendedContent = RecommendedForYouSystem.getRecommendedContent(filteredContentData);
    
    let sectionsHTML = '';
    
    // Continue Watching (if any)
    const continueWatching = ContinueWatchingSystem.getContinueWatchingContent(filteredContentData);
    if (continueWatching.length > 0) {
        sectionsHTML += `
            <section class="section" data-type="continue-watching">
                <div class="section-header">
                    <h2 class="section-title">Continue Watching</h2>
                    <button class="see-all-btn" data-action="see-all" data-target="continue-watching">See All</button>
                </div>
                <div class="content-grid">
                    ${renderContentCards(continueWatching.slice(0, 5))}
                </div>
            </section>
        `;
    }
    
    // Recommended For You Section (Conditionally displayed)
    if (RecommendedForYouSystem.shouldDisplaySection() && recommendedContent.length > 0) {
        sectionsHTML += `
            <section class="section recommended-for-you-section" data-type="recommended-for-you">
                <div class="section-header">
                    <h2 class="section-title">Recommended For You</h2>
                    <div class="recommended-description">
                        ${RecommendedForYouSystem.getSectionDescription()}
                    </div>
                </div>
                <div class="content-grid">
                    ${recommendedContent.map(item => RecommendedForYouSystem.createRecommendedCard(item)).join('')}
                </div>
            </section>
        `;
    }
    
    // Latest Uploads
    sectionsHTML += `
        <section class="section">
            <div class="section-header">
                <h2 class="section-title">Latest Uploads</h2>
                <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
            </div>
            <div class="content-grid">
                ${renderContentCards(filteredContentData.slice(0, 10))}
            </div>
        </section>
        
        <!-- Trending Now Section -->
        <section class="section" data-type="trending">
            <div class="section-header">
                <h2 class="section-title">Trending Now</h2>
                <button class="see-all-btn" data-action="see-all" data-target="trending">See All</button>
            </div>
            <div class="content-grid">
                ${renderContentCards(getTrendingContent(filteredContentData))}
            </div>
        </section>
        
        <!-- Most Viewed -->
        <section class="section">
            <div class="section-header">
                <h2 class="section-title">Most Viewed</h2>
                <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
            </div>
            <div class="content-grid">
                ${renderContentCards(getMostViewedContent(filteredContentData))}
            </div>
        </section>
        
        <!-- Most Liked -->
        <section class="section">
            <div class="section-header">
                <h2 class="section-title">Most Liked</h2>
                <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
            </div>
            <div class="content-grid">
                ${renderContentCards(getMostLikedContent(filteredContentData))}
            </div>
        </section>
    `;
    
    contentSections.innerHTML = sectionsHTML;
    
    // Setup content card listeners
    setupContentCardListeners();
    
    // Initialize recommended system
    RecommendedForYouSystem.init();
}

// ✅ SETUP EVENT LISTENERS
function setupEventListeners() {
    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            SearchSystem.openSearch();
        });
    }
    
    // Browse all buttons
    const browseAllBtn = document.getElementById('browse-all-btn');
    const browseAllCta = document.getElementById('browse-all-cta');
    
    if (browseAllBtn) {
        browseAllBtn.addEventListener('click', () => {
            window.location.href = 'explore-screen.html';
        });
    }
    
    if (browseAllCta) {
        browseAllCta.addEventListener('click', () => {
            window.location.href = 'content-library.html';
        });
    }
    
    // See all buttons (delegated)
    document.addEventListener('click', (e) => {
        const seeAllBtn = e.target.closest('[data-action="see-all"]');
        if (seeAllBtn) {
            const target = seeAllBtn.dataset.target;
            if (target === 'trending') {
                window.location.href = 'trending_screen.html';
            } else if (target === 'recommendations') {
                window.location.href = 'recommendations.html';
            } else if (target === 'continue-watching') {
                window.location.href = 'continue-watching.html';
            } else {
                window.location.href = 'content-library.html';
            }
        }
    });
}

// ✅ SETUP CONTENT CARD LISTENERS - FIXED FOR MOBILE
function setupContentCardListeners() {
    // Content card clicks
    document.querySelectorAll('.content-card:not(.initialized)').forEach(card => {
        card.classList.add('initialized');
        
        // Use both click and touch events for better mobile support
        const handleCardClick = (e) => {
            // Prevent default on touch to avoid double firing
            if (e.type === 'touchstart') {
                e.preventDefault();
            }
            
            // Check if clicking on interactive elements
            if (e.target.closest('.share-btn') || 
                e.target.closest('.creator-btn') ||
                e.target.tagName === 'BUTTON' ||
                e.target.tagName === 'A' ||
                e.target.tagName === 'INPUT') {
                return;
            }
            
            const contentId = card.dataset.contentId;
            if (contentId) {
                // Track interaction for recommendations
                // Note: We've removed RecommendationSystem, so we can keep this commented for now
                // const content = allContentData.find(c => c.id == contentId);
                // if (content) {
                //     RecommendationSystem.trackContentInteraction(content);
                // }
                
                // Use a small timeout to allow any preview to be handled
                setTimeout(() => {
                    window.location.href = `content-detail.html?id=${contentId}`;
                }, 50);
            }
        };
        
        // Add both click and touch events
        card.addEventListener('click', handleCardClick);
        card.addEventListener('touchstart', handleCardClick, { passive: false });
    });
    
    // Share buttons
    document.querySelectorAll('.share-btn:not(.initialized)').forEach(btn => {
        btn.classList.add('initialized');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const contentId = btn.dataset.contentId;
            const content = allContentData.find(c => c.id == contentId);
            if (content) {
                shareContent(content);
            }
        });
    });
    
    // Creator buttons
    document.querySelectorAll('.creator-btn:not(.initialized)').forEach(btn => {
        btn.classList.add('initialized');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const creatorId = btn.dataset.creatorId;
            const creatorName = btn.dataset.creatorName;
            if (creatorId) {
                window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
            } else {
                showToast(`Cannot view ${creatorName}'s channel - missing creator information`, 'error');
            }
        });
    });
    
    // Setup video preview listeners
    document.querySelectorAll('.content-card:not(.hover-initialized)').forEach(card => {
        card.classList.add('hover-initialized');
    });
}

// ✅ SHARE CONTENT
function shareContent(content) {
    const title = content.title || 'Amazing Content';
    const creatorName = content.creator || 'Bantu Creator';
    
    const shareText = `Check out "${title}" by ${creatorName} on Bantu Stream Connect!`;
    const shareUrl = `${window.location.origin}/content-detail.html?id=${content.id}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Amazing content on Bantu Stream Connect',
            text: shareText,
            url: shareUrl
        });
    } else {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
            showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            prompt('Copy this text to share:', `${shareText} ${shareUrl}`);
        });
    }
}

// ✅ INITIALIZE HOME FEED
async function initializeHomeFeed() {
    try {
        const loadingScreen = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        const app = document.getElementById('app');
        
        // Setup event listeners
        setupEventListeners();
        
        // Try to load cached content first for faster initial display
        const cachedContent = CachingSystem.getCachedContent();
        if (cachedContent) {
            allContentData = cachedContent;
            filteredContentData = cachedContent;
            renderContentSections();
            
            // Show app
            if (loadingScreen && app) {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
            }
            
            // Load fresh content in background
            setTimeout(async () => {
                try {
                    const freshContent = await fetchHomeFeedContent();
                    if (freshContent.length > cachedContent.length) {
                        allContentData = freshContent;
                        filteredContentData = freshContent;
                        renderContentSections();
                        showToast('Content updated', 'success');
                    }
                } catch (error) {
                    console.log('Background refresh failed:', error);
                }
            }, 1000);
        } else {
            // Load fresh content
            if (loadingText) {
                loadingText.textContent = 'Fetching content...';
            }
            allContentData = await fetchHomeFeedContent();
            filteredContentData = allContentData;
            
            console.log('✅ Loaded', allContentData.length, 'content items');
            
            // Update systems with new content
            const contentLoadedEvent = new CustomEvent('contentLoaded', {
                detail: { content: allContentData }
            });
            document.dispatchEvent(contentLoadedEvent);
            
            // Render UI
            if (loadingText) {
                loadingText.textContent = 'Setting up interface...';
            }
            renderContentSections();
            
            // Initialize trending system
            TrendingSystem.init();
            
            // Show app
            if (loadingScreen && app) {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
            }
        }
        
    } catch (error) {
        console.error('❌ Error initializing home feed:', error);
        showToast('Failed to initialize. Please refresh the page.', 'error');
        const loadingScreen = document.getElementById('loading');
        const app = document.getElementById('app');
        if (loadingScreen && app) {
            loadingScreen.style.display = 'none';
            app.style.display = 'block';
        }
    }
}

// UPDATED: Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Bantu Stream Connect Home Feed Initializing...');
    
    // Initialize Development Window (always visible)
    DevelopmentWindow.init();
    
    // Initialize Navigation Button System FIRST
    NavigationButtonSystem.init();
    
    // Initialize all new systems
    NotificationSystem.init();
    AnalyticsSystem.init();
    ThemeSystem.init();
    AccessibilitySystem.init();
    CachingSystem.init();
    ErrorRecoverySystem.init();
    PerformanceMonitor.init();
    EngagementTracker.init();
    VideoPreviewSystem.init();
    ContinueWatchingSystem.init();
    ContentStatsSystem.init();
    SearchSystem.init();
    InfiniteScrollSystem.init();
    KeyboardShortcutsSystem.init();
    
    // Initialize Recommended For You System
    RecommendedForYouSystem.init();
    
    // Initialize auth and check if user is logged in
    const { data: { session }, error } = await supabaseAuth.auth.getSession();
    const isAuthenticated = !!session;
    
    const profileBtn = document.getElementById('profile-btn');
    
    if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, showing public home feed');
        showToast('Welcome! Sign in to access personalized features.', 'info');
        
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                window.location.href = 'login.html?redirect=index.html';
            });
        }
    } else {
        console.log('✅ User authenticated:', session.user.email);
        showToast(`Welcome back, ${session.user.email}!`, 'success');
        
        await loadUserProfilePicture(session.user);
        
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                window.location.href = 'profile.html';
            });
        }
    }
    
    // Update RecommendedForYouSystem with auth status
    RecommendedForYouSystem.isUserLoggedIn = isAuthenticated;
    
    // Initialize the home feed
    await initializeHomeFeed();
    
    // Listen for auth state changes
    supabaseAuth.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN') {
            console.log('User signed in');
            RecommendedForYouSystem.isUserLoggedIn = true;
            if (session?.user) {
                loadUserProfilePicture(session.user);
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            RecommendedForYouSystem.isUserLoggedIn = false;
            if (profileBtn) {
                profileBtn.innerHTML = `
                    <div class="profile-placeholder">
                        <i class="fas fa-user"></i>
                    </div>
                `;
            }
        }
        
        // Re-render sections to update Recommended For You
        renderContentSections();
    });
});
