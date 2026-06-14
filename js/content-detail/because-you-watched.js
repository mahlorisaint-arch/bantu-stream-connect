// js/content-detail/because-you-watched.js
// Extracted from content-detail-features.js - "Because You Watched" Recommendation Rail

console.log('🎯 Because You Watched module loading...');

// ============================================
// SHOW SKELETON LOADER FOR RAIL
// ============================================
function showBecauseYouWatchedSkeleton() {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Because You Watched</h2>
            </div>
            <div class="content-grid" id="becauseYouWatched-grid">
                ${Array(6).fill().map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-thumbnail"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-creator"></div>
                        <div class="skeleton-stats"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// ============================================
// SHOW EMPTY STATE FOR RAIL
// ============================================
function showBecauseYouWatchedEmpty() {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    section.style.display = 'block';
    const grid = section.querySelector('.content-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
            <div class="empty-icon">
                <i class="fas fa-magic" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
            </div>
            <h3 style="color: var(--soft-white); margin: 15px 0 10px;">No Recommendations Yet</h3>
            <p style="color: var(--slate-grey); font-size: 14px;">
                Watch more content to get personalized recommendations
            </p>
            <button class="btn btn-secondary" onclick="document.getElementById('relatedGrid')?.scrollIntoView({behavior:'smooth'})" style="margin-top: 15px;">
                Browse Related Content
            </button>
        </div>
    `;
}

// ============================================
// RENDER BECAUSE YOU WATCHED RAIL
// ============================================
function renderBecauseYouWatchedRail(items) {
    const section = document.getElementById('becauseYouWatchedRail');
    if (!section) return;
    
    if (!items || items.length === 0) {
        showBecauseYouWatchedEmpty();
        return;
    }
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Because You Watched</h2>
            </div>
            <div class="content-grid" id="becauseYouWatched-grid"></div>
        `;
    }
    
    const grid = section.querySelector('.content-grid');
    if (!grid) return;
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.total_views || item.real_views_count || item.views_count || 0;
        const progress = item.watch_progress ?
            Math.min(100, Math.round((item.watch_progress.last_position / (item.duration || 3600)) * 100))
            : null;
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card recommendation-card">
                <div class="card-thumbnail">
                    <img src="${escapeHtml(item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop')}"
                        alt="${escapeHtml(item.title)}"
                        loading="lazy"
                        onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    ${progress ? `
                        <div class="progress-bar-overlay">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                        <div class="resume-badge">
                            <i class="fas fa-play"></i> Resume
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <div class="related-meta">
                        <i class="fas fa-eye"></i>
                        <span>${formatNumber(viewsCount)} views</span>
                    </div>
                    ${item.user_profiles?.full_name ? `
                        <div class="creator-chip">
                            <i class="fas fa-user"></i>
                            ${truncateText(item.user_profiles.full_name, 15)}
                        </div>
                    ` : ''}
                </div>
            </a>
        `;
    }).join('');
    
    section.style.display = 'block';
}

// ============================================
// LOAD BECAUSE YOU WATCHED RECOMMENDATIONS
// ============================================
async function loadBecauseYouWatchedRecommendations() {
    if (!window.recommendationEngine) {
        console.warn('⚠️ RecommendationEngine not available');
        return;
    }
    
    showBecauseYouWatchedSkeleton();
    
    try {
        const items = await window.recommendationEngine.getRecommendations('because_you_watched', { limit: 8 });
        renderBecauseYouWatchedRail(items);
    } catch (error) {
        console.error('❌ Failed to load Because You Watched recommendations:', error);
        showBecauseYouWatchedEmpty();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.showBecauseYouWatchedSkeleton = showBecauseYouWatchedSkeleton;
window.showBecauseYouWatchedEmpty = showBecauseYouWatchedEmpty;
window.renderBecauseYouWatchedRail = renderBecauseYouWatchedRail;
window.loadBecauseYouWatchedRecommendations = loadBecauseYouWatchedRecommendations;

console.log('✅ Because You Watched module loaded');
