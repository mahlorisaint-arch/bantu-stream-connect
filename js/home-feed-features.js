// ============================================
// HOME FEED INITIALIZATION - PERFORMANCE ARCHITECTURE
// ============================================

// Check if languageMap already exists to avoid duplicate declaration errors
if (typeof window.languageMap === 'undefined') {
    window.languageMap = {
        'en': 'English',
        'zu': 'isiZulu',
        'xh': 'isiXhosa',
        'st': 'Sesotho',
        'tn': 'Setswana',
        'ss': 'Siswati',
        've': 'Tshivenḓa',
        'ts': 'Xitsonga',
        'nr': 'isiNdebele',
        'nso': 'Sesotho sa Leboa',
        'af': 'Afrikaans',
        'all': 'All Languages'
    };
}

// ============================================
// UTILITY FUNCTIONS (MUST BE DEFINED FIRST)
// ============================================

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 */
// showToast() intentionally removed: duplicated shared-components.js's
// identical global version (loaded on every page), which is used instead
// now - one canonical implementation instead of drift-prone copies.

// ============================================
// SKELETON LOADING (MUST BE KEPT)
// ============================================
// Fallback only - every section below already ships with matching
// static skeleton markup directly in index.html, so it's visible on
// the very first paint (the actual page skeleton, not a spinner) and
// this function's container.children.length === 0 guard means it
// normally no-ops. Kept as a safety net for any future container that
// loses its static skeleton, and to still match content shape - e.g.
// Community Pulse's cards don't look like Continue Watching's, so
// they don't share a skeleton shape either.
function showAllSkeletons() {
    const genericCardSections = [
        'continue-watching-grid',
        'for-you-grid',
        'trending-grid',
        'community-favorites-grid',
        'live-streams-grid'
    ];
    genericCardSections.forEach(sectionId => {
        const container = document.getElementById(sectionId);
        if (container && container.children.length === 0) {
            container.innerHTML = Array(4).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-creator"></div>
                    <div class="skeleton-stats"></div>
                </div>
            `).join('');
        }
    });

    const shapedSections = {
        'wavelets-container': { count: 6, cardClass: 'wavelet-skeleton', innerHtml: `
                <div class="wavelet-skeleton-thumbnail"></div>
                <div class="wavelet-skeleton-title"></div>
                <div class="wavelet-skeleton-creator"></div>` },
        'bantu-waves-music-grid': { count: 6, cardClass: 'skeleton-music-card', innerHtml: `
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>` },
        'bantu-waves-podcasts-grid': { count: 4, cardClass: 'skeleton-podcast-card', innerHtml: `
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>` },
        'bantu-waves-series-grid': { count: 4, cardClass: 'skeleton-series-card', innerHtml: `
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>` },
        'bantu-waves-midnight-grid': { count: 6, cardClass: 'skeleton-midnight-card', innerHtml: `
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>` }
    };
    Object.entries(shapedSections).forEach(([sectionId, { count, cardClass, innerHtml }]) => {
        const container = document.getElementById(sectionId);
        if (container && container.children.length === 0) {
            container.innerHTML = Array(count).fill().map(() => `<div class="${cardClass}">${innerHtml}</div>`).join('');
        }
    });

    const pulseFeed = document.getElementById('pulse-feed');
    if (pulseFeed && pulseFeed.children.length === 0) {
        pulseFeed.innerHTML = Array(3).fill().map(() => `
            <div class="pulse-card pulse-skeleton">
                <div class="pulse-header">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>
        `).join('');
    }
}

// ============================================
// HOME FEED CONTROLLER (PERFORMANCE MODE)
// ============================================
// The page shows its own skeleton from the very first paint now (static
// markup in index.html, matching each section's real card shape), the
// same way YouTube/Instagram render a skeleton shell instead of a
// spinner - there's no more full-screen loading overlay to hide here.
async function initializeHomeFeed() {
    try {
        // Fallback only - fills in any section whose static skeleton
        // markup didn't make it into the page for some reason.
        showAllSkeletons();

        // Note: All section loading logic (Hero, Continue Watching, For You, Trending, etc.)
        // has been migrated to their respective dedicated modules.
    } catch (err) {
        console.error("❌ Home Feed Error:", err);
        showToast('Page loaded, but some content may be delayed', 'warning');
    }
}

// Only run DOMContentLoaded if document is still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeHomeFeed();
    });
} else {
    // DOM is already loaded, run immediately
    initializeHomeFeed().catch(err => {
        console.error("❌ Home Feed Initialization Error:", err);
    });
}
