// js/content-detail-features.js
// ============================================
// THE SHARED UTILITY BELT
// Contains ONLY shared utilities and global UI chrome.
// NO core content-detail business logic.
// ============================================
console.log('🎬 Content Detail Features Loading (Utility Belt)...');

// ============================================
// UTILITY FUNCTIONS
// ============================================
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text || '';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
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

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return '-';
    }
}

function formatCommentTime(timestamp) {
    if (!timestamp) return 'Just now';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + ' min ago';
        if (diffHours < 60) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
        if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Recently';
    }
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

// showToast() intentionally removed: this local copy hardcoded inline
// green/red/blue colors via style.cssText, which override any CSS
// regardless of specificity - that's why this page kept showing old-style
// toasts even after shared-components.css moved to the cyan design system.
// shared-components.js's global showToast() (loaded on every page) is used
// instead now.

// ============================================
// 🛠️ CRITICAL FIX: Prevent global namespace pollution and duplicate declaration crashes
// ============================================
if (typeof window.UIScaleController === 'undefined') {
    // Wrap your class/object setup cleanly if it's not bound yet
    window.UIScaleController = class UIScaleController {
        constructor() {
            this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
            this.minScale = 0.8;
            this.maxScale = 1.4;
            this.step = 0.1;
            console.log("📐 UIScaleController instantiated successfully.");
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
    };
    console.log('📐 UIScaleController registered on window.');
} else {
    console.warn("⚠️ Namespace Protection: window.UIScaleController already declared. Skipping duplicate initialization.");
}

// ============================================
// UI CHROME: Theme Selector
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
// UI CHROME: Sidebar Setup
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

function optimizeMobileSidebar() {
    const sidebarMenu = document.getElementById('sidebar-menu');
    if (!sidebarMenu) return;

    if (window.innerWidth <= 768) {
        sidebarMenu.style.width = '16rem';
    } else {
        sidebarMenu.style.width = '18rem';
    }
}

// updateSidebarProfile(), updateHeaderProfile(), and applyMobileHeaderStyles()
// used to be redefined here as page-specific copies. Classic <script> tags
// share one global scope, and this file loads after shared-components.js,
// so these duplicates silently overwrote — and permanently shadowed — the
// real, maintained implementations for every page that only loads
// shared-components.js (trending_screen.html, discover-creator.html, etc.).
// That's what caused the header/sidebar avatar styling fixes to never take
// effect here even after being fixed at the source. Removed so this page
// falls through to the single shared implementation, same as every other
// page — no page-specific header/sidebar/profile chrome left to drift out
// of sync again.

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
            img.style.cssText = 'display:block;width:100%;height:100%;min-width:100%;min-height:100%;border-radius:50%;object-fit:cover;object-position:center;';
            profilePlaceholder.appendChild(img);
        } else {
            const initials = getInitials(window.currentProfile.name);
            const div = document.createElement('div');
            div.className = 'profile-placeholder';
            div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#00E5FF,#0891b2);display:flex;align-items:center;justify-content:center;color:#06141A;font-weight:bold;font-size:16px';
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
                if (typeof loadContinueWatchingSection === 'function') await loadContinueWatchingSection();
                if (typeof loadForYouSection === 'function') await loadForYouSection();
                showToast(`Switched to ${profile.name}`, 'success');
            }
        });
    });

    // #current-profile-btn's click-to-toggle-dropdown behavior is owned by
    // shared-components.js's setupProfileDropdown() (dedup'd via a
    // clone-and-replace, called once at init). This function used to also
    // addEventListener('click', ...) here — since updateProfileSwitcher()
    // is called repeatedly (every profile switch re-renders and re-ran this
    // block), each call stacked another listener on the button with no
    // removal, so N calls meant a click toggled .active N times: with an
    // even listener count the dropdown visually never opened no matter how
    // many times it was clicked. Removed; the shared function already
    // handles this correctly everywhere else.

    applyMobileHeaderStyles();
}

