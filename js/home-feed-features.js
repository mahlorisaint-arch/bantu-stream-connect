// ============================================
// HOME FEED INITIALIZATION - PRODUCTION ARCHITECTURE
// ============================================

// ============================================
// UTILITY FUNCTIONS (MUST BE DEFINED FIRST)
// ============================================

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
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
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
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

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                        type === 'error' ? 'fa-exclamation-circle' : 
                        type === 'warning' ? 'fa-exclamation-triangle' : 
                        'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home Feed Initializing (Production Mode)');
    
    // Override loading text
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Building Your Feed...';
    
    // Initialize the feed sequentially for stability
    await initializeHomeFeed();
});

// ============================================
// HOME FEED CONTROLLER
// ============================================
async function initializeHomeFeed() {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    try {
        console.log("🚀 Initializing Home Feed (Production Mode)");
        
        // Check authentication first
        await checkAuth();
        
        // Update app icon
        updateAppIcon();
        
        // Load user profiles if authenticated
        if (window.currentUser) {
            await loadUserProfiles();
        }
        
        // Load sections sequentially for stability
        await loadCinematicHero();                // Hero section first
        await loadContinueWatchingSection();      // Section 1
        await loadForYouSection();                // Section 2
        await loadFollowingSection();             // Section 3
        await loadShortsSection();                // Section 4
        await loadCommunityFavoritesSection();    // Section 5
        await loadLiveStreamsSection();           // Live streams
        await loadTrendingSection();              // Section 6
        await loadNewContentSection();            // Section 7
        await loadFeaturedCreatorsSection();      // Creators
        await loadEventsSection();                // Events
        await loadCommunityStats();                // Stats
        
        // Initialize UI components (non-data dependent)
        setupSidebar();
        setupLanguageFilter();
        setupSearch();
        setupNotifications();
        setupAnalytics();
        setupVoiceSearch();
        setupWatchParty();
        setupTipSystem();
        setupBackToTop();
        setupInfiniteScroll();
        setupKeyboardNavigation();
        updateWelcomeMessage();
        updateHeaderProfile();
        renderCategoryTabs();
        setupNavigationButtons();
        
        // Hide loading screen and show content
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
        }, 500);
        
        console.log("✅ Home Feed Loaded Successfully");
        
    } catch (err) {
        console.error("❌ Home Feed Initialization Error:", err);
        showToast('Failed to load home feed', 'error');
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.style.display = 'block';
        }, 1000);
    }
}

// ============================================
// METRICS AGGREGATOR - FIXED CONNECTOR COUNTS
// ============================================

// Master builder - composes complete dataset for a section
async function buildSectionData(contentList) {
    if (!contentList || contentList.length === 0) return [];
    
    const contentIds = contentList.map(c => c.id);
    const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
    
    console.log('📊 Fetching metrics for', contentIds.length, 'content items and', creatorIds.length, 'creators');
    
    const metrics = await fetchAllMetrics(contentIds, creatorIds);
    
    // Enrich content with metrics
    return contentList.map(item => ({
        ...item,
        metrics: {
            views: metrics.views[item.id] || 0,
            likes: metrics.likes[item.id] || 0,
            shares: metrics.shares[item.id] || 0,
            favorites: item.favorites_count || 0,
            connectors: metrics.connectors[item.user_id] || 0  // ✅ Ensure this is set
        }
    }));
}

// Fetch all metrics in parallel
async function fetchAllMetrics(contentIds, creatorIds) {
    console.log('📊 Fetching metrics - Content IDs:', contentIds, 'Creator IDs:', creatorIds);
    
    const [viewsRes, likesRes, sharesRes, connectorsRes] = await Promise.all([
        fetchViewCounts(contentIds),
        fetchLikeCounts(contentIds),
        fetchShareCounts(contentIds),
        fetchConnectorCounts(creatorIds)
    ]);
    
    console.log('📊 Metrics fetched - Views:', Object.keys(viewsRes).length, 
                'Connectors:', Object.keys(connectorsRes).length);
    
    return {
        views: viewsRes,
        likes: likesRes,
        shares: sharesRes,
        connectors: connectorsRes
    };
}

// View counts
async function fetchViewCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_views")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching view counts:', error);
        return {};
    }
}

// Like counts
async function fetchLikeCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_likes")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching like counts:', error);
        return {};
    }
}

// Share counts
async function fetchShareCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_shares")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching share counts:', error);
        return {};
    }
}

// Connector counts per creator - FIXED
async function fetchConnectorCounts(creatorIds) {
    if (!creatorIds || creatorIds.length === 0) {
        console.log('⚠️ No creator IDs to fetch connector counts for');
        return {};
    }
    
    try {
        console.log('📊 Fetching connector counts for creators:', creatorIds);
        
        const { data, error } = await supabaseAuth
            .from("connectors")
            .select("connected_id")
            .in("connected_id", creatorIds)
            .eq("connection_type", "creator");  // ✅ Ensure we're only counting creator connections
        
        if (error) {
            console.error('Error fetching connector counts:', error);
            return {};
        }
        
        const counts = {};
        data?.forEach(row => {
            counts[row.connected_id] = (counts[row.connected_id] || 0) + 1;
        });
        
        console.log('📊 Connector counts result:', counts);
        return counts;
    } catch (error) {
        console.error('Error fetching connector counts:', error);
        return {};
    }
}

