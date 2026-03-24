// js/content-detail.js - COMPLETE WITH ALL UPDATES
// Integrated with Sidebar, Header, Navigation Button features
// Phase 1-4: Watch Session, Playlist, Recommendations, Streaming
// YouTube-style video player with hero section below
// Mobile-optimized with full-width video

console.log('🎬 Content Detail Initializing with all UI features...');

// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let watchSession = null;
let playlistManager = null;
let recommendationEngine = null;
let streamingManager = null;
let keyboardShortcuts = null;
let playlistModal = null;
let isInitialized = false;
let currentUserId = null;

// UI Scale Controller
class UIScaleController {
    constructor() {
        this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
        this.minScale = 0.8;
        this.maxScale = 1.4;
        this.step = 0.1;
    }

    init() {
        this.applyScale();
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
}

// Initialize UI Scale Controller
window.uiScaleController = new UIScaleController();
window.uiScaleController.init();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOM loaded, starting initialization...');
  
  // Initialize Supabase client
  if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(
      'https://ydnxqnbjoshvxteevemc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    );
  }
  
  // Load helpers
  if (!window.SupabaseHelper) await import('./supabase-helper.js');
  if (!window.AuthHelper) await import('./auth-helper.js');
  
  // Wait for helpers
  await waitForHelpers();
  
  // Setup auth listeners
  setupAuthListeners();
  
  // Load content
  await loadContentFromURL();
  
  // Setup all UI components
  setupEventListeners();
  setupCompleteSidebar();
  setupHeaderProfile();
  setupNavigationButtons();
  setupNavButtonScrollAnimation();
  setupThemeSelector();
  
  // Initialize video player
  initializeEnhancedVideoPlayer();
  
  // Initialize streaming manager
  await initializeStreamingManager();
  
  // Initialize all modals/panels
  initAnalyticsModal();
  initSearchModal();
  initNotificationsPanel();
  initGlobalNavigation();
  
  // Load Continue Watching section
  if (currentUserId) {
    await loadContinueWatching(currentUserId);
    setupContinueWatchingRefresh();
  }
  
  // Initialize Playlist Manager
  if (window.PlaylistManager && currentUserId) {
    await initializePlaylistManager();
  }
  
  // Initialize Recommendation Engine
  if (currentContent?.id) {
    await initializeRecommendationEngine();
  }
  
  // Initialize keyboard shortcuts
  setTimeout(() => {
    if (enhancedVideoPlayer?.video) {
      initializeKeyboardShortcuts();
    }
  }, 1000);
  
  // Initialize playlist modal
  if (currentUserId && currentContent?.id) {
    setTimeout(() => {
      initializePlaylistModal();
    }, 500);
  }
  
  // Show app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  // Dispatch ready event
  document.dispatchEvent(new CustomEvent('contentDetailReady'));
  
  console.log('✅ Content Detail fully initialized with all UI features');
});

// ============================================
// SIDEBAR FUNCTIONS
// ============================================

function setupCompleteSidebar() {
    setupMobileSidebar();
    fixSidebarProfileTruncation();
    setupSidebarScaleControls();
    setupSidebarNavigation();
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
    
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openSidebar();
    });
    
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    if (window.CSS && CSS.supports('padding-bottom', 'env(safe-area-inset-bottom)')) {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter) {
            sidebarFooter.style.paddingBottom = 'max(16px, env(safe-area-inset-bottom))';
        }
    }
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
    
    const updateDisplay = () => {
        if (scaleValue && window.uiScaleController) {
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
    // Analytics
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
            loadContentAnalytics();
        }
    });
    
    // Notifications
    document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel) {
            notificationsPanel.classList.add('active');
            loadUserNotifications();
        }
    });
    
    // Badges
    document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to view badges', 'warning');
            return;
        }
        showToast('Badges feature coming soon!', 'info');
    });
    
    // Watch Party
    document.getElementById('sidebar-watch-party')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        if (!window.currentUser) {
            showToast('Please sign in to start a watch party', 'warning');
            return;
        }
        showToast('Watch Party feature coming soon!', 'info');
    });
    
    // Create Content
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
    
    // Dashboard
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
    
    // Watch History
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
    
    // Manage Profiles
    document.getElementById('manage-profiles-sidebar')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();
        window.location.href = 'manage-profiles.html';
    });
}

function optimizeMobileSidebar() {
    const isMobile = window.innerWidth <= 768;
    const sidebarMenu = document.getElementById('sidebar-menu');
    if (!sidebarMenu) return;
    
    if (isMobile) {
        sidebarMenu.style.width = '85%';
        sidebarMenu.style.maxWidth = '300px';
    } else {
        sidebarMenu.style.width = '18rem';
        sidebarMenu.style.maxWidth = '';
    }
}

