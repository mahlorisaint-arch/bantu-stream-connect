// ==========================================================================
// BANTU STREAM CONNECT - HOME FEED ENHANCED
// Phase 1: Fixed Supabase Schema Issues
// ==========================================================================

// Global state
let currentUser = null;
let contentData = [];
let trendingData = [];
let recommendedData = [];
let currentPage = 1;
let isLoading = false;
let hasMoreContent = true;
let searchTimeout = null;
let currentFilters = {
    contentType: 'all',
    genre: 'all',
    sortBy: 'newest',
    trendingHours: 24
};

// DOM Elements
let elements = {};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Bantu Stream Connect Home Feed Initializing...');
    
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
        
        // Setup infinite scroll
        setupInfiniteScroll();
        
        // Show the app
        showApp();
        
        console.log('✅ App fully loaded and initialized');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load. Please refresh the page.');
    }
});

// Cache frequently used DOM elements
function cacheElements() {
    elements = {
        app: document.getElementById('app'),
        loading: document.getElementById('loading'),
        loadingText: document.getElementById('loading-text'),
        recommendedSection: document.getElementById('recommended-section'),
        recommendedContent: document.getElementById('recommended-content'),
        trendingContent: document.getElementById('trending-content'),
        latestContent: document.getElementById('latest-content'),
        searchInput: document.getElementById('global-search'),
        searchContainer: document.getElementById('search-container'),
        searchFilters: document.getElementById('search-filters'),
        filterBtn: document.getElementById('filter-btn'),
        clearSearch: document.getElementById('clear-search'),
        applyFilters: document.getElementById('apply-filters'),
        resetFilters: document.getElementById('reset-filters'),
        scrollSentinel: document.getElementById('scroll-sentinel'),
        profileBtn: document.getElementById('profile-btn'),
        notificationsBtn: document.getElementById('notifications-btn'),
        browseAllBtn: document.getElementById('browse-all-btn'),
        browseAllCta: document.getElementById('browse-all-cta'),
        exploreBtn: document.getElementById('explore-btn'),
        toastContainer: document.getElementById('toast-container'),
        contentTypeFilter: document.getElementById('content-type-filter'),
        genreFilter: document.getElementById('genre-filter'),
        sortFilter: document.getElementById('sort-filter'),
        timeButtons: document.querySelectorAll('.time-btn')
    };
}

// Initialize Supabase client
async function initializeSupabase() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration is missing');
    }
    
    window.supabaseClient = supabase.createClient(
        window.SUPABASE_URL, 
        window.SUPABASE_ANON_KEY
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
        } else {
            console.log('👤 User not authenticated (public mode)');
            setupProfileButtonForLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Update profile button
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
    // Search functionality
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', handleSearchInput);
    }
    
    // Filter buttons
    if (elements.filterBtn) {
        elements.filterBtn.addEventListener('click', toggleFilters);
    }
    
    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', clearSearch);
    }
    
    if (elements.applyFilters) {
        elements.applyFilters.addEventListener('click', applyFilters);
    }
    
    if (elements.resetFilters) {
        elements.resetFilters.addEventListener('click', resetFilters);
    }
    
    // Filter dropdowns
    if (elements.contentTypeFilter) {
        elements.contentTypeFilter.addEventListener('change', updateFilters);
    }
    
    if (elements.genreFilter) {
        elements.genreFilter.addEventListener('change', updateFilters);
    }
    
    if (elements.sortFilter) {
        elements.sortFilter.addEventListener('change', updateFilters);
    }
    
    // Trending time buttons
    if (elements.timeButtons) {
        elements.timeButtons.forEach(btn => {
            btn.addEventListener('click', handleTimeFilterClick);
        });
    }
    
    // Action buttons
    if (elements.browseAllBtn) {
        elements.browseAllBtn.addEventListener('click', () => {
            window.location.href = 'content-library.html';
        });
    }
    
    if (elements.browseAllCta) {
        elements.browseAllCta.addEventListener('click', () => {
            window.location.href = 'content-library.html';
        });
    }
    
    if (elements.exploreBtn) {
        elements.exploreBtn.addEventListener('click', () => {
            window.location.href = 'creators.html';
        });
    }
    
    if (elements.notificationsBtn) {
        elements.notificationsBtn.addEventListener('click', () => {
            window.location.href = 'notifications.html';
        });
    }
    
    // Close filters when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.searchFilters && !elements.searchFilters.contains(e.target) && 
            !elements.filterBtn.contains(e.target)) {
            elements.searchFilters.style.display = 'none';
        }
    });
    
    // Escape key to close filters
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.searchFilters) {
                elements.searchFilters.style.display = 'none';
            }
        }
    });
    
    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            updateProfileButton();
            loadRecommendedContent();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            setupProfileButtonForLogin();
            if (elements.recommendedSection) {
                elements.recommendedSection.style.display = 'none';
            }
        }
    });
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
        }, 300);
    }
}