// ============================================
// UI CHROME: Navigation Buttons
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
// SHARED COMPONENTS: Quality & Network Indicators
// ============================================
function updateQualityIndicator(quality) {
    // Lives in the persistent top-bar now (matches the reference design):
    // a main pill ("1080P") plus a separate cyan tier chip ("FHD"), not a
    // transient corner flash — no auto-hide timer.
    const indicator = document.getElementById('qualityBadge');
    const mainEl = document.getElementById('qualityBadgeMain');
    const tierEl = document.getElementById('qualityBadgeTier');
    const dataSaverBadge = document.getElementById('dataSaverBadge');
    if (!indicator || !mainEl) return;

    const normalized = (quality || 'auto').toLowerCase();
    const height = parseInt(normalized, 10);

    if (!isNaN(height)) {
        mainEl.textContent = `${height}P`;
        if (tierEl) {
            const tier = height >= 1080 ? 'FHD' : height >= 720 ? 'HD' : 'SD';
            tierEl.textContent = tier;
            tierEl.style.display = 'inline-block';
        }
    } else {
        mainEl.textContent = 'AUTO';
        if (tierEl) tierEl.style.display = 'none';
    }

    indicator.classList.remove('auto', 'hd');
    if (normalized === 'auto') {
        indicator.classList.add('auto');
    } else if (!isNaN(height) && height >= 720) {
        indicator.classList.add('hd');
    }

    if (window.streamingManager?.isDataSaverEnabled()) {
        dataSaverBadge?.style.setProperty('display', 'block');
    } else {
        dataSaverBadge?.style.setProperty('display', 'none');
    }
}

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
// SHARED COMPONENTS: Recommendation Rails (UI only)
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
// SHARED COMPONENTS: Watch Later Button State & Toggle
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
            btn.innerHTML = '<i class="fas fa-bookmark"></i><span>Save</span>';
            btn.title = 'Remove from Watch Later';
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="far fa-bookmark"></i><span>Save</span>';
            btn.title = 'Add to Watch Later';
            btn.setAttribute('aria-pressed', 'false');
        }
    } catch (error) {
        console.error('❌ Failed to update Watch Later button:', error);
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-bookmark"></i><span>Save</span>';
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
// GLOBAL EXPORTS
// ============================================
window.safeSetText = safeSetText;
window.escapeHtml = escapeHtml;
window.truncateText = truncateText;
window.formatDuration = formatDuration;
window.formatNumber = formatNumber;
window.formatTimeAgo = formatTimeAgo;
window.formatDate = formatDate;
window.formatCommentTime = formatCommentTime;
window.getInitials = getInitials;
window.debounce = debounce;
window.showToast = showToast;

window.initThemeSelector = initThemeSelector;
window.applyTheme = applyTheme;
window.setupCompleteSidebar = setupCompleteSidebar;
window.setupMobileSidebar = setupMobileSidebar;
window.updateProfileSwitcher = updateProfileSwitcher;
window.setupNavigationButtons = setupNavigationButtons;
window.setupNavButtonScrollAnimation = setupNavButtonScrollAnimation;

window.updateQualityIndicator = updateQualityIndicator;
window.updateNetworkSpeedIndicator = updateNetworkSpeedIndicator;
window.loadRecommendationRails = loadRecommendationRails;
window.showRailSkeleton = showRailSkeleton;
window.showRailEmpty = showRailEmpty;
window.renderRecommendationRail = renderRecommendationRail;
window.updateWatchLaterButtonState = updateWatchLaterButtonState;
window.handleWatchLaterToggle = handleWatchLaterToggle;
window.setupWatchLaterButton = setupWatchLaterButton;

// Initialize UI Controller if document is ready
function initContentDetailFeatures() {
    console.log('🎬 Initializing Content Detail Features (Utility Belt)...');
    if (!window.uiScaleController) {
        window.uiScaleController = new window.UIScaleController();
        window.uiScaleController.init();
    }
    setupCompleteSidebar();
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

console.log('✅ content-detail-features.js loaded');
