// ============================================
// HOME FEED UI - PAGE-SPECIFIC ONLY
// ============================================
// This file ONLY contains code that is SPECIFIC to the home feed page.
// DO NOT duplicate what's already in shared-components.js

// ============================================
// SKELETON LOADING (Home feed specific)
// ============================================
function showSkeletonLoading(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container || container.children.length > 0) return;
    
    container.innerHTML = Array(count).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
}

function showAllHomeFeedSkeletons() {
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
// HOME FEED SPECIFIC INIT
// ============================================
function initHomeFeedUI() {
    console.log('🎨 Initializing Home Feed UI...');
    showAllHomeFeedSkeletons();
    console.log('✅ Home Feed UI initialized');
}

// Export to window
window.showSkeletonLoading = showSkeletonLoading;
window.showAllHomeFeedSkeletons = showAllHomeFeedSkeletons;
window.initHomeFeedUI = initHomeFeedUI;

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeFeedUI);
} else {
    initHomeFeedUI();
}
