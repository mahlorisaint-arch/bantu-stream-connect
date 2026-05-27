/**
 * Wavelets Module (formerly Quick Bits)
 * Handles short-form vertical content with horizontal scrolling,
 * optimized for mobile viewing and quick engagement.
 */

const Wavelets = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    
    // Configuration
    const CACHE_KEY = 'feed_wavelets';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const MAX_ITEMS = 15;
    const REFRESH_INTERVAL = 60000; // 1 minute
    
    /**
     * Initialize Wavelets module
     */
    async function init() {
        console.log('🌊 Wavelets Module initializing...');
        
        section = document.getElementById('wavelets-section');
        container = document.getElementById('wavelets-container');
        
        if (!section || !container) {
            console.warn('Wavelets elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Add scroll indicator
        addScrollIndicator();
        
        // Start background refresh
        startBackgroundRefresh();
        
        console.log('✅ Wavelets Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('wavelets-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'wavelets-section';
            newSection.className = 'section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-bolt" style="color: var(--warm-gold);"></i>
                        WAVELETS
                        <span class="wavelet-badge-header">Short & Sweet</span>
                    </h2>
                    <a href="#" class="see-all-btn" id="see-all-wavelets">
                        See All
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
                <div id="wavelets-container" class="wavelets-container"></div>
            `;
            
            const forYouSection = document.getElementById('for-you-section');
            if (forYouSection && forYouSection.parentNode) {
                forYouSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('wavelets-section');
        container = document.getElementById('wavelets-container');
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
            console.log('👤 Wavelets user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load wavelet content
     */
    async function loadContent() {
        console.log('🌊 Loading Wavelets...');
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Wavelets: Using cached data,', cachedData.length, 'items');
            renderWavelets(cachedData);
            // Refresh in background
            refreshInBackground();
            return;
        }
        
        // Show skeletons
        showSkeletons();
        
        try {
            const contentList = await fetchWavelets();
            
            if (!contentList || contentList.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            const sectionData = await buildSectionData(contentList);
            
            // Render
            renderWavelets(sectionData);
            
            // Cache the result
            saveToCache(sectionData);
            
            console.log('✅ Wavelets loaded:', sectionData.length, 'items');
            
        } catch (err) {
            console.error("❌ Wavelets Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch wavelets from Supabase
     */
    async function fetchWavelets() {
        try {
            // Fetch short content (duration <= 60 seconds or media_type = 'short')
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('status', 'published')
                .or(`media_type.eq.short,duration.lte.60`)
                .order('views_count', { ascending: false })
                .limit(MAX_ITEMS);
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching wavelets:', err);
            return [];
        }
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
     * Render wavelets
     */
    function renderWavelets(contents) {
        container.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        
        contents.forEach((content, index) => {
            if (!content) return;
            
            const thumbnailUrl = fixMediaUrl(content.thumbnail_url) || 
                'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
            
            const creatorProfile = content.user_profiles;
            const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
            const creatorUsername = creatorProfile?.username || 'creator';
            const durationFormatted = formatDuration(content.duration || 0);
            const initials = getInitials(creatorName);
            
            // Determine if content is trending (high views relative to others)
            const isTrending = (content.metrics?.views || 0) > 5000;
            
            // Avatar HTML
            let avatarHtml = '';
            if (creatorProfile?.avatar_url) {
                const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
                avatarHtml = `
                    <img src="${avatarUrl}" 
                         alt="${escapeHtml(creatorName)}" 
                         loading="lazy"
                         style="width:100%;height:100%;object-fit:cover;"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<span style=\'color:white;font-weight:bold;\'>${initials}</span>';">
                `;
            } else {
                avatarHtml = `<span style="color:white;font-weight:bold;">${initials}</span>`;
            }
            
            const card = document.createElement('a');
            card.className = 'wavelet-card';
            card.href = `shorts-detail.html?id=${content.id}`;
            card.dataset.contentId = content.id;
            card.dataset.language = content.language || 'en';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            card.innerHTML = `
                <div class="wavelet-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';">
                    <div class="wavelet-overlay">
                        <i class="fas fa-play"></i>
                    </div>
                    <div class="wavelet-badge">
                        <i class="fas fa-bolt"></i> WAVELET
                    </div>
                    ${content.duration > 0 ? `<div class="wavelet-duration">${durationFormatted}</div>` : ''}
                    <div class="wavelet-views">
                        <i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}
                    </div>
                </div>
                <div class="wavelet-info">
                    <div class="wavelet-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 30)}</div>
                    <div class="wavelet-creator">
                        <div class="wavelet-creator-avatar">${avatarHtml}</div>
                        <div class="wavelet-creator-name">@${escapeHtml(creatorUsername)}</div>
                    </div>
                    <div class="wavelet-stats">
                        <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                        <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                        <span class="wavelet-connectors">
                            <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)}
                        </span>
                        ${isTrending ? '<span class="trending-flame"><i class="fas fa-fire" style="color: var(--warm-gold);"></i></span>' : ''}
                    </div>
                </div>
            `;
            
            fragment.appendChild(card);
            
            // Staggered animation
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            }, index * 50);
        });
        
        container.appendChild(fragment);
        
        // Add scroll indicator if content overflows
        checkScrollable();
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        container.innerHTML = Array(6).fill().map(() => `
            <div class="wavelet-skeleton">
                <div class="wavelet-skeleton-thumbnail"></div>
                <div class="wavelet-skeleton-title"></div>
                <div class="wavelet-skeleton-creator"></div>
            </div>
        `).join('');
    }
    
    /**
     * Show empty state
     */
    function showEmptyState() {
        container.innerHTML = `
            <div class="wavelets-empty" style="width: 100%; text-align: center;">
                <i class="fas fa-bolt"></i>
                <p>No wavelets available yet</p>
                <p style="font-size: 12px;">Check back soon for short-form content!</p>
            </div>
        `;
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        container.innerHTML = `
            <div class="wavelets-empty" style="width: 100%; text-align: center;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Unable to load wavelets</p>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Check if container is scrollable and add indicator
     */
    function checkScrollable() {
        if (!container) return;
        
        const isScrollable = container.scrollWidth > container.clientWidth;
        
        if (isScrollable) {
            container.classList.add('scrollable');
        } else {
            container.classList.remove('scrollable');
        }
    }
    
    /**
     * Add scroll indicator
     */
    function addScrollIndicator() {
        if (!section) return;
        
        // Check if indicator already exists
        if (section.querySelector('.wavelets-scroll-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'wavelets-scroll-indicator';
        indicator.innerHTML = '<i class="fas fa-chevron-right"></i>';
        section.style.position = 'relative';
        section.appendChild(indicator);
        
        // Hide indicator after user scrolls
        if (container) {
            container.addEventListener('scroll', () => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) indicator.remove();
                }, 300);
            }, { once: true });
        }
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-wavelets');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://bantustreamconnect.com/wavelets';
            });
        }
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            const newContent = await fetchWavelets();
            if (newContent && newContent.length > 0) {
                const cachedData = loadFromCache();
                if (cachedData && cachedData.length !== newContent.length) {
                    console.log('🔄 New wavelets detected, refreshing...');
                    await loadContent();
                }
            }
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
        console.log('🌊 Wavelets Module destroyed');
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
    document.addEventListener('DOMContentLoaded', () => Wavelets.init());
} else {
    Wavelets.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Wavelets;
}
