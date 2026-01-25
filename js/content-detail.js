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
    },
    {
        id: '4',
        title: 'African Cuisine Cooking Show',
        thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
        views: 7800
    },
    {
        id: '5',
        title: 'Startup Success Stories',
        thumbnail_url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=225&fit=crop',
        views: 11200
    },
    {
        id: '6',
        title: 'African Wildlife Documentary',
        thumbnail_url: 'https://images.unsplash.com/photo-1575550959106-5a7defe08b56?w=400&h=225&fit=crop',
        views: 9400
    },
    {
        id: '7',
        title: 'African Fashion Week',
        thumbnail_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=225&fit=crop',
        views: 6700
    }
];

// Wait for DOM and dependencies
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎬 Content Detail Screen Initializing...');
    
    // Initialize error handling
    if (window.errorHandler) {
        errorHandler.safeExecute(initializeApp, 'app-initialization');
    } else {
        initializeApp();
    }
});

function initializeApp() {
    // Track page view
    if (window.track) {
        track.contentView(sampleContentData.id, sampleContentData.media_type);
    }
    
    // Update UI safely
    safe.execute(() => {
        updateContentUI(sampleContentData);
        renderRelatedContent(sampleRelatedContent);
    }, 'ui-rendering');
    
    // Setup event listeners with error handling
    setupEventListeners();
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loading');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Show app
    const app = document.getElementById('app');
    if (app) {
        app.style.display = 'block';
    }
    
    console.log('✅ App initialized successfully');
    
    // Show welcome toast
    showToast('Content loaded successfully!', 'success');
}

