// ==========================================================================
// BANTU STREAM CONNECT - HOME FEED ENHANCED
// Version: 3.1 (Fixed Database Queries & Enhanced Responsive Design)
// ==========================================================================

// Global state
let currentUser = null;
let contentData = [];
let trendingData = [];
let recommendedData = [];
let filteredData = [];
let genres = [];
let currentPage = 1;
let isLoading = false;
let hasMoreContent = true;
let searchTimeout = null;
let currentFilters = {
    contentType: 'all',
    genre: 'all',
    sortBy: 'relevance',
    duration: 'all',
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
        
        // Load genres for filters
        await loadGenres();
        
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
            showToast(`Welcome back, ${currentUser.email.split('@')[0]}!`, 'success');
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

// Load genres for filters
async function loadGenres() {
    try {
        // Try to get genres from database
        const { data, error } = await supabaseClient
            .from('Content')
            .select('genre')
            .not('genre', 'is', null)
            .limit(50);
        
        if (error) throw error;
        
        // Extract unique genres
        const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
        genres = uniqueGenres.sort();
        
        // Populate genre filter dropdown
        if (elements.genreFilter && genres.length > 0) {
            elements.genreFilter.innerHTML = '<option value="all">All Genres</option>' +
                genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        }
        
        console.log(`✅ Loaded ${genres.length} genres`);
        
    } catch (error) {
        console.log('Using default genres');
        genres = ['Music', 'Technology', 'Education', 'Entertainment', 'Sports', 'Culture', 'Lifestyle', 'Business'];
        
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
        elements.searchInput.addEventListener('focus', handleSearchFocus);
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
    
    if (elements.durationFilter) {
        elements.durationFilter.addEventListener('change', updateFilters);
    }
    
    // Trending time buttons
    if (elements.timeButtons) {
        elements.timeButtons.forEach(btn => {
            btn.addEventListener('click', handleTimeFilterClick);
        });
    }
    
    // Browse buttons
    if (elements.browseAllBtn) {
        elements.browseAllBtn.addEventListener('click', () => {
            window.location.href = 'explore-screen.html';
        });
    }
    
    if (elements.browseAllCta) {
        elements.browseAllCta.addEventListener('click', () => {
            window.location.href = 'content-library.html';
        });
    }
    
    // Click outside to close search results
    document.addEventListener('click', (e) => {
        if (!elements.searchContainer?.contains(e.target) && 
            !elements.searchResults?.contains(e.target)) {
            closeSearchResults();
        }
    });
    
    // Escape key to close search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchResults();
        }
    });
    
    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            updateProfileButton();
            loadRecommendedContent();
            showToast(`Welcome back, ${session.user.email.split('@')[0]}!`, 'success');
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
    
    // Show search results if query is not empty
    if (query.length > 0) {
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300); // 300ms debounce
    } else {
        closeSearchResults();
    }
}

// Handle search focus
function handleSearchFocus() {
    const query = elements.searchInput.value.trim();
    if (query.length > 0) {
        performSearch(query);
    }
}

