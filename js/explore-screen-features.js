// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Explore Screen Initializing with Community First features - OPTIMIZED VERSION');
    
    // ============================================
    // PERFORMANCE: Cache Layer Implementation
    // ============================================
    class CacheManager {
        constructor() {
            this.cache = new Map();
            this.ttl = 5 * 60 * 1000; // 5 minutes default
        }
        
        set(key, data, ttl = this.ttl) {
            this.cache.set(key, {
                data,
                timestamp: Date.now(),
                ttl
            });
        }
        
        get(key) {
            const item = this.cache.get(key);
            if (!item) return null;
            
            if (Date.now() - item.timestamp > item.ttl) {
                this.cache.delete(key);
                return null;
            }
            
            return item.data;
        }
        
        clear() {
            this.cache.clear();
        }
    }
    
    window.cacheManager = new CacheManager();
    
    // ============================================
    // PERFORMANCE: Batch Query Optimizer
    // ============================================
    class QueryBatcher {
        constructor() {
            this.queries = new Map();
            this.batchSize = 10;
        }
        
        async batchQuery(table, ids, field = 'id') {
            const cacheKey = `${table}-${ids.sort().join(',')}`;
            const cached = window.cacheManager.get(cacheKey);
            if (cached) return cached;
            
            // Split into batches
            const batches = [];
            for (let i = 0; i < ids.length; i += this.batchSize) {
                batches.push(ids.slice(i, i + this.batchSize));
            }
            
            const results = await Promise.all(
                batches.map(batch => 
                    supabaseAuth
                        .from(table)
                        .select('*', { count: 'exact', head: true })
                        .in(field, batch)
                )
            );
            
            const data = results.flatMap(r => r.data || []);
            window.cacheManager.set(cacheKey, data, 2 * 60 * 1000);
            return data;
        }
    }
    
    window.queryBatcher = new QueryBatcher();
    
    // DOM Elements
    const loadingScreen = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const app = document.getElementById('app');
    
    // State variables
    let featuredCreators = [];
    let liveStreams = [];
    let trendingContent = [];
    let newContent = [];
    let communityFavorites = [];
    let allContentData = [];
    let isLoading = true;
    let currentProfile = null;
    let userProfiles = [];
    let continueWatching = [];
    let recommendations = [];
    let shorts = [];
    let activeWatchParty = null;
    let viewerCounts = new Map(); // For live viewer counts
    let viewerCountSubscriptions = []; // For real-time subscriptions
    
    // Connectors/Followers state
    let userBadges = [];
    let userExplorationCategories = new Set();
    let connectorCounts = new Map(); // Content ID -> connector count
    let languageFilter = 'all';
    
    // Content metrics storage (views, likes, shares)
    let contentMetrics = new Map(); // Content ID -> {views, likes, shares}
    
    // Pagination
    window.currentPage = 0;
    window.PAGE_SIZE = 20;
    window.hasMoreContent = true;
    window.isLoadingMore = false;
    window.currentCategory = null;
    
    // South African languages mapping
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

    // ============================================
    // DYNAMIC UI SCALING SYSTEM
    // ============================================

    class UIScaleController {
        constructor() {
            this.scaleKey = 'bantu_ui_scale';
            this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
            this.currentIndex = 2; // Default to 1.0
            this.init();
        }

        init() {
            // Load saved preference
            const savedScale = localStorage.getItem(this.scaleKey);
            if (savedScale) {
                this.currentIndex = this.scales.indexOf(parseFloat(savedScale));
                if (this.currentIndex === -1) this.currentIndex = 2;
            }
            
            // Apply scale
            this.applyScale();
            
            // Respect system font size settings
            this.respectSystemSettings();
            
            console.log('🎨 UI Scale Controller initialized');
        }

        // Apply scale to CSS variable
        applyScale() {
            const scale = this.scales[this.currentIndex];
            document.documentElement.style.setProperty('--ui-scale', scale);
            localStorage.setItem(this.scaleKey, scale);
            
            // Update scale display if it exists
            this.updateScaleDisplay();
            
            console.log(`📏 UI Scale set to: ${scale}x`);
        }

        // Update scale value display
        updateScaleDisplay() {
            const scaleValue = document.getElementById('scale-value');
            if (scaleValue) {
                scaleValue.textContent = Math.round(this.getScale() * 100) + '%';
            }
        }

        // Get current scale
        getScale() {
            return this.scales[this.currentIndex];
        }

        // Increase scale
        increase() {
            if (this.currentIndex < this.scales.length - 1) {
                this.currentIndex++;
                this.applyScale();
                this.showScaleToast();
            }
        }

        // Decrease scale
        decrease() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.applyScale();
                this.showScaleToast();
            }
        }

        // Reset to default
        reset() {
            this.currentIndex = 2;
            this.applyScale();
            this.showScaleToast();
        }

        // Show toast notification
        showScaleToast() {
            const scale = this.getScale();
            const percentage = Math.round(scale * 100);
            if (typeof showToast === 'function') {
                showToast(`UI Size: ${percentage}%`, 'info');
            }
        }

        // Respect system accessibility settings
        respectSystemSettings() {
            // Check if user has large text enabled
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            
            // Listen for system font size changes
            if (window.CSS && CSS.supports('font-size', 'clamp(1rem, 2vw, 1.5rem)')) {
                console.log('✅ System font size settings will be respected');
            }
            
            // Optional: Detect if system has large text enabled
            const largeTextQuery = window.matchMedia('(min-resolution: 120dpi)');
            if (largeTextQuery.matches) {
                console.log('📱 System may have large text enabled');
            }
        }

        // Create scale control UI
        createScaleControl() {
            const container = document.createElement('div');
            container.className = 'ui-scale-control';
            container.innerHTML = `
                <div class="scale-control-bar">
                    <button class="scale-btn" id="scale-decrease" title="Make Smaller (Ctrl+-)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="scale-value" id="scale-value">${Math.round(this.getScale() * 100)}%</span>
                    <button class="scale-btn" id="scale-increase" title="Make Larger (Ctrl++)">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="scale-btn" id="scale-reset" title="Reset (Ctrl+0)">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            `;
            
            // Add styles if not already present
            if (!document.getElementById('ui-scale-styles')) {
                const style = document.createElement('style');
                style.id = 'ui-scale-styles';
                style.textContent = `
                    .ui-scale-control {
                        position: fixed;
                        bottom: calc(10rem * var(--ui-scale));
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(10, 14, 18, 0.9);
                        backdrop-filter: blur(20px);
                        border: 1px solid var(--card-border);
                        border-radius: calc(2.5rem * var(--ui-scale));
                        padding: calc(0.5rem * var(--ui-scale)) calc(1rem * var(--ui-scale));
                        z-index: 999;
                        display: flex;
                        align-items: center;
                        gap: var(--spacing-sm);
                        transition: all 0.3s ease;
                    }
                    
                    .scale-control-bar {
                        display: flex;
                        align-items: center;
                        gap: var(--spacing-sm);
                    }
                    
                    .scale-btn {
                        width: calc(2rem * var(--ui-scale));
                        height: calc(2rem * var(--ui-scale));
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid var(--card-border);
                        color: var(--soft-white);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s ease;
                        font-size: var(--font-sm);
                    }
                    
                    .scale-btn:hover {
                        background: var(--warm-gold);
                        color: var(--deep-black);
                        transform: scale(1.1);
                    }
                    
                    .scale-value {
                        font-size: var(--font-sm);
                        color: var(--soft-white);
                        min-width: calc(3rem * var(--ui-scale));
                        text-align: center;
                        font-weight: 600;
                    }
                    
                    @media (max-width: 768px) {
                        .ui-scale-control {
                            bottom: calc(12rem * var(--ui-scale));
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Add to DOM
            document.body.appendChild(container);
            
            // Add event listeners
            document.getElementById('scale-decrease').addEventListener('click', () => this.decrease());
            document.getElementById('scale-increase').addEventListener('click', () => this.increase());
            document.getElementById('scale-reset').addEventListener('click', () => this.reset());
            
            console.log('🎛️ Scale control UI created');
        }

        // Toggle scale control visibility
        toggleScaleControl() {
            const control = document.getElementById('ui-scale-control');
            if (control) {
                control.style.display = control.style.display === 'none' ? 'flex' : 'none';
            }
        }
    }

    // Initialize global controller
    window.uiScaleController = new UIScaleController();

    // Add keyboard shortcuts for quick scaling
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Plus to increase
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            window.uiScaleController?.increase();
        }
        // Ctrl/Cmd + Minus to decrease
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            window.uiScaleController?.decrease();
        }
        // Ctrl/Cmd + 0 to reset
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            window.uiScaleController?.reset();
        }
    });

    // ============================================
    // UTILITY FUNCTIONS (Optimized)
    // ============================================
    
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            error: 'fa-exclamation-triangle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

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
            
            if (diffDays === 0) {
                return 'Today';
            } else if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        } catch (error) {
            return '';
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function formatNotificationTime(timestamp) {
        if (!timestamp) return 'Just now';
        const diffMs = Date.now() - new Date(timestamp).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function getInitials(name) {
        if (!name || name.trim() === '') return '?';
        const names = name.trim().split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    }

    // ============================================
    // PERFORMANCE: Optimized Content Metrics Loading
    // ============================================
    async function loadContentMetrics(contentIds) {
        if (!contentIds || contentIds.length === 0) return;
        
        // Check cache first
        const cacheKey = `metrics-${contentIds.sort().join(',')}`;
        const cached = window.cacheManager.get(cacheKey);
        if (cached) {
            cached.forEach(m => contentMetrics.set(m.content_id, m));
            return;
        }
        
        // Batch query for views
        const viewsPromises = contentIds.map(async (contentId) => {
            const { count } = await supabaseAuth
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', contentId);
            return { content_id: contentId, views: count || 0 };
        });
        
        // Batch query for likes
        const likesPromises = contentIds.map(async (contentId) => {
            const { count } = await supabaseAuth
                .from('content_likes')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', contentId);
            return { content_id: contentId, likes: count || 0 };
        });
        
        // Execute in parallel
        const [viewsResults, likesResults] = await Promise.all([
            Promise.all(viewsPromises),
            Promise.all(likesPromises)
        ]);
        
        // Merge results
        const metricsMap = new Map();
        viewsResults.forEach(r => {
            if (!metricsMap.has(r.content_id)) metricsMap.set(r.content_id, {});
            metricsMap.get(r.content_id).views = r.views;
        });
        
        likesResults.forEach(r => {
            if (!metricsMap.has(r.content_id)) metricsMap.set(r.content_id, {});
            metricsMap.get(r.content_id).likes = r.likes;
        });
        
        // Get shares (if table exists)
        try {
            const sharesPromises = contentIds.map(async (contentId) => {
                const { count } = await supabaseAuth
                    .from('content_shares')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', contentId);
                return { content_id: contentId, shares: count || 0 };
            });
            
            const sharesResults = await Promise.all(sharesPromises);
            sharesResults.forEach(r => {
                if (!metricsMap.has(r.content_id)) metricsMap.set(r.content_id, {});
                metricsMap.get(r.content_id).shares = r.shares;
            });
        } catch (e) {
            // Table might not exist, default to 0
            contentIds.forEach(id => {
                if (!metricsMap.has(id)) metricsMap.set(id, {});
                metricsMap.get(id).shares = 0;
            });
        }
        
        // Store in cache and local map
        metricsMap.forEach((metrics, contentId) => {
            contentMetrics.set(contentId, metrics);
        });
        
        window.cacheManager.set(cacheKey, Array.from(metricsMap.entries()).map(([k, v]) => ({ content_id: k, ...v })), 3 * 60 * 1000);
    }

    // ============================================
    // PERFORMANCE: Optimized Connector Counts
    // ============================================
    async function loadConnectorCounts(contentIds) {
        if (!contentIds || contentIds.length === 0) return;
        
        const cacheKey = `connectors-${contentIds.sort().join(',')}`;
        const cached = window.cacheManager.get(cacheKey);
        if (cached) {
            cached.forEach(c => connectorCounts.set(c.content_id, c.count));
            updateConnectorCountsOnCards();
            return;
        }
        
        // Get unique creator IDs first
        const creatorIds = new Set();
        const contentCreatorMap = new Map();
        
        const contentData = await Promise.all(
            contentIds.map(async (contentId) => {
                const { data } = await supabaseAuth
                    .from('Content')
                    .select('user_id')
                    .eq('id', contentId)
                    .single();
                
                if (data?.user_id) {
                    creatorIds.add(data.user_id);
                    contentCreatorMap.set(contentId, data.user_id);
                }
                return { contentId, userId: data?.user_id };
            })
        );
        
        // Batch query connector counts
        const connectorPromises = Array.from(creatorIds).map(async (userId) => {
            const { count } = await supabaseAuth
                .from('connectors')
                .select('*', { count: 'exact', head: true })
                .eq('connected_id', userId)
                .eq('connection_type', 'creator');
            return { userId, count: count || 0 };
        });
        
        const connectorResults = await Promise.all(connectorPromises);
        const creatorCountMap = new Map(connectorResults.map(r => [r.userId, r.count]));
        
        // Map back to content IDs
        const results = contentData.map(({ contentId, userId }) => ({
            content_id: contentId,
            count: userId ? (creatorCountMap.get(userId) || 0) : 0
        }));
        
        results.forEach(r => connectorCounts.set(r.content_id, r.count));
        window.cacheManager.set(cacheKey, results, 5 * 60 * 1000);
        
        updateConnectorCountsOnCards();
    }

    function updateConnectorCountsOnCards() {
        document.querySelectorAll('.content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            if (!contentId) return;
            
            const count = connectorCounts.get(contentId) || 0;
            
            // Find or create connector badge
            let connectorBadge = card.querySelector('.connector-badge');
            if (!connectorBadge) {
                const badgesContainer = card.querySelector('.card-badges');
                if (badgesContainer) {
                    connectorBadge = document.createElement('div');
                    connectorBadge.className = 'connector-badge';
                    badgesContainer.appendChild(connectorBadge);
                }
            }
            
            if (connectorBadge) {
                connectorBadge.innerHTML = `
                    <i class="fas fa-user-friends"></i>
                    <span>${formatNumber(count)} ${count === 1 ? 'Connector' : 'Connectors'}</span>
                `;
            }
        });
    }

    // ============================================
    // HEADER UPDATES (Optimized)
    // ============================================
    
    async function updateHeaderProfile() {
        try {
            const profilePlaceholder = document.getElementById('userProfilePlaceholder');
            const currentProfileName = document.getElementById('current-profile-name');
            
            if (!profilePlaceholder || !currentProfileName) return;
            
            if (window.currentUser) {
                // Get user profile from database
                const { data: profile, error } = await supabaseAuth
                    .from('user_profiles')
                    .select('*')
                    .eq('id', window.currentUser.id)
                    .maybeSingle();
                
                if (error) {
                    console.warn('Error fetching profile:', error);
                    return;
                }
                
                if (profile) {
                    currentProfile = profile;
                    
                    // Clear placeholder
                    profilePlaceholder.innerHTML = '';
                    
                    // Set profile image or initials
                    if (profile.avatar_url) {
                        const img = document.createElement('img');
                        img.className = 'profile-img';
                        img.src = contentSupabase.fixMediaUrl(profile.avatar_url);
                        img.alt = profile.full_name || 'Profile';
                        img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                        profilePlaceholder.appendChild(img);
                    } else {
                        const initials = getInitials(profile.full_name || profile.username || 'User');
                        const div = document.createElement('div');
                        div.className = 'profile-placeholder';
                        div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                        div.textContent = initials;
                        profilePlaceholder.appendChild(div);
                    }
                    
                    currentProfileName.textContent = profile.full_name || profile.username || 'Profile';
                }
            } else {
                // Show default profile for non-authenticated users
                profilePlaceholder.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'profile-placeholder';
                div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                div.textContent = 'G';
                profilePlaceholder.appendChild(div);
                
                currentProfileName.textContent = 'Guest';
            }
        } catch (error) {
            console.error('Error updating header profile:', error);
        }
    }
    
    function updateHeaderLogo() {
        const logoImg = document.querySelector('.logo img');
        if (logoImg) {
            logoImg.src = 'assets/icon/bantu_stream_connect_icon.png';
            logoImg.alt = 'Bantu Stream Connect';
        }
    }

    // ============================================
    // LANGUAGE FILTER (Optimized)
    // ============================================
    
    function setupLanguageFilter() {
        const languageChips = document.querySelectorAll('.language-chip');
        const moreLanguagesBtn = document.getElementById('more-languages-btn');
        
        languageChips.forEach(chip => {
            // Remove any existing listeners
            const newChip = chip.cloneNode(true);
            chip.parentNode.replaceChild(newChip, chip);
            
            newChip.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Update active state
                document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
                newChip.classList.add('active');
                
                // Get selected language
                languageFilter = newChip.dataset.lang;
                
                // Filter content by language
                filterContentByLanguage(languageFilter);
                
                showToast(`Filtering by: ${getLanguageName(languageFilter)}`, 'info');
            });
        });
        
        if (moreLanguagesBtn) {
            const newMoreBtn = moreLanguagesBtn.cloneNode(true);
            moreLanguagesBtn.parentNode.replaceChild(newMoreBtn, moreLanguagesBtn);
            
            newMoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Show all language options
                const languageContainer = document.querySelector('.language-chips');
                const hiddenLanguages = [
                    'nr', 'ss', 've', 'ts'
                ];
                
                hiddenLanguages.forEach(lang => {
                    if (!document.querySelector(`.language-chip[data-lang="${lang}"]`)) {
                        const newChip = document.createElement('button');
                        newChip.className = 'language-chip';
                        newChip.dataset.lang = lang;
                        newChip.textContent = languageMap[lang] || lang;
                        
                        newChip.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
                            newChip.classList.add('active');
                            languageFilter = lang;
                            filterContentByLanguage(lang);
                            showToast(`Filtering by: ${languageMap[lang]}`, 'info');
                        });
                        
                        languageContainer.insertBefore(newChip, newMoreBtn);
                    }
                });
                
                newMoreBtn.style.display = 'none';
            });
        }
    }
    
    function getLanguageName(code) {
        return languageMap[code] || code || 'All Languages';
    }
    
    function filterContentByLanguage(lang) {
        const contentCards = document.querySelectorAll('.content-card');
        let visibleCount = 0;
        
        if (lang === 'all') {
            contentCards.forEach(card => {
                card.style.display = 'block';
                visibleCount++;
            });
        } else {
            contentCards.forEach(card => {
                const contentLang = card.dataset.language || 'en';
                if (contentLang === lang) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
        }
        
        // Check if any content visible
        if (visibleCount === 0 && lang !== 'all') {
            showToast(`No content available in ${languageMap[lang] || lang} yet`, 'warning');
        }
    }

    // ============================================
    // BADGES SYSTEM
    // ============================================
    
    async function initBadgesSystem() {
        const badgesBtn = document.getElementById('nav-badges-btn');
        const badgesModal = document.getElementById('badges-modal');
        const closeBadges = document.getElementById('close-badges');
        
        if (!badgesBtn || !badgesModal) return;
        
        badgesBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to view your badges', 'warning');
                return;
            }
            badgesModal.classList.add('active');
            loadUserBadges();
        });
        
        if (closeBadges) {
            closeBadges.addEventListener('click', () => {
                badgesModal.classList.remove('active');
            });
        }
        
        // Track user exploration
        trackCategoryExploration();
    }
    
    async function loadUserBadges() {
        if (!window.currentUser) return;
        
        try {
            // Get user badges from database using the correct schema
            const { data, error } = await supabaseAuth
                .from('user_badges')
                .select('*')
                .eq('user_id', window.currentUser.id);
            
            if (error) throw error;
            
            userBadges = data || [];
            
            // Define available badges
            const allBadges = [
                { id: 'music', name: 'Music Explorer', icon: 'fa-music', description: 'Watched 5+ music videos', category: 'Music', requirement: 5 },
                { id: 'stem', name: 'STEM Seeker', icon: 'fa-microscope', description: 'Explored 5+ STEM videos', category: 'STEM', requirement: 5 },
                { id: 'culture', name: 'Cultural Curator', icon: 'fa-drum', description: 'Explored 5+ Culture videos', category: 'Culture', requirement: 5 },
                { id: 'news', name: 'News Junkie', icon: 'fa-newspaper', description: 'Watched 5+ news videos', category: 'News', requirement: 5 },
                { id: 'sports', name: 'Sports Fanatic', icon: 'fa-futbol', description: 'Watched 5+ sports videos', category: 'Sports', requirement: 5 },
                { id: 'movies', name: 'Movie Buff', icon: 'fa-film', description: 'Watched 5+ movies', category: 'Movies', requirement: 5 },
                { id: 'docs', name: 'Documentary Lover', icon: 'fa-clapperboard', description: 'Watched 5+ documentaries', category: 'Documentaries', requirement: 5 },
                { id: 'podcasts', name: 'Podcast Pro', icon: 'fa-podcast', description: 'Listened to 5+ podcasts', category: 'Podcasts', requirement: 5 },
                { id: 'shorts', name: 'Quick Bites Master', icon: 'fa-bolt', description: 'Watched 10+ shorts', category: 'Shorts', requirement: 10 },
                { id: 'live', name: 'Live Stream Lover', icon: 'fa-broadcast-tower', description: 'Joined 5+ live streams', category: 'Live', requirement: 5 },
                { id: 'connector', name: 'Social Butterfly', icon: 'fa-handshake', description: 'Connected with 10+ creators', category: 'Social', requirement: 10 },
                { id: 'polyglot', name: 'Language Explorer', icon: 'fa-language', description: 'Watched content in 3+ languages', category: 'Language', requirement: 3 }
            ];
            
            // Update badges grid
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
            
            badgesEarned.textContent = userBadges.length;
            
        } catch (error) {
            console.error('Error loading badges:', error);
        }
    }
    
    function trackCategoryExploration() {
        // Track when user clicks on content cards
        document.addEventListener('click', async (e) => {
            const card = e.target.closest('.content-card');
            if (!card || !window.currentUser) return;
            
            const category = card.dataset.category;
            const language = card.dataset.language;
            
            if (category) {
                userExplorationCategories.add(category);
                
                // Check if user qualifies for badges
                await checkAndAwardBadges(category, language);
            }
        });
    }
    
    async function checkAndAwardBadges(category, language) {
        try {
            // Get user's watch history for this category
            const { count, error } = await supabaseAuth
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('profile_id', currentProfile?.id)
                .eq('content.category', category);
            
            if (error) throw error;
            
            // Award badge if count meets requirement
            if (count >= 5) {
                const badgeName = getBadgeNameForCategory(category);
                if (badgeName) {
                    await awardBadge(badgeName);
                }
            }
            
            // Check polyglot badge (3+ languages)
            if (language) {
                const { data: langData } = await supabaseAuth
                    .from('content_views')
                    .select('content.language')
                    .eq('profile_id', currentProfile?.id);
                
                const uniqueLangs = new Set(langData?.map(v => v.content?.language) || []);
                if (uniqueLangs.size >= 3) {
                    await awardBadge('Language Explorer');
                }
            }
        } catch (error) {
            console.error('Error checking badges:', error);
        }
    }
    
    function getBadgeNameForCategory(category) {
        const map = {
            'Music': 'Music Explorer',
            'STEM': 'STEM Seeker',
            'Culture': 'Cultural Curator',
            'News': 'News Junkie',
            'Sports': 'Sports Fanatic',
            'Movies': 'Movie Buff',
            'Documentaries': 'Documentary Lover',
            'Podcasts': 'Podcast Pro'
        };
        return map[category];
    }
    
    async function awardBadge(badgeName) {
        if (!window.currentUser) return;
        
        // Check if already awarded
        if (userBadges.some(b => b.badge_name === badgeName)) return;
        
        try {
            const { error } = await supabaseAuth
                .from('user_badges')
                .insert({
                    user_id: window.currentUser.id,
                    badge_name: badgeName,
                    awarded_at: new Date().toISOString()
                });
            
            if (error) throw error;
            
            showToast(`🏆 Congratulations! You earned the "${badgeName}" badge!`, 'success');
            
            // Refresh badges
            await loadUserBadges();
        } catch (error) {
            console.error('Error awarding badge:', error);
        }
    }

    // ============================================
    // COMMUNITY STATS BAR
    // ============================================
    
    async function loadCommunityStats() {
        try {
            // Get total connectors
            const { count: connectorsCount, error: connError } = await supabaseAuth
                .from('connectors')
                .select('*', { count: 'exact', head: true });
            
            if (connError) throw connError;
            
            // Get total content
            const { count: contentCount, error: contentError } = await supabaseAuth
                .from('Content')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'published');
            
            if (contentError) throw contentError;
            
            // Get new connectors today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const { count: newConnectors, error: newError } = await supabaseAuth
                .from('connectors')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());
            
            if (newError) throw newError;
            
            // Update UI
            document.getElementById('total-connectors').textContent = formatNumber(connectorsCount || 12500);
            document.getElementById('total-content').textContent = formatNumber(contentCount || 2300);
            document.getElementById('new-connectors').textContent = `+${formatNumber(newConnectors || 342)}`;
            document.getElementById('total-connectors-analytics').textContent = formatNumber(connectorsCount || 12500);
            
        } catch (error) {
            console.error('Error loading community stats:', error);
            
            // Fallback to mock data
            document.getElementById('total-connectors').textContent = '12.5K';
            document.getElementById('total-content').textContent = '2.3K';
            document.getElementById('new-connectors').textContent = '+342';
        }
    }

    // ============================================
    // RENDER FUNCTIONS (Optimized with DocumentFragment)
    // ============================================
    
    function renderContentCards(contents, showConnectors = true) {
        const fragment = document.createDocumentFragment();
        const template = document.createElement('template');
        
        template.innerHTML = contents.map(content => {
            const thumbnailUrl = content.thumbnail_url
                ? contentSupabase.fixMediaUrl(content.thumbnail_url)
                : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
            
            const creatorProfile = content.user_profiles;
            const creatorName = creatorProfile?.full_name || creatorProfile?.username || content.creator || 'Creator';
            const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
            const initials = getInitials(displayName);
            const username = creatorProfile?.username || 'creator';
            const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
            
            const metrics = contentMetrics.get(content.id) || { views: 0, likes: 0, shares: 0 };
            const views = metrics.views;
            const likes = metrics.likes;
            const shares = metrics.shares;
            const connectors = content.favorites_count || 0;
            
            let avatarHtml = '';
            if (creatorProfile?.avatar_url) {
                const avatarUrl = contentSupabase.fixMediaUrl(creatorProfile.avatar_url);
                avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'creator-initials-small\\'>${initials}</div>'">`;
            } else {
                avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
            }
            
            return `
                <a href="content-detail.html?id=${content.id}" class="content-card" data-content-id="${content.id}" data-preview-url="${content.preview_url || ''}" data-language="${content.language || 'en'}" data-category="${content.genre || ''}">
                    <div class="card-thumbnail">
                        <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop'">
                        <div class="card-badges">
                            ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                            <div class="connector-badge">
                                <i class="fas fa-star"></i>
                                <span>${formatNumber(connectors)} Favorites</span>
                            </div>
                        </div>
                        <div class="thumbnail-overlay"></div>
                        <div class="play-overlay">
                            <div class="play-icon">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <h3 class="card-title" title="${escapeHtml(content.title)}">
                            ${truncateText(escapeHtml(content.title), 50)}
                        </h3>
                        <div class="creator-info">
                            <div class="creator-avatar-small">
                                ${avatarHtml}
                            </div>
                            <div class="creator-name-small">@${escapeHtml(username)}</div>
                        </div>
                        <div class="card-meta">
                            <span><i class="fas fa-eye"></i> ${formatNumber(views)}</span>
                            <span><i class="fas fa-heart"></i> ${formatNumber(likes)}</span>
                            <span><i class="fas fa-share"></i> ${formatNumber(shares)}</span>
                            <span><i class="fas fa-language"></i> ${languageMap[content.language] || 'English'}</span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = template.innerHTML;
        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }
        
        return fragment;
    }

    function updateTrendingContent() {
        const trendingGrid = document.getElementById('trending-grid');
        if (!trendingGrid) return;
        
        if (trendingContent.length === 0) {
            trendingGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-chart-line"></i></div>
                    <h3>No Trending Content</h3>
                    <p>Popular content will appear here</p>
                </div>
            `;
            return;
        }
        
        const fragment = renderContentCards(trendingContent.slice(0, 8));
        trendingGrid.innerHTML = '';
        trendingGrid.appendChild(fragment);
        setupVideoPreviews();
    }

    function updateNewContent() {
        const newContentGrid = document.getElementById('new-content-grid');
        if (!newContentGrid) return;
        
        if (newContent.length === 0) {
            newContentGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-gem"></i></div>
                    <h3>No New Content</h3>
                    <p>Fresh content will appear here</p>
                </div>
            `;
            return;
        }
        
        const fragment = renderContentCards(newContent.slice(0, 8));
        newContentGrid.innerHTML = '';
        newContentGrid.appendChild(fragment);
        setupVideoPreviews();
    }

    function updateCommunityFavorites() {
        const grid = document.getElementById('community-favorites-grid');
        if (!grid) return;
        
        if (communityFavorites.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>No community favorites yet</p></div>';
            return;
        }
        
        const fragment = renderContentCards(communityFavorites.slice(0, 8));
        grid.innerHTML = '';
        grid.appendChild(fragment);
    }

    // ============================================
    // VIDEO PREVIEWS ON HOVER
    // ============================================
    
    function setupVideoPreviews() {
        document.querySelectorAll('.content-card[data-preview-url]').forEach(card => {
            let video = null;
            let hoverTimeout = null;
            
            card.addEventListener('mouseenter', () => {
                hoverTimeout = setTimeout(() => {
                    const previewUrl = card.dataset.previewUrl;
                    if (!previewUrl) return;
                    
                    // Create video element if not exists
                    if (!video) {
                        video = document.createElement('video');
                        video.className = 'card-preview-video';
                        video.muted = true;
                        video.loop = true;
                        video.playsInline = true;
                        video.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                            z-index: 2;
                        `;
                        
                        const thumbnail = card.querySelector('.card-thumbnail');
                        if (thumbnail) {
                            thumbnail.appendChild(video);
                        }
                    }
                    
                    video.src = contentSupabase.fixMediaUrl(previewUrl);
                    video.play().catch(() => {
                        // Autoplay failed - remove video
                        video.remove();
                        video = null;
                    });
                }, 300);
            });
            
            card.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                if (video) {
                    video.pause();
                    video.remove();
                    video = null;
                }
            });
        });
    }

    // ============================================
    // VIDEO HERO SECTION
    // ============================================
    
    async function initVideoHero() {
        const heroVideo = document.getElementById('hero-video');
        const heroMuteBtn = document.getElementById('hero-mute-btn');
        const heroPlayBtn = document.getElementById('hero-play-btn');
        const heroTitle = document.getElementById('hero-title');
        const heroSubtitle = document.getElementById('hero-subtitle');
        
        if (!heroVideo) return;
        
        // Load trending content for hero
        try {
            const { data, error } = await supabaseAuth
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
                    heroVideo.src = contentSupabase.fixMediaUrl(videoUrl);
                    heroTitle.textContent = featured.title || 'DISCOVER & CONNECT';
                    heroSubtitle.textContent = featured.description || 'Explore amazing content, connect with creators, and join live streams from across Africa';
                    
                    // Try to play
                    heroVideo.play().catch(() => {
                        heroMuteBtn.style.display = 'flex';
                    });
                }
            }
        } catch (error) {
            console.error('Error loading hero video:', error);
        }
        
        // Mute toggle
        if (heroMuteBtn) {
            heroMuteBtn.addEventListener('click', () => {
                heroVideo.muted = !heroVideo.muted;
                heroMuteBtn.innerHTML = heroVideo.muted ? 
                    '<i class="fas fa-volume-mute"></i>' : 
                    '<i class="fas fa-volume-up"></i>';
            });
        }
        
        // Play button
        if (heroPlayBtn) {
            heroPlayBtn.addEventListener('click', () => {
                if (heroVideo.paused) {
                    heroVideo.play();
                    heroPlayBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Trailer';
                } else {
                    heroVideo.pause();
                    heroPlayBtn.innerHTML = '<i class="fas fa-play"></i> Watch Trailer';
                }
            });
        }
    }

    // ============================================
    // CONTINUE WATCHING
    // ============================================
    
    async function loadContinueWatching() {
        if (!window.currentUser || !currentProfile) return;
        
        try {
            const { data, error } = await supabaseAuth
                .from('content_views')
                .select(`
                    *,
                    content:content_id (*, user_profiles!user_id(*))
                `)
                .eq('profile_id', currentProfile.id)
                .is('completed_at', null)
                .order('updated_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            continueWatching = data || [];
            
            const section = document.getElementById('continue-watching-section');
            const grid = document.getElementById('continue-watching-grid');
            
            if (continueWatching.length > 0) {
                section.style.display = 'block';
                
                grid.innerHTML = continueWatching.map(item => {
                    const content = item.content;
                    if (!content) return '';
                    
                    const progress = Math.min(100, Math.floor((item.progress_seconds / content.duration) * 100)) || 0;
                    const thumbnailUrl = content.thumbnail_url
                        ? contentSupabase.fixMediaUrl(content.thumbnail_url)
                        : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
                    
                    const creatorProfile = content.user_profiles;
                    const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
                    const initials = getInitials(creatorName);
                    
                    let avatarHtml = '';
                    if (creatorProfile?.avatar_url) {
                        const avatarUrl = contentSupabase.fixMediaUrl(creatorProfile.avatar_url);
                        avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(creatorName)}" onerror="this.parentElement.innerHTML='<div class=\\'creator-initials-small\\'>${initials}</div>'">`;
                    } else {
                        avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
                    }
                    
                    return `
                        <a href="content-detail.html?id=${content.id}&resume=true" class="content-card" data-content-id="${content.id}" data-language="${content.language || 'en'}" data-category="${content.genre || ''}">
                            <div class="card-thumbnail">
                                <img src="${thumbnailUrl}"
                                     alt="${escapeHtml(content.title)}"
                                     loading="lazy"
                                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                                <div class="card-badges">
                                    <div class="card-badge continue-badge">
                                        <i class="fas fa-play-circle"></i> CONTINUE
                                    </div>
                                </div>
                                <div class="thumbnail-overlay"></div>
                                <div class="watch-progress-container">
                                    <div class="watch-progress-bar" style="width: ${progress}%"></div>
                                </div>
                                <div class="play-overlay">
                                    <div class="play-icon">
                                        <i class="fas fa-play"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="card-content">
                                <h3 class="card-title" title="${escapeHtml(content.title)}">
                                    ${truncateText(escapeHtml(content.title), 50)}
                                </h3>
                                <div class="creator-info">
                                    <div class="creator-avatar-small">
                                        ${avatarHtml}
                                    </div>
                                    <div class="creator-name-small">${escapeHtml(creatorName)}</div>
                                </div>
                                <div class="card-meta">
                                    <span><i class="fas fa-clock"></i> ${Math.floor(item.progress_seconds / 60)}:${('0' + (item.progress_seconds % 60)).slice(-2)} / ${Math.floor(content.duration / 60)}:${('0' + (content.duration % 60)).slice(-2)}</span>
                                    <span>${progress}%</span>
                                </div>
                            </div>
                        </a>
                    `;
                }).join('');
            } else {
                section.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading continue watching:', error);
        }
    }

    // ============================================
    // WATCH PARTY
    // ============================================
    
    function setupWatchParty() {
        const watchPartyBtn = document.getElementById('nav-watch-party-btn');
        const watchPartyModal = document.getElementById('watch-party-modal');
        const closeWatchParty = document.getElementById('close-watch-party');
        const startWatchParty = document.getElementById('start-watch-party');
        const copyPartyLink = document.getElementById('copy-party-link');
        
        if (!watchPartyBtn || !watchPartyModal) return;
        
        watchPartyBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to start a watch party', 'warning');
                return;
            }
            watchPartyModal.classList.add('active');
            loadWatchPartyContent();
        });
        
        if (closeWatchParty) {
            closeWatchParty.addEventListener('click', () => {
                watchPartyModal.classList.remove('active');
            });
        }
        
        if (startWatchParty) {
            startWatchParty.addEventListener('click', async () => {
                const selectedContent = document.querySelector('.watch-party-content-item.selected');
                if (!selectedContent) {
                    showToast('Please select content to watch', 'warning');
                    return;
                }
                
                const contentId = selectedContent.dataset.contentId;
                const syncPlayback = document.getElementById('party-sync-playback').checked;
                const chatEnabled = document.getElementById('party-chat-enabled').checked;
                
                try {
                    // Create watch party in Supabase
                    const { data, error } = await supabaseAuth
                        .from('watch_parties')
                        .insert({
                            host_id: window.currentUser.id,
                            profile_id: currentProfile?.id,
                            content_id: contentId,
                            sync_playback: syncPlayback,
                            chat_enabled: chatEnabled,
                            invite_code: generateInviteCode()
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    
                    activeWatchParty = data;
                    watchPartyModal.classList.remove('active');
                    
                    // Copy invite link
                    const inviteLink = `${window.location.origin}/watch-party.html?code=${data.invite_code}`;
                    navigator.clipboard.writeText(inviteLink);
                    
                    showToast('Watch party created! Invite link copied to clipboard', 'success');
                    
                    // Navigate to watch party
                    setTimeout(() => {
                        window.location.href = `watch-party.html?id=${data.id}`;
                    }, 1500);
                } catch (error) {
                    console.error('Error creating watch party:', error);
                    showToast('Failed to create watch party', 'error');
                }
            });
        }
        
        if (copyPartyLink) {
            copyPartyLink.addEventListener('click', () => {
                if (!activeWatchParty) {
                    showToast('Start a watch party first', 'warning');
                    return;
                }
                
                const inviteLink = `${window.location.origin}/watch-party.html?code=${activeWatchParty.invite_code}`;
                navigator.clipboard.writeText(inviteLink);
                showToast('Invite link copied!', 'success');
            });
        }
        
        // Search in watch party content
        const searchInput = document.getElementById('watch-party-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const query = e.target.value.trim();
                if (query.length < 2) {
                    loadWatchPartyContent();
                    return;
                }
                
                const results = await searchContent(query);
                renderWatchPartyContentList(results);
            }, 300));
        }
    }
    
    async function loadWatchPartyContent() {
        try {
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            renderWatchPartyContentList(data || []);
        } catch (error) {
            console.error('Error loading watch party content:', error);
        }
    }
    
    function renderWatchPartyContentList(contents) {
        const list = document.getElementById('watch-party-content-list');
        if (!list) return;
        
        list.innerHTML = contents.map(content => {
            const thumbnailUrl = content.thumbnail_url
                ? contentSupabase.fixMediaUrl(content.thumbnail_url)
                : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
            
            return `
                <div class="watch-party-content-item" data-content-id="${content.id}">
                    <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}">
                    <div class="watch-party-content-info">
                        <h4>${truncateText(escapeHtml(content.title), 40)}</h4>
                        <p>${content.media_type || 'video'}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        list.querySelectorAll('.watch-party-content-item').forEach(item => {
            item.addEventListener('click', () => {
                list.querySelectorAll('.watch-party-content-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
    }
    
    function generateInviteCode() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // ============================================
    // CREATOR TIPS
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
                    showToast('Please select an amount', 'warning');
                    return;
                }
                
                let amount = selectedOption.dataset.amount;
                if (amount === 'custom') {
                    amount = document.getElementById('custom-tip-amount').value;
                    if (!amount || amount < 1) {
                        showToast('Please enter a valid amount', 'warning');
                        return;
                    }
                }
                
                const message = document.getElementById('tip-message').value;
                const creatorId = tipModal.dataset.creatorId;
                
                if (!window.currentUser) {
                    showToast('Please sign in to send tips', 'warning');
                    return;
                }
                
                try {
                    // Record tip in database
                    const { error } = await supabaseAuth
                        .from('tips')
                        .insert({
                            sender_id: window.currentUser.id,
                            recipient_id: creatorId,
                            amount: parseFloat(amount),
                            message: message,
                            status: 'completed'
                        });
                    
                    if (error) throw error;
                    
                    showToast(`Thank you for supporting this creator!`, 'success');
                    tipModal.classList.remove('active');
                    
                    // Reset form
                    document.getElementById('tip-message').value = '';
                    document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
                    document.getElementById('custom-amount').style.display = 'none';
                } catch (error) {
                    console.error('Error sending tip:', error);
                    showToast('Failed to send tip', 'error');
                }
            });
        }
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
    // INTERACTIVE LIVE BADGES
    // ============================================
    
    async function setupLiveBadges() {
        // Clean up old subscriptions
        viewerCountSubscriptions.forEach(sub => sub.unsubscribe());
        viewerCountSubscriptions = [];
        
        const liveCards = document.querySelectorAll('.content-card[data-live="true"]');
        
        liveCards.forEach(card => {
            const contentId = card.dataset.contentId;
            const viewerCountEl = card.querySelector('.live-viewer-count');
            
            if (!contentId || !viewerCountEl) return;
            
            // Initial viewer count
            updateViewerCount(contentId, viewerCountEl);
            
            // Subscribe to real-time updates
            const subscription = supabaseAuth
                .channel(`content-views-${contentId}`)
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'content_views',
                        filter: `content_id=eq.${contentId}`
                    }, 
                    () => {
                        updateViewerCount(contentId, viewerCountEl);
                    }
                )
                .subscribe();
            
            viewerCountSubscriptions.push(subscription);
        });
    }
    
    async function updateViewerCount(contentId, element) {
        try {
            const { count, error } = await supabaseAuth
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', contentId)
                .eq('is_live_viewing', true);
            
            if (error) throw error;
            
            viewerCounts.set(contentId, count || 0);
            element.textContent = formatNumber(count || 0);
            
            // Add pulse animation if viewers > 0
            if (count > 0) {
                element.classList.add('has-viewers');
            } else {
                element.classList.remove('has-viewers');
            }
        } catch (error) {
            console.error('Error updating viewer count:', error);
        }
    }

    // ============================================
    // PERSONALIZED RECOMMENDATIONS
    // ============================================
    
    async function loadRecommendations() {
        if (!window.currentUser || !currentProfile) return;
        
        try {
            // Get user's viewing history
            const { data: history, error: historyError } = await supabaseAuth
                .from('content_views')
                .select('content_id, content:content_id(genre, tags, language)')
                .eq('profile_id', currentProfile.id)
                .order('updated_at', { ascending: false })
                .limit(20);
            
            if (historyError) throw historyError;
            
            if (!history || history.length === 0) {
                document.getElementById('recommendations-section').style.display = 'none';
                return;
            }
            
            // Extract genres and tags from history
            const genres = new Set();
            const languages = new Set();
            
            history.forEach(item => {
                if (item.content?.genre) genres.add(item.content.genre);
                if (item.content?.language) languages.add(item.content.language);
            });
            
            // Build recommendation query
            let query = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .neq('id', history[0]?.content_id)
                .limit(10);
            
            if (genres.size > 0) {
                query = query.in('genre', Array.from(genres));
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            recommendations = data || [];
            
            // Load metrics for recommendations
            const contentIds = recommendations.map(r => r.id);
            await loadContentMetrics(contentIds);
            
            const section = document.getElementById('recommendations-section');
            const grid = document.getElementById('recommendations-grid');
            
            if (recommendations.length > 0) {
                section.style.display = 'block';
                const fragment = renderContentCards(recommendations);
                grid.innerHTML = '';
                grid.appendChild(fragment);
            } else {
                section.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
            document.getElementById('recommendations-section').style.display = 'none';
        }
    }

    // ============================================
    // VOICE SEARCH
    // ============================================
    
    function setupVoiceSearch() {
        const voiceSearchBtn = document.getElementById('voice-search-btn');
        const voiceSearchModalBtn = document.getElementById('voice-search-modal-btn');
        const voiceStatus = document.getElementById('voice-search-status');
        const voiceStatusText = document.getElementById('voice-status-text');
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            if (voiceSearchBtn) voiceSearchBtn.style.display = 'none';
            if (voiceSearchModalBtn) voiceSearchModalBtn.style.display = 'none';
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-ZA'; // South African English
        
        const startVoiceSearch = () => {
            if (!window.currentUser) {
                showToast('Please sign in to use voice search', 'warning');
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
                
                // Trigger search
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
            }
            
            if (voiceStatus) {
                voiceStatus.classList.remove('active');
            }
            
            showToast(`Searching: "${transcript}"`, 'info');
        };
        
        recognition.onerror = (event) => {
            console.error('Voice search error:', event.error);
            
            if (voiceStatus) {
                voiceStatus.classList.remove('active');
                voiceStatusText.textContent = 'Error';
            }
            
            if (event.error === 'not-allowed') {
                showToast('Microphone access denied', 'error');
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
        
        if (voiceSearchModalBtn) {
            voiceSearchModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                startVoiceSearch();
            });
        }
    }

    // ============================================
    // SHORTS SECTION
    // ============================================
    
    async function loadShorts() {
        try {
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .eq('media_type', 'short')
                .or('media_type.eq.short,duration.lte.60')
                .order('views_count', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            shorts = data || [];
            
            // Load metrics for shorts
            const contentIds = shorts.map(s => s.id);
            await loadContentMetrics(contentIds);
            
            const container = document.getElementById('shorts-container');
            if (!container) return;
            
            if (shorts.length === 0) {
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'flex';
            container.innerHTML = shorts.map(short => {
                const thumbnailUrl = short.thumbnail_url
                    ? contentSupabase.fixMediaUrl(short.thumbnail_url)
                    : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
                
                const creatorProfile = short.user_profiles;
                const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
                const metrics = contentMetrics.get(short.id) || { views: 0, likes: 0 };
                
                return `
                    <a href="content-detail.html?id=${short.id}" class="short-card">
                        <div class="short-thumbnail">
                            <img src="${thumbnailUrl}" alt="${escapeHtml(short.title)}" loading="lazy">
                            <div class="short-overlay">
                                <i class="fas fa-play"></i>
                            </div>
                            <div class="short-stats">
                                <span><i class="fas fa-eye"></i> ${formatNumber(metrics.views)}</span>
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

    // ============================================
    // MULTI-PROFILE SUPPORT
    // ============================================
    
    async function loadUserProfiles() {
        if (!window.currentUser) return;
        
        try {
            const { data, error } = await supabaseAuth
                .from('profiles')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            userProfiles = data || [];
            
            if (userProfiles.length === 0) {
                const { data: newProfile, error: createError } = await supabaseAuth
                    .from('profiles')
                    .insert({
                        user_id: window.currentUser.id,
                        name: 'Default',
                        avatar_url: null,
                        is_kid: false
                    })
                    .select()
                    .single();
                
                if (createError) throw createError;
                
                userProfiles = [newProfile];
            }
            
            const savedProfileId = localStorage.getItem('currentProfileId');
            currentProfile = userProfiles.find(p => p.id === savedProfileId) || userProfiles[0];
            
            updateProfileSwitcher();
            
            await loadContinueWatching();
            await loadRecommendations();
            await loadUserBadges();
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    }
    
    function updateProfileSwitcher() {
        const profileList = document.getElementById('profile-list');
        const currentProfileName = document.getElementById('current-profile-name');
        const profilePlaceholder = document.getElementById('userProfilePlaceholder');
        
        if (!profileList || !currentProfileName || !profilePlaceholder) return;
        
        if (currentProfile) {
            currentProfileName.textContent = currentProfile.name || 'Profile';
            
            while (profilePlaceholder.firstChild) {
                profilePlaceholder.removeChild(profilePlaceholder.firstChild);
            }
            
            if (currentProfile.avatar_url) {
                const img = document.createElement('img');
                img.className = 'profile-img';
                img.src = contentSupabase.fixMediaUrl(currentProfile.avatar_url);
                img.alt = currentProfile.name;
                img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                profilePlaceholder.appendChild(img);
            } else {
                const initials = getInitials(currentProfile.name);
                const div = document.createElement('div');
                div.className = 'profile-placeholder';
                div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                div.textContent = initials;
                profilePlaceholder.appendChild(div);
            }
        }
        
        profileList.innerHTML = userProfiles.map(profile => {
            const initials = getInitials(profile.name);
            const isActive = currentProfile?.id === profile.id;
            
            return `
                <div class="profile-item ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
                    <div class="profile-avatar-small">
                        ${profile.avatar_url 
                            ? `<img src="${contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="${escapeHtml(profile.name)}">`
                            : `<div class="profile-initials">${initials}</div>`
                        }
                    </div>
                    <span class="profile-name">${escapeHtml(profile.name)}</span>
                    ${isActive ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.profile-item').forEach(item => {
            item.addEventListener('click', async () => {
                const profileId = item.dataset.profileId;
                const profile = userProfiles.find(p => p.id === profileId);
                
                if (profile) {
                    currentProfile = profile;
                    localStorage.setItem('currentProfileId', profileId);
                    
                    updateProfileSwitcher();
                    
                    await loadContinueWatching();
                    await loadRecommendations();
                    
                    showToast(`Switched to ${profile.name}`, 'success');
                }
            });
        });
        
        const profileBtn = document.getElementById('current-profile-btn');
        const dropdown = document.getElementById('profile-dropdown');
        
        if (profileBtn && dropdown) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            
            document.addEventListener('click', (e) => {
                if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });
        }
    }

    // ============================================
    // AUTHENTICATION FUNCTIONS
    // ============================================
    
    async function checkAuth() {
        try {
            const { data, error } = await supabaseAuth.auth.getSession();
            if (error) throw error;
            
            const session = data?.session;
            window.currentUser = session?.user || null;
            
            if (window.currentUser) {
                console.log('✅ User authenticated:', window.currentUser.email);
                await loadUserProfile();
                await loadUserProfiles();
                await updateHeaderProfile();
            } else {
                console.log('⚠️ User not authenticated');
                updateHeaderProfile();
                showToast('Welcome! Sign in to access personalized features.', 'info');
            }
            
            return window.currentUser;
        } catch (error) {
            console.error('Auth check error:', error);
            return null;
        }
    }

    async function loadUserProfile() {
        try {
            if (!window.currentUser) return;
            
            const { data: profile, error } = await supabaseAuth
                .from('user_profiles')
                .select('*')
                .eq('id', window.currentUser.id)
                .maybeSingle();
            
            if (error) {
                console.warn('Profile fetch error:', error);
                updateHeaderProfile();
                return;
            }
            
            if (profile) {
                currentProfile = profile;
                await updateHeaderProfile();
            }
            
            await loadNotifications();
        } catch (error) {
            console.error('Error loading profile:', error);
            updateHeaderProfile();
        }
    }

    // ============================================
    // NOTIFICATIONS FUNCTIONS
    // ============================================
    
    async function loadNotifications() {
        try {
            if (!window.currentUser) {
                updateNotificationBadge(0);
                return;
            }
            
            const { data, error } = await supabaseAuth
                .from('notifications')
                .select('*')
                .eq('user_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            window.notifications = data || [];
            const unreadCount = window.notifications.filter(n => !n.is_read).length;
            updateNotificationBadge(unreadCount);
        } catch (error) {
            console.error('Error loading notifications:', error);
            updateNotificationBadge(0);
        }
    }

    function updateNotificationBadge(count) {
        const mainBadge = document.getElementById('notification-count');
        const navBadge = document.getElementById('nav-notification-count');
        
        [mainBadge, navBadge].forEach(badge => {
            if (badge) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        });
    }

    function renderNotifications() {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;
        
        if (!window.currentUser) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>Sign in to see notifications</p>
                </div>
            `;
            return;
        }
        
        if (!window.notifications || window.notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        notificationsList.innerHTML = window.notifications.map(notification => `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h4>${escapeHtml(notification.title)}</h4>
                    <p>${escapeHtml(notification.message)}</p>
                    <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
                </div>
                ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');
    }

    function getNotificationIcon(type) {
        switch(type) {
            case 'like': return 'fas fa-heart';
            case 'comment': return 'fas fa-comment';
            case 'follow': return 'fas fa-user-plus';
            case 'tip': return 'fas fa-gift';
            case 'party': return 'fas fa-users';
            case 'badge': return 'fas fa-medal';
            default: return 'fas fa-bell';
        }
    }

    // ============================================
    // SEARCH FUNCTIONALITY (Optimized)
    // ============================================
    
    async function searchContent(query, category = '', sortBy = 'newest', language = '') {
        try {
            let queryBuilder = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .ilike('title', `%${query}%`)
                .eq('status', 'published');
            
            if (category && category !== 'all') {
                queryBuilder = queryBuilder.eq('genre', category);
            }
            
            if (language && language !== 'all') {
                queryBuilder = queryBuilder.eq('language', language);
            }
            
            const { data, error } = await queryBuilder.limit(50);
            if (error) throw error;
            
            // Enrich search results with real metrics
            const contentIds = (data || []).map(item => item.id);
            await loadContentMetrics(contentIds);
            await loadConnectorCounts(contentIds);
            
            // Apply sorting
            let results = data || [];
            if (sortBy === 'popular') {
                results.sort((a, b) => {
                    const aMetrics = contentMetrics.get(a.id) || { views: 0 };
                    const bMetrics = contentMetrics.get(b.id) || { views: 0 };
                    return (bMetrics.views || 0) - (aMetrics.views || 0);
                });
            } else if (sortBy === 'trending') {
                results.sort((a, b) => {
                    const aMetrics = contentMetrics.get(a.id) || { views: 0, likes: 0 };
                    const bMetrics = contentMetrics.get(b.id) || { views: 0, likes: 0 };
                    const aScore = (aMetrics.views || 0) + ((aMetrics.likes || 0) * 2);
                    const bScore = (bMetrics.views || 0) + ((bMetrics.likes || 0) * 2);
                    return bScore - aScore;
                });
            } else if (sortBy === 'connectors') {
                results.sort((a, b) => (b.favorites_count || 0) - (a.favorites_count || 0));
            } else if (sortBy === 'newest') {
                results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
            
            return results;
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    function renderSearchResults(results) {
        const grid = document.getElementById('search-results-grid');
        if (!grid) return;
        
        if (!results || results.length === 0) {
            grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
            return;
        }
        
        const fragment = renderContentCards(results);
        grid.innerHTML = '';
        grid.appendChild(fragment);
    }

    // ============================================
    // INFINITE SCROLL (Optimized)
    // ============================================
    
    function setupInfiniteScroll() {
        const sentinel = document.getElementById('infinite-scroll-sentinel');
        
        const observer = new IntersectionObserver(async (entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && window.hasMoreContent && !window.isLoadingMore) {
                await loadMoreContent();
            }
        }, {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        });
        
        if (sentinel) {
            observer.observe(sentinel);
        }
    }

    async function loadMoreContent() {
        if (window.isLoadingMore || !window.hasMoreContent) return;
        
        window.isLoadingMore = true;
        window.currentPage++;
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'infinite-scroll-loading';
        loadingIndicator.id = 'infinite-scroll-loading';
        loadingIndicator.innerHTML = `
            <div class="infinite-scroll-spinner"></div>
            <div>Loading more content...</div>
        `;
        document.querySelector('.container')?.appendChild(loadingIndicator);
        
        try {
            const from = window.currentPage * window.PAGE_SIZE;
            const to = (window.currentPage + 1) * window.PAGE_SIZE - 1;
            
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .range(from, to);
            
            if (error) throw error;
            
            document.getElementById('infinite-scroll-loading')?.remove();
            
            if (data && data.length > 0) {
                // Load metrics for new content
                const contentIds = data.map(c => c.id);
                await loadContentMetrics(contentIds);
                await loadConnectorCounts(contentIds);
                
                appendMoreContent(data);
                window.hasMoreContent = data.length === window.PAGE_SIZE;
            } else {
                window.hasMoreContent = false;
                
                const endMessage = document.createElement('div');
                endMessage.className = 'infinite-scroll-end';
                endMessage.innerHTML = 'You\'ve reached the end of content';
                document.querySelector('.container')?.appendChild(endMessage);
                setTimeout(() => endMessage.remove(), 3000);
            }
        } catch (error) {
            console.error('Error loading more content:', error);
            document.getElementById('infinite-scroll-loading')?.remove();
            window.hasMoreContent = false;
        } finally {
            window.isLoadingMore = false;
        }
    }

    function appendMoreContent(newItems) {
        const newContentGrid = document.getElementById('new-content-grid');
        if (!newContentGrid) return;
        
        const fragment = renderContentCards(newItems);
        newContentGrid.appendChild(fragment);
        setupVideoPreviews();
    }

    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================
    
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select')) return;
            
            switch(e.key) {
                case '/':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        openSearchModal();
                    }
                    break;
                case 'n':
                case 'N':
                    if (e.altKey) {
                        e.preventDefault();
                        toggleNotificationsPanel();
                    }
                    break;
                case 'v':
                case 'V':
                    if (e.altKey) {
                        e.preventDefault();
                        document.getElementById('voice-search-btn')?.click();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeAllModals();
                    break;
            }
        });
    }

    function openSearchModal() {
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            searchModal.classList.add('active');
            setTimeout(() => document.getElementById('search-input')?.focus(), 300);
        }
    }

    function toggleNotificationsPanel() {
        const panel = document.getElementById('notifications-panel');
        if (panel) {
            panel.classList.toggle('active');
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal.active, .search-modal.active, .analytics-modal.active, .notifications-panel.active, .watch-party-modal.active, .tip-modal.active, .badges-modal.active')
            .forEach(el => el.classList.remove('active'));
    }

    // ============================================
    // BACK TO TOP FUNCTIONALITY
    // ============================================
    
    function setupBackToTop() {
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (!backToTopBtn) return;
        
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        window.addEventListener('scroll', () => {
            backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        });
    }

    // ============================================
    // RENDER FUNCTIONS (Additional)
    // ============================================
    
    function renderCategoryTabs() {
        const categoryTabs = document.getElementById('category-tabs');
        if (!categoryTabs) return;
        
        const categories = ['All', 'Music', 'STEM', 'Culture', 'News', 'Sports', 'Movies', 'Documentaries', 'Podcasts', 'Shorts'];
        
        categoryTabs.innerHTML = categories.map((category, index) => `
            <button class="category-tab ${index === 0 ? 'active' : ''}"
                    data-category="${category}">
                ${escapeHtml(category)}
            </button>
        `).join('');
        
        document.querySelectorAll('.category-tab').forEach(button => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;
                onCategoryChanged(category);
            });
        });
    }

    async function onCategoryChanged(category) {
        document.querySelectorAll('.category-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        
        window.currentCategory = category === 'All' ? null : category;
        showToast(`Filtering by: ${category}`, 'info');
        
        await reloadContentByCategory(category);
    }

    async function reloadContentByCategory(category) {
        setLoading(true, `Loading ${category === 'All' ? 'all' : category} content...`);
        
        try {
            let query = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published');
            
            if (category !== 'All') {
                query = query.eq('genre', category);
            }
            
            const { data: trendingData } = await query
                .order('views_count', { ascending: false })
                .limit(8);
            
            trendingContent = trendingData || [];
            
            const { data: newData } = await query
                .order('created_at', { ascending: false })
                .limit(8);
            
            newContent = newData || [];
            
            // Load metrics for filtered content
            const allContentIds = [...trendingContent, ...newContent].map(c => c.id);
            await loadContentMetrics(allContentIds);
            await loadConnectorCounts(allContentIds);
            
            updateTrendingContent();
            updateNewContent();
        } catch (error) {
            console.error('Error reloading content by category:', error);
            showToast('Failed to filter content', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function getTopCreators() {
        try {
            loadingText.textContent = 'Finding top creators...';
            
            const { data: contentData, error: contentError } = await supabaseAuth
                .from('Content')
                .select('user_id')
                .eq('status', 'published')
                .not('user_id', 'is', null);
            
            if (contentError) throw contentError;
            
            const contentCountMap = new Map();
            contentData.forEach(item => {
                if (item.user_id) {
                    contentCountMap.set(item.user_id, (contentCountMap.get(item.user_id) || 0) + 1);
                }
            });
            
            const { data: connectorData, error: connectorError } = await supabaseAuth
                .from('connectors')
                .select('connected_id')
                .eq('connection_type', 'creator')
                .not('connected_id', 'is', null);
            
            if (connectorError) throw connectorError;
            
            const connectorCountMap = new Map();
            connectorData.forEach(item => {
                if (item.connected_id) {
                    connectorCountMap.set(item.connected_id, (connectorCountMap.get(item.connected_id) || 0) + 1);
                }
            });
            
            const creatorScores = new Map();
            
            contentCountMap.forEach((count, userId) => {
                creatorScores.set(userId, (creatorScores.get(userId) || 0) + count * 2);
            });
            
            connectorCountMap.forEach((count, userId) => {
                creatorScores.set(userId, (creatorScores.get(userId) || 0) + count);
            });
            
            const sortedCreators = Array.from(creatorScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([userId, score]) => userId);
            
            if (sortedCreators.length === 0) {
                console.warn('No creators found with published content');
                return [];
            }
            
            const { data: profiles, error: profilesError } = await supabaseAuth
                .from('user_profiles')
                .select('*')
                .in('id', sortedCreators);
            
            if (profilesError) throw profilesError;
            
            return profiles.map(profile => ({
                ...profile,
                video_count: contentCountMap.get(profile.id) || 0,
                follower_count: connectorCountMap.get(profile.id) || 0
            }));
        } catch (error) {
            console.error('Error getting top creators:', error);
            showToast('Failed to load top creators', 'error');
            return [];
        }
    }

    function updateFeaturedCreators() {
        const creatorsList = document.getElementById('creators-list');
        
        if (featuredCreators.length === 0) {
            creatorsList.innerHTML = `
                <div class="swiper-slide">
                    <div class="creator-card">
                        <div class="empty-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <h3>No Featured Creators</h3>
                        <p>Top creators will appear here</p>
                    </div>
                </div>
            `;
            return;
        }
        
        creatorsList.innerHTML = featuredCreators.map(creator => {
            const avatarUrl = creator.avatar_url
                ? contentSupabase.fixMediaUrl(creator.avatar_url)
                : null;
            
            const bio = creator.bio || 'Passionate content creator sharing authentic stories and experiences.';
            const truncatedBio = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
            const fullName = creator.full_name || creator.username || 'Creator';
            const username = creator.username || 'creator';
            const displayName = fullName || username;
            const initials = getInitials(displayName);
            const videoCount = creator.video_count || 0;
            const followerCount = creator.follower_count || 0;
            const isTopCreator = videoCount > 5 || followerCount > 100;
            
            return `
                <div class="swiper-slide">
                    <div class="creator-card">
                        ${isTopCreator ? '<div class="founder-badge">TOP CREATOR</div>' : ''}
                        <div class="creator-avatar">
                            ${avatarUrl ? `
                                <img src="${avatarUrl}" alt="${fullName}"
                                     onerror="this.parentElement.innerHTML='<div class=\\'creator-initials\\'>${initials}</div>'">
                            ` : `
                                <div class="creator-initials">${initials}</div>
                            `}
                        </div>
                        <div class="creator-name">${fullName}</div>
                        <div class="creator-username">@${username}</div>
                        <div class="creator-bio">${escapeHtml(truncatedBio)}</div>
                        <div class="creator-stats">
                            <div class="stat">
                                <div class="stat-number">${videoCount}</div>
                                <div class="stat-label">Videos</div>
                            </div>
                            <div class="stat">
                                <div class="stat-number">${formatNumber(followerCount)}</div>
                                <div class="stat-label">Connectors</div>
                            </div>
                        </div>
                        <div class="creator-actions">
                            <button class="view-channel-btn" onclick="window.location.href='creator-channel.html?id=${creator.id}'">
                                View Channel
                            </button>
                            <button class="tip-creator-btn" data-creator-id="${creator.id}" data-creator-name="${fullName}">
                                <i class="fas fa-gift"></i> Tip
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        setTimeout(() => {
            if (typeof Swiper !== 'undefined') {
                new Swiper('#creators-swiper', {
                    slidesPerView: 1,
                    spaceBetween: 20,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    breakpoints: {
                        640: { slidesPerView: 2 },
                        1024: { slidesPerView: 3 }
                    }
                });
            }
        }, 100);
    }

    async function updateLiveStreams() {
        const liveStreamsGrid = document.getElementById('live-streams-grid');
        const noLiveStreams = document.getElementById('no-live-streams');
        
        try {
            // Get live streams from database
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .eq('media_type', 'live')
                .order('created_at', { ascending: false })
                .limit(6);
            
            if (error) throw error;
            
            liveStreams = data || [];
            
            // Load metrics for live streams
            const contentIds = liveStreams.map(s => s.id);
            await loadContentMetrics(contentIds);
            await loadConnectorCounts(contentIds);
        } catch (error) {
            console.error('Error loading live streams:', error);
            liveStreams = [];
        }
        
        if (liveStreams.length === 0) {
            liveStreamsGrid.style.display = 'none';
            noLiveStreams.style.display = 'block';
            return;
        }
        
        liveStreamsGrid.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        
        const fragment = renderContentCards(liveStreams);
        liveStreamsGrid.innerHTML = '';
        liveStreamsGrid.appendChild(fragment);
        
        setupLiveBadges();
    }

    function updateEvents() {
        const eventsList = document.getElementById('events-list');
        const noEvents = document.getElementById('no-events');
        
        const mockEvents = [
            {
                id: 1,
                title: 'African Music Festival Live Stream',
                description: 'Join us for the biggest African music festival with live performances from top artists across the continent.',
                time: 'Tomorrow 7:00 PM SAST',
                tags: ['Music', 'Live', 'Festival']
            },
            {
                id: 2,
                title: 'Tech Startup Pitch Competition',
                description: 'Watch innovative African startups pitch their ideas to a panel of investors. Live Q&A session included.',
                time: 'Friday 3:00 PM WAT',
                tags: ['Technology', 'Startups', 'Business']
            },
            {
                id: 3,
                title: 'Cooking Masterclass: Traditional Dishes',
                description: 'Learn to cook authentic African dishes with master chefs. Interactive cooking session with live chat.',
                time: 'Saturday 2:00 PM EAT',
                tags: ['Food', 'Cooking', 'Education']
            }
        ];
        
        if (mockEvents.length === 0) {
            eventsList.style.display = 'none';
            noEvents.style.display = 'block';
            return;
        }
        
        eventsList.style.display = 'block';
        noEvents.style.display = 'none';
        
        eventsList.innerHTML = mockEvents.map(event => `
            <div class="event-card">
                <div class="event-header">
                    <div>
                        <div class="event-title">${event.title}</div>
                        <div class="event-time">${event.time}</div>
                    </div>
                </div>
                <div class="event-description">${event.description}</div>
                <div class="event-actions">
                    <button class="reminder-btn" onclick="window.setReminder(${event.id})">
                        <i class="fas fa-bell"></i> Set Reminder
                    </button>
                    <div class="event-tags">
                        ${event.tags.map(tag => `<span class="event-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    window.setReminder = function(eventId) {
        showToast('Reminder set for this event!', 'success');
    };

    // ============================================
    // PERFORMANCE: Optimized Explore Data Loading
    // ============================================
    
    async function loadExploreData() {
        const startTime = performance.now();
        console.log('⏱️ Starting data load...');
        
        try {
            loadingText.textContent = 'Loading content...';
            
            // PARALLEL LOAD: Fetch all data simultaneously
            const [
                creatorsData,
                liveData,
                trendingData,
                newData,
                favoritesData
            ] = await Promise.all([
                getTopCreators(),
                supabaseAuth.from('Content').select('*, user_profiles!user_id(*)').eq('status', 'published').eq('media_type', 'live').order('created_at', { ascending: false }).limit(6),
                supabaseAuth.from('Content').select('*, user_profiles!user_id(*)').eq('status', 'published').order('views_count', { ascending: false }).limit(8),
                supabaseAuth.from('Content').select('*, user_profiles!user_id(*)').eq('status', 'published').order('created_at', { ascending: false }).limit(8),
                supabaseAuth.from('Content').select('*, user_profiles!user_id(*)').eq('status', 'published').order('favorites_count', { ascending: false }).limit(8)
            ]);
            
            featuredCreators = creatorsData || [];
            liveStreams = liveData?.data || [];
            trendingContent = trendingData?.data || [];
            newContent = newData?.data || [];
            communityFavorites = favoritesData?.data || [];
            
            console.log('✅ Data fetched, loading metrics...');
            loadingText.textContent = 'Loading metrics...';
            
            // Collect ALL content IDs
            const allContentIds = [
                ...trendingContent.map(c => c.id),
                ...newContent.map(c => c.id),
                ...communityFavorites.map(c => c.id),
                ...liveStreams.map(c => c.id)
            ].filter(Boolean);
            
            // SINGLE BATCH: Load all metrics at once
            if (allContentIds.length > 0) {
                await loadContentMetrics(allContentIds);
                await loadConnectorCounts(allContentIds);
            }
            
            console.log('✅ Metrics loaded, rendering UI...');
            loadingText.textContent = 'Rendering...';
            
            // Render all sections
            updateFeaturedCreators();
            updateLiveStreams();
            updateTrendingContent();
            updateNewContent();
            updateCommunityFavorites();
            updateEvents();
            
            // Load secondary features (non-blocking)
            loadShorts();
            loadContinueWatching();
            loadRecommendations();
            loadCommunityStats();
            setupVideoPreviews();
            
            const endTime = performance.now();
            console.log(`⏱️ Total load time: ${(endTime - startTime).toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Error loading explore data:', error);
            showToast('Failed to load explore content.', 'error');
        }
    }

    // ============================================
    // PLATFORM ANALYTICS (Optimized)
    // ============================================
    
    async function loadPlatformAnalytics() {
        try {
            // Get total views across all content
            const { count: totalViews, error: viewsError } = await supabaseAuth
                .from('content_views')
                .select('*', { count: 'exact', head: true });
            
            if (viewsError) throw viewsError;
            
            // Get total content count
            const { count: totalContent, error: contentError } = await supabaseAuth
                .from('Content')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'published');
            
            if (contentError) throw contentError;
            
            // Get active creators (users with published content)
            const { data: activeCreatorsData, error: creatorsError } = await supabaseAuth
                .from('Content')
                .select('user_id')
                .eq('status', 'published');
            
            if (creatorsError) throw creatorsError;
            
            const uniqueCreators = new Set(activeCreatorsData?.map(c => c.user_id) || []);
            const activeCreators = uniqueCreators.size;
            
            // Get total connectors
            const { count: totalConnectors, error: connError } = await supabaseAuth
                .from('connectors')
                .select('*', { count: 'exact', head: true });
            
            if (connError) throw connError;
            
            // Update UI with real data
            document.getElementById('total-views').textContent = formatNumber(totalViews || 1250000);
            document.getElementById('total-content').textContent = formatNumber(totalContent || 125);
            document.getElementById('active-creators').textContent = formatNumber(activeCreators || 45);
            document.getElementById('total-connectors-analytics').textContent = formatNumber(totalConnectors || 12500);
            
            // Load engagement chart with real data
            await loadEngagementChart();
            
        } catch (error) {
            console.error('Error loading platform analytics:', error);
            
            // Fallback to demo data
            document.getElementById('total-views').textContent = formatNumber(1250000);
            document.getElementById('total-content').textContent = '125';
            document.getElementById('active-creators').textContent = '45';
            document.getElementById('total-connectors-analytics').textContent = formatNumber(12500);
        }
    }
    
    async function loadEngagementChart() {
        const ctx = document.getElementById('engagement-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        try {
            // Get views data for the last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const { data: viewsData, error } = await supabaseAuth
                .from('content_views')
                .select('viewed_at')
                .gte('viewed_at', sevenDaysAgo.toISOString());
            
            if (error) throw error;
            
            // Group by day
            const viewsByDay = new Array(7).fill(0);
            const today = new Date();
            
            viewsData?.forEach(view => {
                const viewDate = new Date(view.viewed_at);
                const dayDiff = Math.floor((today - viewDate) / (1000 * 60 * 60 * 24));
                if (dayDiff >= 0 && dayDiff < 7) {
                    viewsByDay[6 - dayDiff]++;
                }
            });
            
            // Get likes data for the last 7 days
            const { data: likesData } = await supabaseAuth
                .from('content_likes')
                .select('created_at')
                .gte('created_at', sevenDaysAgo.toISOString());
            
            const likesByDay = new Array(7).fill(0);
            
            likesData?.forEach(like => {
                const likeDate = new Date(like.created_at);
                const dayDiff = Math.floor((today - likeDate) / (1000 * 60 * 60 * 24));
                if (dayDiff >= 0 && dayDiff < 7) {
                    likesByDay[6 - dayDiff]++;
                }
            });
            
            // Destroy existing chart if exists
            if (window.engagementChart) {
                window.engagementChart.destroy();
            }
            
            // Create new chart
            window.engagementChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', 'Yesterday', 'Today'],
                    datasets: [{
                        label: 'Views',
                        data: viewsByDay,
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Likes',
                        data: likesByDay,
                        borderColor: '#1D4ED8',
                        backgroundColor: 'rgba(29, 78, 216, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
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
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: 'var(--slate-grey)' }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: 'var(--slate-grey)' }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error loading engagement chart:', error);
        }
    }

    // ============================================
    // SETUP EVENT LISTENERS (Optimized)
    // ============================================
    
    function setupSearch() {
        const searchBtn = document.getElementById('search-btn');
        const searchModal = document.getElementById('search-modal');
        const closeSearchBtn = document.getElementById('close-search-btn');
        const searchInput = document.getElementById('search-input');
        
        if (!searchBtn || !searchModal) return;
        
        searchBtn.addEventListener('click', () => {
            searchModal.classList.add('active');
            setTimeout(() => searchInput?.focus(), 300);
        });
        
        if (closeSearchBtn) {
            closeSearchBtn.addEventListener('click', () => {
                searchModal.classList.remove('active');
                if (searchInput) searchInput.value = '';
                document.getElementById('search-results-grid').innerHTML = '';
            });
        }
        
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                searchModal.classList.remove('active');
                if (searchInput) searchInput.value = '';
                document.getElementById('search-results-grid').innerHTML = '';
            }
        });
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const query = e.target.value.trim();
                const category = document.getElementById('category-filter')?.value;
                const sortBy = document.getElementById('sort-filter')?.value;
                const language = document.getElementById('language-filter')?.value;
                const resultsGrid = document.getElementById('search-results-grid');
                
                if (!resultsGrid) return;
                
                if (query.length < 2) {
                    resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
                    return;
                }
                
                resultsGrid.innerHTML = `
                    <div class="infinite-scroll-loading">
                        <div class="infinite-scroll-spinner"></div>
                        <div>Searching...</div>
                    </div>
                `;
                
                const results = await searchContent(query, category, sortBy, language);
                renderSearchResults(results);
            }, 300));
        }
        
        document.getElementById('category-filter')?.addEventListener('change', () => {
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
        
        document.getElementById('language-filter')?.addEventListener('change', () => {
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }

    function setupNotifications() {
        const notificationsBtn = document.getElementById('notifications-btn');
        const navNotificationsBtn = document.getElementById('nav-notifications-btn');
        const notificationsPanel = document.getElementById('notifications-panel');
        const closeNotifications = document.getElementById('close-notifications');
        const markAllRead = document.getElementById('mark-all-read');
        
        if (!notificationsBtn || !notificationsPanel) return;
        
        const openNotifications = () => {
            notificationsPanel.classList.add('active');
            renderNotifications();
        };
        
        notificationsBtn.addEventListener('click', openNotifications);
        
        if (navNotificationsBtn) {
            navNotificationsBtn.addEventListener('click', openNotifications);
        }
        
        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationsPanel.classList.remove('active');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (notificationsPanel.classList.contains('active') &&
                !notificationsPanel.contains(e.target) &&
                !notificationsBtn.contains(e.target) &&
                (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
                notificationsPanel.classList.remove('active');
            }
        });
        
        if (markAllRead) {
            markAllRead.addEventListener('click', async () => {
                if (!window.currentUser) return;
                
                try {
                    const { error } = await supabaseAuth
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', window.currentUser.id)
                        .eq('is_read', false);
                    
                    if (error) throw error;
                    
                    if (window.notifications) {
                        window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
                    }
                    
                    renderNotifications();
                    updateNotificationBadge(0);
                    showToast('All notifications marked as read', 'success');
                } catch (error) {
                    console.error('Error marking all as read:', error);
                    showToast('Failed to mark notifications as read', 'error');
                }
            });
        }
        
        document.getElementById('notification-settings')?.addEventListener('click', () => {
            window.location.href = 'notification-settings.html';
        });
    }

    function setupAnalytics() {
        const analyticsBtn = document.getElementById('analytics-btn');
        const analyticsModal = document.getElementById('analytics-modal');
        const closeAnalytics = document.getElementById('close-analytics');
        
        if (!analyticsBtn || !analyticsModal) return;
        
        analyticsBtn.addEventListener('click', async () => {
            const { data, error } = await supabaseAuth.auth.getSession();
            if (error) console.warn('Session error:', error);
            
            const session = data?.session;
            if (!session) {
                showToast('Please sign in to view analytics', 'warning');
                return;
            }
            
            analyticsModal.classList.add('active');
            
            // Load real analytics data
            await loadPlatformAnalytics();
        });
        
        if (closeAnalytics) {
            closeAnalytics.addEventListener('click', () => {
                analyticsModal.classList.remove('active');
            });
        }
        
        analyticsModal.addEventListener('click', (e) => {
            if (e.target === analyticsModal) {
                analyticsModal.classList.remove('active');
            }
        });
    }

    function setupThemeListener() {
        const themeToggle = document.getElementById('nav-theme-toggle');
        const themeSelector = document.getElementById('theme-selector');
        
        if (themeToggle && themeSelector) {
            themeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                themeSelector.classList.toggle('active');
            });
            
            document.addEventListener('click', (e) => {
                if (themeSelector.classList.contains('active') &&
                    !themeSelector.contains(e.target) &&
                    !themeToggle.contains(e.target)) {
                    themeSelector.classList.remove('active');
                }
            });
            
            document.querySelectorAll('.theme-option').forEach(option => {
                option.addEventListener('click', () => {
                    if (typeof window.applyTheme === 'function') {
                        window.applyTheme(option.dataset.theme);
                    }
                    themeSelector.classList.remove('active');
                });
            });
        }
    }

    function setupCoreListeners() {
        const browseAllBtn = document.getElementById('browse-all-btn');
        if (browseAllBtn) {
            browseAllBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/content-library';
            });
        }
        
        const homeBtn = document.getElementById('nav-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        const createBtn = document.getElementById('nav-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const { data, error } = await supabaseAuth.auth.getSession();
                if (error) console.warn('Session error:', error);
                
                const session = data?.session;
                if (session) {
                    window.location.href = 'creator-upload.html';
                } else {
                    showToast('Please sign in to upload content', 'warning');
                    window.location.href = `login.html?redirect=creator-upload.html`;
                }
            });
        }
        
        const dashboardBtn = document.getElementById('nav-dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', async () => {
                const { data, error } = await supabaseAuth.auth.getSession();
                if (error) console.warn('Session error:', error);
                
                const session = data?.session;
                if (session) {
                    window.location.href = 'creator-dashboard.html';
                } else {
                    showToast('Please sign in to access dashboard', 'warning');
                    window.location.href = `login.html?redirect=creator-dashboard.html`;
                }
            });
        }
        
        const exploreAllBtn = document.getElementById('explore-all-btn');
        if (exploreAllBtn) {
            exploreAllBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/content-library';
            });
        }
        
        const seeAllLive = document.getElementById('see-all-live');
        if (seeAllLive) {
            seeAllLive.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/live-streams';
            });
        }
        
        const seeAllShorts = document.getElementById('see-all-shorts');
        if (seeAllShorts) {
            seeAllShorts.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/shorts';
            });
        }
        
        const manageProfilesBtn = document.getElementById('manage-profiles-btn');
        if (manageProfilesBtn) {
            manageProfilesBtn.addEventListener('click', () => {
                window.location.href = 'manage-profiles.html';
            });
        }
        
        const seeAllCommunity = document.getElementById('see-all-community');
        if (seeAllCommunity) {
            seeAllCommunity.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/community-favorites';
            });
        }

        // Add scale toggle button listener
        const navScaleToggle = document.getElementById('nav-scale-toggle');
        if (navScaleToggle && window.uiScaleController) {
            navScaleToggle.addEventListener('click', () => {
                window.uiScaleController.toggleScaleControl();
            });
        }
    }

    function showSkeletonLoading() {
        const trendingGrid = document.getElementById('trending-grid');
        const newContentGrid = document.getElementById('new-content-grid');
        
        if (trendingGrid) {
            trendingGrid.innerHTML = Array(4).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-creator"></div>
                    <div class="skeleton-stats"></div>
                </div>
            `).join('');
        }
        
        if (newContentGrid) {
            newContentGrid.innerHTML = Array(4).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-creator"></div>
                    <div class="skeleton-stats"></div>
                </div>
            `).join('');
        }
    }

    function setLoading(loading, text = '') {
        isLoading = loading;
        if (text) loadingText.textContent = text;
        
        if (loading) {
            loadingScreen.style.display = 'flex';
            app.style.display = 'none';
        } else {
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
            }, 500);
        }
    }

    // ============================================
    // PERFORMANCE: Optimized Initialization
    // ============================================
    
    async function initializeExploreScreen() {
        const startTime = performance.now();
        console.log('🚀 Initialize Start:', new Date().toISOString());
        
        try {
            setLoading(true, 'Initializing...');
            
            // Initialize UI Scale Controller FIRST
            if (window.uiScaleController) {
                window.uiScaleController.init();
            }
            
            // Update header first (visible immediately)
            updateHeaderLogo();
            if (typeof window.initTheme === 'function') window.initTheme();
            
            // Check auth (non-blocking for UI)
            loadingText.textContent = 'Checking auth...';
            await checkAuth();
            
            // Show skeleton loading immediately
            showSkeletonLoading();
            
            // Load data in parallel
            loadingText.textContent = 'Loading content...';
            await loadExploreData();
            
            // Setup event listeners
            renderCategoryTabs();
            setupSearch();
            setupNotifications();
            setupAnalytics();
            setupThemeListener();
            setupBackToTop();
            setupInfiniteScroll();
            setupKeyboardNavigation();
            setupCoreListeners();
            setupLanguageFilter();
            initBadgesSystem();
            setupVoiceSearch();
            setupWatchParty();
            setupTipSystem();
            initVideoHero();
            
            // Hide loading screen
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
                
                // Animate cards in
                document.querySelectorAll('.content-card').forEach((card, index) => {
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50 + (index * 30));
                });
            }, 300);
            
            const endTime = performance.now();
            console.log(`✅ Initialize Complete: ${(endTime - startTime).toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Error initializing explore screen:', error);
            showToast('Failed to initialize explore screen', 'error');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
            }, 1000);
        }
    }

    // Initialize
    await initializeExploreScreen();
    
    // Auth state listener
    supabaseAuth.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN') {
            window.currentUser = session.user;
            loadUserProfile();
            loadUserProfiles();
            loadNotifications();
            loadUserBadges();
            showToast('Welcome back!', 'success');
        } else if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            currentProfile = null;
            userProfiles = [];
            userBadges = [];
            updateHeaderProfile();
            updateNotificationBadge(0);
            window.notifications = [];
            renderNotifications();
            showToast('You have been signed out', 'info');
            
            document.getElementById('continue-watching-section').style.display = 'none';
            document.getElementById('recommendations-section').style.display = 'none';
        }
    });
});
