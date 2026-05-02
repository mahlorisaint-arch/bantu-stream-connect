// ============================================ */
// SHARED COMPONENTS JS - BANTU STREAM CONNECT */
// Platform-wide JavaScript with FULL AUTH INTEGRATION */
// ============================================ */

console.log('📦 Shared Components v2.0 - Loading with Auth Integration...');

// ============================================ */
// GLOBAL VARIABLES */
// ============================================ */
window.platformComponents = window.platformComponents || {
    initialized: false,
    currentUser: null,
    currentProfile: null,
    uiScaleController: null,
    supabaseClient: null
};

// ============================================ */
// AUTH INTEGRATION - Get user from AuthHelper */
// ============================================ */
async function getCurrentUser() {
    // Try AuthHelper first
    if (window.AuthHelper && typeof window.AuthHelper.isAuthenticated === 'function') {
        if (window.AuthHelper.isAuthenticated()) {
            const userProfile = window.AuthHelper.getUserProfile();
            if (userProfile && userProfile.id) {
                return {
                    id: userProfile.id,
                    email: userProfile.email,
                    full_name: userProfile.full_name || userProfile.username || userProfile.email?.split('@')[0] || 'User',
                    avatar_url: userProfile.avatar_url,
                    username: userProfile.username
                };
            }
        }
    }
    
    // Try Supabase directly
    if (window.supabaseClient) {
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (user) {
                // Fetch profile from user_profiles
                const { data: profile } = await window.supabaseClient
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                    
                return {
                    id: user.id,
                    email: user.email,
                    full_name: profile?.full_name || profile?.username || user.email?.split('@')[0] || 'User',
                    avatar_url: profile?.avatar_url,
                    username: profile?.username
                };
            }
        } catch (e) {
            console.warn('Error getting user from Supabase:', e);
        }
    }
    
    return null;
}

// ============================================ */
// UPDATE HEADER PROFILE - Shows logged-in user */
// ============================================ */
async function updateHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    
    if (!profilePlaceholder) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        // User is logged in
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const initial = displayName.charAt(0).toUpperCase();
        
        if (profileNameSpan) {
            profileNameSpan.textContent = displayName;
        }
        
        // Clear placeholder
        profilePlaceholder.innerHTML = '';
        
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            // Fix avatar URL if needed
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = displayName;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
            img.onerror = () => {
                profilePlaceholder.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem;">${initial}</div>`;
            };
            profilePlaceholder.appendChild(img);
        } else {
            // Show initials
            profilePlaceholder.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem;">${initial}</div>`;
        }
        
        // Make profile button clickable to profile page
        const profileBtn = document.getElementById('current-profile-btn');
        if (profileBtn) {
            profileBtn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = 'manage-profiles.html';
            };
        }
    } else {
        // Guest user
        if (profileNameSpan) {
            profileNameSpan.textContent = 'Guest';
        }
        profilePlaceholder.innerHTML = '<i class="fas fa-user"></i>';
        
        const profileBtn = document.getElementById('current-profile-btn');
        if (profileBtn) {
            profileBtn.onclick = (e) => {
                e.stopPropagation();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
    
    // Apply mobile styles
    applyMobileHeaderStyles();
}

// ============================================ */
// UPDATE SIDEBAR PROFILE - Shows logged-in user */
// ============================================ */
async function updateSidebarProfile() {
    const avatarDiv = document.getElementById('sidebar-profile-avatar');
    const nameSpan = document.getElementById('sidebar-profile-name');
    const emailSpan = document.getElementById('sidebar-profile-email');
    const profileDiv = document.getElementById('sidebar-profile');
    
    if (!avatarDiv || !nameSpan || !emailSpan) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        // User is logged in
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const userEmail = user.email || 'user@example.com';
        const initial = displayName.charAt(0).toUpperCase();
        
        nameSpan.textContent = displayName;
        emailSpan.textContent = userEmail;
        
        // Clear avatar
        avatarDiv.innerHTML = '';
        
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            // Fix avatar URL if needed
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = displayName;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
            img.onerror = () => {
                avatarDiv.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initial}</span>`;
            };
            avatarDiv.appendChild(img);
        } else {
            // Show initials
            avatarDiv.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initial}</span>`;
        }
        
        // Make profile clickable
        if (profileDiv) {
            profileDiv.onclick = () => {
                window.location.href = 'manage-profiles.html';
            };
        }
        
        // Show creator section if user is creator
        await checkAndShowCreatorSection(user.id);
        
    } else {
        // Guest user
        nameSpan.textContent = 'Guest';
        emailSpan.textContent = 'Sign in to continue';
        avatarDiv.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;"></i>';
        
        if (profileDiv) {
            profileDiv.onclick = () => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
}

// ============================================ */
// CHECK IF USER IS CREATOR AND SHOW CREATOR SECTION */
// ============================================ */
async function checkAndShowCreatorSection(userId) {
    if (!userId || !window.supabaseClient) return;
    
    try {
        // Check if user has any published content
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'published')
            .limit(1);
            
        if (!error && data && data.length > 0) {
            // User is a creator, show creator section
            const creatorSection = document.querySelector('.sidebar-section[data-section="creator"]');
            if (creatorSection) {
                creatorSection.style.display = 'block';
            }
            
            // Also show creator mode toggle
            const creatorModeToggle = document.getElementById('creatorModeToggle');
            if (creatorModeToggle) {
                creatorModeToggle.style.display = 'flex';
            }
        }
    } catch (e) {
        console.warn('Error checking creator status:', e);
    }
}

// ============================================ */
// UPDATE PROFILE DROPDOWN LIST */
// ============================================ */
async function updateProfileDropdown() {
    const profileList = document.getElementById('profile-list');
    if (!profileList) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const initial = displayName.charAt(0).toUpperCase();
        
        let avatarHtml = '';
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            avatarHtml = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initial}</div>`;
        }
        
        profileList.innerHTML = `
            <div class="profile-item active" data-profile="main">
                <div class="profile-avatar-small">
                    ${avatarHtml}
                </div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(displayName)}</div>
                    <div class="profile-type">Main Profile</div>
                </div>
            </div>
        `;
    } else {
        profileList.innerHTML = `
            <div class="profile-item" onclick="window.location.href='login.html?redirect=${encodeURIComponent(window.location.pathname)}'">
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
}

