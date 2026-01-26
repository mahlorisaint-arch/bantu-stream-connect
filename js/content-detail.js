console.log('🎬 Content Detail Screen Initializing...');

// Global variables
let currentContent = null;
let currentUserId = null;
let isContentLiked = false;
let isContentFavorited = false;
let isCreatorConnected = false;
let creatorConnectorsCount = 0;

// Wait for DOM and dependencies
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    try {
        // Check if required dependencies are loaded
        if (typeof security === 'undefined') {
            console.warn('Security module not found, using fallback');
            createSecurityFallback();
        }
        
        if (typeof errorHandler === 'undefined') {
            console.warn('Error handler not found, using console logging');
            createErrorHandlerFallback();
        }
        
        if (typeof track === 'undefined') {
            console.warn('Analytics not found, using mock');
            createAnalyticsFallback();
        }
        
        // Check if Supabase service is available
        if (typeof supabaseService === 'undefined') {
            console.error('Supabase service not available. Please check supabase-client.js');
            showToast('Database connection failed. Using sample data.', 'warning');
            
            // Use sample data as fallback
            setTimeout(() => {
                initializeWithSampleData();
            }, 1000);
            return;
        }
        
        // Now initialize the app with real data
        console.log('All dependencies ready, initializing app with real data...');
        initializeApp();
        
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        showErrorScreen(error);
    }
});

// Fallback functions
function createSecurityFallback() {
    window.security = {
        safeText: function(input) {
            if (typeof input !== 'string') return '';
            return input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        },
        safeURL: function(url) {
            if (!url) return 'about:blank';
            try {
                new URL(url);
                return url;
            } catch {
                return 'about:blank';
            }
        },
        createElement: function(tag, attrs, content) {
            const el = document.createElement(tag);
            if (attrs) {
                Object.keys(attrs).forEach(key => {
                    if (key === 'href' || key === 'src') {
                        el.setAttribute(key, this.safeURL(attrs[key]));
                    } else {
                        el.setAttribute(key, this.safeText(attrs[key]));
                    }
                });
            }
            if (content) el.textContent = content;
            return el;
        },
        createImage: function(src, alt) {
            const img = document.createElement('img');
            img.src = this.safeURL(src);
            img.alt = this.safeText(alt || '');
            img.onerror = function() {
                this.src = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
            };
            return img;
        }
    };
}

function createErrorHandlerFallback() {
    window.errorHandler = {
        safeExecute: function(fn, context, fallback) {
            try {
                return fn();
            } catch (err) {
                console.error('Error in', context, ':', err);
                return fallback;
            }
        }
    };
    window.safe = {
        execute: function(fn, context, fallback) {
            try {
                return fn();
            } catch (err) {
                console.error('Error in', context, ':', err);
                if (fallback !== undefined) return fallback;
            }
        },
        setText: function(el, text) {
            if (el && text !== undefined) {
                el.textContent = text;
            }
        }
    };
}

function createAnalyticsFallback() {
    window.track = {
        contentView: function() { console.log('Track: content view'); },
        contentPlay: function() { console.log('Track: content play'); },
        buttonClick: function() { console.log('Track: button click'); },
        contentLike: function() { console.log('Track: content like'); },
        commentAdd: function() { console.log('Track: comment add'); },
        creatorConnect: function() { console.log('Track: creator connect'); },
        contentShare: function() { console.log('Track: content share'); }
    };
}

// Main initialization
async function initializeApp() {
    console.log('Initializing app with real data...');
    
    try {
        // Get content ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const contentId = urlParams.get('id') || '68'; // Default to 68 if no ID
        
        console.log(`Fetching content with ID: ${contentId}`);
        
        // Get current user ID
        currentUserId = await supabaseService.getCurrentUserId();
        console.log('Current user ID:', currentUserId);
        
        // Show loading state
        updateLoadingText('Fetching content...');
        
        // Fetch content data
        currentContent = await fetchContentData(contentId);
        
        if (!currentContent) {
            throw new Error('Failed to fetch content. Content may not exist.');
        }
        
        // Record view
        await supabaseService.recordView(contentId, currentUserId);
        
        // Track page view
        if (window.track) {
            track.contentView(currentContent.id, currentContent.media_type);
        }
        
        // Update loading text
        updateLoadingText('Loading related content...');
        
        // Fetch related content
        const relatedContent = await fetchRelatedContent(currentContent);
        
        // Update loading text
        updateLoadingText('Loading comments...');
        
        // Fetch comments
        const comments = await fetchComments(contentId);
        
        // Update loading text
        updateLoadingText('Checking your interactions...');
        
        // Check user interactions
        await checkUserInteractions(contentId, currentContent.creator_id || currentContent.user_id);
        
        // Update UI with real data
        updateContentUI(currentContent);
        renderComments(comments);
        renderRelatedContent(relatedContent);
        
        // Setup event listeners
        setupEventListeners();
        
        // Hide loading screen and show app
        showApp();
        
        console.log('✅ App initialized successfully with real data');
        showToast('Content loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error in initializeApp:', error);
        showToast('Failed to load content. Using sample data.', 'error');
        
        // Fallback to sample data
        setTimeout(() => {
            initializeWithSampleData();
        }, 1000);
    }
}

