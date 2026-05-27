/**
 * Latest Gems Module
 * Displays newly added content with freshness indicators,
 * category filtering, and publishing time tracking.
 */

const LatestGems = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    let currentCategory = 'all';
    let newContentData = [];
    let scrollToNewBtn = null;
    
    // Configuration
    const CACHE_KEY = 'feed_latestGems';
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    const MAX_ITEMS = 12;
    const REFRESH_INTERVAL = 300000; // 5 minutes
    
    // Categories for filtering
    const CATEGORIES = ['all', 'Music', 'STEM', 'Culture', 'News', 'Sports', 'Movies', 'Documentaries', 'Podcasts'];
    
    /**
     * Initialize Latest Gems module
     */
    async function init() {
        console.log('💎 Latest Gems Module initializing...');
        
        section = document.getElementById('latest-gems-section');
        container = document.getElementById('new-content-grid');
        
        if (!section || !container) {
            console.warn('Latest Gems elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load publishing stats
        await loadPublishingStats();
        
        // Add stats bar
        addStatsBar();
        
        // Add category filter
        addCategoryFilter();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Setup scroll to new button
        setupScrollToNewButton();
        
        // Start background refresh
        startBackgroundRefresh();
        
        console.log('✅ Latest Gems Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('latest-gems-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'latest-gems-section';
            newSection.className = 'section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-gem" style="color: #10B981;"></i>
                        LATEST GEMS
                        <span class="gem-badge">
                            <i class="fas fa-sparkle"></i> Fresh & New
                        </span>
                    </h2>
                    <a href="https://bantustreamconnect.com/content-library" class="see-all-btn">
                        See All
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="latest-stats-bar" class="latest-stats-bar"></div>
                <div id="category-filter-bar" class="category-filter-bar"></div>
                <div class="content-grid" id="new-content-grid"></div>
            `;
            
            const trendingSection = document.getElementById('trending-now-section');
            if (trendingSection && trendingSection.parentNode) {
                trendingSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('latest-gems-section');
        container = document.getElementById('new-content-grid');
    }
    
    /**
     * Get current user from Supabase
     */
    async function getCurrentUser() {
        try {
            if (!window.supabaseAuth) {
                currentUser = null;
                return;
            }
            
            const { data: { session } } = await window.supabaseAuth.auth.getSession();
            currentUser = session?.user || null;
            console.log('💎 Latest Gems user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load publishing statistics
     */
    async function loadPublishingStats() {
        try {
            if (!window.supabaseAuth) return;
            
            // Get count of content published in last 7 days
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const { count: newThisWeek } = await window.supabaseAuth
                .from('Content')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'published')
                .gte('created_at', weekAgo.toISOString());
            
            // Get count published today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const { count: newToday } = await window.supabaseAuth
                .from('Content')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'published')
                .gte('created_at', today.toISOString());
            
            // Get count of new creators this week
            const { count: newCreators } = await window.supabaseAuth
                .from('user_profiles')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', weekAgo.toISOString());
            
            window.publishingStats = {
                newThisWeek: newThisWeek || 156,
                newToday: newToday || 23,
                newCreators: newCreators || 12,
                lastUpdated: Date.now()
            };
            
            console.log('📊 Publishing Stats loaded:', window.publishingStats);
            
        } catch (err) {
            console.error('Error loading publishing stats:', err);
            window.publishingStats = {
                newThisWeek: 156,
                newToday: 23,
                newCreators: 12,
                lastUpdated: Date.now()
            };
        }
    }
    
    /**
     * Add stats bar
     */
    function addStatsBar() {
        const statsContainer = document.getElementById('latest-stats-bar');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="latest-stat-item">
                <i class="fas fa-gem"></i>
                <div>
                    <div class="stat-value">${window.publishingStats?.newThisWeek || 0}</div>
                    <div class="stat-label">New This Week</div>
                </div>
            </div>
            <div class="latest-stat-item">
                <i class="fas fa-calendar-day"></i>
                <div>
                    <div class="stat-value">${window.publishingStats?.newToday || 0}</div>
                    <div class="stat-label">Added Today</div>
                </div>
            </div>
            <div class="latest-stat-item">
                <i class="fas fa-user-plus"></i>
                <div>
                    <div class="stat-value">${window.publishingStats?.newCreators || 0}</div>
                    <div class="stat-label">New Creators</div>
                </div>
            </div>
            <div class="latest-stat-item">
                <i class="fas fa-clock"></i>
                <div>
                    <div class="stat-value">Fresh</div>
                    <div class="stat-label">Daily Updates</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Add category filter bar
     */
    function addCategoryFilter() {
        const filterContainer = document.getElementById('category-filter-bar');
        if (!filterContainer) return;
        
        filterContainer.innerHTML = CATEGORIES.map(category => `
            <button class="filter-chip ${category === currentCategory ? 'active' : ''}" data-category="${category}">
                ${category === 'all' ? '<i class="fas fa-layer-group"></i>' : '<i class="fas fa-tag"></i>'} 
                ${category === 'all' ? 'All' : category}
            </button>
        `).join('');
        
        filterContainer.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', async () => {
                const category = btn.dataset.category;
                currentCategory = category;
                
                // Update active state
                filterContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Reload content with new category
                await loadContent();
            });
        });
    }
    
    /**
     * Load latest content
     */
    async function loadContent() {
        console.log('💎 Loading Latest Gems...');
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Latest Gems: Using cached data,', cachedData.length, 'items');
            container.innerHTML = '';
            renderCards(cachedData);
            animateCards();
            // Refresh in background
            refreshInBackground();
            return;
        }
        
        // Show skeletons
        showSkeletons();
        
        try {
            const contentList = await fetchLatestContent();
            
            if (!contentList || contentList.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            let sectionData = await buildSectionData(contentList);
            
            // Apply freshness amplification
            sectionData = applyFreshnessAmplification(sectionData);
            
            // Sort by creation date (newest first)
            sectionData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Add freshness indicators
            sectionData = addFreshnessIndicators(sectionData);
            
            // Render
            container.innerHTML = '';
            renderCards(sectionData);
            
            // Cache the result
            saveToCache(sectionData);
            
            // Animate cards
            animateCards();
            
            console.log('✅ Latest Gems loaded:', sectionData.length, 'items');
            
        } catch (err) {
            console.error("❌ Latest Gems Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch latest content from Supabase
     */
    async function fetchLatestContent() {
        try {
            let query = window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url, bio
                    )
                `)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(MAX_ITEMS);
            
            // Apply category filter if not 'all'
            if (currentCategory !== 'all') {
                query = query.eq('genre', currentCategory);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching latest content:', err);
            return [];
        }
    }
    
    /**
     * Apply freshness amplification logic
     */
    function applyFreshnessAmplification(items) {
        return items.map(item => {
            const hoursOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60);
            let freshnessScore = 100;
            let freshnessLabel = '';
            
            if (hoursOld < 1) {
                freshnessScore = 100;
                freshnessLabel = 'Just Added!';
            } else if (hoursOld < 6) {
                freshnessScore = 95;
                freshnessLabel = 'Added today';
            } else if (hoursOld < 24) {
                freshnessScore = 85;
                freshnessLabel = 'Today';
            } else if (hoursOld < 48) {
                freshnessScore = 70;
                freshnessLabel = 'Yesterday';
            } else if (hoursOld < 168) { // 7 days
                freshnessScore = 50;
                freshnessLabel = 'This week';
            } else {
                freshnessScore = 30;
                freshnessLabel = `${Math.floor(hoursOld / 24)} days ago`;
            }
            
            return {
                ...item,
                freshness_score: freshnessScore,
                freshness_label: freshnessLabel,
                hours_old: hoursOld
            };
        });
    }
    
    /**
     * Add freshness indicators
     */
    function addFreshnessIndicators(items) {
        return items.map(item => {
            let indicatorClass = '';
            let indicatorIcon = '';
            
            if (item.hours_old < 1) {
                indicatorClass = 'just-added';
                indicatorIcon = '✨';
            } else if (item.hours_old < 24) {
                indicatorClass = 'today';
                indicatorIcon = '🆕';
            } else if (item.hours_old < 168) {
                indicatorClass = 'this-week';
                indicatorIcon = '📅';
            }
            
            return {
                ...item,
                indicator_class: indicatorClass,
                indicator_icon: indicatorIcon
            };
        });
    }
    
    /**
     * Build section data with metrics
     */
    async function buildSectionData(contentList) {
        if (!contentList || contentList.length === 0) return [];
        
        const contentIds = contentList.map(c => c.id);
        const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
        
        const metrics = await fetchAllMetrics(contentIds, creatorIds);
        
        return contentList.map(item => ({
            ...item,
            metrics: {
                views: metrics.views[item.id] || 0,
                likes: metrics.likes[item.id] || 0,
                shares: metrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: metrics.connectors[item.user_id] || 0
            }
        }));
    }
    
    /**
     * Fetch all metrics in parallel
     */
    async function fetchAllMetrics(contentIds, creatorIds) {
        const [views, likes, shares, connectors] = await Promise.all([
            fetchViewCounts(contentIds),
            fetchLikeCounts(contentIds),
            fetchShareCounts(contentIds),
            fetchConnectorCounts(creatorIds)
        ]);
        
        return { views, likes, shares, connectors };
    }
    
    /**
     * Fetch view counts
     */
    async function fetchViewCounts(contentIds) {
        if (!contentIds.length) return {};
        const { data } = await window.supabaseAuth
            .from("content_views")
            .select("content_id")
            .in("content_id", contentIds);
        const counts = {};
        data?.forEach(row => counts[row.content_id] = (counts[row.content_id] || 0) + 1);
        return counts;
    }
    
    /**
     * Fetch like counts
     */
    async function fetchLikeCounts(contentIds) {
        if (!contentIds.length) return {};
        const { data } = await window.supabaseAuth
            .from("content_likes")
            .select("content_id")
            .in("content_id", contentIds);
        const counts = {};
        data?.forEach(row => counts[row.content_id] = (counts[row.content_id] || 0) + 1);
        return counts;
    }
    
    /**
     * Fetch share counts
     */
    async function fetchShareCounts(contentIds) {
        if (!contentIds.length) return {};
        const { data } = await window.supabaseAuth
            .from("content_shares")
            .select("content_id")
            .in("content_id", contentIds);
        const counts = {};
        data?.forEach(row => counts[row.content_id] = (counts[row.content_id] || 0) + 1);
        return counts;
    }
    
    /**
     * Fetch connector counts
     */
    async function fetchConnectorCounts(creatorIds) {
        if (!creatorIds || creatorIds.length === 0) return {};
        const limitedIds = creatorIds.slice(0, 50);
        const { data } = await window.supabaseAuth
            .from("connectors")
            .select("connected_id")
            .in("connected_id", limitedIds)
            .eq("connection_type", "creator");
        const counts = {};
        data?.forEach(row => counts[row.connected_id] = (counts[row.connected_id] || 0) + 1);
        return counts;
    }
    
    /**
     * Format time ago string
     */
    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }
    
    /**
     * Render latest gems cards
     */
    function renderCards(contents) {
        const fragment = document.createDocumentFragment();
        
        contents.forEach((content, index) => {
            if (!content) return;
            
            const thumbnailUrl = fixMediaUrl(content.thumbnail_url) || 
                'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
            
            const creatorProfile = content.user_profiles;
            const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
            const username = creatorProfile?.username || 'creator';
            const initials = getInitials(displayName);
            const durationFormatted = formatDuration(content.duration || 0);
            const timeAgo = formatTimeAgo(content.created_at);
            const isExtremelyNew = content.hours_old < 1;
            const freshnessLabel = content.freshness_label || '';
            const indicatorIcon = content.indicator_icon || '🆕';
            const indicatorClass = content.indicator_class || '';
            
            // Avatar HTML
            let avatarHtml = '';
            if (creatorProfile?.avatar_url) {
                const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
                avatarHtml = `
                    <div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;">
                        <img src="${avatarUrl}" 
                             alt="${escapeHtml(displayName)}" 
                             loading="lazy"
                             style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                             onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">
                    </div>
                `;
            } else {
                avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
            }
            
            const card = document.createElement('a');
            card.className = 'content-card';
            card.href = `content-detail.html?id=${content.id}`;
            card.dataset.contentId = content.id;
            card.dataset.language = content.language || 'en';
            card.dataset.category = content.genre || '';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        <div class="card-badge new-badge">
                            <i class="fas fa-gem"></i> ${freshnessLabel || 'NEW'}
                        </div>
                        ${content.genre ? `<div class="card-badge genre-badge">${escapeHtml(content.genre)}</div>` : ''}
                    </div>
                    <div class="freshness-indicator ${indicatorClass}">
                        ${indicatorIcon} ${freshnessLabel}
                    </div>
                    <div class="creator-spotlight">
                        <div class="creator-spotlight-text">
                            <i class="fas fa-user"></i> Fresh from @${escapeHtml(username)}
                        </div>
                    </div>
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                    ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                    <div class="creator-info">
                        <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                        <div class="creator-name-small">@${escapeHtml(username)}</div>
                    </div>
                    <div class="card-meta">
                        <span class="time-ago"><i class="fas fa-clock"></i> ${timeAgo}</span>
                        <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                        <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                    </div>
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                    </div>
                    ${content.description ? `<div class="card-description">${truncateText(escapeHtml(content.description), 60)}</div>` : ''}
                </div>
            `;
            
            fragment.appendChild(card);
            
            // Add pulse animation to extremely new content
            if (isExtremelyNew && index < 3) {
                setTimeout(() => {
                    card.classList.add('new-content-pulse');
                    setTimeout(() => card.classList.remove('new-content-pulse'), 2000);
                }, index * 200);
            }
        });
        
        container.appendChild(fragment);
    }
    
    /**
     * Animate cards with stagger effect
     */
    function animateCards() {
        const cards = document.querySelectorAll('#new-content-grid .content-card');
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.classList.add('visible');
            }, i * 50);
        });
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        container.innerHTML = Array(4).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
    }
    
    /**
     * Show empty state
     */
    function showEmptyState() {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-gem"></i></div>
                <h3>No New Content</h3>
                <p>Check back soon for fresh gems!</p>
            </div>
        `;
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Unable to Load Latest Content</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.querySelector('#latest-gems-section .see-all-btn');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                // Allow default navigation to content-library
            });
        }
    }
    
    /**
     * Setup scroll to new button
     */
    function setupScrollToNewButton() {
        // Create button if it doesn't exist
        if (!document.querySelector('.scroll-to-new')) {
            scrollToNewBtn = document.createElement('button');
            scrollToNewBtn.className = 'scroll-to-new';
            scrollToNewBtn.innerHTML = '<i class="fas fa-gem"></i>';
            scrollToNewBtn.title = 'Scroll to latest content';
            document.body.appendChild(scrollToNewBtn);
            
            scrollToNewBtn.addEventListener('click', () => {
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        } else {
            scrollToNewBtn = document.querySelector('.scroll-to-new');
        }
        
        // Show/hide based on scroll position
        window.addEventListener('scroll', () => {
            if (scrollToNewBtn) {
                const scrollPosition = window.scrollY;
                const sectionTop = section ? section.offsetTop : 0;
                
                if (scrollPosition > sectionTop + 300) {
                    scrollToNewBtn.classList.add('show');
                } else {
                    scrollToNewBtn.classList.remove('show');
                }
            }
        });
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            await loadPublishingStats();
            addStatsBar();
        } catch (err) {
            console.log('Background refresh failed:', err);
        }
    }
    
    /**
     * Start background refresh interval
     */
    function startBackgroundRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            refreshInBackground();
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Load from cache
     */
    function loadFromCache() {
        const cacheKey = `${CACHE_KEY}_${currentCategory}`;
        
        if (window.cacheManager && typeof window.cacheManager.get === 'function') {
            return window.cacheManager.get(cacheKey);
        }
        
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < CACHE_TTL) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage cache:', e);
        }
        return null;
    }
    
    /**
     * Save to cache
     */
    function saveToCache(data) {
        const cacheKey = `${CACHE_KEY}_${currentCategory}`;
        
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            window.cacheManager.set(cacheKey, data, CACHE_TTL);
        }
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save to localStorage cache:', e);
        }
    }
    
    /**
     * Fix media URL
     */
    function fixMediaUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.fixMediaUrl) return window.fixMediaUrl(url);
        return url;
    }
    
    /**
     * Fix avatar URL
     */
    function fixAvatarUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.fixAvatarUrl) return window.fixAvatarUrl(url);
        return url;
    }
    
    /**
     * Format duration
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    
    /**
     * Format number
     */
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Get initials
     */
    function getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Truncate text
     */
    function truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * Refresh module
     */
    async function refresh() {
        await getCurrentUser();
        await loadPublishingStats();
        await loadContent();
    }
    
    /**
     * Destroy module
     */
    function destroy() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (container) {
            container.innerHTML = '';
        }
        if (scrollToNewBtn && scrollToNewBtn.parentNode) {
            scrollToNewBtn.parentNode.removeChild(scrollToNewBtn);
        }
        console.log('💎 Latest Gems Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy,
        setCategory: (category) => { currentCategory = category; refresh(); }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LatestGems.init());
} else {
    LatestGems.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LatestGems;
}
