// Video Preview System
class VideoPreviewSystem {
    constructor() {
        this.hoverTimeout = null;
        this.currentPreview = null;
        this.touchStartTime = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoved = false;
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }
    
    init() {
        this.setupEventDelegation();
        this.setupVideoAttributes();
    }
    
    setupEventDelegation() {
        // Unified tap handler for mobile and desktop
        document.addEventListener('mouseover', (e) => {
            if (!this.isMobile) {
                const card = e.target.closest('.content-card');
                if (card) {
                    this.handleCardHover(card);
                }
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            if (!this.isMobile) {
                const card = e.target.closest('.content-card');
                if (card) {
                    this.handleCardLeave(card);
                }
            }
        });
        
        // Touch events for mobile
        document.addEventListener('touchstart', (e) => {
            this.touchStartTime = Date.now();
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.touchMoved = false;
            
            const card = e.target.closest('.content-card');
            if (card && !e.target.closest('.share-btn') && 
                !e.target.closest('.creator-btn')) {
                this.handleCardHover(card);
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const deltaX = Math.abs(touchX - this.touchStartX);
                const deltaY = Math.abs(touchY - this.touchStartY);
                
                if (deltaX > 10 || deltaY > 10) {
                    this.touchMoved = true;
                    this.handleCardLeaveAll();
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - this.touchStartTime;
            
            if (touchDuration < 300 && !this.touchMoved) {
                const card = e.target.closest('.content-card');
                if (card) {
                    this.handleCardLeave(card);
                }
            } else {
                this.handleCardLeaveAll();
            }
            
            this.touchMoved = false;
        }, { passive: true });
    }
    
    setupVideoAttributes() {
        // Setup video attributes for mobile compatibility
        document.querySelectorAll('.video-preview').forEach(video => {
            video.playsInline = true;
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('muted', '');
            video.setAttribute('preload', 'metadata');
        });
    }
    
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
            }
        }, this.isMobile ? 100 : 500);
    }
    
    handleCardLeave(card) {
        clearTimeout(this.hoverTimeout);
        
        const videoElement = card.querySelector('.video-preview');
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
        
        card.classList.remove('video-hover');
        this.currentPreview = null;
    }
    
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
}

// Recommendation Engine
class RecommendationEngine {
    constructor() {
        this.userPreferences = {
            likedGenres: [],
            watchedContent: [],
            preferredCreators: []
        };
        this.algorithmVersion = 'v1.0';
    }
    
    async init() {
        await this.loadUserPreferences();
        this.setupTracking();
    }
    
