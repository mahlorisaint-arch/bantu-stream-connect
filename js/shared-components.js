// ============================================
// SHARED COMPONENTS - BANTU STREAM CONNECT
// Extracted from content-detail.html for platform-wide consistency
// ============================================

console.log('🎬 Shared Components Loading...');

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Create toast container if it doesn't exist
        const newContainer = document.createElement('div');
        newContainer.id = 'toast-container';
        document.body.appendChild(newContainer);
    }
    
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-exclamation-circle' :
            type === 'warning' ? 'fa-exclamation-triangle' :
            'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

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

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
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
// UI SCALE CONTROLLER
// ============================================

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

// ============================================
// THEME MANAGEMENT
// ============================================

function initThemeSelector() {
    console.log('🎨 Initializing theme selector...');
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    if (!themeSelector || !themeToggle) {
        console.warn('Theme selector elements not found');
        return;
    }

    // Apply saved theme on load
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);

    // Theme option click handlers
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const theme = this.dataset.theme;
            applyTheme(theme);
            setTimeout(() => themeSelector.classList.remove('active'), 100);
        });
    });

    // Toggle theme selector from sidebar
    themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    });

    // Close when clicking outside
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
        console.warn('Invalid theme:', theme, 'defaulting to dark');
        theme = 'dark';
    }

    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);

    // Apply theme-specific CSS variables
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
        default: // dark
            root.style.setProperty('--deep-black', '#0A0A0A');
            root.style.setProperty('--soft-white', '#F5F5F5');
            root.style.setProperty('--slate-grey', '#A0A0A0');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
            root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
            break;
    }

    // Force CSS variable update for INSTANT visual effect
    void root.offsetWidth;

    // Save preference
    localStorage.setItem('bantu_theme', theme);

    // Update active state on theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });

    // Show confirmation toast
    if (typeof showToast === 'function') {
        showToast(`Theme changed to ${theme}`, 'success');
    }

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: theme }
    }));
}

// ============================================
// HEADER FUNCTIONS
// ============================================

async function updateHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const currentProfileName = document.getElementById('current-profile-name');
    
    if (!profilePlaceholder || !currentProfileName) {
        console.warn('Header profile elements not found');
        return;
    }
    
    profilePlaceholder.innerHTML = '';

    // Check authentication status
    let isAuthenticated = false;
    let userProfile = null;
    
    if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
        isAuthenticated = true;
        userProfile = window.AuthHelper.getUserProfile();
    } else if (window.currentUser && window.currentUser.id) {
        isAuthenticated = true;
        userProfile = window.currentUser;
    } else if (window.supabaseClient) {
        try {
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session) {
                isAuthenticated = true;
                if (window.AuthHelper && window.AuthHelper.getUserProfile) {
                    userProfile = window.AuthHelper.getUserProfile();
                }
            }
        } catch (e) {
            console.warn('Auth check error:', e);
        }
    }

    if (isAuthenticated && userProfile) {
        try {
            // Fetch full profile from user_profiles
            let profileData = null;
            if (window.supabaseClient && userProfile.id) {
                const { data: profile } = await window.supabaseClient
                    .from('user_profiles')
                    .select('full_name, username, avatar_url')
                    .eq('id', userProfile.id)
                    .maybeSingle();
                profileData = profile;
            }

            const displayName = profileData?.full_name || 
                               profileData?.username || 
                               userProfile.full_name || 
                               userProfile.username || 
                               userProfile.email?.split('@')[0] || 
                               'User';
            currentProfileName.textContent = displayName;

            const avatarUrl = profileData?.avatar_url || userProfile.avatar_url;
            
            if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
                const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
                const img = document.createElement('img');
                img.className = 'profile-img';
                img.src = fixedUrl;
                img.alt = displayName;
                img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
                img.onerror = () => renderHeaderInitials(profilePlaceholder, displayName);
                profilePlaceholder.appendChild(img);
            } else {
                renderHeaderInitials(profilePlaceholder, displayName);
            }
            
            console.log('✅ Header profile updated for:', displayName);
        } catch (error) {
            console.error('❌ Error updating header profile:', error);
            renderHeaderInitials(profilePlaceholder, 'U');
            currentProfileName.textContent = 'User';
        }
    } else {
        // Guest state
        currentProfileName.textContent = 'Guest';
        renderHeaderInitials(profilePlaceholder, 'G');
    }
    
    // Apply mobile header styles
    applyMobileHeaderStyles();
}

