// ============================================
// HOME FEED FEATURES - MIGRATION WRAPPER
// ============================================
// All functionality has been migrated to modular files:
// - hero-content.js
// - continue-watching.js
// - creator-of-the-week.js
// - community-favorites.js
// - for-you.js
// - latest-gems.js
// - live-now.js
// - trending-now.js
// - upcoming-events.js
// - wavelets.js
// - shared-components.js
// ============================================

console.log('📦 home-feed-features.js - Migration wrapper active');

// Re-export/forward key functions to maintain backward compatibility
if (typeof window !== 'undefined') {
    // Forward showToast if needed
    if (typeof window.showToast === 'undefined') {
        window.showToast = function(message, type = 'info') {
            console.log(`[Toast] ${type}: ${message}`);
        };
    }
    
    // Forward format utilities
    if (typeof window.formatNumber === 'undefined') {
        window.formatNumber = function(num) {
            if (!num && num !== 0) return '0';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        };
    }
    
    if (typeof window.formatDuration === 'undefined') {
        window.formatDuration = function(seconds) {
            if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, "0")}`;
        };
    }
    
    if (typeof window.getInitials === 'undefined') {
        window.getInitials = function(name) {
            if (!name) return '?';
            return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
        };
    }
    
    if (typeof window.escapeHtml === 'undefined') {
        window.escapeHtml = function(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
    }
    
    // Language map
    if (typeof window.languageMap === 'undefined') {
        window.languageMap = {
            'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'st': 'Sesotho',
            'tn': 'Setswana', 'ss': 'Siswati', 've': 'Tshivenḓa', 'ts': 'Xitsonga',
            'nr': 'isiNdebele', 'nso': 'Sesotho sa Leboa', 'af': 'Afrikaans'
        };
    }
}

console.log('✅ Migration wrapper ready - All features now in modular files');