    async loadUserPreferences() {
        try {
            const likedContent = JSON.parse(localStorage.getItem('user_liked_content') || '[]');
            this.userPreferences.likedGenres = [...new Set(likedContent.map(item => item.genre))].filter(Boolean);
            
            const watchHistory = JSON.parse(localStorage.getItem('watch_history') || '{}');
            this.userPreferences.watchedContent = Object.keys(watchHistory);
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }
    
    setupTracking() {
        // Track content interactions
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.content-card');
            if (card) {
                const contentId = card.dataset.contentId;
                if (contentId) {
                    this.trackView(contentId);
                }
            }
        });
    }
    
    trackView(contentId) {
        const views = JSON.parse(localStorage.getItem('content_views') || '[]');
        if (!views.includes(contentId)) {
            views.push(contentId);
            localStorage.setItem('content_views', JSON.stringify(views.slice(-100)));
        }
    }
    
    calculateRecommendationScore(content, userData) {
        let score = 0;
        
        // Genre matching
        if (content.genre && this.userPreferences.likedGenres.includes(content.genre)) {
            score += 3;
        }
        
        // Creator preference
        if (content.creator_id && this.userPreferences.preferredCreators.includes(content.creator_id)) {
            score += 2;
        }
        
        // Popularity boost
        if (content.views) {
            score += Math.min(content.views / 1000, 2);
        }
        
        // Recency boost (last 24 hours)
        if (content.created_at) {
            const hoursOld = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60);
            if (hoursOld < 24) score += 1;
            if (hoursOld < 1) score += 2;
        }
        
        // Avoid recommending already watched content
        if (this.userPreferences.watchedContent.includes(content.id.toString())) {
            score -= 2;
        }
        
        return score;
    }
    
    getPersonalizedRecommendations(allContent, limit = 5) {
        if (!allContent || allContent.length === 0) return [];
        
        const scoredContent = allContent.map(content => ({
            ...content,
            recommendationScore: this.calculateRecommendationScore(content, this.userPreferences)
        }));
        
        return scoredContent
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, limit)
            .filter(item => item.recommendationScore > 0);
    }
    
    getTrendingFallback(contentData, limit = 5) {
        if (!contentData || contentData.length === 0) return [];
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return contentData
            .filter(item => {
                try {
                    return new Date(item.created_at) >= oneWeekAgo;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => {
                const aScore = (a.views || 0) + ((a.likes || 0) * 2);
                const bScore = (b.views || 0) + ((b.likes || 0) * 2);
                return bScore - aScore;
            })
            .slice(0, limit);
    }
}

// Notification System
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.realtimeChannel = null;
        this.pollingInterval = null;
    }
    
    async init() {
        await this.loadNotifications();
        this.setupRealtime();
        this.renderNotifications();
        this.setupEventListeners();
        this.updateBadge();
    }
    
    async loadNotifications() {
        try {
            const saved = localStorage.getItem('notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.unreadCount = this.notifications.filter(n => !n.read).length;
            }
            
            await this.fetchNewNotifications();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }
    
    async fetchNewNotifications() {
        // Simulated notifications
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
            }
        ];
        
        mockNotifications.forEach(notification => {
            if (!this.notifications.find(n => n.id === notification.id)) {
                this.notifications.unshift(notification);
            }
        });
        
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    }
    
    setupRealtime() {
        // Simulate real-time updates every 30 seconds
        this.pollingInterval = setInterval(() => {
            this.simulateRealtimeUpdate();
        }, 30000);
        
        // Setup push notifications if supported
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    simulateRealtimeUpdate() {
        if (Math.random() > 0.7) {
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
            
            // Show browser notification
            if (Notification.permission === 'granted') {
                new Notification(newNotification.title, {
                    body: newNotification.message,
                    icon: '/icon.png'
                });
            }
        }
    }
    
    addNotification(notification) {
        this.notifications.unshift(notification);
        if (!notification.read) {
            this.unreadCount++;
        }
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    }
    
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount--;
            this.saveNotifications();
            this.renderNotifications();
            this.updateBadge();
        }
    }
    
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
    }
    
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
    }
    
    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }
    
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
        
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = parseInt(item.dataset.id);
                this.markAsRead(id);
            });
        });
    }
    
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }
    
    setupEventListeners() {
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
    }
}

// Analytics System
class AnalyticsSystem {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.sessionStart = null;
        this.watchTime = 0;
        this.sessions = [];
        this.chart = null;
    }
    
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
    }
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
    
    trackSessionStart() {
        const previousSessions = JSON.parse(localStorage.getItem('user_sessions') || '[]');
        this.sessions = previousSessions;
        
        this.sessions.push({
            id: this.sessionId,
            startTime: this.sessionStart,
            endTime: null,
            duration: null
        });
        
        if (this.sessions.length > 30) {
            this.sessions = this.sessions.slice(-30);
        }
        
        localStorage.setItem('user_sessions', JSON.stringify(this.sessions));
    }
    
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
        
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push(eventData);
        if (events.length > 1000) events.shift();
        localStorage.setItem('analytics_events', JSON.stringify(events));
        
        console.log(`📊 Tracked: ${event}`, eventData.properties);
    }
    
    trackWatchTime(duration) {
        this.watchTime += duration;
        this.trackEvent('watch_time', { duration, total_watch_time: this.watchTime });
        this.updateAnalyticsDisplay();
    }
    
    trackContentInteraction(contentId, type, details = {}) {
        this.trackEvent('content_interaction', {
            content_id: contentId,
            interaction_type: type,
            ...details
        });
    }
    
    updateAnalyticsDisplay() {
        const hours = Math.floor(this.watchTime / 3600000);
        const minutes = Math.floor((this.watchTime % 3600000) / 60000);
        document.getElementById('total-watch-time').textContent = `${hours}h ${minutes}m`;
        
        const totalSessions = this.sessions.length;
        document.getElementById('sessions-per-user').textContent = totalSessions;
        
        const uniqueSessions = [...new Set(this.sessions.map(s => s.id))].length;
        const returnRate = totalSessions > 1 ? Math.round(((totalSessions - 1) / totalSessions) * 100) : 0;
        document.getElementById('return-rate').textContent = `${returnRate}%`;
        
        const totalViews = parseInt(localStorage.getItem('total_views') || '0');
        document.getElementById('total-views').textContent = totalViews.toLocaleString();
        
        // Simulated trends
        document.getElementById('watch-time-trend').textContent = '+12%';
        document.getElementById('sessions-trend').textContent = '+5%';
        document.getElementById('return-rate-trend').textContent = '+3%';
        document.getElementById('views-trend').textContent = '+8%';
    }
    
    setupAnalyticsChart() {
        const ctx = document.getElementById('engagement-chart');
        if (!ctx) return;
        
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
    }
    
    setupEventTracking() {
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.content-card');
            if (card) {
                const contentId = card.dataset.contentId;
                if (contentId) {
                    this.trackContentInteraction(contentId, 'view');
                    
                    let totalViews = parseInt(localStorage.getItem('total_views') || '0');
                    totalViews++;
                    localStorage.setItem('total_views', totalViews.toString());
                    this.updateAnalyticsDisplay();
                }
            }
        });
        
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                const video = e.target;
                const contentId = video.closest('.content-card')?.dataset.contentId;
                if (contentId) {
                    this.trackContentInteraction(contentId, 'video_play');
                    
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
    }
    
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
        
        analyticsModal?.addEventListener('click', (e) => {
            if (e.target === analyticsModal) {
                analyticsModal.classList.remove('active');
            }
        });
    }
}

