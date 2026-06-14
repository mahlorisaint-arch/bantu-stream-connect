// js/content-detail/continue-watching.js
// ============================================
// CONTINUE WATCHING MODULE - COMPLETE BRAIN
// Contains UI rendering for continue watching section
// AND its specific database logic (fetch from watch_progress table)
// ============================================
console.log('🎬 Continue Watching Module Loading...');

/**
 * Load continue watching items from database for a specific user
 * @param {string} userId - The user ID to load watch progress for
 * @param {number} limit - Maximum number of items to load (default: 8)
 */
async function loadContinueWatching(userId, limit = 8) {
    const section = document.getElementById('continueWatchingSection');
    if (!section) {
        console.warn('Continue watching section not found in DOM');
        return;
    }
    
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
        
        console.log(`✅ Loaded ${data.length} continue watching items`);
        return data;
        
    } catch (error) {
        console.error('❌ Failed to load continue watching:', error);
        section.style.display = 'none';
        return [];
    }
}

/**
 * Render continue watching items into the grid
 * @param {Array} items - Array of watch_progress items with nested Content
 */
function renderContinueWatching(items) {
    const container = document.getElementById('continueGrid');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';
        
        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;
        
        const timeWatched = window.formatDuration(item.last_position);
        const totalTime = window.formatDuration(content.duration);
        
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
                         alt="${window.escapeHtml(content.title)}" 
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
                    <h3 class="card-title">${window.truncateText(content.title, 45)}</h3>
                    <div class="related-meta">
                        <span>${timeWatched} / ${totalTime}</span>
                    </div>
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${window.truncateText(creatorName, 20)}
                    </div>
                </div>
            </a>
        `;
    }).join('');
    
    // Attach click tracking to continue cards
    container.querySelectorAll('.continue-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (window.track?.continueWatchingClick) {
                const contentId = card.dataset.contentId;
                window.track.continueWatchingClick(contentId);
            }
        });
    });
    
    console.log('✅ Continue watching grid rendered');
}

/**
 * Refresh continue watching section (reload from database)
 * @param {string} userId - The user ID (optional, uses currentUserId if not provided)
 */
async function refreshContinueWatching(userId = null) {
    const targetUserId = userId || window.currentUserId;
    
    if (!targetUserId) {
        console.log('No user ID provided for continue watching refresh');
        const section = document.getElementById('continueWatchingSection');
        if (section) section.style.display = 'none';
        return;
    }
    
    await loadContinueWatching(targetUserId);
}

/**
 * Setup continue watching refresh trigger (called after auth changes or content completion)
 */
function setupContinueWatchingRefresh() {
    // Listen for watch progress updates
    window.addEventListener('watch-progress-updated', () => {
        if (window.currentUserId) {
            refreshContinueWatching(window.currentUserId);
        }
    });
    
    // Listen for content completion events
    window.addEventListener('content-completed', () => {
        if (window.currentUserId) {
            setTimeout(() => refreshContinueWatching(window.currentUserId), 500);
        }
    });
    
    // Also refresh after auth state changes (handled by auth listener in orchestrator)
    console.log('✅ Continue watching refresh trigger setup');
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.loadContinueWatching = loadContinueWatching;
window.renderContinueWatching = renderContinueWatching;
window.refreshContinueWatching = refreshContinueWatching;
window.setupContinueWatchingRefresh = setupContinueWatchingRefresh;

console.log('✅ Continue Watching Module loaded (with full brain)');
