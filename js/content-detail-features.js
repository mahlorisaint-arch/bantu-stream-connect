// js/content-detail-features.js
// Extracted features from content-detail.js to reduce main file size.
// These modules handle UI Utilities, Theme, Sidebar, Header, Navigation, and Recommendations.
// Load this file BEFORE content-detail.js in your HTML.
// 
// 🚀 PHASE 1-6 COMPATIBLE: Fully integrated with decoupled database architecture
// - All view recording delegated to WatchSessionManager (Phase 3)
// - All like operations use atomic RPC counters (Phase 4)
// - All playlist data uses playlist_contents junction table (Phase 1)
// - All metrics come from content_engagement_stats (Phase 2)
// - All recommendations use content_public_metrics view (Phase 5)
// - UI state uses playlist_relation.sort_index for sorting (Phase 6)
//
// 🔧 ALBUM ARCHITECTURE FIX: REMOVED duplicate album toggle system (now ONLY in content-detail.js)

console.log('🎬 Content Detail Features Loading (PHASE 1-6 compatible)...');

// ============================================
// CLIENT-SIDE VIEW STATUS HELPERS (UI only - NO recording here)
// Recording is handled by WatchSessionManager in content-detail.js (Phase 3)
// ============================================
function hasViewedContentRecently(contentId) {
    try {
        const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
        const viewTime = viewedContent[contentId];
        if (!viewTime) return false;
        const hoursSinceView = (Date.now() - viewTime) / (1000 * 60 * 60);
        return hoursSinceView < 24;
    } catch (error) {
        console.error('Error checking view history:', error);
        return false;
    }
}

function markContentAsViewed(contentId) {
    try {
        const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
        viewedContent[contentId] = Date.now();

        // Clean up old entries (older than 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        Object.keys(viewedContent).forEach(id => {
            if (viewedContent[id] < sevenDaysAgo) {
                delete viewedContent[id];
            }
        });
        localStorage.setItem('bantu_viewed_content', JSON.stringify(viewedContent));
        return true;
    } catch (error) {
        console.error('Error marking content as viewed:', error);
        return false;
    }
}

function clearViewCache() {
    localStorage.removeItem('bantu_viewed_content');
    console.log('🧹 View cache cleared');
    showToast('View cache cleared!', 'success');
}

// ============================================
// 🚀 PHASE 2 & 4: Refresh counts from content_engagement_stats
// Uses the decoupled engagement stats table, NOT legacy Content columns
// ============================================
async function refreshCountsFromSource() {
    if (!window.currentContent) return;
    try {
        // 🚀 PHASE 2: Get counts from content_engagement_stats
        const { data: stats, error: statsError } = await window.supabaseClient
            .from('content_engagement_stats')
            .select('total_views, total_valid_views, total_likes, total_comments')
            .eq('content_id', window.currentContent.id)
            .maybeSingle();

        if (!statsError && stats) {
            // Update local content object with decoupled metrics
            if (window.currentContent) {
                window.currentContent.views_count = stats.total_views || 0;
                window.currentContent.valid_views_count = stats.total_valid_views || 0;
                window.currentContent.likes_count = stats.total_likes || 0;
                window.currentContent.comments_count = stats.total_comments || 0;
            }

            safeSetText('viewsCount', formatNumber(stats.total_views || 0) + ' views');
            safeSetText('viewsCountFull', formatNumber(stats.total_views || 0));
            safeSetText('likesCount', formatNumber(stats.total_likes || 0));
            safeSetText('commentsCount', `(${formatNumber(stats.total_comments || 0)})`);

            console.log('✅ Counts refreshed from content_engagement_stats:', {
                views: stats.total_views,
                valid_views: stats.total_valid_views,
                likes: stats.total_likes,
                comments: stats.total_comments
            });
        } else {
            // Fallback to legacy method if stats table not available
            const { count: newViews } = await window.supabaseClient
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', window.currentContent.id)
                .eq('counted_as_view', true);

            const { count: newLikes } = await window.supabaseClient
                .from('content_likes')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', window.currentContent.id);

            if (window.currentContent) {
                window.currentContent.views_count = newViews || 0;
                window.currentContent.likes_count = newLikes || 0;
            }

            safeSetText('viewsCount', formatNumber(newViews) + ' views');
            safeSetText('viewsCountFull', formatNumber(newViews));
            safeSetText('likesCount', formatNumber(newLikes));
        }
    } catch (error) {
        console.error('❌ Failed to refresh counts from source:', error);
    }
}