// Search System - FIXED VERSION
class SearchSystem {
    constructor() {
        this.modal = null;
        this.searchInput = null;
        this.resultsGrid = null;
        this.currentResults = [];
        this.searchTimeout = null;
        this.searchIndex = [];
        this.lastSearchId = 0;
    }
    
    init() {
        this.modal = document.getElementById('search-modal');
        this.searchInput = document.getElementById('search-input');
        this.resultsGrid = document.getElementById('search-results-grid');
        
        this.buildSearchIndex();
        this.setupEventListeners();
    }
    
    async buildSearchIndex() {
        try {
            const content = await contentSupabase.query('Content', {
                select: 'id,title,description,genre,creator,media_type',
                where: { status: 'published' },
                limit: 500 // Reduced from 1000
            });
            
            this.searchIndex = content.map(item => ({
                id: item.id,
                title: item.title || '',
                description: item.description || '',
                genre: item.genre || '',
                creator: item.creator || '',
                media_type: item.media_type || 'video',
                searchText: `${item.title} ${item.description} ${item.genre} ${item.creator}`.toLowerCase()
            }));
            
            console.log('✅ Search index built:', this.searchIndex.length, 'items');
        } catch (error) {
            console.error('Failed to build search index:', error);
            // Use empty index if fetch fails
            this.searchIndex = [];
        }
    }
    
    setupEventListeners() {
        this.searchInput?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        document.getElementById('category-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        document.getElementById('media-type-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            this.handleSearch(this.searchInput.value);
        });
        
