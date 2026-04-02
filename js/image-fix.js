// ============================================
// IMAGE FIX UTILITIES - ENSURE ALL IMAGES LOAD CORRECTLY
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
    
    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
    
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
    
    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
    
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
    return `<div class="${sizeClass}" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));color:white;font-weight:bold;">${initials}</div>`;
}

/**
 * Create image element with error handling
 */
function createImageWithFallback(src, alt, fallbackType = 'thumbnail', initials = null) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'Image';
    img.loading = 'lazy';
    
    img.onerror = function() {
        console.warn(`⚠️ Image failed to load: ${src}`);
        if (fallbackType === 'avatar' && initials) {
            // Replace with initials
            const container = this.parentElement;
            if (container) {
                const initialsHtml = getInitialsAvatar(initials, 
                    container.classList.contains('creator-avatar-small') ? 'small' : 'medium');
                container.innerHTML = initialsHtml;
            }
        } else if (fallbackType === 'thumbnail') {
            this.src = getImageFallback('thumbnail');
            this.onerror = null; // Prevent infinite loop
        } else if (fallbackType === 'profile') {
            this.style.display = 'none';
            if (this.parentElement) {
                this.parentElement.innerHTML = getInitialsAvatar(initials || '?', 'medium');
            }
        }
    };
    
    return img;
}

// Export functions to window
window.fixMediaUrl = fixMediaUrl;
window.fixAvatarUrl = fixAvatarUrl;
window.getInitialsAvatar = getInitialsAvatar;
window.createImageWithFallback = createImageWithFallback;

console.log('✅ Image fix utilities loaded');