// Perform search
async function performSearch(query) {
    try {
        // Redirect to search results page
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed. Please try again.', 'error');
    }
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
}

// Toggle filters dropdown
function toggleFilters() {
    if (!elements.searchFilters) return;
    
    const isVisible = elements.searchFilters.style.display === 'block';
    elements.searchFilters.style.display = isVisible ? 'none' : 'block';
}

// Update filters
function updateFilters() {
    if (!elements.contentTypeFilter || !elements.genreFilter || !elements.sortFilter) return;
    
    currentFilters = {
        contentType: elements.contentTypeFilter.value,
        genre: elements.genreFilter.value,
        sortBy: elements.sortFilter.value,
        trendingHours: currentFilters.trendingHours
    };
}

// Apply filters
function applyFilters() {
    updateFilters();
    closeFilters();
    
    // Reload content with filters
    currentPage = 1;
    hasMoreContent = true;
    loadContent();
    
    showToast('Filters applied', 'success');
}

// Close filters
function closeFilters() {
    if (elements.searchFilters) {
        elements.searchFilters.style.display = 'none';
    }
}

// Reset all filters
function resetFilters() {
    if (elements.contentTypeFilter) elements.contentTypeFilter.value = 'all';
    if (elements.genreFilter) elements.genreFilter.value = 'all';
    if (elements.sortFilter) elements.sortFilter.value = 'newest';
    
    applyFilters();
}

// Handle trending time filter click
function handleTimeFilterClick(e) {
    const button = e.currentTarget;
    const hours = parseInt(button.dataset.hours);
    
    // Update active state
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update filter and reload trending content
    currentFilters.trendingHours = hours;
    loadTrendingContent();
}

// Load initial content
async function loadInitialContent() {
    try {
        showLoadingState(true, 'Loading your feed...');
        
        // Load content in parallel
        await Promise.all([
            loadContent(),
            loadTrendingContent(),
            loadRecommendedContent(),
            loadGenres()
        ]);
        
        showLoadingState(false, 'Ready!');
        
    } catch (error) {
        console.error('Error loading initial content:', error);
        showError('Failed to load content. Please refresh.');
    }
}

// Load genres for filters
async function loadGenres() {
    try {
        const { data, error } = await supabaseClient
            .from('Content')
            .select('genre')
            .not('genre', 'is', null)
            .limit(50);
        
        if (error) throw error;
        
        // Extract unique genres
        const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
        
        // Populate genre filter
        if (elements.genreFilter && uniqueGenres.length > 0) {
            elements.genreFilter.innerHTML = '<option value="all">All Genres</option>' +
                uniqueGenres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        }
        
        console.log(`✅ Loaded ${uniqueGenres.length} genres`);
        
    } catch (error) {
        console.log('Using default genres');
        const defaultGenres = ['Music', 'Technology', 'Education', 'Entertainment', 'Sports', 'Culture'];
        
        if (elements.genreFilter) {
            elements.genreFilter.innerHTML = '<option value="all">All Genres</option>' +
                defaultGenres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        }
    }
}