// ============================================
// HOME FEED UI INTEGRATION - SIDEBAR, HEADER, NAVIGATION, UTILITIES
// ============================================

// UI Scale Controller (from home feed)
class UIScaleController {
    constructor() {
        this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
        this.minScale = 0.8;
        this.maxScale = 1.4;
        this.step = 0.1;
    }

    init() {
        this.applyScale();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('scaleChanged', (e) => {
            this.updateScaleDisplay(e.detail.scale);
        });
    }

    applyScale() {
        document.documentElement.style.setProperty('--ui-scale', this.scale);
        localStorage.setItem('bantu_ui_scale', this.scale.toString());
        document.dispatchEvent(new CustomEvent('scaleChanged', {
            detail: { scale: this.scale }
        }));
    }

    increase() {
        if (this.scale < this.maxScale) {
            this.scale = Math.min(this.maxScale, this.scale + this.step);
            this.applyScale();
        }
    }

    decrease() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.step);
            this.applyScale();
        }
    }

    reset() {
        this.scale = 1;
        this.applyScale();
    }

    getScale() {
        return this.scale;
    }

    updateScaleDisplay(scale) {
        const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
        displays.forEach(el => {
            if (el) el.textContent = Math.round(scale * 100) + '%';
        });
    }
}

// Toast Notification System (from home feed)
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

// Formatting Functions (from home feed)
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

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

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

// ============================================
// THEME SELECTOR - HOME FEED INTEGRATION
// ============================================
function initThemeSelector() {
    console.log('🎨 Initializing theme selector...');
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    if (!themeSelector || !themeToggle) {
        console.warn('Theme selector elements not found');
        return;
    }

    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const theme = this.dataset.theme;
            applyTheme(theme);
            setTimeout(() => themeSelector.classList.remove('active'), 100);
        });
    });

    themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') &&
            !themeSelector.contains(e.target) &&
            !themeToggle.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
    console.log('✅ Theme selector initialized');
}

function applyTheme(theme) {
    console.log('🎨 Applying theme:', theme);
    if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
        theme = 'dark';
    }

    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);

    switch(theme) {
        case 'light':
            root.style.setProperty('--deep-black', '#ffffff');
            root.style.setProperty('--soft-white', '#1a1a1a');
            root.style.setProperty('--slate-grey', '#666666');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
            root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
            break;
        case 'high-contrast':
            root.style.setProperty('--deep-black', '#000000');
            root.style.setProperty('--soft-white', '#ffffff');
            root.style.setProperty('--slate-grey', '#ffff00');
            root.style.setProperty('--warm-gold', '#ff0000');
            root.style.setProperty('--bantu-blue', '#00ff00');
            root.style.setProperty('--card-bg', '#000000');
            root.style.setProperty('--card-border', '#ffffff');
            break;
        default:
            root.style.setProperty('--deep-black', '#0A0A0A');
            root.style.setProperty('--soft-white', '#F5F5F5');
            root.style.setProperty('--slate-grey', '#A0A0A0');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
            root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
            break;
    }

    void root.offsetWidth;
    localStorage.setItem('bantu_theme', theme);

    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });

    if (typeof showToast === 'function') {
        showToast(`Theme changed to ${theme}`, 'success');
    }

    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: theme }
    }));
}

