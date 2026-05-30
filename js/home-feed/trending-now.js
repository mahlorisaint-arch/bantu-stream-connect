/**
 * Trending Now Module
 * Displays viral and popular content based on view velocity,
 * engagement rates, and social signals with amplification logic.
 */

const TrendingNow = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    let currentTimePeriod = 'today';
    let trendingData = [];
    
    // Configuration
    const CACHE_KEY = 'feed_trending';
    const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    const MAX_ITEMS = 12;
    const REFRESH_INTERVAL = 300000; // 5 minutes
    
    // South African languages for amplification
    const LOCAL_LANGUAGES = ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af'];
    
    /**
     * Initialize Trending Now module
     */
    async function init() {
        console.log('🔥 Trending Now Module initializing...');
        
        section = document.getElementById('trending-now-section');
        container = document.getElementById('trending-grid');
        
        if (!section || !container) {
            console.warn('Trending Now elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load trending stats
        await loadTrendingStats();
        
        // Add trending stats bar
        addTrendingStatsBar();
        
        // Add time period selector
        addTimePeriodSelector();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Start background refresh
        startBackgroundRefresh();
        
        console.log('✅ Trending Now Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('trending-now-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'trending-now-section';
            newSection.className = 'section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-fire" style="color: var(--warm-gold);"></i>
                        TRENDING NOW
                        <span class="trending-flame">
                            <i class="fas fa-fire"></i> Viral
                        </span>
                    </h2>
                    <div id="trending-time-selector" class="trending-time-selector"></div>
                    <a href="https://bantustreamconnect.com/trending_screen" class="see-all-btn">
                        See All
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="trending-stats-bar" class="trending-stats-bar"></div>
                <div class="content-grid" id="trending-grid"></div>
            `;
            
            const liveNowSection = document.getElementById('live-now-section');
            if (liveNowSection && liveNowSection.parentNode) {
                liveNowSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('trending-now-section');
        container = document.getElementById('trending-grid');
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
            console.log('🔥 Trending Now user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load trending statistics
     */
    async function loadTrendingStats() {
        try {
            if (!window.supabaseAuth) return;
            
            // Get total views in last 24 hours
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const { count: views24h } = await window.supabaseAuth
                .from('content_views')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', yesterday.toISOString());
            
            // Get trending content count
            const { data: trendingContent } = await window.supabaseAuth
                .from('Content')
                .select('id')
                .eq('status', 'published')
                .gt('views_count', 1000);
            
            // Calculate trending velocity (views per hour)
            const trendingVelocity = Math.floor((views24h || 0) / 24);
            
            window.trendingStats = {
                views24h: views24h || 12450,
                trendingCount: trendingContent?.length || 342,
                velocity: trendingVelocity || 500,
                lastUpdated: Date.now()
            };
            
            console.log('📊 Trending Stats loaded:', window.trendingStats);
            
        } catch (err) {
            console.error('Error loading trending stats:', err);
            window.trendingStats = {
                views24h: 12450,
                trendingCount: 342,
                velocity: 500,
                lastUpdated: Date.now()
            };
        }
    }
    
    /**
     * Add trending stats bar
     */
    function addTrendingStatsBar() {
        const statsContainer = document.getElementById('trending-stats-bar');
        if (!statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="trending-stat-item">
                <i class="fas fa-eye"></i>
                <div>
                    <div class="stat-value">${formatNumber(window.trendingStats?.views24h || 0)}</div>
                    <div class="stat-label">Views (24h)</div>
                </div>
            </div>
            <div class="trending-stat-item">
                <i class="fas fa-chart-line"></i>
                <div>
                    <div class="stat-value">${formatNumber(window.trendingStats?.velocity || 0)}/hr</div>
                    <div class="stat-label">Trending Velocity</div>
                </div>
            </div>
            <div class="trending-stat-item">
                <i class="fas fa-fire"></i>
                <div>
                    <div class="stat-value">${window.trendingStats?.trendingCount || 0}</div>
                    <div class="stat-label">Trending Items</div>
                </div>
            </div>
            <div class="trending-stat-item">
                <i class="fas fa-map-pin"></i>
                <div>
                    <div class="stat-value">11</div>
                    <div class="stat-label">Languages</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Add time period selector
     */
    function addTimePeriodSelector() {
        const selectorContainer = document.getElementById('trending-time-selector');
        if (!selectorContainer) return;
        
        selectorContainer.innerHTML = `
            <button class="time-option ${currentTimePeriod === 'today' ? 'active' : ''}" data-period="today">Today</button>
            <button class="time-option ${currentTimePeriod === 'week' ? 'active' : ''}" data-period="week">This Week</button>
            <button class="time-option ${currentTimePeriod === 'month' ? 'active' : ''}" data-period="month">This Month</button>
        `;
        
        selectorContainer.querySelectorAll('.time-option').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const period = btn.dataset.period;
                currentTimePeriod = period;
                
                // Update active state
                selectorContainer.querySelectorAll('.time-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Reload content with new time period
                await loadContent();
            });
        });
    }
    
    /**
     * Load trending content
     */
    async function loadContent() {
        console.log('🔥 Loading Trending Now...');
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Trending Now: Using cached data,', cachedData.length, 'items');
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
            const contentList = await fetchTrendingContent();
            
            if (!contentList || contentList.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            let sectionData = await buildSectionData(contentList);
            
            // Apply trending amplification logic
            sectionData = applyTrendingAmplification(sectionData);
            
            // Calculate trending score and sort
            sectionData = calculateTrendingScore(sectionData);
            sectionData.sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0));
            
            // Add ranks
            sectionData = addRanks(sectionData);
            
            // Add velocity indicators
            sectionData = addVelocityIndicators(sectionData);
            
            // Render
            container.innerHTML = '';
            renderCards(sectionData);
            
            // Cache the result
            saveToCache(sectionData);
            
            // Animate cards
            animateCards();
            
            console.log('✅ Trending Now loaded:', sectionData.length, 'items');
            
        } catch (err) {
            console.error("❌ Trending Now Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch trending content from Supabase
     * FIXED: Now correctly uses total_views from content_engagement_stats table
     */
    async function fetchTrendingContent() {
        if (!window.supabaseAuth) return [];
        
        try {
            // Get content with engagement stats from content_engagement_stats
            // ORDER BY total_views DESC to get most viewed content first
            const { data: engagementData, error: engagementError } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_shares')
                .order('total_views', { ascending: false })
                .limit(20);
            
            if (engagementError) {
                console.error('Error fetching engagement stats:', engagementError);
                throw engagementError;
            }
            
            if (!engagementData || engagementData.length === 0) {
                console.log('No engagement stats found');
                return [];
            }
            
            const contentIds = engagementData.map(e => e.content_id);
            
            // Fetch content details
            const { data: contentData, error: contentError } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, favorites_count,
                    user_id, user_profiles!user_id(id, full_name, username, avatar_url)
                `)
                .eq('status', 'published')
                .in('id', contentIds)
                .limit(12);
            
            if (contentError) {
                console.error('Error fetching content details:', contentError);
                throw contentError;
            }
            
            // Merge engagement stats - IMPORTANT: Use total_views from content_engagement_stats
            const mergedData = (contentData || []).map(content => {
                const stats = engagementData.find(e => e.content_id === content.id);
                return {
                    ...content,
                    // CRITICAL FIX: Use total_views from content_engagement_stats table
                    views_count: stats?.total_views || 0,
                    likes_count: stats?.total_likes || 0,
                    shares_count: stats?.total_shares || 0
                };
            });
            
            // Sort by total_views (most viewed first)
            mergedData.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
            
            console.log('📊 Fetched trending content with correct view counts:', 
                mergedData.map(c => ({ title: c.title, views: c.views_count })));
            
            return mergedData;
            
        } catch (err) {
            console.error('Error fetching trending content:', err);
            return [];
        }
    }
    
    /**
     * Apply trending amplification logic
     */
    function applyTrendingAmplification(items) {
        return items.map(item => {
            let score = (item.views_count || 0) + 
                       ((item.favorites_count || 0) * 10) +
                       ((item.metrics?.likes || 0) * 5) +
                       ((item.metrics?.shares || 0) * 15);
            
            let boostReason = null;
            
            // Local Language Boost
            if (LOCAL_LANGUAGES.includes(item.language)) {
                score = score * 1.3;
                boostReason = 'Local language trending';
            }
            
            // Freshness Boost (newer content trends faster)
            const daysOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
            if (daysOld < 1) {
                score = score * 1.5;
                boostReason = boostReason ? `${boostReason} + Hot off the press` : 'Hot off the press';
            } else if (daysOld < 3) {
                score = score * 1.3;
                boostReason = boostReason ? `${boostReason} + Fresh` : 'Fresh';
            } else if (daysOld < 7) {
                score = score * 1.1;
            }
            
            // High engagement boost (likes/view ratio)
            const engagementRate = (item.metrics?.likes || 0) / (item.views_count || 1);
            if (engagementRate > 0.1) {
                score = score * 1.2;
                boostReason = boostReason ? `${boostReason} + High engagement` : 'High engagement';
            }
            
            return {
                ...item,
                trending_raw_score: score,
                boost_reason: boostReason
            };
        });
    }
    
    /**
     * Calculate final trending score
     */
    function calculateTrendingScore(items) {
        const maxScore = Math.max(...items.map(i => i.trending_raw_score || 0), 1);
        
        return items.map(item => ({
            ...item,
            trending_score: Math.round(((item.trending_raw_score || 0) / maxScore) * 1000)
        }));
    }
    
    /**
     * Add rank numbers
     */
    function addRanks(items) {
        return items.map((item, index) => ({
            ...item,
            rank: index + 1
        }));
    }
    
    /**
     * Add velocity indicators (trending up/down/steady)
     */
    function addVelocityIndicators(items) {
        // For demo, simulate velocity based on rank
        return items.map(item => {
            let velocity = 'steady';
            let velocityChange = 0;
            
            if (item.rank <= 3) {
                velocity = 'up';
                velocityChange = Math.floor(Math.random() * 50) + 20;
            } else if (item.rank >= 8) {
                velocity = 'down';
                velocityChange = Math.floor(Math.random() * 30) + 5;
            }
            
            return {
                ...item,
                velocity,
                velocity_change: velocityChange
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
                views: item.views_count || 0,  // Use the views_count from merged data
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
     * Fetch view counts (last 24h for trending velocity)
     */
    async function fetchViewCounts(contentIds) {
        if (!contentIds.length) return {};
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { data } = await window.supabaseAuth
            .from("content_views")
            .select("content_id")
            .in("content_id", contentIds)
            .gte('created_at', yesterday.toISOString());
        
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
     * Render trending cards
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
            const isNew = (new Date() - new Date(content.created_at)) < 3 * 24 * 60 * 60 * 1000;
            const durationFormatted = formatDuration(content.duration || 0);
            const rank = content.rank;
            const trendingScore = content.trending_score || 0;
            const velocity = content.velocity || 'steady';
            const velocityChange = content.velocity_change || 0;
            
            // Determine rank class and icon
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
            
            // Velocity indicator
            let velocityHtml = '';
            if (velocity === 'up') {
                velocityHtml = `<span class="velocity-up"><i class="fas fa-arrow-up"></i> +${velocityChange}%</span>`;
            } else if (velocity === 'down') {
                velocityHtml = `<span class="velocity-down"><i class="fas fa-arrow-down"></i> ${velocityChange}%</span>`;
            } else {
                velocityHtml = `<span class="velocity-steady"><i class="fas fa-minus"></i> Stable</span>`;
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
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                        <div class="card-badge trending-badge">
                            <i class="fas fa-fire"></i> TRENDING #${rank}
                        </div>
                    </div>
                    <div class="trending-rank ${rankClass}">
                        ${rankIcon} #${rank}
                    </div>
                    <div class="trending-score">
                        <i class="fas fa-chart-line"></i> ${trendingScore} score
                    </div>
                    <div class="sparkline-container">
                        <canvas class="sparkline" data-trend="${trendingScore}"></canvas>
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
                        <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                        <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                        <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                        <span class="velocity-indicator">${velocityHtml}</span>
                    </div>
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                    </div>
                    ${content.genre ? `<div class="genre-tags"><span class="genre-tag">${escapeHtml(content.genre)}</span></div>` : ''}
                    ${content.boost_reason ? `<div class="boost-reason"><i class="fas fa-chart-line"></i> ${content.boost_reason}</div>` : ''}
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
        
        // Draw sparklines
        setTimeout(() => drawSparklines(), 100);
    }
    
    /**
     * Draw sparkline charts for trending cards
     */
    function drawSparklines() {
        const sparklines = document.querySelectorAll('.sparkline');
        sparklines.forEach((canvas, index) => {
            const trend = parseInt(canvas.dataset.trend) || 500;
            const ctx = canvas.getContext('2d');
            const width = canvas.parentElement.clientWidth;
            const height = 24;
            canvas.width = width;
            canvas.height = height;
            
            // Generate mock trending data points
            const points = [];
            for (let i = 0; i < 20; i++) {
                const point = Math.sin(i * 0.5) * (trend / 100) + (i * (trend / 500));
                points.push(Math.max(5, Math.min(height - 5, height - (point % height))));
            }
            
            ctx.beginPath();
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
            
            const step = width / (points.length - 1);
            ctx.moveTo(0, points[0]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(i * step, points[i]);
            }
            ctx.stroke();
            
            // Fill area under curve
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fill();
        });
    }
    
    /**
     * Animate cards with stagger effect
     */
    function animateCards() {
        const cards = document.querySelectorAll('#trending-grid .content-card');
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.classList.add('visible');
                
                // Add pulse animation to top card
                if (i === 0) {
                    card.classList.add('trending-pulse');
                    setTimeout(() => card.classList.remove('trending-pulse'), 2000);
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
     * Show empty state
     */
    function showEmptyState() {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-fire"></i></div>
                <h3>No Trending Content</h3>
                <p>Check back soon for viral content!</p>
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
                <h3>Unable to Load Trending</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.querySelector('#trending-now-section .see-all-btn');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                // Allow default navigation to trending_screen
            });
        }
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            await loadTrendingStats();
            addTrendingStatsBar();
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
        const cacheKey = `${CACHE_KEY}_${currentTimePeriod}`;
        
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
        const cacheKey = `${CACHE_KEY}_${currentTimePeriod}`;
        
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
        await loadTrendingStats();
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
        console.log('🔥 Trending Now Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy,
        setTimePeriod: (period) => { currentTimePeriod = period; refresh(); }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TrendingNow.init());
} else {
    TrendingNow.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrendingNow;
}
