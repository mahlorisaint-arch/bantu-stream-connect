// js/my-space.js — My Space Page Logic
// Bantu Stream Connect — Continue Watching / Saved (Favorites + Playlists) / Following
//
// Wrapped in an IIFE (matching movies.js/music.js/creator-channel.js/watch-history.js)
// so this file's own SUPABASE_URL const doesn't collide with the identically-named
// const the inline <script> in my-space.html declares in global scope.
(function() {
'use strict';

console.log('🌌 My Space initializing...');

const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';

// CRITICAL: playlists (user's own saved collections) vs creator_playlists
// (a creator's own upload organization) are two separate systems. This file
// must ONLY ever query `playlists` + `playlist_items` — never
// `creator_playlists` or `playlist_contents` (which, despite its generic-
// sounding name, actually FKs to creator_playlists, confirmed via a live
// schema inspection before writing this file).

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, starting My Space initialization...');

    await checkAuth();

    if (currentUser) {
        setupTabs();
        await Promise.all([
            loadContinueWatching(),
            loadFavorites(),
            loadPlaylists(),
            loadFollowing()
        ]);
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    console.log('✅ My Space fully initialized');
});

// Direct auth pattern (matches watch-history.js) — no helper-file dependency.
async function checkAuth() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user) {
            showToast('Please sign in to view My Space', 'warning');
            setTimeout(() => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            }, 1500);
            return;
        }
        currentUser = session.user;
        console.log('✅ User authenticated:', currentUser.email);
    } catch (error) {
        console.error('Auth check failed:', error);
        showToast('Authentication error', 'error');
    }
}

// ==========================================================================
// TABS — same in-page interaction pattern as creator-channel.js's setupTabs()
// ==========================================================================
function setupTabs() {
    const tabs = document.querySelectorAll('.myspace-tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => {
                t.classList.remove('is-active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('is-active');
            tab.setAttribute('aria-selected', 'true');

            panels.forEach(panel => {
                panel.hidden = panel.dataset.panel !== target;
            });
        });
    });
}

