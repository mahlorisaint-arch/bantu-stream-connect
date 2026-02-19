// ============================================
// VIDEO PREVIEW SYSTEM
// ============================================
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

// ============================================
// RECOMMENDATION ENGINE
// ============================================
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

// ============================================
// NOTIFICATION SYSTEM
// ============================================
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

// ============================================
// ANALYTICS SYSTEM
// ============================================
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
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        // Also check global chart instance
        if (window.engagementChart) {
            window.engagementChart.destroy();
        }
        
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
        
        // Store reference globally for cleanup
        window.engagementChart = this.chart;
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

// ============================================
// SEARCH SYSTEM
// ============================================
class SearchSystem {
    constructor() {
        this.modal = null;
        this.searchInput = null;
        this.resultsGrid = null;
        this.currentResults = [];
        this.searchTimeout = null;
    }
    
    init() {
        this.modal = document.getElementById('search-modal');
        this.searchInput = document.getElementById('search-input');
        this.resultsGrid = document.getElementById('search-results-grid');
        this.setupEventListeners();
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
    }
    
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
            if (!query.trim()) {
                this.resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
                return;
            }
            
            this.resultsGrid.innerHTML = '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
            
            try {
                const category = document.getElementById('category-filter')?.value;
                const mediaType = document.getElementById('media-type-filter')?.value;
                const sortBy = document.getElementById('sort-filter')?.value;
                
                // Build SAFE where clause
                let whereClause = { status: 'published' };
                if (category) whereClause.genre = category;
                if (mediaType) whereClause.media_type = mediaType;
                
                // Get order by
                let orderBy = 'created_at';
                let order = 'desc';
                if (sortBy === 'oldest') {
                    order = 'asc';
                } else if (sortBy === 'popular' || sortBy === 'trending') {
                    orderBy = 'views';
                    order = 'desc';
                }
                
                // Fetch ALL published content with filters
                const results = await contentSupabase.query('Content', {
                    select: '*',
                    where: whereClause,
                    orderBy: orderBy,
                    order: order,
                    limit: 100
                });
                
                // CLIENT-SIDE SEARCH
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
        }, 300);
    }
    
    renderSearchResults(results) {
        if (results.length === 0) {
            this.resultsGrid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
            return;
        }
        
        this.resultsGrid.innerHTML = results.map(item => {
            const creatorName = item.creator || 
                              item.creator_display_name || 
                              item.user_profiles?.username || 
                              item.user_profiles?.full_name || 
                              'Creator';
            
            return `
                <div class="content-card" data-content-id="${item.id}" data-views="${item.views || 0}" data-likes="${item.likes || 0}">
                    <div class="card-thumbnail">
                        <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}"
                             alt="${item.title}"
                             loading="lazy"
                             onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                        <div class="thumbnail-overlay"></div>
                        <video class="video-preview" muted preload="metadata">
                            <source src="${item.file_url || ''}" type="video/mp4">
                        </video>
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
                                data-creator-id="${item.creator_id || item.user_id}"
                                data-creator-name="${creatorName}">
                            <i class="fas fa-user"></i>
                            ${creatorName.length > 15 ? creatorName.substring(0, 15) + '...' : creatorName}
                        </button>
                        <button class="tip-creator-btn"
                                data-creator-id="${item.creator_id || item.user_id}"
                                data-creator-name="${creatorName}"
                                title="Tip Creator">
                            <i class="fas fa-gift"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        this.setupSearchResultListeners();
    }
    
    setupSearchResultListeners() {
        this.resultsGrid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.creator-btn') ||
                    e.target.closest('.share-btn') ||
                    e.target.closest('.tip-creator-btn') ||
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
}

// ============================================
// CONTINUE WATCHING SYSTEM
// ============================================
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
        const allContent = stateManager?.state?.content || [];
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
        const creatorName = item.creator || 
                          item.creator_display_name || 
                          item.user_profiles?.username || 
                          item.user_profiles?.full_name || 
                          'Creator';
        
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
                            data-creator-id="${item.creator_id || item.user_id}"
                            data-creator-name="${creatorName}">
                        <i class="fas fa-user"></i>
                        ${creatorName.length > 15 ? creatorName.substring(0, 15) + '...' : creatorName}
                    </button>
                    <button class="tip-creator-btn"
                            data-creator-id="${item.creator_id || item.user_id}"
                            data-creator-name="${creatorName}"
                            title="Tip Creator">
                        <i class="fas fa-gift"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setupContinueWatchingCardListeners(grid) {
        grid.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.share-btn') || 
                    e.target.closest('.creator-btn') ||
                    e.target.closest('.tip-creator-btn')) {
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

// ============================================
// PROGRESS TRACKER
// ============================================
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

// ============================================
// SIDEBAR MENU FUNCTIONS (NEW)
// ============================================
function setupSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    // Open sidebar
    const openSidebar = () => {
        if (sidebarMenu) sidebarMenu.classList.add('active');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    };
    
    // Close sidebar
    const closeSidebar = () => {
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };
    
    // Event listeners
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu?.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    // Update sidebar profile
    updateSidebarProfile();
    
    // Setup sidebar navigation clicks
    setupSidebarNavigation();
    
    // Setup theme toggle in sidebar
    setupSidebarThemeToggle();
    
    // Setup scale controls in sidebar
    setupSidebarScaleControls();
    
    console.log('✅ Sidebar initialized');
}

function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');
    
    if (!avatar || !name || !email) return;
    
    if (window.currentUser) {
        name.textContent = window.currentUser.user_metadata?.full_name || window.currentUser.email?.split('@')[0] || 'User';
        email.textContent = window.currentUser.email || '';
        
        if (window.currentUser.user_metadata?.avatar_url) {
            avatar.innerHTML = `<img src="${fixMediaUrl(window.currentUser.user_metadata.avatar_url)}" alt="Profile">`;
        } else {
            const initials = getInitials(name.textContent);
            avatar.innerHTML = `<span>${initials}</span>`;
        }
        
        // Make profile clickable to manage profiles
        if (profileSection) {
            profileSection.addEventListener('click', () => {
                closeSidebar();
                window.location.href = 'manage-profiles.html';
            });
        }
    } else {
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        avatar.innerHTML = '<i class="fas fa-user"></i>';
        
        if (profileSection) {
            profileSection.addEventListener('click', () => {
                closeSidebar();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            });
        }
    }
}

function setupSidebarNavigation() {
    // Analytics
    document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
        if (!window.currentUser) {
            if (typeof toast !== 'undefined') toast.warning('Please sign in to view analytics');
            return;
        }
        const analyticsModal = document.getElementById('analytics-modal');
        if (analyticsModal) {
            analyticsModal.classList.add('active');
            if (typeof analyticsSystem?.updateAnalyticsDisplay === 'function') {
                analyticsSystem.updateAnalyticsDisplay();
            }
        }
    });
    
    // Notifications
    document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel) {
            notificationsPanel.classList.add('active');
            if (typeof notificationSystem?.renderNotifications === 'function') {
                notificationSystem.renderNotifications();
            }
        }
    });
    
    // Badges
    document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
        if (!window.currentUser) {
            if (typeof toast !== 'undefined') toast.warning('Please sign in to view badges');
            return;
        }
        const badgesModal = document.getElementById('badges-modal');
        if (badgesModal) {
            badgesModal.classList.add('active');
            if (typeof loadUserBadges === 'function') loadUserBadges();
        }
    });
    
    // Watch Party
    document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
        if (!window.currentUser) {
            if (typeof toast !== 'undefined') toast.warning('Please sign in to start a watch party');
            return;
        }
        const watchPartyModal = document.getElementById('watch-party-modal');
        if (watchPartyModal) {
            watchPartyModal.classList.add('active');
            if (typeof loadWatchPartyContent === 'function') loadWatchPartyContent();
        }
    });
    
    // Create (check auth)
    document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeSidebar();
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            if (typeof toast !== 'undefined') toast.warning('Please sign in to upload content');
            window.location.href = `login.html?redirect=creator-upload.html`;
        } else {
            window.location.href = 'creator-upload.html';
        }
    });
    
    // Dashboard (check auth)
    document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeSidebar();
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            if (typeof toast !== 'undefined') toast.warning('Please sign in to access dashboard');
            window.location.href = `login.html?redirect=creator-dashboard.html`;
        } else {
            window.location.href = 'creator-dashboard.html';
        }
    });
}

function setupSidebarThemeToggle() {
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    if (!themeToggle) return;
    
    themeToggle.addEventListener('click', () => {
        closeSidebar();
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.classList.toggle('active');
        }
    });
}

function setupSidebarScaleControls() {
    if (!window.uiScaleController) return;
    
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    
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

// Helper function to close sidebar (for use in navigation)
function closeSidebar() {
    const sidebarMenu = document.getElementById('sidebar-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarMenu) sidebarMenu.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================
// UI SCALE CONTROLLER (NEW)
// ============================================
class UIScaleController {
    constructor() {
        this.scaleKey = 'bantu_ui_scale';
        this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
        this.currentIndex = 2; // Default to 1.0
    }

    init() {
        const savedScale = localStorage.getItem(this.scaleKey);
        if (savedScale) {
            this.currentIndex = this.scales.indexOf(parseFloat(savedScale));
            if (this.currentIndex === -1) this.currentIndex = 2;
        }
        this.applyScale();
        this.setupEventListeners();
        console.log('🎨 UI Scale Controller initialized');
    }

    setupEventListeners() {
        const decreaseBtn = document.getElementById('scale-decrease');
        const increaseBtn = document.getElementById('scale-increase');
        const resetBtn = document.getElementById('scale-reset');

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => this.decrease());
        }

        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => this.increase());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
    }

    applyScale() {
        const scale = this.scales[this.currentIndex];
        document.documentElement.style.setProperty('--ui-scale', scale);
        localStorage.setItem(this.scaleKey, scale);
        this.updateScaleDisplay();
        // Dispatch event for other components to listen
        document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale } }));
        console.log(`📏 UI Scale set to: ${scale}x`);
    }

    updateScaleDisplay() {
        const scaleValue = document.getElementById('scale-value');
        const sidebarScaleValue = document.getElementById('sidebar-scale-value');
        const percentage = Math.round(this.getScale() * 100) + '%';
        
        if (scaleValue) scaleValue.textContent = percentage;
        if (sidebarScaleValue) sidebarScaleValue.textContent = percentage;
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
        const percentage = Math.round(this.getScale() * 100);
        if (typeof toast !== 'undefined') {
            toast.info(`UI Size: ${percentage}%`);
        }
    }

    // Respect system accessibility settings
    respectSystemSettings() {
        // Check for prefers-reduced-motion
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            console.log('♿ Reduced motion preference detected');
        }
        
        // Optional: Detect system font size
        const largeTextQuery = window.matchMedia('(min-resolution: 120dpi)');
        if (largeTextQuery.matches) {
            console.log('📱 System may have large text enabled');
        }
    }
}

// ============================================
// VIDEO HERO (NEW)
// ============================================
async function initVideoHero() {
    const heroVideo = document.getElementById('hero-video');
    const heroMuteBtn = document.getElementById('hero-mute-btn');
    const heroMuteBtnMobile = document.getElementById('hero-mute-btn-mobile');
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    
    if (!heroVideo) return;
    
    try {
        const client = getSupabaseClient();
        if (client) {
            const { data, error } = await client
                .from('Content')
                .select('*')
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(1);
            
            if (error) throw error;
            
            const trending = data || [];
            if (trending && trending.length > 0) {
                const featured = trending[0];
                const videoUrl = featured.preview_url || featured.file_url;
                
                if (videoUrl) {
                    heroVideo.src = fixMediaUrl(videoUrl);
                    heroVideo.poster = featured.thumbnail_url ? fixMediaUrl(featured.thumbnail_url) : '';
                    
                    // Set title and description (properly truncated)
                    heroTitle.textContent = featured.title || 'DISCOVER & CONNECT';
                    heroSubtitle.textContent = truncateText(featured.description || 'Explore amazing content from creators across Africa', 120);
                    
                    // Try to play (will fail on mobile without user interaction, that's okay)
                    heroVideo.play().catch(() => {
                        // Autoplay prevented - show mute button
                        if (heroMuteBtn) heroMuteBtn.style.display = 'flex';
                        if (heroMuteBtnMobile) heroMuteBtnMobile.style.display = 'flex';
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error loading hero video:', error);
    }
    
    // Mute toggle for desktop button
    if (heroMuteBtn) {
        heroMuteBtn.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            const icon = heroVideo.muted ? 'fa-volume-mute' : 'fa-volume-up';
            heroMuteBtn.innerHTML = `<i class="fas ${icon}"></i>`;
            if (heroMuteBtnMobile) heroMuteBtnMobile.innerHTML = `<i class="fas ${icon}"></i>`;
        });
    }
    
    // Mute toggle for mobile button
    if (heroMuteBtnMobile) {
        heroMuteBtnMobile.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            const icon = heroVideo.muted ? 'fa-volume-mute' : 'fa-volume-up';
            heroMuteBtnMobile.innerHTML = `<i class="fas ${icon}"></i>`;
            if (heroMuteBtn) heroMuteBtn.innerHTML = `<i class="fas ${icon}"></i>`;
        });
    }
}

// ============================================
// CONTENT METRICS LOADING (FIXED with cache safety)
// ============================================
async function loadContentMetrics(contentIds) {
    if (!contentIds || contentIds.length === 0) return;
    
    // Safety check: ensure cacheManager exists and has get method
    if (!window.cacheManager || typeof window.cacheManager.get !== 'function') {
        console.warn('⚠️ cacheManager not ready, skipping cache check');
        // Proceed without cache
    } else {
        // Check cache first
        const cacheKey = `metrics-${contentIds.sort().join(',')}`;
        const cached = window.cacheManager.get(cacheKey);
        if (cached) {
            cached.forEach(m => window.contentMetrics?.set(m.content_id, m));
            updateMetricsOnCards(contentIds);
            return;
        }
    }
    
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase not available for metrics');
            return;
        }
        
        // Batch load views, likes, and shares in parallel
        const [viewsResults, likesResults, sharesResults] = await Promise.all([
            Promise.all(contentIds.map(id => 
                client.from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', id)
            )),
            Promise.all(contentIds.map(id => 
                client.from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', id)
            )),
            Promise.all(contentIds.map(id => 
                client.from('content_shares')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', id)
            ).catch(() => contentIds.map(() => ({ count: 0 })))) // Fallback if table doesn't exist
        ]);
        
        // Build metrics map
        const metricsMap = new Map();
        
        viewsResults.forEach((r, i) => {
            const id = contentIds[i];
            if (!metricsMap.has(id)) metricsMap.set(id, {});
            metricsMap.get(id).views = r.count || 0;
        });
        
        likesResults.forEach((r, i) => {
            const id = contentIds[i];
            if (!metricsMap.has(id)) metricsMap.set(id, {});
            metricsMap.get(id).likes = r.count || 0;
        });
        
        sharesResults.forEach((r, i) => {
            const id = contentIds[i];
            if (!metricsMap.has(id)) metricsMap.set(id, {});
            metricsMap.get(id).shares = r.count || 0;
        });
        
        // Update global metrics cache
        metricsMap.forEach((metrics, id) => {
            if (!window.contentMetrics) window.contentMetrics = new Map();
            window.contentMetrics.set(id, metrics);
        });
        
        // Cache results if cacheManager is available
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            const cacheKey = `metrics-${contentIds.sort().join(',')}`;
            window.cacheManager.set(cacheKey, 
                Array.from(metricsMap.entries()).map(([k, v]) => ({ content_id: k, ...v })),
                3 * 60 * 1000 // 3 minute cache
            );
        }
        
        // Update UI
        updateMetricsOnCards(contentIds);
        
    } catch (error) {
        console.error('Error loading content metrics:', error);
    }
}

function updateMetricsOnCards(contentIds) {
    contentIds.forEach(id => {
        const card = document.querySelector(`.content-card[data-content-id="${id}"]`);
        if (!card) return;
        
        const metrics = window.contentMetrics?.get(id) || { views: 0, likes: 0, shares: 0 };
        
        // Update stats display
        const statsEl = card.querySelector('.card-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <span class="card-stat" title="Views">
                    <i class="fas fa-eye"></i> ${formatNumber(metrics.views)}
                </span>
                <span class="card-stat" title="Likes">
                    <i class="fas fa-heart"></i> ${formatNumber(metrics.likes)}
                </span>
                <span class="card-stat" title="Shares">
                    <i class="fas fa-share"></i> ${formatNumber(metrics.shares)}
                </span>
            `;
        }
        
        // Update meta display if exists
        const metaEl = card.querySelector('.card-meta');
        if (metaEl && metrics.views > 0) {
            metaEl.innerHTML = `
                <span><i class="fas fa-eye"></i> ${formatNumber(metrics.views)} views</span>
                <span><i class="fas fa-heart"></i> ${formatNumber(metrics.likes)} likes</span>
            `;
        }
    });
}

