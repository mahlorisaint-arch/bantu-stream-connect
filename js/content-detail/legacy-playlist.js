// js/content-detail/legacy-playlist.js
// Extracted from content-detail.js - Legacy Playlist Section Management

console.log('📀 Legacy Playlist module loading...');

// ============================================
// RENDER LEGACY PLAYLIST ITEMS
// ============================================
function renderLegacyPlaylistItems(items) {
    const container = document.getElementById('playlistItems');
    if (!container) return;
    
    const section = document.getElementById('playlistSection');
    if (!section) return;
    
    if (!items || items.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    container.innerHTML = items.map((item, index) => `
        <div class="playlist-item ${window.currentPlaylistIndex === index ? 'active' : ''}" 
             data-index="${index}" 
             data-content-id="${item.id}">
            <div class="playlist-item-number">${index + 1}</div>
            <div class="playlist-item-thumb">
                <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=60&h=60&fit=crop'}" 
                     alt="${escapeHtml(item.title)}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=60&h=60&fit=crop'">
                ${window.currentPlaylistIndex === index ? '<div class="play-now-indicator"><i class="fas fa-play"></i></div>' : ''}
            </div>
            <div class="playlist-item-info">
                <div class="playlist-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                <div class="playlist-item-meta">
                    <span>${formatDuration(item.duration || 0)}</span>
                </div>
            </div>
            <button class="playlist-item-play" data-index="${index}" aria-label="Play">
                <i class="fas fa-play-circle"></i>
            </button>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-item-play')) return;
            const index = parseInt(item.dataset.index);
            if (typeof window.playPlaylistItemByIndex === 'function') {
                window.playPlaylistItemByIndex(index);
            }
        });
    });
    
    container.querySelectorAll('.playlist-item-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            if (typeof window.playPlaylistItemByIndex === 'function') {
                window.playPlaylistItemByIndex(index);
            }
        });
    });
    
    // Update metadata
    const totalItemsSpan = document.getElementById('playlistTotalItems');
    if (totalItemsSpan) {
        totalItemsSpan.textContent = `${items.length} items`;
    }
}

// ============================================
// UPDATE LEGACY PLAYLIST ACTIVE ITEM
// ============================================
function updateLegacyPlaylistActiveItem(contentId) {
    const container = document.getElementById('playlistItems');
    if (!container) return;
    
    container.querySelectorAll('.playlist-item').forEach(item => {
        if (item.dataset.contentId === String(contentId)) {
            item.classList.add('active');
            
            // Update playing indicator
            const thumb = item.querySelector('.playlist-item-thumb');
            if (thumb && !thumb.querySelector('.play-now-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'play-now-indicator';
                indicator.innerHTML = '<i class="fas fa-play"></i>';
                thumb.appendChild(indicator);
            }
        } else {
            item.classList.remove('active');
            const indicator = item.querySelector('.play-now-indicator');
            if (indicator) indicator.remove();
        }
    });
}

// ============================================
// HIDE LEGACY PLAYLIST SECTION
// ============================================
function hideLegacyPlaylistSection() {
    const section = document.getElementById('playlistSection');
    if (section) {
        section.style.display = 'none';
    }
}

// ============================================
// SHOW LEGACY PLAYLIST SECTION
// ============================================
function showLegacyPlaylistSection() {
    const section = document.getElementById('playlistSection');
    if (section) {
        section.style.display = 'block';
    }
}

// ============================================
// CLEAR LEGACY PLAYLIST
// ============================================
function clearLegacyPlaylist() {
    const container = document.getElementById('playlistItems');
    if (container) {
        container.innerHTML = '';
    }
    hideLegacyPlaylistSection();
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
window.renderLegacyPlaylistItems = renderLegacyPlaylistItems;
window.updateLegacyPlaylistActiveItem = updateLegacyPlaylistActiveItem;
window.hideLegacyPlaylistSection = hideLegacyPlaylistSection;
window.showLegacyPlaylistSection = showLegacyPlaylistSection;
window.clearLegacyPlaylist = clearLegacyPlaylist;

console.log('✅ Legacy Playlist module loaded');