// ==========================================================================
// CONTINUE WATCHING
// ==========================================================================
async function loadContinueWatching() {
    try {
        const { data, error } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                last_position, updated_at,
                Content!inner (
                    id, title, thumbnail_url, duration, content_format,
                    user_profiles!user_id ( full_name, username )
                )
            `)
            .eq('user_id', currentUser.id)
            .eq('is_completed', false)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        renderContinueWatching(data || []);
    } catch (error) {
        console.error('❌ Failed to load Continue Watching:', error);
        showToast('Failed to load Continue Watching', 'error');
    }
}

function renderContinueWatching(items) {
    const grid = document.getElementById('continueGrid');
    const empty = document.getElementById('continueEmpty');
    document.getElementById('continueCount').textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    if (!items.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';

        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;

        const thumbnailUrl = fixMediaUrl(content.thumbnail_url);
        const creatorName = content.user_profiles?.full_name || content.user_profiles?.username || 'Creator';
        const totalTime = formatDuration(content.duration || 0);

        return `
            <div class="space-card" data-content-id="${content.id}" tabindex="0" role="link" aria-label="${escapeHtml(content.title)}">
                <div class="space-card-thumb" style="background-image: url(${thumbnailUrl});">
                    <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                    <span class="space-card-badge is-progress"><i class="fas fa-play-circle"></i> ${progress}%</span>
                    ${content.duration ? `<span class="space-card-duration">${totalTime}</span>` : ''}
                    <div class="space-card-progress"><div class="space-card-progress-fill" style="width: ${progress}%;"></div></div>
                    <div class="space-card-play"><i class="fas fa-play"></i></div>
                </div>
                <p class="space-card-title">${escapeHtml(content.title)}</p>
                <p class="space-card-byline"><i class="fas fa-user"></i> ${escapeHtml(creatorName)}</p>
            </div>
        `;
    }).join('');

    attachCardActivation(grid, true);
}

// ==========================================================================
// SAVED — FAVORITES
// ==========================================================================
async function loadFavorites() {
    try {
        const { data, error } = await window.supabaseClient
            .from('favorites')
            .select(`
                created_at,
                Content!inner (
                    id, title, thumbnail_url, duration, content_format,
                    user_profiles!user_id ( full_name, username )
                )
            `)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderFavorites(data || []);
    } catch (error) {
        console.error('❌ Failed to load Favorites:', error);
        showToast('Failed to load Favorites', 'error');
    }
}

function renderFavorites(items) {
    const grid = document.getElementById('favoritesGrid');
    const empty = document.getElementById('favoritesEmpty');
    document.getElementById('favoritesCount').textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    if (!items.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';

        const thumbnailUrl = fixMediaUrl(content.thumbnail_url);
        const creatorName = content.user_profiles?.full_name || content.user_profiles?.username || 'Creator';
        const totalTime = formatDuration(content.duration || 0);

        return `
            <div class="space-card" data-content-id="${content.id}" tabindex="0" role="link" aria-label="${escapeHtml(content.title)}">
                <div class="space-card-thumb" style="background-image: url(${thumbnailUrl});">
                    <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                    ${content.duration ? `<span class="space-card-duration">${totalTime}</span>` : ''}
                    <div class="space-card-play"><i class="fas fa-play"></i></div>
                </div>
                <p class="space-card-title">${escapeHtml(content.title)}</p>
                <p class="space-card-byline"><i class="fas fa-user"></i> ${escapeHtml(creatorName)}</p>
            </div>
        `;
    }).join('');

    attachCardActivation(grid, false);
}

function attachCardActivation(grid, resumable) {
    grid.querySelectorAll('.space-card').forEach(card => {
        const activate = () => {
            const contentId = card.dataset.contentId;
            window.location.href = `content-detail.html?id=${contentId}${resumable ? '&resume=true' : ''}`;
        };
        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    });
}

// ==========================================================================
// SAVED — PLAYLISTS (user's own `playlists` table — NEVER creator_playlists)
// Junction table confirmed via live schema inspection: `playlist_items`
// (playlist_id -> playlists.id, content_id -> Content.id). The similarly-
// named `playlist_contents` table was checked and rejected — its playlist_id
// FKs to creator_playlists, not playlists.
// Display-only in this pass: no create/edit flow, no click-through into a
// playlist's contents yet (there's no playlist-detail screen to link to).
// ==========================================================================
async function loadPlaylists() {
    try {
        const { data: playlists, error } = await window.supabaseClient
            .from('playlists')
            .select('id, name, description, custom_thumbnail_url, total_duration, play_count, updated_at')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        const itemCounts = await fetchPlaylistItemCounts((playlists || []).map(p => p.id));
        renderPlaylists(playlists || [], itemCounts);
    } catch (error) {
        console.error('❌ Failed to load Playlists:', error);
        showToast('Failed to load Playlists', 'error');
    }
}

// Batch-fetch item counts per playlist from the real junction table and
// count client-side (same batch-fetch-and-merge pattern used platform-wide
// for content_engagement_stats).
async function fetchPlaylistItemCounts(playlistIds) {
    const counts = new Map();
    if (!playlistIds.length) return counts;

    const { data, error } = await window.supabaseClient
        .from('playlist_items')
        .select('playlist_id')
        .in('playlist_id', playlistIds);

    if (error) {
        console.warn('Could not load playlist item counts (non-fatal):', error);
        return counts;
    }

    (data || []).forEach(row => {
        counts.set(row.playlist_id, (counts.get(row.playlist_id) || 0) + 1);
    });
    return counts;
}

function renderPlaylists(playlists, itemCounts) {
    const grid = document.getElementById('playlistsGrid');
    const empty = document.getElementById('playlistsEmpty');
    document.getElementById('playlistsCount').textContent = `${playlists.length} item${playlists.length !== 1 ? 's' : ''}`;

    if (!playlists.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = playlists.map(playlist => {
        const count = itemCounts.get(playlist.id) || 0;
        const thumb = playlist.custom_thumbnail_url ? fixMediaUrl(playlist.custom_thumbnail_url) : '';

        return `
            <div class="playlist-card">
                <div class="playlist-card-thumb" ${thumb ? `style="background-image: url(${thumb});"` : ''}>
                    ${!thumb ? `<div class="playlist-icon-placeholder"><i class="fas fa-list"></i></div>` : ''}
                    <span class="playlist-card-count"><i class="fas fa-layer-group"></i> ${count} item${count !== 1 ? 's' : ''}</span>
                </div>
                <div class="playlist-card-body">
                    <p class="playlist-card-title">${escapeHtml(playlist.name || 'Untitled Playlist')}</p>
                    <p class="playlist-card-meta">${escapeHtml(playlist.description || 'No description')}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// FOLLOWING (connectors, connection_type = 'creator')
// ==========================================================================
async function loadFollowing() {
    try {
        const { data, error } = await window.supabaseClient
            .from('connectors')
            .select(`
                connected_id, created_at,
                user_profiles!connected_id ( id, full_name, username, avatar_url, bio )
            `)
            .eq('connector_id', currentUser.id)
            .eq('connection_type', 'creator')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const verification = await fetchVerificationStatus((data || []).map(r => r.connected_id));
        renderFollowing(data || [], verification);
    } catch (error) {
        console.error('❌ Failed to load Following:', error);
        showToast('Failed to load Following', 'error');
    }
}

// Batch-fetch verified/founder status from the real `creators` table (matches
// the enrichWithVerification() pattern already established on explore-screen.js).
async function fetchVerificationStatus(creatorIds) {
    const status = new Map();
    if (!creatorIds.length) return status;

    const { data, error } = await window.supabaseClient
        .from('creators')
        .select('id, is_verified, is_creator_verified, is_founder')
        .in('id', creatorIds);

    if (error) {
        console.warn('Could not load verification status (non-fatal):', error);
        return status;
    }

    (data || []).forEach(row => {
        status.set(row.id, {
            isVerified: row.is_verified || row.is_creator_verified || false,
            isFounder: row.is_founder || false
        });
    });
    return status;
}

function renderFollowing(items, verification) {
    const grid = document.getElementById('followingGrid');
    const empty = document.getElementById('followingEmpty');
    document.getElementById('followingCount').textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    if (!items.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }
    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = items.map(item => {
        const profile = item.user_profiles;
        if (!profile) return '';

        const status = verification.get(profile.id);
        const badge = status?.isFounder
            ? '<i class="fas fa-circle-check verified-badge" title="Verified founder"></i>'
            : status?.isVerified
                ? '<i class="fas fa-circle-check verified-badge" title="Verified creator"></i>'
                : '';
        const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.username || 'Creator')}&background=F59E0B&color=0A0E12&bold=true`;

        return `
            <div class="following-card" data-creator-id="${profile.id}">
                <div class="following-card-header">
                    <img class="following-card-avatar" src="${profile.avatar_url || avatarFallback}" onerror="this.onerror=null;this.src='${avatarFallback}';" alt="${escapeHtml(profile.full_name || profile.username)}">
                    <div>
                        <div class="following-card-name">${escapeHtml(profile.full_name || profile.username || 'Creator')}${badge}</div>
                    </div>
                </div>
                ${profile.bio ? `<p class="following-card-bio">${escapeHtml(profile.bio)}</p>` : ''}
                <div class="following-card-actions">
                    <button class="disconnect-btn" data-creator-id="${profile.id}"><i class="fas fa-user-times"></i> Disconnect</button>
                    <a class="view-channel-btn" href="creator-channel.html?id=${profile.id}"><i class="fas fa-tv"></i> View Channel</a>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.disconnect-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDisconnect(btn.dataset.creatorId, btn));
    });
}