// Helper functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDuration(seconds) {
    if (!seconds) return '-';
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
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast safely
    const toast = security.createElement('div', {
        className: `toast ${type}`
    });
    
    const icon = security.createElement('i', {
        className: type === 'error' ? 'fas fa-exclamation-triangle' :
                   type === 'success' ? 'fas fa-check-circle' :
                   type === 'warning' ? 'fas fa-exclamation-circle' :
                   'fas fa-info-circle'
    });
    
    const text = security.createElement('span', {}, message);
    
    toast.appendChild(icon);
    toast.appendChild(text);
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
    
    // Update hero section safely
    safe.setText(document.getElementById('contentTitle'), contentData.title);
    safe.setText(document.getElementById('creatorName'), contentData.creator);
    safe.setText(document.getElementById('creatorDisplayName'), contentData.creator);
    safe.setText(document.getElementById('viewsCount'), `${contentData.views} views`);
    safe.setText(document.getElementById('likesCount'), `${contentData.likes} likes`);
    
    const durationFormatted = formatDuration(contentData.duration);
    safe.setText(document.getElementById('durationText'), durationFormatted);
    safe.setText(document.getElementById('contentDurationFull'), durationFormatted);
    
    // Set poster image safely
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
    
    // Update stats safely
    safe.setText(document.getElementById('uploadDate'), formatDate(contentData.created_at));
    safe.setText(document.getElementById('contentGenre'), contentData.genre);
    safe.setText(document.getElementById('contentLanguage'), contentData.language);
    
    // Update description safely
    const description = contentData.description;
    const shortDescription = description.length > 150 ? description.substring(0, 150) + '...' : description;
    safe.setText(document.getElementById('contentDescriptionShort'), shortDescription);
    safe.setText(document.getElementById('contentDescriptionFull'), description);
    
    // Show more/less button for long descriptions
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (description.length > 300) {
        showMoreBtn.style.display = 'block';
        safe.setText(document.getElementById('contentDescriptionFull'), description.substring(0, 300) + '...');
        safe.setText(showMoreBtn, 'Show more');
        
        safe.addEventListener(showMoreBtn, 'click', function() {
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
}

// Render related content
function renderRelatedContent(relatedContent) {
    const relatedGrid = document.getElementById('relatedGrid');
    
    if (!relatedContent || !relatedContent.length) {
        safe.setHTML(relatedGrid, `
            <div class="related-placeholder card">
                <i class="fas fa-video-slash"></i>
                <p>No related content found</p>
            </div>
        `);
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
}

// Setup event listeners
function setupEventListeners() {
    // Play button with analytics
    const playBtn = document.getElementById('playBtn');
    safe.addEventListener(playBtn, 'click', () => {
        handlePlayPressed();
        
        // Track play action
        if (window.track) {
            track.contentPlay(sampleContentData.id, sampleContentData.duration);
            track.buttonClick('play', 'hero_section');
        }
    });
    
    // Hero poster click
    const heroPoster = document.getElementById('heroPoster');
    safe.addEventListener(heroPoster, 'click', () => {
        handlePlayPressed();
        
        if (window.track) {
            track.contentPlay(sampleContentData.id, sampleContentData.duration);
            track.buttonClick('play', 'hero_poster');
        }
    });
    
    // Like button with analytics
    const favoriteBtn = document.getElementById('favoriteBtn');
    safe.addEventListener(favoriteBtn, 'click', () => {
        const isInFavorites = !favoriteBtn.classList.contains('active');
        
        if (window.track) {
            track.contentLike(sampleContentData.id, isInFavorites ? 'like' : 'unlike');
        }
        
        if (isInFavorites) {
            favoriteBtn.querySelector('i').className = 'fas fa-heart';
            favoriteBtn.querySelector('span').textContent = 'Favorited';
            showToast('Added to favorites', 'success');
        } else {
            favoriteBtn.querySelector('i').className = 'far fa-heart';
            favoriteBtn.querySelector('span').textContent = 'Favorite';
            showToast('Removed from favorites', 'info');
        }
        
        favoriteBtn.classList.toggle('active');
    });
    
    // Comment submission with safety
    const sendCommentBtn = document.getElementById('sendCommentBtn');
    safe.addEventListener(sendCommentBtn, 'click', () => {
        const commentInput = document.getElementById('commentInput');
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            showToast('Please enter a comment', 'warning');
            return;
        }
        
        // Sanitize comment
        const safeComment = security.safeText(commentText);
        
        // Track comment
        if (window.track) {
            track.commentAdd(sampleContentData.id, commentText.length);
        }
        
        // Create comment safely
        createCommentElement(safeComment);
        
        // Clear input
        commentInput.value = '';
    });
    
    // Comment input enter key
    const commentInput = document.getElementById('commentInput');
    safe.addEventListener(commentInput, 'keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendCommentBtn.click();
        }
    });
    
    // Close inline player
    const closePlayerBtn = document.getElementById('closePlayerBtn');
    safe.addEventListener(closePlayerBtn, 'click', function() {
        const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
        if (inlineVideoPlayer) {
            inlineVideoPlayer.pause();
            inlineVideoPlayer.src = '';
        }
        const inlinePlayerContainer = document.getElementById('inlinePlayer');
        if (inlinePlayerContainer) {
            inlinePlayerContainer.style.display = 'none';
        }
        showToast('Player closed', 'info');
    });
    
    // Full player button
    const fullPlayerBtn = document.getElementById('fullPlayerBtn');
    safe.addEventListener(fullPlayerBtn, 'click', function() {
        const currentContentId = sampleContentData.id;
        window.location.href = `video-player.html?id=${currentContentId}`;
    });
    
    // Picture-in-Picture button
    const pictureInPictureBtn = document.getElementById('pictureInPictureBtn');
    safe.addEventListener(pictureInPictureBtn, 'click', async function() {
        const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
        if (!inlineVideoPlayer) return;
        
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                this.classList.remove('active');
            } else if (document.pictureInPictureEnabled && inlineVideoPlayer.readyState >= 2) {
                await inlineVideoPlayer.requestPictureInPicture();
                this.classList.add('active');
            }
        } catch (error) {
            console.error('Picture-in-Picture error:', error);
            showToast('Picture-in-Picture not supported', 'warning');
        }
    });
    
    // Playback speed button
    const playbackSpeedBtn = document.getElementById('playbackSpeedBtn');
    safe.addEventListener(playbackSpeedBtn, 'click', function() {
        showToast('Playback speed feature coming soon!', 'info');
    });
    
    // Share button
    const shareBtn = document.getElementById('shareBtn');
    safe.addEventListener(shareBtn, 'click', function() {
        const shareData = {
            title: sampleContentData.title,
            text: `Check out "${sampleContentData.title}" on Bantu Stream Connect`,
            url: window.location.href
        };
        
        if (navigator.share) {
            navigator.share(shareData)
                .then(() => {
                    showToast('Shared successfully!', 'success');
                    if (window.track) {
                        track.contentShare(sampleContentData.id, 'native_share');
                    }
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        // Fallback to copy to clipboard
                        copyToClipboard();
                    }
                });
        } else {
            // Fallback to copy to clipboard
            copyToClipboard();
        }
    });
    
    // Connect button
    const connectBtn = document.getElementById('connectBtn');
    safe.addEventListener(connectBtn, 'click', function() {
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
        
        if (window.track) {
            track.creatorConnect(sampleContentData.creator_id, isConnected ? 'connect' : 'disconnect');
        }
    });
    
    // Refresh comments button
    const refreshCommentsBtn = document.getElementById('refreshCommentsBtn');
    safe.addEventListener(refreshCommentsBtn, 'click', function() {
        showToast('Comments refreshed', 'success');
        if (window.track) {
            track.buttonClick('refresh_comments', 'comments_section');
        }
    });
    
    // Header buttons
    const searchBtn = document.getElementById('search-btn');
    safe.addEventListener(searchBtn, 'click', function() {
        window.location.href = 'content-library.html';
    });
    
    const profileBtn = document.getElementById('profile-btn');
    safe.addEventListener(profileBtn, 'click', function() {
        window.location.href = 'profile.html';
    });
    
    // Logo click
    const logo = document.querySelector('.logo');
    safe.addEventListener(logo, 'click', function() {
        window.location.href = 'index.html';
    });
    
    // Back to top button
    const backToTopBtn = document.getElementById('backToTopBtn');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
    
    safe.addEventListener(backToTopBtn, 'click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.track) {
            track.buttonClick('back_to_top', 'global');
        }
    });
    
    // Handle video ended event
    const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
    if (inlineVideoPlayer) {
        safe.addEventListener(inlineVideoPlayer, 'ended', function() {
            showToast('Video completed!', 'success');
            if (window.track) {
                track.contentComplete(sampleContentData.id, 100);
            }
        });
    }
}