// ============================================
// SECTION 1: CONTINUE WATCHING - FIXED
// ============================================
async function loadContinueWatchingSection() {
    const section = document.getElementById('continue-watching-section');
    const container = document.getElementById('continue-watching-grid');
    if (!section || !container) return;
    
    // Hide section if user not logged in
    if (!window.currentUser) {
        section.style.display = 'none';
        return;
    }
    
    try {
        console.log('📺 Loading Continue Watching for user:', window.currentUser.id);
        
        // ✅ 1️⃣ Fetch from watch_progress table (NOT content_views)
        const { data: watchProgress, error } = await supabaseAuth
            .from('watch_progress')
            .select(`
                content_id,
                last_position,
                total_watch_time,
                is_completed,
                updated_at,
                Content (
                    id,
                    title,
                    thumbnail_url,
                    duration,
                    genre,
                    status,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', window.currentUser.id)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .eq('Content.status', 'published')
            .order('updated_at', { ascending: false })
            .limit(20);
        
        if (error) {
            console.error('❌ Continue Watching query error:', error);
            throw error;
        }
        
        console.log('📊 Watch progress data:', watchProgress);
        
        // Filter out null content
        const contentList = (watchProgress || [])
            .filter(item => item.Content !== null)
            .map(item => ({
                ...item.Content,
                watch_progress: {
                    last_position: item.last_position,
                    total_watch_time: item.total_watch_time,
                    updated_at: item.updated_at
                }
            }));
        
        if (contentList.length === 0) {
            console.log('ℹ️ No continue watching content found');
            section.style.display = 'none';
            return;
        }
        
        // ✅ 2️⃣ Build complete dataset with metrics (including connectors)
        console.log('📊 Building section data with metrics for', contentList.length, 'items');
        const sectionData = await buildSectionData(contentList);
        
        // ✅ 3️⃣ Create progress map with ACTUAL watch times
        const progressMap = {};
        watchProgress.forEach(item => {
            if (item.content_id && item.Content) {
                const duration = item.Content.duration || 1;
                const position = item.last_position || 0;
                const progress = Math.min(100, Math.floor((position / duration) * 100)) || 0;
                
                progressMap[item.content_id] = {
                    progress: progress,
                    current: position,
                    total: duration
                };
                
                console.log('📍 Progress for content', item.content_id, ':', {
                    position: position,
                    duration: duration,
                    progress: progress + '%'
                });
            }
        });
        
        // ✅ 4️⃣ Debug: Log connector counts
        console.log('📊 Connector counts in section data:', 
            sectionData.map(item => ({
                id: item.id,
                title: item.title,
                creator: item.user_profiles?.username,
                connectors: item.metrics?.connectors
            }))
        );
        
        // ✅ 5️⃣ Render with correct progress data
        section.style.display = 'block';
        renderContinueWatchingCards(container, sectionData, progressMap);
        
    } catch (err) {
        console.error("❌ Continue Watching Section Error:", err);
        section.style.display = 'none';
    }
}

// Specialized renderer for continue watching (includes progress)
function renderContinueWatchingCards(container, contents, progressMap) {
    container.innerHTML = '';
    
    console.log('🎨 Rendering', contents.length, 'continue watching cards');
    console.log('📊 Progress map:', progressMap);
    
    contents.forEach(content => {
        if (!content) return;
        
        // ✅ Get ACTUAL progress from watch_progress table
        const progress = progressMap[content.id] || { progress: 0, current: 0, total: 0 };
        const connectorCount = content.metrics?.connectors || 0;
        
        console.log('🎨 Card:', content.id, '- Connectors:', connectorCount);
        
        const thumbnailUrl = content.thumbnail_url
            ? contentSupabase.fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
        const initials = getInitials(creatorName);
        
        const durationFormatted = formatDuration(progress.total || content.duration || 0);
        const currentFormatted = formatDuration(progress.current || 0);
        
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = contentSupabase.fixMediaUrl(creatorProfile.avatar_url);
            avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(creatorName)}" loading="lazy">`;
        } else {
            avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
        }
        
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}&resume=true`;
        card.dataset.contentId = content.id;
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        
        // ✅ HTML with CORRECT progress bar and resume time
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                <div class="card-badges">
                    <div class="card-badge continue-badge">
                        <i class="fas fa-play-circle"></i> CONTINUE
                    </div>
                </div>
                <div class="thumbnail-overlay"></div>
                
                <!-- ✅ PROGRESS BAR with ACTUAL width -->
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
                    <div class="creator-avatar-small">${avatarHtml}</div>
                    <div class="creator-name-small">${escapeHtml(creatorName)}</div>
                </div>
                
                <!-- ✅ ACTUAL RESUME TIME (not 0:00) -->
                <div class="card-meta">
                    <span><i class="fas fa-clock"></i> ${currentFormatted} / ${durationFormatted}</span>
                    <span>${progress.progress}%</span>
                </div>
                
                <div class="connector-info">
                    <i class="fas fa-user-friends"></i> ${formatNumber(connectorCount)} Connectors
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// SECTION 2: FOR YOU (Personalized)
// ============================================
async function loadForYouSection() {
    const container = document.getElementById('for-you-grid');
    if (!container) return;
    
    // Show skeleton loading
    container.innerHTML = Array(4).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
    
    try {
        let contentList = [];
        
        if (window.currentUser) {
            // Get user's liked content for genre preferences
            const { data: likedContent } = await supabaseAuth
                .from('content_likes')
                .select('content_id')
                .eq('user_id', window.currentUser.id)
                .limit(20);
            
            const likedIds = (likedContent || []).map(l => l.content_id);
            
            // Get genres from liked content
            let genres = [];
            if (likedIds.length > 0) {
                const { data: likedGenres } = await supabaseAuth
                    .from('Content')
                    .select('genre')
                    .in('id', likedIds.slice(0, 10));
                
                genres = [...new Set((likedGenres || []).map(g => g.genre).filter(Boolean))];
            }
            
            // Build query based on preferences
            let query = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published');
            
            if (genres.length > 0) {
                query = query.in('genre', genres);
            }
            
            const { data } = await query
                .order('views_count', { ascending: false })
                .limit(12);
            
            contentList = data || [];
        }
        
        // Fallback to trending if no personalized content
        if (contentList.length === 0) {
            const { data } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(8);
            
            contentList = data || [];
        }
        
        if (contentList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-magic"></i></div>
                    <h3>No Recommendations Yet</h3>
                    <p>Start watching and liking content to get personalized picks</p>
                </div>
            `;
            return;
        }
        
        // Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        
        // Render once
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ For You Section Error:", err);
        container.innerHTML = '<div class="empty-state">Failed to load recommendations</div>';
    }
}

