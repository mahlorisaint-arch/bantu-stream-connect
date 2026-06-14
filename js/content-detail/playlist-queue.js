// js/content-detail/playlist-queue.js
// Extracted from content-detail.js - Playlist Queue Section Management

console.log('🎵 Playlist Queue module loading...');

// ============================================
// RENDER PLAYLIST QUEUE
// ============================================
function renderPlaylistQueue(items) {
    const container = document.getElementById('playlistQueue');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-playlist">
                <i class="fas fa-music"></i>
                <p>No tracks in queue</p>
            </div>
        `;
        return;
    }
    
    const section = document.getElementById('playlistQueueSection');
    if (section) {
        section.style.display = 'block';
    }
    
    container.innerHTML = items.map((item, index) => `
        <div class="playlist-queue-item ${window.currentPlaylistIndex === index ? 'active playing' : ''}" 
             data-index="${index}" 
             data-content-id="${item.id}">
            <div class="queue-item-number">${index + 1}</div>
            <div class="queue-item-thumbnail">
                <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=80&fit=crop'}" 
                     alt="${escapeHtml(item.title)}"
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=80&fit=crop'">
                ${window.currentPlaylistIndex === index ? '<div class="playing-indicator"><i class="fas fa-volume-up"></i></div>' : ''}
            </div>
            <div class="queue-item-info">
                <div class="queue-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                <div class="queue-item-creator">${escapeHtml(item.creator_display_name || item.user_profiles?.full_name || 'Creator')}</div>
            </div>
            <div class="queue-item-duration">${formatDuration(item.duration || 0)}</div>
            <button class="queue-item-play-btn" data-index="${index}" aria-label="Play">
                <i class="fas fa-play"></i>
            </button>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.playlist-queue-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.queue-item-play-btn')) return;
            const index = parseInt(item.dataset.index);
            if (typeof window.playPlaylistItemByIndex === 'function') {
                window.playPlaylistItemByIndex(index);
            }
        });
    });
    
    container.querySelectorAll('.queue-item-play-btn').forEach(btn => {
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
// UPDATE PLAYLIST QUEUE ACTIVE ITEM
// ============================================
function updatePlaylistQueueActiveItem(contentId) {
    const container = document.getElementById('playlistQueue');
    if (!container) return;
    
    container.querySelectorAll('.playlist-queue-item').forEach(item => {
        if (item.dataset.contentId === String(contentId)) {
            item.classList.add('active', 'playing');
            
            // Update playing indicator
            const existingIndicator = item.querySelector('.playing-indicator');
            if (!existingIndicator) {
                const thumbnail = item.querySelector('.queue-item-thumbnail');
                if (thumbnail) {
                    const indicator = document.createElement('div');
                    indicator.className = 'playing-indicator';
                    indicator.innerHTML = '<i class="fas fa-volume-up"></i>';
                    thumbnail.appendChild(indicator);
                }
            }
        } else {
            item.classList.remove('active', 'playing');
            const indicator = item.querySelector('.playing-indicator');
            if (indicator) indicator.remove();
        }
    });
}

// ============================================
// HIDE PLAYLIST QUEUE SECTION
// ============================================
function hidePlaylistQueueSection() {
    const section = document.getElementById('playlistQueueSection');
    if (section) {
        section.style.display = 'none';
    }
}

// ============================================
// SHOW PLAYLIST QUEUE SECTION
// ============================================
function showPlaylistQueueSection() {
    const section = document.getElementById('playlistQueueSection');
    if (section) {
        section.style.display = 'block';
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
window.renderPlaylistQueue = renderPlaylistQueue;
window.updatePlaylistQueueActiveItem = updatePlaylistQueueActiveItem;
window.hidePlaylistQueueSection = hidePlaylistQueueSection;
window.showPlaylistQueueSection = showPlaylistQueueSection;

console.log('✅ Playlist Queue module loaded');