// Perform search
async function performSearch(query) {
    try {
        showSearchLoading();
        
        // FIXED: Correct column name - use username instead of display_name
        const { data, error } = await supabaseClient
            .from('Content')
            .select(`
                *,
                creators:creator_id (
                    username,
                    email,
                    profile_picture
                ),
                user_profiles:user_id (
                    username,
                    full_name,
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
    
    if (!results || results.length === 0) {
        elements.searchResultsContent.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No results found for "${query}"</p>
                <p class="search-tip">Try different keywords or check your spelling</p>
            </div>
        `;
    } else {
        elements.searchResultsContent.innerHTML = results.map(item => {
            // Get creator name from either creators or user_profiles
            let creatorName = 'Unknown Creator';
            if (item.creators && item.creators.username) {
                creatorName = item.creators.username;
            } else if (item.user_profiles && (item.user_profiles.full_name || item.user_profiles.username)) {
                creatorName = item.user_profiles.full_name || item.user_profiles.username;
            }
            
            return `
                <div class="search-result-item" onclick="window.location.href='content-detail.html?id=${item.id}'">
                    <div class="search-result-thumbnail">
                        <img 
                            src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=100&h=60&fit=crop'}" 
                            alt="${item.title}"
                            loading="lazy"
                            onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=100&h=60&fit=crop'"
                        >
                    </div>
                    <div class="search-result-details">
                        <h5>${truncateText(item.title, 50)}</h5>
                        <p class="search-result-creator">
                            ${creatorName}
                        </p>
                        <div class="search-result-meta">
                            <span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span>
                            <span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Show search results
    elements.searchResults.style.display = 'block';
}

// Show search loading state
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

// Toggle filters dropdown
function toggleFilters() {
    if (!elements.searchFilters) return;
    
    const isVisible = elements.searchFilters.style.display === 'block';
    elements.searchFilters.style.display = isVisible ? 'none' : 'block';
}

// Update filters
function updateFilters() {
    if (!elements.contentTypeFilter || !elements.genreFilter || 
        !elements.sortFilter || !elements.durationFilter) return;
    
    currentFilters = {
        contentType: elements.contentTypeFilter.value,
        genre: elements.genreFilter.value,
        sortBy: elements.sortFilter.value,
        duration: elements.durationFilter.value,
        trendingHours: currentFilters.trendingHours
    };
}

// Apply filters
function applyFilters() {
    updateFilters();
    closeSearchResults();
    
    // Reload content with filters
    if (elements.searchInput.value.trim()) {
        performSearch(elements.searchInput.value.trim());
    } else {
        currentPage = 1;
        hasMoreContent = true;
        loadContent();
    }
    
    showToast('Filters applied', 'success');
}

// Reset all filters
function resetFilters() {
    if (elements.contentTypeFilter) elements.contentTypeFilter.value = 'all';
    if (elements.genreFilter) elements.genreFilter.value = 'all';
    if (elements.sortFilter) elements.sortFilter.value = 'relevance';
    if (elements.durationFilter) elements.durationFilter.value = 'all';
    
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
        
        // Load content in parallel for better performance
        await Promise.allSettled([
            loadContent(),
            loadTrendingContent(),
            loadRecommendedContent()
        ]);
        
        showLoadingState(false, 'Ready!');
        
    } catch (error) {
        console.error('Error loading initial content:', error);
        showError('Failed to load content. Please refresh.');
    }
}

// Load main content with pagination
async function loadContent() {
    if (isLoading || !hasMoreContent) return;
    
    isLoading = true;
    
    try {
        const limit = 12;
        const from = (currentPage - 1) * limit;
        const to = from + limit - 1;
        
        // FIXED: Use correct table name 'Content' with quotes and correct column names
        let query = supabaseClient
            .from('Content')
            .select(`
                *,
                creators:creator_id (
                    username,
                    email,
                    profile_picture
                ),
                user_profiles:user_id (
                    username,
                    full_name,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(from, to);
        
        // Apply filters if needed
        if (currentFilters.contentType !== 'all') {
            query = query.eq('media_type', currentFilters.contentType);
        }
        
        if (currentFilters.genre !== 'all') {
            query = query.eq('genre', currentFilters.genre);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Process and display data
        if (data && data.length > 0) {
            // Enrich with view counts
            const enrichedData = await enrichContentWithViews(data);
            
            if (currentPage === 1) {
                contentData = enrichedData;
                renderLatestContent(enrichedData);
            } else {
                contentData = [...contentData, ...enrichedData];
                appendLatestContent(enrichedData);
            }
            
            // Check if there's more content
            hasMoreContent = data.length === limit;
            currentPage++;
            
        } else {
            hasMoreContent = false;
            if (currentPage === 1) {
                renderEmptyState('No content available');
            }
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        
        // Show fallback content
        if (currentPage === 1) {
            showFallbackContent();
        }
        
        showToast('Failed to load more content', 'error');
    } finally {
        isLoading = false;
        hideScrollSentinel();
    }
}

// Show fallback content when database fails
function showFallbackContent() {
    const fallbackContent = [
        {
            id: 1,
            title: 'Bantu Stream Connect Launch Event',
            description: 'Highlights from our official launch',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            media_type: 'video',
            genre: 'Entertainment',
            created_at: new Date().toISOString(),
            creators: { username: 'Admin' },
            user_profiles: { full_name: 'Admin User' },
            views_count: 12500,
            likes_count: 890
        },
        {
            id: 2,
            title: 'African Music Festival Highlights',
            description: 'Best moments from African music festivals',
            thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
            media_type: 'video',
            genre: 'Music',
            created_at: new Date().toISOString(),
            creators: { username: 'MusicAfrica' },
            user_profiles: { full_name: 'Music Africa' },
            views_count: 8900,
            likes_count: 650
        },
        {
            id: 3,
            title: 'Tech Innovation in Africa',
            description: 'How technology is transforming the continent',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            media_type: 'video',
            genre: 'Technology',
            created_at: new Date().toISOString(),
            creators: { username: 'TechAfrica' },
            user_profiles: { full_name: 'Tech Africa' },
            views_count: 11200,
            likes_count: 890
        }
    ];
    
    contentData = fallbackContent;
    renderLatestContent(fallbackContent);
    renderTrendingContent(fallbackContent);
    renderRecommendedContent(fallbackContent.slice(0, 3));
}

// Load trending content
async function loadTrendingContent() {
    try {
        // Calculate timestamp for trending period
        const trendingSince = new Date();
        trendingSince.setHours(trendingSince.getHours() - currentFilters.trendingHours);
        
        // FIXED: Simplified query without problematic joins
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .gte('created_at', trendingSince.toISOString())
            .order('views_count', { ascending: false })
            .limit(8);
        
        if (error) throw error;
        
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

// Load personalized recommendations
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
        
        // Simple recommendation algorithm based on genres
        let recommendedQuery;
        
        // First try to get content from popular genres
        if (genres.length > 0) {
            // Get random genres for diversity
            const randomGenres = [...genres].sort(() => 0.5 - Math.random()).slice(0, 3);
            
            recommendedQuery = supabaseClient
                .from('Content')
                .select('*')
                .eq('status', 'published')
                .in('genre', randomGenres)
                .order('views_count', { ascending: false })
                .limit(6);
        } else {
            // Fallback: Get recently popular content
            recommendedQuery = supabaseClient
                .from('Content')
                .select('*')
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(6);
        }
        
        const { data, error } = await recommendedQuery;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            recommendedData = data;
            renderRecommendedContent(data);
        } else {
            renderRecommendedFallback();
        }
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        renderRecommendedFallback();
    }
}

// Enrich content with view counts
async function enrichContentWithViews(contentItems) {
    if (!contentItems || contentItems.length === 0) return contentItems;
    
    // Return items with existing views_count (already in the data)
    return contentItems.map(item => ({
        ...item,
        actual_views: item.views_count || 0
    }));
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
        rootMargin: '100px',
        threshold: 0.1
    });
    
    observer.observe(elements.scrollSentinel);
}

// Show scroll sentinel
function showScrollSentinel() {
    if (elements.scrollSentinel) {
        elements.scrollSentinel.classList.add('visible');
    }
}

// Hide scroll sentinel
function hideScrollSentinel() {
    if (elements.scrollSentinel) {
        elements.scrollSentinel.classList.remove('visible');
    }
}

// Render latest content
function renderLatestContent(content) {
    if (!elements.latestContent) return;
    
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
    if (!elements.latestContent) return;
    
    const newCards = content.map(item => renderContentCard(item)).join('');
    elements.latestContent.insertAdjacentHTML('beforeend', newCards);
    
    // Add click handlers for new cards
    setTimeout(() => {
        const allCards = document.querySelectorAll('#latest-content .content-card');
        const newCards = Array.from(allCards).slice(-content.length);
        
        newCards.forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Render trending content
function renderTrendingContent(content) {
    if (!elements.trendingContent) return;
    
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
    
    elements.trendingContent.innerHTML = `
        <div class="trending-fallback">
            <i class="fas fa-chart-line"></i>
            <p>Trending content will appear here</p>
            <p class="search-tip">Check back later for trending videos!</p>
        </div>
    `;
}

// Render recommended content
function renderRecommendedContent(content) {
    if (!elements.recommendedContent) return;
    
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
    
    elements.recommendedContent.innerHTML = `
        <div class="recommended-fallback">
            <i class="fas fa-star"></i>
            <p>Personalized recommendations will appear here</p>
            <p class="search-tip">Sign in to get personalized recommendations!</p>
        </div>
    `;
}

// Render empty state
function renderEmptyState(message) {
    if (!elements.latestContent) return;
    
    elements.latestContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-film"></i>
            <p>${message}</p>
            <p class="search-tip">Check back later for new content!</p>
        </div>
    `;
}

// Render content card with lazy loading
function renderContentCard(item, isTrending = false) {
    // Optimize thumbnail with query params
    const thumbnail = item.thumbnail_url 
        ? `${item.thumbnail_url}?w=400&h=225&fit=crop&auto=format&q=80`
        : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop&auto=format&q=80';
    
    // Truncate title
    const displayTitle = truncateText(item.title || 'Untitled Content', 50);
    
    // Get creator info
    let creatorName = 'Creator';
    if (item.creators && item.creators.username) {
        creatorName = item.creators.username;
    } else if (item.user_profiles && (item.user_profiles.full_name || item.user_profiles.username)) {
        creatorName = item.user_profiles.full_name || item.user_profiles.username;
    }
    
    const displayCreator = `@${creatorName}`;
    
    // View count
    const viewCount = item.actual_views || item.views_count || 0;
    const likeCount = item.likes_count || 0;
    
    // Trending badge
    const trendingBadge = isTrending ? '<span class="trending-badge-small">🔥 Trending</span>' : '';
    
    return `
        <div class="content-card" data-content-id="${item.id}">
            <div class="card-thumbnail">
                <img 
                    src="${thumbnail}" 
                    alt="${item.title || 'Content'}"
                    loading="lazy"
                    data-src="${thumbnail}"
                    class="lazy-image"
                    onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'"
                >
                <div class="thumbnail-overlay"></div>
                ${trendingBadge}
                <button class="share-btn" aria-label="Share" onclick="shareContent(event, ${item.id})">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${item.title || 'Content'}">
                    ${displayTitle}
                </h3>
                <button class="creator-btn" onclick="viewCreator(event, ${item.id}, '${item.creator_id || item.user_id}', '${(creatorName).replace(/'/g, "\\'")}')">
                    <i class="fas fa-user"></i>
                    ${truncateText(displayCreator, 20)}
                </button>
                <div class="card-stats">
                    <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(likeCount)}</span>
                </div>
            </div>
        </div>
    `;
}

// Share content
function shareContent(event, contentId) {
    if (event) event.stopPropagation();
    
    const content = contentData.find(c => c.id === contentId) || 
                    trendingData.find(c => c.id === contentId) || 
                    recommendedData.find(c => c.id === contentId);
    
    if (!content) return;
    
    const shareData = {
        title: content.title || 'Bantu Stream Connect',
        text: `Check out "${content.title || 'this content'}" on Bantu Stream Connect`,
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

// View creator
function viewCreator(event, contentId, creatorId, creatorName) {
    if (event) event.stopPropagation();
    
    if (creatorId) {
        window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
    } else {
        showToast(`Viewing ${creatorName}'s content`, 'info');
    }
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
            <button onclick="window.location.reload()" class="retry-button" style="margin-top: 20px; padding: 10px 20px; background: var(--bantu-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">
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
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Utility functions

function truncateText(text, maxLength) {
    if (!text) return 'Untitled';
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
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize lazy loading for images
function initLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
        // Browser supports native lazy loading
        const images = document.querySelectorAll('img[loading="lazy"]');
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
        
        const images = document.querySelectorAll('.lazy-image');
        images.forEach(img => observer.observe(img));
    }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', initLazyLoading);

// Export functions for global access
window.shareContent = shareContent;
window.viewCreator = viewCreator;
