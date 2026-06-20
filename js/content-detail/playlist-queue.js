// js/content-detail/playlist-queue.js
// ============================================
// PLAYLIST QUEUE MODULE - COMPLETE BRAIN
// Contains UI rendering for playlist queue sidebar (modern playlist mode)
// AND its specific DOM interaction logic (highlight active item, click to play)
// ============================================
console.log('🎬 Playlist Queue Module Loading...');

/**
 * Render the playlist queue sidebar with all playlist items
 * Creates clickable queue items that can be played directly
 * @param {Array} playlistItems - Array of content items in the playlist
 * @param {number} activeIndex - Currently playing/active item index
 */
function renderPlaylistQueue(playlistItems, activeIndex = 0) {
    const container = document.getElementById('playlistQueueList');
    if (!container) {
        console.warn('Playlist queue container not found');
        return;
    }
    
    if (!playlistItems || playlistItems.length === 0) {
        container.innerHTML = `
            <div class="empty-queue">
                <i class="fas fa-music"></i>
                <p>No items in playlist</p>
            </div>
        `;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    playlistItems.forEach((item, index) => {
        const isActive = (index === activeIndex);
        const queueItem = createPlaylistQueueItem(item, index, isActive);
        fragment.appendChild(queueItem);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Attach click handlers after rendering
    attachQueueItemClickHandlers(container);
    
    console.log(`✅ Playlist queue rendered with ${playlistItems.length} items, active index: ${activeIndex}`);
}

/**
 * Create a single playlist queue item DOM element
 * @param {Object} item - Content item from playlist
 * @param {number} index - Position in playlist (0-based)
 * @param {boolean} isActive - Whether this item is currently playing
 * @returns {HTMLElement} - The queue item element
 */
function createPlaylistQueueItem(item, index, isActive = false) {
    const div = document.createElement('div');
    div.className = `playlist-queue-item ${isActive ? 'active playing' : ''}`;
    div.setAttribute('data-index', index);
    div.setAttribute('data-content-id', item.id);
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Play ${window.escapeHtml(item.title)}`);
    
    const trackNumber = (index + 1).toString().padStart(2, '0');
    const thumbnail = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || 
                     item.thumbnail_url || 
                     'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=45&fit=crop';
    
    const duration = item.duration ? window.formatDuration(item.duration) : '--:--';
    const title = item.title || 'Untitled';
    const creatorName = item.user_profiles?.full_name || item.user_profiles?.username || 
                       (window.currentPlaylist?.creator_name || 'Artist');
    
    div.innerHTML = `
        <div class="queue-thumbnail">
            <img src="${thumbnail}" 
                 alt="${window.escapeHtml(title)}" 
                 loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.classList.add('placeholder');">
            <div class="playing-indicator">
                <i class="fas fa-play"></i>
            </div>
        </div>
        <div class="queue-info">
            <div class="queue-title">${window.escapeHtml(window.truncateText(title, 40))}</div>
            <div class="queue-meta">
                <span class="queue-artist">${window.escapeHtml(window.truncateText(creatorName, 20))}</span>
                <span class="queue-duration">${duration}</span>
            </div>
        </div>
        <div class="queue-actions">
            <button class="queue-play-btn" data-index="${index}" aria-label="Play now">
                <i class="fas fa-play"></i>
            </button>
            <button class="queue-menu-btn" data-index="${index}" aria-label="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    `;
    
    return div;
}

/**
 * Attach click handlers to queue items and their action buttons
 * @param {HTMLElement} container - The queue container element
 */
function attachQueueItemClickHandlers(container) {
    if (!container) return;
    
    // Handle queue item clicks (play the track)
    container.querySelectorAll('.playlist-queue-item').forEach(item => {
        // Remove existing listeners to prevent duplicates
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', (e) => {
            // Don't trigger if clicking on action buttons
            if (e.target.closest('.queue-play-btn') || e.target.closest('.queue-menu-btn')) {
                return;
            }
            
            const index = parseInt(newItem.dataset.index);
            if (!isNaN(index) && typeof window.playPlaylistItemByIndex === 'function') {
                console.log(`🎵 Playing queue item at index ${index}`);
                window.playPlaylistItemByIndex(index);
            }
        });
        
        // Keyboard accessibility
        newItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                newItem.click();
            }
        });
        
        // Handle play button clicks
        const playBtn = newItem.querySelector('.queue-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(playBtn.dataset.index);
                if (!isNaN(index) && typeof window.playPlaylistItemByIndex === 'function') {
                    console.log(`🎵 Playing queue item at index ${index} via play button`);
                    window.playPlaylistItemByIndex(index);
                }
            });
        }
        
        // Handle menu button clicks (for future features like remove from queue)
        const menuBtn = newItem.querySelector('.queue-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(menuBtn.dataset.index);
                showQueueItemMenu(index, menuBtn);
            });
        }
    });
}

/**
 * Show context menu for queue item (remove, add to playlist, etc.)
 * @param {number} index - Queue item index
 * @param {HTMLElement} targetElement - The element to position the menu near
 */
