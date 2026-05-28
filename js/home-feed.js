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
console.log('✅ Supabase Auth client initialized');

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
        console.log(`🔐 Auth check completed in ${(performance.now() - startTime).toFixed(0)}ms`);
        if (window.currentUser) {
            console.log('✅ User authenticated:', window.currentUser.email);
            loadUserProfile().catch(console.warn);
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
            console.log('✅ Profile loaded:', profile.full_name || profile.username);
            await loadNotifications();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
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
        updateNotificationBadge(window.notifications.filter(n => !n.is_read).length);
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
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
                container.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${initials}</div>`;
            }
        }
    }, true);
}

// ============================================
// INITIALIZATION
// ============================================
async function initCore() {
    console.log('🚀 Initializing Core System...');
    setupGlobalImageErrorHandler();
    await checkAuth();
    console.log('✅ Core System initialized');
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
    updateNotificationBadge,
    showToast,
    escapeHtml,
    formatNumber,
    getInitials,
    fixMediaUrl,
    fixAvatarUrl
});
