/* ============================================ */
/* BANTU WAVES: AFRICA RISING SECTION
   Home Feed Component - Rising African Content
   Displays content with regional tags (country = 'South Africa')
   and localized flags, ordered by engagement
   FIXED: Uses window.supabaseAuth instead of window.supabaseClient
/* ============================================ */

console.log('🌟 Bantu Waves: Africa Rising section loading...');

const BantuWavesAfricaRising = {
    config: {
        sectionId: 'bantu-waves-africa-rising',
        containerId: 'bantu-waves-africa-rising-grid',
        maxItems: 10,
        cacheKey: 'bantu_waves_africa_rising',
        cacheTTL: 10 * 60 * 1000,
        africanCountries: [
            'South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Egypt',
            'Morocco', 'Algeria', 'Tunisia', 'Senegal', 'Ivory Coast',
            'Uganda', 'Tanzania', 'Ethiopia', 'Rwanda', 'Zimbabwe',
            'Zambia', 'Botswana', 'Namibia', 'Mozambique', 'Angola'
        ],
        saLanguages: ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af', 'en']
    },

    state: {
        initialized: false,
        isLoading: false,
        content: [],
        hasMore: true,
        currentPage: 0
    },

    elements: {
        section: null,
        container: null,
        seeAllBtn: null,
        loadingIndicator: null
    },

    init() {
        if (this.state.initialized) return;

        this.cacheElements();
        
        if (!this.elements.section) {
            console.warn('🌟 Africa Rising section element not found');
            return;
        }

        this.setupEventListeners();
        this.loadAfricaRisingContent();
        
        this.state.initialized = true;
        console.log('🌟 Africa Rising section initialized');
    },

    cacheElements() {
        this.elements.section = document.getElementById(this.config.sectionId);
        this.elements.container = document.getElementById(this.config.containerId);
        this.elements.seeAllBtn = document.querySelector(`#${this.config.sectionId} .see-all-btn`);
        this.elements.loadingIndicator = document.querySelector(`#${this.config.sectionId} .section-loading`);
    },

    setupEventListeners() {
        if (this.elements.seeAllBtn) {
            this.elements.seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'africa-rising.html';
            });
        }

        document.addEventListener('themeChanged', () => {
            if (this.state.content.length > 0) {
                this.render(this.state.content);
            }
        });
    },

    async loadAfricaRisingContent(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('📦 Africa Rising: Using cached data', cachedData.length, 'items');
                this.state.content = cachedData;
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            // Fetch content from Content table filtered by African regions
            const content = await this.fetchAfricaContent();
            
            // Enrich with metrics
            const enrichedContent = await this.enrichContentWithMetrics(content);
            
            // Sort by engagement score
            const sortedContent = this.sortByEngagement(enrichedContent);
            
            // Take top items
            const topContent = sortedContent.slice(0, this.config.maxItems);
            
            this.state.content = topContent;
            this.cacheData(topContent);
            this.render(topContent);
            
            console.log('✅ Africa Rising loaded:', topContent.length, 'items');
            
        } catch (error) {
            console.error('❌ Error loading Africa Rising content:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchAfricaContent() {
        // FIXED: Use window.supabaseAuth instead of window.supabaseClient
        if (!window.supabaseAuth) {
            console.error('Supabase Auth client not available');
            return [];
        }

        try {
            // Build query for African content - using simpler query first due to potential column issues
            // Note: Some columns like views_count may not exist, we'll handle that
            
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id,
                    title,
                    description,
                    thumbnail_url,
                    file_url,
                    duration,
                    genre,
                    language,
                    country,
                    region,
                    city,
                    is_bantu_original,
                    content_type,
                    content_format,
                    created_at,
                    updated_at,
                    user_id,
                    user_profiles:user_id (
                        id,
                        full_name,
                        username,
                        avatar_url,
                        country,
                        city
                    )
                `)
                .eq('status', 'published')
                .limit(this.config.maxItems * 2);

            if (error) {
                console.error('Error fetching Africa Rising content:', error);
                return [];
            }

            // Filter for African content locally (since some columns may not be queryable)
            let filteredData = (data || []).filter(item => {
                // Check if country is in African countries list
                if (item.country && this.config.africanCountries.includes(item.country)) {
                    return true;
                }
                // Check if region is Africa
                if (item.region === 'Africa') {
                    return true;
                }
                // Check if is_bantu_original
                if (item.is_bantu_original) {
                    return true;
                }
                // Check if language is SA language
                if (item.language && this.config.saLanguages.includes(item.language)) {
                    return true;
                }
                return false;
            });

            return filteredData || [];
        } catch (err) {
            console.error('Exception in fetchAfricaContent:', err);
            return [];
        }
    },

    async enrichContentWithMetrics(content) {
        if (!content.length) return [];

        const contentIds = content.map(c => c.id);
        const creatorIds = [...new Set(content.map(c => c.user_id).filter(Boolean))];
        
        // Fetch engagement stats
        const engagementMetrics = await this.fetchEngagementStats(contentIds);
        
        // Fetch creator metrics (connectors/followers)
        const creatorMetrics = await this.fetchCreatorMetrics(creatorIds);
        
        // Enrich each content item
        return content.map(item => {
            const metrics = engagementMetrics[item.id] || {};
            const creatorData = creatorMetrics[item.user_id] || {};
            
            // Calculate Africa Rising score
            const africaScore = this.calculateAfricaRisingScore(item, metrics);
            
            // Get country flag
            const countryCode = this.getCountryCode(item.country);
            const flagEmoji = this.getCountryFlag(countryCode);
            
            return {
                ...item,
                metrics: {
                    views: metrics.total_views || 0,
                    likes: metrics.total_likes || 0,
                    comments: metrics.total_comments || 0,
                    shares: metrics.total_shares || 0,
                    connectors: creatorData.connectors_count || 0
                },
                creator_stats: creatorData,
                africa_score: africaScore,
                flag_emoji: flagEmoji,
                country_code: countryCode,
                country_name: this.getCountryName(item.country)
            };
        });
    },

    async fetchEngagementStats(contentIds) {
        if (!contentIds.length) return {};
        
        const uniqueIds = [...new Set(contentIds)];
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return {};
        
        try {
            const { data, error } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments, total_shares')
                .in('content_id', uniqueIds);
            
            if (error) {
                // Table might not exist - return empty
                console.warn('Error fetching engagement stats (may not be available):', error.message);
                return {};
            }
            
            const metricsMap = {};
            (data || []).forEach(stat => {
                metricsMap[stat.content_id] = stat;
            });
            return metricsMap;
            
        } catch (error) {
            console.error('Error fetching engagement stats:', error);
            return {};
        }
    },

    async fetchCreatorMetrics(creatorIds) {
        if (!creatorIds.length) return {};
        
        const uniqueIds = [...new Set(creatorIds)];
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return {};
        
        try {
            // Get connector counts from connectors table
            const { data: connectors, error: connError } = await window.supabaseAuth
                .from('connectors')
                .select('connected_id')
                .eq('connection_type', 'creator')
                .in('connected_id', uniqueIds);
            
            if (connError) {
                console.warn('Error fetching connectors:', connError.message);
            }
            
            // Count connectors per creator
            const connectorCounts = {};
            (connectors || []).forEach(conn => {
                if (conn.connected_id) {
                    connectorCounts[conn.connected_id] = (connectorCounts[conn.connected_id] || 0) + 1;
                }
            });
            
            // Build metrics map
            const metricsMap = {};
            uniqueIds.forEach(creatorId => {
                metricsMap[creatorId] = {
                    connectors_count: connectorCounts[creatorId] || 0,
                    content_count: 0
                };
            });
            
            return metricsMap;
            
        } catch (error) {
            console.error('Error fetching creator metrics:', error);
            return {};
        }
    },

    calculateAfricaRisingScore(content, metrics) {
        let score = 0;
        
        // Base engagement
        score += (metrics.total_views || 0) * 1;
        score += (metrics.total_likes || 0) * 2;
        score += (metrics.total_comments || 0) * 3;
        score += (metrics.total_shares || 0) * 4;
        
        // African content boost
        if (content.region === 'Africa') score *= 1.5;
        if (this.config.africanCountries.includes(content.country)) score *= 1.3;
        if (content.is_bantu_original) score *= 1.4;
        
        // Local language boost (South African languages)
        if (this.config.saLanguages.includes(content.language)) score *= 1.2;
        
        // Recency boost
        if (content.created_at) {
            const daysOld = (new Date() - new Date(content.created_at)) / (1000 * 60 * 60 * 24);
            if (daysOld < 7) score *= 1.3;
            else if (daysOld < 30) score *= 1.1;
        }
        
        return Math.round(score);
    },

    getCountryCode(country) {
        const countryCodes = {
            'South Africa': 'ZA',
            'Nigeria': 'NG',
            'Kenya': 'KE',
            'Ghana': 'GH',
            'Egypt': 'EG',
            'Morocco': 'MA',
            'Algeria': 'DZ',
            'Tunisia': 'TN',
            'Senegal': 'SN',
            'Ivory Coast': 'CI',
            'Uganda': 'UG',
            'Tanzania': 'TZ',
            'Ethiopia': 'ET',
            'Rwanda': 'RW',
            'Zimbabwe': 'ZW',
            'Zambia': 'ZM',
            'Botswana': 'BW',
            'Namibia': 'NA',
            'Mozambique': 'MZ',
            'Angola': 'AO'
        };
        return countryCodes[country] || 'AF';
    },

    getCountryFlag(countryCode) {
        if (!countryCode) return '🌍';
        const OFFSET = 127397;
        const chars = [...countryCode.toUpperCase()].map(c => c.charCodeAt(0) + OFFSET);
        return String.fromCodePoint(...chars);
    },

    getCountryName(country) {
        return country || 'Africa';
    },

    sortByEngagement(content) {
        return [...content].sort((a, b) => {
            if (a.is_bantu_original && !b.is_bantu_original) return -1;
            if (!a.is_bantu_original && b.is_bantu_original) return 1;
            return (b.africa_score || 0) - (a.africa_score || 0);
        });
    },

    render(content) {
        if (!this.elements.container) return;
        
        if (!content.length) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        content.forEach((item, index) => {
            const card = this.createContentCard(item);
            fragment.appendChild(card);
            
            setTimeout(() => {
                if (card) card.classList.add('visible');
            }, index * 50);
        });
        
        this.elements.container.innerHTML = '';
        this.elements.container.appendChild(fragment);
        if (this.elements.section) {
            this.elements.section.classList.add('loaded');
        }
    },

    createContentCard(item) {
        const card = document.createElement('div');
        card.className = 'africa-rising-card';
        card.dataset.contentId = item.id;
        
        const thumbnailUrl = this.getThumbnailUrl(item);
        const creator = item.user_profiles || {};
        const creatorName = creator.full_name || creator.username || 'Creator';
        const creatorInitial = creatorName.charAt(0).toUpperCase();
        
        const views = this.formatNumber(item.metrics?.views || 0);
        const likes = this.formatNumber(item.metrics?.likes || 0);
        const duration = this.formatDuration(item.duration || 0);
        
        const contentType = item.content_type || item.content_format || 'video';
        const contentTypeIcon = this.getContentTypeIcon(contentType);
        
        const isBantuOriginal = item.is_bantu_original;
        const countryFlag = item.flag_emoji || '🌍';
        const countryName = item.country_name;
        
        card.innerHTML = `
            <div class="africa-card-inner">
                <div class="africa-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon"><i class="fas fa-play"></i></div>
                    </div>
                    ${duration ? `<div class="duration-badge">${duration}</div>` : ''}
                    ${isBantuOriginal ? '<div class="original-badge"><i class="fas fa-star"></i> Bantu Original</div>' : ''}
                    <div class="country-badge">
                        ${countryFlag} ${countryName}
                    </div>
                </div>
                <div class="africa-info">
                    <div class="content-type-badge">
                        <i class="fas ${contentTypeIcon}"></i> ${contentType.replace('_', ' ').toUpperCase()}
                    </div>
                    <h3 class="africa-title" title="${this.escapeHtml(item.title)}">${this.truncateText(this.escapeHtml(item.title), 50)}</h3>
                    <div class="africa-creator">
                        <div class="creator-avatar-small">
                            ${creator.avatar_url ? 
                                `<img src="${this.fixImageUrl(creator.avatar_url)}" alt="${creatorName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${creatorInitial}</span>';">` :
                                `<span>${creatorInitial}</span>`
                            }
                        </div>
                        <span class="creator-name">${this.escapeHtml(creatorName)}</span>
                    </div>
                    <div class="africa-stats">
                        <span><i class="fas fa-eye"></i> ${views}</span>
                        <span><i class="fas fa-heart"></i> ${likes}</span>
                        ${item.language ? `<span><i class="fas fa-language"></i> ${this.getLanguageName(item.language)}</span>` : ''}
                    </div>
                    ${item.description ? `
                        <p class="africa-description">${this.truncateText(this.escapeHtml(item.description), 80)}</p>
                    ` : ''}
                    <div class="africa-actions">
                        <button class="action-btn watch-btn" data-content-id="${item.id}" title="Watch Now">
                            <i class="fas fa-play"></i> Watch
                        </button>
                        <button class="action-btn save-btn" data-content-id="${item.id}" title="Save">
                            <i class="far fa-bookmark"></i>
                        </button>
                        <button class="action-btn share-btn" data-content-id="${item.id}" title="Share">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const watchBtn = card.querySelector('.watch-btn');
        if (watchBtn) {
            watchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.watchContent(item.id);
            });
        }
        
        const saveBtn = card.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveContent(item.id);
            });
        }
        
        const shareBtn = card.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareContent(item.id, item.title);
            });
        }
        
        // Make entire card clickable
        card.addEventListener('click', () => {
            this.watchContent(item.id);
        });
        
        return card;
    },

    getThumbnailUrl(item) {
        if (item.thumbnail_url) {
            return this.fixImageUrl(item.thumbnail_url);
        }
        // Default African-themed thumbnail
        return 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=225&fit=crop';
    },

    getContentTypeIcon(contentType) {
        const icons = {
            'music': 'fa-music',
            'music_video': 'fa-music',
            'song': 'fa-music',
            'track': 'fa-music',
            'podcast_episode': 'fa-podcast',
            'podcast': 'fa-podcast',
            'series_episode': 'fa-tv',
            'film': 'fa-film',
            'movie': 'fa-film',
            'documentary': 'fa-video',
            'short': 'fa-bolt',
            'article': 'fa-newspaper',
            'news': 'fa-newspaper'
        };
        return icons[contentType] || 'fa-play-circle';
    },

    getLanguageName(languageCode) {
        const languages = {
            'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'af': 'Afrikaans',
            'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
            've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
        };
        return languages[languageCode] || languageCode || 'English';
    },

    watchContent(contentId) {
        window.location.href = `content-detail.html?id=${contentId}`;
    },

    async saveContent(contentId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to save content', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) {
            this.showToast('Service unavailable', 'error');
            return;
        }
        
        try {
            // Check if already saved
            const { data: existing, error: fetchError } = await window.supabaseAuth
                .from('saved_content')
                .select('id')
                .eq('user_id', user.id)
                .eq('content_id', contentId)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking saved content:', fetchError);
                this.showToast('Error checking saved content', 'error');
                return;
            }
            
            if (existing) {
                // Unsave
                const { error: deleteError } = await window.supabaseAuth
                    .from('saved_content')
                    .delete()
                    .eq('id', existing.id);
                    
                if (deleteError) throw deleteError;
                this.showToast('Removed from saved', 'info');
            } else {
                // Save
                const { error: insertError } = await window.supabaseAuth
                    .from('saved_content')
                    .insert({
                        user_id: user.id,
                        content_id: contentId,
                        saved_at: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
                this.showToast('Saved to library!', 'success');
            }
        } catch (error) {
            console.error('Error saving content:', error);
            this.showToast('Error saving content', 'error');
        }
    },

    shareContent(contentId, title) {
        const shareUrl = `${window.location.origin}/content-detail.html?id=${contentId}`;
        
        if (navigator.share) {
            navigator.share({
                title: title,
                text: `Check out this video on Bantu Stream Connect: ${title}`,
                url: shareUrl
            }).catch(() => this.copyToClipboard(shareUrl));
        } else {
            this.copyToClipboard(shareUrl);
        }
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Share URL: ' + text, 'info');
        });
    },

    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-africa">
                    <i class="fas fa-heart"></i>
                    <h3>No Africa Rising Content Yet</h3>
                    <p>Check back soon for amazing content from African creators</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        const skeletons = Array(6).fill().map(() => `
            <div class="skeleton-africa-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
        
        this.elements.container.innerHTML = skeletons;
    },

    showLoading() {
        this.renderLoading();
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'flex';
        }
    },

    hideLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }
    },

    showError() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="error-state-africa">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Content</h3>
                    <p>Please check your connection and try again</p>
                    <button class="retry-btn" onclick="BantuWavesAfricaRising.loadAfricaRisingContent(true)">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    },

    getCachedData() {
        try {
            const cached = localStorage.getItem(this.config.cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < this.config.cacheTTL) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
        return null;
    },

    cacheData(data) {
        try {
            localStorage.setItem(this.config.cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    },

    fixImageUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (window.SupabaseHelper?.fixMediaUrl) {
            return window.SupabaseHelper.fixMediaUrl(url);
        }
        return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${url.replace(/^\/+/, '')}`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    },

    async getCurrentUser() {
        // FIXED: Use AuthHelper if available, or check supabaseAuth session
        if (window.AuthHelper?.isAuthenticated && window.AuthHelper.isAuthenticated()) {
            return window.AuthHelper.getUserProfile();
        }
        
        // Try to get from supabaseAuth session
        if (window.supabaseAuth) {
            try {
                const { data: { user } } = await window.supabaseAuth.auth.getUser();
                if (user) {
                    return {
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email,
                        username: user.user_metadata?.username
                    };
                }
            } catch (e) {
                console.warn('Error getting user from supabaseAuth:', e);
            }
        }
        
        if (window.getCurrentUser) {
            return await window.getCurrentUser();
        }
        return null;
    },

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
};

