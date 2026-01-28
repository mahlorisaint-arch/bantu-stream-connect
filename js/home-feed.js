// ==========================================================================
// BANTU STREAM CONNECT - MOBILE-FIRST HOME FEED
// Fixed Supabase Schema Issues & Mobile Responsiveness
// ==========================================================================

// Global state
let currentUser = null;
let contentData = [];
let trendingData = [];
let recommendedData = [];
let categoriesData = [];
let currentPage = 1;
let isLoading = false;
let hasMoreContent = true;
let searchTimeout = null;

// DOM Elements
let elements = {};

// Mobile state
let isMobileMenuOpen = false;
let isMobileSearchOpen = false;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 Bantu Stream Connect Mobile Home Feed Initializing...');
    
    try {
        // Cache DOM elements
        cacheElements();
        
        // Initialize Supabase
        await initializeSupabase();
        
        // Check authentication
        await checkAuth();
        
        // Setup all event listeners
        setupEventListeners();
        
        // Load initial content
        await loadInitialContent();
        
        // Show the app
        showApp();
        
        console.log('✅ App fully loaded and initialized');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load. Please refresh the page.');
    }
});

// Cache DOM elements
function cacheElements() {
    elements = {
        // App containers
        app: document.getElementById('app'),
        loading: document.getElementById('loading'),
        loadingText: document.getElementById('loading-text'),
        mainContent: document.getElementById('main-content'),
        
        // Header elements
        mobileMenuBtn: document.getElementById('mobile-menu-btn'),
        mobileNav: document.getElementById('mobile-nav'),
        closeMobileNav: document.getElementById('close-mobile-nav'),
        mobileSearchBtn: document.getElementById('mobile-search-btn'),
        mobileSearchContainer: document.getElementById('mobile-search-container'),
        closeMobileSearch: document.getElementById('close-mobile-search'),
        
        // Search elements
        globalSearch: document.getElementById('global-search'),
        mobileSearch: document.getElementById('mobile-search'),
        
        // Profile elements
        profileBtn: document.getElementById('profile-btn'),
        notificationsBtn: document.getElementById('notifications-btn'),
        
        // Content sections
        trendingContent: document.getElementById('trending-content'),
        latestContent: document.getElementById('latest-content'),
        recommendedSection: document.getElementById('recommended-section'),
        recommendedContent: document.getElementById('recommended-content'),
        categoriesGrid: document.getElementById('categories-grid'),
        
        // Load more
        loadMoreBtn: document.getElementById('load-more-btn'),
        
        // Toast container
        toastContainer: document.getElementById('toast-container'),
        
        // Time filter buttons
        timeFilterBtns: document.querySelectorAll('.time-filter-btn')
    };
}

// Initialize Supabase client
async function initializeSupabase() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration is missing');
    }
    
    window.supabaseClient = supabase.createClient(
        window.SUPABASE_URL, 
        window.SUPABASE_ANON_KEY,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        }
    );
    
    console.log('✅ Supabase client initialized');
}

