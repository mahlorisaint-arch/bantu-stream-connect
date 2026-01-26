// content-detail.js - UPDATED WITH WEEK 2 INTEGRATION

console.log('🎬 Content Detail Screen Initializing with Week 2 Updates...');

// Global variables
let currentContent = null;
let currentUserId = null;
let isAppInitialized = false;
let enhancedVideoPlayer = null;

// Wait for DOM and dependencies
window.onload = function() {
    console.log('Window loaded, starting Week 2 initialization...');
    initializeWithState();
};

// Main initialization with state management
async function initializeWithState() {
    if (isAppInitialized) return;
    
    console.log('🚀 Starting app initialization with state management...');
    
    try {
        // Get content ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        let contentId = urlParams.get('id');
        
        if (!contentId) {
            contentId = window.location.hash.replace('#', '') || '68';
        }
        
        console.log('📋 Content ID from URL:', contentId);
        
        // Set current content in state
        if (window.state && window.state.setCurrentContent) {
            window.state.setCurrentContent(contentId);
        }
        
        // Update loading text
        updateLoadingText('Connecting to database...');
        
        // Check if content is cached in state
        let cachedContent = null;
        if (window.state && window.state.getCachedContent) {
            cachedContent = window.state.getCachedContent(contentId);
        }
        
        if (cachedContent) {
            console.log('✅ Using cached content');
            currentContent = cachedContent;
            updateContentUI(currentContent);
            
            // Still fetch fresh data in background
            fetchContentDetails(contentId);
        } else {
            // Fetch content details
            await fetchContentDetails(contentId);
        }
        
        // Check user's interaction history with this content
        checkUserHistory(contentId);
        
        // Load related content
        await fetchRelatedContent(contentId);
        
        // Setup UI based on state
        setupUIWithState(contentId);
        
        // Initialize enhanced video player
        initializeEnhancedVideoPlayer();
        
        // Setup keyboard navigation
        setupKeyboardSupport();
        
        // Setup state subscriptions
        setupStateSubscriptions();
        
        // Hide loading and show app
        showApp();
        
        isAppInitialized = true;
        console.log('✅ App initialized successfully with Week 2 features');
        
    } catch (error) {
        console.error('❌ Error in initializeWithState:', error);
        useFallbackData();
    }
}