        document.getElementById('close-search-btn')?.addEventListener('click', () => {
            this.closeSearch();
        });
    }
    
    openSearch() {
        this.modal?.classList.add('active');
        setTimeout(() => this.searchInput?.focus(), 350);
    }
    
    closeSearch() {
        this.modal?.classList.remove('active');
        this.searchInput.value = '';
        this.resultsGrid.innerHTML = '';
        this.currentSearchId++;
    }
    
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        this.searchTimeout = setTimeout(async () => {
            const currentSearchId = ++this.lastSearchId;
            
            if (!query.trim()) {
                this.resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
                return;
            }
            
            this.resultsGrid.innerHTML = '<div class="search-loading"><div class="loading-spinner"></div><div>Searching...</div></div>';
            
            try {
                const results = await this.searchContent(query);
                
                // Only update if this is still the latest search
                if (currentSearchId === this.lastSearchId) {
                    this.currentResults = results;
                    this.renderSearchResults(results);
                }
            } catch (error) {
                console.error('Search error:', error);
                // Only show error if this is still the latest search
                if (currentSearchId === this.lastSearchId) {
                    if (error.message.includes('timeout') || error.message.includes('408')) {
                        // Fall back to client-side search
                        const clientResults = this.searchLocally(query);
                        this.renderSearchResults(clientResults);
                        this.showToast('Using offline search results', 'info');
                    } else {
                        this.resultsGrid.innerHTML = '<div class="no-results">Search failed. Please check your connection.</div>';
                    }
                }
            }
        }, 350); // Increased debounce time
    }
    
    async searchContent(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        
        if (searchTerms.length === 0) return [];
        
        // Get filters
        const category = document.getElementById('category-filter')?.value;
        const mediaType = document.getElementById('media-type-filter')?.value;
        const sortBy = document.getElementById('sort-filter')?.value;
        
        // Build where clause
        let whereConditions = ['status.eq.published'];
        
        // Add text search conditions using OR for multiple terms
        if (searchTerms.length > 0) {
            const textConditions = searchTerms.map(term => 
                `or(title.ilike.%${term}%,description.ilike.%${term}%,genre.ilike.%${term}%,creator.ilike.%${term}%)`
            ).join(',');
            whereConditions.push(textConditions);
        }
        
        if (category) {
            whereConditions.push(`genre.eq.${encodeURIComponent(category)}`);
        }
        
        if (mediaType) {
            whereConditions.push(`media_type.eq.${mediaType}`);
        }
        
        // Get order by
        let orderBy = 'created_at';
        let order = 'desc';
        
        if (sortBy === 'oldest') {
            order = 'asc';
        } else if (sortBy === 'popular') {
            orderBy = 'views';
            order = 'desc';
        } else if (sortBy === 'trending') {
            orderBy = 'views';
            order = 'desc';
        }
        
        // Use a simpler query approach with timeout protection
        try {
            const response = await this.safeSupabaseQuery(whereConditions, orderBy, order);
            return response;
        } catch (error) {
            // Fall back to local search
            console.log('Supabase search failed, falling back to local:', error);
            return this.searchLocally(query);
        }
    }
    
    async safeSupabaseQuery(whereConditions, orderBy, order, limit = 50) {
        const queryUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/rest/v1/Content?select=*&${whereConditions.join('&')}&order=${orderBy}.${order}&limit=${limit}`;
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        try {
            const response = await fetch(queryUrl, {
                signal: controller.signal,
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    searchLocally(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        const category = document.getElementById('category-filter')?.value;
        const mediaType = document.getElementById('media-type-filter')?.value;
        
        return this.searchIndex.filter(item => {
            // Category filter
            if (category && item.genre !== category) return false;
            
            // Media type filter
            if (mediaType && item.media_type !== mediaType) return false;
            
            // Text search
            return searchTerms.some(term => item.searchText.includes(term));
        }).slice(0, 30); // Limit results
    }
    
    renderSearchResults(results) {
        if (results.length === 0) {
            this.resultsGrid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
            return;
        }
        
        this.resultsGrid.innerHTML = results.map(item => {
            const creatorName = item.creator || item.creator_display_name || 'Creator';
            const thumbnailUrl = item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
            
            // Use a safe thumbnail URL
            const safeThumbnail = thumbnailUrl.startsWith('http') ? thumbnailUrl : 
                'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
            
            return `
            <div class="content-card search-result-card" data-content-id="${item.id}" data-views="${item.views || 0}" data-likes="${item.likes || 0}">
                <div class="card-thumbnail">
                    <img src="${safeThumbnail}" 
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${item.media_type === 'video' ? '<div class="video-icon-overlay"><i class="fas fa-play"></i></div>' : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title && item.title.length > 50 ? item.title.substring(0, 50) + '...' : (item.title || 'Untitled')}
                    </h3>
                    ${item.description ? `<p class="card-description">${item.description.length > 80 ? item.description.substring(0, 80) + '...' : item.description}</p>` : ''}
                    <div class="card-stats">
                        <span class="stat">
                            <i class="fas fa-eye"></i> ${item.views || 0}
                        </span>
                        <span class="stat">
                            <i class="fas fa-heart"></i> ${item.likes || 0}
                        </span>
                        <span class="stat">
                            <i class="fas ${this.getMediaTypeIcon(item.media_type)}"></i> ${item.media_type || 'video'}
                        </span>
                    </div>
                    <button class="creator-btn" 
                            data-creator-id="${item.creator_id || item.user_id || ''}"
                            data-creator-name="${creatorName}">
                        <i class="fas fa-user"></i>
                        ${creatorName.length > 15 ? creatorName.substring(0, 15) + '...' : creatorName}
                    </button>
                </div>
            </div>
            `;
        }).join('');
        
        this.setupSearchResultListeners();
    }
    
    getMediaTypeIcon(mediaType) {
        switch(mediaType) {
            case 'video': return 'fa-video';
            case 'audio': return 'fa-music';
            case 'image': return 'fa-image';
            default: return 'fa-file';
        }
    }
    
    setupSearchResultListeners() {
        this.resultsGrid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
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
        
        // Add click listeners for creator buttons
        this.resultsGrid.querySelectorAll('.creator-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const creatorId = btn.dataset.creatorId;
                const creatorName = btn.dataset.creatorName;
                if (creatorId) {
                    window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
                } else {
                    this.showToast(`Cannot view ${creatorName}'s channel - missing creator information`, 'error');
                }
            });
        });
    }
    
    showToast(message, type) {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '15px 20px';
        toast.style.borderRadius = '8px';
        toast.style.backgroundColor = type === 'error' ? '#EF4444' : '#10B981';
        toast.style.color = 'white';
        toast.style.zIndex = '9999';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Continue Watching System
class ContinueWatchingSystem {
    constructor() {
        this.watchHistory = {};
    }
    
    init() {
        this.loadWatchHistory();
        this.setupProgressTracking();
        this.updateContinueWatchingSection();
    }
    
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
    }
    
    saveWatchHistory() {
        try {
            localStorage.setItem('watch_history', JSON.stringify(this.watchHistory));
        } catch (error) {
            console.error('Error saving watch history:', error);
        }
    }
    
    updateWatchProgress(contentId, progress) {
        this.watchHistory[contentId] = {
            progress: progress,
            lastWatched: Date.now()
        };
        this.saveWatchHistory();
        
        localStorage.setItem(`watch_progress_${contentId}`, progress.toString());
        this.updateContinueWatchingSection();
    }
    
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
        
        return continueWatching.sort((a, b) => b.lastWatched - a.lastWatched);
    }
    
    setupProgressTracking() {
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                const video = e.target;
                const contentId = video.closest('.content-card')?.dataset.contentId;
                
                if (contentId) {
                    video.addEventListener('timeupdate', () => {
                        if (video.duration) {
                            const progress = (video.currentTime / video.duration) * 100;
                            this.updateWatchProgress(contentId, progress);
                        }
                    });
                }
            }
        }, true);
    }
    
    updateContinueWatchingSection() {
        const allContent = stateManager.state.content;
        const continueWatching = this.getContinueWatchingContent(allContent);
        
        let continueWatchingSection = document.querySelector('.section[data-type="continue-watching"]');
        
        if (continueWatching.length > 0) {
            if (!continueWatchingSection) {
                continueWatchingSection = this.createContinueWatchingSection();
            }
            
            const grid = continueWatchingSection.querySelector('.content-grid');
            if (grid) {
                grid.innerHTML = continueWatching.slice(0, 5).map(item => this.createContinueWatchingCard(item)).join('');
                this.setupContinueWatchingCardListeners(grid);
            }
        } else if (continueWatchingSection) {
            continueWatchingSection.remove();
        }
    }
    
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
    }
    
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
    }
    
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
    }
    
    getWatchProgress(contentId) {
        const entry = this.watchHistory[contentId];
        return entry ? entry.progress : 0;
    }
}