// Replicates discover-creator.html's handleConnect() delete branch exactly —
// same table (`connectors`), same match keys.
async function handleDisconnect(creatorId, btn) {
    try {
        const { error } = await window.supabaseClient
            .from('connectors')
            .delete()
            .eq('connector_id', currentUser.id)
            .eq('connected_id', creatorId)
            .eq('connection_type', 'creator');

        if (error) throw error;

        showToast('Disconnected', 'info');
        const card = btn.closest('.following-card');
        card?.remove();

        const remaining = document.querySelectorAll('.following-card').length;
        document.getElementById('followingCount').textContent = `${remaining} item${remaining !== 1 ? 's' : ''}`;
        if (remaining === 0) {
            document.getElementById('followingGrid').style.display = 'none';
            document.getElementById('followingEmpty').style.display = 'flex';
        }
    } catch (error) {
        console.error('❌ Failed to disconnect:', error);
        showToast('Could not disconnect', 'error');
    }
}

// ==========================================================================
// UTILITIES (per-page copies, matching watch-history.js's established pattern)
// ==========================================================================
function fixMediaUrl(url) {
    const fallback = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    if (!url || typeof url !== 'string') return fallback;
    const clean = url.trim().replace(/^`+|`+$/g, '').replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    if (clean.startsWith('http')) return clean;
    return `${SUPABASE_URL}/storage/v1/object/public/${clean.replace(/^\/+/, '')}`;
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        error: 'fa-exclamation-triangle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

})();
