// js/content-detail.js - FULLY FIXED VERSION
// ✅ All 8 Features Fixed: Profile Dropdown, RSA Badge, Search, Analytics, Voice Search, Notifications, Bottom Nav, Sidebar
// ✅ RLS-Compliant with Accurate View Counts
// ✅ Home Feed Header & Sidebar Integration Complete
// ✅ PHASE 1-4 Features Integrated
// ✅ FIXED: Loading screen hides properly
// ✅ FIXED: Sidebar menu clickable with direct onclick handlers
// ✅ FIXED: Navigation button positioning

console.log('🎬 Content Detail Initializing with ALL fixes applied...');

// ============================================
// GLOBAL VARIABLES
// ============================================
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

// ============================================
// UI SCALE CONTROLLER - FIXED VERSION
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
        console.log('📏 UI Scale Controller initialized with scale:', this.scale);
    }

    setupEventListeners() {
        document.addEventListener('scaleChanged', (e) => {
            this.updateScaleDisplay(e.detail.scale);
        });
    }

    applyScale() {
        document.documentElement.style.setProperty('--ui-scale', this.scale);
        localStorage.setItem('bantu_ui_scale', this.scale.toString());
        document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: this.scale } }));
        console.log('📏 Scale applied:', this.scale);
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
        document.querySelectorAll('.scale-value, #sidebar-scale-value').forEach(el => {
            if (el) el.textContent = Math.round(scale * 100) + '%';
        });
    }
}

// Initialize UI Scale Controller globally
if (!window.uiScaleController) {
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
}

// ============================================
// DOM READY INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, starting initialization...');

    // ✅ CRITICAL: Initialize Supabase client FIRST
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(
            'https://ydnxqnbjoshvxteevemc.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
        );
        window.supabaseAuth = window.supabaseClient;
    }

    // ✅ Wait for helpers to load
    await waitForHelpers();

    // ✅ Setup auth listeners BEFORE loading content
    setupAuthListeners();

    // ✅ Load current user profile
    await loadCurrentUser();

    // ✅ Load content from URL
    await loadContentFromURL();

    // ✅ Setup all UI event listeners
    setupEventListeners();

    // ✅ Initialize video player
    initializeEnhancedVideoPlayer();

    // ✅ Initialize streaming manager (PHASE 4)
    await initializeStreamingManager();

    // Initialize all modals/panels
    setupContentDetailAnalytics();
    setupContentDetailSearch();
    setupContentDetailNotifications();
    setupContentDetailThemeSelector();
    setupContentDetailNavigation();

    // ✅ HOME FEED INTEGRATION
    setupContentDetailSidebar();
    setupContentDetailHeaderProfile();
    setupContentDetailBackToTop();

    // ✅ Load notifications with badge
    await loadNotifications();

    // ✅ Voice Search Setup
    setupVoiceSearch();

    // ✅ PHASE 1: Load Continue Watching section
    if (currentUserId) {
        await loadContinueWatching(currentUserId);
        setupContinueWatchingRefresh();
    }

    // ✅ PHASE 2: Initialize Playlist Manager
    if (window.PlaylistManager && currentUserId) {
        await initializePlaylistManager();
    }

    // ✅ PHASE 3: Initialize Recommendation Engine
    if (currentContent?.id) {
        await initializeRecommendationEngine();
    }

    // ✅ PHASE 1 POLISH: Initialize keyboard shortcuts
    setTimeout(() => {
        if (enhancedVideoPlayer?.video) {
            initializeKeyboardShortcuts();
        }
    }, 1000);

    // ✅ PHASE 2 POLISH: Initialize playlist modal
    if (currentUserId && currentContent?.id) {
        setTimeout(() => {
            initializePlaylistModal();
        }, 500);
    }

    // ✅ CRITICAL: Force hide loading screen after all init
    setTimeout(() => {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');
        if (loading) loading.style.display = 'none';
        if (app) {
            app.style.display = 'block';
            app.style.opacity = '1';
        }
        console.log('🎬 Loading screen forced hidden');
    }, 800);

    console.log('✅ Content Detail FULLY INITIALIZED with all features working!');
    console.log('✅ Home Feed Header & Sidebar Integration Complete');

    // ✅ Debug: Verify critical elements exist
    console.log('🔍 Feature Check:', {
        profileBtn: !!document.getElementById('current-profile-btn'),
        searchBtn: !!document.getElementById('search-btn'),
        notificationsBtn: !!document.getElementById('notifications-btn'),
        sidebarMenu: !!document.getElementById('sidebar-menu'),
        currentUser: !!window.currentUser,
        supabase: !!window.supabaseClient
    });
});

// ============================================
// WAIT FOR HELPERS
// ============================================
async function waitForHelpers() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.SupabaseHelper?.isInitialized || window.AuthHelper?.isInitialized) {
                clearInterval(check);
                resolve();
            }
        }, 100);
        // Timeout after 3 seconds
        setTimeout(() => {
            clearInterval(check);
            resolve();
        }, 3000);
    });
}

// ============================================
// LOAD CURRENT USER
// ============================================
async function loadCurrentUser() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session && session.user) {
            window.currentUser = session.user;
            currentUserId = session.user.id;
            console.log('✅ User authenticated:', window.currentUser.email);

            // Load user profile
            const { data: profile } = await window.supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', currentUserId)
                .maybeSingle();

            if (profile) {
                window.currentProfile = profile;
            }
        } else {
            window.currentUser = null;
            currentUserId = null;
            console.log('⚠️ User not authenticated');
        }
    } catch (error) {
        console.error('❌ Error loading current user:', error);
        window.currentUser = null;
        currentUserId = null;
    }
}

// ============================================
// AUTHENTICATION SETUP
// ============================================
function setupAuthListeners() {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state changed:', event);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            window.currentUser = session?.user || null;
            currentUserId = window.currentUser?.id || null;

            if (currentUserId) {
                const { data: profile } = await window.supabaseClient
                    .from('user_profiles')
                    .select('*')
                    .eq('id', currentUserId)
                    .maybeSingle();

                if (profile) {
                    window.currentProfile = profile;
                }
            }

            updateProfileUI();
            updateHeaderProfile();
            updateSidebarProfile();
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

            // Reload notifications
            await loadNotifications();
        } else if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            currentUserId = null;
            window.currentProfile = null;
            playlistManager = null;
            playlistModal = null;

            resetProfileUI();
            updateHeaderProfile();
            updateSidebarProfile();
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

            // Update notification badge
            updateNotificationBadge(0);
        }
    });

    // Check initial auth state
    if (window.AuthHelper?.isAuthenticated?.()) {
        currentUserId = window.AuthHelper.getUserProfile()?.id || null;
        updateProfileUI();
    } else {
        resetProfileUI();
    }
}

// ============================================
// UPDATE PROFILE UI
// ============================================
function updateProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');

    if (!profileBtn || !userProfilePlaceholder) return;

    if (window.AuthHelper?.isAuthenticated?.()) {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        const initial = displayName.charAt(0).toUpperCase();

        if (avatarUrl) {
            userProfilePlaceholder.innerHTML = `
                <img src="${avatarUrl}" alt="${displayName}"
                    class="profile-img"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
            `;
        } else {
            userProfilePlaceholder.innerHTML = `
                <div class="profile-placeholder" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                ">${initial}</div>
            `;
        }

        profileBtn.onclick = () => {
            window.location.href = 'profile.html';
        };
    } else {
        userProfilePlaceholder.innerHTML = `
            <div class="profile-placeholder">
                <i class="fas fa-user"></i>
            </div>
        `;

        profileBtn.onclick = () => {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        };
    }

    // Update comment input
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');

    if (commentInput && sendCommentBtn) {
        if (window.AuthHelper?.isAuthenticated?.()) {
            commentInput.disabled = false;
            commentInput.placeholder = 'Write a comment...';
            sendCommentBtn.disabled = false;

            const userProfile = window.AuthHelper.getUserProfile();
            const displayName = window.AuthHelper.getDisplayName();
            const avatarUrl = window.AuthHelper.getAvatarUrl();
            const commentAvatar = document.getElementById('userCommentAvatar');

            if (commentAvatar) {
                if (avatarUrl) {
                    commentAvatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">${displayName.charAt(0)}</div>`;
                }
            }
        } else {
            commentInput.disabled = true;
            commentInput.placeholder = 'Sign in to add a comment...';
            sendCommentBtn.disabled = true;

            const commentAvatar = document.getElementById('userCommentAvatar');
            if (commentAvatar) {
                commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
    }
}

// ============================================
// RESET PROFILE UI
// ============================================
function resetProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');

    if (!profileBtn || !userProfilePlaceholder) return;

    userProfilePlaceholder.innerHTML = `
        <div class="profile-placeholder">
            <i class="fas fa-user"></i>
        </div>
    `;

    profileBtn.onclick = () => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    };
}