async function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');
    
    if (!avatar || !name || !email) return;

    avatar.innerHTML = '';

    if (window.currentUser) {
        try {
            const { data: profile, error } = await window.supabaseClient
                .from('user_profiles')
                .select('id, full_name, username, avatar_url')
                .eq('id', window.currentUser.id)
                .maybeSingle();
            
            if (error) {
                renderSidebarFallback(avatar, name, email, window.currentUser);
                return;
            }

            if (profile) {
                name.textContent = profile.full_name || profile.username || 'User';
                email.textContent = window.currentUser.email;
                
                if (profile.avatar_url) {
                    const avatarUrl = fixAvatarUrl(profile.avatar_url);
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
                renderSidebarFallback(avatar, name, email, window.currentUser);
            }
        } catch (err) {
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
        font-size:1.2rem;
        font-weight:bold;
        color:var(--soft-white);
        display:flex;
        align-items:center;
        justify-content:center;
        width:100%;
        height:100%;
    `;
    span.textContent = initials;
    container.appendChild(span);
}

function renderSidebarFallback(avatar, name, email, user) {
    avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
    name.textContent = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    email.textContent = user?.email || 'User';
}

function fixAvatarUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
        return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.substring(1)}`;
    }
    return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url}`;
}

// ============================================
// HEADER FUNCTIONS
// ============================================

async function setupHeaderProfile() {
    await updateHeaderProfile();
    await updateProfileSwitcher();
}

async function updateHeaderProfile() {
    try {
        const profilePlaceholder = document.getElementById('userProfilePlaceholder');
        const currentProfileName = document.getElementById('current-profile-name');
        
        if (!profilePlaceholder || !currentProfileName) return;

        profilePlaceholder.innerHTML = '';

        if (window.currentUser) {
            try {
                const { data: profile, error } = await window.supabaseClient
                    .from('user_profiles')
                    .select('id, full_name, username, avatar_url')
                    .eq('id', window.currentUser.id)
                    .maybeSingle();
                
                if (error) {
                    renderFallbackHeaderProfile(profilePlaceholder, currentProfileName, window.currentUser);
                    return;
                }

                if (profile && profile.avatar_url) {
                    const avatarUrl = fixAvatarUrl(profile.avatar_url);
                    const img = document.createElement('img');
                    img.className = 'profile-img';
                    img.src = avatarUrl;
                    img.alt = profile.full_name || profile.username || 'Profile';
                    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
                    img.onerror = () => renderHeaderInitials(profilePlaceholder, profile);
                    profilePlaceholder.appendChild(img);
                    currentProfileName.textContent = profile.full_name || profile.username || window.currentUser.email?.split('@')[0] || 'User';
                } else {
                    renderHeaderInitials(profilePlaceholder, profile || { full_name: window.currentUser.user_metadata?.full_name });
                    currentProfileName.textContent = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
                }
            } catch (fetchError) {
                renderFallbackHeaderProfile(profilePlaceholder, currentProfileName, window.currentUser);
            }
        } else {
            renderGuestHeaderProfile(profilePlaceholder, currentProfileName);
        }
    } catch (error) {
        console.error('updateHeaderProfile error:', error);
        const placeholder = document.getElementById('userProfilePlaceholder');
        const nameEl = document.getElementById('current-profile-name');
        if (placeholder && nameEl) {
            renderFallbackHeaderProfile(placeholder, nameEl, window.currentUser);
        }
    }
}

function renderHeaderInitials(container, profile) {
    if (!container) return;
    container.innerHTML = '';
    const name = profile?.full_name || profile?.username || 'User';
    const initials = getInitials(name);
    
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = `
        width:100%;
        height:100%;
        border-radius:50%;
        background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:bold;
        font-size:16px;
        text-transform:uppercase;
    `;
    div.textContent = initials;
    container.appendChild(div);
}

function renderGuestHeaderProfile(container, nameElement) {
    if (!container) return;
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = `
        width:100%;
        height:100%;
        border-radius:50%;
        background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:bold;
        font-size:16px;
    `;
    div.textContent = 'G';
    container.appendChild(div);
    
    if (nameElement) {
        nameElement.textContent = 'Guest';
    }
}

function renderFallbackHeaderProfile(container, nameElement, user) {
    if (!container) return;
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'profile-placeholder';
    div.style.cssText = `
        width:100%;
        height:100%;
        border-radius:50%;
        background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:bold;
        font-size:16px;
    `;
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'U';
    div.textContent = displayName.charAt(0).toUpperCase();
    container.appendChild(div);
    
    if (nameElement) {
        nameElement.textContent = displayName;
    }
}

async function updateProfileSwitcher() {
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
            img.src = fixAvatarUrl(window.currentProfile.avatar_url);
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
                        ? `<img src="${fixAvatarUrl(profile.avatar_url)}" alt="${escapeHtml(profile.name)}">`
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
                await loadContinueWatching(currentUserId);
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
}

// ============================================
// BOTTOM NAVIGATION BUTTON FUNCTIONS
// ============================================

function setupNavigationButtons() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');
    
    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    if (navCreateBtn) {
        navCreateBtn.addEventListener('click', async () => {
            const { data } = await window.supabaseClient.auth.getSession();
            if (data?.session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = 'login.html?redirect=creator-upload.html';
            }
        });
    }
    
    if (navHistoryBtn) {
        navHistoryBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=watch-history.html`;
                return;
            }
            window.location.href = 'watch-history.html';
        });
    }
    
    if (navMenuBtn) {
        navMenuBtn.addEventListener('click', () => {
            const sidebarMenu = document.getElementById('sidebar-menu');
            const sidebarOverlay = document.getElementById('sidebar-overlay');
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
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
// THEME FUNCTIONS
// ============================================

function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    const navThemeToggle = document.getElementById('nav-theme-toggle');
    
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const theme = this.dataset.theme;
            applyTheme(theme);
            setTimeout(() => {
                if (themeSelector) themeSelector.classList.remove('active');
            }, 100);
        });
    });
    
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (themeSelector) themeSelector.classList.toggle('active');
        });
    }
    
    if (navThemeToggle) {
        navThemeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (themeSelector) themeSelector.classList.toggle('active');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (themeSelector && themeSelector.classList.contains('active') &&
            !themeSelector.contains(e.target) &&
            !themeToggle?.contains(e.target) &&
            !navThemeToggle?.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
        theme = 'dark';
    }
    
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    document.body.classList.add('theme-' + theme);
    
    localStorage.setItem('bantu_theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    updateThemeCSSVariables(theme);
    
    showToast('Theme changed to ' + theme, 'success');
}

function updateThemeCSSVariables(theme) {
    const root = document.documentElement;
    
    if (theme === 'light') {
        root.style.setProperty('--deep-black', '#F8FAFC');
        root.style.setProperty('--deep-navy', '#FFFFFF');
        root.style.setProperty('--soft-white', '#0F172A');
        root.style.setProperty('--slate-grey', '#64748B');
        root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
        root.style.setProperty('--card-border', 'rgba(100, 116, 139, 0.2)');
    } else if (theme === 'high-contrast') {
        root.style.setProperty('--deep-black', '#000000');
        root.style.setProperty('--deep-navy', '#111827');
        root.style.setProperty('--soft-white', '#FFFFFF');
        root.style.setProperty('--slate-grey', '#E5E7EB');
        root.style.setProperty('--card-bg', 'rgba(17, 24, 39, 0.95)');
        root.style.setProperty('--card-border', '#FFFFFF');
    } else {
        root.style.setProperty('--deep-black', '#0A0E12');
        root.style.setProperty('--deep-navy', '#0F172A');
        root.style.setProperty('--soft-white', '#F8FAFC');
        root.style.setProperty('--slate-grey', '#94A3B8');
        root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
        root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
    }
}

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================

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

// ============================================
// UTILITY FUNCTIONS
// ============================================

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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text || '';
    }
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
        if (diffHours < 24) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
        if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Recently';
    }
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// AUTHENTICATION SETUP
// ============================================

function setupAuthListeners() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await window.AuthHelper?.initialize();
            currentUserId = window.AuthHelper?.getUserProfile()?.id || null;
            window.currentUser = session?.user || null;
            await updateSidebarProfile();
            await updateHeaderProfile();
            showToast('Welcome back!', 'success');
            
            if (currentUserId) {
                await loadContinueWatching(currentUserId);
            }
            
            if (window.PlaylistManager && !playlistManager) {
                await initializePlaylistManager();
            }
            
            if (recommendationEngine) {
                recommendationEngine.userId = currentUserId;
                await loadRecommendationRails();
            }
            
            if (streamingManager) {
                streamingManager.userId = currentUserId;
            }
            
            if (currentContent?.id && !playlistModal) {
                setTimeout(initializePlaylistModal, 500);
            }
        } else if (event === 'SIGNED_OUT') {
            currentUserId = null;
            window.currentUser = null;
            playlistManager = null;
            playlistModal = null;
            await updateSidebarProfile();
            await updateHeaderProfile();
            showToast('Signed out successfully', 'info');
            
            const continueSection = document.getElementById('continueWatchingSection');
            if (continueSection) continueSection.style.display = 'none';
            
            if (watchSession) {
                watchSession.stop();
                watchSession = null;
            }
            
            const watchLaterBtn = document.getElementById('watchLaterBtn');
            if (watchLaterBtn) {
                watchLaterBtn.classList.remove('active');
                watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
            }
            
            if (recommendationEngine) {
                recommendationEngine.userId = null;
                await loadRecommendationRails();
            }
            
            if (streamingManager) {
                streamingManager.userId = null;
            }
        }
    });
    
    if (window.AuthHelper?.isAuthenticated?.()) {
        currentUserId = window.AuthHelper.getUserProfile()?.id || null;
        window.currentUser = { id: currentUserId };
        updateSidebarProfile();
        updateHeaderProfile();
    } else {
        updateSidebarProfile();
        updateHeaderProfile();
    }
}

async function waitForHelpers() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.SupabaseHelper?.isInitialized && window.AuthHelper?.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

// ============================================
// LOAD CONTENT FROM URL
// ============================================