function renderHeaderInitials(container, name) {
    if (!container) return;
    container.innerHTML = '';
    const initials = getInitials(name);
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem;text-transform:uppercase;';
    div.textContent = initials;
    container.appendChild(div);
}

function applyMobileHeaderStyles() {
    const isMobile = window.innerWidth <= 768;
    const profileBtn = document.querySelector('.profile-btn');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    const analyticsBtn = document.getElementById('analytics-btn');

    if (isMobile) {
        // Hide profile picture/avatar on mobile
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'none';
        }
        // Hide analytics button on mobile
        if (analyticsBtn) {
            analyticsBtn.style.display = 'none';
        }
        // Ensure button shows name properly
        if (profileBtn) {
            profileBtn.style.minWidth = 'auto';
            profileBtn.style.padding = '0.3125rem 0.75rem';
            profileBtn.style.justifyContent = 'center';
        }
        // Ensure name is visible
        if (profileNameSpan) {
            profileNameSpan.style.display = 'inline-block';
        }
    } else {
        // Show profile picture on desktop
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'flex';
        }
        // Show analytics button on desktop
        if (analyticsBtn) {
            analyticsBtn.style.display = 'flex';
        }
        if (profileBtn) {
            profileBtn.style.minWidth = '160px';
            profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
            profileBtn.style.justifyContent = 'flex-start';
        }
    }
}

// ============================================
// SIDEBAR FUNCTIONS
// ============================================

async function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');

    if (!avatar || !name || !email) {
        console.warn('Sidebar profile elements not found');
        return;
    }
    
    avatar.innerHTML = '';

    // Check authentication status
    let isAuthenticated = false;
    let userProfile = null;
    
    if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
        isAuthenticated = true;
        userProfile = window.AuthHelper.getUserProfile();
    } else if (window.currentUser && window.currentUser.id) {
        isAuthenticated = true;
        userProfile = window.currentUser;
    } else if (window.supabaseClient) {
        try {
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session) {
                isAuthenticated = true;
                if (window.AuthHelper && window.AuthHelper.getUserProfile) {
                    userProfile = window.AuthHelper.getUserProfile();
                }
            }
        } catch (e) {
            console.warn('Auth check error:', e);
        }
    }

    if (isAuthenticated && userProfile) {
        try {
            // Fetch full profile from user_profiles
            let profileData = null;
            if (window.supabaseClient && userProfile.id) {
                const { data: profile } = await window.supabaseClient
                    .from('user_profiles')
                    .select('id, full_name, username, avatar_url')
                    .eq('id', userProfile.id)
                    .maybeSingle();
                profileData = profile;
            }

            const displayName = profileData?.full_name || 
                               profileData?.username || 
                               userProfile.full_name || 
                               userProfile.username || 
                               userProfile.email?.split('@')[0] || 
                               'User';
            name.textContent = displayName;
            email.textContent = userProfile.email || 'user@example.com';

            const avatarUrl = profileData?.avatar_url || userProfile.avatar_url;
            
            if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
                const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
                const img = document.createElement('img');
                img.src = fixedUrl;
                img.alt = displayName;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
                img.onerror = () => renderSidebarInitials(avatar, displayName);
                avatar.appendChild(img);
            } else {
                renderSidebarInitials(avatar, displayName);
            }

            // Make profile clickable - go to manage profiles
            if (profileSection) {
                profileSection.onclick = () => {
                    closeSidebar();
                    window.location.href = 'manage-profiles.html';
                };
            }
            
            console.log('✅ Sidebar profile updated for:', displayName);
        } catch (err) {
            console.warn('Sidebar profile fetch error:', err);
            renderSidebarInitials(avatar, 'U');
            name.textContent = 'User';
            email.textContent = 'user@example.com';
        }
    } else {
        // Guest state
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        renderSidebarInitials(avatar, 'G');
        if (profileSection) {
            profileSection.onclick = () => {
                closeSidebar();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
}

function renderSidebarInitials(container, name) {
    if (!container) return;
    container.innerHTML = '';
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

function setupSidebar() {
    setupMobileSidebar();
    fixSidebarProfileTruncation();
    setupSidebarScaleControls();
    setupSidebarNavigation();
    setupSectionToggle();
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

    // Make closeSidebar available globally
    window.closeSidebar = closeSidebar;

    // Header menu button - open sidebar
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

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            closeSidebar();
        }
    });

    // Handle safe area insets for modern mobile devices
    if (window.CSS && CSS.supports('padding-bottom', 'env(safe-area-inset-bottom)')) {
        const sidebarFooter = document.getElementById('sidebar-footer');
        if (sidebarFooter) {
            sidebarFooter.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom))';
        }
    }
}

