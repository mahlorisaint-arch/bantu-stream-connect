/**
 * Continue Watching Module
 * Handles resume playback with progress tracking, caching, and background refresh.
 */

const ContinueWatching = (function() {
    'use strict';
    
    // Private variables
    let section = null;
    let container = null;
    let currentUser = null;
    let refreshInterval = null;
    
    // Configuration
    const CACHE_KEY = 'feed_continueWatching';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const MAX_ITEMS = 20;
    const REFRESH_INTERVAL = 60000; // 1 minute background refresh
    
    /**
     * Initialize Continue Watching module
     */
    async function init() {
        console.log('📺 Continue Watching Module initializing...');
        
        section = document.getElementById('continue-watching-section');
        container = document.getElementById('continue-watching-grid');
        
        if (!section || !container) {
            console.warn('Continue Watching elements not found');
            return;
        }
        
        // Get current user
        await getCurrentUser();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Start background refresh interval
        startBackgroundRefresh();
        
        console.log('✅ Continue Watching Module initialized');
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
                console.log('👤 User authenticated for Continue Watching:', currentUser.id);
            } else {
                console.log('👤 No user logged in for Continue Watching');
            }
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-continue');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                if (!currentUser) {
                    e.preventDefault();
                    showToast('Please sign in to view watch history', 'warning');
                    window.location.href = `login.html?redirect=watch-history.html`;
                    return;
                }
                // Allow default navigation to watch-history.html
            });
        }
    }
    
    /**
     * Load continue watching content
     */
    async function loadContent() {
        console.log('📺 Loading Continue Watching...');
        
        // Try cached data first for instant display
        const cachedData = loadFromCache();
        if (cachedData && cachedData.data && cachedData.data.length > 0) {
            console.log('📦 Continue Watching: Using cached data,', cachedData.data.length, 'items');
            section.style.display = 'block';
            container.innerHTML = '';
            renderCards(cachedData.data, cachedData.progressMap || {});
            animateCards();
            
            // Still refresh in background
            refreshInBackground();
            return;
        }
        
        // Show skeletons while loading
        showSkeletons();
        section.style.display = 'block';
        
        // If not logged in, hide section
        if (!currentUser) {
            console.log('ℹ️ No user logged in, hiding continue watching');
            setTimeout(() => {
                section.style.display = 'none';
            }, 1000);
            return;
        }
        
        try {
            await fetchAndRenderContent();
        } catch (err) {
            console.error("❌ Continue Watching Section Error:", err);
            handleError();
        }
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
     * Fetch and render content from API
     */
    async function fetchAndRenderContent() {
        // Fetch watch progress
        const { data: watchProgress, error } = await window.supabaseAuth
            .from('watch_progress')
            .select('content_id, last_position, total_watch_time, is_completed, updated_at')
            .eq('user_id', currentUser.id)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .order('updated_at', { ascending: false })
            .limit(MAX_ITEMS);
        
        if (error) throw error;
        
        if (!watchProgress || watchProgress.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Get content IDs
        const contentIds = watchProgress.map(item => item.content_id).filter(Boolean);
        
        if (contentIds.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Fetch content details
        const { data: contentData, error: contentError } = await window.supabaseAuth
            .from('Content')
            .select(`
                id, 
                title, 
                thumbnail_url, 
                duration, 
                genre, 
                language, 
                user_id,
                user_profiles!user_id (
                    id, 
                    full_name, 
                    username, 
                    avatar_url
                )
            `)
            .in('id', contentIds)
            .eq('status', 'published');
        
        if (contentError) throw contentError;
        
        if (!contentData || contentData.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Build progress map
        const progressMap = {};
        watchProgress.forEach(item => {
            const content = contentData.find(c => c.id === item.content_id);
            if (content && content.duration && content.duration > 0) {
                const progress = Math.min(100, Math.floor((item.last_position / content.duration) * 100));
                progressMap[item.content_id] = {
                    progress: progress,
                    current: item.last_position,
                    total: content.duration,
                    last_updated: item.updated_at
                };
            } else if (content && content.duration === 0) {
                // Handle case where duration is 0 (live streams or shorts)
                progressMap[item.content_id] = {
                    progress: 0,
                    current: 0,
                    total: 0,
                    last_updated: item.updated_at
                };
            }
        });
        
        // Get metrics for content
        const metrics = await fetchMetrics(contentData);
        
        // Enrich content with metrics
        const enrichedData = contentData.map(item => ({
            ...item,
            metrics: {
                views: metrics.views[item.id] || 0,
                likes: metrics.likes[item.id] || 0,
                shares: metrics.shares[item.id] || 0,
                connectors: metrics.connectors[item.user_id] || 0
            }
        }));
        
        // Cache the data
        saveToCache(enrichedData, progressMap);
        
        // Render
        section.style.display = 'block';
        container.innerHTML = '';
        renderCards(enrichedData, progressMap);
        animateCards();
        
        console.log('✅ Continue Watching loaded:', enrichedData.length, 'items');
    }
    
    /**
     * Fetch metrics for content
     */
    async function fetchMetrics(contentList) {
        const contentIds = contentList.map(c => c.id);
        const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
        
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
     * Fetch connector counts for creators
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
     * Render continue watching cards
     */
    function renderCards(contents, progressMap) {
        container.innerHTML = '';
        
        contents.forEach(content => {
            if (!content) return;
            
            const progress = progressMap[content.id] || { progress: 0, current: 0, total: 0 };
            const connectorCount = content.metrics?.connectors || 0;
            
            const thumbnailUrl = fixMediaUrl(content.thumbnail_url) || 
                'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
            
            const creatorProfile = content.user_profiles;
            const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
            const creatorUsername = creatorProfile?.username || 'creator';
            const initials = getInitials(creatorName);
            
            const durationFormatted = formatDuration(progress.total || content.duration || 0);
            const currentFormatted = formatDuration(progress.current || 0);
            
            // Avatar HTML with error handling
            let avatarHtml = '';
            if (creatorProfile?.avatar_url) {
                const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
                avatarHtml = `
                    <img src="${avatarUrl}" 
                         alt="${escapeHtml(creatorName)}" 
                         loading="lazy" 
                         style="width:100%;height:100%;object-fit:cover;border-radius:50%;" 
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">
                `;
            } else {
                avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
            }
            
            const card = document.createElement('a');
            card.className = 'content-card';
            card.href = `content-detail.html?id=${content.id}&resume=true`;
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
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        <div class="card-badge continue-badge">
                            <i class="fas fa-play-circle"></i> CONTINUE
                        </div>
                    </div>
                    <div class="thumbnail-overlay"></div>
                    
                    <!-- Progress Bar -->
                    <div class="watch-progress-container">
                        <div class="watch-progress-bar" style="width: ${progress.progress}%"></div>
                    </div>
                    
                    <div class="play-overlay">
                        <div class="play-icon"><i class="fas fa-play"></i></div>
                    </div>
                    ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                    <div class="creator-info">
                        <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                        <div class="creator-name-small">@${escapeHtml(creatorUsername)}</div>
                    </div>
                    
                    <!-- Resume Time Display -->
                    <div class="card-meta">
                        <span class="resume-time"><i class="fas fa-clock"></i> ${currentFormatted} / ${durationFormatted}</span>
                        <span class="progress-percent">${progress.progress}%</span>
                    </div>
                    
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(connectorCount)} Connectors
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }
    
    /**
     * Animate cards with stagger effect
     */
    function animateCards() {
        const cards = document.querySelectorAll('#continue-watching-grid .content-card');
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                card.classList.add('visible');
            }, i * 50);
        });
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        try {
            if (!currentUser) return;
            
            // Check if there's new watch progress
            const { data: watchProgress } = await window.supabaseAuth
                .from('watch_progress')
                .select('content_id, last_position, updated_at')
                .eq('user_id', currentUser.id)
                .eq('is_completed', false)
                .neq('last_position', 0)
                .order('updated_at', { ascending: false })
                .limit(5);
            
            if (watchProgress && watchProgress.length > 0) {
                // Check if we need to refresh (new content or updated progress)
                const cachedData = loadFromCache();
                if (cachedData && cachedData.data) {
                    const cachedIds = cachedData.data.map(c => c.id);
                    const newIds = watchProgress.map(w => w.content_id);
                    const hasNewContent = newIds.some(id => !cachedIds.includes(id));
                    
                    if (hasNewContent) {
                        console.log('🔄 New continue watching content detected, refreshing...');
                        await fetchAndRenderContent();
                    }
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
            if (currentUser) {
                refreshInBackground();
            }
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Load from cache
     */
    function loadFromCache() {
        if (window.cacheManager && typeof window.cacheManager.get === 'function') {
            return window.cacheManager.get(CACHE_KEY);
        }
        
        // Fallback to localStorage
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
    function saveToCache(data, progressMap) {
        const cacheData = { data: data, progressMap: progressMap };
        
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            window.cacheManager.set(CACHE_KEY, cacheData, CACHE_TTL);
        }
        
        // Also save to localStorage as fallback
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: cacheData,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save to localStorage cache:', e);
        }
    }
    
    /**
     * Handle error state
     */
    function handleError() {
        setTimeout(() => {
            if (container && container.innerHTML.includes('skeleton')) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <h3>Unable to load continue watching</h3>
                        <button class="see-all-btn" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }, 3000);
    }
    
    /**
     * Fix media URL for Supabase storage
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
     * Format duration in seconds to MM:SS or HH:MM:SS
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    
    /**
     * Format number with K/M suffixes
     */
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Get initials from name
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
     * Escape HTML special characters
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
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Refresh module
     */
    async function refresh() {
        await getCurrentUser();
        await fetchAndRenderContent();
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
        console.log('📺 Continue Watching Module destroyed');
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
    document.addEventListener('DOMContentLoaded', () => ContinueWatching.init());
} else {
    ContinueWatching.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinueWatching;
}
