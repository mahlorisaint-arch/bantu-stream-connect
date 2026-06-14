// js/content-detail/more-from-this-creator.js
// Extracted from content-detail-features.js - "More From This Creator" Recommendation Rail

console.log('🎨 More From This Creator module loading...');

// ============================================
// SHOW SKELETON LOADER FOR RAIL
// ============================================
function showMoreFromCreatorSkeleton() {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From This Creator</h2>
            </div>
            <div class="content-grid" id="moreFromCreator-grid">
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
function showMoreFromCreatorEmpty() {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    section.style.display = 'block';
    const grid = section.querySelector('.content-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
            <div class="empty-icon">
                <i class="fas fa-user-friends" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
            </div>
            <h3 style="color: var(--soft-white); margin: 15px 0 10px;">No More Content From This Creator</h3>
            <p style="color: var(--slate-grey); font-size: 14px;">
                Check back later for more content from this creator
            </p>
        </div>
    `;
}

// ============================================
// RENDER MORE FROM CREATOR RAIL
// ============================================
function renderMoreFromCreatorRail(items) {
    const section = document.getElementById('moreFromCreatorRail');
    if (!section) return;
    
    if (!items || items.length === 0) {
        showMoreFromCreatorEmpty();
        return;
    }
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">More From This Creator</h2>
            </div>
            <div class="content-grid" id="moreFromCreator-grid"></div>
        `;
    }
    
    const grid = section.querySelector('.content-grid');
    if (!grid) return;
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.total_views || item.real_views_count || item.views_count || 0;
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card recommendation-card">
                <div class="card-thumbnail">
                    <img src="${escapeHtml(item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop')}"
                        alt="${escapeHtml(item.title)}"
                        loading="lazy"
                        onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <div class="related-meta">
                        <i class="fas fa-eye"></i>
                        <span>${formatNumber(viewsCount)} views</span>
                    </div>
                    ${item.duration ? `
                        <div class="duration-badge">
                            <i class="fas fa-clock"></i>
                            ${formatDuration(item.duration)}
                        </div>
                    ` : ''}
                </div>
            </a>
        `;
    }).join('');
    
    section.style.display = 'block';
}

// ============================================
// LOAD MORE FROM CREATOR RECOMMENDATIONS
// ============================================
async function loadMoreFromCreatorRecommendations(creatorId, excludeContentId) {
    if (!window.recommendationEngine) {
        console.warn('⚠️ RecommendationEngine not available');
        return;
    }
    
    if (!creatorId) {
        console.warn('⚠️ No creator ID provided');
        showMoreFromCreatorEmpty();
        return;
    }
    
    showMoreFromCreatorSkeleton();
    
    try {
        const items = await window.recommendationEngine.getRecommendations('more_from_creator', {
            creatorId: creatorId,
            excludeContentId: excludeContentId,
            limit: 6
        });
        renderMoreFromCreatorRail(items);
    } catch (error) {
        console.error('❌ Failed to load More From Creator recommendations:', error);
        showMoreFromCreatorEmpty();
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

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
window.showMoreFromCreatorSkeleton = showMoreFromCreatorSkeleton;
window.showMoreFromCreatorEmpty = showMoreFromCreatorEmpty;
window.renderMoreFromCreatorRail = renderMoreFromCreatorRail;
window.loadMoreFromCreatorRecommendations = loadMoreFromCreatorRecommendations;

console.log('✅ More From This Creator module loaded');