// Fetch content details with state caching
async function fetchContentDetails(contentId) {
    try {
        updateLoadingText('Loading content...');
        
        // Wait for SupabaseHelper to initialize
        let attempts = 0;
        while (!window.SupabaseHelper || !window.SupabaseHelper.isInitialized) {
            attempts++;
            if (attempts >= 10) {
                console.warn('⚠️ SupabaseHelper not initialized after max attempts');
                throw new Error('SupabaseHelper not available');
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Get current user
        if (window.SupabaseHelper.getCurrentUser) {
            const user = await window.SupabaseHelper.getCurrentUser();
            currentUserId = user?.id || null;
            console.log('Current user:', currentUserId ? 'Logged in' : 'Guest');
            
            // Set user in state
            if (window.state && window.state.setUser && user) {
                window.state.setUser({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.email?.split('@')[0]
                });
            }
        }
        
        // Fetch content
        currentContent = await window.SupabaseHelper.getContentById(contentId);
        
        if (!currentContent) {
            throw new Error('Failed to fetch content');
        }
        
        console.log('✅ Content loaded:', currentContent.title);
        
        // Cache content in state
        if (window.state && window.state.cacheContent) {
            window.state.cacheContent(currentContent);
        }
        
        // Record view
        await window.SupabaseHelper.recordView(contentId, currentUserId);
        
        // Update UI
        updateContentUI(currentContent);
        
        // Update watch history in state
        if (window.state && window.state.updateWatchHistory) {
            window.state.updateWatchHistory(contentId, 0, currentContent.duration || 3600);
        }
        
        return currentContent;
        
    } catch (error) {
        console.error('❌ Error fetching content:', error);
        throw error;
    }
}

// Fetch related content
async function fetchRelatedContent(contentId) {
    try {
        updateLoadingText('Loading related content...');
        
        if (!window.SupabaseHelper || !window.SupabaseHelper.isInitialized) {
            console.warn('⚠️ SupabaseHelper not available for related content');
            return;
        }
        
        const relatedContent = await window.SupabaseHelper.getRelatedContent(
            contentId,
            currentContent?.genre,
            currentContent?.creator_id,
            6
        );
        
        renderRelatedContent(relatedContent);
        
    } catch (error) {
        console.error('❌ Error fetching related content:', error);
        renderRelatedContent([]);
    }
}

// Check user's history with this content
function checkUserHistory(contentId) {
    if (!window.state || !window.state.getWatchHistory) return;
    
    const history = window.state.getWatchHistory(contentId);
    
    if (history?.resumeTime) {
        showResumeButton(history.resumeTime);
    }
    
    updateInteractionButtons(contentId);
}

// Show resume button
function showResumeButton(resumeTime) {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn btn-secondary';
    resumeBtn.id = 'resumeBtn';
    resumeBtn.innerHTML = `
        <i class="fas fa-redo"></i>
        <span>Resume from ${formatDuration(resumeTime)}</span>
    `;
    
    resumeBtn.addEventListener('click', () => {
        if (enhancedVideoPlayer) {
            enhancedVideoPlayer.seek(resumeTime);
            enhancedVideoPlayer.play();
            
            const player = document.getElementById('inlinePlayer');
            if (player) player.style.display = 'block';
        }
    });
    
    heroActions.insertBefore(resumeBtn, heroActions.firstChild);
}

// Update interaction buttons based on state
function updateInteractionButtons(contentId) {
    const favoriteBtn = document.getElementById('favoriteBtn');
    const likeBtn = document.getElementById('likeBtn');
    const connectBtn = document.getElementById('connectBtn');
    
    if (favoriteBtn && window.state && window.state.isFavorite) {
        const isFavorited = window.state.isFavorite(contentId);
        favoriteBtn.querySelector('i').className = isFavorited ? 'fas fa-heart' : 'far fa-heart';
        favoriteBtn.querySelector('span').textContent = isFavorited ? 'Favorited' : 'Favorite';
        if (isFavorited) favoriteBtn.classList.add('active');
    }
    
    // Similar for like and connect buttons when implemented
}

// Setup UI with state integration
function setupUIWithState(contentId) {
    // Set up event listeners that update state
    const favoriteBtn = document.getElementById('favoriteBtn');
    const connectBtn = document.getElementById('connectBtn');
    
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', () => {
            if (!contentId) return;
            
            const isNowFavorited = window.state.toggleFavorite(contentId);
            
            // Update UI
            favoriteBtn.querySelector('i').className = isNowFavorited ? 'fas fa-heart' : 'far fa-heart';
            favoriteBtn.querySelector('span').textContent = isNowFavorited ? 'Favorited' : 'Favorite';
            
            if (isNowFavorited) {
                favoriteBtn.classList.add('active');
                showToast('Added to favorites!', 'success');
            } else {
                favoriteBtn.classList.remove('active');
                showToast('Removed from favorites', 'info');
            }
        });
    }
    
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            const creatorId = currentContent?.creator_id;
            if (!creatorId) return;
            
            const isNowConnected = window.state.toggleConnection(creatorId);
            
            if (isNowConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                showToast('Connected with creator!', 'success');
            } else {
                connectBtn.classList.remove('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                showToast('Disconnected from creator', 'info');
            }
        });
    }
}

// Initialize enhanced video player
function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');
    
    if (!videoElement || !videoContainer) {
        console.warn('⚠️ Video elements not found');
        return;
    }
    
    try {
        // Get preferences from state
        const preferences = window.state ? window.state.getPreferences() : {
            autoplay: true,
            playbackSpeed: 1.0,
            quality: 'auto'
        };
        
        // Create enhanced video player
        enhancedVideoPlayer = new EnhancedVideoPlayer({
            autoplay: preferences.autoplay,
            defaultSpeed: preferences.playbackSpeed,
            defaultQuality: preferences.quality,
            defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
            muted: window.stateManager ? window.stateManager.getState('session.muted') : false
        });
        
        // Attach to video element
        enhancedVideoPlayer.attach(videoElement, videoContainer);
        
        // Set up event listeners
        enhancedVideoPlayer.on('timeupdate', (time) => {
            if (window.stateManager) {
                window.stateManager.setState('session.currentTime', time);
            }
            
            // Update watch history every 30 seconds
            if (Math.floor(time) % 30 === 0 && currentContent) {
                const duration = enhancedVideoPlayer.getStats()?.duration || currentContent.duration || 3600;
                if (window.state && window.state.updateWatchHistory) {
                    window.state.updateWatchHistory(currentContent.id, time, duration);
                }
            }
        });
        
        enhancedVideoPlayer.on('play', () => {
            if (window.stateManager) {
                window.stateManager.setState('session.playing', true);
            }
        });
        
        enhancedVideoPlayer.on('pause', () => {
            if (window.stateManager) {
                window.stateManager.setState('session.playing', false);
            }
        });
        
        enhancedVideoPlayer.on('volumechange', (volume) => {
            if (window.stateManager) {
                window.stateManager.setState('session.volume', volume);
            }
        });
        
        enhancedVideoPlayer.on('error', (error) => {
            console.error('Video player error:', error);
            showToast('Video playback error: ' + error.message, 'error');
        });
        
        console.log('✅ Enhanced video player initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
    }
}

