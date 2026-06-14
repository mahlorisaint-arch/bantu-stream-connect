// js/content-detail/legacy-playlist.js
// ============================================
// LEGACY PLAYLIST MODULE - COMPLETE BRAIN
// Contains UI rendering for legacy playlist format (pre-playlist_contents junction table)
// AND its specific DOM interaction logic for backward compatibility
// ============================================
console.log('🎬 Legacy Playlist Module Loading...');

/**
 * Render legacy playlist items (from older playlist format)
 * Legacy format uses direct Content table references or nested playlist data
 * @param {Array} playlistItems - Array of content items in the legacy playlist
 * @param {number} activeIndex - Currently playing/active item index
 */
function renderLegacyPlaylistItems(playlistItems, activeIndex = 0) {
    const container = document.getElementById('legacyPlaylistContainer');
    if (!container) {
        console.warn('Legacy playlist container not found');
        return;
    }
    
    if (!playlistItems || playlistItems.length === 0) {
        container.innerHTML = `
            <div class="legacy-playlist-empty">
                <i class="fas fa-folder-open"></i>
                <p>No playlist items available</p>
            </div>
        `;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    playlistItems.forEach((item, index) => {
        const isActive = (index === activeIndex);
        const playlistItemEl = createLegacyPlaylistItem(item, index, isActive);
        fragment.appendChild(playlistItemEl);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Attach click handlers
    attachLegacyPlaylistHandlers(container);
    
    console.log(`✅ Legacy playlist rendered with ${playlistItems.length} items, active index: ${activeIndex}`);
}

/**
 * Create a single legacy playlist item DOM element
 * Legacy format has different structure than modern playlist queue
 * @param {Object} item - Content item from legacy playlist
 * @param {number} index - Position in playlist (0-based)
 * @param {boolean} isActive - Whether this item is currently playing
 * @returns {HTMLElement} - The legacy playlist item element
 */
function createLegacyPlaylistItem(item, index, isActive = false) {
    const div = document.createElement('div');
    div.className = `legacy-playlist-item ${isActive ? 'active playing' : ''}`;
    div.setAttribute('data-index', index);
    div.setAttribute('data-content-id', item.id || item.content_id);
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    
    // Handle different legacy data structures
    const title = item.title || item.content_title || item.name || 'Untitled';
    const thumbnail = item.thumbnail_url || item.thumbnail || 
                     'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=45&fit=crop';
    const duration = item.duration ? window.formatDuration(item.duration) : 
                    (item.duration_seconds ? window.formatDuration(item.duration_seconds) : '--:--');
    const creatorName = item.creator_name || item.user_profiles?.full_name || 
                       item.user_profiles?.username || 'Unknown Creator';
    
    const trackNumber = (index + 1).toString();
    
    div.innerHTML = `
        <div class="legacy-playlist-number">${trackNumber}</div>
        <div class="legacy-playlist-thumbnail">
            <img src="${thumbnail}" alt="${window.escapeHtml(title)}" loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=45&fit=crop'">
            ${isActive ? '<div class="playing-indicator"><i class="fas fa-volume-up"></i></div>' : ''}
        </div>
        <div class="legacy-playlist-info">
            <div class="legacy-playlist-title">${window.escapeHtml(window.truncateText(title, 45))}</div>
            <div class="legacy-playlist-meta">
                <span class="legacy-artist">${window.escapeHtml(window.truncateText(creatorName, 25))}</span>
                <span class="legacy-duration">${duration}</span>
            </div>
        </div>
        <div class="legacy-playlist-actions">
            <button class="legacy-play-btn" data-index="${index}" aria-label="Play">
                <i class="fas fa-play"></i>
            </button>
            <button class="legacy-remove-btn" data-index="${index}" aria-label="Remove from playlist">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    return div;
}

/**
 * Attach click handlers to legacy playlist items
 * @param {HTMLElement} container - The legacy playlist container element
 */
function attachLegacyPlaylistHandlers(container) {
    if (!container) return;
    
    // Handle playlist item clicks
    container.querySelectorAll('.legacy-playlist-item').forEach(item => {
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        // Main item click - play the track
        newItem.addEventListener('click', (e) => {
            if (e.target.closest('.legacy-play-btn') || e.target.closest('.legacy-remove-btn')) {
                return;
            }
            
            const index = parseInt(newItem.dataset.index);
            if (!isNaN(index) && typeof window.playPlaylistItemByIndex === 'function') {
                console.log(`🎵 Playing legacy playlist item at index ${index}`);
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
        
        // Play button handler
        const playBtn = newItem.querySelector('.legacy-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(playBtn.dataset.index);
                if (!isNaN(index) && typeof window.playPlaylistItemByIndex === 'function') {
                    console.log(`🎵 Playing legacy item at index ${index} via play button`);
                    window.playPlaylistItemByIndex(index);
                }
            });
        }
        
        // Remove button handler
        const removeBtn = newItem.querySelector('.legacy-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(removeBtn.dataset.index);
                removeLegacyPlaylistItem(index);
            });
        }
    });
}

/**
 * Remove an item from legacy playlist
 * @param {number} index - Index of item to remove
 */
function removeLegacyPlaylistItem(index) {
    if (!window.currentPlaylistItems || index >= window.currentPlaylistItems.length) return;
    
    const removedItem = window.currentPlaylistItems[index];
    const itemTitle = removedItem.title || removedItem.content_title || 'Untitled';
    
    if (confirm(`Remove "${itemTitle}" from playlist?`)) {
        window.currentPlaylistItems.splice(index, 1);
        
        // Adjust active index if needed
        if (index === window.currentPlaylistIndex) {
            if (window.currentPlaylistItems.length > 0 && index < window.currentPlaylistItems.length) {
                window.playPlaylistItemByIndex(index);
            } else if (window.currentPlaylistItems.length > 0) {
                window.playPlaylistItemByIndex(window.currentPlaylistItems.length - 1);
            } else {
                if (typeof window.closeVideoPlayer === 'function') window.closeVideoPlayer();
                window.showToast('Playlist empty', 'info');
            }
        } else if (index < window.currentPlaylistIndex) {
            window.currentPlaylistIndex--;
        }
        
        // Re-render legacy playlist
        renderLegacyPlaylistItems(window.currentPlaylistItems, window.currentPlaylistIndex);
        window.showToast(`Removed "${itemTitle}" from playlist`, 'info');
    }
}

/**
 * Update the active/playing state of legacy playlist items
 * @param {number} activeIndex - Currently playing item index
 */
function updateLegacyPlaylistActiveItem(activeIndex) {
    const container = document.getElementById('legacyPlaylistContainer');
    if (!container) return;
    
    const items = container.querySelectorAll('.legacy-playlist-item');
    items.forEach((item, idx) => {
        const isActive = (idx === activeIndex);
        if (isActive) {
            item.classList.add('active', 'playing');
            item.setAttribute('aria-current', 'true');
            
            // Update thumbnail indicator
            const thumbnail = item.querySelector('.legacy-playlist-thumbnail');
            if (thumbnail && !thumbnail.querySelector('.playing-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'playing-indicator';
                indicator.innerHTML = '<i class="fas fa-volume-up"></i>';
                thumbnail.appendChild(indicator);
            }
            
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active', 'playing');
            item.setAttribute('aria-current', 'false');
            
            // Remove playing indicator from thumbnail
            const indicator = item.querySelector('.playing-indicator');
            if (indicator) indicator.remove();
        }
    });
    
    console.log(`🎵 Legacy playlist active item updated to index ${activeIndex}`);
}

/**
 * Convert legacy playlist format to modern format
 * Used for migration/backward compatibility
 * @param {Array} legacyItems - Items in legacy format
 * @returns {Array} - Items in modern format
 */
function convertLegacyToModernFormat(legacyItems) {
    if (!legacyItems || !Array.isArray(legacyItems)) return [];
    
    return legacyItems.map((item, index) => {
        // Handle different legacy structures
        const modernItem = {
            id: item.id || item.content_id || item.video_id || `legacy_${index}`,
            title: item.title || item.content_title || item.name || 'Untitled',
            description: item.description || item.content_description || '',
            thumbnail_url: item.thumbnail_url || item.thumbnail || item.poster_url || null,
            file_url: item.file_url || item.video_url || item.media_url || null,
            duration: item.duration || item.duration_seconds || item.length || 0,
            user_id: item.user_id || item.creator_id || null,
            user_profiles: item.user_profiles || null,
            creator: item.creator_name || item.artist || 'Unknown Creator',
            status: item.status || 'published',
            playlist_relation: {
                sort_index: item.sort_index || index,
                item_type: item.item_type || 'content'
            }
        };
        
        // Preserve any additional metadata
        if (item.content_metadata) modernItem.content_metadata = item.content_metadata;
        if (item.playlist_relation) modernItem.playlist_relation = item.playlist_relation;
        
        return modernItem;
    });
}

/**
 * Load and render legacy playlist from URL parameters
 * Used for backward compatibility with old playlist links
 * @param {string} playlistId - Legacy playlist ID
 */
async function loadLegacyPlaylist(playlistId) {
    try {
        window.showLoading('Loading legacy playlist...');
        
        // Try to fetch from old playlist structure
        const { data: playlistData, error } = await window.supabaseClient
            .from('Content')
            .select('*')
            .eq('playlist_id', playlistId)
            .eq('status', 'published')
            .order('playlist_order', { ascending: true });
        
        if (error || !playlistData || playlistData.length === 0) {
            console.warn('No legacy playlist items found, trying fallback');
            throw new Error('No items in legacy playlist');
        }
        
        const convertedItems = convertLegacyToModernFormat(playlistData);
        
        window.currentPlaylistItems = convertedItems;
        window.currentPlaylistIndex = 0;
        
        if (convertedItems.length > 0) {
            renderLegacyPlaylistItems(convertedItems, 0);
            await window.setCurrentContent(convertedItems[0], 0);
            if (typeof window.loadContentIntoPlayer === 'function') {
                await window.loadContentIntoPlayer(convertedItems[0]);
            }
        }
        
        window.showToast('Legacy playlist loaded', 'success');
        window.hideLoading();
        
    } catch (error) {
        console.error('Failed to load legacy playlist:', error);
        window.showToast('Failed to load legacy playlist', 'error');
        window.hideLoading();
    }
}

/**
 * Check if current playlist is in legacy format
 * @returns {boolean} - True if legacy format detected
 */
function isLegacyPlaylistFormat() {
    if (!window.currentPlaylistItems || window.currentPlaylistItems.length === 0) return false;
    
    const firstItem = window.currentPlaylistItems[0];
    
    // Legacy format often missing modern fields
    const hasModernFields = firstItem && 
        (typeof firstItem.playlist_relation !== 'undefined' ||
         firstItem.user_profiles !== undefined);
    
    return !hasModernFields;
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.renderLegacyPlaylistItems = renderLegacyPlaylistItems;
window.createLegacyPlaylistItem = createLegacyPlaylistItem;
window.updateLegacyPlaylistActiveItem = updateLegacyPlaylistActiveItem;
window.removeLegacyPlaylistItem = removeLegacyPlaylistItem;
window.convertLegacyToModernFormat = convertLegacyToModernFormat;
window.loadLegacyPlaylist = loadLegacyPlaylist;
window.isLegacyPlaylistFormat = isLegacyPlaylistFormat;

console.log('✅ Legacy Playlist Module loaded (with full brain)');
