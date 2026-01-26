// content-detail.js - SIMPLIFIED VERSION
console.log('🎬 Content Detail Screen Initializing...');

// Global variables
let currentContent = null;
let currentUserId = null;

// Wait for DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeApp();
});

// Main initialization
async function initializeApp() {
    console.log('🚀 Initializing app...');
    
    try {
        // Get content ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const contentId = urlParams.get('id') || '68';
        console.log('Content ID:', contentId);
        
        // Update loading text
        updateLoadingText('Connecting to database...');
        
        // Initialize Supabase helper
        if (typeof SupabaseHelper === 'undefined' || !SupabaseHelper.isInitialized) {
            console.warn('Supabase not available, using sample data');
            useSampleData();
            return;
        }
        
        // Get current user
        const user = await SupabaseHelper.getCurrentUser();
        currentUserId = user?.id || null;
        console.log('Current user:', currentUserId ? 'Logged in' : 'Guest');
        
        // Update loading text
        updateLoadingText('Loading content...');
        
        // Fetch content
        currentContent = await SupabaseHelper.getContentById(contentId);
        
        if (!currentContent) {
            console.error('Failed to fetch content');
            useSampleData();
            return;
        }
        
        // Record view
        await SupabaseHelper.recordView(contentId, currentUserId);
        
        // Update loading text
        updateLoadingText('Loading related content...');
        
        // Fetch related content
        const relatedContent = await SupabaseHelper.getRelatedContent(
            contentId,
            currentContent.genre,
            currentContent.creator_id,
            6
        );
        
        // Update loading text
        updateLoadingText('Loading comments...');
        
        // Fetch comments
        const comments = await SupabaseHelper.getComments(contentId);
        
        // Update UI
        updateContentUI(currentContent);
        renderComments(comments);
        renderRelatedContent(relatedContent);
        
        // Setup event listeners
        setupEventListeners();
        
        // Hide loading and show app
        showApp();
        
        console.log('✅ App initialized successfully');
        showToast('Content loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error in initializeApp:', error);
        showToast('Failed to load content. Using sample data.', 'warning');
        useSampleData();
    }
}

// Use sample data as fallback
function useSampleData() {
    console.log('Using sample data...');
    
    const sampleContent = {
        id: '68',
        title: 'African Music Festival Highlights',
        description: 'Highlights from the biggest African music festival featuring top artists from across the continent. Experience the vibrant culture, amazing performances, and unforgettable moments.',
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
    
    const sampleRelated = [
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
    
    currentContent = sampleContent;
    
    // Update UI
    updateContentUI(sampleContent);
    renderRelatedContent(sampleRelated);
    
    // Setup event listeners
    setupEventListeners();
    
    // Show app
    showApp();
    
    showToast('Loaded with sample data', 'info');
}

// UI Helper functions
function updateLoadingText(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
}

function showApp() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loading) loading.style.display = 'none';
    if (app) app.style.display = 'block';
}