async function loadContentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id') || '68';
    
    try {
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('id', contentId)
            .single();
        
        if (contentError) throw contentError;
        
        const { count: viewsCount, error: viewsError } = await window.supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentId);
        
        const { count: likesCount, error: likesError } = await window.supabaseClient
            .from('content_likes')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', contentId);
        
        let watchProgress = null;
        if (currentUserId) {
            const { data: progressData } = await window.supabaseClient
                .from('watch_progress')
                .select('last_position, is_completed')
                .eq('user_id', currentUserId)
                .eq('content_id', contentId)
                .maybeSingle();
            
            watchProgress = progressData;
        }
        
        const { data: streamingData } = await window.supabaseClient
            .from('Content')
            .select('quality_profiles, hls_manifest_url, data_saver_url')
            .eq('id', contentId)
            .single();
        
        currentContent = {
            id: contentData.id,
            title: contentData.title || 'Untitled',
            description: contentData.description || '',
            thumbnail_url: contentData.thumbnail_url,
            file_url: contentData.file_url,
            media_type: contentData.media_type || 'video',
            genre: contentData.genre || 'General',
            created_at: contentData.created_at,
            duration: contentData.duration || contentData.duration_seconds || 3600,
            language: contentData.language || 'English',
            views_count: viewsCount || 0,
            likes_count: likesCount || 0,
            favorites_count: contentData.favorites_count || 0,
            comments_count: contentData.comments_count || 0,
            creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_id: contentData.user_profiles?.id || contentData.user_id,
            user_id: contentData.user_id,
            user_profiles: contentData.user_profiles,
            watch_progress: watchProgress?.last_position || 0,
            is_completed: watchProgress?.is_completed || false,
            quality_profiles: streamingData?.quality_profiles || [],
            hls_manifest_url: streamingData?.hls_manifest_url || null,
            data_saver_url: streamingData?.data_saver_url || null
        };
        
        console.log('📥 Content loaded:', {
            views: currentContent.views_count,
            likes: currentContent.likes_count,
            creator: currentContent.creator,
            has_avatar: !!currentContent.user_profiles?.avatar_url
        });
        
        updateContentUI(currentContent);
        
        if (currentContent.watch_progress > 10 && !currentContent.is_completed) {
            addResumeButton(currentContent.watch_progress);
        }
        
        if (currentUserId) {
            await initializeLikeButton(contentId, currentUserId);
            await initializeFavoriteButton(contentId, currentUserId);
        }
        
        if (playlistManager) {
            await updateWatchLaterButtonState();
        }
        
        await loadComments(contentId);
        await loadRelatedContent(contentId);
        
    } catch (error) {
        console.error('❌ Content load failed:', error);
        showToast('Content not available. Please try again.', 'error');
        document.getElementById('contentTitle').textContent = 'Content Unavailable';
    }
}

function updateContentUI(content) {
    if (!content) return;
    
    safeSetText('contentTitle', content.title);
    safeSetText('creatorName', content.creator);
    safeSetText('creatorDisplayName', content.creator_display_name);
    
    safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
    safeSetText('viewsCountFull', formatNumber(content.views_count));
    safeSetText('likesCount', formatNumber(content.likes_count));
    safeSetText('favoritesCount', formatNumber(content.favorites_count));
    safeSetText('commentsCount', `(${formatNumber(content.comments_count)})`);
    
    const duration = formatDuration(content.duration || 3600);
    safeSetText('durationText', duration);
    safeSetText('contentDurationFull', duration);
    
    safeSetText('uploadDate', formatDate(content.created_at));
    safeSetText('contentGenre', content.genre || 'General');
    safeSetText('contentDescriptionShort', truncateText(content.description, 150));
    safeSetText('contentDescriptionFull', content.description);
    
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (creatorAvatar && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || 'Creator';
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const fixedAvatarUrl = fixAvatarUrl(avatarUrl);
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}" 
                     alt="${escapeHtml(displayName)}" 
                     style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
        } else {
            creatorAvatar.innerHTML = `
                <div style="
                    width:100%; 
                    height:100%; 
                    border-radius:50%; 
                    background:linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:white;
                    font-weight:bold;
                    font-size:1.5rem;
                ">${initial}</div>
            `;
        }
    }
    
    const creatorSection = document.querySelector('.creator-section');
    const creatorInfo = document.querySelector('.creator-info');
    if (creatorSection && content.creator_id) {
        creatorSection.style.cursor = 'pointer';
        if (creatorInfo) {
            const newCreatorInfo = creatorInfo.cloneNode(true);
            creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
            
            newCreatorInfo.addEventListener('click', function(e) {
                if (e.target.closest('.connect-btn')) return;
                window.location.href = `creator-channel.html?id=${content.creator_id}&name=${encodeURIComponent(content.creator_display_name)}`;
            });
        }
    }
    
    const posterPlaceholder = document.getElementById('posterPlaceholder');
    if (posterPlaceholder && content.thumbnail_url) {
        const imgUrl = fixAvatarUrl(content.thumbnail_url);
        posterPlaceholder.innerHTML = `
            <img src="${imgUrl}" alt="${content.title}"
            style="width:100%; height:100%; object-fit:cover; border-radius: 12px;"
            onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop'">
            <div class="play-overlay">
                <div class="play-icon-large">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }
}

function addResumeButton(progressSeconds) {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    
    if (document.getElementById('resumeBtn')) return;
    
    const resumeBtn = document.createElement('button');
    resumeBtn.id = 'resumeBtn';
    resumeBtn.className = 'btn btn-primary resume-btn';
    resumeBtn.innerHTML = `
        <i class="fas fa-play"></i>
        <span>Resume (${formatDuration(progressSeconds)})</span>
    `;
    
    resumeBtn.addEventListener('click', handlePlay);
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        heroActions.insertBefore(resumeBtn, playBtn);
        playBtn.style.display = 'none';
    } else {
        heroActions.prepend(resumeBtn);
    }
}

// ============================================
// LIKE, FAVORITE, WATCH LATER FUNCTIONS
// ============================================

async function checkUserLike(contentId, userId) {
    if (!userId) return false;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('content_likes')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .single();
        
        if (error?.code === 'PGRST116') return false;
        if (error) return false;
        return !!data;
    } catch (error) {
        return false;
    }
}

async function initializeLikeButton(contentId, userId) {
    const likeBtn = document.getElementById('likeBtn');
    if (!likeBtn) return;
    
    likeBtn.classList.remove('active');
    likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
    
    if (!userId) return;
    
    const isLiked = await checkUserLike(contentId, userId);
    if (isLiked) {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
    }
}

async function checkUserFavorite(contentId, userId) {
    if (!userId) return false;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .single();
        
        if (error?.code === 'PGRST116') return false;
        if (error) return false;
        return !!data;
    } catch (error) {
        return false;
    }
}

async function initializeFavoriteButton(contentId, userId) {
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (!favoriteBtn) return;
    
    favoriteBtn.classList.remove('active');
    favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
    
    if (!userId) return;
    
    const isFavorited = await checkUserFavorite(contentId, userId);
    if (isFavorited) {
        favoriteBtn.classList.add('active');
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
    }
}

async function updateWatchLaterButtonState() {
    const btn = document.getElementById('watchLaterBtn');
    if (!btn || !currentContent?.id || !playlistManager) return;
    
    try {
        const isInList = await playlistManager.isInWatchLater(currentContent.id);
        
        if (isInList) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-check"></i><span>Saved</span>';
            btn.title = 'Remove from Watch Later';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
            btn.title = 'Add to Watch Later';
        }
    } catch (error) {
        console.error('Failed to update Watch Later button:', error);
    }
}

// ============================================
// COMMENTS FUNCTIONS
// ============================================

async function loadComments(contentId) {
    try {
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', contentId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderComments(comments || []);
        
        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments.length})`;
        }
        
        if (currentContent) {
            await window.supabaseClient
                .from('Content')
                .update({ comments_count: comments.length })
                .eq('id', currentContent.id);
        }
    } catch (error) {
        console.error('Comments load failed:', error);
        renderComments([]);
    }
}