// ============================================ */
// MAKE HEADER BUTTONS CLICKABLE */
// ============================================ */
function setupHeaderButtons() {
    // Voice Search Button
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    if (voiceSearchBtn) {
        voiceSearchBtn.onclick = () => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                showToast('Voice search coming soon!', 'info');
            } else {
                showToast('Voice search not supported in this browser', 'warning');
            }
        };
    }
    
    // Analytics Button
    const analyticsBtn = document.getElementById('analytics-btn');
    if (analyticsBtn) {
        analyticsBtn.onclick = () => {
            const modal = document.getElementById('analytics-modal');
            if (modal) {
                modal.classList.add('active');
                loadAnalyticsData();
            } else {
                showToast('Analytics modal not available', 'warning');
            }
        };
    }
    
    // Search Button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.onclick = () => {
            const modal = document.getElementById('search-modal');
            if (modal) {
                modal.classList.add('active');
                const searchInput = document.getElementById('search-input');
                if (searchInput) setTimeout(() => searchInput.focus(), 100);
            }
        };
    }
    
    // Notifications Button
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        notificationsBtn.onclick = () => {
            const panel = document.getElementById('notifications-panel');
            if (panel) {
                panel.classList.add('active');
                loadNotifications();
            }
        };
    }
}

// ============================================ */
// LOAD ANALYTICS DATA */
// ============================================ */
async function loadAnalyticsData() {
    const totalViewsEl = document.getElementById('total-views');
    const engagementRateEl = document.getElementById('engagement-rate');
    
    if (!totalViewsEl) return;
    
    const user = await getCurrentUser();
    if (!user || !user.id) {
        totalViewsEl.textContent = '0';
        if (engagementRateEl) engagementRateEl.textContent = '0%';
        return;
    }
    
    if (window.supabaseClient) {
        try {
            // Get total views for user's content
            const { data: contentList } = await window.supabaseClient
                .from('Content')
                .select('id')
                .eq('user_id', user.id);
                
            if (contentList && contentList.length > 0) {
                const contentIds = contentList.map(c => c.id);
                const { count: totalViews } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .in('content_id', contentIds);
                    
                totalViewsEl.textContent = totalViews ? formatNumber(totalViews) : '0';
                if (engagementRateEl) engagementRateEl.textContent = '15%';
            }
        } catch (e) {
            console.warn('Error loading analytics:', e);
        }
    }
}