// ============================================
// SIDEBAR SETUP & FUNCTIONS (from home feed)
// ============================================
function setupCompleteSidebar() {
    setupMobileSidebar();
    fixSidebarProfileTruncation();
    setupSidebarScaleControls();
    optimizeMobileSidebar();
    window.addEventListener('resize', () => optimizeMobileSidebar());
}

function setupMobileSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');

    if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;

    const openSidebar = () => {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        sidebarMenu.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (menuToggle) {
        const newMenuToggle = menuToggle.cloneNode(true);
        menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
        newMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📱 Header menu button clicked - opening sidebar');
            openSidebar();
        });
    }

    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            closeSidebar();
        }
    });
}

function fixSidebarProfileTruncation() {
    const profileName = document.getElementById('sidebar-profile-name');
    const profileEmail = document.getElementById('sidebar-profile-email');
    if (profileName) {
        profileName.style.whiteSpace = 'nowrap';
        profileName.style.overflow = 'hidden';
        profileName.style.textOverflow = 'ellipsis';
    }
    if (profileEmail) {
        profileEmail.style.whiteSpace = 'nowrap';
        profileEmail.style.overflow = 'hidden';
        profileEmail.style.textOverflow = 'ellipsis';
    }
}

function setupSidebarScaleControls() {
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');

    if (!window.uiScaleController) return;

    const updateDisplay = () => {
        if (scaleValue) {
            scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
        }
    };

    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            window.uiScaleController.decrease();
            updateDisplay();
        });
    }
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            window.uiScaleController.increase();
            updateDisplay();
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.uiScaleController.reset();
            updateDisplay();
        });
    }
    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);
}

function setupSidebarNavigation() {
    document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view analytics', 'warning');
            return;
        }
        const analyticsModal = document.getElementById('analytics-modal');
        if (analyticsModal) {
            analyticsModal.classList.add('active');
            loadPersonalAnalytics();
        }
    });

    document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel) {
            notificationsPanel.classList.add('active');
            renderNotifications();
        }
    });

    document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view badges', 'warning');
            return;
        }
        const badgesModal = document.getElementById('badges-modal');
        if (badgesModal) {
            badgesModal.classList.add('active');
            loadUserBadges();
        }
    });

    document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to start a watch party', 'warning');
            return;
        }
        const watchPartyModal = document.getElementById('watch-party-modal');
        if (watchPartyModal) {
            watchPartyModal.classList.add('active');
            loadWatchPartyContent();
        }
    });

    document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const { data } = await window.supabaseClient.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to upload content', 'warning');
            window.location.href = `login.html?redirect=creator-upload.html`;
        } else {
            window.location.href = 'creator-upload.html';
        }
    });

    document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const { data } = await window.supabaseClient.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to access dashboard', 'warning');
            window.location.href = `login.html?redirect=creator-dashboard.html`;
        } else {
            window.location.href = 'creator-dashboard.html';
        }
    });

    document.getElementById('sidebar-watch-history')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view watch history', 'warning');
            window.location.href = `login.html?redirect=watch-history.html`;
            return;
        }
        window.location.href = 'watch-history.html';
    });
}