function renderComments(comments) {
    const container = document.getElementById('commentsList');
    const noComments = document.getElementById('noComments');
    const countEl = document.getElementById('commentsCount');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        if (noComments) noComments.style.display = 'flex';
        if (countEl) countEl.textContent = '(0)';
        return;
    }
    
    if (noComments) noComments.style.display = 'none';
    if (countEl) countEl.textContent = `(${comments.length})`;
    
    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        container.appendChild(commentEl);
    });
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    
    let authorName = comment.author_name || 'User';
    let avatarUrl = comment.author_avatar || null;
    const time = formatCommentTime(comment.created_at);
    const commentText = comment.comment_text || '';
    const initial = authorName.charAt(0).toUpperCase();
    
    div.innerHTML = `
        <div class="comment-header">
            <div class="comment-avatar-sm">
                ${avatarUrl ?
                    `<img src="${avatarUrl}" alt="${authorName}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` :
                    `<div style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                    ">
                    ${initial}
                    </div>`
                }
            </div>
            <div class="comment-user">
                <strong>${escapeHtml(authorName)}</strong>
                <div class="comment-time">${time}</div>
            </div>
        </div>
        <div class="comment-content">
            ${escapeHtml(commentText)}
        </div>
    `;
    
    return div;
}

// ============================================
// RELATED CONTENT FUNCTIONS
// ============================================

async function loadRelatedContent(contentId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('id, title, thumbnail_url, user_id, genre, duration, media_type, status, user_profiles!user_id(full_name, username)')
            .neq('id', contentId)
            .eq('status', 'published')
            .limit(6);
        
        if (error) throw error;
        
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
        
        const imgUrl = fixAvatarUrl(item.thumbnail_url);
        const title = item.title || 'Untitled';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : 0;
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${imgUrl}" alt="${title}"
                onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                <div class="thumbnail-overlay"></div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${truncateText(title, 50)}</h3>
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
// CONTINUE WATCHING FUNCTIONS
// ============================================

async function loadContinueWatching(userId, limit = 8) {
    const section = document.getElementById('continueWatchingSection');
    if (!section) return;
    
    if (!userId || !window.supabaseClient) {
        section.style.display = 'none';
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('watch_progress')
            .select(`
                content_id,
                last_position,
                is_completed,
                updated_at,
                Content (
                    id,
                    title,
                    thumbnail_url,
                    genre,
                    duration,
                    status,
                    user_profiles!user_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .eq('Content.status', 'published')
            .order('updated_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        renderContinueWatching(data);
        section.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load continue watching:', error);
        section.style.display = 'none';
    }
}

