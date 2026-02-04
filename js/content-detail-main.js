// content-detail-main.js - COMPLETE AUTHENTICATION & VIDEO PLAYER FIXES

console.log('🎬 Content Detail Main Screen Initializing...');

// Global variables
let currentContent = null;
let currentUserId = null;
let isAppInitialized = false;
let enhancedVideoPlayer = null;
let userProfile = null;

// Wait for DOM and dependencies
window.onload = function() {
    console.log('Window loaded, starting initialization with auth...');
    initializeWithState();
};

// ============ AUTHENTICATION FUNCTIONS ============

// Update UI based on authentication status
async function updateAuthUI() {
    try {
        console.log('🔄 Updating auth UI...');
        
        // Wait for AuthHelper to be ready
        if (!window.AuthHelper || !window.AuthHelper.isInitialized) {
            console.log('⚠️ AuthHelper not ready yet, waiting...');
            setTimeout(updateAuthUI, 500);
            return;
        }
        
        const isAuthenticated = window.AuthHelper.isAuthenticated();
        userProfile = window.AuthHelper.getUserProfile();
        currentUserId = userProfile?.id || null;
        
        console.log('User authenticated:', isAuthenticated);
        console.log('User profile:', userProfile);
        
        if (isAuthenticated && userProfile) {
            // Update profile button in header
            updateProfileButton(userProfile);
            
            // Update comment avatar
            updateCommentAvatar(userProfile);
            
            // Update comment input placeholder
            updateCommentInput(userProfile);
            
            // Update send comment handler
            updateCommentHandler(userProfile);
        } else {
            // User is not authenticated
            updateCommentInput(null);
            setupGuestUI();
        }
        
        console.log('✅ Auth UI updated');
    } catch (error) {
        console.error('❌ Error updating auth UI:', error);
    }
}

// Update profile button in header
function updateProfileButton(userProfile) {
    const profileBtn = document.getElementById('profile-btn');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    
    if (!profileBtn) return;
    
    if (!profilePlaceholder) {
        // Create placeholder if it doesn't exist
        const placeholder = document.createElement('div');
        placeholder.className = 'profile-placeholder';
        placeholder.id = 'userProfilePlaceholder';
        profileBtn.appendChild(placeholder);
    } else {
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        const displayName = window.AuthHelper.getDisplayName();
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl) {
            profilePlaceholder.innerHTML = `
                <img src="${avatarUrl}" 
                     alt="${userProfile.full_name || 'User'}"
                     style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.3);">
            `;
        } else {
            profilePlaceholder.innerHTML = `
                <div style="
                    width: 32px; 
                    height: 32px; 
                    border-radius: 50%; 
                    background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                ">
                    ${initial}
                </div>
            `;
        }
        
        // Update profile button click handler
        profileBtn.onclick = function() {
            window.location.href = 'profile.html';
        };
    }
}

// Update comment avatar
function updateCommentAvatar(userProfile) {
    const commentAvatar = document.getElementById('userCommentAvatar');
    
    if (!commentAvatar) return;
    
    const avatarUrl = window.AuthHelper.getAvatarUrl();
    const displayName = window.AuthHelper.getDisplayName();
    const initial = displayName.charAt(0).toUpperCase();
    
    if (avatarUrl) {
        commentAvatar.innerHTML = `
            <img src="${avatarUrl}" 
                 alt="${displayName}"
                 style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.3);">
        `;
    } else {
        commentAvatar.innerHTML = `
            <div style="
                width: 48px; 
                height: 48px; 
                border-radius: 50%; 
                background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                border: 2px solid rgba(29, 78, 216, 0.3);
            ">
                ${initial}
            </div>
        `;
    }
}

// Update comment input placeholder
function updateCommentInput(userProfile) {
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
        if (userProfile) {
            const displayName = window.AuthHelper.getDisplayName();
            commentInput.placeholder = `Add a comment as ${displayName}...`;
            commentInput.disabled = false;
        } else {
            commentInput.placeholder = 'Sign in to add a comment...';
            commentInput.disabled = true;
        }
    }
}

