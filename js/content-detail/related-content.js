// js/content-detail/related-content.js
// Extracted from content-detail.js - Related Content Section Management

console.log('🔗 Related Content module loading...');

// ============================================
// LOAD RELATED CONTENT
// ============================================
async function loadRelatedContent(contentId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('id, title, thumbnail_url, user_id, genre, duration, media_type, status, user_profiles!user_id(full_name, username)')
            .neq('id', parseInt(contentId))
            .eq('status', 'published')
            .limit(6);
        
        if (error) throw error;
        
        // Add view counts to each related item
        const relatedWithViews = await Promise.all(
            (data || []).map(async (item) => {
                const { count: realViews } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                return { ...item, real_views_count: realViews || 0 };
            })
        );
        
        renderRelatedContent(relatedWithViews);
        
    } catch (error) {
        console.error('Error loading related content:', error);
        renderRelatedContent([]);
    }
}

// ============================================
// RENDER RELATED CONTENT
// ============================================
function renderRelatedContent(items) {
    const container = document.getElementById('relatedGrid');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="related-placeholder card">
                <i class="fas fa-video-slash"></i>
                <p>No related content found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    items.forEach(item => {
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${item.id}`;
        
        card.onclick = function(e) {
            e.preventDefault();
            window.location.href = `content-detail.html?id=${item.id}`;
        };
        
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
        const title = item.title || 'Untitled';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : 0;
        const creatorName = item.user_profiles?.full_name || item.user_profiles?.username || 'Creator';
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${imgUrl}" alt="${escapeHtml(title)}" 
                     onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
                ${item.duration ? `<div class="duration-badge">${formatDuration(item.duration)}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title">${truncateText(escapeHtml(title), 50)}</h3>
                <div class="related-meta">
                    <i class="fas fa-user"></i>
                    <span>${truncateText(escapeHtml(creatorName), 20)}</span>
                </div>
                <div class="related-meta">
                    <i class="fas fa-eye"></i>
                    <span>${formatNumber(viewsCount)} views</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// REFRESH RELATED CONTENT
// ============================================
async function refreshRelatedContent() {
    const contentId = window.currentContent?.id || 
        (window.currentPlaylistItems && window.currentPlaylistItems.length > 0 && window.currentPlaylistItems[0]?.id);
    
    if (contentId) {
        if (typeof showToast === 'function') {
            showToast('Refreshing related content...', 'info');
        }
        await loadRelatedContent(contentId);
        if (typeof showToast === 'function') {
            showToast('Related content refreshed!', 'success');
        }
    }
}

// ============================================
// HIDE RELATED CONTENT SECTION
// ============================================
function hideRelatedContentSection() {
    const section = document.querySelector('.related-section');
    if (section) {
        section.style.display = 'none';
    }
}

// ============================================
// SHOW RELATED CONTENT SECTION
// ============================================
function showRelatedContentSection() {
    const section = document.querySelector('.related-section');
    if (section) {
        section.style.display = 'block';
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
window.loadRelatedContent = loadRelatedContent;
window.renderRelatedContent = renderRelatedContent;
window.refreshRelatedContent = refreshRelatedContent;
window.hideRelatedContentSection = hideRelatedContentSection;
window.showRelatedContentSection = showRelatedContentSection;

console.log('✅ Related Content module loaded');