function renderContinueWatching(items) {
    const container = document.getElementById('continueGrid');
    if (!container) return;
    
    container.innerHTML = items.map(item => {
        const content = item.Content;
        if (!content) return '';
        
        const progress = content.duration > 0 
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;
        
        const timeWatched = formatDuration(item.last_position);
        const totalTime = formatDuration(content.duration);
        
        const thumbnailUrl = fixAvatarUrl(content.thumbnail_url) 
            || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const creatorName = content.user_profiles?.full_name 
            || content.user_profiles?.username 
            || 'Creator';
        
        return `
            <a href="content-detail.html?id=${content.id}" class="content-card continue-card" data-content-id="${content.id}">
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    
                    <div class="progress-bar-overlay">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                    
                    <div class="resume-badge">
                        <i class="fas fa-play"></i> Resume
                    </div>
                </div>
                
                <div class="card-content">
                    <h3 class="card-title">${truncateText(content.title, 45)}</h3>
                    
                    <div class="related-meta">
                        <span>${timeWatched} / ${totalTime}</span>
                    </div>
                    
                    <div class="creator-chip">
                        <i class="fas fa-user"></i>
                        ${truncateText(creatorName, 20)}
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

function setupContinueWatchingRefresh() {
    const refreshBtn = document.getElementById('refreshContinueBtn');
    if (!refreshBtn) return;
    
    refreshBtn.addEventListener('click', async () => {
        if (!currentUserId) return;
        
        showToast('Refreshing...', 'info');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            await loadContinueWatching(currentUserId);
            showToast('Updated!', 'success');
        } catch (error) {
            showToast('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
    });
}

// ============================================
// VIDEO PLAYER FUNCTIONS
// ============================================

function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');
    
    if (!videoElement || !videoContainer) {
        console.warn('Video elements not found');
        return;
    }
    
    try {
        enhancedVideoPlayer = new EnhancedVideoPlayer({
            autoplay: false,
            defaultSpeed: 1.0,
            defaultQuality: 'auto',
            defaultVolume: 1.0,
            muted: false,
            contentId: currentContent?.id || null,
            supabaseClient: window.supabaseClient,
            userId: currentUserId
        });
        
        enhancedVideoPlayer.attach(videoElement, videoContainer);
        
        enhancedVideoPlayer.on('play', () => {
            console.log('Video playing...');
            initializeWatchSessionOnPlay();
        });
        
        enhancedVideoPlayer.on('pause', () => {});
        enhancedVideoPlayer.on('volumechange', () => {});
        enhancedVideoPlayer.on('error', (error) => {
            console.error('Video player error:', error);
            showToast('Playback error occurred', 'error');
        });
        
        enhancedVideoPlayer.on('loadeddata', () => {
            const placeholder = document.getElementById('videoPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });
        
        console.log('Enhanced video player initialized');
    } catch (error) {
        console.error('Failed to initialize video player:', error);
        videoElement.controls = true;
    }
}

function initializeWatchSessionOnPlay() {
    if (!currentContent || !currentUserId || !enhancedVideoPlayer?.video) return;
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    try {
        watchSession = new window.WatchSession({
            contentId: currentContent.id,
            userId: currentUserId,
            supabase: window.supabaseClient,
            videoElement: enhancedVideoPlayer.video,
            syncInterval: 10000,
            viewThreshold: 20,
            completionThreshold: 0.9,
            onProgressSync: () => {},
            onViewCounted: () => {
                refreshCountsFromSource();
            },
            onComplete: () => {
                showToast('You finished this video!', 'success');
                const resumeBtn = document.getElementById('resumeBtn');
                if (resumeBtn) {
                    resumeBtn.remove();
                    const playBtn = document.getElementById('playBtn');
                    if (playBtn) playBtn.style.display = 'flex';
                }
            },
            onError: () => {}
        });
        
        setTimeout(() => {
            if (watchSession && enhancedVideoPlayer?.video) {
                watchSession.start(enhancedVideoPlayer.video);
            }
        }, 500);
    } catch (error) {
        console.error('Failed to initialize watch session:', error);
    }
}

async function recordContentView(contentId) {
    try {
        let viewerId = null;
        if (window.AuthHelper?.isAuthenticated?.()) {
            const userProfile = window.AuthHelper.getUserProfile();
            viewerId = userProfile?.id || null;
        }
        
        const { error } = await window.supabaseClient
            .from('content_views')
            .insert({
                content_id: contentId,
                viewer_id: viewerId,
                view_duration: 0,
                device_type: /Mobile|Android|iP(hone|od)|IEMobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                created_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('View recording failed:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('View recording error:', error);
        return false;
    }
}

async function refreshCountsFromSource() {
    if (!currentContent) return;
    
    try {
        const { count: newViews } = await window.supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', currentContent.id);
        
        const { count: newLikes } = await window.supabaseClient
            .from('content_likes')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', currentContent.id);
        
        currentContent.views_count = newViews || 0;
        currentContent.likes_count = newLikes || 0;
        
        safeSetText('viewsCount', formatNumber(newViews) + ' views');
        safeSetText('viewsCountFull', formatNumber(newViews));
        safeSetText('likesCount', formatNumber(newLikes));
    } catch (error) {
        console.error('Failed to refresh counts:', error);
    }
}

function hasViewedContentRecently(contentId) {
    try {
        const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
        const viewTime = viewedContent[contentId];
        if (!viewTime) return false;
        const hoursSinceView = (Date.now() - viewTime) / (1000 * 60 * 60);
        return hoursSinceView < 24;
    } catch (error) {
        return false;
    }
}

function markContentAsViewed(contentId) {
    try {
        const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
        viewedContent[contentId] = Date.now();
        
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        Object.keys(viewedContent).forEach(id => {
            if (viewedContent[id] < sevenDaysAgo) {
                delete viewedContent[id];
            }
        });
        
        localStorage.setItem('bantu_viewed_content', JSON.stringify(viewedContent));
        return true;
    } catch (error) {
        return false;
    }
}

function handlePlay() {
    if (!currentContent) {
        showToast('No content to play', 'error');
        return;
    }
    
    const player = document.getElementById('inlinePlayer');
    const videoElement = document.getElementById('inlineVideoPlayer');
    
    if (!player || !videoElement) {
        showToast('Video player not available', 'error');
        return;
    }
    
    if (!hasViewedContentRecently(currentContent.id)) {
        const viewsEl = document.getElementById('viewsCount');
        const viewsFullEl = document.getElementById('viewsCountFull');
        const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
        const newViews = currentViews + 1;
        
        if (viewsEl && viewsFullEl) {
            viewsEl.textContent = `${formatNumber(newViews)} views`;
            viewsFullEl.textContent = formatNumber(newViews);
        }
        
        recordContentView(currentContent.id).then(success => {
            if (success) {
                markContentAsViewed(currentContent.id);
                refreshCountsFromSource();
            } else {
                if (viewsEl && viewsFullEl) {
                    viewsEl.textContent = `${formatNumber(currentViews)} views`;
                    viewsFullEl.textContent = formatNumber(currentViews);
                }
            }
        });
    }
    
    player.style.display = 'block';
    
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    
    videoElement.muted = false;
    videoElement.defaultMuted = false;
    videoElement.volume = 1.0;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (currentContent.hls_manifest_url && streamingManager) {
        streamingManager.initialize();
        return;
    }
    
    let fileUrl = currentContent.file_url;
    
    if (fileUrl && !fileUrl.startsWith('http')) {
        if (fileUrl.startsWith('/')) fileUrl = fileUrl.substring(1);
        fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
    }
    
    const isAudioFile = fileUrl && (fileUrl.includes('.mp3') || fileUrl.includes('.wav') || fileUrl.includes('.ogg'));
    
    if (isAudioFile && currentContent.thumbnail_url) {
        const imgUrl = fixAvatarUrl(currentContent.thumbnail_url);
        videoElement.setAttribute('poster', imgUrl);
    }
    
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.setAttribute('data-media-type', isAudioFile ? 'audio' : 'video');
    }
    
    if (enhancedVideoPlayer) {
        try { enhancedVideoPlayer.destroy(); } catch(e) {}
        enhancedVideoPlayer = null;
    }
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
    videoElement.removeAttribute('src');
    videoElement.src = '';
    
    const source = document.createElement('source');
    source.src = fileUrl;
    
    if (isAudioFile) {
        if (fileUrl.endsWith('.mp3')) source.type = 'audio/mpeg';
        else if (fileUrl.endsWith('.wav')) source.type = 'audio/wav';
        else source.type = 'audio/ogg';
    } else {
        if (fileUrl.endsWith('.mp4')) source.type = 'video/mp4';
        else if (fileUrl.endsWith('.webm')) source.type = 'video/webm';
        else source.type = 'video/mp4';
    }
    
    videoElement.appendChild(source);
    videoElement.load();
    
    initializeEnhancedVideoPlayer();
    
    setTimeout(() => {
        if (enhancedVideoPlayer) {
            enhancedVideoPlayer.play().catch(() => {
                videoElement.play().catch(() => {});
            });
        } else {
            videoElement.play().catch(() => {});
        }
    }, 500);
}

function closeVideoPlayer() {
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');
    
    if (player) player.style.display = 'none';
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
    
    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }
    
    if (enhancedVideoPlayer) {
        if (enhancedVideoPlayer.video) {
            enhancedVideoPlayer.video.pause();
            enhancedVideoPlayer.video.currentTime = 0;
        }
        enhancedVideoPlayer.destroy();
        enhancedVideoPlayer = null;
    }
    
    if (streamingManager) streamingManager.destroy();
    
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) placeholder.style.display = 'flex';
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '1';
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'none';
    
    const hero = document.querySelector('.content-hero');
    if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// PLAYLIST MANAGER INITIALIZATION
// ============================================

async function initializePlaylistManager() {
    if (typeof window.PlaylistManager !== 'function') return;
    if (!currentUserId) return;
    
    try {
        playlistManager = new window.PlaylistManager({
            supabase: window.supabaseClient,
            userId: currentUserId,
            watchLaterName: 'Watch Later',
            onPlaylistUpdated: () => updateWatchLaterButtonState(),
            onError: (err) => showToast('Playlist error: ' + (err.error || err.message), 'error')
        });
        
        await updateWatchLaterButtonState();
    } catch (error) {
        console.error('Failed to initialize PlaylistManager:', error);
    }
}

function initializePlaylistModal() {
    if (!window.PlaylistModal) return;
    if (!currentUserId || !currentContent?.id) return;
    
    try {
        playlistModal = new window.PlaylistModal({
            supabase: window.supabaseClient,
            userId: currentUserId,
            contentId: currentContent.id
        });
        
        const watchLaterBtn = document.getElementById('watchLaterBtn');
        if (watchLaterBtn) {
            const newBtn = watchLaterBtn.cloneNode(true);
            watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!currentUserId) {
                    showToast('Please sign in to use playlists', 'warning');
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                    return;
                }
                playlistModal.open();
            });
        }
    } catch (error) {
        console.error('Failed to initialize playlist modal:', error);
    }
}

// ============================================
// RECOMMENDATION ENGINE INITIALIZATION
// ============================================

async function initializeRecommendationEngine() {
    if (!window.RecommendationEngine) return;
    if (!currentContent?.id) return;
    
    try {
        recommendationEngine = new window.RecommendationEngine({
            supabase: window.supabaseClient,
            userId: currentUserId,
            currentContentId: currentContent.id,
            limit: 8,
            minWatchThreshold: 0.5,
            cacheDuration: 60000
        });
        
        await loadRecommendationRails();
    } catch (error) {
        console.error('Failed to initialize RecommendationEngine:', error);
    }
}

async function loadRecommendationRails() {
    if (!recommendationEngine) return;
    
    const railConfigs = [
        {
            type: recommendationEngine.TYPES?.BECAUSE_YOU_WATCHED || 'because_you_watched',
            containerId: 'becauseYouWatchedRail',
            title: 'Because You Watched',
            options: { limit: 8 }
        },
        {
            type: recommendationEngine.TYPES?.MORE_FROM_CREATOR || 'more_from_creator',
            containerId: 'moreFromCreatorRail',
            title: 'More From This Creator',
            options: { 
                creatorId: currentContent?.user_id,
                excludeContentId: currentContent?.id,
                limit: 6 
            }
        }
    ];
    
    railConfigs.forEach(config => {
        showRailSkeleton(config.containerId, config.title);
    });
    
    try {
        const results = await recommendationEngine.getMultipleRails(railConfigs);
        results.forEach(({ type, results: items }) => {
            const config = railConfigs.find(r => r.type === type);
            if (config && items?.length > 0) {
                renderRecommendationRail(config.containerId, config.title, items);
            } else if (config) {
                showRailEmpty(config.containerId, config.title);
            }
        });
    } catch (error) {
        console.error('Failed to load recommendation rails:', error);
    }
}

function showRailSkeleton(containerId, title = 'Loading...') {
    const section = document.getElementById(containerId);
    if (!section) return;
    
    section.style.display = 'block';
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${title}</h2>
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
            <h3 style="color: var(--soft-white); margin: 15px 0 10px;">No ${title}</h3>
            <p style="color: var(--slate-grey); font-size: 14px;">
                ${title === 'Because You Watched' ? 'Watch more content to get personalized recommendations' : 'Check back later for more content'}
            </p>
        </div>
    `;
}

function renderRecommendationRail(containerId, title, items) {
    const section = document.getElementById(containerId);
    if (!section) return;
    
    if (!section.querySelector('.section-header')) {
        section.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${title}</h2>
            </div>
            <div class="content-grid" id="${containerId}-grid"></div>
        `;
    }
    
    const grid = section.querySelector('.content-grid');
    if (!grid) return;
    
    grid.innerHTML = items.map(item => {
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card recommendation-card">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${item.title}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
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
// STREAMING MANAGER INITIALIZATION
// ============================================

async function initializeStreamingManager() {
    if (!window.StreamingManager) return;
    
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    try {
        streamingManager = new window.StreamingManager({
            videoElement: videoElement,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id,
            userId: currentUserId,
            onQualityChange: (data) => {
                updateQualityIndicator(data.quality);
                showToast('Quality: ' + data.quality, 'info');
                setupQualitySelector();
            },
            onDataSaverToggle: (data) => {
                updateQualityIndicator(streamingManager?.getCurrentQuality());
                showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
            },
            onError: (err) => console.error('Streaming error:', err)
        });
        
        await streamingManager.initialize();
        
        setInterval(() => {
            if (streamingManager) {
                const speed = streamingManager.getNetworkSpeed();
                if (speed) updateNetworkSpeedIndicator(speed / 1000000);
            }
        }, 5000);
        
        setupQualitySelector();
        setupDataSaverToggle();
        
        setTimeout(() => {
            if (streamingManager) updateQualityIndicator(streamingManager.getCurrentQuality());
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize StreamingManager:', error);
    }
}

function setupQualitySelector() {
    const qualityContainer = document.getElementById('qualityOptions');
    if (!qualityContainer) return;
    
    const qualities = streamingManager?.getAvailableQualities?.() || [
        { label: 'Auto', value: 'auto' },
        { label: '1080p', value: '1080p' },
        { label: '720p', value: '720p' },
        { label: '480p', value: '480p' },
        { label: '360p', value: '360p' }
    ];
    
    qualityContainer.innerHTML = qualities.map(q => `
        <button class="quality-option ${q.value === streamingManager?.getCurrentQuality?.() ? 'active' : ''}" 
                data-quality="${q.value}">
            ${q.label}
        </button>
    `).join('');
    
    qualityContainer.querySelectorAll('.quality-option').forEach(btn => {
        btn.addEventListener('click', async function() {
            const quality = this.dataset.quality;
            
            qualityContainer.querySelectorAll('.quality-option').forEach(b => 
                b.classList.remove('active')
            );
            this.classList.add('active');
            
            if (streamingManager) {
                await streamingManager.setQuality(quality);
                showToast('Quality: ' + quality.toUpperCase(), 'info');
            }
            
            const settingsMenu = document.querySelector('.settings-menu');
            if (settingsMenu) settingsMenu.classList.remove('active');
        });
    });
}

function setupDataSaverToggle() {
    const toggle = document.getElementById('dataSaverToggle');
    if (!toggle) return;
    
    if (streamingManager?.isDataSaverEnabled()) toggle.checked = true;
    
    toggle.addEventListener('change', async function() {
        if (streamingManager) streamingManager.toggleDataSaver(this.checked);
    });
}

function updateQualityIndicator(quality) {
    const indicator = document.getElementById('qualityBadge');
    const dataSaverBadge = document.getElementById('dataSaverBadge');
    
    if (!indicator) return;
    
    indicator.style.display = 'block';
    indicator.textContent = quality.toUpperCase();
    
    indicator.classList.remove('auto', 'hd');
    if (quality === 'auto') indicator.classList.add('auto');
    else if (['720p', '1080p'].includes(quality)) indicator.classList.add('hd');
    
    if (streamingManager?.isDataSaverEnabled()) {
        dataSaverBadge?.style.setProperty('display', 'block');
    } else {
        dataSaverBadge?.style.setProperty('display', 'none');
    }
    
    setTimeout(() => {
        if (indicator && !streamingManager?.isDataSaverEnabled()) {
            indicator.style.display = 'none';
        }
    }, 5000);
}

function updateNetworkSpeedIndicator(speedMbps) {
    const indicator = document.getElementById('networkSpeedIndicator');
    const valueSpan = document.getElementById('networkSpeedValue');
    if (!indicator || !valueSpan) return;
    
    if (speedMbps) {
        valueSpan.textContent = speedMbps.toFixed(1) + ' Mbps';
        indicator.style.display = 'flex';
        
        indicator.classList.remove('good', 'fair', 'poor');
        if (speedMbps > 5) indicator.classList.add('good');
        else if (speedMbps > 2) indicator.classList.add('fair');
        else indicator.classList.add('poor');
    } else {
        indicator.style.display = 'none';
    }
}

// ============================================
// KEYBOARD SHORTCUTS INITIALIZATION
// ============================================

function initializeKeyboardShortcuts() {
    if (!window.KeyboardShortcuts) return;
    if (!enhancedVideoPlayer?.video) return;
    
    try {
        keyboardShortcuts = new window.KeyboardShortcuts({
            videoElement: enhancedVideoPlayer.video,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id
        });
    } catch (error) {
        console.error('Failed to initialize keyboard shortcuts:', error);
    }
}

// ============================================
// MODAL & PANEL INITIALIZATIONS
// ============================================

function initAnalyticsModal() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !analyticsModal) return;
    
    analyticsBtn.addEventListener('click', () => {
        analyticsModal.classList.add('active');
        loadContentAnalytics();
    });
    
    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', () => analyticsModal.classList.remove('active'));
    }
    
    analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) analyticsModal.classList.remove('active');
    });
}

async function loadContentAnalytics() {
    if (!currentContent) return;
    
    try {
        const { data: viewsData } = await window.supabaseClient
            .from('content_views')
            .select('id')
            .eq('content_id', currentContent.id);
        
        const { data: commentsData } = await window.supabaseClient
            .from('comments')
            .select('id')
            .eq('content_id', currentContent.id);
        
        const totalViews = viewsData?.length || 0;
        const totalComments = commentsData?.length || 0;
        
        document.getElementById('content-total-views').textContent = formatNumber(totalViews);
        document.getElementById('total-comments').textContent = formatNumber(totalComments);
        document.getElementById('avg-watch-time').textContent = '4m 23s';
        document.getElementById('engagement-rate').textContent = '68%';
        document.getElementById('views-trend').textContent = '+12%';
        document.getElementById('comments-trend').textContent = '+8%';
        document.getElementById('watch-time-trend').textContent = '+5%';
        document.getElementById('engagement-trend').textContent = '+3%';
        
        if (typeof Chart !== 'undefined') initEngagementChart();
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function initEngagementChart() {
    const ctx = document.getElementById('content-engagement-chart');
    if (!ctx) return;
    
    if (window.contentEngagementChart) window.contentEngagementChart.destroy();
    
    window.contentEngagementChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Views',
                data: [65, 59, 80, 81, 56, 55, 40],
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Comments',
                data: [28, 48, 40, 19, 86, 27, 90],
                borderColor: '#1D4ED8',
                backgroundColor: 'rgba(29, 78, 216, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: 'var(--soft-white)' } } },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: 'var(--slate-grey)' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: 'var(--slate-grey)' } }
            }
        }
    });
}

function initSearchModal() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    
    if (!searchBtn || !searchModal) return;
    
    searchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 300);
    });
    
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        });
    }
    
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            document.getElementById('search-results-grid').innerHTML = '';
        }
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const category = document.getElementById('category-filter')?.value;
            const sortBy = document.getElementById('sort-filter')?.value;
            
            if (query.length < 2) {
                document.getElementById('search-results-grid').innerHTML = '<div class="no-results">Start typing to search...</div>';
                return;
            }
            
            document.getElementById('search-results-grid').innerHTML = '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
            
            try {
                const results = await searchContent(query, category, sortBy);
                renderSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                document.getElementById('search-results-grid').innerHTML = '<div class="no-results">Error searching. Please try again.</div>';
            }
        }, 300));
    }
    
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    
    if (categoryFilter) categoryFilter.addEventListener('change', () => triggerSearch());
    if (sortFilter) sortFilter.addEventListener('change', () => triggerSearch());
}

function triggerSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.dispatchEvent(new Event('input'));
}

async function searchContent(query, category, sortBy) {
    try {
        let orderBy = 'created_at';
        let order = 'desc';
        
        if (sortBy === 'popular') orderBy = 'views_count';
        else if (sortBy === 'trending') orderBy = 'likes_count';
        
        let queryBuilder = window.supabaseClient
            .from('Content')
            .select('*, user_profiles!user_id(*)')
            .ilike('title', `%${query}%`)
            .eq('status', 'published')
            .order(orderBy, { ascending: order === 'asc' })
            .limit(20);
        
        if (category) queryBuilder = queryBuilder.eq('genre', category);
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        const enrichedResults = await Promise.all(
            (data || []).map(async (item) => {
                const { count: realViews } = await window.supabaseClient
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', item.id);
                return { ...item, real_views_count: realViews || 0 };
            })
        );
        
        return enrichedResults || [];
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

function renderSearchResults(results) {
    const grid = document.getElementById('search-results-grid');
    if (!grid) return;
    
    if (!results || results.length === 0) {
        grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
        return;
    }
    
    grid.innerHTML = results.map(item => {
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || 'Creator';
        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
        
        return `
            <div class="content-card" data-content-id="${item.id}">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
                         alt="${item.title}" 
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${truncateText(item.title, 45)}</h3>
                    <div class="related-meta">
                        <i class="fas fa-eye"></i>
                        <span>${formatNumber(viewsCount)} views</span>
                    </div>
                    <button class="creator-btn" data-creator-id="${item.user_id}" data-creator-name="${creator}">
                        <i class="fas fa-user"></i>
                        ${truncateText(creator, 15)}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    grid.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.creator-btn')) return;
            const id = card.dataset.contentId;
            if (id) window.location.href = `content-detail.html?id=${id}`;
        });
    });
    
    grid.querySelectorAll('.creator-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.creatorId;
            const name = btn.dataset.creatorName;
            if (id) window.location.href = `creator-channel.html?id=${id}&name=${encodeURIComponent(name)}`;
        });
    });
}