// Load main content with pagination (Fixed for Supabase schema)
async function loadContent() {
    if (isLoading || !hasMoreContent) return;
    
    isLoading = true;
    
    try {
        const limit = 12;
        const from = (currentPage - 1) * limit;
        
        // Build query based on your actual Supabase schema
        let query = supabaseClient
            .from('Content')  // Your table name
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        // Apply content type filter
        if (currentFilters.contentType !== 'all') {
            query = query.eq('media_type', currentFilters.contentType);
        }
        
        // Apply genre filter
        if (currentFilters.genre !== 'all') {
            query = query.eq('genre', currentFilters.genre);
        }
        
        // Apply sort
        if (currentFilters.sortBy === 'popular') {
            query = query.order('views_count', { ascending: false });
        } else if (currentFilters.sortBy === 'trending') {
            // For trending, we'll handle separately
            query = query.order('created_at', { ascending: false });
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        // Process and display data
        if (data && data.length > 0) {
            if (currentPage === 1) {
                contentData = data;
                renderLatestContent(data);
            } else {
                contentData = [...contentData, ...data];
                appendLatestContent(data);
            }
            
            // Check if there's more content
            hasMoreContent = data.length === limit;
            currentPage++;
            
        } else {
            hasMoreContent = false;
            if (currentPage === 1) {
                renderEmptyState();
            }
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        // Fallback to sample data
        if (currentPage === 1) {
            contentData = getFallbackContent();
            renderLatestContent(contentData);
        }
    } finally {
        isLoading = false;
        hideScrollSentinel();
    }
}

// Load trending content (Fixed for Supabase schema)
async function loadTrendingContent() {
    try {
        // Calculate timestamp for trending period
        const trendingSince = new Date();
        trendingSince.setHours(trendingSince.getHours() - currentFilters.trendingHours);
        
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .gte('created_at', trendingSince.toISOString())
            .order('views_count', { ascending: false })
            .limit(8);
        
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
        // Fallback to sample trending data
        trendingData = getTrendingFallbackContent();
        renderTrendingContent(trendingData);
    }
}

// Load personalized recommendations (Simplified for now)
async function loadRecommendedContent() {
    if (!currentUser) {
        // Hide recommended section for non-logged in users
        if (elements.recommendedSection) {
            elements.recommendedSection.style.display = 'none';
        }
        return;
    }
    
    try {
        // Show recommended section
        if (elements.recommendedSection) {
            elements.recommendedSection.style.display = 'block';
        }
        
        // For now, show trending content as recommendations
        // In the future, implement actual recommendation algorithm
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
        } else {
            renderRecommendedFallback();
        }
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        // Fallback to sample recommendations
        recommendedData = getRecommendedFallbackContent();
        renderRecommendedContent(recommendedData);
    }
}

// Setup infinite scroll
function setupInfiniteScroll() {
    if (!elements.scrollSentinel) return;
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMoreContent) {
            showScrollSentinel();
            loadContent();
        }
    }, {
        root: null,
        rootMargin: '200px',
        threshold: 0.1
    });
    
    observer.observe(elements.scrollSentinel);
}

// Show scroll sentinel
function showScrollSentinel() {
    if (elements.scrollSentinel) {
        elements.scrollSentinel.style.opacity = '1';
    }
}

// Hide scroll sentinel
function hideScrollSentinel() {
    if (elements.scrollSentinel) {
        elements.scrollSentinel.style.opacity = '0';
    }
}