// ============================================
// Wait for core to be ready before using cacheManager
// ============================================
function waitForCacheManager(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (window.cacheManager && typeof window.cacheManager.get === 'function') {
                resolve(window.cacheManager);
            } else if (Date.now() - start > timeout) {
                console.warn('⚠️ cacheManager not ready after timeout');
                resolve(null); // Return null instead of rejecting to avoid crash
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ============================================
// CONTENT CARD RENDERING (With Metrics)
// ============================================
function createContentCardWithMetrics(item) {
    const metrics = window.contentMetrics?.get(item.id) || { 
        views: item.views || item.views_count || 0, 
        likes: item.likes || item.likes_count || 0, 
        shares: item.shares_count || 0 
    };
    
    const thumbnailUrl = item.thumbnail_url 
        ? fixMediaUrl(item.thumbnail_url) 
        : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    const creatorProfile = item.user_profiles;
    const creatorName = creatorProfile?.full_name || creatorProfile?.username || item.creator || 'Creator';
    const initials = getInitials(creatorName);
    
    let avatarHtml = '';
    if (creatorProfile?.avatar_url) {
        const avatarUrl = fixMediaUrl(creatorProfile.avatar_url);
        avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(creatorName)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'creator-initials-small\\'>${initials}</div>'">`;
    } else {
        avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
    }
    
    return `
        <a href="content-detail.html?id=${item.id}" class="content-card" 
           data-content-id="${item.id}" 
           data-language="${item.language || 'en'}"
           data-category="${item.genre || ''}">
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" 
                     alt="${escapeHtml(item.title)}" 
                     loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="card-badges">
                    ${item.is_new ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                    ${item.is_trending ? '<div class="card-badge badge-trending"><i class="fas fa-fire"></i> TRENDING</div>' : ''}
                </div>
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(item.title)}">
                    ${truncateText(escapeHtml(item.title), 50)}
                </h3>
                <div class="creator-info">
                    <div class="creator-avatar-small">${avatarHtml}</div>
                    <div class="creator-name-small">@${escapeHtml(creatorName.split(' ')[0].toLowerCase())}</div>
                </div>
                <div class="card-stats">
                    <span class="card-stat" title="Views">
                        <i class="fas fa-eye"></i> ${formatNumber(metrics.views)}
                    </span>
                    <span class="card-stat" title="Likes">
                        <i class="fas fa-heart"></i> ${formatNumber(metrics.likes)}
                    </span>
                    <span class="card-stat" title="Shares">
                        <i class="fas fa-share"></i> ${formatNumber(metrics.shares)}
                    </span>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-language"></i> ${languageMap[item.language] || 'English'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(item.created_at)}</span>
                </div>
            </div>
        </a>
    `;
}

// ============================================
// LANGUAGE FILTER SYSTEM
// ============================================
const languageMap = {
    'en': 'English',
    'zu': 'IsiZulu',
    'xh': 'IsiXhosa',
    'af': 'Afrikaans',
    'nso': 'Sepedi',
    'st': 'Sesotho',
    'tn': 'Setswana',
    'ss': 'siSwati',
    've': 'Tshivenda',
    'ts': 'Xitsonga',
    'nr': 'isiNdebele'
};

function setupLanguageFilter() {
    const languageChips = document.querySelectorAll('.language-chip');
    const moreLanguagesBtn = document.getElementById('more-languages-btn');
    let languageFilter = 'all';

    languageChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            languageFilter = chip.dataset.lang;
            filterContentByLanguage(languageFilter);
            const langName = getLanguageName(languageFilter);
            if (typeof toast !== 'undefined') {
                toast.info(`Showing: ${langName}`);
            }
        });
    });

    if (moreLanguagesBtn) {
        moreLanguagesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const languageContainer = document.querySelector('.language-chips');
            const hiddenLanguages = ['nr', 'ss', 've', 'ts'];
            hiddenLanguages.forEach(lang => {
                if (!document.querySelector(`.language-chip[data-lang="${lang}"]`)) {
                    const newChip = document.createElement('button');
                    newChip.className = 'language-chip';
                    newChip.dataset.lang = lang;
                    newChip.textContent = languageMap[lang] || lang;
                    newChip.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
                        newChip.classList.add('active');
                        languageFilter = lang;
                        filterContentByLanguage(lang);
                        if (typeof toast !== 'undefined') {
                            toast.info(`Showing: ${languageMap[lang]}`);
                        }
                    });
                    languageContainer.insertBefore(newChip, moreLanguagesBtn);
                }
            });
            moreLanguagesBtn.style.display = 'none';
            if (typeof toast !== 'undefined') {
                toast.info('All languages shown');
            }
        });
    }

    const defaultChip = document.querySelector('.language-chip[data-lang="all"]');
    if (defaultChip) {
        defaultChip.classList.add('active');
    }
}

