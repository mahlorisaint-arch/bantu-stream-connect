// ============================================
// CACHE MANAGER
// ============================================
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttl = window.ENV?.CACHE_TTL || 5 * 60 * 1000; // 5 minutes default
    }
    
    set(key, data, ttl = this.ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
    
    clear() {
        this.cache.clear();
    }
}

window.cacheManager = new CacheManager();

// ============================================
// QUERY BATCHER
// ============================================
class QueryBatcher {
    constructor() {
        this.batchSize = 20;
    }
    
    async batchQuery(table, ids, field = 'id') {
        const cacheKey = `${table}-${ids.sort().join(',')}`;
        const cached = window.cacheManager.get(cacheKey);
        if (cached) return cached;
        
        const batches = [];
        for (let i = 0; i < ids.length; i += this.batchSize) {
            batches.push(ids.slice(i, i + this.batchSize));
        }
        
        const results = await Promise.all(
            batches.map(batch => 
                supabaseAuth.from(table).select('*').in(field, batch)
            )
        );
        
        const data = results.flatMap(r => r.data || []);
        window.cacheManager.set(cacheKey, data, 2 * 60 * 1000);
        return data;
    }
}

window.queryBatcher = new QueryBatcher();

// ============================================
// DYNAMIC UI SCALING SYSTEM
// ============================================
class UIScaleController {
    constructor() {
        this.scaleKey = 'bantu_ui_scale';
        this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
        this.currentIndex = 2; // Default to 1.0
        this.init();
    }

    init() {
        // Load saved preference
        const savedScale = localStorage.getItem(this.scaleKey);
        if (savedScale) {
            this.currentIndex = this.scales.indexOf(parseFloat(savedScale));
            if (this.currentIndex === -1) this.currentIndex = 2;
        }
        
        // Apply scale
        this.applyScale();
        
        console.log('🎨 UI Scale Controller initialized');
    }

    applyScale() {
        const scale = this.scales[this.currentIndex];
        document.documentElement.style.setProperty('--ui-scale', scale);
        localStorage.setItem(this.scaleKey, scale);
        
        // Update scale display
        this.updateScaleDisplay();
        
        // Dispatch event
        document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale } }));
    }

    updateScaleDisplay() {
        const scaleValue = document.getElementById('scale-value');
        if (scaleValue) {
            scaleValue.textContent = Math.round(this.getScale() * 100) + '%';
        }
        
        const sidebarScaleValue = document.getElementById('sidebar-scale-value');
        if (sidebarScaleValue) {
            sidebarScaleValue.textContent = Math.round(this.getScale() * 100) + '%';
        }
    }

    getScale() {
        return this.scales[this.currentIndex];
    }

    increase() {
        if (this.currentIndex < this.scales.length - 1) {
            this.currentIndex++;
            this.applyScale();
            this.showScaleToast();
        }
    }

    decrease() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.applyScale();
            this.showScaleToast();
        }
    }

    reset() {
        this.currentIndex = 2;
        this.applyScale();
        this.showScaleToast();
    }

    showScaleToast() {
        const scale = this.getScale();
        const percentage = Math.round(scale * 100);
        if (typeof showToast === 'function') {
            showToast(`UI Size: ${percentage}%`, 'info');
        }
    }
}

window.uiScaleController = new UIScaleController();

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        error: 'fa-exclamation-triangle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.showToast = showToast;

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
}
window.formatNumber = formatNumber;

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
window.truncateText = truncateText;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    } catch (error) {
        return '';
    }
}
window.formatDate = formatDate;

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
window.debounce = debounce;

function getInitials(name) {
    if (!name || name.trim() === '') return '?';
    const names = name.trim().split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
}
window.getInitials = getInitials;

// ============================================
// RENDER CONTENT CARDS
// ============================================
function renderContentCards(contents, showMetrics = true) {
    const fragment = document.createDocumentFragment();
    
    contents.forEach(content => {
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        card.dataset.previewUrl = content.preview_url || '';
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        
        const thumbnailUrl = content.thumbnail_url
            ? contentSupabase.fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
        const initials = getInitials(displayName);
        const username = creatorProfile?.username || 'creator';
        const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
        
        const metrics = window.contentMetrics?.get(content.id) || { views: 0, likes: 0, shares: 0 };
        const favorites = content.favorites_count || 0;
        const duration = content.duration || 0;
        const durationFormatted = window.formatDuration ? window.formatDuration(duration) : (duration > 0 ? `${Math.floor(duration / 60)}:${('0' + (duration % 60)).slice(-2)}` : '');
        const connectorCount = window.connectorCountsByContent?.get(content.id) || 0;
        
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = contentSupabase.fixMediaUrl(creatorProfile.avatar_url);
            avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" loading="lazy">`;
        } else {
            avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
        }
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
                <div class="card-badges">
                    ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                    <div class="connector-badge"><i class="fas fa-star"></i><span>${formatNumber(favorites)} Favorites</span></div>
                </div>
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                ${duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                <div class="creator-info">
                    <div class="creator-avatar-small">${avatarHtml}</div>
                    <div class="creator-name-small">@${escapeHtml(username)}</div>
                </div>
                ${showMetrics ? `
                <div class="card-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(metrics.views)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(metrics.likes)}</span>
                    <span><i class="fas fa-share"></i> ${formatNumber(metrics.shares)}</span>
                    <span><i class="fas fa-language"></i> ${window.languageMap[content.language] || 'English'}</span>
                </div>
                ` : ''}
                <div class="connector-info">
                    <i class="fas fa-user-friends"></i> ${formatNumber(connectorCount)} Connectors
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    return fragment;
}
window.renderContentCards = renderContentCards;

// Dispatch event when UI is ready
document.dispatchEvent(new CustomEvent('homeFeedUIReady'));