function initNotificationsPanel() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    if (!notificationsBtn || !notificationsPanel) return;
    
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            notificationsPanel.classList.add('active');
            loadUserNotifications();
            markAllNotificationsAsRead();
        });
    }
    
    if (navNotificationsBtn) {
        navNotificationsBtn.addEventListener('click', () => {
            notificationsPanel.classList.add('active');
            loadUserNotifications();
            markAllNotificationsAsRead();
        });
    }
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => notificationsPanel.classList.remove('active'));
    }
    
    document.addEventListener('click', (e) => {
        if (notificationsPanel.classList.contains('active') && 
            !notificationsPanel.contains(e.target) && 
            !notificationsBtn.contains(e.target) && 
            (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
            notificationsPanel.classList.remove('active');
        }
    });
    
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            await markAllNotificationsAsRead();
            await loadUserNotifications();
        });
    }
    
    if (window.AuthHelper?.isAuthenticated()) {
        loadUserNotifications();
        updateNotificationBadge();
    }
}

async function loadUserNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    try {
        if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>Sign in to see notifications</p>
                </div>
            `;
            updateNotificationBadge(0);
            return;
        }
        
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return;
        
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            updateNotificationBadge(0);
            return;
        }
        
        notificationsList.innerHTML = data.map(notification => `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h4>${escapeHtml(notification.title)}</h4>
                    <p>${escapeHtml(notification.message)}</p>
                    <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
                </div>
                ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `).join('');
        
        notificationsList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                await markNotificationAsRead(id);
                
                const notification = data.find(n => n.id === id);
                if (notification?.content_id) {
                    window.location.href = `content-detail.html?id=${notification.content_id}`;
                }
                notificationsPanel.classList.remove('active');
            });
        });
        
        const unreadCount = data.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

function getNotificationIcon(type) {
    switch(type) {
        case 'like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'follow': return 'fas fa-user-plus';
        case 'view_milestone': return 'fas fa-trophy';
        default: return 'fas fa-bell';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        
        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('.notification-dot');
            if (dot) dot.remove();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        if (!window.AuthHelper?.isAuthenticated()) return;
        
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return;
        
        await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userProfile.id)
            .eq('is_read', false);
        
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
            const dot = item.querySelector('.notification-dot');
            if (dot) dot.remove();
        });
        
        updateNotificationBadge(0);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function updateNotificationBadge(count) {
    if (count === undefined) {
        count = document.querySelectorAll('.notification-item.unread').length;
    }
    
    const mainBadge = document.getElementById('notification-count');
    const navBadge = document.getElementById('nav-notification-count');
    
    if (mainBadge) {
        mainBadge.textContent = count > 99 ? '99+' : count;
        mainBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    
    if (navBadge) {
        navBadge.textContent = count > 99 ? '99+' : count;
        navBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function formatNotificationTime(timestamp) {
    const now = new Date();
    const diffMs = now - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return new Date(timestamp).toLocaleDateString();
}

function initGlobalNavigation() {
    const homeBtn = document.querySelector('.nav-icon:nth-child(1)');
    if (homeBtn) {
        const newHomeBtn = homeBtn.cloneNode(true);
        homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
        
        newHomeBtn.addEventListener('click', () => {
            window.location.href = 'https://bantustreamconnect.com/';
        });
    }
    
    const createBtn = document.querySelector('.nav-icon:nth-child(3)');
    if (createBtn) {
        const newCreateBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
        
        newCreateBtn.addEventListener('click', async () => {
            if (window.AuthHelper?.isAuthenticated()) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = 'login.html?redirect=creator-upload.html';
            }
        });
    }
    
    const dashboardBtn = document.querySelector('.nav-icon:nth-child(4)');
    if (dashboardBtn) {
        const newDashboardBtn = dashboardBtn.cloneNode(true);
        dashboardBtn.parentNode.replaceChild(newDashboardBtn, dashboardBtn);
        
        newDashboardBtn.addEventListener('click', async () => {
            if (window.AuthHelper?.isAuthenticated()) {
                window.location.href = 'creator-dashboard.html';
            } else {
                showToast('Please sign in to access dashboard', 'warning');
                window.location.href = 'login.html?redirect=creator-dashboard.html';
            }
        });
    }
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

function setupEventListeners() {
    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.addEventListener('click', handlePlay);
    
    const poster = document.getElementById('heroPoster');
    if (poster) poster.addEventListener('click', handlePlay);
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.addEventListener('click', closeVideoPlayer);
    
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullPlayerBtn = document.getElementById('fullPlayerBtn');
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => enhancedVideoPlayer?.toggleFullscreen());
    }
    if (fullPlayerBtn) {
        fullPlayerBtn.addEventListener('click', () => enhancedVideoPlayer?.toggleFullscreen());
    }
    
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!currentContent) return;
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to like content', 'warning');
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) return;
            
            const isLiked = likeBtn.classList.contains('active');
            const likesCountEl = document.getElementById('likesCount');
            const currentLikes = parseInt(likesCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
            
            try {
                likeBtn.classList.toggle('active', !isLiked);
                likeBtn.innerHTML = !isLiked ? '<i class="fas fa-heart"></i><span>Liked</span>' : '<i class="far fa-heart"></i><span>Like</span>';
                if (likesCountEl) likesCountEl.textContent = formatNumber(newLikes);
                
                if (!isLiked) {
                    await window.supabaseClient.from('content_likes').insert({ user_id: userProfile.id, content_id: currentContent.id });
                } else {
                    await window.supabaseClient.from('content_likes').delete().eq('user_id', userProfile.id).eq('content_id', currentContent.id);
                }
                
                await refreshCountsFromSource();
                showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');
            } catch (error) {
                likeBtn.classList.toggle('active', isLiked);
                likeBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i><span>Liked</span>' : '<i class="far fa-heart"></i><span>Like</span>';
                if (likesCountEl) likesCountEl.textContent = formatNumber(currentLikes);
                showToast('Failed: ' + error.message, 'error');
            }
        });
    }
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async () => {
            if (!currentContent) return;
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to favorite content', 'warning');
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) return;
            
            const isFavorited = favoriteBtn.classList.contains('active');
            const favCountEl = document.getElementById('favoritesCount');
            const currentFavorites = parseInt(favCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newFavorites = isFavorited ? currentFavorites - 1 : currentFavorites + 1;
            
            try {
                favoriteBtn.classList.toggle('active', !isFavorited);
                favoriteBtn.innerHTML = !isFavorited ? '<i class="fas fa-star"></i><span>Favorited</span>' : '<i class="far fa-star"></i><span>Favorite</span>';
                if (favCountEl) favCountEl.textContent = formatNumber(newFavorites);
                
                if (!isFavorited) {
                    await window.supabaseClient.from('favorites').insert({ user_id: userProfile.id, content_id: currentContent.id });
                } else {
                    await window.supabaseClient.from('favorites').delete().eq('user_id', userProfile.id).eq('content_id', currentContent.id);
                }
                
                showToast(!isFavorited ? 'Added to favorites!' : 'Removed from favorites', !isFavorited ? 'success' : 'info');
                await refreshCountsFromSource();
            } catch (error) {
                favoriteBtn.classList.toggle('active', isFavorited);
                favoriteBtn.innerHTML = isFavorited ? '<i class="fas fa-star"></i><span>Favorited</span>' : '<i class="far fa-star"></i><span>Favorite</span>';
                if (favCountEl) favCountEl.textContent = formatNumber(currentFavorites);
                showToast('Failed to update favorite', 'error');
            }
        });
    }
    
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (!currentContent) return;
            
            const shareText = `📺 ${currentContent.title}\n\n${currentContent.description || 'Check out this amazing content!'}\n\n👉 Watch on Bantu Stream Connect\nNO DNA, JUST RSA\n\n`;
            const shareUrl = window.location.href;
            
            try {
                if (navigator.share) {
                    await navigator.share({ title: 'Bantu Stream Connect', text: shareText, url: shareUrl });
                } else {
                    await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
                    showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
                }
            } catch (err) {
                if (err.name !== 'AbortError') showToast('Failed to share', 'error');
            }
        });
    }
    
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');
    
    if (sendBtn && commentInput) {
        sendBtn.addEventListener('click', async () => {
            const text = commentInput.value.trim();
            if (!text) return;
            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('You need to sign in to comment', 'warning');
                return;
            }
            if (!currentContent) return;
            
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            try {
                const userProfile = window.AuthHelper.getUserProfile();
                const displayName = window.AuthHelper.getDisplayName();
                const avatarUrl = window.AuthHelper.getAvatarUrl();
                
                await window.supabaseClient.from('comments').insert({
                    content_id: currentContent.id,
                    user_id: userProfile.id,
                    author_name: displayName,
                    comment_text: text,
                    author_avatar: avatarUrl || null,
                    created_at: new Date().toISOString()
                });
                
                await loadComments(currentContent.id);
                await refreshCountsFromSource();
                commentInput.value = '';
                showToast('Comment added!', 'success');
            } catch (error) {
                showToast('Failed to add comment', 'error');
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        });
        
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    }
    
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn && currentContent) {
        refreshBtn.addEventListener('click', async () => {
            showToast('Refreshing comments...', 'info');
            await loadComments(currentContent.id);
            showToast('Comments refreshed!', 'success');
        });
    }
    
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        window.addEventListener('scroll', () => {
            backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
        });
    }
    
    const pipBtn = document.getElementById('pipBtn');
    if (pipBtn) {
        pipBtn.addEventListener('click', () => {
            const video = document.getElementById('inlineVideoPlayer');
            if (video.requestPictureInPicture) video.requestPictureInPicture();
        });
    }
    
    setupConnectButtons();
}

function setupConnectButtons() {
    const connectBtn = document.getElementById('connectBtn');
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    
    const checkConnectionStatus = async (creatorId) => {
        if (!window.AuthHelper?.isAuthenticated() || !creatorId) return false;
        const userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return false;
        
        const { data } = await window.supabaseClient
            .from('connectors')
            .select('id')
            .eq('connector_id', userProfile.id)
            .eq('connected_id', creatorId)
            .single();
        
        return !!data;
    };
    
    if (connectBtn && currentContent?.creator_id) {
        checkConnectionStatus(currentContent.creator_id).then(isConnected => {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectBtn.addEventListener('click', async () => {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                if (confirm('You need to sign in to connect. Sign in now?')) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) return;
            
            const isConnected = connectBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    
                    connectBtn.classList.remove('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    
                    connectBtn.classList.add('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                }
            } catch (error) {
                showToast('Failed to update connection', 'error');
            }
        });
    }
    
    if (connectCreatorBtn && currentContent?.creator_id) {
        checkConnectionStatus(currentContent.creator_id).then(isConnected => {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectCreatorBtn.addEventListener('click', async () => {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                if (confirm('You need to sign in to connect. Sign in now?')) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) return;
            
            const isConnected = connectCreatorBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    
                    connectCreatorBtn.classList.remove('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    
                    connectCreatorBtn.classList.add('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                }
            } catch (error) {
                showToast('Failed to update connection', 'error');
            }
        });
    }
}

// Page unload handler
window.addEventListener('beforeunload', () => {
    if (watchSession) watchSession.stop();
    if (streamingManager) streamingManager.destroy();
});

// Export key functions
window.hasViewedContentRecently = hasViewedContentRecently;
window.markContentAsViewed = markContentAsViewed;
window.recordContentView = recordContentView;
window.refreshCountsFromSource = refreshCountsFromSource;
window.streamingManager = streamingManager;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;
window.closeVideoPlayer = closeVideoPlayer;
window.showToast = showToast;
window.uiScaleController = window.uiScaleController;

console.log('✅ Content detail script loaded with all UI features (Sidebar, Header, Navigation Button, Theme)');