// ============================================
// VOICE SEARCH SETUP
// ============================================
function setupVoiceSearch() {
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const voiceStatus = document.getElementById('voice-search-status');

    // ✅ Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (voiceSearchBtn) {
            voiceSearchBtn.style.display = 'none';
            voiceSearchBtn.title = 'Voice search not supported';
        }
        console.log('⚠️ Voice search not supported in this browser');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-ZA';

    const startVoiceSearch = () => {
        if (!window.currentUser) {
            showToast('Please sign in to use voice search', 'warning');
            return;
        }

        recognition.start();
        if (voiceStatus) voiceStatus.classList.add('active');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');

        if (searchInput) {
            searchInput.value = transcript;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (voiceStatus) voiceStatus.classList.remove('active');
        showToast(`Searching: "${transcript}"`, 'info');
    };

    recognition.onerror = (event) => {
        console.error('Voice search error:', event.error);
        if (voiceStatus) voiceStatus.classList.remove('active');

        if (event.error === 'not-allowed') {
            showToast('Microphone access denied', 'error');
        } else if (event.error === 'no-speech') {
            showToast('No speech detected', 'warning');
        }
    };

    recognition.onend = () => {
        if (voiceStatus) voiceStatus.classList.remove('active');
    };

    if (voiceSearchBtn) {
        // ✅ Clone to remove existing listeners
        const newBtn = voiceSearchBtn.cloneNode(true);
        voiceSearchBtn.parentNode.replaceChild(newBtn, voiceSearchBtn);
        newBtn.addEventListener('click', startVoiceSearch);
    }

    console.log('✅ Voice search initialized');
}

// ============================================
// GLOBAL SCALE SHORTCUTS
// ============================================
function setupGlobalScaleShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl++ for increase
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            window.uiScaleController?.increase();
        }

        // Ctrl+- for decrease
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            window.uiScaleController?.decrease();
        }

        // Ctrl+0 for reset
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            window.uiScaleController?.reset();
        }

        // Alt+P for profile dropdown
        if (e.altKey && e.key === 'p') {
            e.preventDefault();
            toggleProfileDropdown();
        }

        // Alt+N for notifications
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            const notificationsPanel = document.getElementById('notifications-panel');
            if (notificationsPanel) {
                notificationsPanel.classList.add('active');
                renderNotifications();
            }
        }

        // Alt+A for analytics
        if (e.altKey && e.key === 'a') {
            e.preventDefault();
            const analyticsModal = document.getElementById('analytics-modal');
            if (analyticsModal && window.currentUser) {
                analyticsModal.classList.add('active');
                loadPersonalAnalytics();
            } else if (!window.currentUser) {
                showToast('Please sign in to view analytics', 'warning');
            }
        }

        // Ctrl+K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchModal = document.getElementById('search-modal');
            const searchInput = document.getElementById('search-input');
            if (searchModal) {
                searchModal.classList.add('active');
                setTimeout(() => searchInput?.focus(), 300);
            }
        }
    });
}

// Call this after UI Scale Controller is initialized
setupGlobalScaleShortcuts();

// ============================================
// PROFILE DROPDOWN TOGGLE
// ============================================
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// ============================================
// UPDATE PROFILE SWITCHER
// ============================================
function updateProfileSwitcher() {
    const profileList = document.getElementById('profile-list');
    if (!profileList || !window.userProfiles) return;

    profileList.innerHTML = window.userProfiles.map(profile => {
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
                await loadContinueWatchingSection();
                await loadForYouSection();
                showToast(`Switched to ${profile.name}`, 'success');
            }
        });
    });
}

// ============================================
// FIX AVATAR URL
// ============================================
function fixAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.includes('supabase.co')) return url;

    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

// ============================================
// PHASE 1 POLISH: Initialize Keyboard Shortcuts
// ============================================
function initializeKeyboardShortcuts() {
    if (!window.KeyboardShortcuts) {
        console.warn('⚠️ KeyboardShortcuts not loaded yet');
        return;
    }

    if (!enhancedVideoPlayer?.video) {
        console.warn('⚠️ Video player not ready for keyboard shortcuts');
        return;
    }

    try {
        keyboardShortcuts = new window.KeyboardShortcuts({
            videoElement: enhancedVideoPlayer.video,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id
        });

        window.keyboardShortcuts = keyboardShortcuts;
        console.log('✅ Keyboard shortcuts initialized');
    } catch (error) {
        console.error('❌ Failed to initialize keyboard shortcuts:', error);
    }
}

