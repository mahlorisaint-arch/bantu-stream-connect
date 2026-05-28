/* ============================================ */
/* BANTU INK - Editorial & News Section
   Home Feed Component - Magazine-style content hub
   Features: Breaking News, Deep Dives, Editorials, Music Reviews, Cultural Commentary
   Content Format: article_body, text-based with rich preview cards
/* ============================================ */

console.log('📰 Bantu Ink: Editorial section loading...');

const BantuInk = {
    config: {
        sectionId: 'bantu-ink',
        containerId: 'bantu-ink-grid',
        maxItems: 6,
        cacheKey: 'bantu_ink',
        cacheTTL: 5 * 60 * 1000, // 5 minutes for news (shorter TTL for breaking news)
        
        // Content formats for editorial content
        editorialFormats: ['article_body', 'article', 'editorial', 'review', 'news'],
        
        // Categories for filtering
        editorialCategories: [
            'News', 'Editorial', 'Review', 'Interview', 'Opinion',
            'Feature', 'Deep Dive', 'Analysis', 'Culture', 'Music'
        ],
        
        // Featured source names
        featuredSources: [
            'Bantu Editorial Staff',
            'Bantu Culture Desk',
            'Bantu Music Review',
            'Bantu Investigative'
        ]
    },

    state: {
        initialized: false,
        isLoading: false,
        articles: [],
        hasBreakingNews: false,
        breakingCount: 0,
        currentPage: 0
    },

    elements: {
        section: null,
        container: null,
        seeAllBtn: null,
        loadingIndicator: null,
        breakingAlert: null
    },

    /* ============================================ */
    /* INITIALIZATION
    /* ============================================ */
    init() {
        if (this.state.initialized) return;

        this.cacheElements();
        
        if (!this.elements.section) {
            console.warn('Bantu Ink section element not found');
            return;
        }

        this.setupEventListeners();
        this.loadEditorialContent();
        
        // Set up refresh interval for breaking news (every 2 minutes)
        setInterval(() => this.checkForBreakingNews(), 2 * 60 * 1000);
        
        this.state.initialized = true;
        console.log('Bantu Ink section initialized');
    },

    cacheElements() {
        this.elements.section = document.getElementById(this.config.sectionId);
        this.elements.container = document.getElementById(this.config.containerId);
        this.elements.seeAllBtn = document.querySelector(`#${this.config.sectionId} .see-all-btn`);
        this.elements.loadingIndicator = document.querySelector(`#${this.config.sectionId} .section-loading`);
        this.elements.breakingAlert = document.querySelector(`#${this.config.sectionId} .breaking-alert`);
    },

    setupEventListeners() {
        if (this.elements.seeAllBtn) {
            this.elements.seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'bantu-ink.html';
            });
        }

        document.addEventListener('themeChanged', () => {
            if (this.state.articles.length > 0) {
                this.render(this.state.articles);
            }
        });
    },

    /* ============================================ */
    /* DATA LOADING
    /* ============================================ */
    async loadEditorialContent(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('Bantu Ink: Using cached data', cachedData.length, 'articles');
                this.state.articles = cachedData;
                this.checkForBreakingNewsInCache(cachedData);
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            // Fetch editorial content from Content table
            const articles = await this.fetchEditorialContent();
            
            // Enrich with metrics
            const enrichedArticles = await this.enrichArticlesWithMetrics(articles);
            
            // Sort by breaking news first, then by recency
            const sortedArticles = this.sortArticles(enrichedArticles);
            
            // Take top items
            const topArticles = sortedArticles.slice(0, this.config.maxItems);
            
            // Check for breaking news
            this.state.hasBreakingNews = topArticles.some(a => a.is_breaking);
            this.state.breakingCount = topArticles.filter(a => a.is_breaking).length;
            
            this.state.articles = topArticles;
            this.cacheData(topArticles);
            this.render(topArticles);
            this.updateBreakingAlert();
            
            console.log('Bantu Ink loaded:', topArticles.length, 'articles');
            
        } catch (error) {
            console.error('Error loading Bantu Ink:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchEditorialContent() {
        if (!window.supabaseClient) return [];

        // Build query for editorial content
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                content_format,
                content_type,
                source_name,
                read_time,
                is_breaking,
                is_bantu_original,
                created_at,
                updated_at,
                views_count,
                favorites_count,
                shares_count,
                tags,
                genres,
                user_id,
                user_profiles:user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .in('content_format', this.config.editorialFormats)
            .order('is_breaking', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(this.config.maxItems * 2);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching editorial content:', error);
            return [];
        }

        // Filter out any items without titles
        return (data || []).filter(item => item.title && item.title.trim());
    },

    async enrichArticlesWithMetrics(articles) {
        if (!articles.length) return [];

        const articleIds = articles.map(a => a.id);
        
        // Fetch engagement stats
        let engagementMetrics = {};
        if (articleIds.length) {
            const { data, error } = await window.supabaseClient
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments, total_shares')
                .in('content_id', articleIds);
            
            if (!error && data) {
                engagementMetrics = data.reduce((map, stat) => {
                    map[stat.content_id] = stat;
                    return map;
                }, {});
            }
        }
        
        // Enrich each article
        return articles.map(article => ({
            ...article,
            metrics: {
                views: engagementMetrics[article.id]?.total_views || article.views_count || 0,
                likes: engagementMetrics[article.id]?.total_likes || 0,
                comments: engagementMetrics[article.id]?.total_comments || 0,
                shares: engagementMetrics[article.id]?.total_shares || article.shares_count || 0
            },
            // Generate a preview excerpt from description
            excerpt: this.generateExcerpt(article.description || ''),
            // Determine article category
            category: this.determineCategory(article),
            // Get author display name
            author: article.user_profiles?.full_name || 
                    article.user_profiles?.username || 
                    article.source_name || 
                    'Bantu Contributor'
        }));
    },

    generateExcerpt(description, maxLength = 120) {
        if (!description) return '';
        if (description.length <= maxLength) return description;
        return description.substring(0, maxLength).trim() + '...';
    },

    determineCategory(article) {
        // Check tags first
        if (article.tags && article.tags.length) {
            const tagCategories = ['News', 'Review', 'Interview', 'Opinion', 'Feature', 'Analysis'];
            const foundTag = article.tags.find(t => tagCategories.includes(t));
            if (foundTag) return foundTag;
        }
        
        // Check genres
        if (article.genres && article.genres.length) {
            const genreCategories = ['Music', 'Culture', 'STEM', 'Sports', 'Politics'];
            const foundGenre = article.genres.find(g => genreCategories.includes(g));
            if (foundGenre) return foundGenre;
        }
        
        // Check content_type
        if (article.content_type) {
            const typeMap = {
                'news': 'News',
                'editorial': 'Editorial',
                'review': 'Review',
                'interview': 'Interview'
            };
            if (typeMap[article.content_type]) return typeMap[article.content_type];
        }
        
        return 'Culture';
    },

    sortArticles(articles) {
        return [...articles].sort((a, b) => {
            // Breaking news first
            if (a.is_breaking && !b.is_breaking) return -1;
            if (!a.is_breaking && b.is_breaking) return 1;
            
            // Then by recency
            return new Date(b.created_at) - new Date(a.created_at);
        });
    },

    /* ============================================ */
    /* BREAKING NEWS HANDLING
    /* ============================================ */
    checkForBreakingNewsInCache(articles) {
        this.state.hasBreakingNews = articles.some(a => a.is_breaking);
        this.state.breakingCount = articles.filter(a => a.is_breaking).length;
        this.updateBreakingAlert();
    },

    async checkForBreakingNews() {
        if (!window.supabaseClient) return;
        
        try {
            const { data, error } = await window.supabaseClient
                .from('Content')
                .select('id, title, is_breaking, created_at')
                .eq('status', 'published')
                .eq('is_breaking', true)
                .in('content_format', this.config.editorialFormats)
                .order('created_at', { ascending: false })
                .limit(5);
            
            if (!error && data && data.length > 0) {
                const hasNewBreaking = data.some(news => 
                    !this.state.articles.some(a => a.id === news.id && a.is_breaking)
                );
                
                if (hasNewBreaking) {
                    console.log('New breaking news detected, refreshing...');
                    this.loadEditorialContent(true);
                }
            }
        } catch (error) {
            console.error('Error checking breaking news:', error);
        }
    },

    updateBreakingAlert() {
        if (!this.elements.breakingAlert) return;
        
        if (this.state.hasBreakingNews) {
            const breakingText = this.state.breakingCount === 1 
                ? `${this.state.breakingCount} Breaking Story` 
                : `${this.state.breakingCount} Breaking Stories`;
            
            this.elements.breakingAlert.innerHTML = `
                <i class="fas fa-bolt"></i>
                <span>${breakingText}</span>
                <i class="fas fa-chevron-right"></i>
            `;
            this.elements.breakingAlert.classList.add('active');
            
            // Add pulsing animation
            this.elements.breakingAlert.style.animation = 'pulseGlow 2s infinite';
        } else {
            this.elements.breakingAlert.classList.remove('active');
            this.elements.breakingAlert.style.animation = '';
        }
    },

    /* ============================================ */
    /* RENDERING
    /* ============================================ */
    render(articles) {
        if (!this.elements.container) return;
        
        if (!articles.length) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        // Featured article (first one, larger)
        const featuredArticle = articles[0];
        if (featuredArticle) {
            const featuredCard = this.createFeaturedCard(featuredArticle);
            fragment.appendChild(featuredCard);
        }
        
        // Regular articles grid (remaining articles)
        const remainingArticles = articles.slice(1);
        const regularGrid = document.createElement('div');
        regularGrid.className = 'ink-regular-grid';
        
        remainingArticles.forEach((article, index) => {
            const card = this.createRegularCard(article);
            regularGrid.appendChild(card);
            
            setTimeout(() => {
                if (card) card.classList.add('visible');
            }, index * 50);
        });
        
        fragment.appendChild(regularGrid);
        
        this.elements.container.innerHTML = '';
        this.elements.container.appendChild(fragment);
        this.elements.section.classList.add('loaded');
        
        // Animate featured card
        if (featuredArticle) {
            setTimeout(() => {
                const featuredCardEl = this.elements.container.querySelector('.ink-featured-card');
                if (featuredCardEl) featuredCardEl.classList.add('visible');
            }, 100);
        }
    },

    createFeaturedCard(article) {
        const card = document.createElement('div');
        card.className = 'ink-featured-card';
        card.dataset.articleId = article.id;
        
        const thumbnailUrl = this.fixImageUrl(article.thumbnail_url) || 
            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=450&fit=crop';
        
        const readTime = article.read_time || this.estimateReadTime(article.description);
        const category = article.category;
        const author = article.author;
        const date = this.formatDate(article.created_at);
        const views = this.formatNumber(article.metrics?.views || 0);
        
        card.innerHTML = `
            <div class="featured-card-inner">
                <div class="featured-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(article.title)}" loading="eager" onerror="this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=450&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    ${article.is_breaking ? `
                        <div class="breaking-badge">
                            <i class="fas fa-bolt"></i> BREAKING
                        </div>
                    ` : ''}
                    <div class="category-badge">${category}</div>
                </div>
                <div class="featured-content">
                    <div class="featured-meta">
                        <span class="author"><i class="fas fa-pen-fancy"></i> ${this.escapeHtml(author)}</span>
                        <span class="date"><i class="far fa-calendar-alt"></i> ${date}</span>
                        <span class="read-time"><i class="far fa-clock"></i> ${readTime} min read</span>
                    </div>
                    <h2 class="featured-title">${this.escapeHtml(article.title)}</h2>
                    <p class="featured-excerpt">${this.escapeHtml(article.excerpt)}</p>
                    <div class="featured-stats">
                        <span><i class="fas fa-eye"></i> ${views}</span>
                        ${article.metrics?.comments > 0 ? `<span><i class="fas fa-comment"></i> ${this.formatNumber(article.metrics.comments)}</span>` : ''}
                        ${article.metrics?.shares > 0 ? `<span><i class="fas fa-share-alt"></i> ${this.formatNumber(article.metrics.shares)}</span>` : ''}
                    </div>
                    <button class="read-more-btn" data-article-id="${article.id}">
                        Read Full Story <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
        
        const readBtn = card.querySelector('.read-more-btn');
        if (readBtn) {
            readBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.readArticle(article.id);
            });
        }
        
        card.addEventListener('click', () => {
            this.readArticle(article.id);
        });
        
        return card;
    },

    createRegularCard(article) {
        const card = document.createElement('div');
        card.className = 'ink-regular-card';
        card.dataset.articleId = article.id;
        
        const thumbnailUrl = this.fixImageUrl(article.thumbnail_url) || 
            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const readTime = article.read_time || this.estimateReadTime(article.description);
        const category = article.category;
        const author = article.author;
        const date = this.formatDate(article.created_at);
        
        card.innerHTML = `
            <div class="regular-card-inner">
                <div class="regular-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(article.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop'">
                    ${article.is_breaking ? `
                        <div class="breaking-dot"></div>
                    ` : ''}
                </div>
                <div class="regular-content">
                    <div class="regular-meta">
                        <span class="category-tag">${category}</span>
                        <span class="read-time-mini">${readTime} min</span>
                    </div>
                    <h3 class="regular-title">${this.truncateText(this.escapeHtml(article.title), 60)}</h3>
                    <p class="regular-excerpt">${this.truncateText(this.escapeHtml(article.excerpt), 90)}</p>
                    <div class="regular-footer">
                        <span class="author-mini">
                            <i class="fas fa-user-edit"></i> ${this.escapeHtml(author.split(' ')[0])}
                        </span>
                        <span class="date-mini">${date}</span>
                    </div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.readArticle(article.id);
        });
        
        return card;
    },

    estimateReadTime(text) {
        if (!text) return 3;
        const wordsPerMinute = 200;
        const wordCount = text.split(/\s+/).length;
        return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    },

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    },

    /* ============================================ */
    /* ARTICLE NAVIGATION
    /* ============================================ */
    readArticle(articleId) {
        // Store reading position in sessionStorage for "Continue Reading" feature
        sessionStorage.setItem('last_read_article', articleId);
        sessionStorage.setItem('last_read_timestamp', Date.now().toString());
        
        // Navigate to article detail page
        window.location.href = `article-detail.html?id=${articleId}`;
    },

    /* ============================================ */
    /* UI STATE MANAGEMENT
    /* ============================================ */
    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-ink">
                    <i class="fas fa-newspaper"></i>
                    <h3>No Editorial Content Yet</h3>
                    <p>Check back soon for articles, reviews, and cultural commentary</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        this.elements.container.innerHTML = `
            <div class="ink-loading-grid">
                <div class="skeleton-featured-card">
                    <div class="skeleton-thumbnail featured"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line long"></div>
                        <div class="skeleton-line"></div>
                    </div>
                </div>
                <div class="skeleton-regular-grid">
                    ${Array(3).fill().map(() => `
                        <div class="skeleton-regular-card">
                            <div class="skeleton-thumbnail regular"></div>
                            <div class="skeleton-content">
                                <div class="skeleton-line"></div>
                                <div class="skeleton-line short"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
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
                <div class="error-state-ink">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Articles</h3>
                    <button class="retry-btn" onclick="BantuInk.loadEditorialContent(true)">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    },

    /* ============================================ */
    /* CACHE MANAGEMENT
    /* ============================================ */
    getCachedData() {
        try {
            const cached = localStorage.getItem(this.config.cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < this.config.cacheTTL) {
                    return data;
                }
            }
        } catch (e) {}
        return null;
    },

    cacheData(data) {
        try {
            localStorage.setItem(this.config.cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {}
    },

    /* ============================================ */
    /* UTILITY FUNCTIONS
    /* ============================================ */
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
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    },

    async getCurrentUser() {
        if (window.AuthHelper?.isAuthenticated()) {
            return window.AuthHelper.getUserProfile();
        }
        if (window.getCurrentUser) {
            return await window.getCurrentUser();
        }
        return null;
    },

    showToast(message, type) {
        if (window.showToast) window.showToast(message, type);
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BantuInk.init());
} else {
    BantuInk.init();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuInk;
}