async function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');

    if (!avatar || !name || !email) return;
    avatar.innerHTML = '';

    if (window.currentUser || (window.AuthHelper?.isAuthenticated?.())) {
        try {
            const userProfile = window.AuthHelper?.getUserProfile?.() || window.currentUser;
            const userId = userProfile?.id;

            if (userId) {
                const { data: profile, error } = await window.supabaseClient
                    .from('user_profiles')
                    .select('id, full_name, username, avatar_url')
                    .eq('id', userId)
                    .maybeSingle();

                if (error || !profile) {
                    renderSidebarFallback(avatar, name, email, userProfile);
                    return;
                }

                name.textContent = profile.full_name || profile.username || 'User';
                email.textContent = userProfile.email || 'user@example.com';

                if (profile.avatar_url) {
                    const avatarUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
                    const img = document.createElement('img');
                    img.src = avatarUrl;
                    img.alt = profile.full_name || 'Profile';
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
                    img.onerror = () => renderSidebarInitials(avatar, profile);
                    avatar.appendChild(img);
                } else {
                    renderSidebarInitials(avatar, profile);
                }

                if (profileSection) {
                    profileSection.onclick = () => {
                        document.getElementById('sidebar-close')?.click();
                        window.location.href = 'manage-profiles.html';
                    };
                }
            } else {
                renderSidebarFallback(avatar, name, email, userProfile);
            }
        } catch (err) {
            console.warn('Sidebar profile fetch error:', err);
            renderSidebarFallback(avatar, name, email, window.currentUser);
        }
    } else {
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
        if (profileSection) {
            profileSection.onclick = () => {
                document.getElementById('sidebar-close')?.click();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
}

function renderSidebarInitials(container, profile) {
    if (!container) return;
    container.innerHTML = '';
    const name = profile?.full_name || profile?.username || 'User';
    const initials = getInitials(name);
    const span = document.createElement('span');
    span.style.cssText = `
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--soft-white);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        line-height: 1;
    `;
    span.textContent = initials;
    container.appendChild(span);
}

function renderSidebarFallback(avatar, name, email, user) {
    if (avatar) avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
    if (name) name.textContent = user?.email?.split('@')[0] || 'User';
    if (email) email.textContent = user?.email || 'Sign in to continue';
}

function optimizeMobileSidebar() {
    const sidebarMenu = document.getElementById('sidebar-menu');
    if (!sidebarMenu) return;

    if (window.innerWidth <= 768) {
        sidebarMenu.style.width = '16rem';
    } else {
        sidebarMenu.style.width = '18rem';
    }
}

// ============================================
// HEADER FUNCTIONS (from home feed)
// ============================================
async function updateHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const currentProfileName = document.getElementById('current-profile-name');
    if (!profilePlaceholder || !currentProfileName) return;
    profilePlaceholder.innerHTML = '';

    if (window.currentUser || window.AuthHelper?.isAuthenticated?.()) {
        try {
            const userProfile = window.AuthHelper?.getUserProfile?.() || window.currentUser;
            const { data: profile } = await window.supabaseClient
                .from('user_profiles')
                .select('full_name, username, avatar_url')
                .eq('id', userProfile.id)
                .maybeSingle();

            const displayName = profile?.full_name || profile?.username || userProfile.email?.split('@')[0] || 'User';
            currentProfileName.textContent = displayName;

            if (profile?.avatar_url) {
                const avatarUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
                const img = document.createElement('img');
                img.className = 'profile-img';
                img.src = avatarUrl;
                img.alt = displayName;
                img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
                img.onerror = () => renderInitialsProfile(profilePlaceholder, { full_name: displayName });
                profilePlaceholder.appendChild(img);
            } else {
                renderInitialsProfile(profilePlaceholder, { full_name: displayName });
            }
        } catch (e) {
            renderFallbackProfile(profilePlaceholder, currentProfileName, window.currentUser);
        }
    } else {
        renderGuestProfile(profilePlaceholder, currentProfileName);
    }

    applyMobileHeaderStyles();
}

function applyMobileHeaderStyles() {
    const isMobile = window.innerWidth <= 480;
    const profileBtn = document.querySelector('.profile-btn');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');

    if (isMobile) {
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'none';
        }
        if (profileBtn) {
            profileBtn.style.minWidth = 'auto';
            profileBtn.style.padding = '0.3125rem 0.75rem';
            profileBtn.style.justifyContent = 'center';
        }
        if (profileNameSpan) {
            profileNameSpan.style.display = 'inline-block';
        }
    } else {
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'flex';
        }
        if (profileBtn) {
            profileBtn.style.minWidth = '160px';
            profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
            profileBtn.style.justifyContent = 'flex-start';
        }
    }
}

function renderInitialsProfile(container, profile) {
    if (!container) return;
    container.innerHTML = '';
    const name = profile?.full_name || 'User';
    const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2);
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;text-transform:uppercase;';
    div.textContent = initials;
    container.appendChild(div);
}