function getLanguageName(code) {
    return languageMap[code] || code || 'All Languages';
}

function filterContentByLanguage(lang) {
    const contentCards = document.querySelectorAll('.content-card');
    let visibleCount = 0;

    contentCards.forEach(card => {
        const contentLang = card.dataset.language || 'en';
        if (lang === 'all' || contentLang === lang) {
            card.style.display = 'block';
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50);
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (visibleCount === 0 && lang !== 'all') {
        if (typeof toast !== 'undefined') {
            toast.warning(`No content in ${getLanguageName(lang)} yet`);
        }
    }
}

// ============================================
// COMMUNITY STATS
// ============================================
async function loadCommunityStats() {
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase not available, using mock stats');
            updateMockStats();
            return;
        }

        // Get total connectors
        const { count: connectorsCount, error: connError } = await client
            .from('connectors')
            .select('*', { count: 'exact', head: true });
        if (connError) throw connError;

        // Get total content
        const { count: contentCount, error: contentError } = await client
            .from('Content')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');
        if (contentError) throw contentError;

        // Get new connectors today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: newConnectors, error: newError } = await client
            .from('connectors')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());
        if (newError) throw newError;

        // Update UI
        document.getElementById('total-connectors').textContent = formatNumber(connectorsCount || 12500);
        document.getElementById('total-content').textContent = formatNumber(contentCount || 2300);
        document.getElementById('new-connectors').textContent = `+${formatNumber(newConnectors || 342)}`;
    } catch (error) {
        console.error('Error loading community stats:', error);
        updateMockStats();
    }
}

