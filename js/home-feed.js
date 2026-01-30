// ==========================================================================
// BANTU STREAM CONNECT - HOME FEED
// Version: 5.1 (Updated to work with HTML Supabase initialization)
// ==========================================================================

// Global state
let currentUser = null;
let contentData = [];
let trendingData = [];
let recommendedData = [];
let genres = [];
let currentPage = 1;
let isLoading = false;
let hasMoreContent = true;
let searchTimeout = null;

// DOM Elements
let elements = {};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Bantu Stream Connect Home Feed Initializing...');
    
    try {
        // Cache DOM elements
        cacheElements();
        
        // Verify Supabase client is initialized
        if (!window.supabaseClient) {
            console.error('❌ Supabase client not initialized. Check index.html configuration.');
            showError('Configuration error. Please refresh the page.');
            return;
        }
        
        // Check authentication FIRST
        await checkAuthAndInitialize();
        
        // Load genres for filters
        await loadGenres();
        
        // Setup event listeners
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

// Cache DOM elements
function cacheElements() {
    elements = {
        app: document.getElementById('app'),
        loading: document.getElementById('loading'),
        loadingText: document.getElementById('loading-text'),
        contentSections: document.getElementById('content-sections'),
        recommendedSection: document.getElementById('recommended-section'),
        recommendedContent: document.getElementById('recommended-content'),
        trendingContent: document.getElementById('trending-content'),
        latestContent: document.getElementById('latest-content'),
        searchInput: document.getElementById('global-search'),
        searchContainer: document.getElementById('search-container'),
        searchFilters: document.getElementById('search-filters'),
        searchResults: document.getElementById('search-results'),
        searchResultsContent: document.getElementById('search-results-content'),
        filterBtn: document.getElementById('filter-btn'),
        clearSearch: document.getElementById('clear-search'),
        closeSearch: document.getElementById('close-search'),
        applyFilters: document.getElementById('apply-filters'),
        resetFilters: document.getElementById('reset-filters'),
        scrollSentinel: document.getElementById('scroll-sentinel'),
        profileBtn: document.getElementById('profile-btn'),
        browseAllBtn: document.getElementById('browse-all-btn'),
        browseAllCta: document.getElementById('browse-all-cta'),
        toastContainer: document.getElementById('toast-container'),
        contentTypeFilter: document.getElementById('content-type-filter'),
        genreFilter: document.getElementById('genre-filter'),
        sortFilter: document.getElementById('sort-filter'),
        durationFilter: document.getElementById('duration-filter'),
        timeButtons: document.querySelectorAll('.time-btn')
    };
}

// Check authentication and initialize user
async function checkAuthAndInitialize() {
    console.log('🔐 Checking authentication...');
    
    try {
        // First check for OAuth redirect tokens
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
            console.log('🔄 Processing OAuth redirect...');
            try {
                const { data: { session }, error } = await window.supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });
                
                if (!error && session) {
                    console.log('✅ OAuth session set for:', session.user.email);
                    currentUser = session.user;
                    updateProfileButton();
                    
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    // Create user profile if needed
                    await createUserProfile(session.user);
                    
                    showToast(`Welcome, ${session.user.email}!`, 'success');
                    return;
                }
            } catch (oauthError) {
                console.error('OAuth processing failed:', oauthError);
            }
        }
        
        // Check for existing session
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            setupProfileButtonForLogin();
            return;
        }
        
        if (session) {
            console.log('✅ User authenticated:', session.user.email);
            currentUser = session.user;
            updateProfileButton();
            
            // Create user profile if needed
            await createUserProfile(session.user);
            
            showToast(`Welcome back, ${session.user.email}!`, 'success');
        } else {
            console.log('👤 No user authenticated (public mode)');
            setupProfileButtonForLogin();
        }
        
    } catch (error) {
        console.error('Auth check error:', error);
        setupProfileButtonForLogin();
    }
}

// Create user profile if it doesn't exist
async function createUserProfile(user) {
    try {
        // Check if user profile already exists
        const { data: existingProfile, error: checkError } = await window.supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
        
        if (checkError) {
            console.log('Profile check error:', checkError);
            return;
        }
        
        if (!existingProfile) {
            // Create user profile
            const { error: createError } = await window.supabaseClient
                .from('user_profiles')
                .upsert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                    username: user.user_metadata?.user_name || user.email.split('@')[0].toLowerCase(),
                    role: 'creator',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            
            if (!createError) {
                console.log('✅ User profile created');
            } else {
                console.error('Error creating user profile:', createError);
            }
        }
    } catch (error) {
        console.error('Failed to create user profile:', error);
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
    
    elements.profileBtn.innerHTML = `
        <div class="profile-placeholder">
            <i class="fas fa-user"></i>
        </div>
    `;
    
    elements.profileBtn.onclick = () => {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    };
}

// Get initials from email
function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
}