// Check authentication
async function checkAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            console.log('✅ User authenticated:', currentUser.email);
            updateProfileButton();
            
            // Show recommended section for logged in users
            if (elements.recommendedSection) {
                elements.recommendedSection.style.display = 'block';
            }
        } else {
            console.log('👤 User not authenticated (public mode)');
            setupProfileButtonForLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Update profile button with user initials
function updateProfileButton() {
    if (!currentUser || !elements.profileBtn) return;
    
    const initials = getInitials(currentUser.email);
    elements.profileBtn.innerHTML = `
        <div class="profile-placeholder">
            ${initials}
        </div>
    `;
    
    elements.profileBtn.onclick = () => {
        window.location.href = 'profile.html';
    };
}

// Setup profile button for login
function setupProfileButtonForLogin() {
    if (!elements.profileBtn) return;
    
    elements.profileBtn.onclick = () => {
        window.location.href = 'login.html?redirect=index.html';
    };
}

// Get initials from email
function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu
    if (elements.mobileMenuBtn) {
        elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    if (elements.closeMobileNav) {
        elements.closeMobileNav.addEventListener('click', closeMobileMenu);
    }
    
    // Mobile search
    if (elements.mobileSearchBtn) {
        elements.mobileSearchBtn.addEventListener('click', toggleMobileSearch);
    }
    
    if (elements.closeMobileSearch) {
        elements.closeMobileSearch.addEventListener('click', closeMobileSearch);
    }
    
    // Search functionality
    if (elements.globalSearch) {
        elements.globalSearch.addEventListener('input', handleSearchInput);
        elements.globalSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(elements.globalSearch.value);
            }
        });
    }
    
    if (elements.mobileSearch) {
        elements.mobileSearch.addEventListener('input', handleSearchInput);
        elements.mobileSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(elements.mobileSearch.value);
            }
        });
    }
    
    // Time filter buttons
    if (elements.timeFilterBtns) {
        elements.timeFilterBtns.forEach(btn => {
            btn.addEventListener('click', handleTimeFilterClick);
        });
    }
    
    // Load more button
    if (elements.loadMoreBtn) {
        elements.loadMoreBtn.addEventListener('click', loadMoreContent);
    }
    
    // Notifications button
    if (elements.notificationsBtn) {
        elements.notificationsBtn.addEventListener('click', () => {
            window.location.href = 'notifications.html';
        });
    }
    
    // Click outside to close mobile menu/search
    document.addEventListener('click', (e) => {
        // Close mobile menu if clicking outside
        if (isMobileMenuOpen && 
            !elements.mobileNav.contains(e.target) && 
            !elements.mobileMenuBtn.contains(e.target)) {
            closeMobileMenu();
        }
        
        // Close mobile search if clicking outside
        if (isMobileSearchOpen && 
            !elements.mobileSearchContainer.contains(e.target) && 
            !elements.mobileSearchBtn.contains(e.target)) {
            closeMobileSearch();
        }
    });
    
    // Escape key to close mobile menu/search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isMobileMenuOpen) closeMobileMenu();
            if (isMobileSearchOpen) closeMobileSearch();
        }
    });
    
    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            updateProfileButton();
            if (elements.recommendedSection) {
                elements.recommendedSection.style.display = 'block';
            }
            showToast(`Welcome back, ${session.user.email}!`, 'success');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            setupProfileButtonForLogin();
            if (elements.recommendedSection) {
                elements.recommendedSection.style.display = 'none';
            }
        }
    });
}

// Mobile menu functions
function toggleMobileMenu() {
    if (isMobileMenuOpen) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

function openMobileMenu() {
    if (elements.mobileNav) {
        elements.mobileNav.classList.add('active');
        document.body.style.overflow = 'hidden';
        isMobileMenuOpen = true;
    }
}

function closeMobileMenu() {
    if (elements.mobileNav) {
        elements.mobileNav.classList.remove('active');
        document.body.style.overflow = '';
        isMobileMenuOpen = false;
    }
}

// Mobile search functions
function toggleMobileSearch() {
    if (isMobileSearchOpen) {
        closeMobileSearch();
    } else {
        openMobileSearch();
    }
}

function openMobileSearch() {
    if (elements.mobileSearchContainer) {
        elements.mobileSearchContainer.classList.add('active');
        elements.mobileSearch.focus();
        document.body.style.overflow = 'hidden';
        isMobileSearchOpen = true;
    }
}

function closeMobileSearch() {
    if (elements.mobileSearchContainer) {
        elements.mobileSearchContainer.classList.remove('active');
        document.body.style.overflow = '';
        isMobileSearchOpen = false;
    }
}

// Handle search input with debouncing
function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length > 0) {
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 500);
    }
}

// Perform search
function performSearch(query) {
    if (!query.trim()) return;
    
    // Close mobile search if open
    closeMobileSearch();
    
    // Redirect to search results page
    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
}