function showQueueItemMenu(index, targetElement) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.queue-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'queue-context-menu';
    menu.style.cssText = `
        position: fixed;
        background: var(--card-bg, #1a1a1a);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        min-width: 180px;
        overflow: hidden;
    `;
    
    const rect = targetElement.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left - 100}px`;
    
    const item = window.currentPlaylistItems?.[index];
    if (!item) return;
    
    menu.innerHTML = `
        <button class="menu-item" data-action="remove">
            <i class="fas fa-trash-alt"></i> Remove from queue
        </button>
        <button class="menu-item" data-action="play-next">
            <i class="fas fa-forward"></i> Play next
        </button>
        <button class="menu-item" data-action="add-to-playlist">
            <i class="fas fa-list"></i> Add to playlist
        </button>
        <hr style="margin: 4px 0; border-color: rgba(255,255,255,0.1);">
        <button class="menu-item" data-action="go-to-content">
            <i class="fas fa-external-link-alt"></i> Go to content page
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu item clicks
    menu.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = btn.dataset.action;
            
            switch(action) {
                case 'remove':
                    if (confirm(`Remove "${item.title}" from queue?`)) {
                        removeFromQueue(index);
                    }
                    break;
                case 'play-next':
                    moveToPlayNext(index);
                    break;
                case 'add-to-playlist':
                    if (window.playlistModal) {
                        window.playlistModal.contentId = item.id;
                        window.playlistModal.open();
                    } else {
                        window.showToast('Playlist system not ready', 'warning');
                    }
                    break;
                case 'go-to-content':
                    window.location.href = `content-detail.html?id=${item.id}`;
                    break;
            }
            
            menu.remove();
        });
    });
    
    // Close menu on click outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

/**
 * Remove an item from the playlist queue
 * @param {number} index - Index of item to remove
 */
function removeFromQueue(index) {
    if (!window.currentPlaylistItems || index >= window.currentPlaylistItems.length) return;
    
    const removedItem = window.currentPlaylistItems[index];
    window.currentPlaylistItems.splice(index, 1);
    
    // Adjust active index if needed
    if (index === window.currentPlaylistIndex) {
        // Currently playing item removed - play next or stop
        if (window.currentPlaylistItems.length > 0 && index < window.currentPlaylistItems.length) {
            window.playPlaylistItemByIndex(index);
        } else if (window.currentPlaylistItems.length > 0) {
            window.playPlaylistItemByIndex(window.currentPlaylistItems.length - 1);
        } else {
            // Queue empty - close player
            if (typeof window.closeVideoPlayer === 'function') window.closeVideoPlayer();
        }
    } else if (index < window.currentPlaylistIndex) {
        window.currentPlaylistIndex--;
    }
    
    // Re-render queue
    renderPlaylistQueue(window.currentPlaylistItems, window.currentPlaylistIndex);
    window.showToast(`Removed "${removedItem.title}" from queue`, 'info');
}

/**
 * Move an item to "play next" position
 * @param {number} index - Current index of item
 */
function moveToPlayNext(index) {
    if (!window.currentPlaylistItems || index >= window.currentPlaylistItems.length) return;
    if (index === window.currentPlaylistIndex + 1) {
        window.showToast('Item already next in queue', 'info');
        return;
    }
    
    const item = window.currentPlaylistItems[index];
    window.currentPlaylistItems.splice(index, 1);
    
    const newIndex = window.currentPlaylistIndex + 1;
    window.currentPlaylistItems.splice(newIndex, 0, item);
    
    renderPlaylistQueue(window.currentPlaylistItems, window.currentPlaylistIndex);
    window.showToast(`"${item.title}" will play next`, 'success');
}

/**
 * Update the active/playing state of queue items
 * @param {number} activeIndex - Currently playing item index
 */
function updatePlaylistQueueActiveItem(activeIndex) {
    const container = document.getElementById('playlistQueueList');
    if (!container) return;
    
    const items = container.querySelectorAll('.playlist-queue-item');
    items.forEach((item, idx) => {
        const isActive = (idx === activeIndex);
        if (isActive) {
            item.classList.add('active', 'playing');
            item.setAttribute('aria-current', 'true');
            // Scroll active item into view
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active', 'playing');
            item.setAttribute('aria-current', 'false');
        }
    });
    
    console.log(`🎵 Playlist queue active item updated to index ${activeIndex}`);
}

/**
 * Clear the entire playlist queue
 */
function clearPlaylistQueue() {
    if (confirm('Clear the entire queue? This cannot be undone.')) {
        window.currentPlaylistItems = [];
        window.currentPlaylistIndex = 0;
        renderPlaylistQueue([], 0);
        
        if (typeof window.closeVideoPlayer === 'function') {
            window.closeVideoPlayer();
        }
        
        window.showToast('Queue cleared', 'info');
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.renderPlaylistQueue = renderPlaylistQueue;
window.createPlaylistQueueItem = createPlaylistQueueItem;
window.updatePlaylistQueueActiveItem = updatePlaylistQueueActiveItem;
window.removeFromQueue = removeFromQueue;
window.moveToPlayNext = moveToPlayNext;
window.clearPlaylistQueue = clearPlaylistQueue;

console.log('✅ Playlist Queue Module loaded (with full brain)');