// Load genres for filters
async function loadGenres() {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('genre')
            .not('genre', 'is', null)
            .limit(50);
        
        if (error) throw error;
        
        // Extract unique genres
        const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
        genres = uniqueGenres;
        
        // Populate genre filter dropdown
        if (elements.genreFilter && genres.length > 0) {
            elements.genreFilter.innerHTML = '<option value="all">All Genres</option>' +
                genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        }
        
        console.log(`✅ Loaded ${genres.length} genres`);
        
    } catch (error) {
        console.log('Using default genres');
        genres = ['Music', 'Technology', 'Education', 'Entertainment', 'Sports', 'Culture'];
        
        if (elements.genreFilter) {
            elements.genreFilter.innerHTML = '<option value="all">All Genres</option>' +
                genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        }
    }
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
    
    if (elements.closeSearch) {
        elements.closeSearch.addEventListener('click', closeSearchResults);
    }
    
    if (elements.applyFilters) {
        elements.applyFilters.addEventListener('click', applyFilters);
    }
    
    if (elements.resetFilters) {
        elements.resetFilters.addEventListener('click', resetFilters);
    }
    
    // Browse buttons
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
    
    // Setup auth state change listener
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
                currentUser = session.user;
                console.log('✅ User authenticated via state change:', currentUser.email);
                updateProfileButton();
                
                // Load recommendations for logged-in user
                await loadRecommendedContent();
                
                if (event === 'SIGNED_IN') {
                    showToast(`Welcome, ${session.user.email}!`, 'success');
                }
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            console.log('User signed out');
            setupProfileButtonForLogin();
            
            // Hide recommendations section
            if (elements.recommendedSection) {
                elements.recommendedSection.style.display = 'none';
            }
        }
    });
}

// Handle search input
function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length > 0) {
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    } else {
        closeSearchResults();
    }
}

