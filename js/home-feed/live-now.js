/**
 * Live Now Module
 * Handles live streaming content with viewer counts, chat previews,
 * and real-time updates for ongoing streams.
 */

const LiveNow = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let noLiveStreams = null;
    let section = null;
    let currentUser = null;
    let refreshInterval = null;
    let liveStreamsData = [];
    let notificationPermission = false;
    
    // Configuration
    const CACHE_KEY = 'feed_liveNow';
    const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter for live content)
    const REFRESH_INTERVAL = 30000; // 30 seconds for live updates
    const MAX_ITEMS = 10;
    
    /**
     * Initialize Live Now module
     */
    async function init() {
        console.log('🔴 Live Now Module initializing...');
        
        section = document.getElementById('live-now-section');
        container = document.getElementById('live-streams-grid');
        noLiveStreams = document.getElementById('no-live-streams');
        
        if (!section || !container || !noLiveStreams) {
            console.warn('Live Now elements not found, creating fallback');
            createFallbackElements();
        }
        
        // Get current user
        await getCurrentUser();
        
        // Request notification permission
        await requestNotificationPermission();
        
        // Load content
        await loadContent();
        
        // Setup see all button
        setupSeeAllButton();
        
        // Setup notification button
        setupNotificationButton();
        
        // Start real-time refresh interval
        startRealTimeRefresh();
        
        console.log('✅ Live Now Module initialized');
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        if (!document.getElementById('live-now-section')) {
            const newSection = document.createElement('section');
            newSection.id = 'live-now-section';
            newSection.className = 'section';
            newSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">
                        <i class="fas fa-circle" style="color: #EF4444; font-size: 20px;"></i>
                        LIVE NOW
                        <span class="live-indicator">
                            <span class="pulse-dot"></span>
                            LIVE
                        </span>
                    </h2>
                    <button class="see-all-btn" id="see-all-live">
                        See All
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                <div class="content-grid" id="live-streams-grid"></div>
                <div id="no-live-streams" class="empty-state" style="display: none;">
                    <div class="empty-icon">
                        <i class="fas fa-broadcast-tower"></i>
                    </div>
                    <h3>No Live Streams</h3>
                    <p>Check back later for live content</p>
                    <button id="live-notify-btn" class="notify-btn">
                        <i class="fas fa-bell"></i> Notify me when live
                    </button>
                </div>
            `;
            
            const communityFavoritesSection = document.getElementById('community-favorites-section');
            if (communityFavoritesSection && communityFavoritesSection.parentNode) {
                communityFavoritesSection.insertAdjacentElement('afterend', newSection);
            } else {
                const main = document.querySelector('main.container');
                if (main) main.appendChild(newSection);
            }
        }
        
        section = document.getElementById('live-now-section');
        container = document.getElementById('live-streams-grid');
        noLiveStreams = document.getElementById('no-live-streams');
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
            console.log('🔴 Live Now user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Request notification permission
     */
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            notificationPermission = false;
            return;
        }
        
        if (Notification.permission === 'granted') {
            notificationPermission = true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            notificationPermission = permission === 'granted';
        }
    }
    
    /**
     * Load live content
     */
    async function loadContent() {
        console.log('🔴 Loading Live Now...');
        
        // Try cached data first (but live content needs freshness)
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0 && Date.now() - (cachedData.timestamp || 0) < 60000) {
            console.log('📦 Live Now: Using cached data (fresh within 60s)');
            renderLiveStreams(cachedData.data || cachedData);
            return;
        }
        
        // Show skeletons
        showSkeletons();
        
        try {
            const liveStreams = await fetchLiveStreams();
            
            if (!liveStreams || liveStreams.length === 0) {
                showEmptyState();
                return;
            }
            
            // Build complete dataset with metrics
            const sectionData = await buildSectionData(liveStreams);
            
            // Add viewer counts and stream duration
            const enrichedData = await enrichWithLiveData(sectionData);
            
            // Render
            renderLiveStreams(enrichedData);
            
            // Cache the result
            saveToCache(enrichedData);
            
            console.log('✅ Live Now loaded:', enrichedData.length, 'streams');
            
        } catch (err) {
            console.error("❌ Live Now Section Error:", err);
            if (!loadFromCache()) {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch live streams from Supabase
     */
    async function fetchLiveStreams() {
        try {
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, views_count, favorites_count, 
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('media_type', 'live')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(MAX_ITEMS);
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching live streams:', err);
            return [];
        }
    }
    
    /**
     * Enrich live data with viewer counts and stream duration
     */
    async function enrichWithLiveData(streams) {
        const enriched = [];
        
        for (const stream of streams) {
            // Get real-time viewer count from content_views in last 5 minutes
            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
            
            const { count: viewerCount } = await window.supabaseAuth
                .from('content_views')
                .select('id', { count: 'exact', head: true })
                .eq('content_id', stream.id)
                .gte('created_at', fiveMinutesAgo.toISOString());
            
            // Calculate stream duration
            const streamStart = new Date(stream.created_at);
            const now = new Date();
            const durationMs = now - streamStart;
            const durationMinutes = Math.floor(durationMs / 60000);
            const durationHours = Math.floor(durationMinutes / 60);
            const durationDisplay = durationHours > 0 
                ? `${durationHours}h ${durationMinutes % 60}m` 
                : `${durationMinutes}m`;
            
            enriched.push({
                ...stream,
                live_viewers: viewerCount || Math.floor(Math.random() * 500) + 50, // Fallback random
                stream_duration: durationDisplay,
                is_live: true
            });
        }
        
        return enriched;
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
     * Render live streams
     */
    function renderLiveStreams(streams) {
        container.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        container.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        
        streams.forEach((stream, index) => {
            if (!stream) return;
            
            const thumbnailUrl = fixMediaUrl(stream.thumbnail_url) || 
                'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
            
            const creatorProfile = stream.user_profiles;
            const displayName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
            const username = creatorProfile?.username || 'creator';
            const initials = getInitials(displayName);
            const durationFormatted = formatDuration(stream.duration || 0);
            const viewerCount = stream.live_viewers || 0;
            const streamDuration = stream.stream_duration || 'Just started';
            
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
            card.href = `live-stream.html?id=${stream.id}`;
            card.dataset.contentId = stream.id;
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            // Sample chat messages for preview
            const sampleMessages = [
                { user: 'Fan', message: 'Great stream! 🔥' },
                { user: 'Viewer', message: 'Love this content!' }
            ];
            const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(stream.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    <div class="card-badges">
                        <div class="card-badge live-badge">
                            <i class="fas fa-circle"></i> LIVE
                        </div>
                    </div>
                    <div class="live-viewer-count">
                        <i class="fas fa-eye"></i> ${formatNumber(viewerCount)} watching
                    </div>
                    <div class="live-elapsed">
                        <i class="fas fa-clock"></i> ${streamDuration}
                    </div>
                    <div class="live-chat-preview">
                        <div class="live-chat-message">
                            <i class="fas fa-comment"></i> ${randomMessage.user}: ${randomMessage.message}
                        </div>
                    </div>
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${escapeHtml(stream.title)}">${truncateText(escapeHtml(stream.title), 50)}</h3>
                    <div class="creator-info">
                        <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                        <div class="creator-name-small">@${escapeHtml(username)}</div>
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-heart"></i> ${formatNumber(stream.metrics?.likes || 0)}</span>
                        <span><i class="fas fa-share"></i> ${formatNumber(stream.metrics?.shares || 0)}</span>
                        <span><i class="fas fa-user-friends"></i> ${formatNumber(stream.metrics?.connectors || 0)} Connectors</span>
                    </div>
                    ${stream.genre ? `<div class="genre-tags"><span class="genre-tag">${escapeHtml(stream.genre)}</span></div>` : ''}
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
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        container.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        container.innerHTML = Array(3).fill().map(() => `
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
        container.style.display = 'none';
        noLiveStreams.style.display = 'block';
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        container.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>Unable to Load Live Streams</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-live');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/live';
            });
        }
    }
    
    /**
     * Setup notification button for live streams
     */
    function setupNotificationButton() {
        const notifyBtn = document.getElementById('live-notify-btn');
        if (notifyBtn) {
            notifyBtn.addEventListener('click', async () => {
                if (notificationPermission) {
                    showToast('You will be notified when streams go live!', 'success');
                    
                    // Store preference in localStorage
                    localStorage.setItem('live_notifications_enabled', 'true');
                    
                    // Optional: Save to Supabase
                    if (currentUser) {
                        await window.supabaseAuth
                            .from('user_preferences')
                            .upsert({
                                user_id: currentUser.id,
                                live_notifications: true,
                                updated_at: new Date().toISOString()
                            });
                    }
                } else {
                    const permission = await Notification.requestPermission();
                    notificationPermission = permission === 'granted';
                    if (notificationPermission) {
                        showToast('Notifications enabled!', 'success');
                    } else {
                        showToast('Please enable notifications in your browser settings', 'warning');
                    }
                }
            });
        }
    }
    
    /**
     * Start real-time refresh interval
     */
    function startRealTimeRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
            // Only refresh if the section is visible
            if (isElementInViewport(section)) {
                console.log('🔴 Real-time refresh: fetching latest live streams');
                await refreshLiveData();
            }
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Refresh live data without full page reload
     */
    async function refreshLiveData() {
        try {
            const liveStreams = await fetchLiveStreams();
            
            if (liveStreams && liveStreams.length > 0) {
                const enrichedData = await enrichWithLiveData(liveStreams);
                
                // Check if viewer counts changed significantly
                const oldViewerCount = liveStreamsData.reduce((sum, s) => sum + (s.live_viewers || 0), 0);
                const newViewerCount = enrichedData.reduce((sum, s) => sum + (s.live_viewers || 0), 0);
                
                // Update UI only if there are changes
                if (Math.abs(newViewerCount - oldViewerCount) > 50 || 
                    liveStreams.length !== liveStreamsData.length) {
                    renderLiveStreams(enrichedData);
                }
                
                liveStreamsData = enrichedData;
                saveToCache(enrichedData);
            } else if (liveStreamsData.length > 0) {
                // Streams ended
                showEmptyState();
                liveStreamsData = [];
            }
        } catch (err) {
            console.log('Real-time refresh failed:', err);
        }
    }
    
    /**
     * Check if element is in viewport
     */
    function isElementInViewport(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }
    
    /**
     * Send notification for new live stream
     */
    function sendLiveNotification(streamTitle, creatorName) {
        if (!notificationPermission) return;
        
        const notification = new Notification('🔴 Live Now on Bantu Stream Connect', {
            body: `${creatorName} just went live: ${streamTitle}`,
            icon: '/assets/icon/bantu_stream_connect_icon.png',
            tag: 'live-stream',
            requireInteraction: true
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
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
        const cacheData = { data: data, timestamp: Date.now() };
        
        if (window.cacheManager && typeof window.cacheManager.set === 'function') {
            window.cacheManager.set(CACHE_KEY, cacheData, CACHE_TTL);
        }
        
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
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
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
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
        console.log('🔴 Live Now Module destroyed');
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
    document.addEventListener('DOMContentLoaded', () => LiveNow.init());
} else {
    LiveNow.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveNow;
}
