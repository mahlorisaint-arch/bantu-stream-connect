// Supabase Configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Auth client initialized');

// Global state variables (minimal - only for auth/profiles)
window.currentUser = null;
window.currentProfile = null;
window.notifications = [];
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;
window.currentCategory = 'All';
window.userProfiles = [];
window.userBadges = [];

// Categories list
const categories = [
    'All',
    'Music',
    'STEM',
    'Culture',
    'News',
    'Sports',
    'Movies',
    'Documentaries',
    'Podcasts',
    'Skits',
    'Videos'
];

// South African languages mapping
const languageMap = {
    'en': 'English',
    'zu': 'IsiZulu',
    'xh': 'IsiXhosa',
    'af': 'Afrikaans',
    'nso': 'Sepedi',
    'st': 'Sesotho',
    'tn': 'Setswana',
    'ss': 'siSwati',
    've': 'Tshivenda',
    'ts': 'Xitsonga',
    'nr': 'isiNdebele'
};
window.languageMap = languageMap;

// ============================================
// MEDIA URL FIXING FUNCTIONS
// ============================================

/**
 * Robust URL fixer for all media types
 * Handles Supabase storage, relative paths, and absolute URLs
 */
function fixMediaUrl(url) {
    if (!url) return '';
    
    // Already a valid full URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // Check if it's a working Supabase URL
        if (url.includes('supabase.co/storage/v1/object/public')) {
            return url;
        }
        // If it's a different domain, return as-is
        return url;
    }
    
    // Remove leading slashes
    let cleanPath = url.replace(/^\/+/, '');
    
    // Handle different path formats
    if (cleanPath.includes('storage/v1/object/public')) {
        // Already has storage path, just prepend domain if needed
        return cleanPath.startsWith('http') ? cleanPath : `${SUPABASE_URL}/${cleanPath}`;
    }
    
    // Determine bucket type based on path or content type
    let bucket = 'content'; // default bucket
    if (cleanPath.includes('avatar') || cleanPath.includes('profile')) {
        bucket = 'avatars';
    } else if (cleanPath.includes('thumbnail') || cleanPath.includes('thumb')) {
        bucket = 'thumbnails';
    } else if (cleanPath.includes('video') || cleanPath.includes('content')) {
        bucket = 'content';
    }
    
    // Construct full URL
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Fix avatar URLs with special handling
 */