function renderGuestProfile(container, nameElement) {
    if (!container) return;
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
    div.textContent = 'G';
    container.appendChild(div);
    if (nameElement) nameElement.textContent = 'Guest';
}

function renderFallbackProfile(container, nameElement, user) {
    if (container) container.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
    if (nameElement) nameElement.textContent = user?.email?.split('@')[0] || 'User';
}

function updateProfileSwitcher() {
    const profileList = document.getElementById('profile-list');
    const currentProfileName = document.getElementById('current-profile-name');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    if (!profileList || !currentProfileName || !profilePlaceholder) return;

    if (window.currentProfile) {
        currentProfileName.textContent = window.currentProfile.name || 'Profile';
        while (profilePlaceholder.firstChild) {
            profilePlaceholder.removeChild(profilePlaceholder.firstChild);
        }

        if (window.currentProfile.avatar_url) {
            const img = document.createElement('img');
            img.className = 'profile-img';
            img.src = window.SupabaseHelper?.fixMediaUrl?.(window.currentProfile.avatar_url) || window.currentProfile.avatar_url;
            img.alt = window.currentProfile.name;
            img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            profilePlaceholder.appendChild(img);
        } else {
            const initials = getInitials(window.currentProfile.name);
            const div = document.createElement('div');
            div.className = 'profile-placeholder';
            div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            div.textContent = initials;
            profilePlaceholder.appendChild(div);
        }
    }

    profileList.innerHTML = (window.userProfiles || []).map(profile => {
        const initials = getInitials(profile.name);
        const isActive = window.currentProfile?.id === profile.id;
        return `
            <div class="profile-item ${isActive ? 'active' : ''}" data-profile-id="${profile.id}">
                <div class="profile-avatar-small">
                    ${profile.avatar_url
                        ? `<img src="${window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url}" alt="${escapeHtml(profile.name)}">`
                        : `<div class="profile-initials">${initials}</div>`
                    }
                </div>
                <span class="profile-name">${escapeHtml(profile.name)}</span>
                ${isActive ? '<i class="fas fa-check"></i>' : ''}
            </div>
        `;
    }).join('');

    document.querySelectorAll('.profile-item').forEach(item => {
        item.addEventListener('click', async () => {
            const profileId = item.dataset.profileId;
            const profile = window.userProfiles.find(p => p.id === profileId);
            if (profile) {
                window.currentProfile = profile;
                localStorage.setItem('currentProfileId', profileId);
                updateProfileSwitcher();
                await loadContinueWatchingSection();
                await loadForYouSection();
                showToast(`Switched to ${profile.name}`, 'success');
            }
        });
    });

    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    applyMobileHeaderStyles();
}

window.addEventListener('resize', () => {
    applyMobileHeaderStyles();
});