// Setup keyboard support
function setupKeyboardSupport() {
    if (!window.keyboardNavigation) {
        console.warn('⚠️ Keyboard navigation not available');
        return;
    }
    
    // Register custom shortcuts for this page
    window.keyboardNavigation.registerCustomShortcut('r', () => {
        document.getElementById('refreshCommentsBtn')?.click();
    }, 'Refresh comments');
    
    window.keyboardNavigation.registerCustomShortcut('n', () => {
        const relatedCards = document.querySelectorAll('.content-card');
        if (relatedCards.length > 0) {
            relatedCards[0].focus();
        }
    }, 'Focus first related content');
    
    console.log('✅ Keyboard support setup complete');
}

// Setup state subscriptions
function setupStateSubscriptions() {
    if (!window.stateManager) {
        console.warn('⚠️ State manager not available for subscriptions');
        return;
    }
    
    // Watch for favorite changes
    window.stateManager.subscribe('favorites', (favorites) => {
        if (currentContent) {
            const isFavorited = favorites.has(currentContent.id);
            const favoriteBtn = document.getElementById('favoriteBtn');
            if (favoriteBtn) {
                favoriteBtn.querySelector('i').className = isFavorited ? 'fas fa-heart' : 'far fa-heart';
                favoriteBtn.querySelector('span').textContent = isFavorited ? 'Favorited' : 'Favorite';
            }
        }
    });
    
    // Watch for volume changes
    window.stateManager.subscribe('session.volume', (volume) => {
        if (enhancedVideoPlayer) {
            enhancedVideoPlayer.setVolume(volume);
        }
    });
    
    console.log('✅ State subscriptions setup complete');
}

// Fallback data function
function useFallbackData(contentId = '68') {
    console.log('📋 Using fallback data for ID:', contentId);
    
    const fallbackContent = {
        id: contentId,
        title: contentId === '68' ? 'African Music Festival Highlights' : `Content #${contentId}`,
        description: contentId === '68' ? 
            'Highlights from the biggest African music festival featuring top artists from across the continent. Experience the vibrant culture, amazing performances, and unforgettable moments.' :
            'This is a sample content description. In a real scenario, this would show the actual content details.',
        thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop',
        file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        media_type: 'video',
        genre: 'Music',
        created_at: '2025-01-15T10:30:00Z',
        creator: 'Music Africa',
        creator_display_name: 'Music Africa',
        duration: 3600,
        language: 'English',
        views_count: 12500,
        likes_count: 890,
        creator_id: 'creator123'
    };
    
    const fallbackRelated = [
        {
            id: '2',
            title: 'Tech Innovation in Africa',
            thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            views_count: 8900
        },
        {
            id: '3',
            title: 'Traditional Dance Performance',
            thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            views_count: 15600
        }
    ];
    
    currentContent = fallbackContent;
    
    // Update UI immediately
    updateContentUI(fallbackContent);
    renderRelatedContent(fallbackRelated);
    
    // Initialize video player even with fallback data
    initializeEnhancedVideoPlayer();
    
    // Show app immediately
    showApp();
    
    showToast('Loaded with sample data', 'info');
    isAppInitialized = true;
}

// UI Helper functions (keep existing ones, but update where needed)
function updateLoadingText(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
}

function showApp() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loading) loading.style.display = 'none';
    if (app) app.style.display = 'block';
    
    console.log('✅ App UI is now visible');
}