function closeSidebar() {
    const sidebarMenu = document.getElementById('sidebar-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarMenu) sidebarMenu.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
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
    // Watch History
    const watchHistory = document.getElementById('sidebar-watch-history');
    if (watchHistory) {
        watchHistory.addEventListener('click', async (e) => {
            e.preventDefault();
            closeSidebar();
            
            // Check authentication
            let isAuthenticated = false;
            if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
                isAuthenticated = true;
            } else if (window.currentUser && window.currentUser.id) {
                isAuthenticated = true;
            } else if (window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                isAuthenticated = !!data?.session;
            }
            
            if (!isAuthenticated) {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=watch-history.html`;
                return;
            }
            window.location.href = 'watch-history.html';
        });
    }

    // Create Content
    const createBtn = document.getElementById('sidebar-create');
    if (createBtn) {
        createBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closeSidebar();
            
            let isAuthenticated = false;
            if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
                isAuthenticated = true;
            } else if (window.currentUser && window.currentUser.id) {
                isAuthenticated = true;
            } else if (window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                isAuthenticated = !!data?.session;
            }
            
            if (!isAuthenticated) {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            } else {
                window.location.href = 'creator-upload.html';
            }
        });
    }

    // Dashboard
    const dashboardBtn = document.getElementById('sidebar-dashboard');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closeSidebar();
            
            let isAuthenticated = false;
            if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
                isAuthenticated = true;
            } else if (window.currentUser && window.currentUser.id) {
                isAuthenticated = true;
            } else if (window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                isAuthenticated = !!data?.session;
            }
            
            if (!isAuthenticated) {
                showToast('Please sign in to access dashboard', 'warning');
                window.location.href = `login.html?redirect=creator-dashboard.html`;
            } else {
                window.location.href = 'creator-dashboard.html';
            }
        });
    }

    // Badges
    const badgesBtn = document.getElementById('sidebar-badges');
    if (badgesBtn) {
        badgesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            const badgesModal = document.getElementById('badges-modal');
            if (badgesModal) {
                badgesModal.classList.add('active');
            }
        });
    }

    // Watch Party
    const watchPartyBtn = document.getElementById('sidebar-watch-party');
    if (watchPartyBtn) {
        watchPartyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            const watchPartyModal = document.getElementById('watch-party-modal');
            if (watchPartyModal) {
                watchPartyModal.classList.add('active');
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closeSidebar();
            
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            if (window.AuthHelper && window.AuthHelper.logout) {
                await window.AuthHelper.logout();
            }
            
            // Reset UI
            window.currentUser = null;
            await updateSidebarProfile();
            await updateHeaderProfile();
            
            showToast('Signed out successfully', 'success');
            window.location.reload();
        });
    }
}

function setupSectionToggle() {
    const sections = document.querySelectorAll('.sidebar-section');
    sections.forEach(section => {
        const header = section.querySelector('.sidebar-section-header');
        if (!header) return;
        
        const items = section.querySelector('.sidebar-section-items');
        const toggleIcon = header.querySelector('.toggle-icon');
        
        // Load saved state
        const sectionName = section.dataset.section;
        const savedState = localStorage.getItem(`sidebar_section_${sectionName}`);
        if (savedState === 'collapsed' && items) {
            items.classList.add('collapsed');
            header.classList.add('collapsed');
            if (toggleIcon) toggleIcon.style.transform = 'rotate(-90deg)';
        }
        
        header.addEventListener('click', () => {
            if (items) {
                items.classList.toggle('collapsed');
                header.classList.toggle('collapsed');
                if (toggleIcon) {
                    const isCollapsed = items.classList.contains('collapsed');
                    toggleIcon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                }
                // Save state
                localStorage.setItem(`sidebar_section_${sectionName}`, 
                    items.classList.contains('collapsed') ? 'collapsed' : 'expanded');
            }
        });
    });
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
// BOTTOM NAVIGATION BUTTONS
// ============================================

function setupNavigationButtons() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');

    // Home Button
    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    // Create Content Button
    if (navCreateBtn) {
        navCreateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            let isAuthenticated = false;
            if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
                isAuthenticated = true;
            } else if (window.currentUser && window.currentUser.id) {
                isAuthenticated = true;
            } else if (window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                isAuthenticated = !!data?.session;
            }
            
            if (isAuthenticated) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = `login.html?redirect=creator-upload.html`;
            }
        });
    }

    // Menu Button - Open Sidebar
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
            }
        });
    }

    // Watch History Button
    if (navHistoryBtn) {
        navHistoryBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            let isAuthenticated = false;
            if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
                isAuthenticated = true;
            } else if (window.currentUser && window.currentUser.id) {
                isAuthenticated = true;
            } else if (window.supabaseClient) {
                const { data } = await window.supabaseClient.auth.getSession();
                isAuthenticated = !!data?.session;
            }
            
            if (!isAuthenticated) {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=watch-history.html`;
                return;
            }
            window.location.href = 'watch-history.html';
        });
    }
}

