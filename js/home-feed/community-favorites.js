/**
 * Community Favorites Module
 * Displays content most loved by the community based on favorites count,
 * with regional preferences and social proof indicators.
 */

const CommunityFavorites = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    let communityStats = null;
    
    // Configuration
    const CACHE_KEY = 'feed_communityFavorites';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const MAX_ITEMS = 12;
    const REFRESH_INTERVAL = 300000; // 5 minutes
    
    // South African regions for regional boosting
    const SA_REGIONS = {
        'Gauteng': ['johannesburg', 'pretoria', 'gauteng'],
        'Western Cape': ['cape town', 'stellenbosch', 'western cape'],
        'KwaZulu-Natal': ['durban', 'pietermaritzburg', 'kwazulu-natal'],
        'Eastern Cape': ['port elizabeth', 'east london', 'eastern cape'],
        'Free State': ['bloemfontein', 'free state'],
        'Mpumalanga': ['nelspruit', 'mpumalanga'],
        'Limpopo': ['polokwane', 'limpopo'],
        'North West': ['mahikeng', 'north west'],
        'Northern Cape': ['kimberley', 'northern cape']
    };
    
    /**
     * Initialize Community Favorites module
     */
    async function init() {
        console.log('⭐ Community Favorites Module initializing...');
        
        section = document.getElementById('community-favorites-section');
        container = document.getElementById('community-favorites-grid');
        
        if (!section || !container) {
            console.warn('Community Favorites elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load community stats
        await loadCommunityStats();
        
        // Add community stats bar
        addCommunityStatsBar();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Add community tooltip
        addCommunityTooltip();
        
        // Start background refresh
        startBackgroundRefresh();
        
        console.log('✅ Community Favorites Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('community-favorites-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'community-favorites-section';
            newSection.className = 'section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-handshake" style="color: var(--warm-gold);"></i>
                        COMMUNITY FAVORITES
                        <span class="community-badge">
                            <i class="fas fa-users"></i> Community Picks
                        </span>
                    </h2>
                    <a href="#" class="see-all-btn" id="see-all-community">
                        See All
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="community-favorites-stats" class="community-favorites-stats"></div>
                <div class="content-grid" id="community-favorites-grid"></div>
            `;
            
            const waveletsSection = document.getElementById('wavelets-section');
            if (waveletsSection && waveletsSection.parentNode) {
                waveletsSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('community-favorites-section');
        container = document.getElementById('community-favorites-grid');
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
            console.log('👤 Community Favorites user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load community statistics
     */
    async function loadCommunityStats() {
        try {
            if (!window.supabaseAuth) return;
            
            // Get total favorites across platform
            const { data: favoritesData } = await window.supabaseAuth
                .from('Content')
                .select('favorites_count')
                .eq('status', 'published');
            
            const totalFavorites = favoritesData?.reduce((sum, item) => sum + (item.favorites_count || 0), 0) || 0;
            
            // Get unique connectors count
            const { count: connectorsCount } = await window.supabaseAuth
                .from('connectors')
                .select('*', { count: 'exact', head: true });
            
            // Get today's active users (simplified)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { count: todayActive } = await window.supabaseAuth
                .from('content_views')
                .select('profile_id', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());
            
            communityStats = {
                totalFavorites: totalFavorites,
                connectorsCount: connectorsCount || 0,
                todayActive: todayActive || 0,
                lastUpdated: Date.now()
            };
            
            console.log('📊 Community Stats loaded:', communityStats);
            
        } catch (err) {
            console.error('Error loading community stats:', err);
            communityStats = {
                totalFavorites: 12500,
                connectorsCount: 12500,
                todayActive: 342,
                lastUpdated: Date.now()
            };
        }
    }
    
    /**
     * Add community stats bar
     */
    function addCommunityStatsBar() {
        const statsContainer = document.getElementById('community-favorites-stats');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="community-stat-item">
                <i class="fas fa-heart"></i>
                <div>
                    <div class="stat-value">${formatNumber(communityStats?.totalFavorites || 0)}</div>
                    <div class="stat-label">Total Favorites</div>
                </div>
            </div>
            <div class="community-stat-item">
                <i class="fas fa-users"></i>
                <div>
                    <div class="stat-value">${formatNumber(communityStats?.connectorsCount || 0)}</div>
                    <div class="stat-label">Community Members</div>
                </div>
            </div>
            <div class="community-stat-item">
                <i class="fas fa-user-plus"></i>
                <div>
                    <div class="stat-value">+${formatNumber(communityStats?.todayActive || 0)}</div>
                    <div class="stat-label">Active Today</div>
                </div>
            </div>
            <div class="community-stat-item">
                <i class="fas fa-map-pin"></i>
                <div>
                    <div class="stat-value">11</div>
                    <div class="stat-label">Languages</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Load community favorites content
     */
    async function loadContent() {
        console.log('⭐ Loading Community Favorites...');
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Community Favorites: Using cached data,', cachedData.length, 'items');
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
            const contentList = await fetchCommunityFavorites();
            
            if (!contentList || contentList.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            let sectionData = await buildSectionData(contentList);
            
            // Apply community boost logic
            sectionData = applyCommunityBoost(sectionData);
            
            // Sort by favorites count (highest first)
            sectionData.sort((a, b) => (b.metrics?.favorites || 0) - (a.metrics?.favorites || 0));
            
            // Add rank to top items
            sectionData = addRanks(sectionData);
            
            // Render
            container.innerHTML = '';
            renderCards(sectionData);
            
            // Cache the result
            saveToCache(sectionData);
            
            // Animate cards
            animateCards();
            
            console.log('✅ Community Favorites loaded:', sectionData.length, 'items');
            
        } catch (err) {
            console.error("❌ Community Favorites Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch community favorites from Supabase
     */
    async function fetchCommunityFavorites() {
        try {
            // Fetch content with favorites_count > 0, ordered by favorites_count
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url, bio, location
                    )
                `)
                .eq('status', 'published')
                .gt('favorites_count', 0)
                .order('favorites_count', { ascending: false })
                .limit(MAX_ITEMS);
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching community favorites:', err);
            return [];
        }
    }
    
    /**
     * Apply community boost logic
     */
    function applyCommunityBoost(items) {
        return items.map(item => {
            let score = (item.metrics?.favorites || 0) * 10 +
                       (item.metrics?.views || 0) +
                       ((item.metrics?.connectors || 0) * 5);
            
            let boostReason = null;
            
            // Boost local South African creators
            if (item.user_profiles?.location) {
                const location = item.user_profiles.location.toLowerCase();
                for (const [region, keywords] of Object.entries(SA_REGIONS)) {
                    if (keywords.some(kw => location.includes(kw))) {
                        score = score * 1.25;
                        boostReason = `Popular in ${region}`;
                        break;
                    }
                }
            }
            
            // Boost local language content
            const localLanguages = ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af'];
            if (localLanguages.includes(item.language)) {
                score = score * 1.2;
                boostReason = boostReason ? `${boostReason} + Local language` : 'Local language favorite';
            }
            
            // Top performer badge
            let rankBadge = null;
            if (item.metrics?.favorites > 1000) {
                rankBadge = 'community-champion';
            } else if (item.metrics?.favorites > 500) {
                rankBadge = 'community-star';
            } else if (item.metrics?.favorites > 100) {
                rankBadge = 'community-rising';
            }
            
            return {
                ...item,
                community_score: score,
                boost_reason: boostReason,
                rank_badge: rankBadge
            };
        });
    }
    
    /**
     * Add rank numbers to top items
     */
    function addRanks(items) {
        return items.map((item, index) => ({
            ...item,
            rank: index + 1
        }));
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
     * Render community favorite cards
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
            const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
            const durationFormatted = formatDuration(content.duration || 0);
            const favoriteCount = content.metrics?.favorites || 0;
            const rank = content.rank;
            
            // Determine rank class
            let rankClass = '';
            let rankIcon = '';
            if (rank === 1) {
                rankClass = 'top-1';
                rankIcon = '👑';
            } else if (rank === 2) {
                rankClass = 'top-2';
                rankIcon = '🥈';
            } else if (rank === 3) {
                rankClass = 'top-3';
                rankIcon = '🥉';
            }
            
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
            
            // Boost reason tooltip
            const boostTooltip = content.boost_reason ? 
                `<div class="community-rank ${rankClass}" title="Community favorite: ${content.boost_reason}">
                    ${rankIcon} #${rank}
                 </div>` :
                `<div class="community-rank ${rankClass}">
                    ${rankIcon} #${rank}
                 </div>`;
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                        <div class="card-badge favorite-badge">
                            <i class="fas fa-star"></i> ${formatNumber(favoriteCount)} Favorites
                        </div>
                    </div>
                    ${boostTooltip}
                    <div class="card-favorite-count">
                        <i class="fas fa-heart"></i> ${formatNumber(favoriteCount)}
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
                        ${creatorProfile?.location ? `<span class="creator-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(creatorProfile.location)}</span>` : ''}
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                        <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                        <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                        <span><i class="fas fa-language"></i> ${getLanguageName(content.language)}</span>
                    </div>
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                    </div>
                    ${content.genre ? `<div class="genre-tags"><span class="genre-tag">${escapeHtml(content.genre)}</span></div>` : ''}
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
    }
    
    /**
     * Get language name from code
     */
    function getLanguageName(code) {
        const languageMap = {
            'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'af': 'Afrikaans',
            'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
            've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
        };
        return languageMap[code] || code || 'English';
    }
    
    /**
     * Animate cards with stagger effect
     */
    function animateCards() {
        const cards = document.querySelectorAll('#community-favorites-grid .content-card');
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
                <div class="empty-icon"><i class="fas fa-heart-broken"></i></div>
                <h3>No Community Favorites Yet</h3>
                <p>Be the first to favorite content and help build our community!</p>
                <button class="see-all-btn" id="explore-favorites-btn" style="margin-top: 16px;">
                    <i class="fas fa-fire"></i> Explore Trending
                </button>
            </div>
        `;
        
        const exploreBtn = document.getElementById('explore-favorites-btn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/trending_screen';
            });
        }
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Unable to Load Community Favorites</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-community');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://bantustreamconnect.com/community-favorites';
            });
        }
    }
    
    /**
     * Add community tooltip to section title
     */
    function addCommunityTooltip() {
        const sectionTitle = document.querySelector('#community-favorites-section .section-title');
        if (!sectionTitle) return;
        
        // Check if tooltip already exists
        if (sectionTitle.querySelector('.community-stats-tooltip')) return;
        
        const tooltipSpan = document.createElement('span');
        tooltipSpan.className = 'community-stats-tooltip';
        tooltipSpan.innerHTML = `
            <i class="fas fa-info-circle" style="font-size: 14px; color: var(--slate-grey);"></i>
            <span class="tooltip-text">
                Based on total favorites across the Bantu community.
                ${communityStats?.totalFavorites ? `Over ${formatNumber(communityStats.totalFavorites)} total favorites given!` : ''}
            </span>
        `;
        
        sectionTitle.appendChild(tooltipSpan);
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            await loadCommunityStats();
            addCommunityStatsBar();
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
        if (window.cacheManager && typeof window.cacheManager.get === 'function') {
            return window.cacheManager.get(CACHE_KEY);
        }
        
        try {
            const cached = localStorage.getItem(CACHE_KEY);
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
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            window.cacheManager.set(CACHE_KEY, data, CACHE_TTL);
        }
        
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
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
        await loadCommunityStats();
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
        console.log('⭐ Community Favorites Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CommunityFavorites.init());
} else {
    CommunityFavorites.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommunityFavorites;
}
