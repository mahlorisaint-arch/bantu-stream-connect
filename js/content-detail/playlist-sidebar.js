// js/content-detail/playlist-sidebar.js
// ============================================
// PLAYLIST SIDEBAR MODULE - COMPLETE BRAIN
// Contains UI rendering for album/sidebar tracklist (YouTube-style persistent sidebar)
// AND its specific DOM interaction logic (toggle, track click, active highlighting)
// ============================================
console.log('🎬 Playlist Sidebar Module Loading...');

// Module state
let albumTracksRendered = false;
let albumSidebarInitialized = false;
let isAlbumExpanded = false;

/**
 * Render album tracks into the persistent sidebar
 * This renders ONCE and never re-renders (YouTube-style architecture)
 * @param {Array} tracks - Array of content items in the playlist/album
 */
function renderAlbumTracks(tracks = []) {
    const container = document.getElementById('album-track-list');
    if (!container) {
        console.error('❌ Album track list container missing from DOM');
        return;
    }
    
    // 🚨 CRITICAL: Only render once - YouTube-style persistent DOM
    if (albumTracksRendered) {
        console.log('⚠️ Album tracks already rendered, skipping destructive re-render');
        return;
    }
    
    if (!tracks || !tracks.length) {
        console.warn('⚠️ No tracks available to render');
        container.innerHTML = `
            <div class="empty-playlist">
                <i class="fas fa-music"></i>
                <p>No tracks available</p>
            </div>
        `;
        return;
    }
    
    // Sort tracks by sort_index (from playlist_relation)
    const sortedTracks = [...tracks].sort((a, b) => {
        const orderA = a.playlist_relation?.sort_index || a.sort_index || 0;
        const orderB = b.playlist_relation?.sort_index || b.sort_index || 0;
        return orderA - orderB;
    });
    
    // Build the tracklist HTML
    container.innerHTML = sortedTracks.map((item, index) => `
        <button class="album-track-item ${window.currentContent?.id === item.id ? 'active playing' : ''}" 
                data-index="${index}" 
                data-content-id="${item.id}"
                type="button"
                aria-label="Play track ${index + 1}: ${window.escapeHtml(item.title || 'Untitled')}">
            <span class="track-num">${(index + 1).toString().padStart(2, '0')}</span>
            <span class="track-title">${window.escapeHtml(item.title || 'Untitled')}</span>
            <span class="track-duration">${window.formatDuration(item.duration || 0)}</span>
        </button>
    `).join('');
    
    // Attach click handlers to tracks
    container.querySelectorAll('.album-track-item').forEach(trackItem => {
        trackItem.addEventListener('click', async (event) => {
            event.stopPropagation();
            const index = Number(trackItem.dataset.index);
            console.log('🎵 Playing album track:', index);
            
            if (typeof window.playPlaylistItemByIndex === 'function') {
                await window.playPlaylistItemByIndex(index);
            }
        });
    });
    
    albumTracksRendered = true;
    console.log(`✅ Album tracklist rendered (once): ${sortedTracks.length} tracks`);
}

/**
 * Toggle album tracklist visibility (YouTube-style CSS class toggle)
 * Uses CSS classes, NOT display:none - preserves DOM state
 */
function toggleAlbumTracklist() {
    const sidebar = document.getElementById('album-sidebar');
    if (!sidebar) {
        console.error('❌ Album sidebar missing from DOM');
        return;
    }
    
    const toggleBtn = document.getElementById('albumToggleBtn');
    const isExpanded = sidebar.classList.contains('expanded');
    
    if (isExpanded) {
        sidebar.classList.remove('expanded');
        isAlbumExpanded = false;
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show Tracklist';
        }
        console.log('📀 Album collapsed');
    } else {
        sidebar.classList.add('expanded');
        isAlbumExpanded = true;
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Tracklist';
        }
        console.log('📀 Album expanded');
    }
}

/**
 * Setup album toggle button (ONE TIME ONLY - YouTube-style)
 * Prevents duplicate initialization and event listener stacking
 */
function setupAlbumToggle() {
    if (albumSidebarInitialized) {
        console.log('⚠️ Album toggle already initialized, skipping');
        return;
    }
    
    const toggleBtn = document.getElementById('albumToggleBtn');
    const sidebar = document.getElementById('album-sidebar');
    
    if (!toggleBtn) {
        console.warn('⚠️ Album toggle button not found');
        return;
    }
    
    if (!sidebar) {
        console.warn('⚠️ Album sidebar not found');
        return;
    }
    
    // Clone and replace to remove any existing listeners
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    // Set initial ARIA attributes
    newToggleBtn.setAttribute('aria-expanded', 'false');
    newToggleBtn.setAttribute('aria-label', 'Toggle tracklist');
    
    // Add click handler
    newToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAlbumTracklist();
    });
    
    albumSidebarInitialized = true;
    console.log('✅ Album toggle initialized (YouTube-style, one-time only)');
}