// Handle time filter click
function handleTimeFilterClick(e) {
    const button = e.currentTarget;
    const hours = parseInt(button.dataset.hours);
    
    // Update active state
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Load trending content with new time filter
    loadTrendingContent(hours);
}

// Load initial content
async function loadInitialContent() {
    try {
        showLoadingState(true, 'Loading your feed...');
        
        // Load content in parallel
        await Promise.all([
            loadTrendingContent(24),
            loadLatestContent(),
            loadCategories(),
            loadRecommendedContent()
        ]);
        
        showLoadingState(false, 'Ready!');
        
    } catch (error) {
        console.error('Error loading initial content:', error);
        showToast('Failed to load content. Please check your connection.', 'error');
        
        // Show fallback content
        showFallbackContent();
    }
}

// Load trending content (FIXED: Removed invalid joins)
async function loadTrendingContent(hours = 24) {
    try {
        // Calculate timestamp for trending period
        const trendingSince = new Date();
        trendingSince.setHours(trendingSince.getHours() - hours);
        
        // Simple query without joins that cause errors
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .gte('created_at', trendingSince.toISOString())
            .order('views_count', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Trending query error:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            trendingData = data;
            renderTrendingContent(data);
        } else {
            renderTrendingFallback();
        }
        
    } catch (error) {
        console.error('Error loading trending content:', error);
        renderTrendingFallback();
    }
}

// Load latest content (FIXED: Removed invalid joins)
async function loadLatestContent() {
    try {
        // Simple query without joins that cause errors
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(12);
        
        if (error) {
            console.error('Latest content query error:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            contentData = data;
            renderLatestContent(data);
        } else {
            renderLatestFallback();
        }
        
    } catch (error) {
        console.error('Error loading latest content:', error);
        renderLatestFallback();
    }
}

// Load recommended content (Simplified for now)
async function loadRecommendedContent() {
    if (!currentUser) return;
    
    try {
        // For now, just show trending content as recommendations
        // In the future, implement proper recommendation algorithm
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .limit(6);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            recommendedData = data;
            renderRecommendedContent(data);
        }
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        // Silently fail - recommendations are optional
    }
}

// Load categories
async function loadCategories() {
    try {
        // Get unique genres from content
        const { data, error } = await supabaseClient
            .from('Content')
            .select('genre')
            .not('genre', 'is', null)
            .limit(20);
        
        if (error) throw error;
        
        if (data) {
            // Get unique genres
            const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
            categoriesData = uniqueGenres.slice(0, 8); // Show max 8 categories
            
            renderCategories(categoriesData);
        }
        
    } catch (error) {
        console.error('Error loading categories:', error);
        
        // Show default categories
        const defaultCategories = ['Music', 'Technology', 'Education', 'Entertainment', 'Sports', 'Culture', 'Food', 'Fashion'];
        renderCategories(defaultCategories);
    }
}

// Load more content
async function loadMoreContent() {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        // Update button state
        elements.loadMoreBtn.classList.add('loading');
        elements.loadMoreBtn.disabled = true;
        
        // Calculate offset
        const offset = contentData.length;
        
        // Load more content
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(offset, offset + 5);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Add to existing data
            contentData = [...contentData, ...data];
            
            // Append to latest content
            appendLatestContent(data);
            
            // Check if there's more content
            if (data.length < 6) {
                elements.loadMoreBtn.style.display = 'none';
            }
        } else {
            // No more content
            elements.loadMoreBtn.style.display = 'none';
            showToast('No more content to load', 'info');
        }
        
    } catch (error) {
        console.error('Error loading more content:', error);
        showToast('Failed to load more content', 'error');
    } finally {
        isLoading = false;
        elements.loadMoreBtn.classList.remove('loading');
        elements.loadMoreBtn.disabled = false;
    }
}