function setupNavButtonScrollAnimation() {
    let lastScrollTop = 0;
    const navContainer = document.querySelector('.navigation-button-container');
    if (!navContainer) return;
    
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
// PROFILE DROPDOWN
// ============================================

function updateProfileSwitcher() {
    const profileList = document.getElementById('profile-list');
    const currentProfileName = document.getElementById('current-profile-name');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    
    if (!profileList || !currentProfileName || !profilePlaceholder) return;

    // Check authentication
    let isAuthenticated = false;
    let userProfile = null;
    
    if (window.AuthHelper && window.AuthHelper.isAuthenticated && window.AuthHelper.isAuthenticated()) {
        isAuthenticated = true;
        userProfile = window.AuthHelper.getUserProfile();
    } else if (window.currentUser && window.currentUser.id) {
        isAuthenticated = true;
        userProfile = window.currentUser;
    }

    if (isAuthenticated && userProfile) {
        const displayName = userProfile.full_name || userProfile.username || userProfile.email?.split('@')[0] || 'User';
        currentProfileName.textContent = displayName;
        
        // Update placeholder
        const avatarUrl = userProfile.avatar_url;
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined') {
            const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            profilePlaceholder.innerHTML = `<img src="${fixedUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            const initials = getInitials(displayName);
            profilePlaceholder.innerHTML = `<div class="profile-placeholder" style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px">${initials}</div>`;
        }
        
        profileList.innerHTML = `
            <div class="profile-item active" data-profile="main">
                <div class="profile-avatar-small">
                    ${profilePlaceholder.cloneNode(true).outerHTML}
                </div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(displayName)}</div>
                    <div class="profile-type">Main Profile</div>
                </div>
            </div>
            <div class="profile-dropdown-footer">
                <button class="text-btn" id="manage-profiles-btn">
                    <i class="fas fa-user-cog"></i> Manage Profiles
                </button>
                <button class="text-btn" id="logout-dropdown-btn">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        `;
        
        // Add manage profiles handler
        const manageBtn = document.getElementById('manage-profiles-btn');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                window.location.href = 'manage-profiles.html';
            });
        }
        
        // Add logout handler
        const logoutBtn = document.getElementById('logout-dropdown-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (window.supabaseClient) {
                    await window.supabaseClient.auth.signOut();
                }
                if (window.AuthHelper && window.AuthHelper.logout) {
                    await window.AuthHelper.logout();
                }
                window.currentUser = null;
                await updateSidebarProfile();
                await updateHeaderProfile();
                updateProfileSwitcher();
                showToast('Signed out successfully', 'success');
            });
        }
    } else {
        currentProfileName.textContent = 'Guest';
        profilePlaceholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
        
        profileList.innerHTML = `
            <div class="profile-item" onclick="window.location.href='login.html'">
                <div class="profile-avatar-small">
                    <i class="fas fa-sign-in-alt"></i>
                </div>
                <div class="profile-info">
                    <div class="profile-name">Sign In</div>
                    <div class="profile-type">To access your profile</div>
                </div>
            </div>
        `;
    }

    // Profile dropdown toggle
    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    if (profileBtn && dropdown) {
        // Remove existing listeners by cloning
        const newProfileBtn = profileBtn.cloneNode(true);
        profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
        
        newProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (!newProfileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    applyMobileHeaderStyles();
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function setupModals() {
    // Close modals when clicking escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.analytics-modal.active, .search-modal.active, .notifications-panel.active, .theme-selector.active, .playlist-modal.active')
                .forEach(modal => {
                    modal.classList.remove('active');
                });
        }
    });

    // Close button handlers
    const closeAnalytics = document.getElementById('close-analytics');
    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', () => {
            document.getElementById('analytics-modal')?.classList.remove('active');
        });
    }

    const closeSearch = document.getElementById('close-search-btn');
    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            document.getElementById('search-modal')?.classList.remove('active');
        });
    }

    const closeNotifications = document.getElementById('close-notifications');
    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            document.getElementById('notifications-panel')?.classList.remove('active');
        });
    }

    const closeBadges = document.getElementById('close-badges');
    if (closeBadges) {
        closeBadges.addEventListener('click', () => {
            document.getElementById('badges-modal')?.classList.remove('active');
        });
    }

    const closeWatchParty = document.getElementById('close-watch-party');
    if (closeWatchParty) {
        closeWatchParty.addEventListener('click', () => {
            document.getElementById('watch-party-modal')?.classList.remove('active');
        });
    }
}