// Sample data fallback
function initializeWithSampleData() {
    const sampleContentData = {
        id: '68',
        title: 'African Music Festival Highlights',
        description: 'Highlights from the biggest African music festival featuring top artists from across the continent. Experience the vibrant culture, amazing performances, and unforgettable moments. This festival brings together the best of African music in a celebration of culture and talent.',
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
    
    const sampleRelatedContent = [
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
    
    currentContent = sampleContentData;
    
    // Update UI
    updateContentUI(sampleContentData);
    renderRelatedContent(sampleRelatedContent);
    
    // Setup event listeners
    setupEventListeners();
    
    // Show app
    showApp();
    
    showToast('Loaded with sample data', 'warning');
}

// Data fetching functions
async function fetchContentData(contentId) {
    console.log(`Fetching content ${contentId} from Supabase...`);
    
    const content = await supabaseService.getContentById(contentId);
    
    if (!content) {
        console.error('No content found for ID:', contentId);
        return null;
    }
    
    console.log('Content fetched:', content);
    return content;
}

async function fetchRelatedContent(currentContent) {
    const relatedContent = await supabaseService.getRelatedContent(
        currentContent.id,
        currentContent.genre,
        currentContent.creator_id || currentContent.user_id,
        6
    );
    
    console.log('Related content fetched:', relatedContent?.length || 0, 'items');
    return relatedContent;
}

async function fetchComments(contentId) {
    const comments = await supabaseService.getComments(contentId);
    
    console.log('Comments fetched:', comments?.length || 0, 'comments');
    return comments;
}

async function checkUserInteractions(contentId, creatorId) {
    if (!currentUserId) {
        console.log('No user logged in, skipping interaction checks');
        return;
    }
    
    // Check if liked
    isContentLiked = await supabaseService.checkIfLiked(contentId, currentUserId);
    console.log('User liked content:', isContentLiked);
    
    // Check if favorited
    isContentFavorited = await supabaseService.checkIfFavorited(contentId, currentUserId);
    console.log('User favorited content:', isContentFavorited);
    
    // Check if connected to creator
    if (creatorId) {
        isCreatorConnected = await supabaseService.checkIfConnected(creatorId, currentUserId);
        console.log('User connected to creator:', isCreatorConnected);
        
        // Get creator connectors count
        creatorConnectorsCount = await supabaseService.getCreatorConnectorsCount(creatorId);
        console.log('Creator connectors count:', creatorConnectorsCount);
    }
}

// UI update functions
function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function showApp() {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    if (app) {
        app.style.display = 'block';
    }
}

function showErrorScreen(error) {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="spinner" style="border-top-color: #EF4444;"></div>
                <div id="loading-text" style="color: #EF4444; margin-top: 20px;">
                    Error: ${error.message || 'Failed to load content'}
                </div>
                <button onclick="location.reload()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #1D4ED8; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Retry
                </button>
                <button onclick="initializeWithSampleData()" 
                        style="margin-top: 10px; padding: 10px 20px; background: #F59E0B; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Use Sample Data
                </button>
            </div>
        `;
    }
    
    if (app) {
        app.style.display = 'none';
    }
}

// Update UI with content data
function updateContentUI(contentData) {
    if (!contentData) return;
    
    console.log('Updating UI with content data...');
    
    try {
        // Get creator name (prefer creator profile, then user profile, then fallback)
        let creatorName = 'Unknown Creator';
        let creatorDisplayName = 'Unknown Creator';
        
        if (contentData.creators && contentData.creators.username) {
            creatorName = contentData.creators.username;
            creatorDisplayName = contentData.creators.username;
        } else if (contentData.user_profiles && contentData.user_profiles.full_name) {
            creatorName = contentData.user_profiles.full_name;
            creatorDisplayName = contentData.user_profiles.full_name;
        } else if (contentData.creator) {
            creatorName = contentData.creator;
            creatorDisplayName = contentData.creator;
        }
        
        // Update hero section
        safe.setText(document.getElementById('contentTitle'), contentData.title || 'Untitled');
        safe.setText(document.getElementById('creatorName'), creatorName);
        safe.setText(document.getElementById('creatorDisplayName'), creatorDisplayName);
        safe.setText(document.getElementById('viewsCount'), `${contentData.views_count || 0} views`);
        safe.setText(document.getElementById('likesCount'), `${contentData.likes_count || 0} likes`);
        
        const durationFormatted = formatDuration(contentData.duration);
        safe.setText(document.getElementById('durationText'), durationFormatted);
        safe.setText(document.getElementById('contentDurationFull'), durationFormatted);
        
        // Set poster image
        const posterPlaceholder = document.getElementById('posterPlaceholder');
        if (posterPlaceholder) {
            posterPlaceholder.innerHTML = '';
            const img = security.createImage(
                contentData.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop',
                contentData.title || 'Content'
            );
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            posterPlaceholder.appendChild(img);
            
            const playOverlay = security.createElement('div', {
                className: 'play-overlay'
            });
            
            const playIcon = security.createElement('div', {
                className: 'play-icon-large'
            });
            
            const playIconInner = security.createElement('i', {
                className: 'fas fa-play'
            });
            
            playIcon.appendChild(playIconInner);
            playOverlay.appendChild(playIcon);
            posterPlaceholder.appendChild(playOverlay);
        }
        
        // Update stats
        safe.setText(document.getElementById('uploadDate'), formatDate(contentData.created_at));
        safe.setText(document.getElementById('contentGenre'), contentData.genre || 'Not specified');
        safe.setText(document.getElementById('contentLanguage'), contentData.language || 'English');
        
        // Update creator connectors count
        const creatorConnectorsEl = document.getElementById('creatorConnectors');
        if (creatorConnectorsEl) {
            safe.setText(creatorConnectorsEl, `${creatorConnectorsCount} connectors`);
        }
        
        // Update description
        const description = contentData.description || 'No description available.';
        const shortDescription = description.length > 150 ? description.substring(0, 150) + '...' : description;
        safe.setText(document.getElementById('contentDescriptionShort'), shortDescription);
        safe.setText(document.getElementById('contentDescriptionFull'), description);
        
        // Show more/less button for long descriptions
        const showMoreBtn = document.getElementById('showMoreBtn');
        if (description.length > 300 && showMoreBtn) {
            showMoreBtn.style.display = 'block';
            safe.setText(document.getElementById('contentDescriptionFull'), description.substring(0, 300) + '...');
            safe.setText(showMoreBtn, 'Show more');
            
            showMoreBtn.addEventListener('click', function() {
                const currentText = document.getElementById('contentDescriptionFull').textContent;
                if (currentText.includes('...')) {
                    safe.setText(document.getElementById('contentDescriptionFull'), description);
                    safe.setText(showMoreBtn, 'Show less');
                } else {
                    safe.setText(document.getElementById('contentDescriptionFull'), description.substring(0, 300) + '...');
                    safe.setText(showMoreBtn, 'Show more');
                }
            });
        }
        
        // Update favorite button state
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            if (isContentFavorited) {
                favoriteBtn.querySelector('i').className = 'fas fa-heart';
                favoriteBtn.querySelector('span').textContent = 'Favorited';
                favoriteBtn.classList.add('active');
            } else {
                favoriteBtn.querySelector('i').className = 'far fa-heart';
                favoriteBtn.querySelector('span').textContent = 'Favorite';
                favoriteBtn.classList.remove('active');
            }
        }
        
        // Update like button state (if separate like button exists)
        const likeBtn = document.querySelector('.like-btn');
        if (likeBtn) {
            if (isContentLiked) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('i').className = 'fas fa-heart';
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('i').className = 'far fa-heart';
            }
        }
        
        // Update connect button state
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            if (isCreatorConnected) {
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                connectBtn.classList.add('connected');
            } else {
                connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                connectBtn.classList.remove('connected');
            }
        }
        
        console.log('UI updated successfully');
    } catch (error) {
        console.error('Error updating UI:', error);
        throw error;
    }
}

// Helper functions
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
    try {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    } catch {
        return '-';
    }
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        error: 'fas fa-exclamation-triangle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${iconMap[type] || 'fas fa-info-circle'}"></i>
        <span>${security.safeText(message)}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    try {
        // Play button
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', handlePlayPressed);
        }
        
        // Hero poster click
        const heroPoster = document.getElementById('heroPoster');
        if (heroPoster) {
            heroPoster.addEventListener('click', handlePlayPressed);
        }
        
        // Favorite button
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', async function() {
                if (!currentUserId) {
                    showToast('Please sign in to add favorites', 'warning');
                    return;
                }
                
                const newState = !isContentFavorited;
                
                const success = await supabaseService.toggleFavorite(
                    currentContent.id,
                    currentUserId,
                    newState ? 'favorite' : 'unfavorite'
                );
                
                if (success) {
                    isContentFavorited = newState;
                    
                    if (isContentFavorited) {
                        this.querySelector('i').className = 'fas fa-heart';
                        this.querySelector('span').textContent = 'Favorited';
                        this.classList.add('active');
                        showToast('Added to favorites', 'success');
                        
                        if (window.track) {
                            track.contentLike(currentContent.id, 'like');
                        }
                    } else {
                        this.querySelector('i').className = 'far fa-heart';
                        this.querySelector('span').textContent = 'Favorite';
                        this.classList.remove('active');
                        showToast('Removed from favorites', 'info');
                        
                        if (window.track) {
                            track.contentLike(currentContent.id, 'unlike');
                        }
                    }
                } else {
                    showToast('Failed to update favorites', 'error');
                }
            });
        }
        
        // Send comment button
        const sendCommentBtn = document.getElementById('sendCommentBtn');
        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', async function() {
                if (!currentUserId) {
                    showToast('Please sign in to comment', 'warning');
                    return;
                }
                
                const commentInput = document.getElementById('commentInput');
                const commentText = commentInput.value.trim();
                
                if (!commentText) {
                    showToast('Please enter a comment', 'warning');
                    return;
                }
                
                // Get user name for comment
                let authorName = 'User';
                if (currentContent.user_profiles && currentContent.user_profiles.full_name) {
                    authorName = currentContent.user_profiles.full_name;
                } else if (currentContent.creators && currentContent.creators.username) {
                    authorName = currentContent.creators.username;
                }
                
                const success = await addComment(commentText, authorName);
                
                if (success) {
                    commentInput.value = '';
                    showToast('Comment added successfully!', 'success');
                }
            });
        }
        
        // Comment input enter key
        const commentInput = document.getElementById('commentInput');
        if (commentInput) {
            commentInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendCommentBtn.click();
                }
            });
        }
        
        // Close inline player
        const closePlayerBtn = document.getElementById('closePlayerBtn');
        if (closePlayerBtn) {
            closePlayerBtn.addEventListener('click', function() {
                const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
                if (inlineVideoPlayer) {
                    inlineVideoPlayer.pause();
                }
                const inlinePlayerContainer = document.getElementById('inlinePlayer');
                if (inlinePlayerContainer) {
                    inlinePlayerContainer.style.display = 'none';
                }
                showToast('Player closed', 'info');
            });
        }
        
        // Share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', function() {
                const shareData = {
                    title: currentContent.title || 'Check out this content',
                    text: `Check out "${currentContent.title}" on Bantu Stream Connect`,
                    url: window.location.href
                };
                
                if (navigator.share) {
                    navigator.share(shareData)
                        .then(() => {
                            showToast('Shared successfully!', 'success');
                            if (window.track) {
                                track.contentShare(currentContent.id, 'native_share');
                            }
                        })
                        .catch(() => {
                            copyToClipboard();
                        });
                } else {
                    copyToClipboard();
                }
            });
        }
        
        // Connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async function() {
                if (!currentUserId) {
                    showToast('Please sign in to connect with creators', 'warning');
                    return;
                }
                
                const creatorId = currentContent.creator_id || currentContent.user_id;
                if (!creatorId) {
                    showToast('Creator information not available', 'error');
                    return;
                }
                
                const newState = !isCreatorConnected;
                
                const success = await supabaseService.toggleConnection(
                    creatorId,
                    currentUserId,
                    newState ? 'connect' : 'disconnect'
                );
                
                if (success) {
                    isCreatorConnected = newState;
                    
                    if (isCreatorConnected) {
                        this.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                        this.classList.add('connected');
                        showToast('Connected with creator!', 'success');
                        
                        // Update connectors count
                        creatorConnectorsCount = await supabaseService.getCreatorConnectorsCount(creatorId);
                        const creatorConnectorsEl = document.getElementById('creatorConnectors');
                        if (creatorConnectorsEl) {
                            safe.setText(creatorConnectorsEl, `${creatorConnectorsCount} connectors`);
                        }
                        
                        if (window.track) {
                            track.creatorConnect(creatorId, 'connect');
                        }
                    } else {
                        this.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                        this.classList.remove('connected');
                        showToast('Disconnected from creator', 'info');
                        
                        // Update connectors count
                        creatorConnectorsCount = await supabaseService.getCreatorConnectorsCount(creatorId);
                        const creatorConnectorsEl = document.getElementById('creatorConnectors');
                        if (creatorConnectorsEl) {
                            safe.setText(creatorConnectorsEl, `${creatorConnectorsCount} connectors`);
                        }
                        
                        if (window.track) {
                            track.creatorConnect(creatorId, 'disconnect');
                        }
                    }
                } else {
                    showToast('Failed to update connection', 'error');
                }
            });
        }
        
        // Refresh comments button
        const refreshCommentsBtn = document.getElementById('refreshCommentsBtn');
        if (refreshCommentsBtn) {
            refreshCommentsBtn.addEventListener('click', async function() {
                showToast('Refreshing comments...', 'info');
                const comments = await fetchComments(currentContent.id);
                renderComments(comments);
                showToast('Comments refreshed', 'success');
            });
        }
        
        // Header buttons
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                window.location.href = 'content-library.html';
            });
        }
        
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', function() {
                window.location.href = 'profile.html';
            });
        }
        
        // Logo click
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.addEventListener('click', function() {
                window.location.href = 'index.html';
            });
        }
        
        // Back to top button
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (window.track) {
                    track.buttonClick('back_to_top', 'global');
                }
            });
            
            // Show/hide based on scroll
            window.addEventListener('scroll', function() {
                if (window.scrollY > 300) {
                    backToTopBtn.style.display = 'flex';
                } else {
                    backToTopBtn.style.display = 'none';
                }
            });
        }
        
        console.log('Event listeners setup complete');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Handle play pressed
function handlePlayPressed() {
    try {
        if (!currentContent || !currentContent.file_url) {
            showToast('Video URL not available', 'error');
            return;
        }
        
        const videoUrl = currentContent.file_url;
        const inlinePlayerContainer = document.getElementById('inlinePlayer');
        const playerTitle = document.getElementById('playerTitle');
        const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
        
        if (inlinePlayerContainer && playerTitle && inlineVideoPlayer) {
            inlinePlayerContainer.style.display = 'block';
            safe.setText(playerTitle, `Now Playing: ${currentContent.title || 'Video'}`);
            
            // Set video source
            inlineVideoPlayer.src = security.safeURL(videoUrl);
            
            // Track play event
            if (window.track) {
                track.contentPlay(currentContent.id, currentContent.duration);
            }
            
            // Scroll to player
            setTimeout(() => {
                inlinePlayerContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 100);
            
            // Try to play
            const playPromise = inlineVideoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log('Autoplay prevented:', err);
                    showToast('Click the play button to start video', 'info');
                });
            }
        }
    } catch (error) {
        console.error('Error playing video:', error);
        showToast('Could not play video', 'error');
    }
}

// Render related content
function renderRelatedContent(relatedContent) {
    const relatedGrid = document.getElementById('relatedGrid');
    if (!relatedGrid) return;
    
    try {
        if (!relatedContent || relatedContent.length === 0) {
            relatedGrid.innerHTML = `
                <div class="related-placeholder card">
                    <i class="fas fa-video-slash"></i>
                    <p>No related content found</p>
                </div>
            `;
            return;
        }
        
        relatedGrid.innerHTML = '';
        relatedContent.forEach(content => {
            const card = security.createElement('a', {
                className: 'content-card',
                href: `content-detail.html?id=${content.id}`
            });
            
            const thumbnail = security.createElement('div', {
                className: 'card-thumbnail'
            });
            
            const img = security.createImage(
                content.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
                content.title || 'Related Content'
            );
            thumbnail.appendChild(img);
            
            const overlay = security.createElement('div', {
                className: 'thumbnail-overlay'
            });
            thumbnail.appendChild(overlay);
            
            const cardContent = security.createElement('div', {
                className: 'card-content'
            });
            
            const title = security.createElement('h3', {
                className: 'card-title',
                title: content.title || 'Untitled'
            }, content.title && content.title.length > 50 ? content.title.substring(0, 50) + '...' : content.title || 'Untitled');
            
            const meta = security.createElement('div', {
                className: 'related-meta'
            });
            
            const eyeIcon = security.createElement('i', {
                className: 'fas fa-eye'
            });
            
            const viewsText = security.createElement('span', {}, `${content.views_count || 0} views`);
            
            meta.appendChild(eyeIcon);
            meta.appendChild(viewsText);
            
            cardContent.appendChild(title);
            cardContent.appendChild(meta);
            
            card.appendChild(thumbnail);
            card.appendChild(cardContent);
            relatedGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering related content:', error);
    }
}

// Render comments
function renderComments(comments) {
    const commentsList = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const commentsCount = document.getElementById('commentsCount');
    
    if (!commentsList) return;
    
    try {
        // Clear existing comments
        commentsList.innerHTML = '';
        
        if (!comments || comments.length === 0) {
            if (noComments) {
                noComments.style.display = 'block';
            }
            if (commentsCount) {
                safe.setText(commentsCount, '(0)');
            }
            return;
        }
        
        // Hide "no comments" message
        if (noComments) {
            noComments.style.display = 'none';
        }
        
        // Update comments count
        if (commentsCount) {
            safe.setText(commentsCount, `(${comments.length})`);
        }
        
        // Render each comment
        comments.forEach(comment => {
            const commentEl = createCommentElement(comment);
            commentsList.appendChild(commentEl);
        });
        
    } catch (error) {
        console.error('Error rendering comments:', error);
    }
}

// Create comment element
function createCommentElement(commentData) {
    const commentEl = security.createElement('div', {
        className: 'comment-item'
    });
    
    const commentHeader = security.createElement('div', {
        className: 'comment-header'
    });
    
    const commentAvatar = security.createElement('div', {
        className: 'comment-avatar-sm'
    });
    
    // Try to get avatar URL, otherwise use placeholder
    let avatarContent;
    if (commentData.user_profiles && commentData.user_profiles.avatar_url) {
        const avatarImg = security.createImage(
            commentData.user_profiles.avatar_url,
            commentData.author_name || 'User'
        );
        avatarImg.style.width = '100%';
        avatarImg.style.height = '100%';
        avatarImg.style.objectFit = 'cover';
        avatarContent = avatarImg;
    } else {
        const avatarIcon = security.createElement('i', {
            className: 'fas fa-user-circle'
        });
        avatarContent = avatarIcon;
    }
    commentAvatar.appendChild(avatarContent);
    
    const commentUser = security.createElement('div', {
        className: 'comment-user'
    });
    
    const userName = security.createElement('strong', {}, commentData.author_name || 'User');
    const commentTime = security.createElement('div', {
        className: 'comment-time'
    }, formatCommentTime(commentData.created_at));
    
    commentUser.appendChild(userName);
    commentUser.appendChild(commentTime);
    
    commentHeader.appendChild(commentAvatar);
    commentHeader.appendChild(commentUser);
    
    const commentContent = security.createElement('div', {
        className: 'comment-content'
    }, commentData.comment_text || '');
    
    commentEl.appendChild(commentHeader);
    commentEl.appendChild(commentContent);
    
    return commentEl;
}

function formatCommentTime(timestamp) {
    if (!timestamp) return 'Recently';
    
    try {
        const commentDate = new Date(timestamp);
        const now = new Date();
        const diffMs = now - commentDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
        return commentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: commentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    } catch {
        return 'Recently';
    }
}

// Add comment
async function addComment(commentText, authorName) {
    if (!currentUserId || !currentContent) return false;
    
    try {
        const comment = await supabaseService.addComment(
            currentContent.id,
            commentText,
            currentUserId,
            authorName
        );
        
        if (!comment) {
            showToast('Failed to add comment', 'error');
            return false;
        }
        
        // Refresh comments
        const comments = await fetchComments(currentContent.id);
        renderComments(comments);
        
        // Track comment
        if (window.track) {
            track.commentAdd(currentContent.id, commentText.length);
        }
        
        return true;
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment', 'error');
        return false;
    }
}

// Copy to clipboard fallback
function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            showToast('Link copied to clipboard!', 'success');
            if (window.track) {
                track.contentShare(currentContent.id, 'clipboard');
            }
        })
        .catch(() => showToast('Failed to copy link', 'error'));
}

console.log('Content detail module loaded');
