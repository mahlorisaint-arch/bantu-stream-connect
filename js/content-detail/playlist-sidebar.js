// js/content-detail/playlist-sidebar.js
// Extracted from content-detail.js - YouTube-Style Persistent Playlist Sidebar

console.log('📀 Playlist Sidebar module loading...');

// ============================================
// GLOBAL PLAYLIST STATE
// ============================================
let albumTracksRendered = false;
let albumSidebarInitialized = false;
let isAlbumExpanded = false;

// ============================================
// PERSISTENT TRACKLIST RENDER - ONCE ONLY
// ============================================
function renderAlbumTracks(tracks = []) {
    const container = document.getElementById('album-track-list');
    if (!container) {
        console.error('❌ Album track list container missing from DOM');
        return;
    }
    
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
    
    const sortedTracks = [...tracks].sort((a, b) => {
        const orderA = a.playlist_relation?.sort_index || a.sort_index || 0;
        const orderB = b.playlist_relation?.sort_index || b.sort_index || 0;
        return orderA - orderB;
    });
    
    container.innerHTML = sortedTracks.map((item, index) => `
        <button class="album-track-item ${window.currentContent?.id === item.id ? 'active playing' : ''}" 
                data-index="${index}" 
                data-content-id="${item.id}"
                type="button">
            <span class="track-num">${index + 1}</span>
            <span class="track-title">${escapeHtml(item.title || 'Untitled')}</span>
            <span class="track-duration">${formatDuration(item.duration || 0)}</span>
        </button>
    `).join('');
    
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

// ============================================
// TOGGLE FUNCTION - CSS CLASS ONLY
// ============================================
function toggleAlbumTracklist() {
    const sidebar = document.getElementById('album-sidebar');
    if (!sidebar) {
        console.error('❌ Album sidebar missing from DOM');
        return;
    }
    
    const isExpanded = sidebar.classList.contains('expanded');
    if (isExpanded) {
        sidebar.classList.remove('expanded');
        isAlbumExpanded = false;
        console.log('📀 Album collapsed');
    } else {
        sidebar.classList.add('expanded');
        isAlbumExpanded = true;
        console.log('📀 Album expanded');
    }
}

// ============================================
// SETUP ALBUM TOGGLE - ONE TIME
// ============================================
function setupAlbumToggle() {
    if (albumSidebarInitialized) {
        console.log('⚠️ Album toggle already initialized');
        return;
    }
    
    albumSidebarInitialized = true;
    
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
    
    // Remove existing listeners and clone to avoid duplicates
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
    
    newToggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAlbumTracklist();
    });
    
    // Restore expanded state from global variable
    if (isAlbumExpanded && window.currentPlaylistItems?.length) {
        sidebar.classList.add('expanded');
    }
    
    console.log('✅ Album toggle initialized (YouTube-style)');
}

// ============================================
// CENTRALIZED PLAYLIST UI SYNC FUNCTION
// ============================================
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
    
    // Ensure global contentId is synced
    if (typeof updateGlobalContentId === 'function') {
        updateGlobalContentId(currentItem.id);
    }
    
    // Update sidebar tracklist active state
    document.querySelectorAll('.album-track-item').forEach(track => {
        track.classList.remove('active', 'playing');
    });
    
    const activeTrack = document.querySelector(`.album-track-item[data-index="${window.currentPlaylistIndex}"]`);
    if (activeTrack) {
        activeTrack.classList.add('active', 'playing');
        activeTrack.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update content UI
    if (typeof updateContentUI === 'function') {
        updateContentUI(currentItem);
    } else if (typeof updateContentDetails === 'function') {
        updateContentDetails(currentItem);
    }
    
    // Update play button visibility
    const playAlbumBtn = document.getElementById('playAlbumBtn');
    if (playAlbumBtn) {
        playAlbumBtn.style.display = 'none';
    }
    
    document.body.classList.add('playlist-playing');
    
    // Load engagement states for new playlist item
    if (window.currentUserId && currentItem.id && typeof loadAllEngagementStates === 'function') {
        loadAllEngagementStates(currentItem.id, window.currentUserId).then(states => {
            if (typeof updateEngagementUI === 'function') {
                updateEngagementUI(states);
            }
        });
    }
    
    console.log(`✅ UI Refreshed: Track [${window.currentPlaylistIndex + 1}] - ${currentItem.title} (contentId: ${window.currentContentId})`);
}

// ============================================
// UPDATE ACTIVE TRACK IN SIDEBAR
// ============================================
function updateActiveTrackInSidebar(contentId) {
    const container = document.getElementById('album-track-list');
    if (!container) return;
    
    container.querySelectorAll('.album-track-item').forEach(item => {
        if (item.dataset.contentId === String(contentId)) {
            item.classList.add('playing', 'active');
        } else {
            item.classList.remove('playing', 'active');
        }
    });
}

// ============================================
// RESET ALBUM RENDERED FLAG (for new playlists)
// ============================================
function resetAlbumRenderedFlag() {
    albumTracksRendered = false;
    console.log('🔄 Album rendered flag reset');
}

// ============================================
// COLLAPSE ALBUM SIDEBAR
// ============================================
function collapseAlbumSidebar() {
    const sidebar = document.getElementById('album-sidebar');
    if (sidebar) {
        sidebar.classList.remove('expanded');
        isAlbumExpanded = false;
        console.log('📀 Album sidebar collapsed');
    }
}

// ============================================
// EXPAND ALBUM SIDEBAR
// ============================================
function expandAlbumSidebar() {
    const sidebar = document.getElementById('album-sidebar');
    if (sidebar) {
        sidebar.classList.add('expanded');
        isAlbumExpanded = true;
        console.log('📀 Album sidebar expanded');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.renderAlbumTracks = renderAlbumTracks;
window.toggleAlbumTracklist = toggleAlbumTracklist;
window.setupAlbumToggle = setupAlbumToggle;
window.syncPlaylistUI = syncPlaylistUI;
window.updateActiveTrackInSidebar = updateActiveTrackInSidebar;
window.resetAlbumRenderedFlag = resetAlbumRenderedFlag;
window.collapseAlbumSidebar = collapseAlbumSidebar;
window.expandAlbumSidebar = expandAlbumSidebar;

console.log('✅ Playlist Sidebar module loaded');