// ============================================
// INITIALIZATION FUNCTIONS
// ============================================

async function initializeSharedComponents() {
    console.log('🚀 Initializing shared components...');
    
    // Initialize UI Scale Controller
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    // Initialize Theme Selector
    initThemeSelector();
    
    // Setup Sidebar
    setupSidebar();
    
    // Setup Navigation Buttons
    setupNavigationButtons();
    setupNavButtonScrollAnimation();
    
    // Setup Modals
    setupModals();
    
    // Update profiles
    await updateSidebarProfile();
    await updateHeaderProfile();
    updateProfileSwitcher();
    
    // Setup auth state listener
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                await updateSidebarProfile();
                await updateHeaderProfile();
                updateProfileSwitcher();
                showToast('Welcome back!', 'success');
            } else if (event === 'SIGNED_OUT') {
                await updateSidebarProfile();
                await updateHeaderProfile();
                updateProfileSwitcher();
                showToast('Signed out', 'info');
            }
        });
    }
    
    // Apply mobile styles on resize
    window.addEventListener('resize', () => {
        applyMobileHeaderStyles();
        optimizeMobileSidebar();
    });
    
    console.log('✅ Shared components initialized');
}

// Export for global use
window.showToast = showToast;
window.formatDuration = formatDuration;
window.formatNumber = formatNumber;
window.getInitials = getInitials;
window.truncateText = truncateText;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.UIScaleController = UIScaleController;
window.applyTheme = applyTheme;
window.initThemeSelector = initThemeSelector;
window.updateHeaderProfile = updateHeaderProfile;
window.updateSidebarProfile = updateSidebarProfile;
window.updateProfileSwitcher = updateProfileSwitcher;
window.applyMobileHeaderStyles = applyMobileHeaderStyles;
window.closeSidebar = closeSidebar;
window.initializeSharedComponents = initializeSharedComponents;

console.log('✅ Shared Components loaded successfully');
