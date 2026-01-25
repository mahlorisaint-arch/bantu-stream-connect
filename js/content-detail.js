console.log('🎬 Content Detail Screen Initializing...');

// Wait for DOM and dependencies
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    try {
        // Check if required dependencies are loaded
        if (typeof security === 'undefined') {
            console.warn('Security module not found, using fallback');
            // Create minimal security fallback
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
        
        if (typeof errorHandler === 'undefined') {
            console.warn('Error handler not found, using console logging');
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
        
        if (typeof track === 'undefined') {
            console.warn('Analytics not found, using mock');
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
        
        // Now initialize the app
        console.log('All dependencies ready, initializing app...');
        initializeApp();
        
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        // Show error to user but don't crash
        const loadingScreen = document.getElementById('loading');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div class="spinner" style="border-top-color: #EF4444;"></div>
                    <div id="loading-text" style="color: #EF4444; margin-top: 20px;">
                        Error loading page. Please refresh.
                    </div>
                    <button onclick="location.reload()" 
                            style="margin-top: 20px; padding: 10px 20px; background: #1D4ED8; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
        
        if (app) {
            app.style.display = 'none';
        }
    }
});

// Content data (sample data)
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
    views: 12500,
    likes: 890,
    creator_id: 'creator123'
};

// Related content (sample data)
const sampleRelatedContent = [
    {
        id: '2',
        title: 'Tech Innovation in Africa',
        thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
        views: 8900
    },
    {
        id: '3',
        title: 'Traditional Dance Performance',
        thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
        views: 15600
    }
];