// Perform search
async function performSearch(query) {
    try {
        showSearchLoading();
        
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,genre.ilike.%${query}%`)
            .eq('status', 'published')
            .limit(10);
        
        if (error) throw error;
        
        displaySearchResults(data, query);
        
    } catch (error) {
        console.error('Search error:', error);
        showSearchError();
    }
}

// Display search results
function displaySearchResults(results, query) {
    if (!elements.searchResults || !elements.searchResultsContent) return;
    
    if (results.length === 0) {
        elements.searchResultsContent.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No results found for "${query}"</p>
            </div>
        `;
    } else {
        elements.searchResultsContent.innerHTML = results.map(item => {
            const creatorInfo = getCreatorInfo(item);
            return `
                <div class="search-result-item" onclick="window.location.href='content-detail.html?id=${item.id}'">
                    <div class="search-result-thumbnail">
                        <img src="${fixThumbnailUrl(item.thumbnail_url)}" alt="${item.title}">
                    </div>
                    <div class="search-result-details">
                        <h5>${truncateText(item.title, 50)}</h5>
                        <p class="search-result-creator">@${creatorInfo.username}</p>
                        <div class="search-result-meta">
                            <span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span>
                            <span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    elements.searchResults.style.display = 'block';
}

// Show search loading
function showSearchLoading() {
    if (!elements.searchResultsContent) return;
    
    elements.searchResultsContent.innerHTML = `
        <div class="search-loading">
            <div class="spinner-small"></div>
            <p>Searching...</p>
        </div>
    `;
    
    if (elements.searchResults) {
        elements.searchResults.style.display = 'block';
    }
}

// Show search error
function showSearchError() {
    if (!elements.searchResultsContent) return;
    
    elements.searchResultsContent.innerHTML = `
        <div class="search-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Search failed. Please try again.</p>
        </div>
    `;
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
        elements.searchInput.focus();
    }
    closeSearchResults();
}

// Close search results
function closeSearchResults() {
    if (elements.searchResults) {
        elements.searchResults.style.display = 'none';
    }
    if (elements.searchFilters) {
        elements.searchFilters.style.display = 'none';
    }
}

// Toggle filters
function toggleFilters() {
    if (!elements.searchFilters) return;
    
    const isVisible = elements.searchFilters.style.display === 'block';
    elements.searchFilters.style.display = isVisible ? 'none' : 'block';
}

// Apply filters
function applyFilters() {
    showToast('Filters applied', 'success');
    closeSearchResults();
}

// Reset filters
function resetFilters() {
    if (elements.contentTypeFilter) elements.contentTypeFilter.value = 'all';
    if (elements.genreFilter) elements.genreFilter.value = 'all';
    if (elements.sortFilter) elements.sortFilter.value = 'relevance';
    if (elements.durationFilter) elements.durationFilter.value = 'all';
    
    applyFilters();
}

// Load initial content
async function loadInitialContent() {
    try {
        showLoadingState(true, 'Loading your feed...');
        
        await Promise.all([
            loadLatestContent(),
            loadTrendingContent(),
            loadRecommendedContent()
        ]);
        
        showLoadingState(false, 'Ready!');
        
    } catch (error) {
        console.error('Error loading content:', error);
        showToast('Failed to load some content', 'error');
    }
}

// Load latest content
async function loadLatestContent() {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(12);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            contentData = data;
            renderContent(data, 'latest');
        } else {
            renderEmptyState('latest', 'No content available yet');
        }
        
    } catch (error) {
        console.error('Error loading latest content:', error);
        renderEmptyState('latest', 'Failed to load content');
    }
}

// Load trending content
async function loadTrendingContent() {
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .gte('created_at', weekAgo.toISOString())
            .order('views_count', { ascending: false })
            .limit(8);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            trendingData = data;
            renderContent(data, 'trending', true);
        } else {
            // Fallback to latest content
            if (contentData.length > 0) {
                renderContent(contentData.slice(0, 8), 'trending', true);
            }
        }
        
    } catch (error) {
        console.error('Error loading trending content:', error);
        if (contentData.length > 0) {
            renderContent(contentData.slice(0, 8), 'trending', true);
        }
    }
}

// Load recommended content
async function loadRecommendedContent() {
    // Only show for authenticated users
    if (!currentUser) {
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
        
        console.log('Loading recommendations for user:', currentUser.id);
        
        // Try to get user's liked content
        const { data: userLikes, error: likesError } = await window.supabaseClient
            .from('pulse_likes')
            .select('content_id')
            .eq('user_id', currentUser.id)
            .limit(10);
        
        let recommendedQuery;
        
        if (!likesError && userLikes && userLikes.length > 0) {
            const likedIds = userLikes.map(like => like.content_id);
            const { data: likedContent } = await window.supabaseClient
                .from('Content')
                .select('genre')
                .in('id', likedIds);
            
            if (likedContent && likedContent.length > 0) {
                const userGenres = [...new Set(likedContent.map(item => item.genre).filter(Boolean))];
                
                if (userGenres.length > 0) {
                    recommendedQuery = window.supabaseClient
                        .from('Content')
                        .select(`
                            *,
                            user_profiles!user_id (
                                full_name,
                                username,
                                avatar_url
                            )
                        `)
                        .eq('status', 'published')
                        .in('genre', userGenres)
                        .order('views_count', { ascending: false })
                        .limit(6);
                }
            }
        }
        
        // Fallback to trending content
        if (!recommendedQuery) {
            recommendedQuery = window.supabaseClient
                .from('Content')
                .select(`
                    *,
                    user_profiles!user_id (
                        full_name,
                        username,
                        avatar_url
                    )
                `)
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(6);
        }
        
        const { data, error } = await recommendedQuery;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            recommendedData = data;
            renderContent(data, 'recommended');
        } else {
            renderRecommendedFallback();
        }
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        renderRecommendedFallback();
    }
}

// Render content
function renderContent(items, section, isTrending = false) {
    const container = document.getElementById(`${section}Content`);
    if (!container) return;
    
    container.innerHTML = items.map(item => createContentCard(item, section, isTrending)).join('');
    
    // Add click handlers
    setTimeout(() => {
        container.querySelectorAll('.content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Create content card
function createContentCard(item, section, isTrending = false) {
    const creatorInfo = getCreatorInfo(item);
    const thumbnail = fixThumbnailUrl(item.thumbnail_url);
    
    let badge = '';
    if (isTrending) {
        badge = '<span class="trending-badge-small">🔥 Trending</span>';
    } else if (section === 'recommended') {
        badge = '<span class="trending-badge-small" style="background: linear-gradient(135deg, #1D4ED8, #F59E0B);">⭐ For You</span>';
    }
    
    return `
        <div class="content-card" data-content-id="${item.id}">
            <div class="card-thumbnail">
                <img 
                    src="${thumbnail}" 
                    alt="${item.title || 'Content'}"
                    loading="lazy"
                    onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'"
                >
                <div class="thumbnail-overlay"></div>
                ${badge}
                <button class="share-btn" aria-label="Share" onclick="shareContent(${item.id})">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${item.title || 'Untitled'}">
                    ${truncateText(item.title || 'Untitled', 50)}
                </h3>
                <button class="creator-btn" onclick="viewCreator('${creatorInfo.id}', '${creatorInfo.name}')">
                    <i class="fas fa-user"></i>
                    @${truncateText(creatorInfo.username, 15)}
                </button>
                <div class="card-stats">
                    <span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span>
                </div>
            </div>
        </div>
    `;
}

// Get creator info from content item
function getCreatorInfo(item) {
    let creatorName = 'Creator';
    let creatorUsername = 'creator';
    let creatorId = item.user_id || item.creator_id;
    
    // Check user_profiles first
    if (item.user_profiles) {
        creatorName = item.user_profiles.full_name || item.user_profiles.username || creatorName;
        creatorUsername = item.user_profiles.username || 'creator';
    }
    
    // Fallback to creator field
    if (item.creator && creatorName === 'Creator') {
        creatorName = item.creator;
        creatorUsername = item.creator.toLowerCase().replace(/\s+/g, '');
    }
    
    return {
        name: creatorName,
        username: creatorUsername,
        id: creatorId
    };
}

// Fix thumbnail URL
function fixThumbnailUrl(url) {
    if (!url || url === 'null' || url === 'undefined') {
        return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    }
    
    if (url.startsWith('http')) {
        if (!url.includes('?') && (url.includes('supabase.co') || url.includes('unsplash.com'))) {
            return `${url}?w=400&h=225&fit=crop&auto=format&q=80`;
        }
        return url;
    }
    
    if (url.startsWith('storage/') || url.includes('supabase.co/storage')) {
        if (!url.startsWith('http')) {
            return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.replace('storage/', '')}?w=400&h=225&fit=crop`;
        }
    }
    
    return url;
}

// Render empty state
function renderEmptyState(section, message) {
    const container = document.getElementById(`${section}Content`);
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-film"></i>
            <p>${message}</p>
        </div>
    `;
}

// Render recommended fallback
function renderRecommendedFallback() {
    if (!elements.recommendedContent) return;
    
    elements.recommendedContent.innerHTML = `
        <div class="recommended-fallback">
            <i class="fas fa-star"></i>
            <p>Like some content to get personalized recommendations!</p>
        </div>
    `;
}

// Setup infinite scroll
function setupInfiniteScroll() {
    if (!elements.scrollSentinel) return;
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMoreContent) {
            loadMoreContent();
        }
    }, { threshold: 0.1 });
    
    observer.observe(elements.scrollSentinel);
}

// Load more content
async function loadMoreContent() {
    if (isLoading || !hasMoreContent) return;
    
    isLoading = true;
    
    try {
        const limit = 12;
        const from = currentPage * limit;
        
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            contentData = [...contentData, ...data];
            appendContent(data);
            currentPage++;
            hasMoreContent = data.length === limit;
        } else {
            hasMoreContent = false;
        }
        
    } catch (error) {
        console.error('Error loading more content:', error);
    } finally {
        isLoading = false;
    }
}

// Append more content
function appendContent(items) {
    if (!elements.latestContent) return;
    
    const newCards = items.map(item => createContentCard(item, 'latest')).join('');
    elements.latestContent.insertAdjacentHTML('beforeend', newCards);
}

// Show/hide loading state
function showLoadingState(loading, message) {
    if (!elements.loadingText || !elements.loading) return;
    
    if (loading) {
        elements.loadingText.textContent = message;
        elements.loading.style.display = 'flex';
    } else {
        elements.loadingText.textContent = message;
        setTimeout(() => {
            elements.loading.style.display = 'none';
        }, 500);
    }
}

// Show app
function showApp() {
    if (elements.app && elements.loading) {
        elements.app.style.display = 'block';
        setTimeout(() => {
            elements.loading.style.display = 'none';
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
            <button onclick="window.location.reload()" class="hero-btn" style="margin-top: 20px;">
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
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Utility functions
function truncateText(text, maxLength) {
    return text?.length > maxLength ? text.substring(0, maxLength) + '...' : text || '';
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// Global functions
window.shareContent = function(contentId) {
    const url = `${window.location.origin}/content-detail.html?id=${contentId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Check out this content on Bantu Stream Connect',
            url: url
        });
    } else {
        navigator.clipboard.writeText(url)
            .then(() => showToast('Link copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy link', 'error'));
    }
};

window.viewCreator = function(creatorId, creatorName) {
    if (creatorId) {
        window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
    } else {
        showToast(`Viewing ${creatorName}'s content`, 'info');
    }
};

// Fix all thumbnails on page
function fixAllThumbnails() {
    document.querySelectorAll('img').forEach(img => {
        if (img.src.includes('thumbnail') || img.closest('.card-thumbnail')) {
            const currentSrc = img.src;
            if (!currentSrc.includes('unsplash.com') && !currentSrc.includes('?w=')) {
                img.src = fixThumbnailUrl(currentSrc);
            }
        }
    });
}

// Run thumbnail fix after page loads
setTimeout(fixAllThumbnails, 1000);
setTimeout(fixAllThumbnails, 3000);

// Export for debugging - match the debugAuth function in index.html
window.refreshAuth = async function() {
    console.log('🔄 Manually refreshing auth...');
    await checkAuthAndInitialize();
    if (currentUser) {
        await loadRecommendedContent();
    }
    return currentUser;
};