// ============================================
// PHASE 2 POLISH: Initialize Playlist Modal
// ============================================
function initializePlaylistModal() {
    if (!window.PlaylistModal) {
        console.warn('⚠️ PlaylistModal not loaded yet');
        return;
    }

    if (!currentUserId || !currentContent?.id) {
        console.warn('⚠️ Cannot initialize playlist modal: missing user or content');
        return;
    }

    try {
        playlistModal = new window.PlaylistModal({
            supabase: window.supabaseClient,
            userId: currentUserId,
            contentId: currentContent.id
        });

        window.playlistModal = playlistModal;

        // Update Watch Later button to open modal
        const watchLaterBtn = document.getElementById('watchLaterBtn');
        if (watchLaterBtn) {
            const newBtn = watchLaterBtn.cloneNode(true);
            watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();

                if (!currentUserId) {
                    showToast('Please sign in to use playlists', 'warning');
                    const redirect = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${redirect}`;
                    return;
                }

                playlistModal.open();
            });
        }

        console.log('✅ Playlist modal initialized');
    } catch (error) {
        console.error('❌ Failed to initialize playlist modal:', error);
    }
}

// ============================================
// PHASE 2: PLAYLIST MANAGER INITIALIZATION
// ============================================
async function initializePlaylistManager() {
    if (typeof window.PlaylistManager !== 'function') {
        console.warn('⚠️ PlaylistManager class not found');
        return;
    }

    if (!currentUserId) {
        console.log('🔓 Guest user — playlist features disabled');
        return;
    }

    try {
        playlistManager = new window.PlaylistManager({
            supabase: window.supabaseClient,
            userId: currentUserId,
            watchLaterName: 'Watch Later',
            onPlaylistUpdated: function(data) {
                console.log('📋 Playlist updated:', data);
                updateWatchLaterButtonState();
            },
            onError: function(err) {
                console.error('❌ Playlist error:', err);
                showToast('Playlist error: ' + (err.error || err.message), 'error');
            }
        });

        await updateWatchLaterButtonState();
        console.log('✅ PlaylistManager initialized');
    } catch (error) {
        console.error('❌ Failed to initialize PlaylistManager:', error);
        showToast('Watch Later unavailable', 'warning');
    }
}

// ============================================
// PHASE 3: RECOMMENDATION ENGINE INITIALIZATION
// ============================================
async function initializeRecommendationEngine() {
    if (!window.RecommendationEngine) {
        console.warn('⚠️ RecommendationEngine not loaded');
        return;
    }

    if (!currentContent?.id) {
        console.warn('⚠️ No content loaded for recommendations');
        return;
    }

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
        console.log('✅ RecommendationEngine initialized');
    } catch (error) {
        console.error('❌ Failed to initialize RecommendationEngine:', error);
    }
}

// ============================================
// PHASE 4: STREAMING MANAGER INITIALIZATION
// ============================================
async function initializeStreamingManager() {
    if (!window.StreamingManager) {
        console.warn('⚠️ StreamingManager not loaded');
        return;
    }

    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;

    try {
        streamingManager = new window.StreamingManager({
            videoElement: videoElement,
            supabaseClient: window.supabaseClient,
            contentId: currentContent?.id,
            userId: currentUserId,
            onQualityChange: function(data) {
                console.log('📺 Quality changed:', data);
                updateQualityIndicator(data.quality);
                showToast('Quality: ' + data.quality, 'info');
                setupQualitySelector();
            },
            onDataSaverToggle: function(data) {
                console.log('💾 Data saver:', data.enabled ? 'ON' : 'OFF');
                updateQualityIndicator(streamingManager.getCurrentQuality());
                showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
            },
            onError: function(err) {
                console.error('❌ Streaming error:', err);
            }
        });

        await streamingManager.initialize();

        // Set up periodic network speed updates
        setInterval(() => {
            if (streamingManager) {
                const speed = streamingManager.getNetworkSpeed();
                if (speed) {
                    updateNetworkSpeedIndicator(speed / 1000000);
                }
            }
        }, 5000);

        // ✅ CRITICAL: Setup quality selector AFTER streaming manager is ready
        setupQualitySelector();
        setupDataSaverToggle();

        // Initialize quality indicator with current quality
        setTimeout(() => {
            if (streamingManager) {
                updateQualityIndicator(streamingManager.getCurrentQuality());
            }
        }, 1000);

        console.log('✅ StreamingManager initialized');
    } catch (error) {
        console.error('❌ Failed to initialize StreamingManager:', error);
    }
}

// ============================================
// PHASE 4: Setup quality selector UI
// ============================================
function setupQualitySelector() {
    const qualityContainer = document.getElementById('qualityOptions');
    if (!qualityContainer) {
        console.warn('⚠️ Quality options container not found');
        return;
    }

    const qualities = streamingManager?.getAvailableQualities?.() || [
        { label: 'Auto', value: 'auto' },
        { label: '1080p', value: '1080p' },
        { label: '720p', value: '720p' },
        { label: '480p', value: '480p' },
        { label: '360p', value: '360p' }
    ];

    console.log('📺 Setting up quality selector with', qualities.length, 'qualities');

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
                console.log('📺 Quality changed to:', quality);
                showToast('Quality: ' + quality.toUpperCase(), 'info');
            }

            const settingsMenu = document.querySelector('.settings-menu');
            if (settingsMenu) {
                settingsMenu.classList.remove('active');
            }
        });
    });

    console.log('✅ Quality selector initialized');
}

// PHASE 4: Setup data saver toggle
function setupDataSaverToggle() {
    const toggle = document.getElementById('dataSaverToggle');
    if (!toggle) return;

    if (streamingManager?.isDataSaverEnabled()) {
        toggle.checked = true;
    }

    toggle.addEventListener('change', async function() {
        if (streamingManager) {
            streamingManager.toggleDataSaver(this.checked);
        }
    });
}

// ============================================
// PHASE 4: QUALITY INDICATOR UPDATE
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

// ============================================
// PHASE 4: NETWORK SPEED INDICATOR UPDATE
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
// LOAD RECOMMENDATION RAILS
// ============================================
async function loadRecommendationRails() {
    if (!recommendationEngine) return;

    const railConfigs = [
        {
            type: recommendationEngine.TYPES.BECAUSE_YOU_WATCHED,
            containerId: 'becauseYouWatchedRail',
            title: 'Because You Watched',
            options: { limit: 8 }
        },
        {
            type: recommendationEngine.TYPES.MORE_FROM_CREATOR,
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

    const results = await recommendationEngine.getMultipleRails(railConfigs);

    results.forEach(({ type, results: items }) => {
        const config = railConfigs.find(r => r.type === type);
        if (config && items?.length > 0) {
            renderRecommendationRail(config.containerId, config.title, items);
        } else if (config) {
            showRailEmpty(config.containerId, config.title);
        }
    });
}

// ============================================
// SHOW SKELETON LOADER FOR RAIL
// ============================================
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

// ============================================
// SHOW EMPTY STATE FOR RAIL
// ============================================
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

// ============================================
// RENDER RECOMMENDATION RAIL
// ============================================
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
        const progress = item.watch_progress ?
            Math.min(100, Math.round((item.watch_progress.last_position / (item.duration || 3600)) * 100))
            : null;

        const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);

        return `
            <a href="content-detail.html?id=${item.id}" class="content-card recommendation-card">
                <div class="card-thumbnail">
                    <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}"
                        alt="${item.title}"
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
// PHASE 2: UPDATE WATCH LATER BUTTON STATE
// ============================================
async function updateWatchLaterButtonState() {
    const btn = document.getElementById('watchLaterBtn');

    if (!btn || !currentContent?.id || !playlistManager) {
        if (!btn) {
            console.log('⏳ Watch Later button not in DOM yet, retrying...');
            setTimeout(updateWatchLaterButtonState, 500);
        }
        return;
    }

    try {
        const isInList = await playlistManager.isInWatchLater(currentContent.id);

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

// ============================================
// PHASE 2: HANDLE WATCH LATER BUTTON CLICK
// ============================================
async function handleWatchLaterToggle() {
    const btn = document.getElementById('watchLaterBtn');

    if (!currentContent?.id) {
        showToast('No content selected', 'error');
        return;
    }

    if (!currentUserId) {
        showToast('Sign in to save to Watch Later', 'warning');
        const redirect = encodeURIComponent(window.location.href);
        window.location.href = `login.html?redirect=${redirect}`;
        return;
    }

    if (window.playlistModal) {
        window.playlistModal.contentId = currentContent.id;
        window.playlistModal.open();
        return;
    }

    if (!playlistManager) {
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
        const result = await playlistManager.toggleWatchLater(currentContent.id);

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

// ============================================
// PHASE 2: SETUP WATCH LATER BUTTON
// ============================================
function setupWatchLaterButton() {
    const watchLaterBtn = document.getElementById('watchLaterBtn');

    if (!watchLaterBtn) {
        console.warn('⚠️ Watch Later button not found in DOM');
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

// ============================================
// ADD RESUME BUTTON
// ============================================
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
// INITIALIZE LIKE BUTTON
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
        if (error) {
            console.warn('Like check failed:', error.message);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Like check error:', error);
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

// ============================================
// INITIALIZE FAVORITE BUTTON
// ============================================
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
        if (error) {
            console.warn('Favorite check failed:', error.message);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Favorite check error:', error);
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

// ============================================
// UPDATE CONTENT UI
// ============================================
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

    // ✅ CRITICAL FIX: SET CREATOR AVATAR
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (creatorAvatar && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || 'Creator';
        const initial = displayName.charAt(0).toUpperCase();

        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}"
                    alt="${escapeHtml(displayName)}"
                    style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
            console.log('✅ Creator avatar set from URL:', fixedAvatarUrl);
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
            console.log('✅ Creator avatar fallback to initials:', initial);
        }
    }

    // ✅ Make creator section clickable
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

    // ✅ Set poster image
    const posterPlaceholder = document.getElementById('posterPlaceholder');
    if (posterPlaceholder && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
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

// ============================================
// LOAD COMMENTS
// ============================================
async function loadComments(contentId) {
    try {
        console.log('💬 Loading comments for content:', contentId);

        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('content_id', contentId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Loaded ${comments.length} comments`);
        renderComments(comments || []);

        const countEl = document.getElementById('commentsCount');
        if (countEl) {
            countEl.textContent = `(${comments.length})`;
        }

        if (currentContent) {
            const { error: updateError } = await window.supabaseClient
                .from('Content')
                .update({ comments_count: comments.length })
                .eq('id', currentContent.id);

            if (updateError) {
                console.warn('Failed to update comments_count:', updateError);
            }
        }
    } catch (error) {
        console.error('❌ Comments load failed:', error);
        showToast('Failed to load comments', 'error');
        renderComments([]);
    }
}

// ============================================
// RENDER COMMENTS
// ============================================
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

    const fragment = document.createDocumentFragment();
    comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        fragment.appendChild(commentEl);
    });

    container.appendChild(fragment);
}

// ============================================
// CREATE COMMENT ELEMENT
// ============================================
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
                        style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);">` :
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
                        border: 2px solid rgba(29, 78, 216, 0.2);
                    ">${initial}</div>`
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
// LOAD RELATED CONTENT
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

        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
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
// VIDEO PLAYER INITIALIZATION
// ============================================
function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');

    if (!videoElement || !videoContainer) {
        console.warn('⚠️ Video elements not found');
        return;
    }

    try {
        const preferences = window.state ? window.state.getPreferences() : {
            autoplay: false,
            playbackSpeed: 1.0,
            quality: 'auto'
        };

        console.log('🎬 Creating EnhancedVideoPlayer with content:', currentContent?.id);

        enhancedVideoPlayer = new EnhancedVideoPlayer({
            autoplay: preferences.autoplay,
            defaultSpeed: preferences.playbackSpeed,
            defaultQuality: preferences.quality,
            defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
            muted: window.stateManager ? window.stateManager.getState('session.muted') : false,
            contentId: currentContent?.id || null,
            supabaseClient: window.supabaseClient,
            userId: currentUserId
        });

        enhancedVideoPlayer.attach(videoElement, videoContainer);

        enhancedVideoPlayer.on('play', () => {
            console.log('▶️ Video playing...');
            if (window.stateManager) {
                window.stateManager.setState('session.playing', true);
            }
            initializeWatchSessionOnPlay();
        });

        enhancedVideoPlayer.on('pause', () => {
            if (window.stateManager) {
                window.stateManager.setState('session.playing', false);
            }
        });

        enhancedVideoPlayer.on('volumechange', (volume) => {
            if (window.stateManager) {
                window.stateManager.setState('session.volume', volume);
            }
        });

        enhancedVideoPlayer.on('error', (error) => {
            console.error('🔴 Video player error:', error);
            showToast('Playback error occurred', 'error');
        });

        enhancedVideoPlayer.on('loadeddata', () => {
            console.log('✅ Video metadata loaded, ready to play');
            const placeholder = document.getElementById('videoPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });

        enhancedVideoPlayer.on('canplay', () => {
            console.log('✅ Video can start playing');
        });

        console.log('✅ Enhanced video player initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
        showToast('Video player failed to load. Using basic player.', 'warning');
        videoElement.controls = true;
    }
}

// ============================================
// INITIALIZE WATCH SESSION ON PLAY
// ============================================
function initializeWatchSessionOnPlay() {
    if (!currentContent || !currentUserId || !enhancedVideoPlayer?.video) {
        console.log('⏭️ Cannot initialize watch session: missing content, user, or video');
        return;
    }

    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }

    try {
        if (typeof window.WatchSession === 'undefined') {
            console.warn('WatchSession not available, cannot track progress');
            return;
        }

        console.log('🎬 Initializing WatchSession for content:', currentContent.id);

        watchSession = new window.WatchSession({
            contentId: currentContent.id,
            userId: currentUserId,
            supabase: window.supabaseClient,
            videoElement: enhancedVideoPlayer.video,
            syncInterval: 10000,
            viewThreshold: 20,
            completionThreshold: 0.9,
            onProgressSync: function(data) {
                console.log('📊 Progress synced:', data);
            },
            onViewCounted: function(data) {
                console.log('👁️ View counted:', data);
                refreshCountsFromSource();
            },
            onComplete: function(data) {
                console.log('🏆 Content completed:', data);
                showToast('✅ You finished this video!', 'success');

                var resumeBtn = document.getElementById('resumeBtn');
                if (resumeBtn) {
                    resumeBtn.remove();
                    var playBtn = document.getElementById('playBtn');
                    if (playBtn) playBtn.style.display = 'flex';
                }
            },
            onError: function(error) {
                console.error('❌ Watch session error:', error.context, error.error);
            }
        });

        window._watchSession = watchSession;

        setTimeout(function() {
            if (watchSession && enhancedVideoPlayer && enhancedVideoPlayer.video) {
                watchSession.start(enhancedVideoPlayer.video);
                console.log('✅ Watch session started successfully');
            }
        }, 500);
    } catch (error) {
        console.error('❌ Failed to initialize watch session:', error);
    }
}

// ============================================
// RECORD CONTENT VIEW
// ============================================
async function recordContentView(contentId) {
    try {
        let viewerId = null;
        if (window.AuthHelper?.isAuthenticated?.()) {
            const userProfile = window.AuthHelper.getUserProfile();
            viewerId = userProfile?.id || null;
        }

        const { data, error } = await window.supabaseClient
            .from('content_views')
            .insert({
                content_id: contentId,
                viewer_id: viewerId,
                view_duration: 0,
                device_type: /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)
                    ? 'mobile'
                    : 'desktop',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('❌ View recording failed:', error);
            return false;
        }

        console.log('✅ View recorded in content_views:', data);
        return true;
    } catch (error) {
        console.error('❌ View recording error:', error);
        return false;
    }
}

// ============================================
// REFRESH COUNTS FROM SOURCE
// ============================================
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

        console.log('✅ Counts refreshed from source tables:', {
            views: newViews,
            likes: newLikes
        });
    } catch (error) {
        console.error('❌ Failed to refresh counts from source:', error);
    }
}

// ============================================
// CLIENT-SIDE VIEW DEDUPLICATION
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
// HANDLE PLAY
// ============================================
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

    // ✅ Record view on play
    if (!hasViewedContentRecently(currentContent.id)) {
        const viewsEl = document.getElementById('viewsCount');
        const viewsFullEl = document.getElementById('viewsCountFull');
        const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
        const newViews = currentViews + 1;

        if (viewsEl && viewsFullEl) {
            viewsEl.textContent = `${formatNumber(newViews)} views`;
            viewsFullEl.textContent = formatNumber(newViews);
        }

        recordContentView(currentContent.id)
            .then(async function(success) {
                if (success) {
                    markContentAsViewed(currentContent.id);
                    await refreshCountsFromSource();

                    if (window.track?.contentView) {
                        window.track.contentView(currentContent.id, 'video');
                    }
                } else {
                    if (viewsEl && viewsFullEl) {
                        viewsEl.textContent = `${formatNumber(currentViews)} views`;
                        viewsFullEl.textContent = formatNumber(currentViews);
                    }
                }
            })
            .catch(function(error) {
                console.error('View recording error:', error);
                if (viewsEl && viewsFullEl) {
                    viewsEl.textContent = `${formatNumber(currentViews)} views`;
                    viewsFullEl.textContent = formatNumber(currentViews);
                }
            });
    }

    // ✅ Show player
    player.style.display = 'block';

    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // ✅ Hide hero poster when player is active
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.style.opacity = '0.3';
    }

    // ✅ Show close button in hero actions
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.style.display = 'flex';
    }

    // Ensure audio is enabled
    console.log('🔊 Preparing playback');
    videoElement.muted = false;
    videoElement.defaultMuted = false;
    videoElement.volume = 1.0;

    // ✅ SCROLL TO TOP
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // PHASE 4: Check if HLS is available
    if (currentContent.hls_manifest_url && streamingManager) {
        console.log('📺 Using HLS streaming');
        streamingManager.initialize();

        setTimeout(() => {
            if (streamingManager) {
                updateQualityIndicator(streamingManager.getCurrentQuality());
            }
        }, 1000);

        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.setAttribute('data-media-type', 'video');
        }
        return;
    }

    // Fallback to direct file
    let fileUrl = currentContent.file_url;

    if (fileUrl && !fileUrl.startsWith('http')) {
        if (fileUrl.startsWith('/')) {
            fileUrl = fileUrl.substring(1);
        }
        fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
    }

    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined' || fileUrl === '') {
        if (currentContent.thumbnail_url && !currentContent.thumbnail_url.startsWith('http')) {
            const cleanPath = currentContent.thumbnail_url.startsWith('/')
                ? currentContent.thumbnail_url.substring(1)
                : currentContent.thumbnail_url;
            fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
        }
    }

    console.log('🎵 Final file URL:', fileUrl);

    // ✅ ALLOW AUDIO FILES
    const isAudioFile = fileUrl && (
        fileUrl.includes('.mp3') ||
        fileUrl.includes('.wav') ||
        fileUrl.includes('.ogg') ||
        fileUrl.includes('.aac') ||
        fileUrl.includes('.m4a')
    );

    const isVideoFile = fileUrl && (
        fileUrl.includes('.mp4') ||
        fileUrl.includes('.webm') ||
        fileUrl.includes('.mov')
    );

    if (!fileUrl || (!isAudioFile && !isVideoFile)) {
        console.error('❌ Invalid file format:', fileUrl);
        showToast('Invalid file format. Supported: MP4, WebM, MP3, WAV, OGG', 'error');
        return;
    }

    // ✅ SET POSTER FOR AUDIO FILES
    if (isAudioFile && currentContent.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(currentContent.thumbnail_url) || currentContent.thumbnail_url;
        videoElement.setAttribute('poster', imgUrl);
        console.log('🎵 Audio file detected - setting poster:', imgUrl);
    } else {
        videoElement.removeAttribute('poster');
    }

    // Set media type attribute
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        if (isAudioFile) {
            videoContainer.setAttribute('data-media-type', 'audio');
        } else {
            videoContainer.setAttribute('data-media-type', 'video');
        }
    }

    // Clean up existing player
    if (enhancedVideoPlayer) {
        try {
            console.log('🗑️ Destroying existing player...');
            enhancedVideoPlayer.destroy();
        } catch (e) {
            console.warn('Error destroying old player:', e);
        }
        enhancedVideoPlayer = null;
    }

    if (watchSession) {
        watchSession.stop();
        watchSession = null;
    }

    // Set file source
    console.log('🔧 Setting file source...');
    while (videoElement.firstChild) {
        videoElement.removeChild(videoElement.firstChild);
    }

    videoElement.removeAttribute('src');
    videoElement.src = '';

    const source = document.createElement('source');
    source.src = fileUrl;

    if (isAudioFile) {
        if (fileUrl.endsWith('.mp3')) {
            source.type = 'audio/mpeg';
        } else if (fileUrl.endsWith('.wav')) {
            source.type = 'audio/wav';
        } else if (fileUrl.endsWith('.ogg')) {
            source.type = 'audio/ogg';
        } else if (fileUrl.endsWith('.aac')) {
            source.type = 'audio/aac';
        } else if (fileUrl.endsWith('.m4a')) {
            source.type = 'audio/mp4';
        } else {
            source.type = 'audio/mpeg';
        }
        console.log('🎵 Audio source type:', source.type);
    } else {
        if (fileUrl.endsWith('.mp4')) {
            source.type = 'video/mp4';
        } else if (fileUrl.endsWith('.webm')) {
            source.type = 'video/webm';
        } else if (fileUrl.endsWith('.mov')) {
            source.type = 'video/quicktime';
        } else {
            source.type = 'video/mp4';
        }
        console.log('📺 Video source type:', source.type);
    }

    videoElement.appendChild(source);
    videoElement.load();

    console.log('✅ File source set successfully');
    console.log('🎬 Initializing EnhancedVideoPlayer...');
    initializeEnhancedVideoPlayer();

    // PHASE 4: Reinitialize streaming manager
    setTimeout(() => {
        if (streamingManager) {
            streamingManager.destroy();
            streamingManager = null;
        }
        initializeStreamingManager();
    }, 100);

    // Auto-play after setup
    setTimeout(() => {
        console.log('▶️ Attempting to play...');
        if (enhancedVideoPlayer) {
            enhancedVideoPlayer.play().catch(function(err) {
                console.error('🔴 Play failed:', err);
                showToast('Click play button in video player', 'info');
            });
        } else {
            videoElement.play().catch(function(err) {
                console.error('🔴 Autoplay failed:', err);
                showToast('Click play button in video player', 'info');
            });
        }
    }, 500);

    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ============================================
// CLOSE VIDEO PLAYER
// ============================================
function closeVideoPlayer() {
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');

    if (player) {
        player.style.display = 'none';
    }

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

    if (streamingManager) {
        streamingManager.destroy();
        streamingManager = null;
    }

    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }

    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.style.opacity = '1';
    }

    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.style.display = 'none';
    }

    const hero = document.querySelector('.content-hero');
    if (hero) {
        hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');

    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', handlePlay);
    }

    const poster = document.getElementById('heroPoster');
    if (poster) {
        poster.addEventListener('click', handlePlay);
    }

    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.addEventListener('click', function() {
            closeVideoPlayer();
        });
    }

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullPlayerBtn = document.getElementById('fullPlayerBtn');

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (enhancedVideoPlayer) {
                enhancedVideoPlayer.toggleFullscreen();
            }
        });
    }

    if (fullPlayerBtn) {
        fullPlayerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (enhancedVideoPlayer) {
                enhancedVideoPlayer.toggleFullscreen();
            }
        });
    }

    // LIKE BUTTON
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async function() {
            if (!currentContent) return;

            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to like content', 'warning');
                return;
            }

            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            const isLiked = likeBtn.classList.contains('active');
            const likesCountEl = document.getElementById('likesCount');
            const currentLikes = parseInt(likesCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;

            try {
                likeBtn.classList.toggle('active', !isLiked);
                likeBtn.innerHTML = !isLiked
                    ? '<i class="fas fa-heart"></i><span>Liked</span>'
                    : '<i class="far fa-heart"></i><span>Like</span>';

                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(newLikes);
                }

                if (!isLiked) {
                    const { error } = await window.supabaseClient
                        .from('content_likes')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });

                    if (error) throw error;
                } else {
                    const { error } = await window.supabaseClient
                        .from('content_likes')
                        .delete()
                        .eq('user_id', userProfile.id)
                        .eq('content_id', currentContent.id);

                    if (error) throw error;
                }

                await refreshCountsFromSource();
                showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');

                if (window.track?.contentLike) {
                    window.track.contentLike(currentContent.id, !isLiked);
                }
            } catch (error) {
                console.error('Like operation failed:', error);
                likeBtn.classList.toggle('active', isLiked);
                likeBtn.innerHTML = isLiked
                    ? '<i class="fas fa-heart"></i><span>Liked</span>'
                    : '<i class="far fa-heart"></i><span>Like</span>';

                if (likesCountEl) {
                    likesCountEl.textContent = formatNumber(currentLikes);
                }

                showToast('Failed: ' + error.message, 'error');
            }
        });
    }

    // FAVORITE BUTTON
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async function() {
            if (!currentContent) return;

            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('Sign in to favorite content', 'warning');
                return;
            }

            const userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            const isFavorited = favoriteBtn.classList.contains('active');
            const favCountEl = document.getElementById('favoritesCount');
            const currentFavorites = parseInt(favCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
            const newFavorites = isFavorited ? currentFavorites - 1 : currentFavorites + 1;

            try {
                favoriteBtn.classList.toggle('active', !isFavorited);
                favoriteBtn.innerHTML = !isFavorited
                    ? '<i class="fas fa-star"></i><span>Favorited</span>'
                    : '<i class="far fa-star"></i><span>Favorite</span>';

                if (favCountEl) {
                    favCountEl.textContent = formatNumber(newFavorites);
                }

                if (!isFavorited) {
                    const { error } = await window.supabaseClient
                        .from('favorites')
                        .insert({
                            user_id: userProfile.id,
                            content_id: currentContent.id
                        });

                    if (error) throw error;
                } else {
                    const { error } = await window.supabaseClient
                        .from('favorites')
                        .delete()
                        .eq('user_id', userProfile.id)
                        .eq('content_id', currentContent.id);

                    if (error) throw error;
                }

                const { error: updateError } = await window.supabaseClient
                    .from('Content')
                    .update({ favorites_count: newFavorites })
                    .eq('id', currentContent.id);

                if (updateError) {
                    console.warn('Favorites count update failed:', updateError);
                }

                currentContent.favorites_count = newFavorites;
                showToast(!isFavorited ? 'Added to favorites!' : 'Removed from favorites', !isFavorited ? 'success' : 'info');
                await refreshCountsFromSource();
            } catch (error) {
                console.error('Favorite update failed:', error);
                favoriteBtn.classList.toggle('active', isFavorited);
                favoriteBtn.innerHTML = isFavorited
                    ? '<i class="fas fa-star"></i><span>Favorited</span>'
                    : '<i class="far fa-star"></i><span>Favorite</span>';

                if (favCountEl) {
                    favCountEl.textContent = formatNumber(currentFavorites);
                }

                showToast('Failed to update favorite', 'error');
            }
        });
    }

    // WATCH LATER BUTTON
    setupWatchLaterButton();

    // REFRESH COMMENTS
    const refreshBtn = document.getElementById('refreshCommentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            if (currentContent) {
                showToast('Refreshing comments...', 'info');
                await loadComments(currentContent.id);
                showToast('Comments refreshed!', 'success');
            }
        });
    }

    // COMMENT SUBMISSION
    const sendBtn = document.getElementById('sendCommentBtn');
    const commentInput = document.getElementById('commentInput');

    if (sendBtn && commentInput) {
        sendBtn.addEventListener('click', async function() {
            const text = commentInput.value.trim();

            if (!text) {
                showToast('Please enter a comment', 'warning');
                return;
            }

            if (!window.AuthHelper?.isAuthenticated?.()) {
                showToast('You need to sign in to comment', 'warning');
                return;
            }

            if (!currentContent) return;

            const originalHTML = sendBtn.innerHTML;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            sendBtn.disabled = true;

            try {
                const userProfile = window.AuthHelper.getUserProfile();
                const displayName = window.AuthHelper.getDisplayName();
                const avatarUrl = window.AuthHelper.getAvatarUrl();

                if (!userProfile?.id) {
                    throw new Error('User profile not found');
                }

                const { data: newComment, error: insertError } = await window.supabaseClient
                    .from('comments')
                    .insert({
                        content_id: currentContent.id,
                        user_id: userProfile.id,
                        author_name: displayName,
                        comment_text: text,
                        author_avatar: avatarUrl || null,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Comment insert error:', insertError);
                    throw insertError;
                }

                console.log('✅ Comment inserted:', newComment);
                await loadComments(currentContent.id);
                await refreshCountsFromSource();

                commentInput.value = '';
                showToast('Comment added!', 'success');

                if (window.track?.contentComment) {
                    window.track.contentComment(currentContent.id);
                }
            } catch (error) {
                console.error('❌ Comment submission failed:', error);
                showToast(error.message || 'Failed to add comment', 'error');
            } finally {
                sendBtn.innerHTML = originalHTML;
                sendBtn.disabled = false;
            }
        });

        commentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    }

    // BACK TO TOP
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopBtn.style.display = 'flex';
            } else {
                backToTopBtn.style.display = 'none';
            }
        });
    }

    // SHARE BUTTON
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async function() {
            if (!currentContent) return;

            const shareText = `📺 ${currentContent.title}
${currentContent.description || 'Check out this amazing content!'}
👉 Watch on Bantu Stream Connect
NO DNA, JUST RSA
`;
            const shareUrl = window.location.href;

            try {
                if (navigator.share && navigator.canShare({ text: shareText, url: shareUrl })) {
                    await navigator.share({
                        title: 'Bantu Stream Connect',
                        text: shareText,
                        url: shareUrl
                    });
                } else {
                    await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
                    showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');

                    if (window.track?.contentShare) {
                        window.track.contentShare(currentContent.id, 'clipboard');
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    showToast('Failed to share. Try copying link manually.', 'error');
                }
            }
        });
    }

    setupConnectButtons();
    console.log('✅ Event listeners setup complete');
}