// Auto-initialize with proper delay for supabaseAuth
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.supabaseAuth) {
                BantuWavesAfricaRising.init();
            } else {
                console.log('🌟 Africa Rising waiting for supabaseAuth...');
                const authCheck = setInterval(() => {
                    if (window.supabaseAuth) {
                        clearInterval(authCheck);
                        BantuWavesAfricaRising.init();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(authCheck);
                    if (!BantuWavesAfricaRising.state.initialized) {
                        console.warn('🌟 Africa Rising: supabaseAuth not available, initializing anyway');
                        BantuWavesAfricaRising.init();
                    }
                }, 5000);
            }
        }, 100);
    });
} else {
    setTimeout(() => {
        if (window.supabaseAuth) {
            BantuWavesAfricaRising.init();
        } else {
            console.log('🌟 Africa Rising waiting for supabaseAuth...');
            const authCheck = setInterval(() => {
                if (window.supabaseAuth) {
                    clearInterval(authCheck);
                    BantuWavesAfricaRising.init();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(authCheck);
                if (!BantuWavesAfricaRising.state.initialized) {
                    console.warn('🌟 Africa Rising: supabaseAuth not available, initializing anyway');
                    BantuWavesAfricaRising.init();
                }
            }, 5000);
        }
    }, 100);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuWavesAfricaRising;
}