function updateContentUI(content) {
    if (!content) return;
    
    console.log('🎨 Updating UI with content:', content.title);
    
    // Update basic info
    safeSetText('contentTitle', content.title);
    safeSetText('creatorName', content.creator);
    safeSetText('creatorDisplayName', content.creator);
    safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
    safeSetText('likesCount', formatNumber(content.likes_count) + ' likes');
    safeSetText('durationText', formatDuration(content.duration));
    safeSetText('contentDurationFull', formatDuration(content.duration));
    safeSetText('uploadDate', formatDate(content.created_at));
    safeSetText('contentGenre', content.genre || 'Not specified');
    safeSetText('contentLanguage', content.language || 'English');
    
    // Update description
    safeSetText('contentDescriptionShort', truncateText(content.description, 150));
    safeSetText('contentDescriptionFull', content.description);
    
    // Update poster image
    const poster = document.getElementById('heroPoster');
    const posterPlaceholder = document.getElementById('posterPlaceholder');
    if (posterPlaceholder && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        posterPlaceholder.innerHTML = `
            <img src="${imgUrl}" alt="${content.title}" 
                 style="width:100%; height:100%; object-fit:cover;"
                 onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop'">
            <div class="play-overlay">
                <div class="play-icon-large">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }
    
    // Update player title
    const playerTitle = document.getElementById('playerTitle');
    if (playerTitle) {
        playerTitle.textContent = `Now Playing: ${content.title}`;
    }
}

function renderRelatedContent(items) {
    const container = document.getElementById('relatedGrid');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="related-placeholder card">
                <i class="fas fa-video-slash"></i>
                <p>No related content found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    items.forEach(item => {
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${item.id}`;
        card.onclick = function(e) {
            e.preventDefault();
            window.location.href = `content-detail.html?id=${item.id}`;
        };
        
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
        const title = item.title || 'Untitled';
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${imgUrl}" alt="${title}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${truncateText(title, 50)}</h3>
                <div class="related-meta">
                    <i class="fas fa-eye"></i>
                    <span>${formatNumber(item.views_count || 0)} views</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Event handlers
function handlePlay() {
    if (!currentContent) {
        showToast('No content to play', 'error');
        return;
    }
    
    const player = document.getElementById('inlinePlayer');
    
    if (!player) {
        showToast('Video player not available', 'error');
        return;
    }
    
    // Get video URL
    let videoUrl = currentContent.file_url;
    if (window.SupabaseHelper?.fixMediaUrl) {
        videoUrl = window.SupabaseHelper.fixMediaUrl(videoUrl);
    }
    
    console.log('🎥 Playing video:', videoUrl);
    
    // Update player
    const title = document.getElementById('playerTitle');
    if (title) {
        title.textContent = `Now Playing: ${currentContent.title}`;
    }
    
    // Use enhanced video player if available
    if (enhancedVideoPlayer) {
        const videoElement = document.getElementById('inlineVideoPlayer');
        if (videoElement) {
            videoElement.src = videoUrl;
            enhancedVideoPlayer.play();
        }
    } else {
        // Fallback to regular video element
        const video = document.getElementById('inlineVideoPlayer');
        if (video) {
            video.src = videoUrl;
            video.play().catch(err => {
                console.log('Autoplay prevented:', err);
                showToast('Click the play button in the video player', 'info');
            });
        }
    }
    
    player.style.display = 'block';
    
    // Scroll to player
    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

async function handleSendComment() {
    if (!currentContent) {
        showToast('No content to comment on', 'error');
        return;
    }
    
    const input = document.getElementById('commentInput');
    const text = input?.value.trim();
    
    if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    // Check if user is logged in
    if (!currentUserId) {
        showToast('Please sign in to comment', 'warning');
        return;
    }
    
    // Add comment
    const success = await window.SupabaseHelper.addComment(
        currentContent.id,
        text,
        currentUserId,
        'User'
    );
    
    if (success) {
        input.value = '';
        showToast('Comment added successfully!', 'success');
        
        // Refresh comments
        const comments = await window.SupabaseHelper.getComments(currentContent.id);
        renderComments(comments);
    } else {
        showToast('Failed to add comment', 'error');
    }
}

// Utility functions (keep existing ones)
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text || '';
        if (el.textContent === '') {
            el.textContent = '-';
        }
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return '-';
    }
}

function formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
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

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        error: 'fas fa-exclamation-triangle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type] || 'fas fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Setup event listeners (keep existing setupEventListeners function)
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Play button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.onclick = handlePlay;
    }
    
    // Poster click
    const poster = document.getElementById('heroPoster');
    if (poster) {
        poster.onclick = handlePlay;
    }
    
    // Send comment
    const sendBtn = document.getElementById('sendCommentBtn');
    if (sendBtn) {
        sendBtn.onclick = handleSendComment;
    }
    
    // Comment input enter key
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
        commentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
            }
        });
    }
    
    // Close player
    const closePlayer = document.getElementById('closePlayerBtn');
    if (closePlayer) {
        closePlayer.onclick = function() {
            const player = document.getElementById('inlinePlayer');
            const video = document.getElementById('inlineVideoPlayer');
            if (player) player.style.display = 'none';
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
            if (enhancedVideoPlayer) {
                enhancedVideoPlayer.pause();
            }
        };
    }
    
    // Share button
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.onclick = function() {
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({
                    title: currentContent?.title || 'Check this out',
                    text: `Check out "${currentContent?.title}" on Bantu Stream Connect`,
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url)
                    .then(() => showToast('Link copied to clipboard!', 'success'))
                    .catch(() => showToast('Failed to copy link', 'error'));
            }
        };
    }
    
    // Refresh comments button
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn) {
        refreshBtn.onclick = async function() {
            if (!currentContent) return;
            updateLoadingText('Refreshing comments...');
            const comments = await window.SupabaseHelper.getComments(currentContent.id);
            renderComments(comments);
            showToast('Comments refreshed!', 'success');
        };
    }
    
    // Back to top button
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.onclick = function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopBtn.style.display = 'flex';
            } else {
                backToTopBtn.style.display = 'none';
            }
        });
    }
    
    console.log('✅ Event listeners setup complete');
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

console.log('✅ Content detail module loaded with Week 2 integration');