// ============================================
// SETUP CONNECT BUTTONS
// ============================================
function setupConnectButtons() {
    async function checkConnectionStatus(creatorId) {
        if (!window.AuthHelper?.isAuthenticated() || !creatorId) return false;

        var userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return false;

        return window.supabaseClient
            .from('connectors')
            .select('id')
            .eq('connector_id', userProfile.id)
            .eq('connected_id', creatorId)
            .single()
            .then(function(result) {
                return !result.error && result.data !== null;
            })
            .catch(function() {
                return false;
            });
    }

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn && currentContent?.creator_id) {
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });

        connectBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                var shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }

            var userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            var isConnected = connectBtn.classList.contains('connected');

            try {
                if (isConnected) {
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);

                    if (error) throw error;

                    connectBtn.classList.remove('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });

                    if (error) throw error;

                    connectBtn.classList.add('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');

                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }

    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectCreatorBtn && currentContent?.creator_id) {
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });

        connectCreatorBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                var shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }

            var userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }

            var isConnected = connectCreatorBtn.classList.contains('connected');

            try {
                if (isConnected) {
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);

                    if (error) throw error;

                    connectCreatorBtn.classList.remove('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });

                    if (error) throw error;

                    connectCreatorBtn.classList.add('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');

                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }
}