// Render latest content
function renderLatestContent(content) {
    if (!elements.latestContent) return;
    
    if (content.length === 0) {
        renderEmptyState();
        return;
    }
    
    elements.latestContent.innerHTML = content.map(item => renderContentCard(item)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#latest-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Append more content (for infinite scroll)
function appendLatestContent(content) {
    if (!elements.latestContent || content.length === 0) return;
    
    const newCards = content.map(item => renderContentCard(item)).join('');
    elements.latestContent.insertAdjacentHTML('beforeend', newCards);
}

// Render trending content
function renderTrendingContent(content) {
    if (!elements.trendingContent) return;
    
    if (content.length === 0) {
        renderTrendingFallback();
        return;
    }
    
    elements.trendingContent.innerHTML = content.map(item => renderContentCard(item, true)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#trending-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Render trending fallback
function renderTrendingFallback() {
    if (!elements.trendingContent) return;
    
    // Show some fallback content
    const fallbackContent = getTrendingFallbackContent();
    elements.trendingContent.innerHTML = fallbackContent.map(item => renderContentCard(item, true)).join('');
}

// Render recommended content
function renderRecommendedContent(content) {
    if (!elements.recommendedContent) return;
    
    if (content.length === 0) {
        renderRecommendedFallback();
        return;
    }
    
    elements.recommendedContent.innerHTML = content.map(item => renderContentCard(item)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#recommended-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Render recommended fallback
function renderRecommendedFallback() {
    if (!elements.recommendedContent) return;
    
    // Show some fallback content
    const fallbackContent = getRecommendedFallbackContent();
    elements.recommendedContent.innerHTML = fallbackContent.map(item => renderContentCard(item)).join('');
}

// Render empty state
function renderEmptyState() {
    if (!elements.latestContent) return;
    
    elements.latestContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-film"></i>
            <h3>No Content Available</h3>
            <p>Check back later for new content!</p>
            <button onclick="window.location.href='upload.html'" class="upload-btn">
                <i class="fas fa-upload"></i> Upload Your First Video
            </button>
        </div>
    `;
}

// Render content card
function renderContentCard(item, isTrending = false) {
    // Optimize thumbnail
    const thumbnail = item.thumbnail_url 
        ? `${item.thumbnail_url}?w=400&h=225&fit=crop`
        : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    // Truncate title
    const displayTitle = truncateText(item.title, 50);
    
    // Creator info (using user_id as fallback)
    const creatorName = item.creator || `Creator ${item.user_id?.substring(0, 8) || 'Unknown'}`;
    
    // View count
    const viewCount = item.views_count || 0;
    const likeCount = item.likes_count || 0;
    
    // Duration
    const duration = item.duration ? formatDuration(item.duration) : null;
    
    // Trending badge
    const trendingBadge = isTrending ? '<span class="trending-badge-card">🔥 Trending</span>' : '';
    
    return `
        <div class="content-card" data-content-id="${item.id}">
            <div class="card-thumbnail">
                <img 
                    src="${thumbnail}" 
                    alt="${item.title}"
                    loading="lazy"
                    onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'"
                >
                <div class="thumbnail-overlay"></div>
                ${trendingBadge}
                ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${item.title}">
                    ${displayTitle}
                </h3>
                <div class="card-creator">
                    <i class="fas fa-user"></i>
                    <span>${truncateText(creatorName, 20)}</span>
                </div>
                <div class="card-stats">
                    <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(likeCount)}</span>
                    <span><i class="fas fa-clock"></i> ${formatTimeAgo(item.created_at)}</span>
                </div>
                <div class="card-actions">
                    <button class="action-btn share" onclick="shareContent(event, ${item.id})">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="action-btn like" onclick="likeContent(event, ${item.id})">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Fallback content functions
function getFallbackContent() {
    return [
        {
            id: 1,
            title: 'African Music Festival Highlights 2025',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            creator: 'Music Africa',
            views_count: 12500,
            likes_count: 890,
            duration: 285,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 2,
            title: 'Tech Innovation in Africa: The Future is Now',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            creator: 'Tech Africa Today',
            views_count: 8900,
            likes_count: 650,
            duration: 420,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 3,
            title: 'Traditional Dance Performance: West African Heritage',
            thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            creator: 'Cultural Hub',
            views_count: 15600,
            likes_count: 1200,
            duration: 325,
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 4,
            title: 'African Cuisine Masterclass: Jollof Rice',
            thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
            creator: 'African Food Network',
            views_count: 23400,
            likes_count: 1890,
            duration: 540,
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
}

function getTrendingFallbackContent() {
    return [
        {
            id: 101,
            title: '🔥 LIVE: African Music Awards Red Carpet',
            thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
            creator: 'Entertainment Africa',
            views_count: 45000,
            likes_count: 3400,
            duration: null,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 102,
            title: 'Breaking: Tech Startup Raises $10M in Funding',
            thumbnail_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=225&fit=crop',
            creator: 'Business Insider Africa',
            views_count: 32000,
            likes_count: 2100,
            duration: 180,
            created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 103,
            title: 'Most Viewed: Safari Wildlife Documentary',
            thumbnail_url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=225&fit=crop',
            creator: 'Nature Africa',
            views_count: 89000,
            likes_count: 5600,
            duration: 720,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
}

function getRecommendedFallbackContent() {
    return [
        {
            id: 201,
            title: 'Based on your interests: African Art History',
            thumbnail_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=225&fit=crop',
            creator: 'African Art Museum',
            views_count: 15600,
            likes_count: 890,
            duration: 480,
            created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 202,
            title: 'Similar to your likes: Afrobeat Music Production',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            creator: 'Music Production Africa',
            views_count: 23400,
            likes_count: 1560,
            duration: 360,
            created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
}

// Share content
function shareContent(event, contentId) {
    if (event) event.stopPropagation();
    
    const content = contentData.find(c => c.id === contentId) || 
                    trendingData.find(c => c.id === contentId) || 
                    recommendedData.find(c => c.id === contentId);
    
    if (!content) return;
    
    const shareData = {
        title: content.title,
        text: `Check out "${content.title}" on Bantu Stream Connect`,
        url: window.location.origin + `/content-detail.html?id=${contentId}`
    };
    
    if (navigator.share) {
        navigator.share(shareData).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareData.url)
            .then(() => showToast('Link copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy link', 'error'));
    }
}

// Like content
function likeContent(event, contentId) {
    if (event) event.stopPropagation();
    
    if (!currentUser) {
        showToast('Please sign in to like content', 'warning');
        return;
    }
    
    // Toggle like state
    const btn = event.currentTarget;
    btn.classList.toggle('liked');
    
    showToast('Content liked!', 'success');
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
            <button onclick="window.location.reload()" class="retry-button" style="margin-top: 20px;">
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

// Export functions for global access
window.shareContent = shareContent;
window.likeContent = likeContent;