// Handle play pressed
function handlePlayPressed() {
    if (!sampleContentData) return;
    
    // Get video URL
    const videoUrl = sampleContentData.file_url;
    
    // Show inline player
    const inlinePlayerContainer = document.getElementById('inlinePlayer');
    const playerTitle = document.getElementById('playerTitle');
    const inlineVideoPlayer = document.getElementById('inlineVideoPlayer');
    
    if (inlinePlayerContainer && playerTitle && inlineVideoPlayer) {
        inlinePlayerContainer.style.display = 'block';
        safe.setText(playerTitle, `Now Playing: ${sampleContentData.title}`);
        
        // Set video source safely
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
}

// Create comment element safely
function createCommentElement(commentText) {
    const commentsList = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const commentsCount = document.getElementById('commentsCount');
    
    if (!commentsList) return;
    
    // Hide "no comments" message if it's the first comment
    if (noComments) {
        noComments.style.display = 'none';
    }
    
    // Create comment element using safe methods
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
    
    const commentActions = security.createElement('div', {
        className: 'comment-actions'
    });
    
    // Create action buttons
    const editBtn = security.createElement('button', {
        className: 'comment-action-btn edit-btn',
        title: 'Edit'
    });
    
    const editIcon = security.createElement('i', {
        className: 'fas fa-edit'
    });
    editBtn.appendChild(editIcon);
    
    const deleteBtn = security.createElement('button', {
        className: 'comment-action-btn delete-btn',
        title: 'Delete'
    });
    
    const deleteIcon = security.createElement('i', {
        className: 'fas fa-trash'
    });
    deleteBtn.appendChild(deleteIcon);
    
    const likeBtn = security.createElement('button', {
        className: 'comment-action-btn like-btn',
        title: 'Like'
    });
    
    const likeIcon = security.createElement('i', {
        className: 'far fa-heart'
    });
    likeBtn.appendChild(likeIcon);
    
    commentActions.appendChild(editBtn);
    commentActions.appendChild(deleteBtn);
    commentActions.appendChild(likeBtn);
    
    commentHeader.appendChild(commentAvatar);
    commentHeader.appendChild(commentUser);
    commentHeader.appendChild(commentActions);
    
    const commentContent = security.createElement('div', {
        className: 'comment-content'
    }, commentText);
    
    const commentFooter = security.createElement('div', {
        className: 'comment-footer'
    });
    
    const likeCount = security.createElement('div', {
        className: 'like-count'
    });
    
    const heartIcon = security.createElement('i', {
        className: 'fas fa-heart'
    });
    
    const countText = security.createElement('span', {}, '0 likes');
    
    likeCount.appendChild(heartIcon);
    likeCount.appendChild(countText);
    commentFooter.appendChild(likeCount);
    
    commentEl.appendChild(commentHeader);
    commentEl.appendChild(commentContent);
    commentEl.appendChild(commentFooter);
    
    // Add to comments list
    commentsList.insertBefore(commentEl, commentsList.firstChild);
    
    // Update comments count
    if (commentsCount) {
        const currentCount = parseInt(commentsCount.textContent.replace(/[()]/g, '')) || 0;
        safe.setText(commentsCount, `(${currentCount + 1})`);
    }
    
    // Add event listeners to action buttons
    safe.addEventListener(editBtn, 'click', () => {
        showToast('Edit feature coming soon!', 'info');
    });
    
    safe.addEventListener(deleteBtn, 'click', () => {
        if (confirm('Are you sure you want to delete this comment?')) {
            commentEl.remove();
            if (commentsCount) {
                const currentCount = parseInt(commentsCount.textContent.replace(/[()]/g, '')) || 1;
                safe.setText(commentsCount, `(${currentCount - 1})`);
            }
            showToast('Comment deleted', 'success');
        }
    });
    
    safe.addEventListener(likeBtn, 'click', () => {
        likeBtn.classList.toggle('liked');
        if (likeBtn.classList.contains('liked')) {
            likeIcon.className = 'fas fa-heart';
            safe.setText(countText, '1 like');
        } else {
            likeIcon.className = 'far fa-heart';
            safe.setText(countText, '0 likes');
        }
    });
}

// Copy to clipboard fallback for sharing
function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            showToast('Link copied to clipboard!', 'success');
            if (window.track) {
                track.contentShare(sampleContentData.id, 'clipboard');
            }
        })
        .catch(() => showToast('Failed to copy link', 'error'));
}