// ============================================
// HOME FEED HEADER & SIDEBAR INTEGRATION
// ============================================

// ============================================
// SIDEBAR SETUP - FIXED VERSION (DIRECT ONCLICK HANDLERS)
// ============================================
function setupContentDetailSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');

    if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) {
        console.warn('⚠️ Sidebar elements missing, retrying in 500ms');
        setTimeout(setupContentDetailSidebar, 500);
        return;
    }

    // ✅ Use direct onclick for maximum reliability
    menuToggle.onclick = function(e) {
        e.stopPropagation();
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('📱 Sidebar opened');
    };

    sidebarClose.onclick = function() {
        sidebarMenu.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
        console.log('📱 Sidebar closed');
    };

    sidebarOverlay.onclick = function() {
        sidebarMenu.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    // Escape key
    document.onkeydown = function(e) {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            sidebarClose.onclick();
        }
    };

    updateSidebarProfile();
    setupSidebarNavigation();
    setupSidebarThemeToggle();
    setupSidebarScaleControls();

    console.log('✅ Sidebar click handlers attached with onclick');
}

// ============================================
// UPDATE SIDEBAR PROFILE
// ============================================
function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');

    if (!avatar || !name || !email) {
        console.warn('⚠️ Sidebar profile elements not found');
        return;
    }

    if (window.currentUser) {
        window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .maybeSingle()
            .then(({ data: profile }) => {
                if (profile) {
                    name.textContent = profile.full_name || profile.username || 'User';
                    email.textContent = window.currentUser.email;

                    if (profile.avatar_url) {
                        const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
                        avatar.innerHTML = `<img src="${fixedUrl}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    } else {
                        const initials = getInitials(profile.full_name || profile.username);
                        avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
                    }
                } else {
                    const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : '?';
                    avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initials}</span>`;
                    name.textContent = window.currentUser.email?.split('@')[0] || 'User';
                    email.textContent = window.currentUser.email || 'Signed in';
                }
            });

        if (profileSection) {
            profileSection.addEventListener('click', () => {
                document.getElementById('sidebar-close')?.click();
                window.location.href = 'manage-profiles.html';
            });
        }
    } else {
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;"></i>';

        if (profileSection) {
            profileSection.addEventListener('click', () => {
                document.getElementById('sidebar-close')?.click();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            });
        }
    }
}

