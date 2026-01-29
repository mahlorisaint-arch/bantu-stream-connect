// ==========================================================================
// BANTU STREAM CONNECT - HOME FEED
// Version: 3.3 (Working Database Queries)
// ==========================================================================

// Global state
let currentUser = null;
let contentData = [];
let trendingData = [];
let recommendedData = [];
let currentPage = 1;
let isLoading = false;
let hasMoreContent = true;

// DOM Elements
let elements = {};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Bantu Stream Connect Home Feed Initializing...');
    
    try {
        // Cache DOM elements
        cacheElements();
        
        // Initialize Supabase
        await initializeSupabase();
        
        // Check authentication
        await checkAuth();
        
        // Load initial content
        await loadInitialContent();
        
        // Setup event listeners
        setupEventListeners();
        
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
        recommendedContent: document.getElementById('recommended-content'),
        trendingContent: document.getElementById('trending-content'),
        latestContent: document.getElementById('latest-content'),
        searchInput: document.getElementById('global-search'),
        profileBtn: document.getElementById('profile-btn'),
        browseAllBtn: document.getElementById('browse-all-btn')
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
    
    // Browse button
    if (elements.browseAllBtn) {
        elements.browseAllBtn.addEventListener('click', () => {
            window.location.href = 'content-library.html';
        });
    }
    
    // Profile button for non-logged in users
    if (elements.profileBtn && !currentUser) {
        elements.profileBtn.onclick = () => {
            window.location.href = 'login.html?redirect=index.html';
        };
    }
}

// Handle search input
function handleSearchInput(e) {
    const query = e.target.value.trim();
    if (query.length > 0) {
        // Simple search redirection
        window.location.href = `content-library.html?search=${encodeURIComponent(query)}`;
    }
}

// Load initial content
async function loadInitialContent() {
    try {
        showLoadingState(true, 'Loading your feed...');
        
        // Load all content types in sequence
        await loadContent();
        await loadTrendingContent();
        await loadRecommendedContent();
        
        showLoadingState(false, 'Ready!');
        
    } catch (error) {
        console.error('Error loading initial content:', error);
        showError('Failed to load content. Please refresh.');
    }
}

// Load main content - FIXED: Simple query without joins
async function loadContent() {
    if (isLoading || !hasMoreContent) return;
    
    isLoading = true;
    
    try {
        const limit = 12;
        const from = (currentPage - 1) * limit;
        const to = from + limit - 1;
        
        // SIMPLE QUERY: Just get content, no joins
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(from, to);
        
        if (error) {
            console.error('Database error:', error);
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
                renderEmptyState('No content available yet');
            }
        }
        
    } catch (error) {
        console.error('Error loading content:', error);
        showToast('Failed to load content. Please check your connection.', 'error');
        
        // Show sample content only if no real content
        if (contentData.length === 0) {
            showSampleContent();
        }
    } finally {
        isLoading = false;
    }
}

// Load trending content
async function loadTrendingContent() {
    try {
        // Simple trending query
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .limit(8);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            trendingData = data;
            renderTrendingContent(data);
        } else {
            // Don't show trending if no data
            document.querySelector('.trending-section').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading trending content:', error);
        document.querySelector('.trending-section').style.display = 'none';
    }
}

// Load recommended content
async function loadRecommendedContent() {
    if (!currentUser) {
        // Hide recommended section for non-logged in users
        document.getElementById('recommended-section').style.display = 'none';
        return;
    }
    
    try {
        // Simple recommendations
        const { data, error } = await supabaseClient
            .from('Content')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(6);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            recommendedData = data;
            renderRecommendedContent(data);
        }
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        // Just hide the section
        document.getElementById('recommended-section').style.display = 'none';
    }
}

// Show sample content (only if database fails)
function showSampleContent() {
    const sampleContent = [
        {
            id: 1,
            title: 'Welcome to Bantu Stream Connect',
            description: 'Your premier platform for African content',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            media_type: 'video',
            genre: 'Entertainment',
            creator: 'Bantu Stream Connect',
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
            creator: 'MusicAfrica',
            views_count: 8900,
            likes_count: 650
        }
    ];
    
    contentData = sampleContent;
    renderLatestContent(sampleContent);
    renderTrendingContent(sampleContent);
}

// Render latest content
function renderLatestContent(content) {
    if (!elements.latestContent) return;
    
    elements.latestContent.innerHTML = content.map(item => renderContentCard(item)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#latest-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', () => {
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Append more content
function appendLatestContent(content) {
    if (!elements.latestContent) return;
    
    const newCards = content.map(item => renderContentCard(item)).join('');
    elements.latestContent.insertAdjacentHTML('beforeend', newCards);
}

// Render trending content
function renderTrendingContent(content) {
    if (!elements.trendingContent) return;
    
    elements.trendingContent.innerHTML = content.map(item => renderContentCard(item, true)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#trending-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', () => {
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Render recommended content
function renderRecommendedContent(content) {
    if (!elements.recommendedContent) return;
    
    elements.recommendedContent.innerHTML = content.map(item => renderContentCard(item)).join('');
    
    // Add click handlers
    setTimeout(() => {
        document.querySelectorAll('#recommended-content .content-card').forEach(card => {
            const contentId = card.dataset.contentId;
            card.addEventListener('click', () => {
                window.location.href = `content-detail.html?id=${contentId}`;
            });
        });
    }, 100);
}

// Render content card
function renderContentCard(item, isTrending = false) {
    const thumbnail = item.thumbnail_url || 
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    const displayTitle = truncateText(item.title || 'Untitled Content', 50);
    const creatorName = item.creator || 'Creator';
    const viewCount = item.views_count || 0;
    const likeCount = item.likes_count || 0;
    
    const trendingBadge = isTrending ? '<span class="trending-badge-small">🔥 Trending</span>' : '';
    
    return `
        <div class="content-card" data-content-id="${item.id}">
            <div class="card-thumbnail">
                <img src="${thumbnail}" alt="${item.title || 'Content'}" loading="lazy">
                <div class="thumbnail-overlay"></div>
                ${trendingBadge}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${item.title || 'Content'}">
                    ${displayTitle}
                </h3>
                <button class="creator-btn">
                    <i class="fas fa-user"></i>
                    ${truncateText(creatorName, 20)}
                </button>
                <div class="card-stats">
                    <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(likeCount)}</span>
                </div>
            </div>
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
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: var(--bantu-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">
                Refresh Page
            </button>
        `;
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
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
