/**
 * CONTENT LIBRARY - CORE MODULE
 * Bantu Stream Connect
 */

// ============================================
// GLOBAL VARIABLES AND STATE
// ============================================

const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
let currentUser = null;
let allContentData = [];
let filteredContentData = [];
let selectedCategoryIndex = 0;
let notifications = [];

const categories = [
    'All',
    'Music',
    'STEM',
    'Culture',
    'News',
    'Sports',
    'Movies',
    'Documentaries',
    'Podcasts',
    'Skits',
    'Videos'
];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📚 Content Library Initializing with enhanced features...');
    
    try {
        await checkAuth();
        await loadContent();
        renderCategoryTabs();
        renderContentSections();
        initTheme();
        setupEventListeners();
        
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app').style.display = 'block';
        }, 500);
        
        console.log('✅ Content Library initialized successfully');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        document.getElementById('loading-text').textContent = 'Error loading content. Please refresh.';
        showToast('Failed to initialize. Please refresh the page.', 'error');
        
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app').style.display = 'block';
        }, 1000);
    }
});

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

async function checkAuth() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;
        
        currentUser = session?.user || null;
        
        if (currentUser) {
            console.log('✅ User authenticated:', currentUser.email);
            await loadUserProfile();
        } else {
            console.log('⚠️ User not authenticated');
            updateProfileUI(null);
        }
        
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
                loadUserProfile();
                loadNotifications();
                showToast('Welcome back!', 'success');
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                updateProfileUI(null);
                updateNotificationBadge(0);
                notifications = [];
                renderNotifications();
            }
        });
        
        return currentUser;
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