// ============================================
// SETUP SIDEBAR NAVIGATION
// ============================================
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
            loadPersonalAnalytics();
        }
    });

    // Notifications
    document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar-close')?.click();

        const notificationsPanel = document.getElementById('notifications-panel');
        if (notificationsPanel) {
            notificationsPanel.classList.add('active');
            renderNotifications();
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

        const badgesModal = document.getElementById('badges-modal');
        if (badgesModal) {
            badgesModal.classList.add('active');
            loadUserBadges();
        }
    });

    // Watch Party
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

    console.log('✅ Sidebar navigation initialized');
}

// ============================================
// SETUP SIDEBAR THEME TOGGLE
// ============================================
function setupSidebarThemeToggle() {
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    if (!themeToggle) {
        console.warn('⚠️ Sidebar theme toggle not found');
        return;
    }

    themeToggle.addEventListener('click', () => {
        document.getElementById('sidebar-close')?.click();

        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.classList.toggle('active');
        }
    });

    console.log('✅ Sidebar theme toggle initialized');
}

// ============================================
// SETUP SIDEBAR SCALE CONTROLS - FIXED VERSION
// ============================================
function setupSidebarScaleControls() {
    if (!window.uiScaleController) {
        console.warn('⚠️ UI Scale Controller not initialized');
        return;
    }

    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');

    const updateDisplay = () => {
        if (scaleValue && window.uiScaleController.getScale) {
            scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
        }
    };

    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            if (window.uiScaleController.decrease) {
                window.uiScaleController.decrease();
                updateDisplay();
            }
        });
    }

    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            if (window.uiScaleController.increase) {
                window.uiScaleController.increase();
                updateDisplay();
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (window.uiScaleController.reset) {
                window.uiScaleController.reset();
                updateDisplay();
            }
        });
    }

    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);

    console.log('✅ Sidebar scale controls initialized');
}