// Update comment handler to use actual user info
function updateCommentHandler(userProfile) {
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');
    
    if (!sendBtn || !commentInput) return;
    
    // Remove existing event listeners by cloning and replacing
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    const newCommentInput = commentInput.cloneNode(true);
    commentInput.parentNode.replaceChild(newCommentInput, commentInput);
    
    // Add new event listener
    newSendBtn.onclick = async function() {
        await handleSendCommentWithAuth();
    };
    
    newCommentInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            newSendBtn.click();
        }
    });
}

// Handle comment submission with authentication
async function handleSendCommentWithAuth() {
    if (!currentContent) {
        showToast('No content to comment on', 'error');
        return;
    }
    
    const input = document.getElementById('commentInput');
    const text = input?.value.trim();
    const sendBtn = document.getElementById('sendCommentBtn');
    
    if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    // Check authentication
    if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
        const shouldLogin = confirm('You need to sign in to comment. Would you like to sign in now?');
        if (shouldLogin) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        }
        return;
    }
    
    const userProfile = window.AuthHelper.getUserProfile();
    const displayName = window.AuthHelper.getDisplayName();
    const username = window.AuthHelper.getUsername();
    
    // Show loading state
    const originalHTML = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    sendBtn.disabled = true;
    
    try {
        // Check if we have the virtual scroll system
        if (window.commentsVirtualScroll && window.commentsVirtualScroll.addComment) {
            const newComment = await window.commentsVirtualScroll.addComment(
                text,
                userProfile.id,
                displayName,
                window.AuthHelper.getAvatarUrl()
            );
            
            if (newComment) {
                input.value = '';
                showToast('Comment added successfully!', 'success');
            } else {
                throw new Error('Failed to add comment via virtual scroll');
            }
        } else {
            // Use SupabaseHelper directly
            const success = await window.SupabaseHelper.addComment(
                currentContent.id,
                text,
                userProfile.id,
                displayName
            );
            
            if (success) {
                input.value = '';
                showToast('Comment added successfully!', 'success');
                
                // Refresh comments
                if (window.commentsVirtualScroll && window.commentsVirtualScroll.loadComments) {
                    await window.commentsVirtualScroll.loadComments(currentContent.id, true);
                } else {
                    const comments = await window.SupabaseHelper.getComments(currentContent.id);
                    renderComments(comments);
                }
            } else {
                throw new Error('Failed to add comment');
            }
        }
    } catch (error) {
        console.error('❌ Error adding comment:', error);
        showToast('Failed to add comment. Please try again.', 'error');
    } finally {
        // Reset button state
        sendBtn.innerHTML = originalHTML;
        sendBtn.disabled = false;
        input.focus();
    }
}

// Setup UI for guest users
function setupGuestUI() {
    console.log('👤 Setting up guest UI');
    
    const profileBtn = document.getElementById('profile-btn');
    const commentInput = document.getElementById('commentInput');
    const sendBtn = document.getElementById('sendCommentBtn');
    
    if (profileBtn) {
        profileBtn.onclick = function() {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        };
    }
    
    if (commentInput) {
        commentInput.placeholder = 'Sign in to add a comment...';
        commentInput.disabled = true;
    }
    
    if (sendBtn) {
        sendBtn.onclick = function() {
            const shouldLogin = confirm('You need to sign in to comment. Would you like to sign in now?');
            if (shouldLogin) {
                window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
            }
        };
    }
}

// Listen for auth state changes
function setupAuthListeners() {
    // Listen for our custom authReady event
    document.addEventListener('authReady', function(event) {
        console.log('Auth ready event received:', event.detail);
        updateAuthUI();
    });
    
    // Also listen for DOMContentLoaded in case auth loads before our listener
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(updateAuthUI, 1000); // Check after 1 second
    });
}

// ============ MAIN INITIALIZATION ============

// Main initialization with state management
async function initializeWithState() {
    if (isAppInitialized) return;
    
    console.log('🚀 Starting app initialization with authentication...');
    
    try {
        // Setup auth listeners first
        setupAuthListeners();
        
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
        
        // Update auth UI now that everything is loaded
        setTimeout(updateAuthUI, 500);
        
        isAppInitialized = true;
        console.log('✅ App initialized successfully with authentication');
        
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
        
        // Initialize comments with virtual scroll
        await initializeCommentsWithVirtualScroll(contentId);
        
        return currentContent;
        
    } catch (error) {
        console.error('❌ Error fetching content:', error);
        throw error;
    }
}