/**
 * Sync playlist UI - updates active track highlighting and content details
 * Called after playlist navigation or track changes
 */
function syncPlaylistUI() {
    if (!window.currentPlaylistItems || window.currentPlaylistItems.length === 0) {
        console.warn('⚠️ syncPlaylistUI: No playlist items available');
        return;
    }
    
    const currentItem = window.currentPlaylistItems[window.currentPlaylistIndex];
    if (!currentItem) {
        console.warn('⚠️ syncPlaylistUI: No current item at index', window.currentPlaylistIndex);
        return;
    }
    
    // Update global contentId
    if (typeof window.updateGlobalContentId === 'function') {
        window.updateGlobalContentId(currentItem.id);
    }
    
    // Update tracklist highlighting
    document.querySelectorAll('.album-track-item').forEach(track => {
        track.classList.remove('active', 'playing');
    });
    
    const activeTrack = document.querySelector(`.album-track-item[data-index="${window.currentPlaylistIndex}"]`);
    if (activeTrack) {
        activeTrack.classList.add('active', 'playing');
        activeTrack.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update content UI
    if (typeof window.updateContentDetails === 'function') {
        window.updateContentDetails(currentItem);
    } else if (typeof window.updateContentUI === 'function') {
        window.updateContentUI(currentItem);
    }
    
    // Update play button visibility
    const playAlbumBtn = document.getElementById('playAlbumBtn');
    if (playAlbumBtn) {
        playAlbumBtn.style.display = 'none';
    }
    
    document.body.classList.add('playlist-playing');
    
    // Reload engagement states for new playlist item
    if (window.currentUserId && currentItem.id && typeof window.loadAllEngagementStates === 'function') {
        window.loadAllEngagementStates(currentItem.id, window.currentUserId).then(states => {
            if (typeof window.updateEngagementUI === 'function') {
                window.updateEngagementUI(states);
            }
        });
    }
    
    console.log(`✅ UI Synced: Track [${window.currentPlaylistIndex + 1}] - ${currentItem.title} (contentId: ${window.currentContentId})`);
}

/**
 * Update active track in sidebar when playing from other sources
 * @param {string|number} contentId - The content ID to highlight
 */
function updateActiveTrackInSidebar(contentId) {
    const container = document.getElementById('album-track-list');
    if (!container) return;
    
    container.querySelectorAll('.album-track-item').forEach(item => {
        if (item.dataset.contentId === String(contentId)) {
            item.classList.add('playing', 'active');
            item.setAttribute('aria-current', 'true');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('playing', 'active');
            item.setAttribute('aria-current', 'false');
        }
    });
}

/**
 * Reset album rendering state (used when loading new playlist)
 * Allows a new playlist to render its tracks
 */
function resetAlbumRenderState() {
    albumTracksRendered = false;
    console.log('🔄 Album render state reset');
}

/**
 * Expand album tracklist programmatically
 */
function expandAlbumTracklist() {
    const sidebar = document.getElementById('album-sidebar');
    if (sidebar && !sidebar.classList.contains('expanded')) {
        toggleAlbumTracklist();
    }
}

/**
 * Collapse album tracklist programmatically
 */
function collapseAlbumTracklist() {
    const sidebar = document.getElementById('album-sidebar');
    if (sidebar && sidebar.classList.contains('expanded')) {
        toggleAlbumTracklist();
    }
}

/**
 * Get current expansion state of album sidebar
 * @returns {boolean} - True if expanded
 */
function getAlbumExpandedState() {
    const sidebar = document.getElementById('album-sidebar');
    return sidebar ? sidebar.classList.contains('expanded') : isAlbumExpanded;
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.renderAlbumTracks = renderAlbumTracks;
window.toggleAlbumTracklist = toggleAlbumTracklist;
window.setupAlbumToggle = setupAlbumToggle;
window.syncPlaylistUI = syncPlaylistUI;
window.updateActiveTrackInSidebar = updateActiveTrackInSidebar;
window.resetAlbumRenderState = resetAlbumRenderState;
window.expandAlbumTracklist = expandAlbumTracklist;
window.collapseAlbumTracklist = collapseAlbumTracklist;
window.getAlbumExpandedState = getAlbumExpandedState;

console.log('✅ Playlist Sidebar Module loaded (YouTube-style persistent sidebar)');