// Show fallback content when API fails
function showFallbackContent() {
    // Fallback trending data
    const fallbackTrending = [
        {
            id: 1,
            title: 'African Music Festival 2025',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            creator: 'Music Africa',
            views_count: 12500,
            likes_count: 890,
            duration: 285,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Tech Innovation in Africa',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            creator: 'Tech Hub',
            views_count: 8900,
            likes_count: 650,
            duration: 420,
            created_at: new Date().toISOString()
        }
    ];
    
    // Fallback latest data
    const fallbackLatest = [
        {
            id: 3,
            title: 'Traditional Dance Performance',
            thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            creator: 'Cultural Hub',
            views_count: 15600,
            likes_count: 1200,
            duration: 325,
            created_at: new Date().toISOString()
        },
        {
            id: 4,
            title: 'African Cuisine Masterclass',
            thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
            creator: 'Food Network',
            views_count: 23400,
            likes_count: 1890,
            duration: 540,
            created_at: new Date().toISOString()
        }
    ];
    
    renderTrendingContent(fallbackTrending);
    renderLatestContent(fallbackLatest);
}

// Render trending content
function renderTrendingContent(content) {
    if (!elements.trendingContent) return;
    
    if (content.length === 0) {
        renderTrendingFallback();
        return;
    }
    
    elements.trendingContent.innerHTML = content.map(item => renderTrendingCard(item)).join('');
}

// Render trending fallback
function renderTrendingFallback() {
    if (!elements.trendingContent) return;
    
    elements.trendingContent.innerHTML = `
        <div class="trending-fallback">
            <div class="fallback-card">
                <div class="fallback-thumbnail"></div>
                <div class="fallback-content">
                    <div class="fallback-title"></div>
                    <div class="fallback-creator"></div>
                </div>
            </div>
            <div class="trending-empty">
                <i class="fas fa-fire"></i>
                <p>Trending content will appear here</p>
            </div>
        </div>
    `;
}

// Render latest content
function renderLatestContent(content) {
    if (!elements.latestContent) return;
    
    if (content.length === 0) {
        renderLatestFallback();
        return;
    }
    
    elements.latestContent.innerHTML = content.map(item => renderContentCard(item)).join('');
}

// Append more content
function appendLatestContent(content) {
    if (!elements.latestContent || content.length === 0) return;
    
    const newCards = content.map(item => renderContentCard(item)).join('');
    elements.latestContent.insertAdjacentHTML('beforeend', newCards);
}

// Render latest fallback
function renderLatestFallback() {
    if (!elements.latestContent) return;
    
    elements.latestContent.innerHTML = `
        <div class="content-empty">
            <i class="fas fa-film"></i>
            <h3>No Content Available</h3>
            <p>Be the first to upload content!</p>
            <button class="upload-cta" onclick="window.location.href='upload.html'">
                Upload Your First Video
            </button>
        </div>
    `;
}

// Render recommended content
function renderRecommendedContent(content) {
    if (!elements.recommendedContent || !content || content.length === 0) return;
    
    elements.recommendedContent.innerHTML = content.map(item => renderContentCard(item)).join('');
}

// Render categories
function renderCategories(categories) {
    if (!elements.categoriesGrid) return;
    
    const categoriesHtml = categories.map(category => `
        <a href="library.html?genre=${encodeURIComponent(category)}" class="category-card">
            <div class="category-icon">
                <i class="fas fa-${getCategoryIcon(category)}"></i>
            </div>
            <div class="category-name">${category}</div>
        </a>
    `).join('');
    
    elements.categoriesGrid.innerHTML = categoriesHtml;
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        'Music': 'music',
        'Technology': 'microchip',
        'Education': 'graduation-cap',
        'Entertainment': 'tv',
        'Sports': 'futbol',
        'Culture': 'globe-africa',
        'Food': 'utensils',
        'Fashion': 'tshirt',
        'Business': 'briefcase',
        'Health': 'heartbeat',
        'Travel': 'plane',
        'Art': 'palette'
    };
    
    return icons[category] || 'folder';
}