// ============================================ */
// LOAD NOTIFICATIONS */
// ============================================ */
async function loadNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    const user = await getCurrentUser();
    if (!user || !user.id) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>Sign in to see notifications</p>
            </div>
        `;
        return;
    }
    
    if (window.supabaseClient) {
        try {
            const { data: notifications, error } = await window.supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
                
            if (error) throw error;
            
            if (!notifications || notifications.length === 0) {
                notificationsList.innerHTML = `
                    <div class="empty-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
                return;
            }
            
            notificationsList.innerHTML = notifications.map(n => `
                <div class="notification-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}">
                    <div class="notification-icon">
                        <i class="fas ${getNotificationIcon(n.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <h4>${escapeHtml(n.title)}</h4>
                        <p>${escapeHtml(n.message)}</p>
                        <span class="notification-time">${formatTimeAgo(n.created_at)}</span>
                    </div>
                </div>
            `).join('');
            
            const unreadCount = notifications.filter(n => !n.is_read).length;
            updateNotificationBadge(unreadCount);
            
        } catch (e) {
            console.warn('Error loading notifications:', e);
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading notifications</p>
                </div>
            `;
        }
    }
}

function getNotificationIcon(type) {
    const icons = {
        like: 'fa-heart',
        comment: 'fa-comment',
        follow: 'fa-user-plus',
        view_milestone: 'fa-trophy',
        system: 'fa-bell'
    };
    return icons[type] || 'fa-bell';
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-count');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================ */
// SETUP BOTTOM NAVIGATION */
// ============================================ */
function setupBottomNavigation() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    
    if (navHomeBtn) {
        navHomeBtn.onclick = () => {
            window.location.href = 'index.html';
        };
    }
    
    if (navHistoryBtn) {
        navHistoryBtn.onclick = async () => {
            const user = await getCurrentUser();
            if (user && user.id) {
                window.location.href = 'watch-history.html';
            } else {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=${encodeURIComponent('watch-history.html')}`;
            }
        };
    }
    
    if (navCreateBtn) {
        navCreateBtn.onclick = async () => {
            const user = await getCurrentUser();
            if (user && user.id) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
            }
        };
    }
    
    if (navMenuBtn) {
        navMenuBtn.onclick = () => {
            const sidebar = document.getElementById('sidebar-menu');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar && overlay) {
                sidebar.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        };
    }
}

// ============================================ */
// SETUP SIDEBAR TOGGLES */
// ============================================ */
function setupSidebarToggles() {
    document.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = newHeader.closest('.sidebar-section');
            const items = section.querySelector('.sidebar-section-items');
            const icon = newHeader.querySelector('.toggle-icon');
            
            if (items.classList.contains('collapsed')) {
                items.classList.remove('collapsed');
                newHeader.classList.remove('collapsed');
                if (icon) icon.style.transform = 'rotate(0deg)';
            } else {
                items.classList.add('collapsed');
                newHeader.classList.add('collapsed');
                if (icon) icon.style.transform = 'rotate(-90deg)';
            }
        });
    });
}

// ============================================ */
// SETUP SIDEBAR CLOSE */
// ============================================ */
function setupSidebarClose() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    if (menuToggle) {
        const newToggle = menuToggle.cloneNode(true);
        menuToggle.parentNode.replaceChild(newToggle, menuToggle);
        newToggle.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        };
    }
    
    if (sidebarClose) {
        sidebarClose.onclick = () => {
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        };
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.onclick = () => {
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        };
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu?.classList.contains('active')) {
            sidebarMenu.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ============================================ */
// SETUP LOGOUT */
// ============================================ */
function setupLogout() {
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (window.AuthHelper && typeof window.AuthHelper.logout === 'function') {
                await window.AuthHelper.logout();
            } else if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };
    }
}

// ============================================ */
// UI SCALE CONTROLLER */
// ============================================ */
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
            this.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    decrease() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.step);
            this.applyScale();
            this.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    reset() {
        this.scale = 1;
        this.applyScale();
        this.showToast('UI Size reset to default', 'success');
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

    showToast(message, type) {
        if (window.showToast) window.showToast(message, type);
    }
}

// ============================================ */
// SETUP SIDEBAR SCALE CONTROLS */
// ============================================ */
function setupSidebarScaleControls() {
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');
    
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    const updateDisplay = () => {
        if (scaleValue) {
            scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
        }
    };
    
    if (decreaseBtn) {
        decreaseBtn.onclick = () => {
            window.uiScaleController.decrease();
            updateDisplay();
        };
    }
    if (increaseBtn) {
        increaseBtn.onclick = () => {
            window.uiScaleController.increase();
            updateDisplay();
        };
    }
    if (resetBtn) {
        resetBtn.onclick = () => {
            window.uiScaleController.reset();
            updateDisplay();
        };
    }
    
    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);
}