// ============================================
// BOTTOM NAVIGATION BUTTON FUNCTIONS
// ============================================
function setupNavigationButtons() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    if (navCreateBtn) {
        navCreateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            }
        });
    }

    if (navHistoryBtn) {
        navHistoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!window.currentUser) {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=watch-history.html`;
                return;
            }
            window.location.href = 'watch-history.html';
        });
    }

    if (navMenuBtn) {
        const newNavMenuBtn = navMenuBtn.cloneNode(true);
        navMenuBtn.parentNode.replaceChild(newNavMenuBtn, navMenuBtn);
        newNavMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📱 Menu button clicked - opening sidebar');
            const sidebarMenu = document.getElementById('sidebar-menu');
            const sidebarOverlay = document.getElementById('sidebar-overlay');
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                console.warn('Sidebar elements not found');
            }
        });
    }
}

function setupNavButtonScrollAnimation() {
    let lastScrollTop = 0;
    const navContainer = document.querySelector('.navigation-button-container');
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navContainer.style.opacity = '0';
            navContainer.style.transform = 'translateY(20px)';
        } else {
            navContainer.style.opacity = '1';
            navContainer.style.transform = 'translateY(0)';
        }
        lastScrollTop = scrollTop;
    });
}

// ============================================
// COMMENT INPUT STATE UPDATE
// ============================================
async function updateCommentInputState() {
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');
    const commentAvatar = document.getElementById('userCommentAvatar');
    if (!commentInput || !sendCommentBtn) return;

    let isAuthenticated = false;
    let userProfile = null;
    if (window.AuthHelper?.isAuthenticated?.()) {
        isAuthenticated = true;
        userProfile = window.AuthHelper.getUserProfile?.();
    } else if (window.currentUser?.id) {
        isAuthenticated = true;
        userProfile = window.currentUser;
    } else {
        try {
            const { data } = await window.supabaseClient?.auth?.getSession?.();
            isAuthenticated = !!data?.session;
            if (isAuthenticated && window.AuthHelper?.getUserProfile) {
                userProfile = window.AuthHelper.getUserProfile();
            }
        } catch (e) {
            console.warn('Auth check fallback:', e);
        }
    }

    if (isAuthenticated && userProfile) {
        commentInput.disabled = false;
        commentInput.placeholder = 'Write a comment...';
        sendCommentBtn.disabled = false;

        const displayName = userProfile?.full_name || userProfile?.username || userProfile?.email?.split('@')[0] || 'User';
        const avatarUrl = userProfile?.avatar_url || window.AuthHelper?.getAvatarUrl?.();

        if (commentAvatar) {
            if (avatarUrl && avatarUrl !== 'null') {
                const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
                commentAvatar.innerHTML = `<img src="${fixedUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                const initial = displayName.charAt(0).toUpperCase();
                commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">${initial}</div>`;
            }
        }
    } else {
        commentInput.disabled = true;
        commentInput.placeholder = 'Sign in to add a comment...';
        sendCommentBtn.disabled = true;
        if (commentAvatar) {
            commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
}

// ============================================
// 🚀 PHASE 4: QUALITY INDICATOR UPDATE FUNCTION
// ============================================
function updateQualityIndicator(quality) {
    const indicator = document.getElementById('qualityBadge');
    const dataSaverBadge = document.getElementById('dataSaverBadge');
    if (!indicator) return;

    indicator.style.display = 'block';
    indicator.textContent = quality.toUpperCase();

    indicator.classList.remove('auto', 'hd');
    if (quality === 'auto') {
        indicator.classList.add('auto');
    } else if (['720p', '1080p'].includes(quality)) {
        indicator.classList.add('hd');
    }

    if (window.streamingManager?.isDataSaverEnabled()) {
        dataSaverBadge?.style.setProperty('display', 'block');
    } else {
        dataSaverBadge?.style.setProperty('display', 'none');
    }

    setTimeout(() => {
        if (indicator && !window.streamingManager?.isDataSaverEnabled()) {
            indicator.style.display = 'none';
        }
    }, 5000);
}

// ============================================
// 🚀 PHASE 4: NETWORK SPEED INDICATOR UPDATE
// ============================================
function updateNetworkSpeedIndicator(speedMbps) {
    const indicator = document.getElementById('networkSpeedIndicator');
    const valueSpan = document.getElementById('networkSpeedValue');
    if (!indicator || !valueSpan) return;

    if (speedMbps) {
        valueSpan.textContent = speedMbps.toFixed(1) + ' Mbps';
        indicator.style.display = 'flex';

        indicator.classList.remove('good', 'fair', 'poor');
        if (speedMbps > 5) {
            indicator.classList.add('good');
        } else if (speedMbps > 2) {
            indicator.classList.add('fair');
        } else {
            indicator.classList.add('poor');
        }
    } else {
        indicator.style.display = 'none';
    }
}

// ============================================
// 🚀 PHASE 5: LOAD RECOMMENDATION RAILS using content_public_metrics
// ============================================
async function loadRecommendationRails() {
    if (!window.recommendationEngine) return;

    const railConfigs = [
        {
            type: window.recommendationEngine?.TYPES?.BECAUSE_YOU_WATCHED || 'because_you_watched',
            containerId: 'becauseYouWatchedRail',
            title: 'Because You Watched',
            options: { limit: 8 }
        },
        {
            type: window.recommendationEngine?.TYPES?.MORE_FROM_CREATOR || 'more_from_creator',
            containerId: 'moreFromCreatorRail',
            title: 'More From This Creator',
            options: {
                creatorId: window.currentContent?.user_id,
                excludeContentId: window.currentContent?.id,
                limit: 6
            }
        }
    ];

    railConfigs.forEach(config => {
        showRailSkeleton(config.containerId, config.title);
    });

    if (window.recommendationEngine?.getMultipleRails) {
        const results = await window.recommendationEngine.getMultipleRails(railConfigs);
        results.forEach(({ type, results: items }) => {
            const config = railConfigs.find(r => r.type === type);
            if (config && items?.length > 0) {
                renderRecommendationRail(config.containerId, config.title, items);
            } else if (config) {
                showRailEmpty(config.containerId, config.title);
            }
        });
    }
}

function showRailSkeleton(containerId, title = 'Loading...') {
    const section = document.getElementById(containerId);
    if (!section) return;

    section.style.display = 'block';
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${escapeHtml(title)}</h2>
            </div>
            <div class="content-grid" id="${containerId}-grid">
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

function showRailEmpty(containerId, title) {
    const section = document.getElementById(containerId);
    if (!section) return;

    section.style.display = 'block';
    const grid = section.querySelector('.content-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
            <div class="empty-icon">
                <i class="fas fa-magic" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
            </div>
            <h3 style="color: var(--soft-white); margin: 15px 0 10px;">No ${escapeHtml(title)}</h3>
            <p style="color: var(--slate-grey); font-size: 14px;">
                ${title === 'Continue Watching' ? 'Start watching content to pick up where you left off' :
                    title === 'Because You Watched' ? 'Watch more content to get personalized recommendations' :
                        'Check back later for more content'}
            </p>
            ${title === 'Because You Watched' ? `
                <button class="btn btn-secondary" onclick="document.getElementById('relatedGrid')?.scrollIntoView({behavior:'smooth'})" style="margin-top: 15px;">
                    Browse Related Content
                </button>
            ` : ''}
        </div>
    `;
}

function renderRecommendationRail(containerId, title, items) {
    const section = document.getElementById(containerId);
    if (!section) return;

    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${escapeHtml(title)}</h2>
            </div>
            <div class="content-grid" id="${containerId}-grid"></div>
        `;
    }

    const grid = section.querySelector('.content-grid');
    if (!grid) return;

    grid.innerHTML = items.map(item => {
        // 🚀 PHASE 5: Use total_views from content_public_metrics
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
// 🚀 PHASE 4: WATCH LATER FUNCTIONALITY
// ============================================
async function updateWatchLaterButtonState() {
    const btn = document.getElementById('watchLaterBtn');
    if (!btn || !window.currentContent?.id || !window.playlistManager) {
        if (!btn) {
            setTimeout(updateWatchLaterButtonState, 500);
        }
        return;
    }

    try {
        const isInList = await window.playlistManager.isInWatchLater(window.currentContent.id);
        if (isInList) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-check"></i><span>Saved</span>';
            btn.title = 'Remove from Watch Later';
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
            btn.title = 'Add to Watch Later';
            btn.setAttribute('aria-pressed', 'false');
        }
    } catch (error) {
        console.error('❌ Failed to update Watch Later button:', error);
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
    }
}

async function handleWatchLaterToggle() {
    const btn = document.getElementById('watchLaterBtn');
    if (!window.currentContent?.id) {
        showToast('No content selected', 'error');
        return;
    }
    if (!window.currentUserId) {
        showToast('Sign in to save to Watch Later', 'warning');
        const redirect = encodeURIComponent(window.location.href);
        window.location.href = `login.html?redirect=${redirect}`;
        return;
    }

    if (window.playlistModal) {
        window.playlistModal.contentId = window.currentContent.id;
        window.playlistModal.open();
        return;
    }

    if (!window.playlistManager) {
        showToast('Playlist system loading...', 'info');
        return;
    }
    if (!btn) {
        console.error('❌ Watch Later button not found');
        return;
    }

    const originalHTML = btn.innerHTML;
    const originalDisabled = btn.disabled;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const result = await window.playlistManager.toggleWatchLater(window.currentContent.id);
        if (result.success) {
            if (result.action === 'added') {
                showToast('✅ Added to Watch Later', 'success');
            } else if (result.action === 'removed') {
                showToast('🗑️ Removed from Watch Later', 'info');
            } else if (result.action === 'already_exists') {
                showToast('Already in Watch Later', 'info');
            }
        } else {
            showToast('❌ ' + (result.error || 'Failed to update'), 'error');
            await updateWatchLaterButtonState();
        }
    } catch (error) {
        console.error('❌ Watch Later toggle failed:', error);
        showToast('Failed to update Watch Later', 'error');
        await updateWatchLaterButtonState();
    } finally {
        btn.disabled = originalDisabled;
        setTimeout(() => updateWatchLaterButtonState(), 100);
    }
}

function setupWatchLaterButton() {
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (!watchLaterBtn) {
        setTimeout(setupWatchLaterButton, 300);
        return;
    }
    const newBtn = watchLaterBtn.cloneNode(true);
    watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
    newBtn.addEventListener('click', handleWatchLaterToggle);
    newBtn.setAttribute('role', 'button');
    newBtn.setAttribute('aria-label', 'Add to Watch Later');
    newBtn.setAttribute('aria-pressed', 'false');
    console.log('✅ Watch Later button event listener attached');
}

// ============================================
// Utility functions
// ============================================
function safeSetText(id, text) {
    var el = document.getElementById(id);
    if (el) {
        el.textContent = text || '';
    }
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Stub functions for dependencies that may not exist yet
async function loadContinueWatchingSection() { console.log('loadContinueWatchingSection stub'); }
async function loadForYouSection() { console.log('loadForYouSection stub'); }
function loadPersonalAnalytics() { console.log('loadPersonalAnalytics stub'); }
function renderNotifications() { console.log('renderNotifications stub'); }
function loadUserBadges() { console.log('loadUserBadges stub'); }
function loadWatchPartyContent() { console.log('loadWatchPartyContent stub'); }

// ============================================
// 🔧 ALBUM FIX: REMOVED duplicate album toggle system
// 🔧 ALBUM ARCHITECTURE FIX: Album UI now handled EXCLUSIVELY by content-detail.js
// ============================================

// ============================================
// Initialize all features
// ============================================
function initContentDetailFeatures() {
    console.log('🎬 Initializing Content Detail Features (PHASE 1-6 compatible)...');
    
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
    
    setupCompleteSidebar();
    setupSidebarNavigation();
    setupNavigationButtons();
    setupNavButtonScrollAnimation();
    initThemeSelector();
    setupWatchLaterButton();
    
    console.log('✅ Content Detail Features initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentDetailFeatures);
} else {
    initContentDetailFeatures();
}

console.log('✅ Content Detail Features loaded - PHASE 1-6 compatible');
console.log('   🚀 Phase 1: Decoupled playlist structure ready');
console.log('   🚀 Phase 2: content_engagement_stats metrics ready');
console.log('   🚀 Phase 3: View recording delegated to WatchSessionManager');
console.log('   🚀 Phase 4: Atomic likes and quality indicators ready');
console.log('   🚀 Phase 5: content_public_metrics recommendations ready');
console.log('   🚀 Phase 6: UI state using playlist_relation.sort_index');