// Render trending card (horizontal scroll)
function renderTrendingCard(item) {
    const thumbnail = item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    const displayTitle = truncateText(item.title, 30);
    const viewCount = formatNumber(item.views_count || 0);
    
    return `
        <div class="trending-card" onclick="openContentDetail(${item.id})">
            <div class="trending-thumbnail">
                <img src="${thumbnail}" alt="${item.title}" loading="lazy">
                <div class="trending-badge">🔥 Trending</div>
                <div class="trending-overlay"></div>
            </div>
            <div class="trending-info">
                <h3 class="trending-title">${displayTitle}</h3>
                <div class="trending-meta">
                    <span class="trending-creator">${item.creator || 'Creator'}</span>
                    <span class="trending-views">${viewCount} views</span>
                </div>
            </div>
        </div>
    `;
}

// Render content card (grid layout)
function renderContentCard(item) {
    const thumbnail = item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    const displayTitle = truncateText(item.title, 50);
    const viewCount = formatNumber(item.views_count || 0);
    const likeCount = formatNumber(item.likes_count || 0);
    const duration = item.duration ? formatDuration(item.duration) : null;
    const timeAgo = formatTimeAgo(item.created_at);
    
    return `
        <div class="content-card" onclick="openContentDetail(${item.id})">
            <div class="card-thumbnail">
                <img src="${thumbnail}" alt="${item.title}" loading="lazy">
                ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
                <div class="thumbnail-overlay"></div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${displayTitle}</h3>
                <div class="card-creator">${item.creator || 'Creator'}</div>
                <div class="card-stats">
                    <span class="card-stat">
                        <i class="fas fa-eye"></i>
                        ${viewCount}
                    </span>
                    <span class="card-stat">
                        <i class="fas fa-heart"></i>
                        ${likeCount}
                    </span>
                    <span class="card-stat">
                        <i class="fas fa-clock"></i>
                        ${timeAgo}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Open content detail
function openContentDetail(contentId) {
    window.location.href = `content-detail.html?id=${contentId}`;
}

// Show app
function showApp() {
    if (elements.app && elements.loading) {
        elements.app.style.display = 'block';
        elements.loading.style.display = 'none';
    }
}

// Show loading state
function showLoadingState(loading, message) {
    if (!elements.loadingText) return;
    
    if (loading) {
        elements.loadingText.textContent = message || 'Loading...';
        if (elements.loading) {
            elements.loading.style.display = 'flex';
        }
    } else {
        elements.loadingText.textContent = message || 'Ready!';
        setTimeout(() => {
            if (elements.loading) {
                elements.loading.style.display = 'none';
            }
        }, 500);
    }
}

// Show error
function showError(message) {
    if (elements.loadingText) {
        elements.loadingText.textContent = message;
    }
    
    if (elements.loading) {
        elements.loading.innerHTML += `
            <button onclick="window.location.reload()" class="retry-btn">
                Refresh Page
            </button>
        `;
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    
    elements.toastContainer.appendChild(toast);
    
    // Remove toast after delay
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Utility functions

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Just now';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Initialize lazy loading for images
function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('loading' in HTMLImageElement.prototype) {
        // Browser supports native lazy loading
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
            }
        });
    } else {
        // Fallback to IntersectionObserver
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => observer.observe(img));
    }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', initLazyLoading);

// Add touch support for mobile
function setupTouchSupport() {
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Add touch feedback for buttons
    document.querySelectorAll('button, .clickable').forEach(el => {
        el.addEventListener('touchstart', function() {
            this.classList.add('touch-active');
        });
        
        el.addEventListener('touchend', function() {
            this.classList.remove('touch-active');
        });
    });
}

// Initialize touch support
setupTouchSupport();

// Handle back button on Android
window.addEventListener('popstate', function(event) {
    if (isMobileMenuOpen) {
        closeMobileMenu();
        event.preventDefault();
    }
    if (isMobileSearchOpen) {
        closeMobileSearch();
        event.preventDefault();
    }
});

// Export functions for global access
window.openContentDetail = openContentDetail;