// ============================================ */
// THEME MANAGEMENT */
// ============================================ */
function initThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    if (!themeSelector || !themeToggle) return;
    
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeSelector.classList.remove('active');
        };
    });
    
    themeToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    };
    
    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') &&
            !themeSelector.contains(e.target) &&
            !themeToggle.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
        theme = 'dark';
    }
    
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);
    
    localStorage.setItem('bantu_theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    if (window.showToast) {
        window.showToast(`Theme changed to ${theme}`, 'success');
    }
}

// ============================================ */
// BACK TO TOP BUTTON */
// ============================================ */
function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;
    
    backToTopBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
}

// ============================================ */
// MOBILE HEADER STYLES */
// ============================================ */
function applyMobileHeaderStyles() {
    const isMobile = window.innerWidth <= 768;
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    const profileBtn = document.querySelector('.profile-btn');
    
    if (isMobile) {
        if (profilePlaceholder) profilePlaceholder.style.display = 'none';
        if (profileBtn) {
            profileBtn.style.minWidth = 'auto';
            profileBtn.style.padding = '0.3125rem 0.75rem';
        }
        if (profileNameSpan) profileNameSpan.style.display = 'inline-block';
    } else {
        if (profilePlaceholder) profilePlaceholder.style.display = 'flex';
        if (profileBtn) {
            profileBtn.style.minWidth = '160px';
            profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
        }
    }
}

// ============================================ */
// PROFILE DROPDOWN TOGGLE */
// ============================================ */
function setupProfileDropdown() {
    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
        
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    if (manageProfilesBtn) {
        manageProfilesBtn.onclick = () => {
            window.location.href = 'manage-profiles.html';
        };
    }
}

// ============================================ */
// TOAST NOTIFICATION SYSTEM */
// ============================================ */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================ */
// UTILITY FUNCTIONS */
// ============================================ */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// ============================================ */
// LISTEN FOR AUTH STATE CHANGES */
// ============================================ */
function setupAuthListener() {
    // Listen for auth state changes from Supabase
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            // Refresh all profile displays
            await updateHeaderProfile();
            await updateSidebarProfile();
            await updateProfileDropdown();
            
            if (event === 'SIGNED_IN') {
                showToast('Welcome back!', 'success');
            } else if (event === 'SIGNED_OUT') {
                showToast('Signed out', 'info');
            }
        });
    }
    
    // Also listen for custom auth ready event
    document.addEventListener('authReady', async () => {
        await updateHeaderProfile();
        await updateSidebarProfile();
        await updateProfileDropdown();
    });
}

// ============================================ */
// MAIN INITIALIZATION */
// ============================================ */
async function initSharedComponents() {
    if (window.platformComponents.initialized) {
        console.log('⚠️ Shared components already initialized');
        return;
    }
    
    console.log('🚀 Initializing shared components with auth...');
    
    // Setup all components
    setupHeaderButtons();
    setupBottomNavigation();
    setupSidebarClose();
    setupSidebarToggles();
    setupSidebarScaleControls();
    setupBackToTop();
    setupProfileDropdown();
    setupLogout();
    setupAuthListener();
    initThemeSelector();
    
    // Update profiles with user data
    await updateHeaderProfile();
    await updateSidebarProfile();
    await updateProfileDropdown();
    
    // Apply mobile styles
    applyMobileHeaderStyles();
    window.addEventListener('resize', applyMobileHeaderStyles);
    
    // Setup UI Scale Controller
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    // Make functions globally available
    window.showToast = showToast;
    window.getCurrentUser = getCurrentUser;
    window.updateHeaderProfile = updateHeaderProfile;
    window.updateSidebarProfile = updateSidebarProfile;
    
    window.platformComponents.initialized = true;
    console.log('✅ Shared components initialized successfully');
}

// ============================================ */
// AUTO-INITIALIZE WHEN DOM READY */
// ============================================ */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedComponents);
} else {
    initSharedComponents();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSharedComponents,
        showToast,
        getCurrentUser,
        updateHeaderProfile,
        updateSidebarProfile,
        UIScaleController
    };
}