async function loadUserProfile() {
    try {
        if (!currentUser) return;
        
        const { data: profile, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
        
        if (error) {
            console.warn('Profile fetch error:', error);
            updateProfileUI(null);
            return;
        }
        
        updateProfileUI(profile);
        await loadNotifications();
    } catch (error) {
        console.error('Error loading profile:', error);
        updateProfileUI(null);
    }
}

function updateProfileUI(profile) {
    const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
    if (!userProfilePlaceholder) return;
    
    if (profile) {
        const displayName = profile.full_name || profile.username || currentUser?.email || 'User';
        const initial = displayName.charAt(0).toUpperCase();
        const avatarUrl = profile.avatar_url;
        
        if (avatarUrl) {
            let fullAvatarUrl = avatarUrl;
            if (!avatarUrl.startsWith('http')) {
                if (avatarUrl.startsWith('avatars/')) {
                    fullAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/${avatarUrl}`;
                } else {
                    fullAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`;
                }
            }
            
            userProfilePlaceholder.innerHTML = `
                <img src="${fullAvatarUrl}" alt="${displayName}"
                    class="profile-img"
                    style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"
                    onerror="this.parentElement.innerHTML = '<div class=\'profile-placeholder\' style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold\'>${initial}</div>'">
            `;
        } else {
            userProfilePlaceholder.innerHTML = `
                <div class="profile-placeholder" style="
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                ">${initial}</div>
            `;
        }
    } else {
        userProfilePlaceholder.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// ============================================
// CONTENT FETCHING
// ============================================

async function loadContent() {
    document.getElementById('loading-text').textContent = 'Loading content...';
    allContentData = await fetchContent();
    filteredContentData = allContentData;
}

async function fetchContent() {
    try {
        console.log('🔄 Fetching content from Supabase...');
        
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (contentError) throw contentError;
        
        const enrichedContent = await Promise.all(
            (contentData || []).map(async (item) => {
                const { count: viewsCount } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                const { count: likesCount } = await window.supabaseClient
                    .from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                return {
                    ...item,
                    real_views: viewsCount || 0,
                    real_likes: likesCount || 0,
                    is_new: isContentNew(item.created_at)
                };
            })
        );
        
        console.log('✅ Loaded', enrichedContent.length, 'content items with real counts');
        return enrichedContent;
    } catch (error) {
        console.error('Error fetching content:', error);
        showToast('Failed to load content', 'error');
        return getFallbackContent();
    }
}

function isContentNew(createdAt) {
    if (!createdAt) return false;
    const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo < 7;
}

function getFallbackContent() {
    return [
        {
            id: 1,
            title: 'African Music Festival Highlights',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            creator: 'Music Africa',
            creator_id: 1,
            user_id: 1,
            real_views: 12500,
            real_likes: 890,
            is_new: true
        },
        {
            id: 2,
            title: 'Tech Innovation in Africa',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            creator: 'Tech Africa',
            creator_id: 2,
            user_id: 2,
            real_views: 8900,
            real_likes: 650,
            is_new: true
        },
        {
            id: 3,
            title: 'Traditional Dance Performance',
            thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            creator: 'Cultural Hub',
            creator_id: 3,
            user_id: 3,
            real_views: 15600,
            real_likes: 1200,
            is_new: true
        },
        {
            id: 4,
            title: 'African Cuisine Cooking Show',
            thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
            creator: 'Chef Amina',
            creator_id: 4,
            user_id: 4,
            real_views: 7800,
            real_likes: 540,
            is_new: true
        },
        {
            id: 5,
            title: 'Startup Success Stories',
            thumbnail_url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=225&fit=crop',
            creator: 'Startup Africa',
            creator_id: 5,
            user_id: 5,
            real_views: 11200,
            real_likes: 890,
            is_new: true
        },
        {
            id: 6,
            title: 'Sports Highlights: African Cup',
            thumbnail_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=225&fit=crop',
            creator: 'Sports Network',
            creator_id: 6,
            user_id: 6,
            real_views: 21500,
            real_likes: 1800,
            is_new: true
        }
    ];
}

function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderCategoryTabs() {
    const categoryTabs = document.getElementById('category-tabs');
    if (!categoryTabs) return;
    
    categoryTabs.innerHTML = categories.map((category, index) => `
        <button class="category-tab ${index === selectedCategoryIndex ? 'active' : ''}" 
                data-index="${index}">
            ${category}
        </button>
    `).join('');
    
    document.querySelectorAll('.category-tab').forEach(button => {
        button.addEventListener('click', () => {
            const index = parseInt(button.dataset.index);
            onCategoryChanged(index);
        });
    });
}

function onCategoryChanged(index) {
    selectedCategoryIndex = index;
    const selectedCategory = categories[index];
    
    document.querySelectorAll('.category-tab').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    
    if (selectedCategory === 'All') {
        filteredContentData = allContentData;
    } else {
        filteredContentData = allContentData.filter(item => {
            const itemGenre = item.genre || '';
            return itemGenre.toLowerCase() === selectedCategory.toLowerCase();
        });
    }
    
    renderContentSections();
}

function renderContentSections() {
    const contentSections = document.getElementById('content-sections');
    if (!contentSections) return;
    
    const featuredContent = getFeaturedContent(filteredContentData);
    const trendingContent = getTrendingContent(filteredContentData);
    
    if (filteredContentData.length === 0) {
        contentSections.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-film"></i>
                <h3>No Content Available</h3>
                <p>Check back later for new content!</p>
            </div>
        `;
        return;
    }
    
    contentSections.innerHTML = `
        ${featuredContent.length > 0 ? `
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Featured Content</h2>
                    <button class="see-all-btn" data-action="view-all-featured">See All</button>
                </div>
                <div class="content-grid">
                    ${renderContentCards(featuredContent)}
                </div>
            </section>
        ` : ''}
        
        ${trendingContent.length > 0 ? `
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Trending Now</h2>
                    <button class="see-all-btn" data-action="view-all-trending">See All</button>
                </div>
                <div class="content-grid">
                    ${renderContentCards(trendingContent, true)}
                </div>
            </section>
        ` : ''}
        
        <section class="section">
            <div class="section-header">
                <h2 class="section-title">${categories[selectedCategoryIndex]}</h2>
                <div style="color: var(--slate-grey); font-size: 14px;">
                    ${filteredContentData.length} items
                </div>
            </div>
            <div class="content-grid">
                ${renderContentCards(filteredContentData.slice(0, 12))}
            </div>
        </section>
    `;
}

function renderContentCards(contentItems, isTrending = false) {
    if (!contentItems || contentItems.length === 0) {
        return '<div class="empty-state">No content available</div>';
    }
    
    return contentItems.map(content => {
        const thumbnailUrl = content.thumbnail_url ? 
            fixMediaUrl(content.thumbnail_url) : 
            'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const creator = content.user_profiles?.full_name || 
                       content.user_profiles?.username || 
                       content.creator || 
                       'Creator';
        
        const creatorId = content.user_profiles?.id || content.user_id || content.creator_id;
        
        const badges = [];
        if (isTrending) badges.push('TRENDING');
        if (content.is_new) badges.push('NEW');
        
        return `
            <a href="content-detail.html?id=${content.id}" class="content-card" data-content-id="${content.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                    ${badges.length > 0 ? `
                        <div class="card-badges">
                            ${badges.map(badge => `
                                <div class="card-badge ${badge === 'TRENDING' ? 'badge-trending' : 'badge-new'}">
                                    <i class="fas ${badge === 'TRENDING' ? 'fa-fire' : 'fa-clock'}"></i>
                                    ${badge}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${escapeHtml(content.title)}">
                        ${truncateText(content.title, 50)}
                    </h3>
                    <button class="creator-btn" 
                            onclick="event.preventDefault(); event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
                        <i class="fas fa-user"></i>
                        ${truncateText(creator, 15)}
                    </button>
                    <div class="card-stats">
                        <div class="card-stat">
                            <i class="fas fa-eye"></i>
                            ${formatNumber(content.real_views || 0)}
                        </div>
                        <div class="card-stat">
                            <i class="fas fa-heart"></i>
                            ${formatNumber(content.real_likes || 0)}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

function getTrendingContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return [...contentData]
        .filter(item => {
            try {
                return new Date(item.created_at) >= oneWeekAgo;
            } catch {
                return false;
            }
        })
        .sort((a, b) => {
            const aScore = (a.real_views || 0) + ((a.real_likes || 0) * 2);
            const bScore = (b.real_views || 0) + ((b.real_likes || 0) * 2);
            return bScore - aScore;
        })
        .slice(0, 8);
}

function getFeaturedContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    return [...contentData]
        .sort((a, b) => (b.real_views || 0) - (a.real_views || 0))
        .slice(0, 6);
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

async function loadNotifications() {
    try {
        if (!currentUser) {
            updateNotificationBadge(0);
            return;
        }
        
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        notifications = data || [];
        const unreadCount = notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        renderNotifications();
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
    
    if (!currentUser) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>Sign in to see notifications</p>
            </div>
        `;
        return;
    }
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
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
        default: return 'fas fa-bell';
    }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

async function searchContent(query, category = '', sortBy = 'newest') {
    try {
        let queryBuilder = window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published');
        
        if (category) {
            queryBuilder = queryBuilder.eq('genre', category);
        }
        
        if (sortBy === 'newest') {
            queryBuilder = queryBuilder.order('created_at', { ascending: false });
        }
        
        const { data, error } = await queryBuilder.limit(50);
        if (error) throw error;
        
        const enriched = await Promise.all(
            (data || []).map(async (item) => {
                const { count: viewsCount } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                const { count: likesCount } = await window.supabaseClient
                    .from('content_likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                return { ...item, real_views: viewsCount || 0, real_likes: likesCount || 0 };
            })
        );
        
        if (sortBy === 'popular') {
            enriched.sort((a, b) => (b.real_views || 0) - (a.real_views || 0));
        } else if (sortBy === 'trending') {
            enriched.sort((a, b) => {
                const aScore = (a.real_views || 0) + ((a.real_likes || 0) * 2);
                const bScore = (b.real_views || 0) + ((b.real_likes || 0) * 2);
                return bScore - aScore;
            });
        }
        
        return enriched;
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
    
    grid.innerHTML = results.map(item => {
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
        const creatorId = item.user_profiles?.id || item.user_id;
        
        return `
            <div class="content-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${fixMediaUrl(item.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${escapeHtml(item.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <button class="creator-btn" 
                            onclick="event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
                        <i class="fas fa-user"></i>
                        ${truncateText(creator, 15)}
                    </button>
                    <div class="card-stats">
                        <div class="card-stat">
                            <i class="fas fa-eye"></i>
                            ${formatNumber(item.real_views || 0)}
                        </div>
                        <div class="card-stat">
                            <i class="fas fa-heart"></i>
                            ${formatNumber(item.real_likes || 0)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    grid.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.creator-btn')) return;
            const id = card.dataset.contentId;
            if (id) window.location.href = `content-detail.html?id=${id}`;
        });
    });
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

function updateAnalytics() {
    document.getElementById('total-views').textContent = formatNumber(
        allContentData.reduce((sum, item) => sum + (item.real_views || 0), 0)
    );
    document.getElementById('total-content').textContent = allContentData.length;
    document.getElementById('active-creators').textContent = 
        new Set(allContentData.map(item => item.user_id)).size;
    document.getElementById('engagement-rate').textContent = '87%';
}

// ============================================
// THEME FUNCTIONS
// ============================================

function initTheme() {
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
        savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (!theme || !['dark', 'light', 'high-contrast'].includes(theme)) {
        theme = 'dark';
    }
    
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
}

// ============================================
// UTILITY FUNCTIONS
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
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
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

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'profile.html';
            } else {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            }
        });
    }
    
    // Back to top
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        window.addEventListener('scroll', () => {
            backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        });
    }
    
    // Search button
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    
    if (searchBtn && searchModal) {
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
                
                if (query.length < 2) {
                    document.getElementById('search-results-grid').innerHTML = 
                        '<div class="no-results">Start typing to search...</div>';
                    return;
                }
                
                document.getElementById('search-results-grid').innerHTML = 
                    '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
                
                const results = await searchContent(query, category, sortBy);
                renderSearchResults(results);
            }, 300));
        }
        
        document.getElementById('category-filter')?.addEventListener('change', () => {
            if (searchInput) searchInput.dispatchEvent(new Event('input'));
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            if (searchInput) searchInput.dispatchEvent(new Event('input'));
        });
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('notifications-btn');
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    
    if (notificationsBtn && notificationsPanel) {
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
    }
    
    // Mark all as read
    const markAllRead = document.getElementById('mark-all-read');
    if (markAllRead) {
        markAllRead.addEventListener('click', async () => {
            if (!currentUser) return;
            
            try {
                const { error } = await window.supabaseClient
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', currentUser.id)
                    .eq('is_read', false);
                
                if (error) throw error;
                
                notifications = notifications.map(n => ({ ...n, is_read: true }));
                renderNotifications();
                updateNotificationBadge(0);
                showToast('All notifications marked as read', 'success');
            } catch (error) {
                console.error('Error marking all as read:', error);
                showToast('Failed to mark notifications as read', 'error');
            }
        });
    }
    
    // Analytics button
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (analyticsBtn && analyticsModal) {
        analyticsBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                showToast('Please sign in to view analytics', 'warning');
                return;
            }
            
            analyticsModal.classList.add('active');
            updateAnalytics();
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
    
    // Theme toggle
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
                applyTheme(option.dataset.theme);
                themeSelector.classList.remove('active');
            });
        });
    }
    
    // Home button
    const homeBtn = document.getElementById('nav-home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Create button
    const createBtn = document.getElementById('nav-create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            }
        });
    }
    
    // Dashboard button
    const dashboardBtn = document.getElementById('nav-dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                window.location.href = 'creator-dashboard.html';
            } else {
                showToast('Please sign in to access dashboard', 'warning');
                window.location.href = `login.html?redirect=creator-dashboard.html`;
            }
        });
    }
    
    // Browse all button
    const browseAllBtn = document.getElementById('browse-all-btn');
    if (browseAllBtn) {
        browseAllBtn.addEventListener('click', () => {
            if (allContentData.length > 0) {
                window.location.href = `content-detail.html?id=${allContentData[0].id}`;
            }
        });
    }
    
    // See all buttons (delegated)
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) {
            const action = e.target.closest('[data-action]').dataset.action;
            showToast(`Viewing all ${action.replace('view-all-', '')} content`, 'info');
        }
    });
}