function initializeApp() {
    console.log('Initializing app...');
    
    try {
        // Track page view
        if (window.track && typeof track.contentView === 'function') {
            track.contentView(sampleContentData.id, sampleContentData.media_type);
        }
        
        // Update UI
        updateContentUI(sampleContentData);
        renderRelatedContent(sampleRelatedContent);
        
        // Setup event listeners
        setupEventListeners();
        
        // Hide loading screen and show app
        const loadingScreen = document.getElementById('loading');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (app) {
            app.style.display = 'block';
            console.log('App displayed successfully');
        }
        
        // Show welcome message
        showToast('Content loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error in initializeApp:', error);
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

// Update UI with content data
function updateContentUI(contentData) {
    if (!contentData) return;
    
    console.log('Updating UI with content data...');
    
    try {
        // Update hero section
        safe.setText(document.getElementById('contentTitle'), contentData.title);
        safe.setText(document.getElementById('creatorName'), contentData.creator);
        safe.setText(document.getElementById('creatorDisplayName'), contentData.creator);
        safe.setText(document.getElementById('viewsCount'), `${contentData.views} views`);
        safe.setText(document.getElementById('likesCount'), `${contentData.likes} likes`);
        
        const durationFormatted = formatDuration(contentData.duration);
        safe.setText(document.getElementById('durationText'), durationFormatted);
        safe.setText(document.getElementById('contentDurationFull'), durationFormatted);
        
        // Set poster image
        const posterPlaceholder = document.getElementById('posterPlaceholder');
        if (posterPlaceholder) {
            posterPlaceholder.innerHTML = '';
            const img = security.createImage(contentData.thumbnail_url, contentData.title);
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
        safe.setText(document.getElementById('contentGenre'), contentData.genre);
        safe.setText(document.getElementById('contentLanguage'), contentData.language);
        
        // Update description
        const description = contentData.description;
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
        
        console.log('UI updated successfully');
    } catch (error) {
        console.error('Error updating UI:', error);
        throw error;
    }
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
        
        // Like button
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', function() {
                const isInFavorites = !this.classList.contains('active');
                
                if (isInFavorites) {
                    this.querySelector('i').className = 'fas fa-heart';
                    this.querySelector('span').textContent = 'Favorited';
                    showToast('Added to favorites', 'success');
                } else {
                    this.querySelector('i').className = 'far fa-heart';
                    this.querySelector('span').textContent = 'Favorite';
                    showToast('Removed from favorites', 'info');
                }
                
                this.classList.toggle('active');
            });
        }
        
        // Send comment button
        const sendCommentBtn = document.getElementById('sendCommentBtn');
        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', function() {
                const commentInput = document.getElementById('commentInput');
                const commentText = commentInput.value.trim();
                
                if (!commentText) {
                    showToast('Please enter a comment', 'warning');
                    return;
                }
                
                createCommentElement(commentText);
                commentInput.value = '';
                showToast('Comment added successfully!', 'success');
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
                if (navigator.share) {
                    navigator.share({
                        title: sampleContentData.title,
                        text: `Check out "${sampleContentData.title}" on Bantu Stream Connect`,
                        url: window.location.href
                    }).then(() => {
                        showToast('Shared successfully!', 'success');
                    }).catch(() => {
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
            connectBtn.addEventListener('click', function() {
                const isConnected = !this.classList.contains('connected');
                
                if (isConnected) {
                    this.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    this.classList.add('connected');
                    showToast('Connected with creator!', 'success');
                } else {
                    this.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    this.classList.remove('connected');
                    showToast('Disconnected from creator', 'info');
                }
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
        
        console.log('Event listeners setup complete');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Handle play pressed
function handlePlayPressed() {
    try {
        const videoUrl = sampleContentData.file_url;
        const inlinePlayerContainer = document.getElementById('inlinePlayer');
        const playerTitle = document.getElementById('playerTitle');
        const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
        
        if (inlinePlayerContainer && playerTitle && inlineVideoPlayer) {
            inlinePlayerContainer.style.display = 'block';
            safe.setText(playerTitle, `Now Playing: ${sampleContentData.title}`);
            
            // Set video source
            inlineVideoPlayer.src = security.safeURL(videoUrl);
            
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
            
            const img = security.createImage(content.thumbnail_url, content.title);
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
                title: content.title
            }, content.title.length > 50 ? content.title.substring(0, 50) + '...' : content.title);
            
            const meta = security.createElement('div', {
                className: 'related-meta'
            });
            
            const eyeIcon = security.createElement('i', {
                className: 'fas fa-eye'
            });
            
            const viewsText = security.createElement('span', {}, `${content.views} views`);
            
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

// Create comment element
function createCommentElement(commentText) {
    try {
        const commentsList = document.getElementById('commentsList');
        const noComments = document.getElementById('noComments');
        const commentsCount = document.getElementById('commentsCount');
        
        if (!commentsList) return;
        
        // Hide "no comments" message
        if (noComments) {
            noComments.style.display = 'none';
        }
        
        // Create comment element
        const commentEl = security.createElement('div', {
            className: 'comment-item'
        });
        
        const commentHeader = security.createElement('div', {
            className: 'comment-header'
        });
        
        const commentAvatar = security.createElement('div', {
            className: 'comment-avatar-sm'
        });
        
        const avatarIcon = security.createElement('i', {
            className: 'fas fa-user-circle'
        });
        commentAvatar.appendChild(avatarIcon);
        
        const commentUser = security.createElement('div', {
            className: 'comment-user'
        });
        
        const userName = security.createElement('strong', {}, 'You');
        const commentTime = security.createElement('div', {
            className: 'comment-time'
        }, 'Just now');
        
        commentUser.appendChild(userName);
        commentUser.appendChild(commentTime);
        
        commentHeader.appendChild(commentAvatar);
        commentHeader.appendChild(commentUser);
        
        const commentContent = security.createElement('div', {
            className: 'comment-content'
        }, commentText);
        
        commentEl.appendChild(commentHeader);
        commentEl.appendChild(commentContent);
        
        // Add to comments list
        commentsList.insertBefore(commentEl, commentsList.firstChild);
        
        // Update comments count
        if (commentsCount) {
            const currentCount = parseInt(commentsCount.textContent.replace(/[()]/g, '')) || 0;
            safe.setText(commentsCount, `(${currentCount + 1})`);
        }
    } catch (error) {
        console.error('Error creating comment:', error);
    }
}

// Copy to clipboard fallback
function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
}

// Initialize back to top button
window.addEventListener('scroll', function() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        if (window.scrollY > 300) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    }
});

// Back to top button click
document.addEventListener('click', function(e) {
    if (e.target.id === 'backToTopBtn' || e.target.closest('#backToTopBtn')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

console.log('Content detail module loaded');