// ============================================
// SECTION 3: FROM CREATORS YOU CONNECTED WITH
// ============================================
async function loadFollowingSection() {
    const section = document.getElementById('following-section');
    const container = document.getElementById('following-grid');
    
    if (!section || !container) return;
    
    if (!window.currentUser) {
        section.style.display = 'none';
        return;
    }
    
    try {
        // 1️⃣ Get creators user follows
        const { data: following, error } = await supabaseAuth
            .from('connectors')
            .select('connected_id')
            .eq('connector_id', window.currentUser.id)
            .eq('connection_type', 'creator');
        
        if (error || !following || following.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        const creatorIds = following.map(f => f.connected_id);
        
        // 2️⃣ Fetch content from followed creators
        const { data: contentList, error: contentError } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .in('user_id', creatorIds)
            .order('created_at', { ascending: false })
            .limit(8);
        
        if (contentError) throw contentError;
        
        if (!contentList || contentList.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // 3️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList);
        
        // 4️⃣ Update section title and render
        section.style.display = 'block';
        const sectionTitle = section.querySelector('.section-title');
        if (sectionTitle) {
            sectionTitle.innerHTML = `
                <i class="fas fa-user-friends" style="color: var(--warm-gold);"></i>
                FROM CREATORS YOU CONNECTED WITH
            `;
        }
        
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Following Section Error:", err);
        section.style.display = 'none';
    }
}

// ============================================
// SECTION 4: QUICK BITS (SHORTS)
// ============================================
async function loadShortsSection() {
    const container = document.getElementById('shorts-container');
    if (!container) return;
    
    try {
        // 1️⃣ Fetch short content
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .eq('media_type', 'short')
            .or('media_type.eq.short,duration.lte.60')
            .order('views_count', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList);
        
        // 3️⃣ Render shorts
        container.style.display = 'flex';
        renderShortsCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Shorts Section Error:", err);
    }
}

// Specialized renderer for shorts
function renderShortsCards(container, contents) {
    container.innerHTML = '';
    
    contents.forEach(content => {
        const thumbnailUrl = content.thumbnail_url
            ? contentSupabase.fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
        const durationFormatted = formatDuration(content.duration || 0);
        
        const card = document.createElement('a');
        card.className = 'short-card';
        card.href = `shorts-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        
        card.innerHTML = `
            <div class="short-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                <div class="short-overlay">
                    <i class="fas fa-play"></i>
                </div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="short-info">
                <h4>${truncateText(escapeHtml(content.title), 30)}</h4>
                <p>${escapeHtml(creatorName)}</p>
                <div class="connector-info-small">
                    <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics.connectors)}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// SECTION 5: COMMUNITY FAVORITES
// ============================================
async function loadCommunityFavoritesSection() {
    const container = document.getElementById('community-favorites-grid');
    if (!container) return;
    
    try {
        // 1️⃣ Fetch community favorites (by favorites_count)
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('favorites_count', { ascending: false })
            .limit(12);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No community favorites yet</p></div>';
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        
        // 3️⃣ Render
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Community Favorites Section Error:", err);
    }
}

// ============================================
// LIVE STREAMS SECTION
// ============================================
async function loadLiveStreamsSection() {
    const container = document.getElementById('live-streams-grid');
    const noLiveStreams = document.getElementById('no-live-streams');
    
    if (!container || !noLiveStreams) return;
    
    try {
        // 1️⃣ Fetch live streams
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('media_type', 'live')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.style.display = 'none';
            noLiveStreams.style.display = 'block';
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList);
        
        // 3️⃣ Render
        container.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Live Streams Section Error:", err);
    }
}

// ============================================
// SECTION 6: TRENDING NOW
// ============================================
async function loadTrendingSection() {
    const container = document.getElementById('trending-grid');
    if (!container) return;
    
    try {
        // 1️⃣ Fetch trending content (by views_count)
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .limit(12);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-chart-line"></i></div>
                    <h3>No Trending Content</h3>
                    <p>Popular content will appear here</p>
                </div>
            `;
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        
        // 3️⃣ Render
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Trending Section Error:", err);
    }
}

// ============================================
// SECTION 7: LATEST GEMS (NEW CONTENT)
// ============================================
async function loadNewContentSection() {
    const container = document.getElementById('new-content-grid');
    if (!container) return;
    
    try {
        // 1️⃣ Fetch new content (by created_at)
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(12);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-gem"></i></div>
                    <h3>No New Content</h3>
                    <p>Fresh content will appear here</p>
                </div>
            `;
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        
        // 3️⃣ Render
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ New Content Section Error:", err);
    }
}

// ============================================
// FEATURED CREATORS SECTION
// ============================================
async function loadFeaturedCreatorsSection() {
    const creatorsList = document.getElementById('creators-list');
    if (!creatorsList) return;
    
    try {
        // Get content counts per creator
        const { data: contentData } = await supabaseAuth
            .from('Content')
            .select('user_id')
            .eq('status', 'published');
        
        const contentCountMap = new Map();
        contentData?.forEach(item => {
            if (item.user_id) {
                contentCountMap.set(item.user_id, (contentCountMap.get(item.user_id) || 0) + 1);
            }
        });
        
        // Get connector counts per creator
        const { data: connectorData } = await supabaseAuth
            .from('connectors')
            .select('connected_id')
            .eq('connection_type', 'creator');
        
        const connectorCountMap = new Map();
        connectorData?.forEach(item => {
            if (item.connected_id) {
                connectorCountMap.set(item.connected_id, (connectorCountMap.get(item.connected_id) || 0) + 1);
            }
        });
        
        // Calculate scores and get top creators
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
            .map(([userId]) => userId);
        
        if (sortedCreators.length === 0) {
            creatorsList.innerHTML = `
                <div class="swiper-slide">
                    <div class="creator-card">
                        <div class="empty-icon"><i class="fas fa-users"></i></div>
                        <h3>No Featured Creators</h3>
                        <p>Top creators will appear here</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Fetch creator profiles
        const { data: profiles } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .in('id', sortedCreators);
        
        const featuredCreators = profiles?.map(profile => ({
            ...profile,
            video_count: contentCountMap.get(profile.id) || 0,
            follower_count: connectorCountMap.get(profile.id) || 0
        })) || [];
        
        // Render creators
        renderCreatorsCards(creatorsList, featuredCreators);
        
    } catch (err) {
        console.error("❌ Featured Creators Section Error:", err);
    }
}

function renderCreatorsCards(container, creators) {
    container.innerHTML = creators.map(creator => {
        const avatarUrl = creator.avatar_url
            ? contentSupabase.fixMediaUrl(creator.avatar_url)
            : null;
        
        const bio = creator.bio || 'Passionate content creator sharing authentic stories and experiences.';
        const truncatedBio = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
        const fullName = creator.full_name || creator.username || 'Creator';
        const username = creator.username || 'creator';
        const initials = getInitials(fullName);
        const videoCount = creator.video_count || 0;
        const followerCount = creator.follower_count || 0;
        const isTopCreator = videoCount > 5 || followerCount > 100;
        
        return `
            <div class="swiper-slide">
                <div class="creator-card">
                    ${isTopCreator ? '<div class="founder-badge">TOP CREATOR</div>' : ''}
                    <div class="creator-avatar">
                        ${avatarUrl ? `
                            <img src="${avatarUrl}" alt="${fullName}" loading="lazy">
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
    
    // Initialize Swiper after render
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

// ============================================
// EVENTS SECTION
// ============================================
async function loadEventsSection() {
    const eventsList = document.getElementById('events-list');
    const noEvents = document.getElementById('no-events');
    
    if (!eventsList || !noEvents) return;
    
    try {
        let data = [];
        
        try {
            const result = await supabaseAuth
                .from('events')
                .select('*')
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(5);
            
            data = result.data || [];
        } catch (e) {
            console.warn('Events table may not exist, using mock data');
            data = getMockEvents();
        }
        
        if (!data || data.length === 0) {
            eventsList.style.display = 'none';
            noEvents.style.display = 'block';
            return;
        }
        
        eventsList.style.display = 'block';
        noEvents.style.display = 'none';
        
        renderEventsCards(eventsList, data);
        
    } catch (err) {
        console.error("❌ Events Section Error:", err);
        
        const mockEvents = getMockEvents();
        if (mockEvents.length > 0) {
            eventsList.style.display = 'block';
            noEvents.style.display = 'none';
            renderEventsCards(eventsList, mockEvents);
        } else {
            eventsList.style.display = 'none';
            noEvents.style.display = 'block';
        }
    }
}

function renderEventsCards(container, events) {
    container.innerHTML = events.map(event => {
        const eventDate = new Date(event.start_time || event.time);
        const formattedDate = eventDate.toLocaleDateString('en-ZA', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="event-card">
                <div class="event-header">
                    <div>
                        <div class="event-title">${escapeHtml(event.title)}</div>
                        <div class="event-time">${formattedDate}</div>
                    </div>
                </div>
                <div class="event-description">${escapeHtml(event.description || '')}</div>
                <div class="event-actions">
                    <button class="reminder-btn" onclick="setReminder('${event.id}')">
                        <i class="fas fa-bell"></i> Set Reminder
                    </button>
                    ${event.tags ? `
                    <div class="event-tags">
                        ${event.tags.map(tag => `<span class="event-tag">${tag}</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CINEMATIC HERO SECTION
// ============================================
async function loadCinematicHero() {
    try {
        // Get trending content with highest engagement
        const { data: trendingData, error } = await supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .order('favorites_count', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const featuredContent = trendingData?.[0] || getMockHeroContent();
        
        if (!featuredContent) return;
        
        // Update hero video
        const heroVideo = document.getElementById('hero-background-video');
        const videoSource = heroVideo?.querySelector('source');
        
        if (heroVideo && videoSource && featuredContent.file_url) {
            videoSource.src = contentSupabase.fixMediaUrl(featuredContent.file_url);
            heroVideo.load();
            heroVideo.play().catch(() => {
                console.log('Video autoplay prevented');
            });
        }
        
        // Update creator info
        const creator = featuredContent.user_profiles;
        if (creator) {
            document.getElementById('hero-creator-name').textContent = creator.full_name || creator.username || 'Featured Creator';
            
            const avatarImg = document.getElementById('hero-creator-avatar-img');
            if (creator.avatar_url) {
                avatarImg.src = contentSupabase.fixMediaUrl(creator.avatar_url);
                avatarImg.style.display = 'block';
            } else {
                avatarImg.style.display = 'none';
                const initials = getInitials(creator.full_name || creator.username);
                document.getElementById('hero-creator-avatar').innerHTML += `<span class="hero-creator-initials">${initials}</span>`;
            }
        }
        
        // Update title and description
        document.getElementById('hero-title').textContent = featuredContent.title || 'DISCOVER & CONNECT';
        document.getElementById('hero-subtitle').textContent = featuredContent.description || 'Explore amazing content, connect with creators, and join live streams from across Africa';
        
        // Get metrics for hero
        const metrics = await fetchAllMetrics([featuredContent.id], creator ? [creator.id] : []);
        
        document.getElementById('hero-views').textContent = formatNumber(metrics.views[featuredContent.id] || featuredContent.views_count || 12500);
        document.getElementById('hero-favorites').textContent = formatNumber(featuredContent.favorites_count || 2300);
        document.getElementById('hero-connectors').textContent = formatNumber(creator ? (metrics.connectors[creator.id] || 1200) : 1200);
        document.getElementById('hero-shares').textContent = formatNumber(metrics.shares[featuredContent.id] || featuredContent.shares_count || 856);
        
        // Check if creator is verified
        if (creator && (metrics.connectors[creator.id] || 0) > 1000) {
            document.getElementById('hero-verified-badge').style.display = 'inline-flex';
        }
        
        // Store content ID for watch button
        const heroWatchBtn = document.getElementById('hero-watch-btn');
        if (heroWatchBtn) {
            heroWatchBtn.dataset.contentId = featuredContent.id;
            heroWatchBtn.dataset.creatorId = creator?.id;
        }
        
        setupHeroButtons();
        
    } catch (error) {
        console.error('Error loading cinematic hero:', error);
        loadMockHeroContent();
    }
}

// ============================================
// COMMUNITY STATS
// ============================================
async function loadCommunityStats() {
    try {
        const { count: connectorsCount } = await supabaseAuth
            .from('connectors')
            .select('*', { count: 'exact', head: true });
        
        const { count: contentCount } = await supabaseAuth
            .from('Content')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: newConnectors } = await supabaseAuth
            .from('connectors')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());
        
        document.getElementById('total-connectors').textContent = formatNumber(connectorsCount || 12500);
        document.getElementById('total-content').textContent = formatNumber(contentCount || 2300);
        document.getElementById('new-connectors').textContent = `+${formatNumber(newConnectors || 342)}`;
    } catch (error) {
        console.error('Error loading community stats:', error);
        document.getElementById('total-connectors').textContent = '12.5K';
        document.getElementById('total-content').textContent = '2.3K';
        document.getElementById('new-connectors').textContent = '+342';
    }
}

// ============================================
// PURE RENDER FUNCTION - NO GLOBALS, NO MUTATIONS
// ============================================
function renderContentCards(container, contents) {
    if (!container || !contents || contents.length === 0) return;
    
    const fragment = document.createDocumentFragment();
    
    contents.forEach(content => {
        if (!content) return;
        
        const thumbnailUrl = content.thumbnail_url
            ? contentSupabase.fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
        const initials = getInitials(displayName);
        const username = creatorProfile?.username || 'creator';
        const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
        const durationFormatted = formatDuration(content.duration || 0);
        
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = contentSupabase.fixMediaUrl(creatorProfile.avatar_url);
            avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" loading="lazy">`;
        } else {
            avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
        }
        
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                <div class="card-badges">
                    ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                    <div class="connector-badge"><i class="fas fa-star"></i><span>${formatNumber(content.metrics?.favorites || 0)} Favorites</span></div>
                </div>
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                <div class="creator-info">
                    <div class="creator-avatar-small">${avatarHtml}</div>
                    <div class="creator-name-small">@${escapeHtml(username)}</div>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                    <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                    <span><i class="fas fa-language"></i> ${window.languageMap[content.language] || 'English'}</span>
                </div>
                <div class="connector-info">
                    <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

// ============================================
// MOCK DATA FUNCTIONS (Fallbacks)
// ============================================
function getMockHeroContent() {
    return {
        id: 1,
        title: 'African Music Festival 2025',
        description: 'Experience the rhythm of Africa with live performances from top artists across the continent.',
        views_count: 15420,
        favorites_count: 3450,
        shares_count: 1200,
        file_url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-playing-the-saxophone-4864-large.mp4',
        user_profiles: {
            id: 'creator-1',
            full_name: 'AfroBeats Official',
            username: 'afrobeats',
            avatar_url: null
        }
    };
}

function loadMockHeroContent() {
    const mock = getMockHeroContent();
    
    document.getElementById('hero-creator-name').textContent = mock.user_profiles.full_name;
    document.getElementById('hero-title').textContent = mock.title;
    document.getElementById('hero-subtitle').textContent = mock.description;
    document.getElementById('hero-views').textContent = formatNumber(mock.views_count);
    document.getElementById('hero-favorites').textContent = formatNumber(mock.favorites_count);
    document.getElementById('hero-connectors').textContent = '1.2K';
    document.getElementById('hero-shares').textContent = formatNumber(mock.shares_count);
    
    const heroVideo = document.getElementById('hero-background-video');
    const videoSource = heroVideo?.querySelector('source');
    if (heroVideo && videoSource) {
        videoSource.src = mock.file_url;
        heroVideo.load();
    }
}

function getMockEvents() {
    return [
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
            description: 'Watch innovative African startups pitch their ideas to a panel of investors.',
            time: 'Friday 3:00 PM WAT',
            tags: ['Technology', 'Startups', 'Business']
        },
        {
            id: 3,
            title: 'Cooking Masterclass: Traditional Dishes',
            description: 'Learn to cook authentic African dishes with master chefs.',
            time: 'Saturday 2:00 PM EAT',
            tags: ['Food', 'Cooking', 'Education']
        }
    ];
}

window.setReminder = function(eventId) {
    showToast('Reminder set for this event!', 'success');
};

function setupHeroButtons() {
    const exploreBtn = document.getElementById('hero-explore-btn');
    const watchBtn = document.getElementById('hero-watch-btn');
    const audioControl = document.getElementById('hero-audio-control');
    const heroVideo = document.getElementById('hero-background-video');
    
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            window.location.href = 'https://bantustreamconnect.com/content-library';
        });
    }
    
    if (watchBtn && heroVideo) {
        watchBtn.addEventListener('click', () => {
            const contentId = watchBtn.dataset.contentId;
            if (contentId) {
                window.location.href = `content-detail.html?id=${contentId}`;
            } else {
                window.location.href = 'https://bantustreamconnect.com/trending_screen';
            }
        });
    }
    
    if (audioControl && heroVideo) {
        audioControl.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            audioControl.innerHTML = heroVideo.muted ? 
                '<i class="fas fa-volume-mute"></i>' : 
                '<i class="fas fa-volume-up"></i>';
            audioControl.title = heroVideo.muted ? 'Unmute' : 'Mute';
        });
    }
}

// ============================================
// AUTHENTICATION & PROFILE FUNCTIONS
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
        } else {
            console.log('⚠️ User not authenticated');
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
            return;
        }
        
        if (profile) {
            window.currentProfile = profile;
        }
        
        await loadNotifications();
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadUserProfiles() {
    if (!window.currentUser) return;
    
    try {
        const { data, error } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id);
        
        if (error) {
            console.warn('Error loading profiles, using default:', error);
            window.userProfiles = [{
                id: window.currentUser.id,
                name: window.currentUser.user_metadata?.full_name || 'Default',
                avatar_url: null
            }];
        } else {
            window.userProfiles = data || [];
        }
        
        if (window.userProfiles.length === 0) {
            window.userProfiles = [{
                id: window.currentUser.id,
                name: window.currentUser.user_metadata?.full_name || 'Default',
                avatar_url: null
            }];
        }
        
        const savedProfileId = localStorage.getItem('currentProfileId');
        window.currentProfile = window.userProfiles.find(p => p.id === savedProfileId) || window.userProfiles[0];
        
        updateProfileSwitcher();
    } catch (error) {
        console.error('Error loading profiles:', error);
    }
}

