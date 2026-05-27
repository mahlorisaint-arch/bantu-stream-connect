/**
 * For You Module
 * Handles personalized content recommendations based on user preferences,
 * viewing history, and likes with amplification logic for local content.
 */

const ForYou = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let currentUser = null;
    let refreshInterval = null;
    let userPreferences = null;
    
    // Configuration
    const CACHE_KEY = 'feed_forYou';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const MAX_ITEMS = 12;
    const DISPLAY_ITEMS = 8;
    const REFRESH_INTERVAL = 300000; // 5 minutes
    
    // South African languages for amplification
    const LOCAL_LANGUAGES = ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af'];
    
    /**
     * Initialize For You module
     */
    async function init() {
        console.log('🎯 For You Module initializing...');
        
        container = document.getElementById('for-you-grid');
        
        if (!container) {
            console.warn('For You container not found');
            return;
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load user preferences
        await loadUserPreferences();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Add personalization tooltip
        addPersonalizationTooltip();
        
        // Start background refresh
        startBackgroundRefresh();
        
        console.log('✅ For You Module initialized');
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
            
            if (currentUser) {
                console.log('👤 User authenticated for For You:', currentUser.id);
                await loadUserProfile();
            } else {
                console.log('👤 No user logged in for For You');
            }
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load user profile data
     */
    async function loadUserProfile() {
        try {
            const { data: profile } = await window.supabaseAuth
                .from('user_profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            if (profile) {
                currentUser.profile = profile;
            }
        } catch (err) {
            console.warn('Could not load user profile:', err);
        }
    }
    
    /**
     * Load user preferences from likes and watch history
     */
    async function loadUserPreferences() {
        if (!currentUser) {
            userPreferences = null;
            return;
        }
        
        try {
            // Get user's liked content
            const { data: likedContent } = await window.supabaseAuth
                .from('content_likes')
                .select('content_id')
                .eq('user_id', currentUser.id)
                .limit(30);
            
            const likedIds = (likedContent || []).map(l => l.content_id);
            
            // Get genres from liked content
            let genres = [];
            let languages = [];
            
            if (likedIds.length > 0) {
                const { data: likedGenres } = await window.supabaseAuth
                    .from('Content')
                    .select('genre, language')
                    .in('id', likedIds.slice(0, 15));
                
                if (likedGenres) {
                    genres = [...new Set(likedGenres.map(g => g.genre).filter(Boolean))];
                    languages = [...new Set(likedGenres.map(g => g.language).filter(Boolean))];
                }
            }
            
            // Get watch history for additional signals
            const { data: watchHistory } = await window.supabaseAuth
                .from('watch_progress')
                .select('content_id, total_watch_time')
                .eq('user_id', currentUser.id)
                .limit(30);
            
            const watchedIds = (watchHistory || []).map(w => w.content_id);
            
            // Get genres from watched content
            if (watchedIds.length > 0 && genres.length < 3) {
                const { data: watchedGenres } = await window.supabaseAuth
                    .from('Content')
                    .select('genre, language')
                    .in('id', watchedIds.slice(0, 15));
                
                if (watchedGenres) {
                    const additionalGenres = [...new Set(watchedGenres.map(g => g.genre).filter(Boolean))];
                    genres = [...new Set([...genres, ...additionalGenres])];
                    
                    const additionalLanguages = [...new Set(watchedGenres.map(g => g.language).filter(Boolean))];
                    languages = [...new Set([...languages, ...additionalLanguages])];
                }
            }
            
            userPreferences = {
                genres: genres.slice(0, 5),
                languages: languages.slice(0, 3),
                hasPreferences: genres.length > 0 || languages.length > 0,
                lastUpdated: Date.now()
            };
            
            console.log('📊 User Preferences loaded:', userPreferences);
            
        } catch (err) {
            console.error('Error loading user preferences:', err);
            userPreferences = { hasPreferences: false };
        }
    }
    
    /**
     * Load content (with caching)
     */
    async function loadContent() {
        const startTime = performance.now();
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 For You: Using cached data,', cachedData.length, 'items');
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
            let contentList = [];
            
            if (currentUser && userPreferences?.hasPreferences) {
                // Personalized recommendations based on user preferences
                contentList = await getPersonalizedRecommendations();
            }
            
            // Fallback to trending if no personalized content
            if (contentList.length === 0) {
                console.log('No personalized content, falling back to trending');
                contentList = await getTrendingFallback();
            }
            
            if (contentList.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            let sectionData = await buildSectionData(contentList.slice(0, DISPLAY_ITEMS));
            
            // Apply Amplification Logic
            sectionData = applyAmplificationLogic(sectionData);
            
            // Sort by amplification score
            sectionData.sort((a, b) => (b.amplification_score || 0) - (a.amplification_score || 0));
            
            // Render
            container.innerHTML = '';
            renderCards(sectionData);
            
            // Cache the result
            saveToCache(sectionData);
            
            // Animate cards
            animateCards();
            
            const loadTime = performance.now() - startTime;
            console.log(`📊 For You section loaded in ${loadTime.toFixed(0)}ms`);
            
        } catch (err) {
            console.error("❌ For You Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Get personalized recommendations based on user preferences
     */
    async function getPersonalizedRecommendations() {
        let contentList = [];
        
        try {
            // Build query based on user's preferred genres
            let query = window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('status', 'published');
            
            // Filter by preferred genres
            if (userPreferences.genres && userPreferences.genres.length > 0) {
                query = query.in('genre', userPreferences.genres.slice(0, 3));
            }
            
            // Order by views and favorites
            const { data } = await query
                .order('views_count', { ascending: false })
                .limit(MAX_ITEMS);
            
            contentList = data || [];
            
            // If we don't have enough, add some trending content
            if (contentList.length < DISPLAY_ITEMS) {
                const trendingIds = contentList.map(c => c.id);
                const { data: trendingData } = await window.supabaseAuth
                    .from('Content')
                    .select(`
                        id, title, description, thumbnail_url, duration, 
                        genre, language, created_at, views_count, favorites_count, 
                        user_id, user_profiles!user_id (
                            id, full_name, username, avatar_url
                        )
                    `)
                    .eq('status', 'published')
                    .not('id', 'in', `(${trendingIds.join(',')})`)
                    .order('views_count', { ascending: false })
                    .limit(DISPLAY_ITEMS - contentList.length);
                
                if (trendingData) {
                    contentList = [...contentList, ...trendingData];
                }
            }
            
        } catch (err) {
            console.error('Error getting personalized recommendations:', err);
        }
        
        return contentList;
    }
    
    /**
     * Get trending content as fallback
     */
    async function getTrendingFallback() {
        try {
            const { data } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(DISPLAY_ITEMS);
            
            return data || [];
        } catch (err) {
            console.error('Error getting trending fallback:', err);
            return [];
        }
    }
    
    /**
     * Apply amplification logic to boost relevant content
     */
    function applyAmplificationLogic(items) {
        return items.map(item => {
            let score = 0;
            
            // Base score from metrics
            const baseScore = (item.metrics?.views || 0) + 
                             ((item.metrics?.likes || 0) * 5) + 
                             ((item.metrics?.shares || 0) * 10);
            
            score = baseScore;
            
            // 1. Local Language Boost (IsiZulu, IsiXhosa, etc.)
            if (LOCAL_LANGUAGES.includes(item.language)) {
                score = score * 1.3;
                item.boost_reason = 'Local language content';
            }
            
            // 2. Emerging Creator Boost (< 1000 connectors)
            if (item.metrics?.connectors < 1000) {
                score = score * 1.2;
                item.boost_reason = item.boost_reason ? 
                    `${item.boost_reason} + Emerging creator` : 'Emerging creator';
            }
            
            // 3. Freshness Boost (< 7 days old)
            const daysOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
            if (daysOld < 7) {
                score = score * 1.4;
                item.boost_reason = item.boost_reason ? 
                    `${item.boost_reason} + Fresh content` : 'Fresh content';
            }
            
            // 4. Genre Match Boost (if matches user preferences)
            if (userPreferences?.genres?.includes(item.genre)) {
                score = score * 1.25;
                item.boost_reason = item.boost_reason ? 
                    `${item.boost_reason} + Matches your interests` : 'Matches your interests';
            }
            
            return { 
                ...item, 
                amplification_score: score,
                metrics: {
                    ...item.metrics,
                    base_score: baseScore
                }
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
     * Render content cards
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
            
            // Determine recommendation score class
            let scoreClass = 'low';
            let scoreValue = Math.round((content.amplification_score || 0) / 1000);
            if (scoreValue > 100) scoreClass = 'high';
            else if (scoreValue > 50) scoreClass = 'medium';
            
            // Avatar HTML with error handling
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
            const boostReasonHtml = content.boost_reason ? 
                `<div class="recommendation-score ${scoreClass}" title="Why this is recommended: ${content.boost_reason}">
                    <i class="fas fa-magic"></i> ${scoreValue > 0 ? scoreValue : 'Pick'}
                 </div>` : '';
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                        <div class="connector-badge"><i class="fas fa-star"></i><span>${formatNumber(content.metrics?.favorites || 0)} Favorites</span></div>
                    </div>
                    ${boostReasonHtml}
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
        const cards = document.querySelectorAll('#for-you-grid .content-card');
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.classList.add('visible');
                
                // Add recommended animation to top card
                if (i === 0) {
                    card.classList.add('recommended');
                    setTimeout(() => card.classList.remove('recommended'), 1500);
                }
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
     * Show empty state with personalization CTA
     */
    function showEmptyState() {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-magic"></i></div>
                <h3>No Recommendations Yet</h3>
                <p>Start watching and liking content to get personalized picks just for you!</p>
                <div class="action-buttons">
                    <button class="cta-btn" id="explore-trending-btn">
                        <i class="fas fa-fire"></i> Explore Trending
                    </button>
                    <button class="cta-btn" id="discover-creators-btn">
                        <i class="fas fa-user-plus"></i> Discover Creators
                    </button>
                </div>
            </div>
        `;
        
        const exploreBtn = document.getElementById('explore-trending-btn');
        const discoverBtn = document.getElementById('discover-creators-btn');
        
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/trending_screen';
            });
        }
        
        if (discoverBtn) {
            discoverBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/discover-creator';
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
                <h3>Unable to Load Recommendations</h3>
                <p>Please check your connection and try again.</p>
                <button class="cta-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-for-you');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://bantustreamconnect.com/for-you';
            });
        }
    }
    
    /**
     * Add personalization tooltip to section title
     */
    function addPersonalizationTooltip() {
        const sectionTitle = document.querySelector('#for-you-section .section-title');
        if (!sectionTitle) return;
        
        // Check if tooltip already exists
        if (sectionTitle.querySelector('.personalization-tooltip')) return;
        
        const tooltipSpan = document.createElement('span');
        tooltipSpan.className = 'personalization-tooltip';
        tooltipSpan.innerHTML = `
            <i class="fas fa-info-circle" style="font-size: 14px; color: var(--slate-grey);"></i>
            <span class="tooltip-text">
                Based on your watch history and likes. 
                ${userPreferences?.hasPreferences ? 
                    `We found ${userPreferences.genres?.length || 0} genres you enjoy.` : 
                    'Watch and like content to get better recommendations!'}
            </span>
        `;
        
        sectionTitle.appendChild(tooltipSpan);
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            // Refresh user preferences first
            await loadUserPreferences();
            
            // Then refresh content
            await loadContent();
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
        await loadUserPreferences();
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
        console.log('🎯 For You Module destroyed');
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
    document.addEventListener('DOMContentLoaded', () => ForYou.init());
} else {
    ForYou.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForYou;
}