function updateContentUI(content) {
    if (!content) return;
    
    console.log('Updating UI with content:', content.title);
    
    // Update basic info
    safeSetText('contentTitle', content.title);
    safeSetText('creatorName', content.creator);
    safeSetText('creatorDisplayName', content.creator);
    safeSetText('viewsCount', `${content.views_count} views`);
    safeSetText('likesCount', `${content.likes_count} likes`);
    safeSetText('durationText', formatDuration(content.duration));
    safeSetText('contentDurationFull', formatDuration(content.duration));
    safeSetText('uploadDate', formatDate(content.created_at));
    safeSetText('contentGenre', content.genre || 'Not specified');
    safeSetText('contentLanguage', content.language || 'English');
    
    // Update description
    safeSetText('contentDescriptionShort', truncateText(content.description, 150));
    safeSetText('contentDescriptionFull', content.description);
    
    // Update poster image
    const poster = document.getElementById('posterPlaceholder');
    if (poster) {
        const imgUrl = SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        poster.innerHTML = `
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
}

function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        if (noComments) noComments.style.display = 'block';
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
    
    const authorName = comment.author_name || comment.user_profiles?.full_name || 'User';
    const avatarUrl = comment.user_profiles?.avatar_url;
    const time = formatCommentTime(comment.created_at);
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl ? 
                    `<img src="${SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl}" alt="${authorName}">` :
                    `<i class="fas fa-user-circle"></i>`
                }
            </div>
            <div class="comment-user">
                <strong>${escapeHtml(authorName)}</strong>
                <div class="comment-time">${time}</div>
            </div>
        </div>
        <div class="comment-content">
            ${escapeHtml(comment.comment_text || '')}
        </div>
    `;
    
    return div;
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
        
        const imgUrl = SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${imgUrl}" alt="${item.title}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${truncateText(item.title, 50)}</h3>
                <div class="related-meta">
                    <i class="fas fa-eye"></i>
                    <span>${item.views_count || 0} views</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Play button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', handlePlay);
    }
    
    // Poster click
    const poster = document.getElementById('heroPoster');
    if (poster) {
        poster.addEventListener('click', handlePlay);
    }
    
    // Send comment
    const sendBtn = document.getElementById('sendCommentBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendComment);
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
        closePlayer.addEventListener('click', function() {
            const player = document.getElementById('inlinePlayer');
            const video = document.getElementById('inlineVideoPlayer');
            if (player) player.style.display = 'none';
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        });
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
    
    // Favorite button
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', function() {
            const isActive = this.classList.contains('active');
            if (isActive) {
                this.classList.remove('active');
                this.querySelector('i').className = 'far fa-heart';
                this.querySelector('span').textContent = 'Favorite';
                showToast('Removed from favorites', 'info');
            } else {
                this.classList.add('active');
                this.querySelector('i').className = 'fas fa-heart';
                this.querySelector('span').textContent = 'Favorited';
                showToast('Added to favorites', 'success');
            }
        });
    }
    
    // Connect button
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', function() {
            const isConnected = this.classList.contains('connected');
            if (isConnected) {
                this.classList.remove('connected');
                this.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                showToast('Disconnected from creator', 'info');
            } else {
                this.classList.add('connected');
                this.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                showToast('Connected with creator!', 'success');
            }
        });
    }
}

// Event handlers
function handlePlay() {
    if (!currentContent) return;
    
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');
    const title = document.getElementById('playerTitle');
    
    if (!player || !video) return;
    
    // Get video URL
    const videoUrl = SupabaseHelper?.fixMediaUrl?.(currentContent.file_url) || currentContent.file_url;
    
    // Update player
    if (title) title.textContent = `Now Playing: ${currentContent.title}`;
    video.src = videoUrl;
    player.style.display = 'block';
    
    // Scroll to player
    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Try to play
    video.play().catch(err => {
        console.log('Autoplay prevented:', err);
        showToast('Click the play button in the video player', 'info');
    });
}

async function handleSendComment() {
    if (!currentContent) return;
    
    const input = document.getElementById('commentInput');
    const text = input?.value.trim();
    
    if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    if (!currentUserId) {
        showToast('Please sign in to comment', 'warning');
        return;
    }
    
    // Get user name
    let authorName = 'User';
    try {
        const user = await SupabaseHelper.getCurrentUser();
        if (user?.email) {
            authorName = user.email.split('@')[0];
        }
    } catch (error) {
        console.error('Error getting user:', error);
    }
    
    // Add comment
    const success = await SupabaseHelper.addComment(
        currentContent.id,
        text,
        currentUserId,
        authorName
    );
    
    if (success) {
        input.value = '';
        showToast('Comment added successfully!', 'success');
        
        // Refresh comments
        const comments = await SupabaseHelper.getComments(currentContent.id);
        renderComments(comments);
    } else {
        showToast('Failed to add comment', 'error');
    }
}

// Utility functions
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
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
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return `${seconds}s`;
    }
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
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

console.log('✅ Content detail module loaded');
