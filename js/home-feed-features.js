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
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-exclamation-circle' :
            type === 'warning' ? 'fa-exclamation-triangle' :
            'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// SKELETON LOADING (MUST BE KEPT)
// ============================================
function showAllSkeletons() {
    // Show skeletons for all sections immediately
    const sections = [
        'continue-watching-grid',
        'for-you-grid',
        'trending-grid',
        'new-content-grid',
        'community-favorites-grid',
        'live-streams-grid',
        'pulse-feed'
    ];
    sections.forEach(sectionId => {
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
}

// ============================================
// HOME FEED CONTROLLER (PERFORMANCE MODE)
// ============================================
async function initializeHomeFeed() {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    const startTime = performance.now();
    try {
        console.log("🚀 Initializing Home Feed (Performance Mode)");
        // ✅ SHOW UI IMMEDIATELY
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';

        // Show skeletons instantly
        showAllSkeletons();

        // Note: All section loading logic (Hero, Continue Watching, For You, Trending, etc.)
        // has been migrated to their respective dedicated modules.
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ Home Feed Core Loaded in ${totalTime.toFixed(0)}ms`);
    } catch (err) {
        console.error("❌ Home Feed Error:", err);
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
        showToast('Page loaded, but some content may be delayed', 'warning');
    }
}

// Only run DOMContentLoaded if document is still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Home Feed Initializing (Performance Mode)');
        // Override loading text
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = 'Building Your Feed...';
        // Initialize the feed
        await initializeHomeFeed();
    });
} else {
    // DOM is already loaded, run immediately
    console.log('🚀 Home Feed Initializing (Performance Mode) - DOM already loaded');
    // Override loading text
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Building Your Feed...';
    // Initialize the feed
    initializeHomeFeed().catch(err => {
        console.error("❌ Home Feed Initialization Error:", err);
    });
}
