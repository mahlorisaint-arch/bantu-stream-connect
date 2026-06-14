// js/content-detail/hero-section.js
// Extracted from content-detail.js - Hero Section Management

console.log('🎬 Hero Section module loading...');

// ============================================
// UPDATE CONTENT UI (HERO SECTION)
// ============================================
function updateContentUI(content) {
    if (!content) return;
    
    // Basic info
    safeSetText('contentTitle', content.title);
    
    const creatorName = content.creator || (window.currentPlaylist?.creator_name || window.currentPlaylist?.creator_username || 'Creator');
    safeSetText('creatorName', creatorName);
    safeSetText('creatorDisplayName', creatorName);
    
    // Stats
    safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
    safeSetText('viewsCountFull', formatNumber(content.views_count));
    safeSetText('likesCount', formatNumber(content.likes_count));
    safeSetText('favoritesCount', formatNumber(content.favorites_count));
    safeSetText('commentsCount', `(${formatNumber(content.comments_count)})`);
    
    // Duration and date
    const duration = formatDuration(content.duration || 3600);
    safeSetText('durationText', duration);
    safeSetText('contentDurationFull', duration);
    safeSetText('uploadDate', formatDate(content.created_at));
    safeSetText('contentGenre', content.genre || 'General');
    
    // Description
    safeSetText('contentDescriptionShort', truncateText(content.description, 150));
    safeSetText('contentDescriptionFull', content.description);
    
    // Poster image
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
}

// ============================================
// ADD RESUME BUTTON TO HERO
// ============================================
function addResumeButton(progressSeconds) {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    
    if (document.getElementById('resumeBtn')) return;
    
    const resumeBtn = document.createElement('button');
    resumeBtn.id = 'resumeBtn';
    resumeBtn.className = 'btn btn-primary resume-btn';
    resumeBtn.innerHTML = `
        <i class="fas fa-play"></i>
        <span>Resume (${formatDuration(progressSeconds)})</span>
    `;
    
    resumeBtn.addEventListener('click', function() {
        if (typeof startPlaybackFromUserGesture === 'function') {
            startPlaybackFromUserGesture();
        }
    });
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        heroActions.insertBefore(resumeBtn, playBtn);
        playBtn.style.display = 'none';
    } else {
        heroActions.prepend(resumeBtn);
    }
}

// ============================================
// REMOVE RESUME BUTTON
// ============================================
function removeResumeButton() {
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) {
        resumeBtn.remove();
    }
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.style.display = 'flex';
    }
}

// ============================================
// UPDATE HERO POSTER VISUAL STATE
// ============================================
function setHeroPosterPlaying(isPlaying) {
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        if (isPlaying) {
            heroPoster.style.opacity = '0.3';
        } else {
            heroPoster.style.opacity = '1';
        }
    }
}

// ============================================
// UPDATE CONTENT DETAILS (alias for updateContentUI)
// ============================================
function updateContentDetails(content) {
    updateContentUI(content);
}

// ============================================
// SAFE SET TEXT UTILITY
// ============================================
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text || '';
}

// ============================================
// FORMAT NUMBER
// ============================================
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ============================================
// FORMAT DURATION
// ============================================
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// TRUNCATE TEXT
// ============================================
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// FORMAT DATE
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return '-';
    }
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.updateContentUI = updateContentUI;
window.updateContentDetails = updateContentDetails;
window.addResumeButton = addResumeButton;
window.removeResumeButton = removeResumeButton;
window.setHeroPosterPlaying = setHeroPosterPlaying;

console.log('✅ Hero Section module loaded');
