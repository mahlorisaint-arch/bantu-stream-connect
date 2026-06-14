// js/content-detail/continue-watching.js
// Extracted from content-detail.js - Continue Watching Section Management

console.log('▶️ Continue Watching module loading...');

// ============================================
// LOAD CONTINUE WATCHING
// ============================================
async function loadContinueWatching(userId, limit = 8) {
    const section = document.getElementById('continueWatchingSection');
    if (!section) return;
    
    if (!userId || !window.supabaseClient) {
        section.style.display = 'none';
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                content_id,
                last_position,
                is_completed,
                updated_at,
                Content (
                    id,
                    title,
                    thumbnail_url,
                    genre,
                    duration,
                    status,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .eq('Content.status', 'published')
            .order('updated_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        renderContinueWatching(data);
        section.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Failed to load continue watching:', error);
        section.style.display = 'none';
    }
}

// ============================================
// RENDER CONTINUE WATCHING
// ============================================
function renderContinueWatching(items) {
    const container = document.getElementById('continueGrid');
    if (!container) return;
    
    container.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';
        
        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;
        
        const timeWatched = formatDuration(item.last_position);
        const totalTime = formatDuration(content.duration);
        
        const thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url)
            || content.thumbnail_url
            || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const creatorName = content.user_profiles?.full_name
            || content.user_profiles?.username
            || (window.isPlaylistMode && window.currentPlaylist ? window.currentPlaylist.creator_name : 'Creator');
        
        return `
            <a href="content-detail.html?id=${content.id}" class="content-card continue-card" data-content-id="${content.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="progress-bar-overlay">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                    <div class="resume-badge">
                        <i class="fas fa-play"></i> Resume
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(content.title, 45)}</h3>
                    <div class="related-meta">
                        <span>${timeWatched} / ${totalTime}</span>
                    </div>
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${truncateText(creatorName, 20)}
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    // Add click tracking
    container.querySelectorAll('.continue-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (window.track?.continueWatchingClick) {
                const contentId = card.dataset.contentId;
                window.track.continueWatchingClick(contentId);
            }
        });
    });
}

// ============================================
// REFRESH CONTINUE WATCHING SECTION
// ============================================
async function refreshContinueWatching() {
    if (!window.currentUserId) {
        const section = document.getElementById('continueWatchingSection');
        if (section) section.style.display = 'none';
        return;
    }
    
    await loadContinueWatching(window.currentUserId);
}

// ============================================
// SETUP CONTINUE WATCHING REFRESH BUTTON
// ============================================
function setupContinueWatchingRefresh() {
    const refreshBtn = document.getElementById('refreshContinueBtn');
    if (!refreshBtn) return;
    
    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
    
    newRefreshBtn.addEventListener('click', async function() {
        if (typeof showToast === 'function') {
            showToast('Refreshing continue watching...', 'info');
        }
        await refreshContinueWatching();
        if (typeof showToast === 'function') {
            showToast('Continue watching refreshed!', 'success');
        }
    });
}

// ============================================
// HIDE CONTINUE WATCHING SECTION
// ============================================
function hideContinueWatchingSection() {
    const section = document.getElementById('continueWatchingSection');
    if (section) {
        section.style.display = 'none';
    }
}

// ============================================
// SHOW CONTINUE WATCHING SECTION
// ============================================
function showContinueWatchingSection() {
    const section = document.getElementById('continueWatchingSection');
    if (section && window.currentUserId) {
        section.style.display = 'block';
    }
}

// ============================================
// UTILITY FUNCTIONS
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

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.loadContinueWatching = loadContinueWatching;
window.renderContinueWatching = renderContinueWatching;
window.refreshContinueWatching = refreshContinueWatching;
window.setupContinueWatchingRefresh = setupContinueWatchingRefresh;
window.hideContinueWatchingSection = hideContinueWatchingSection;
window.showContinueWatchingSection = showContinueWatchingSection;

console.log('✅ Continue Watching module loaded');