// ============================================
// SIDEBAR SETUP
// ============================================
function setupSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;
    
    const openSidebar = () => {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    
    const closeSidebar = () => {
        sidebarMenu.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };
    
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openSidebar();
    });
    
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    updateSidebarProfile();
    setupSidebarNavigation();
    setupSidebarThemeToggle();
    setupSidebarScaleControls();
}

function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');
    
    if (!avatar || !name || !email) return;
    
    if (window.currentUser) {
        supabaseAuth.from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .maybeSingle()
            .then(({ data: profile }) => {
                if (profile) {
                    name.textContent = profile.full_name || profile.username || 'User';
                    email.textContent = window.currentUser.email;
                    
                    if (profile.avatar_url) {
                        avatar.innerHTML = `<img src="${contentSupabase.fixMediaUrl(profile.avatar_url)}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    } else {
                        const initials = getInitials(profile.full_name || profile.username);
                        avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
                    }
                } else {
                    const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : '?';
                    avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
                    name.textContent = window.currentUser.email?.split('@')[0] || 'User';
                    email.textContent = window.currentUser.email || 'Signed in';
                }
            });
        
        if (profileSection) {
            profileSection.addEventListener('click', () => {
                document.getElementById('sidebar-close')?.click();
                window.location.href = 'manage-profiles.html';
            });
        }
    } else {
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;"></i>';
        
        if (profileSection) {
            profileSection.addEventListener('click', () => {
                document.getElementById('sidebar-close')?.click();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            });
        }
    }
}

function setupSidebarNavigation() {
    // Analytics
    document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view analytics', 'warning');
            return;
        }
        const analyticsModal = document.getElementById('analytics-modal');
        if (analyticsModal) {
            analyticsModal.classList.add('active');
            loadPersonalAnalytics();
        }
    });
    
    // Notifications
    document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel) {
            notificationsPanel.classList.add('active');
            renderNotifications();
        }
    });
    
    // Badges
    document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view badges', 'warning');
            return;
        }
        const badgesModal = document.getElementById('badges-modal');
        if (badgesModal) {
            badgesModal.classList.add('active');
            loadUserBadges();
        }
    });
    
    // Watch Party
    document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to start a watch party', 'warning');
            return;
        }
        const watchPartyModal = document.getElementById('watch-party-modal');
        if (watchPartyModal) {
            watchPartyModal.classList.add('active');
            loadWatchPartyContent();
        }
    });
    
    // Create Content
    document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to upload content', 'warning');
            window.location.href = `login.html?redirect=creator-upload.html`;
        } else {
            window.location.href = 'creator-upload.html';
        }
    });
    
    // Dashboard
    document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to access dashboard', 'warning');
            window.location.href = `login.html?redirect=creator-dashboard.html`;
        } else {
            window.location.href = 'creator-dashboard.html';
        }
    });
    
    // ✅ NEW: Watch History
    document.getElementById('sidebar-watch-history')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view watch history', 'warning');
            window.location.href = `login.html?redirect=watch-history.html`;
            return;
        }
        window.location.href = 'watch-history.html';
    });
}

function setupSidebarThemeToggle() {
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    if (!themeToggle) return;
    
    themeToggle.addEventListener('click', () => {
        document.getElementById('sidebar-close')?.click();
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.classList.toggle('active');
        }
    });
}

function setupSidebarScaleControls() {
    if (!window.uiScaleController) return;
    
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');
    
    const updateDisplay = () => {
        if (scaleValue) {
            scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
        }
    };
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            window.uiScaleController.decrease();
            updateDisplay();
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            window.uiScaleController.increase();
            updateDisplay();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.uiScaleController.reset();
            updateDisplay();
        });
    }
    
    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);
}

// ============================================
// BOTTOM NAVIGATION BUTTONS
// ============================================
function setupNavigationButtons() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn'); // ✅ NEW
    
    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    if (navCreateBtn) {
        navCreateBtn.addEventListener('click', async () => {
            const { data } = await supabaseAuth.auth.getSession();
            if (data?.session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = 'login.html?redirect=creator-upload.html';
            }
        });
    }
    
    // ✅ NEW: Watch History navigation
    if (navHistoryBtn) {
        navHistoryBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=watch-history.html`;
                return;
            }
            window.location.href = 'watch-history.html';
        });
    }
    
    if (navMenuBtn) {
        navMenuBtn.addEventListener('click', () => {
            const sidebarMenu = document.getElementById('sidebar-menu');
            const sidebarOverlay = document.getElementById('sidebar-overlay');
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    }
}

// ============================================
// LANGUAGE FILTER
// ============================================
function setupLanguageFilter() {
    const languageChips = document.querySelectorAll('.language-chip');
    const moreLanguagesBtn = document.getElementById('more-languages-btn');
    
    languageChips.forEach(chip => {
        const newChip = chip.cloneNode(true);
        chip.parentNode.replaceChild(newChip, chip);
        
        newChip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
            newChip.classList.add('active');
            
            const selectedLang = newChip.dataset.lang;
            filterContentByLanguage(selectedLang);
            
            const langName = getLanguageName(selectedLang);
            showToast(`Showing: ${langName}`, 'info');
        });
    });
    
    if (moreLanguagesBtn) {
        const newMoreBtn = moreLanguagesBtn.cloneNode(true);
        moreLanguagesBtn.parentNode.replaceChild(newMoreBtn, moreLanguagesBtn);
        
        newMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const languageContainer = document.querySelector('.language-chips');
            const hiddenLanguages = ['nr', 'ss', 've', 'ts'];
            
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
                        filterContentByLanguage(lang);
                        showToast(`Showing: ${languageMap[lang]}`, 'info');
                    });
                    
                    languageContainer.insertBefore(newChip, newMoreBtn);
                }
            });
            
            newMoreBtn.style.display = 'none';
            showToast('All languages shown', 'info');
        });
    }
    
    const defaultChip = document.querySelector('.language-chip[data-lang="all"]');
    if (defaultChip) {
        defaultChip.classList.add('active');
    }
}