// Initialize comments with virtual scroll
async function initializeCommentsWithVirtualScroll(contentId) {
    try {
        // Initialize virtual scroll for comments
        if (window.initCommentsVirtualScroll) {
            window.commentsVirtualScroll = window.initCommentsVirtualScroll(contentId);
        }
        
        if (!window.commentsVirtualScroll) {
            console.warn('⚠️ Virtual scroll not initialized, falling back to regular comments');
            // Fallback to regular comments
            const comments = await window.SupabaseHelper.getComments(contentId);
            renderComments(comments);
            return;
        }
        
        // Update send comment handler
        const sendBtn = document.getElementById('sendCommentBtn');
        const commentInput = document.getElementById('commentInput');
        
        if (sendBtn && commentInput) {
            // Remove existing handlers
            const newSendBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
            
            const newCommentInput = commentInput.cloneNode(true);
            commentInput.parentNode.replaceChild(newCommentInput, commentInput);
            
            // Add new handler
            newSendBtn.onclick = async () => {
                const text = newCommentInput.value.trim();
                
                if (!text) {
                    showToast('Please enter a comment', 'warning');
                    return;
                }
                
                if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
                    const shouldLogin = confirm('You need to sign in to comment. Would you like to sign in now?');
                    if (shouldLogin) {
                        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
                    }
                    return;
                }
                
                const userProfile = window.AuthHelper.getUserProfile();
                const displayName = window.AuthHelper.getDisplayName();
                
                // Add comment via virtual scroll
                const newComment = await window.commentsVirtualScroll.addComment(
                    text,
                    userProfile.id,
                    displayName,
                    window.AuthHelper.getAvatarUrl()
                );
                
                if (newComment) {
                    newCommentInput.value = '';
                    showToast('Comment added successfully!', 'success');
                } else {
                    showToast('Failed to add comment', 'error');
                }
            };
            
            // Update enter key handler
            newCommentInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    newSendBtn.click();
                }
            });
        }
        
        // Update refresh button
        const refreshBtn = document.getElementById('refreshCommentsBtn');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                showToast('Refreshing comments...', 'info');
                if (window.commentsVirtualScroll && window.commentsVirtualScroll.loadComments) {
                    await window.commentsVirtualScroll.loadComments(contentId, true);
                    showToast('Comments refreshed!', 'success');
                } else {
                    // Fallback to regular refresh
                    const comments = await window.SupabaseHelper.getComments(contentId);
                    renderComments(comments);
                    showToast('Comments refreshed!', 'success');
                }
            };
        }
        
        console.log('✅ Comments virtual scroll initialized');
        
    } catch (error) {
        console.error('❌ Error initializing virtual scroll:', error);
        // Fallback to regular comments
        if (window.SupabaseHelper) {
            const comments = await window.SupabaseHelper.getComments(contentId);
            renderComments(comments);
        }
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
        connectBtn.addEventListener('click', async () => {
            const creatorId = currentContent?.creator_id;
            if (!creatorId) return;
            
            // Check if user is authenticated
            if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
                const shouldLogin = confirm('You need to sign in to connect with creators. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
                }
                return;
            }
            
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

// Initialize enhanced video player - FIXED VERSION
function initializeEnhancedVideoPlayer() {
    // Wait for DOM elements to be available
    if (!document.getElementById('inlineVideoPlayer')) {
        console.warn('Video elements not ready yet, retrying...');
        setTimeout(initializeEnhancedVideoPlayer, 300);
        return;
    }
    
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
        
        // Add play button handler AFTER player is attached
        const playBtn = document.getElementById('playBtn');
        const heroPoster = document.getElementById('heroPoster');
        
        if (playBtn) {
            playBtn.addEventListener('click', handlePlay);
        }
        
        if (heroPoster) {
            heroPoster.addEventListener('click', handlePlay);
        }
        
        console.log('✅ Enhanced video player initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
        // Fallback to basic video player
        setupBasicVideoPlayer();
    }
}

// Setup basic video player fallback
function setupBasicVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    console.log('⚠️ Using basic video player fallback');
    
    // Add play button handler
    const playBtn = document.getElementById('playBtn');
    const heroPoster = document.getElementById('heroPoster');
    
    if (playBtn) {
        playBtn.addEventListener('click', handlePlay);
    }
    
    if (heroPoster) {
        heroPoster.addEventListener('click', handlePlay);
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
    
    // Update auth UI for fallback mode
    setTimeout(updateAuthUI, 500);
    
    showToast('Loaded with sample data', 'info');
    isAppInitialized = true;
}

// ============ UI HELPER FUNCTIONS ============

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
    
    // FIXED: Use proper duration handling
    const duration = content.duration || content.duration_seconds || 3600;
    safeSetText('durationText', formatDuration(duration));
    safeSetText('contentDurationFull', formatDuration(duration));
    
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
                 style="width:100%; height:100%; object-fit:cover; border-radius: 12px;"
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

// ============ EVENT HANDLERS ============

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

// Legacy comment handler (kept for fallback)
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

// ============ UTILITY FUNCTIONS ============

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

// FIXED: Proper duration formatting function
function formatDuration(seconds) {
    // Handle null/undefined/invalid values
    if (!seconds || seconds <= 0) {
        console.warn('Invalid duration value:', seconds);
        return '0m 0s'; // Default fallback instead of dash
    }
    
    // Convert to integer seconds if it's a float
    seconds = Math.floor(seconds);
    
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

// Render comments function (for fallback when virtual scroll is not available)
function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        if (noComments) noComments.style.display = 'flex';
        if (countEl) countEl.textContent = '(0)';
        return;
    }
    
    // Hide "no comments" message
    if (noComments) noComments.style.display = 'none';
    
    // Update count
    if (countEl) countEl.textContent = `(${comments.length})`;
    
    // Add comments
    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        container.appendChild(commentEl);
    });
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    // Try to get user info from AuthHelper first
    let authorName = 'User';
    let avatarUrl = null;
    
    // If comment has author info, use it
    if (comment.author_name) {
        authorName = comment.author_name;
    } else if (comment.user_profiles?.full_name || comment.user_profiles?.username) {
        authorName = comment.user_profiles.full_name || comment.user_profiles.username;
    }
    
    // Get avatar URL
    if (comment.user_profiles?.avatar_url) {
        avatarUrl = comment.user_profiles.avatar_url;
        // Fix URL if needed
        if (avatarUrl && !avatarUrl.startsWith('http')) {
            avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/profile-pictures/${avatarUrl}`;
        }
    }
    
    const time = formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || comment.text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl ? 
                    `<img src="${avatarUrl}" alt="${authorName}" 
                         style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);">` :
                    `<div style="
                        width: 32px; 
                        height: 32px; 
                        border-radius: 50%; 
                        background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        border: 2px solid rgba(29, 78, 216, 0.2);
                    ">
                        ${initial}
                    </div>`
                }
            </div>
            <div class="comment-user">
                <strong>${escapeHtml(authorName)}</strong>
                <div class="comment-time">${time}</div>
            </div>
        </div>
        <div class="comment-content">
            ${escapeHtml(commentText)}
        </div>
    `;
    
    return div;
}

function formatCommentTime(timestamp) {
    if (!timestamp) return 'Just now';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Recently';
    }
}

// ============ SETUP EVENT LISTENERS ============

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            window.location.href = 'search.html?q=' + (currentContent?.title || '');
        });
    }
    
    // Analytics button
    const analyticsBtn = document.getElementById('analytics-btn');
    if (analyticsBtn) {
        analyticsBtn.addEventListener('click', () => {
            if (window.track) {
                window.track.buttonClick('analytics_btn', 'content_detail');
            }
            window.location.href = 'analytics.html?content=' + (currentContent?.id || '');
        });
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            if (window.NotificationSystem) {
                window.NotificationSystem.togglePanel();
            } else {
                showToast('Notifications coming soon!', 'info');
            }
        });
    }
    
    // Note: Comment event listeners are now set up in initializeCommentsWithVirtualScroll
    
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
        shareBtn.addEventListener('click', function() {
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
        });
    }
    
    // Note: Refresh comments button is now set up in initializeCommentsWithVirtualScroll
    
    // Theme toggle in navigation
    const navThemeToggle = document.getElementById('nav-theme-toggle');
    if (navThemeToggle) {
        navThemeToggle.addEventListener('click', () => {
            const current = document.body.className.includes('theme-dark') ? 'light' : 'dark';
            document.body.className = `theme-${current}`;
            localStorage.setItem('theme', current);
        });
    }
    
    // Back to top button
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
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

console.log('✅ Content detail module loaded with complete authentication integration');