function fixAvatarUrl(url) {
    if (!url) return '';
    
    // Already a valid full URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        if (url.includes('supabase.co')) return url;
        return url;
    }
    
    // Remove leading slashes and common prefixes
    let cleanPath = url.replace(/^\/+/, '')
                       .replace(/^avatars\//, '')
                       .replace(/^user_avatars\//, '')
                       .replace(/^profile_pictures\//, '');
    
    // Use avatars bucket
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${cleanPath}`;
}

/**
 * Get fallback placeholder for broken images
 */
function getImageFallback(type = 'thumbnail', initials = '?') {
    const fallbacks = {
        thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
        avatar: null, // Will use initials instead
        profile: null
    };
    return fallbacks[type];
}

/**
 * Generate initials avatar HTML
 */
function getInitialsAvatar(initials, size = 'small') {
    const sizeClass = size === 'small' ? 'creator-initials-small' : 
                     size === 'large' ? 'creator-initials-large' : 'creator-initials';
    const fontSize = size === 'small' ? '12px' : size === 'large' ? '24px' : '16px';
    return `<div class="${sizeClass}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));color:white;font-weight:bold;font-size:${fontSize};">${initials}</div>`;
}

// Export functions to window
window.fixMediaUrl = fixMediaUrl;
window.fixAvatarUrl = fixAvatarUrl;
window.getImageFallback = getImageFallback;
window.getInitialsAvatar = getInitialsAvatar;

// Simple Supabase REST client for content queries
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }

    async query(table, options = {}) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = 100,
            offset = 0
        } = options;

        let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;

        Object.keys(where).forEach(key => {
            if (where[key] !== undefined && where[key] !== null) {
                queryUrl += `&${key}=eq.${encodeURIComponent(where[key])}`;
            }
        });

        if (orderBy) {
            queryUrl += `&order=${orderBy}.${order}`;
        }

        if (limit) {
            queryUrl += `&limit=${limit}`;
        }

        if (offset) {
            queryUrl += `&offset=${offset}`;
        }

        try {
            const response = await window.rateLimiter.execute('content', async () => {
                const res = await fetch(queryUrl, {
                    headers: {
                        'apikey': this.key,
                        'Authorization': `Bearer ${this.key}`,
                        'Content-Type': 'application/json'
                    }
                });
                return res;
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Supabase query error:', error);
            throw error;
        }
    }

    /**
     * Fix media URL - Enhanced version with proper bucket detection
     * @param {string} url - The URL to fix
     * @returns {string} Properly formatted URL
     */
    fixMediaUrl(url) {
        if (!url) return '';
        
        // Already a full URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            if (url.includes('supabase.co')) return url;
            return url;
        }
        
        // Remove leading slashes
        const cleanPath = url.replace(/^\/+/, '');
        
        // Handle different path formats
        if (cleanPath.includes('storage/v1/object/public')) {
            return cleanPath.startsWith('http') ? cleanPath : `${this.url}/${cleanPath}`;
        }
        
        // Determine bucket based on path
        let bucket = 'content';
        if (cleanPath.includes('avatar')) bucket = 'avatars';
        else if (cleanPath.includes('thumbnail')) bucket = 'thumbnails';
        else if (cleanPath.includes('profile')) bucket = 'avatars';
        
        return `${this.url}/storage/v1/object/public/${bucket}/${cleanPath}`;
    }

    /**
     * Fix avatar URL specifically
     * @param {string} url - The avatar URL to fix
     * @returns {string} Properly formatted avatar URL
     */
    fixAvatarUrl(url) {
        if (!url) return '';
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
            if (url.includes('supabase.co')) return url;
            return url;
        }
        
        const cleanPath = url.replace(/^\/+/, '')
                             .replace(/^avatars\//, '')
                             .replace(/^user_avatars\//, '')
                             .replace(/^profile_pictures\//, '');
        
        return `${this.url}/storage/v1/object/public/avatars/${cleanPath}`;
    }
}

// Initialize content Supabase client
const contentSupabase = new ContentSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.contentSupabase = contentSupabase;

console.log('✅ Content Supabase client initialized with enhanced media URL fixing');

// Make supabaseAuth available globally
window.supabaseAuth = supabaseAuth;

// ============================================
// GLOBAL IMAGE ERROR HANDLER
// ============================================

/**
 * Setup global image error handler for consistent fallback behavior
 */
function setupGlobalImageErrorHandler() {
    // Add global image error listener for profile images
    document.addEventListener('error', function(e) {
        const target = e.target;
        if (target.tagName === 'IMG') {
            // Check if it's a profile/avatar image
            if (target.classList.contains('profile-img') || 
                target.closest('.creator-avatar-small') ||
                target.closest('.profile-avatar-small') ||
                target.classList.contains('avatar-img')) {
                console.warn('🖼️ Profile image failed:', target.src);
                const container = target.parentElement;
                if (container) {
                    const initials = target.alt?.charAt(0)?.toUpperCase() || 'U';
                    const size = container.classList.contains('creator-avatar-small') ? 'small' : 
                                container.classList.contains('creator-avatar-large') ? 'large' : 'medium';
                    container.innerHTML = getInitialsAvatar(initials, size);
                }
            }
        }
    }, true);
}

// Run global error handler setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalImageErrorHandler);
} else {
    setupGlobalImageErrorHandler();
}

console.log('✅ Global image error handler initialized');