// ============================================
// SETUP BOTTOM NAVIGATION BUTTONS
// ============================================
function setupContentDetailNavigation() {
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
                window.location.href = `login.html?redirect=creator-upload.html`;
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

    console.log('✅ Bottom navigation initialized');
}

// ============================================
// SETUP THEME SELECTOR
// ============================================
function setupContentDetailThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    if (!themeSelector) {
        console.warn('⚠️ Theme selector not found');
        return;
    }

    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeSelector.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!themeSelector.contains(e.target) && !e.target.closest('#sidebar-theme-toggle')) {
            themeSelector.classList.remove('active');
        }
    });

    console.log('✅ Theme selector initialized');
}

// ============================================
// APPLY THEME
// ============================================
function applyTheme(theme) {
    const root = document.documentElement;

    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');

    switch(theme) {
        case 'light':
            root.classList.add('theme-light');
            root.style.setProperty('--deep-black', '#ffffff');
            root.style.setProperty('--soft-white', '#1a1a1a');
            root.style.setProperty('--slate-grey', '#666666');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
            root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
            break;

        case 'high-contrast':
            root.classList.add('theme-high-contrast');
            root.style.setProperty('--deep-black', '#000000');
            root.style.setProperty('--soft-white', '#ffffff');
            root.style.setProperty('--slate-grey', '#ffff00');
            root.style.setProperty('--warm-gold', '#ff0000');
            root.style.setProperty('--bantu-blue', '#00ff00');
            root.style.setProperty('--card-bg', '#000000');
            root.style.setProperty('--card-border', '#ffffff');
            break;

        default:
            root.classList.add('theme-dark');
            root.style.setProperty('--deep-black', '#0A0A0A');
            root.style.setProperty('--soft-white', '#F5F5F5');
            root.style.setProperty('--slate-grey', '#A0A0A0');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
            root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
            break;
    }

    localStorage.setItem('bantu_theme', theme);
    showToast(`Theme changed to ${theme}`, 'success');

    console.log('✅ Theme applied:', theme);
}

// ============================================
// SETUP HEADER PROFILE
// ============================================
function setupContentDetailHeaderProfile() {
    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (!profileBtn || !dropdown) {
        console.warn('⚠️ Profile dropdown elements not found');
        return;
    }

    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    updateHeaderProfile();
    console.log('✅ Header profile initialized');
}

// ============================================
// UPDATE HEADER PROFILE
// ============================================
async function updateHeaderProfile() {
    try {
        const profilePlaceholder = document.getElementById('userProfilePlaceholder');
        const currentProfileName = document.getElementById('current-profile-name');

        if (!profilePlaceholder || !currentProfileName) {
            console.warn('⚠️ Header profile elements not found');
            return;
        }

        if (window.currentUser) {
            const { data: profile } = await window.supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', window.currentUser.id)
                .maybeSingle();

            if (profile) {
                profilePlaceholder.innerHTML = '';

                if (profile.avatar_url) {
                    const img = document.createElement('img');
                    img.className = 'profile-img';
                    const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(profile.avatar_url) || profile.avatar_url;
                    img.src = fixedUrl;
                    img.alt = profile.full_name || 'Profile';
                    img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                    profilePlaceholder.appendChild(img);
                } else {
                    const initials = getInitials(profile.full_name || profile.username || 'User');
                    const div = document.createElement('div');
                    div.className = 'profile-placeholder';
                    div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                    div.textContent = initials;
                    profilePlaceholder.appendChild(div);
                }

                currentProfileName.textContent = profile.full_name || profile.username || 'Profile';
            } else {
                const initials = window.currentUser.email ? window.currentUser.email[0].toUpperCase() : 'U';
                profilePlaceholder.innerHTML = '';

                const div = document.createElement('div');
                div.className = 'profile-placeholder';
                div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                div.textContent = initials;
                profilePlaceholder.appendChild(div);

                currentProfileName.textContent = window.currentUser.email?.split('@')[0] || 'User';
            }
        } else {
            profilePlaceholder.innerHTML = '';

            const div = document.createElement('div');
            div.className = 'profile-placeholder';
            div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
            div.textContent = 'G';
            profilePlaceholder.appendChild(div);

            currentProfileName.textContent = 'Guest';
        }
    } catch (error) {
        console.error('Error updating header profile:', error);
    }
}

// ============================================
// SETUP BACK TO TOP
// ============================================
function setupContentDetailBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
        backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    });

    console.log('✅ Back to top initialized');
}

// ============================================
// SETUP SEARCH MODAL
// ============================================
function setupContentDetailSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');

    if (!searchBtn || !searchModal) {
        console.warn('⚠️ Search elements not found');
        return;
    }

    searchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 300);
    });

    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            const resultsGrid = document.getElementById('search-results-grid');
            if (resultsGrid) resultsGrid.innerHTML = '';
        });
    }

    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            const resultsGrid = document.getElementById('search-results-grid');
            if (resultsGrid) resultsGrid.innerHTML = '';
        }
    });

    console.log('✅ Search modal initialized');
}

// ============================================
// SETUP NOTIFICATIONS
// ============================================
function setupContentDetailNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');

    if (!notificationsBtn || !notificationsPanel) {
        console.warn('⚠️ Notifications elements not found');
        return;
    }

    notificationsBtn.addEventListener('click', () => {
        notificationsPanel.classList.add('active');
        renderNotifications();
    });

    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            notificationsPanel.classList.remove('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (notificationsPanel.classList.contains('active') &&
            !notificationsPanel.contains(e.target) &&
            !notificationsBtn.contains(e.target)) {
            notificationsPanel.classList.remove('active');
        }
    });

    console.log('✅ Notifications initialized');
}

// ============================================
// SETUP ANALYTICS MODAL
// ============================================
function setupContentDetailAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');

    if (!analyticsBtn || !analyticsModal) {
        console.warn('⚠️ Analytics elements not found');
        return;
    }

    analyticsBtn.addEventListener('click', async () => {
        const { data } = await window.supabaseClient.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to view analytics', 'warning');
            return;
        }

        analyticsModal.classList.add('active');
        await loadPersonalAnalytics();
    });

    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', () => {
            analyticsModal.classList.remove('active');
        });
    }

    analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) {
            analyticsModal.classList.remove('active');
        }
    });

    console.log('✅ Analytics modal initialized');
}

// ============================================
// LOAD NOTIFICATIONS
// ============================================
async function loadNotifications() {
    try {
        if (!window.currentUser) {
            updateNotificationBadge(0);
            return;
        }

        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.warn('Error loading notifications:', error);
            updateNotificationBadge(0);
            return;
        }

        window.notifications = data || [];
        const unreadCount = window.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);

        console.log('✅ Notifications loaded:', unreadCount, 'unread');
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
}