// Progress Tracker (for continue watching)
class ProgressTracker {
    constructor() {
        this.trackedVideos = new Map();
    }
    
    trackVideoProgress(videoElement, contentId) {
        if (!videoElement || !contentId) return;
        
        const tracker = {
            contentId: contentId,
            startTime: Date.now(),
            lastUpdate: Date.now(),
            totalTime: 0,
            interval: null
        };
        
        tracker.interval = setInterval(() => {
            const currentTime = Date.now();
            const elapsed = currentTime - tracker.lastUpdate;
            tracker.totalTime += elapsed;
            tracker.lastUpdate = currentTime;
            
            // Save progress every 5 seconds
            if (tracker.totalTime >= 5000) {
                const progress = tracker.totalTime;
                localStorage.setItem(`watch_progress_${contentId}`, progress.toString());
                tracker.totalTime = 0;
            }
        }, 1000);
        
        this.trackedVideos.set(videoElement, tracker);
        
        // Clean up when video ends
        videoElement.addEventListener('ended', () => {
            this.stopTracking(videoElement);
        });
        
        videoElement.addEventListener('pause', () => {
            this.stopTracking(videoElement);
        });
    }
    
    stopTracking(videoElement) {
        const tracker = this.trackedVideos.get(videoElement);
        if (tracker) {
            clearInterval(tracker.interval);
            this.trackedVideos.delete(videoElement);
            
            // Save final progress
            const progress = tracker.totalTime;
            localStorage.setItem(`watch_progress_${tracker.contentId}`, progress.toString());
        }
    }
}

// Export instances
const videoPreviewSystem = new VideoPreviewSystem();
const recommendationEngine = new RecommendationEngine();
const notificationSystem = new NotificationSystem();
const analyticsSystem = new AnalyticsSystem();
const searchSystem = new SearchSystem();
const continueWatchingSystem = new ContinueWatchingSystem();
const progressTracker = new ProgressTracker();

console.log('✅ Home Feed Features initialized');
