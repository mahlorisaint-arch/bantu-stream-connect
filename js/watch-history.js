// js/watch-history.js — Watch History Page Logic
// Bantu Stream Connect — Shows all watched content with filters

console.log('📜 Watch History initializing...');

const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';

// Global state
let currentUser = null;
let watchHistory = [];
let isLoading = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, starting Watch History initialization...');

    await checkAuth();

    setupEventListeners();

    if (currentUser) {
        await loadWatchHistory();
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    console.log('✅ Watch History fully initialized');
});

// Check authentication - direct pattern, no helper-file dependency (the old
// waitForHelpers() polled window.SupabaseHelper/window.AuthHelper, which
// aren't part of the current shared architecture; if those flags never
// materialized, the loading screen would spin forever).
async function checkAuth() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session?.user) {
            showToast('Please sign in to view your watch history', 'warning');
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

// Setup event listeners
function setupEventListeners() {
    // Filter changes
    document.getElementById('sortFilter')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('timeFilter')?.addEventListener('change', applyFilters);

    // Clear history button
    document.getElementById('clearHistoryBtn')?.addEventListener('click', confirmClearHistory);
}

// Load watch history from database
async function loadWatchHistory() {
    if (!currentUser) return;

    isLoading = true;
    showLoading(true);

    try {
        // Fetch watch progress with content details
        const { data, error } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                *,
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
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        watchHistory = data || [];

        // Calculate stats
        calculateStats();

        // Apply filters and render
        applyFilters();

        // Update UI
        updateHistoryCount();

        // Show/hide empty state
        toggleEmptyState();

        console.log(`✅ Loaded ${watchHistory.length} history items`);

    } catch (error) {
        console.error('❌ Failed to load watch history:', error);
        showToast('Failed to load watch history', 'error');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// Calculate watch time stats
function calculateStats() {
    let totalSeconds = 0;
    let completed = 0;

    watchHistory.forEach(item => {
        totalSeconds += item.total_watch_time || 0;
        if (item.is_completed) completed++;
    });

    // Update stat cards
    document.getElementById('totalWatchTime').textContent = formatWatchTime(totalSeconds);
    document.getElementById('totalVideos').textContent = watchHistory.length;
    document.getElementById('completedCount').textContent = completed;
}

// Format total watch time
function formatWatchTime(seconds) {
    if (!seconds || seconds <= 0) return '0h 0m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Apply filters and re-render
function applyFilters() {
    const sortBy = document.getElementById('sortFilter')?.value || 'recent';
    const status = document.getElementById('statusFilter')?.value || 'all';
    const timePeriod = document.getElementById('timeFilter')?.value || 'all';

    let filtered = [...watchHistory];

    // Filter by status
    if (status !== 'all') {
        filtered = filtered.filter(item =>
            status === 'completed' ? item.is_completed : !item.is_completed
        );
    }

    // Filter by time period
    if (timePeriod !== 'all') {
        const now = new Date();
        let cutoff;

        switch(timePeriod) {
            case 'today':
                cutoff = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                cutoff = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                cutoff = new Date(now.setMonth(now.getMonth() - 1));
                break;
        }

        if (cutoff) {
            filtered = filtered.filter(item =>
                new Date(item.updated_at) >= cutoff
            );
        }
    }

    // Sort
    switch(sortBy) {
        case 'recent':
            filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            break;
        case 'oldest':
            filtered.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
            break;
        case 'duration':
            filtered.sort((a, b) => (b.total_watch_time || 0) - (a.total_watch_time || 0));
            break;
        case 'title':
            filtered.sort((a, b) =>
                (a.Content?.title || '').localeCompare(b.Content?.title || '')
            );
            break;
    }

    // Render
    renderHistoryGrid(filtered);
}

// Render history grid — Music-style card markup (see css/watch-history/watch-history.css,
// a 1:1 rename of css/music/music.css's .continue-card pattern).
function renderHistoryGrid(items) {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';

        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;

        const thumbnailUrl = fixMediaUrl(content.thumbnail_url);
        const creatorName = content.user_profiles?.full_name || content.user_profiles?.username || 'Creator';
        const lastWatched = formatTimeAgo(item.updated_at);
        const timeWatched = formatDuration(item.last_position || 0);
        const totalTime = formatDuration(content.duration || 0);

        const badge = item.is_completed
            ? `<span class="history-card-badge is-completed"><i class="fas fa-check"></i> Completed</span>`
            : `<span class="history-card-badge is-progress"><i class="fas fa-play-circle"></i> ${progress}%</span>`;

        return `
            <div class="history-card" data-content-id="${content.id}" data-resume="${item.last_position > 10 ? 'true' : 'false'}" tabindex="0" role="link" aria-label="${escapeHtml(content.title)}">
                <div class="history-card-thumb" style="background-image: url(${thumbnailUrl});">
                    <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                    ${badge}
                    ${content.duration ? `<span class="history-card-duration">${totalTime}</span>` : ''}
                    <div class="history-card-progress">
                        <div class="history-card-progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="history-card-play"><i class="fas fa-play"></i></div>
                </div>
                <p class="history-card-title">${escapeHtml(content.title)}</p>
                <p class="history-card-byline"><i class="fas fa-user"></i> ${escapeHtml(creatorName)}</p>
                <p class="history-card-meta">
                    <span><i class="fas fa-clock"></i> ${timeWatched} / ${totalTime}</span>
                    <span class="meta-divider">·</span>
                    <span>${lastWatched}</span>
                    <span class="meta-divider">·</span>
                    <span>${escapeHtml(content.genre || 'General')}</span>
                </p>
            </div>
        `;
    }).join('');

    // Click + keyboard activation (matches the pattern established on Movies' cards)
    grid.querySelectorAll('.history-card').forEach(card => {
        const activate = () => {
            const contentId = card.dataset.contentId;
            const resume = card.dataset.resume === 'true';
            if (window.track?.historyClick) {
                window.track.historyClick(contentId);
            }
            window.location.href = `content-detail.html?id=${contentId}${resume ? '&resume=true' : ''}`;
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

// Update history count display
function updateHistoryCount() {
    const countEl = document.getElementById('historyCount');
    if (countEl) {
        countEl.textContent = `${watchHistory.length} item${watchHistory.length !== 1 ? 's' : ''}`;
    }
}

// Toggle empty state visibility
function toggleEmptyState() {
    const grid = document.getElementById('historyGrid');
    const emptyState = document.getElementById('emptyState');

    if (!grid || !emptyState) return;

    if (watchHistory.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText && show) {
        loadingText.textContent = 'Loading your watch history...';
    }
}

// Confirm and clear history
async function confirmClearHistory() {
    if (!currentUser) return;

    const confirmed = confirm('Are you sure you want to clear your entire watch history? This cannot be undone.');
    if (!confirmed) return;

    try {
        showLoading(true);

        // Delete all watch progress for this user
        const { error } = await window.supabaseClient
            .from('watch_progress')
            .delete()
            .eq('user_id', currentUser.id);

        if (error) throw error;

        // Clear local state
        watchHistory = [];

        // Update UI
        calculateStats();
        renderHistoryGrid([]);
        updateHistoryCount();
        toggleEmptyState();

        showToast('Watch history cleared', 'success');

    } catch (error) {
        console.error('❌ Failed to clear history:', error);
        showToast('Failed to clear history', 'error');
    } finally {
        showLoading(false);
    }
}

// Utility functions
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

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
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

// Export for global access
window.loadWatchHistory = loadWatchHistory;
window.applyFilters = applyFilters;