function updateMockStats() {
    document.getElementById('total-connectors').textContent = '12.5K';
    document.getElementById('total-content').textContent = '2.3K';
    document.getElementById('new-connectors').textContent = '+342';
}

// ============================================
// SHORTS SECTION
// ============================================
async function loadShorts() {
    try {
        const container = document.getElementById('shorts-container');
        if (!container) return;

        const client = getSupabaseClient();
        let shorts = [];

        if (client) {
            const { data, error } = await client
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .eq('media_type', 'short')
                .or('media_type.eq.short,duration.lte.60')
                .order('views_count', { ascending: false })
                .limit(10);

            if (error) throw error;
            shorts = data || [];
        }

        // Fallback mock shorts if no data
        if (shorts.length === 0) {
            shorts = getMockShorts();
        }

        if (shorts.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = shorts.map(short => {
            const thumbnailUrl = short.thumbnail_url ? fixMediaUrl(short.thumbnail_url) :
                'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
            const creatorProfile = short.user_profiles;
            const creatorName = creatorProfile?.full_name || creatorProfile?.username || short.creator || 'Creator';

            return `
                <a href="content-detail.html?id=${short.id}" class="short-card">
                    <div class="short-thumbnail">
                        <img src="${thumbnailUrl}" alt="${escapeHtml(short.title)}" loading="lazy">
                        <div class="short-overlay">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                    <div class="short-info">
                        <h4>${truncateText(escapeHtml(short.title), 30)}</h4>
                        <p>${escapeHtml(creatorName)}</p>
                    </div>
                </a>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading shorts:', error);
    }
}

function getMockShorts() {
    return [
        {
            id: 'short1',
            title: 'Quick African Dance Tutorial',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop',
            creator: 'Dance Africa'
        },
        {
            id: 'short2',
            title: '1-Minute Recipe: Jollof Rice',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop',
            creator: 'Tasty Africa'
        },
        {
            id: 'short3',
            title: 'African Wildlife in 60 Seconds',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop',
            creator: 'Wild Africa'
        },
        {
            id: 'short4',
            title: 'Learn Zulu Greetings',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop',
            creator: 'Language Lessons'
        }
    ];
}

// ============================================
// BADGES SYSTEM
// ============================================
async function initBadgesSystem() {
    const badgesModal = document.getElementById('badges-modal');
    const closeBadges = document.getElementById('close-badges');

    if (!badgesModal) return;

    if (closeBadges) {
        closeBadges.addEventListener('click', () => {
            badgesModal.classList.remove('active');
        });
    }

    // Add badges button to navigation if not exists
    let badgesBtn = document.getElementById('nav-badges-btn');
    if (!badgesBtn) {
        const navContainer = document.querySelector('.navigation-button');
        if (navContainer) {
            badgesBtn = document.createElement('div');
            badgesBtn.className = 'nav-icon';
            badgesBtn.id = 'nav-badges-btn';
            badgesBtn.innerHTML = '<i class="fas fa-medal"></i>';
            badgesBtn.title = 'My Badges';
            navContainer.appendChild(badgesBtn);
        }
    }

    if (badgesBtn) {
        badgesBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                if (typeof toast !== 'undefined') {
                    toast.warning('Please sign in to view your badges');
                }
                return;
            }
            badgesModal.classList.add('active');
            loadUserBadges();
        });
    }

    // Click outside to close
    badgesModal.addEventListener('click', (e) => {
        if (e.target === badgesModal) {
            badgesModal.classList.remove('active');
        }
    });
}

async function loadUserBadges() {
    if (!window.currentUser) return;

    try {
        const client = getSupabaseClient();
        let userBadges = [];

        if (client) {
            const { data, error } = await client
                .from('user_badges')
                .select('*')
                .eq('user_id', window.currentUser.id);

            if (error) throw error;
            userBadges = data || [];
        }

        const allBadges = [
            { id: 'music', name: 'Music Explorer', icon: 'fa-music', description: 'Watched 5+ music videos', requirement: 5 },
            { id: 'stem', name: 'STEM Seeker', icon: 'fa-microscope', description: 'Explored 5+ STEM videos', requirement: 5 },
            { id: 'culture', name: 'Cultural Curator', icon: 'fa-drum', description: 'Explored 5+ Culture videos', requirement: 5 },
            { id: 'news', name: 'News Junkie', icon: 'fa-newspaper', description: 'Watched 5+ news videos', requirement: 5 },
            { id: 'sports', name: 'Sports Fanatic', icon: 'fa-futbol', description: 'Watched 5+ sports videos', requirement: 5 },
            { id: 'movies', name: 'Movie Buff', icon: 'fa-film', description: 'Watched 5+ movies', requirement: 5 },
            { id: 'docs', name: 'Documentary Lover', icon: 'fa-clapperboard', description: 'Watched 5+ documentaries', requirement: 5 },
            { id: 'podcasts', name: 'Podcast Pro', icon: 'fa-podcast', description: 'Listened to 5+ podcasts', requirement: 5 },
            { id: 'shorts', name: 'Quick Bites Master', icon: 'fa-bolt', description: 'Watched 10+ shorts', requirement: 10 },
            { id: 'connector', name: 'Social Butterfly', icon: 'fa-handshake', description: 'Connected with 10+ creators', requirement: 10 },
            { id: 'polyglot', name: 'Language Explorer', icon: 'fa-language', description: 'Watched content in 3+ languages', requirement: 3 }
        ];

        const badgesGrid = document.getElementById('badges-grid');
        const badgesEarned = document.getElementById('badges-earned');

        badgesGrid.innerHTML = allBadges.map(badge => {
            const earned = userBadges.some(b => b.badge_name === badge.name);
            return `
                <div class="badge-item ${earned ? 'earned' : 'locked'}">
                    <div class="badge-icon ${earned ? 'earned' : ''}">
                        <i class="fas ${badge.icon}"></i>
                    </div>
                    <div class="badge-info">
                        <h4>${badge.name}</h4>
                        <p>${badge.description}</p>
                        ${earned ?
                            `<span class="badge-earned-date">Earned!</span>` :
                            `<span class="badge-requirement">Watch ${badge.requirement} videos</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        if (badgesEarned) {
            badgesEarned.textContent = userBadges.length;
        }
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// ============================================
// TIP SYSTEM
// ============================================
function setupTipSystem() {
    const tipModal = document.getElementById('tip-modal');
    const closeTip = document.getElementById('close-tip');
    const sendTip = document.getElementById('send-tip');

    if (!tipModal) return;

    // Add tip buttons to creator cards
    document.addEventListener('click', (e) => {
        if (e.target.closest('.tip-creator-btn')) {
            const btn = e.target.closest('.tip-creator-btn');
            const creatorId = btn.dataset.creatorId;
            const creatorName = btn.dataset.creatorName;
            openTipModal(creatorId, creatorName);
        }
    });

    if (closeTip) {
        closeTip.addEventListener('click', () => {
            tipModal.classList.remove('active');
        });
    }

    // Tip amount selection
    document.querySelectorAll('.tip-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const customAmount = document.getElementById('custom-amount');
            if (btn.dataset.amount === 'custom') {
                customAmount.style.display = 'block';
            } else {
                customAmount.style.display = 'none';
            }
        });
    });

    if (sendTip) {
        sendTip.addEventListener('click', async () => {
            const selectedOption = document.querySelector('.tip-option.selected');
            if (!selectedOption) {
                if (typeof toast !== 'undefined') {
                    toast.warning('Please select an amount');
                }
                return;
            }

            let amount = selectedOption.dataset.amount;
            if (amount === 'custom') {
                amount = document.getElementById('custom-tip-amount').value;
                if (!amount || amount < 1) {
                    if (typeof toast !== 'undefined') {
                        toast.warning('Please enter a valid amount');
                    }
                    return;
                }
            }

            const message = document.getElementById('tip-message').value;
            const creatorId = tipModal.dataset.creatorId;

            if (!window.currentUser) {
                if (typeof toast !== 'undefined') {
                    toast.warning('Please sign in to send tips');
                }
                return;
            }

            try {
                const client = getSupabaseClient();
                if (client) {
                    const { error } = await client
                        .from('tips')
                        .insert({
                            sender_id: window.currentUser.id,
                            recipient_id: creatorId,
                            amount: parseFloat(amount),
                            message: message,
                            status: 'completed'
                        });

                    if (error) throw error;
                }

                if (typeof toast !== 'undefined') {
                    toast.success('Thank you for supporting this creator!');
                }
                tipModal.classList.remove('active');

                // Reset form
                document.getElementById('tip-message').value = '';
                document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
                document.getElementById('custom-amount').style.display = 'none';
            } catch (error) {
                console.error('Error sending tip:', error);
                if (typeof toast !== 'undefined') {
                    toast.error('Failed to send tip');
                }
            }
        });
    }

    // Click outside to close
    tipModal.addEventListener('click', (e) => {
        if (e.target === tipModal) {
            tipModal.classList.remove('active');
        }
    });
}

function openTipModal(creatorId, creatorName) {
    const tipModal = document.getElementById('tip-modal');
    const creatorInfo = document.getElementById('tip-creator-info');

    tipModal.dataset.creatorId = creatorId;
    creatorInfo.innerHTML = `
        <h3>${escapeHtml(creatorName)}</h3>
        <p>Show your appreciation with a tip</p>
    `;

    tipModal.classList.add('active');
}

// ============================================
// VOICE SEARCH
// ============================================
function setupVoiceSearch() {
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const voiceStatus = document.getElementById('voice-search-status');
    const voiceStatusText = document.getElementById('voice-status-text');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (voiceSearchBtn) voiceSearchBtn.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-ZA';

    const startVoiceSearch = () => {
        if (!window.currentUser) {
            if (typeof toast !== 'undefined') {
                toast.warning('Please sign in to use voice search');
            }
            return;
        }
        recognition.start();
        if (voiceStatus) {
            voiceStatus.classList.add('active');
            voiceStatusText.textContent = 'Listening...';
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = transcript;
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
        }
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
        }
        if (typeof toast !== 'undefined') {
            toast.info(`Searching: "${transcript}"`);
        }
    };

    recognition.onerror = (event) => {
        console.error('Voice search error:', event.error);
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
        }
        if (event.error === 'not-allowed') {
            if (typeof toast !== 'undefined') {
                toast.error('Microphone access denied');
            }
        }
    };

    recognition.onend = () => {
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
        }
    };

    if (voiceSearchBtn) {
        voiceSearchBtn.addEventListener('click', startVoiceSearch);
    }
}

// ============================================
// Guard: Wait for core to initialize before proceeding
// ============================================
(function waitForCore() {
    if (typeof window.cacheManager === 'undefined' || typeof window.cacheManager.get !== 'function') {
        console.log('⏳ Waiting for core.js to initialize cacheManager...');
        setTimeout(waitForCore, 100);
        return;
    }
    console.log('✅ Core ready, initializing features...');
    // The rest of initialization happens in initializeAllFeatures()
})();

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
        return '';
    }
}

function getInitials(name) {
    if (!name || name.trim() === '') return '?';
    const names = name.trim().split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
}

function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.includes('supabase.co')) return url;
    return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

// ============================================
// SAFETY CHECK & HELPER FUNCTIONS
// ============================================
// Wait for supabaseAuth to be available
if (typeof supabaseAuth === 'undefined') {
  console.error('❌ supabaseAuth not loaded yet. Check script order in index.html');
}

// Helper to ensure we use the correct Supabase client
function getSupabaseClient() {
  if (typeof supabaseAuth !== 'undefined' && supabaseAuth?.from) {
    return supabaseAuth;
  }
  if (typeof window.supabaseAuth !== 'undefined' && window.supabaseAuth?.from) {
    return window.supabaseAuth;
  }
  console.error('❌ Supabase client not found! Check initialization order.');
  return null;
}

// Debug helper
console.log('🔍 supabaseAuth available:', typeof supabaseAuth, supabaseAuth?.from ? '✓' : '✗');

// ============================================
// INITIALIZE ALL FEATURES
// ============================================
function initializeAllFeatures() {
    console.log('🚀 Initializing all Home Feed features...');
    
    // Initialize existing systems
    if (typeof videoPreviewSystem !== 'undefined') {
        videoPreviewSystem.init();
    }
    
    if (typeof recommendationEngine !== 'undefined') {
        recommendationEngine.init();
    }
    
    if (typeof notificationSystem !== 'undefined') {
        notificationSystem.init();
    }
    
    if (typeof analyticsSystem !== 'undefined') {
        analyticsSystem.init();
    }
    
    if (typeof searchSystem !== 'undefined') {
        searchSystem.init();
    }
    
    if (typeof continueWatchingSystem !== 'undefined') {
        continueWatchingSystem.init();
    }
    
    // Initialize NEW features
    if (typeof setupLanguageFilter === 'function') {
        setupLanguageFilter();
    }
    
    if (typeof loadCommunityStats === 'function') {
        loadCommunityStats();
    }
    
    if (typeof initVideoHero === 'function') {
        initVideoHero();
    }
    
    if (typeof loadShorts === 'function') {
        loadShorts();
    }
    
    if (typeof initBadgesSystem === 'function') {
        initBadgesSystem();
    }
    
    if (typeof setupTipSystem === 'function') {
        setupTipSystem();
    }
    
    if (typeof setupVoiceSearch === 'function') {
        setupVoiceSearch();
    }
    
    // Initialize Sidebar
    if (typeof setupSidebar === 'function') {
        setupSidebar();
    }
    
    // Initialize UI Scale Controller
    if (typeof UIScaleController !== 'undefined') {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    console.log('✅ All features initialized');
}

// ============================================
// CREATE AND EXPORT INSTANCES
// ============================================
// Create all instances
const videoPreviewSystem = new VideoPreviewSystem();
const recommendationEngine = new RecommendationEngine();
const notificationSystem = new NotificationSystem();
const analyticsSystem = new AnalyticsSystem();
const searchSystem = new SearchSystem();
const continueWatchingSystem = new ContinueWatchingSystem();
const progressTracker = new ProgressTracker();

// ============================================
// GLOBAL EXPORTS (Required for UI systems)
// ============================================
// Ensure these instances are available globally
window.notificationSystem = notificationSystem;
window.analyticsSystem = analyticsSystem;
window.searchSystem = searchSystem;
window.continueWatchingSystem = continueWatchingSystem;
window.videoPreviewSystem = videoPreviewSystem;
window.recommendationEngine = recommendationEngine;

// Export new features
window.uiScaleController = window.uiScaleController || new UIScaleController();
window.setupSidebar = typeof setupSidebar === 'function' ? setupSidebar : null;
window.initVideoHero = typeof initVideoHero === 'function' ? initVideoHero : null;
window.loadContentMetrics = typeof loadContentMetrics === 'function' ? loadContentMetrics : null;
window.createContentCardWithMetrics = typeof createContentCardWithMetrics === 'function' ? createContentCardWithMetrics : null;
window.waitForCacheManager = typeof waitForCacheManager === 'function' ? waitForCacheManager : null;

// Create global cache manager and content metrics
window.cacheManager = new CacheManager();
window.contentMetrics = new Map();

console.log('✅ Home Feed Features exported globally');

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAllFeatures);
} else {
    initializeAllFeatures();
}
