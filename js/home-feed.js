// ============================================
// BANTU STREAM CONNECT - CORE INITIALIZATION (js/home-feed.js)
// Cleaned: Removed migrated header, nav, sidebar, footer, and section logic.
// Preserved: Supabase setup, global state, auth, URL fixers, core utilities, & initialization.
// ============================================

// Supabase Configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// GLOBAL STATE (Minimal & Shared)
// ============================================
window.currentUser = null;
window.currentProfile = null;
window.notifications = [];
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;
window.currentCategory = 'All';
window.userProfiles = [];

// Language map fallback (avoid duplicate declaration errors)
if (typeof window.languageMap === 'undefined') {
    window.languageMap = {
        'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'st': 'Sesotho',
        'tn': 'Setswana', 'ss': 'siSwati', 've': 'Tshivenda', 'ts': 'Xitsonga',
        'nr': 'isiNdebele', 'nso': 'Sepedi', 'af': 'Afrikaans', 'all': 'All Languages'
    };
}

// ============================================
// MEDIA URL FIXING FUNCTIONS
// ============================================
function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.includes('supabase.co/storage/v1/object/public') ? url : url;
    }
    let cleanPath = url.replace(/^\/+/, '');
    if (cleanPath.includes('storage/v1/object/public')) {
        return cleanPath.startsWith('http') ? cleanPath : `${SUPABASE_URL}/${cleanPath}`;
    }
    let bucket = 'content';
    if (cleanPath.includes('avatar') || cleanPath.includes('profile')) bucket = 'avatars';
    else if (cleanPath.includes('thumbnail') || cleanPath.includes('thumb')) bucket = 'thumbnails';
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

function fixAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.includes('supabase.co') ? url : url;
    }
    let cleanPath = url.replace(/^\/+/, '').replace(/^avatars\//, '').replace(/^user_avatars\//, '').replace(/^profile_pictures\//, '');
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${cleanPath}`;
}

// Make globally available for migrated modules
window.fixMediaUrl = fixMediaUrl;
window.fixAvatarUrl = fixAvatarUrl;

// Expose Supabase client globally
window.supabaseAuth = supabaseAuth;

// ============================================
// CORE UTILITIES
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
}

// ============================================
// AUTHENTICATION & NOTIFICATIONS
// ============================================
async function checkAuth() {
    const startTime = performance.now();
    try {
        const { data, error } = await supabaseAuth.auth.getSession();
        if (error) throw error;
        window.currentUser = data?.session?.user || null;
        if (window.currentUser) {
            loadUserProfile().catch(console.warn);
        } else {
            updateWelcomeBanner();
        }
        return window.currentUser;
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

async function loadUserProfile() {
    if (!window.currentUser) return;
    try {
        const { data: profile, error } = await supabaseAuth.from('user_profiles').select('*').eq('id', window.currentUser.id).maybeSingle();
        if (!error && profile) {
            window.currentProfile = profile;
            await loadNotifications();
        }
        updateWelcomeBanner();
    } catch (error) {
        console.error('Error loading profile:', error);
        updateWelcomeBanner();
    }
}

/**
 * Welcome banner heading/subtitle - honest about personalization the
 * same way For You relabels itself to "Trending in Mzansi" for a
 * signal-less user: a signed-in user gets a real name/greeting and the
 * "tailored for you" claim (backed by the real personalized queries
 * used elsewhere on this page); a guest, who has no personalization
 * signal at all, gets an honest sign-in nudge instead of a false
 * "Welcome back"/"tailored just for you" claim - which is what the
 * static HTML used to show unconditionally, guest or not. Previously
 * duplicated in an inline <script> in index.html (which also
 * re-implemented header/sidebar avatar updates that
 * shared-components.js already owns, using a stray hardcoded
 * blue-to-gold avatar-fallback gradient instead of the platform's
 * cyan one) - consolidated here instead of living as a second,
 * parallel implementation.
 */
function updateWelcomeBanner() {
    const messageEl = document.getElementById('welcome-message');
    const subtitleEl = document.getElementById('welcome-subtitle');
    if (!messageEl && !subtitleEl) return;

    if (window.currentUser) {
        const profile = window.currentProfile;
        const displayName = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        if (messageEl) messageEl.innerHTML = `${greeting}, <span id="user-name">${escapeHtml(displayName)}</span>!`;
        if (subtitleEl) subtitleEl.textContent = 'Discover new content tailored just for you';
    } else {
        if (messageEl) messageEl.textContent = 'Welcome to Bantu Stream Connect';
        if (subtitleEl) subtitleEl.textContent = 'Sign in to get content recommendations tailored to you';
    }
}

async function loadNotifications() {
    if (!window.currentUser) {
        updateNotificationBadge(0);
        return;
    }
    try {
        const { data, error } = await supabaseAuth.from('notifications').select('*').eq('user_id', window.currentUser.id).order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        window.notifications = data || [];

        const generalUnreadCount = window.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(generalUnreadCount);
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
}

/**
 * Compact header language-filter dropdown (replaces the old 12-chip
 * full-width strip, which was confirmed fully inert). Toggle + selection
 * are real; actual content filtering by language isn't wired to any
 * home-feed row query yet, so picking a language is honest about that
 * instead of silently doing nothing.
 */
function setupLanguageFilterDropdown() {
    const wrap = document.getElementById('language-filter-wrap');
    const btn = document.getElementById('language-filter-btn');
    const dropdown = document.getElementById('language-filter-dropdown');
    if (!wrap || !btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    dropdown.querySelectorAll('.language-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dropdown.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            dropdown.classList.remove('active');
            if (chip.dataset.lang !== 'all') {
                showToast('Language filtering coming soon', 'info');
            }
        });
    });
}

/**
 * Welcome banner above the hero - it was permanently visible and just
 * sitting there taking up space, so it now auto-dismisses 10s after
 * page load. Fades out and collapses (not just opacity, see
 * .welcome-banner-hide in home-feed-ui.css) so the layout closes the
 * gap it leaves behind instead of holding an empty space open.
 */
function setupWelcomeBannerAutoDismiss() {
    const banner = document.getElementById('welcome-banner');
    if (!banner) return;
    setTimeout(() => {
        banner.classList.add('welcome-banner-hide');
    }, 10000);
}

/**
 * Explore All Content CTA at the bottom of the feed. trending-screen.js
 * (which owns the same #explore-all-btn id/handler pattern on the
 * Trending page) isn't loaded here, so this button previously had no
 * click handler at all on Home - wire it to the Explore screen, same
 * destination as the sidebar's own "Explore" nav item.
 */
function setupExploreAllCta() {
    const btn = document.getElementById('explore-all-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        window.location.href = 'explore-screen.html';
    });
}

function updateNotificationBadge(count) {
    ['notification-count', 'sidebar-notification-count'].forEach(id => {
        const badge = document.getElementById(id);
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    });
}

// ============================================
// GLOBAL IMAGE ERROR HANDLER
// ============================================
function setupGlobalImageErrorHandler() {
    document.addEventListener('error', function(e) {
        const target = e.target;
        if (target.tagName === 'IMG' && (target.classList.contains('profile-img') || target.closest('.creator-avatar-small') || target.closest('.profile-avatar-small'))) {
            const container = target.parentElement;
            if (container) {
                const initials = target.alt?.charAt(0)?.toUpperCase() || 'U';
                container.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#00E5FF,#0891b2);display:flex;align-items:center;justify-content:center;color:#06141A;font-weight:bold;font-size:12px;">${initials}</div>`;
            }
        }
    }, true);
}

// ============================================
// INITIALIZATION
// ============================================
async function initCore() {
    setupGlobalImageErrorHandler();
    setupLanguageFilterDropdown();
    setupExploreAllCta();
    setupWelcomeBannerAutoDismiss();
    await checkAuth();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCore);
} else {
    initCore();
}

// ============================================
// GLOBAL EXPORTS
// ============================================
Object.assign(window, {
    supabaseAuth,
    checkAuth,
    loadUserProfile,
    loadNotifications,
    setupLanguageFilterDropdown,
    setupExploreAllCta,
    setupWelcomeBannerAutoDismiss,
    updateNotificationBadge,
    showToast,
    escapeHtml,
    formatNumber,
    getInitials,
    fixMediaUrl,
    fixAvatarUrl
});