// ============================================
// UPDATE NOTIFICATION BADGE
// ============================================
function updateNotificationBadge(count) {
    const mainBadge = document.getElementById('notification-count');
    const sidebarBadge = document.getElementById('sidebar-notification-count');

    [mainBadge, sidebarBadge].forEach(badge => {
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    });
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================
function renderNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    if (!window.currentUser) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>Sign in to see notifications</p>
            </div>
        `;
        return;
    }

    if (!window.notifications || window.notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }

    notificationsList.innerHTML = window.notifications.map(notification => `
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
}

// ============================================
// GET NOTIFICATION ICON
// ============================================
function getNotificationIcon(type) {
    switch(type) {
        case 'like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'follow': return 'fas fa-user-plus';
        case 'tip': return 'fas fa-gift';
        case 'party': return 'fas fa-users';
        case 'badge': return 'fas fa-medal';
        default: return 'fas fa-bell';
    }
}

// ============================================
// FORMAT NOTIFICATION TIME
// ============================================
function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';

    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(timestamp).toLocaleDateString();
}

// ============================================
// LOAD PERSONAL ANALYTICS
// ============================================
async function loadPersonalAnalytics() {
    if (!window.currentUser) return;

    try {
        const { data: views } = await window.supabaseClient
            .from('content_views')
            .select('*')
            .eq('viewer_id', window.currentUser.id);

        const totalViews = views?.length || 0;
        const totalWatchTime = views?.reduce((acc, v) => acc + (v.view_duration || 0), 0) || 0;
        const hours = Math.floor(totalWatchTime / 3600);

        const watchTimeEl = document.getElementById('personal-watch-time');
        const viewsEl = document.getElementById('personal-views');
        const sessionsEl = document.getElementById('personal-sessions');
        const returnRateEl = document.getElementById('return-rate');

        if (watchTimeEl) watchTimeEl.textContent = hours + 'h';
        if (viewsEl) viewsEl.textContent = totalViews;
        if (sessionsEl) sessionsEl.textContent = Math.ceil(totalViews / 5) || 1;

        const uniqueDays = new Set(views?.map(v => new Date(v.created_at).toDateString())).size;
        const returnRate = uniqueDays > 0 ? Math.min(100, Math.floor((uniqueDays / 7) * 100)) : 0;

        if (returnRateEl) returnRateEl.textContent = returnRate + '%';

        console.log('✅ Personal analytics loaded');
    } catch (error) {
        console.error('Error loading personal analytics:', error);
    }
}

// ============================================
// LOAD USER BADGES
// ============================================
async function loadUserBadges() {
    if (!window.currentUser) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('user_badges')
            .select('*')
            .eq('user_id', window.currentUser.id);

        if (error) {
            console.warn('Error loading badges:', error);
            return;
        }

        window.userBadges = data || [];

        const allBadges = [
            { id: 'music', name: 'Music Explorer', icon: 'fa-music', description: 'Watched 5+ music videos' },
            { id: 'stem', name: 'STEM Seeker', icon: 'fa-microscope', description: 'Explored 5+ STEM videos' },
            { id: 'culture', name: 'Cultural Curator', icon: 'fa-drum', description: 'Explored 5+ Culture videos' },
            { id: 'polyglot', name: 'Language Explorer', icon: 'fa-language', description: 'Watched content in 3+ languages' }
        ];

        const badgesGrid = document.getElementById('badges-grid');
        const badgesEarned = document.getElementById('badges-earned');

        if (badgesGrid) {
            badgesGrid.innerHTML = allBadges.map(badge => {
                const earned = window.userBadges.some(b => b.badge_name === badge.name);

                return `
                    <div class="badge-item ${earned ? 'earned' : 'locked'}">
                        <div class="badge-icon ${earned ? 'earned' : ''}">
                            <i class="fas ${badge.icon}"></i>
                        </div>
                        <div class="badge-info">
                            <h4>${badge.name}</h4>
                            <p>${badge.description}</p>
                            ${earned ?
                                `<span class="badge-earned-date">Earned!</span>` :
                                `<span class="badge-requirement">Keep watching</span>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (badgesEarned) badgesEarned.textContent = window.userBadges.length;

        console.log('✅ User badges loaded');
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// ============================================
// LOAD WATCH PARTY CONTENT
// ============================================
async function loadWatchPartyContent() {
    try {
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('*, language, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const list = document.getElementById('watch-party-content-list');
        if (!list) return;

        list.innerHTML = (data || []).map(content => {
            const thumbnailUrl = content.thumbnail_url
                ? (window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url)
                : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';

            return `
                <div class="watch-party-content-item" data-content-id="${content.id}">
                    <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}">
                    <div class="watch-party-content-info">
                        <h4>${truncateText(escapeHtml(content.title), 40)}</h4>
                        <p>${content.media_type || 'video'}</p>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.watch-party-content-item').forEach(item => {
            item.addEventListener('click', () => {
                list.querySelectorAll('.watch-party-content-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });

        console.log('✅ Watch party content loaded');
    } catch (error) {
        console.error('Error loading watch party content:', error);
    }
}

// ============================================
// SHOW TOAST
// ============================================
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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

function formatDuration(seconds) {
    if (!seconds || seconds <= 0 || isNaN(seconds)) {
        return '0m 0s';
    }

    seconds = Math.floor(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return hours + 'h ' + minutes + 'm';
    } else if (minutes > 0) {
        return minutes + 'm ' + secs + 's';
    } else {
        return secs + 's';
    }
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
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

function getInitials(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

// ============================================
// PHASE 1: CONTINUE WATCHING
// ============================================
async function loadContinueWatching(userId, limit) {
    if (limit === undefined) limit = 8;

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

        console.log('✅ Continue watching loaded:', data.length, 'items');
    } catch (error) {
        console.error('❌ Failed to load continue watching:', error);
        section.style.display = 'none';
    }
}

function renderContinueWatching(items) {
    const container = document.getElementById('continueGrid');
    if (!container) return;

    container.innerHTML = items.map(function(item) {
        const content = item.Content;
        if (!content) return '';

        const progress = content.duration > 0
            ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
            : 0;

        const timeWatched = formatDuration(item.last_position);
        const totalTime = formatDuration(content.duration);

        const thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url)
            || content.thumbnail_url
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

    container.querySelectorAll('.continue-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (window.track?.continueWatchingClick) {
                const contentId = card.dataset.contentId;
                window.track.continueWatchingClick(contentId);
            }
        });
    });
}

function setupContinueWatchingRefresh() {
    const refreshBtn = document.getElementById('refreshContinueBtn');
    if (!refreshBtn) return;

    refreshBtn.addEventListener('click', async function() {
        if (!currentUserId) return;

        showToast('Refreshing...', 'info');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await loadContinueWatching(currentUserId);
            showToast('Updated!', 'success');
        } catch (error) {
            console.error('Refresh failed:', error);
            showToast('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
    });
}

// ============================================
// EXPORT KEY FUNCTIONS
// ============================================
window.hasViewedContentRecently = hasViewedContentRecently;
window.markContentAsViewed = markContentAsViewed;
window.recordContentView = recordContentView;
window.refreshCountsFromSource = refreshCountsFromSource;
window.clearViewCache = clearViewCache;
window.streamingManager = streamingManager;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;
window.closeVideoPlayer = closeVideoPlayer;
window.uiScaleController = window.uiScaleController;
window.toggleProfileDropdown = toggleProfileDropdown;
window.fixAvatarUrl = fixAvatarUrl;
window.showToast = showToast;

// ============================================
// PAGE UNLOAD HANDLER
// ============================================
window.addEventListener('beforeunload', function() {
    if (watchSession) {
        watchSession.stop();
    }
    if (window._watchSession) {
        window._watchSession.stop();
    }
    if (streamingManager) {
        streamingManager.destroy();
    }
});

console.log('✅ Content detail script FULLY LOADED with all features working!');
