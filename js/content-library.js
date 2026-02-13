/**
 * content-library.js - Core functionality for Content Library
 * Bantu Stream Connect
 */

// ============================================================================
// GLOBAL VARIABLES & CONFIGURATION
// ============================================================================

// Supabase Configuration
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
let loadingScreen, loadingText, app, categoryTabs, contentSections, profileBtn, userProfilePlaceholder, backToTopBtn;

// State variables
let currentUser = null;
let allContentData = [];
let filteredContentData = [];
let selectedCategoryIndex = 0;
let notifications = [];

// Categories
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (error, success, warning, info)
 */
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

/**
 * Format numbers with K/M suffixes
 * @param {number} num - The number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Truncate text to a maximum length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format notification time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time
 */
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

/**
 * Debounce function for performance
 * @param {Function} func - The function to debounce
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
 * Fix media URL for Supabase storage
 * @param {string} url - The URL to fix
 * @returns {string} Fixed URL
 */
function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

/**
 * Check if content is new (less than 7 days old)
 * @param {string} createdAt - Creation timestamp
 * @returns {boolean} True if content is new
 */
function isContentNew(createdAt) {
    if (!createdAt) return false;
    const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo < 7;
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Check authentication status
 * @returns {Promise<Object|null>} Current user or null
 */
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
        
        return currentUser;
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

/**
 * Load user profile from user_profiles table
 */
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
        
    } catch (error) {
        console.error('Error loading profile:', error);
        updateProfileUI(null);
    }
}

/**
 * Update profile UI
 * @param {Object} profile - User profile data
 */
function updateProfileUI(profile) {
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

// ============================================================================
// CONTENT FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch content with real view/like counts
 * @returns {Promise<Array>} Enriched content data
 */
async function fetchContent() {
    try {
        console.log('🔄 Fetching content from Supabase...');
        
        // Fetch content items
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (contentError) throw contentError;
        
        // Get real counts for each item
        const enrichedContent = await Promise.all(
            (contentData || []).map(async (item) => {
                // Get real view count
                const { count: viewsCount } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                
                // Get real like count
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

/**
 * Get fallback content when Supabase fails
 * @returns {Array} Fallback content
 */
function getFallbackContent() {
    return [
        {
            id: 1,
            title: 'African Music Festival Highlights',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            creator: 'Music Africa',
            creator_id: 1,
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
            real_views: 21500,
            real_likes: 1800,
            is_new: true
        }
    ];
}

/**
 * Get trending content (based on engagement)
 * @param {Array} contentData - Content data
 * @returns {Array} Trending content
 */
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

/**
 * Get featured content (most viewed overall)
 * @param {Array} contentData - Content data
 * @returns {Array} Featured content
 */
function getFeaturedContent(contentData) {
    if (!contentData || contentData.length === 0) return [];
    return [...contentData]
        .sort((a, b) => (b.real_views || 0) - (a.real_views || 0))
        .slice(0, 6);
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Render category tabs
 */
function renderCategoryTabs() {
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

/**
 * Handle category change
 * @param {number} index - Category index
 */
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

/**
 * Render content sections
 */
function renderContentSections() {
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

/**
 * Render content cards
 * @param {Array} contentItems - Content items to render
 * @param {boolean} isTrending - Whether this is trending content
 * @returns {string} HTML string
 */
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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('📚 Content Library Initializing with enhanced features...');
    
    // Get DOM elements
    loadingScreen = document.getElementById('loading');
    loadingText = document.getElementById('loading-text');
    app = document.getElementById('app');
    categoryTabs = document.getElementById('category-tabs');
    contentSections = document.getElementById('content-sections');
    profileBtn = document.getElementById('profile-btn');
    userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
    backToTopBtn = document.getElementById('backToTopBtn');
    
    try {
        // Check auth
        await checkAuth();
        
        // Load content
        loadingText.textContent = 'Loading content...';
        allContentData = await fetchContent();
        filteredContentData = allContentData;
        
        // Render UI
        loadingText.textContent = 'Setting up interface...';
        renderCategoryTabs();
        renderContentSections();
        
        // Show app
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.style.display = 'block';
        }, 500);
        
        console.log('✅ Content Library initialized successfully');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        loadingText.textContent = 'Error loading content. Please refresh.';
        showToast('Failed to initialize. Please refresh the page.', 'error');
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.style.display = 'block';
        }, 1000);
    }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Auth state change listener
window.supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        loadUserProfile();
        showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateProfileUI(null);
        updateNotificationBadge(0);
        notifications = [];
        if (typeof renderNotifications === 'function') {
            renderNotifications();
        }
    }
});