function getLanguageName(code) {
    return languageMap[code] || code || 'All Languages';
}

function filterContentByLanguage(lang) {
    const contentCards = document.querySelectorAll('.content-card');
    let visibleCount = 0;
    
    contentCards.forEach(card => {
        const contentLang = card.dataset.language || 'en';
        
        if (lang === 'all' || contentLang === lang) {
            card.style.display = 'block';
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50);
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    if (visibleCount === 0 && lang !== 'all') {
        showToast(`No content in ${getLanguageName(lang)} yet`, 'warning');
    }
}

// ============================================
// SEARCH
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
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim().length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
    
    document.getElementById('sort-filter')?.addEventListener('change', () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim().length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
    
    document.getElementById('language-filter')?.addEventListener('change', () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim().length >= 2) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });
}

async function searchContent(query, category = '', sortBy = 'newest', language = '') {
    try {
        let queryBuilder = supabaseAuth
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published');
        
        if (category && category !== 'all' && category !== '') {
            queryBuilder = queryBuilder.eq('genre', category);
        }
        
        if (language && language !== 'all' && language !== '') {
            queryBuilder = queryBuilder.eq('language', language);
        }
        
        const { data, error } = await queryBuilder.limit(50);
        if (error) {
            console.error('Search error:', error);
            return [];
        }
        
        let results = data || [];
        
        if (results.length > 0) {
            const contentIds = results.map(r => r.id);
            const creatorIds = [...new Set(results.map(r => r.user_id).filter(Boolean))];
            const metrics = await fetchAllMetrics(contentIds, creatorIds);
            
            // Enrich results with metrics
            results = results.map(item => ({
                ...item,
                metrics: {
                    views: metrics.views[item.id] || 0,
                    likes: metrics.likes[item.id] || 0,
                    shares: metrics.shares[item.id] || 0,
                    connectors: metrics.connectors[item.user_id] || 0
                }
            }));
        }
        
        if (sortBy === 'popular') {
            results.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
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
    
    const fragment = document.createDocumentFragment();
    
    results.slice(0, 12).forEach(content => {
        if (!content) return;
        
        const thumbnailUrl = content.thumbnail_url
            ? contentSupabase.fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
        const username = creatorProfile?.username || 'creator';
        const durationFormatted = formatDuration(content.duration || 0);
        
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                <div class="creator-info">
                    <div class="creator-name-small">@${escapeHtml(username)}</div>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

// ============================================
// NOTIFICATIONS
// ============================================
function setupNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllRead = document.getElementById('mark-all-read');
    
    if (!notificationsBtn || !notificationsPanel) return;
    
    const openNotifications = () => {
        notificationsPanel.classList.add('active');
        renderNotifications();
    };
    
    notificationsBtn.addEventListener('click', openNotifications);
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            notificationsPanel.classList.remove('active');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (notificationsPanel.classList.contains('active') &&
            !notificationsPanel.contains(e.target) &&
            !notificationsBtn.contains(e.target)) {
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
        
        if (error) {
            console.warn('Error loading notifications:', error);
            updateNotificationBadge(0);
            return;
        }
        
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
    const sidebarBadge = document.getElementById('sidebar-notification-count');
    
    [mainBadge, sidebarBadge].forEach(badge => {
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

// ============================================
// ANALYTICS
// ============================================
function setupAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !analyticsModal) return;
    
    analyticsBtn.addEventListener('click', async () => {
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to view analytics', 'warning');
            return;
        }
        
        analyticsModal.classList.add('active');
        await loadPersonalAnalytics();
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

async function loadPersonalAnalytics() {
    if (!window.currentUser || !window.currentProfile) return;
    
    try {
        const { data: views } = await supabaseAuth
            .from('content_views')
            .select('*')
            .eq('profile_id', window.currentProfile.id);
        
        const totalViews = views?.length || 0;
        const totalWatchTime = views?.reduce((acc, v) => acc + (v.view_duration || 0), 0) || 0;
        const hours = Math.floor(totalWatchTime / 3600);
        
        document.getElementById('personal-watch-time').textContent = hours + 'h';
        document.getElementById('personal-views').textContent = totalViews;
        document.getElementById('personal-sessions').textContent = Math.ceil(totalViews / 5) || 1;
        
        const uniqueDays = new Set(views?.map(v => new Date(v.created_at).toDateString())).size;
        const returnRate = uniqueDays > 0 ? Math.min(100, Math.floor((uniqueDays / 7) * 100)) : 0;
        document.getElementById('return-rate').textContent = returnRate + '%';
        
        await loadEngagementChart();
    } catch (error) {
        console.error('Error loading personal analytics:', error);
    }
}

async function loadEngagementChart() {
    const ctx = document.getElementById('engagement-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: viewsData } = await supabaseAuth
            .from('content_views')
            .select('created_at')
            .gte('created_at', sevenDaysAgo.toISOString());
        
        const viewsByDay = new Array(7).fill(0);
        const today = new Date();
        
        viewsData?.forEach(view => {
            const viewDate = new Date(view.created_at);
            const dayDiff = Math.floor((today - viewDate) / (1000 * 60 * 60 * 24));
            if (dayDiff >= 0 && dayDiff < 7) {
                viewsByDay[6 - dayDiff]++;
            }
        });
        
        if (window.engagementChart) {
            window.engagementChart.destroy();
        }
        
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
    recognition.lang = 'en-ZA';
    
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
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
            voiceStatusText.textContent = 'Listening...';
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
// WATCH PARTY
// ============================================
function setupWatchParty() {
    const watchPartyModal = document.getElementById('watch-party-modal');
    const closeWatchParty = document.getElementById('close-watch-party');
    const startWatchParty = document.getElementById('start-watch-party');
    const copyPartyLink = document.getElementById('copy-party-link');
    
    if (!watchPartyModal) return;
    
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
            const syncPlayback = document.getElementById('party-sync-playback')?.checked;
            const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
            
            try {
                const { data, error } = await supabaseAuth
                    .from('watch_parties')
                    .insert({
                        host_id: window.currentUser?.id,
                        profile_id: window.currentProfile?.id,
                        content_id: contentId,
                        sync_playback: syncPlayback,
                        chat_enabled: chatEnabled,
                        invite_code: generateInviteCode()
                    })
                    .select()
                    .single();
                
                if (error) {
                    console.warn('Watch party error:', error);
                    showToast('Watch party created! (Demo mode)', 'success');
                    watchPartyModal.classList.remove('active');
                    return;
                }
                
                watchPartyModal.classList.remove('active');
                
                const inviteLink = `${window.location.origin}/watch-party.html?code=${data.invite_code}`;
                navigator.clipboard.writeText(inviteLink);
                
                showToast('Watch party created! Invite link copied to clipboard', 'success');
            } catch (error) {
                console.error('Error creating watch party:', error);
                showToast('Watch party created! (Demo mode)', 'success');
                watchPartyModal.classList.remove('active');
            }
        });
    }
    
    if (copyPartyLink) {
        copyPartyLink.addEventListener('click', () => {
            showToast('Start a watch party first', 'warning');
        });
    }
    
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
// TIP SYSTEM
// ============================================
function setupTipSystem() {
    const tipModal = document.getElementById('tip-modal');
    const closeTip = document.getElementById('close-tip');
    const sendTip = document.getElementById('send-tip');
    
    if (!tipModal) return;
    
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
                const { error } = await supabaseAuth
                    .from('tips')
                    .insert({
                        sender_id: window.currentUser.id,
                        recipient_id: creatorId,
                        amount: parseFloat(amount),
                        message: message,
                        status: 'completed'
                    });
                
                if (error) {
                    console.warn('Tip error:', error);
                    showToast(`Thank you for supporting this creator! (Demo)`, 'success');
                } else {
                    showToast(`Thank you for supporting this creator!`, 'success');
                }
                
                tipModal.classList.remove('active');
                
                document.getElementById('tip-message').value = '';
                document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
                document.getElementById('custom-amount').style.display = 'none';
            } catch (error) {
                console.error('Error sending tip:', error);
                showToast('Thank you for supporting this creator! (Demo)', 'success');
                tipModal.classList.remove('active');
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
// BADGES
// ============================================
async function loadUserBadges() {
    if (!window.currentUser) return;
    
    try {
        const { data, error } = await supabaseAuth
            .from('user_badges')
            .select('*')
            .eq('user_id', window.currentUser.id);
        
        if (error) {
            console.warn('Error loading badges:', error);
            return;
        }
        
        window.userBadges = data || [];
        
        const allBadges = [
            { id: 'music', name: 'Music Explorer', icon: 'fa-music', description: 'Watched 5+ music videos' },
            { id: 'stem', name: 'STEM Seeker', icon: 'fa-microscope', description: 'Explored 5+ STEM videos' },
            { id: 'culture', name: 'Cultural Curator', icon: 'fa-drum', description: 'Explored 5+ Culture videos' },
            { id: 'polyglot', name: 'Language Explorer', icon: 'fa-language', description: 'Watched content in 3+ languages' }
        ];
        
        const badgesGrid = document.getElementById('badges-grid');
        const badgesEarned = document.getElementById('badges-earned');
        
        badgesGrid.innerHTML = allBadges.map(badge => {
            const earned = window.userBadges.some(b => b.badge_name === badge.name);
            
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
                            `<span class="badge-requirement">Keep watching</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
        
        badgesEarned.textContent = window.userBadges.length;
        
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// ============================================
// CATEGORY TABS
// ============================================
function renderCategoryTabs() {
    const categoryTabs = document.getElementById('category-tabs');
    if (!categoryTabs) return;
    
    const categories = ['All', 'Music', 'STEM', 'Culture', 'News', 'Sports', 'Movies', 'Documentaries', 'Podcasts'];
    
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
        
        const trendingIds = (trendingData || []).map(c => c.id);
        const trendingCreatorIds = [...new Set((trendingData || []).map(c => c.user_id).filter(Boolean))];
        
        const trendingMetrics = await fetchAllMetrics(trendingIds, trendingCreatorIds);
        
        const trendingWithMetrics = (trendingData || []).map(item => ({
            ...item,
            metrics: {
                views: trendingMetrics.views[item.id] || 0,
                likes: trendingMetrics.likes[item.id] || 0,
                shares: trendingMetrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: trendingMetrics.connectors[item.user_id] || 0
            }
        }));
        
        const trendingGrid = document.getElementById('trending-grid');
        if (trendingGrid && trendingWithMetrics.length > 0) {
            trendingGrid.innerHTML = '';
            renderContentCards(trendingGrid, trendingWithMetrics);
        }
        
        const { data: newData } = await query
            .order('created_at', { ascending: false })
            .limit(8);
        
        const newIds = (newData || []).map(c => c.id);
        const newCreatorIds = [...new Set((newData || []).map(c => c.user_id).filter(Boolean))];
        
        const newMetrics = await fetchAllMetrics(newIds, newCreatorIds);
        
        const newWithMetrics = (newData || []).map(item => ({
            ...item,
            metrics: {
                views: newMetrics.views[item.id] || 0,
                likes: newMetrics.likes[item.id] || 0,
                shares: newMetrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: newMetrics.connectors[item.user_id] || 0
            }
        }));
        
        const newContentGrid = document.getElementById('new-content-grid');
        if (newContentGrid && newWithMetrics.length > 0) {
            newContentGrid.innerHTML = '';
            renderContentCards(newContentGrid, newWithMetrics);
        }
    } catch (error) {
        console.error('Error reloading content by category:', error);
        showToast('Failed to filter content', 'error');
    }
}

// ============================================
// PROFILE SWITCHER
// ============================================
function updateProfileSwitcher() {
    const profileList = document.getElementById('profile-list');
    const currentProfileName = document.getElementById('current-profile-name');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    
    if (!profileList || !currentProfileName || !profilePlaceholder) return;
    
    if (window.currentProfile) {
        currentProfileName.textContent = window.currentProfile.name || 'Profile';
        
        while (profilePlaceholder.firstChild) {
            profilePlaceholder.removeChild(profilePlaceholder.firstChild);
        }
        
        if (window.currentProfile.avatar_url) {
            const img = document.createElement('img');
            img.className = 'profile-img';
            img.src = contentSupabase.fixMediaUrl(window.currentProfile.avatar_url);
            img.alt = window.currentProfile.name;
            img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            profilePlaceholder.appendChild(img);
        } else {
            const initials = getInitials(window.currentProfile.name);
            const div = document.createElement('div');
            div.className = 'profile-placeholder';
            div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            div.textContent = initials;
            profilePlaceholder.appendChild(div);
        }
    }
    
    profileList.innerHTML = (window.userProfiles || []).map(profile => {
        const initials = getInitials(profile.name);
        const isActive = window.currentProfile?.id === profile.id;
        
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
            const profile = window.userProfiles.find(p => p.id === profileId);
            
            if (profile) {
                window.currentProfile = profile;
                localStorage.setItem('currentProfileId', profileId);
                
                updateProfileSwitcher();
                await loadContinueWatchingSection();
                await loadForYouSection();
                
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
// HEADER PROFILE UPDATE
// ============================================
async function updateHeaderProfile() {
    try {
        const profilePlaceholder = document.getElementById('userProfilePlaceholder');
        const currentProfileName = document.getElementById('current-profile-name');
        
        if (!profilePlaceholder || !currentProfileName) return;
        
        if (window.currentUser) {
            const { data: profile } = await supabaseAuth
                .from('user_profiles')
                .select('*')
                .eq('id', window.currentUser.id)
                .maybeSingle();
            
            if (profile) {
                profilePlaceholder.innerHTML = '';
                
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
            } else {
                const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : 'U';
                profilePlaceholder.innerHTML = '';
                const div = document.createElement('div');
                div.className = 'profile-placeholder';
                div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                div.textContent = initials;
                profilePlaceholder.appendChild(div);
                
                currentProfileName.textContent = window.currentUser.email?.split('@')[0] || 'User';
            }
        } else {
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

// ============================================
// BACK TO TOP
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
// INFINITE SCROLL
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
            const contentIds = data.map(c => c.id);
            const creatorIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
            const metrics = await fetchAllMetrics(contentIds, creatorIds);
            
            const dataWithMetrics = data.map(item => ({
                ...item,
                metrics: {
                    views: metrics.views[item.id] || 0,
                    likes: metrics.likes[item.id] || 0,
                    shares: metrics.shares[item.id] || 0,
                    favorites: item.favorites_count || 0,
                    connectors: metrics.connectors[item.user_id] || 0
                }
            }));
            
            appendMoreContent(dataWithMetrics);
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
    
    renderContentCards(newContentGrid, newItems);
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) return;
        
        switch(e.key) {
            case '?':
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    const shortcutsModal = document.getElementById('shortcuts-modal');
                    if (shortcutsModal) {
                        shortcutsModal.style.display = 'flex';
                    }
                }
                break;
            case '/':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    document.getElementById('search-btn')?.click();
                }
                break;
            case 'Escape':
                closeAllModals();
                break;
        }
    });
    
    const closeShortcuts = document.getElementById('close-shortcuts');
    if (closeShortcuts) {
        closeShortcuts.addEventListener('click', () => {
            document.getElementById('shortcuts-modal').style.display = 'none';
        });
    }
    
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) {
                shortcutsModal.style.display = 'none';
            }
        });
    }
}

function closeAllModals() {
    document.querySelectorAll('.analytics-modal.active, .search-modal.active, .notifications-panel.active, .watch-party-modal.active, .tip-modal.active, .badges-modal.active')
        .forEach(el => el.classList.remove('active'));
    
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal) {
        shortcutsModal.style.display = 'none';
    }
}

// ============================================
// WELCOME MESSAGE
// ============================================
function updateWelcomeMessage() {
    const userNameSpan = document.getElementById('user-name');
    const welcomeSubtitle = document.getElementById('welcome-subtitle');
    const welcomeMessage = document.getElementById('welcome-message');
    
    if (window.currentUser && window.currentProfile) {
        const name = window.currentProfile.name || 
                    window.currentUser.user_metadata?.full_name || 
                    window.currentUser.email?.split('@')[0] || 
                    'User';
        userNameSpan.textContent = name;
        
        const hour = new Date().getHours();
        let greeting = 'Good ';
        if (hour < 12) greeting += 'morning';
        else if (hour < 18) greeting += 'afternoon';
        else greeting += 'evening';
        
        welcomeMessage.innerHTML = `${greeting}, <span id="user-name">${name}</span>! 👋`;
        
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Here\'s what we picked for you today';
        }
    } else {
        userNameSpan.textContent = 'Guest';
        welcomeMessage.innerHTML = 'Welcome, <span id="user-name">Guest</span>! 👋';
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Sign in for personalized recommendations';
        }
    }
}

// ============================================
// UPDATE APP ICON
// ============================================
function updateAppIcon() {
    // Update logo icon in header
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        // Clear existing content
        logoIcon.innerHTML = '';
        
        // Add img element
        const img = document.createElement('img');
        img.src = 'assets/icon/bantu_stream_connect_icon.png';
        img.alt = 'Bantu Stream Connect';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        logoIcon.appendChild(img);
    }
    
    // Update sidebar logo icon
    const sidebarLogoIcon = document.querySelector('.sidebar-logo .logo-icon');
    if (sidebarLogoIcon) {
        sidebarLogoIcon.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = 'assets/icon/bantu_stream_connect_icon.png';
        img.alt = 'Bantu Stream Connect';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        sidebarLogoIcon.appendChild(img);
    }
}
