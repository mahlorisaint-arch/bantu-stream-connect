// ============================================ */
// SHARED COMPONENTS JS - BANTU STREAM CONNECT */
// Platform-wide JavaScript with FULL AUTH INTEGRATION */
// Complete implementation for Search, Analytics, Notifications, Voice Search, Profile */
// ============================================ */

console.log('📦 Shared Components v3.5 - Optimized Analytics with content_engagement_stats...');

// ============================================ */
// GLOBAL VARIABLES */
// ============================================ */
window.platformComponents = window.platformComponents || {
    initialized: false,
    currentUser: null,
    currentProfile: null,
    uiScaleController: null,
    supabaseClient: null,
    notifications: [],
    searchDebounceTimer: null,
    voiceRecognition: null,
    analyticsChart: null,
    searchHistory: JSON.parse(localStorage.getItem('bantu_search_history')) || [],
    activeFilters: { category: '', type: '', sort: 'newest' }
};

// ============================================ */
// FIX: ENSURE SUPABASE CLIENT IS AVAILABLE */
// ============================================ */
// If supabaseClient is not set but supabaseAuth is, use supabaseAuth
if (!window.supabaseClient && window.supabaseAuth) {
    window.supabaseClient = window.supabaseAuth;
    console.log('🔧 [SEARCH-FIX] Using supabaseAuth as supabaseClient for search');
}

// If neither is set, try to get from the global supabase
if (!window.supabaseClient && window.supabase) {
    window.supabaseClient = window.supabase;
    console.log('🔧 [SEARCH-FIX] Using window.supabase as supabaseClient for search');
}

// If still not set, create a fallback that will show a user-friendly message
if (!window.supabaseClient) {
    console.warn('⚠️ [SEARCH-FIX] No Supabase client found. Search will not work.');
    // Create a fallback client that shows an error message
    window.supabaseClient = {
        from: () => {
            console.error('❌ [SEARCH] Supabase client not initialized. Please refresh the page.');
            return {
                select: () => ({
                    eq: () => ({
                        order: () => ({
                            limit: () => Promise.resolve({ data: [], error: new Error('Supabase client not initialized') })
                        })
                    })
                })
            };
        }
    };
}

// ============================================ */
// THEME MANAGER - FIXED (AFFECTS ENTIRE PAGE)
// ============================================ */

const GlobalThemeManager = {
    themes: ['dark', 'light', 'high-contrast'],
    currentTheme: 'dark',
    
    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('bantu_theme');
        if (savedTheme && this.themes.includes(savedTheme)) {
            this.currentTheme = savedTheme;
        }
        
        // Apply theme to entire page
        this.applyThemeToDocument(this.currentTheme);
        
        // Setup theme selector
        this.setupThemeSelector();
        
        console.log('🎨 Global Theme Manager initialized with theme:', this.currentTheme);
    },
    
    applyThemeToDocument(theme) {
        if (!theme || !this.themes.includes(theme)) {
            theme = 'dark';
        }
        
        const htmlElement = document.documentElement;
        
        // Remove all theme classes
        this.themes.forEach(t => {
            htmlElement.classList.remove(`theme-${t}`);
        });
        
        // Add new theme class
        htmlElement.classList.add(`theme-${theme}`);
        
        // Set data attribute for CSS
        htmlElement.setAttribute('data-theme', theme);
        
        // Update meta theme color
        this.updateMetaThemeColor(theme);
        
        // Save to localStorage
        localStorage.setItem('bantu_theme', theme);
        
        this.currentTheme = theme;
        
        // Update active buttons
        this.updateThemeButtons(theme);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
        
        console.log('🎨 Theme applied to entire page:', theme);
    },
    
    updateMetaThemeColor(theme) {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        
        const colors = {
            'dark': '#0A0E12',
            'light': '#F8FAFC',
            'high-contrast': '#000000'
        };
        
        meta.setAttribute('content', colors[theme] || '#0A0E12');
    },
    
    updateThemeButtons(theme) {
        document.querySelectorAll('.theme-option').forEach(option => {
            if (option.dataset.theme === theme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    },
    
    setupThemeSelector() {
        const themeSelector = document.getElementById('theme-selector');
        const themeToggle = document.getElementById('sidebar-theme-toggle');
        
        if (!themeSelector) return;
        
        // Setup theme options
        document.querySelectorAll('.theme-option').forEach(option => {
            const newOption = option.cloneNode(true);
            option.parentNode?.replaceChild(newOption, option);
            
            newOption.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const theme = newOption.dataset.theme;
                if (theme) {
                    this.applyThemeToDocument(theme);
                    themeSelector.classList.remove('active');
                    if (window.showToast) {
                        window.showToast(`Theme changed to ${theme}`, 'success');
                    }
                }
            });
        });
        
        // Setup sidebar theme toggle
        if (themeToggle) {
            const newToggle = themeToggle.cloneNode(true);
            themeToggle.parentNode?.replaceChild(newToggle, themeToggle);
            
            newToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                themeSelector.classList.toggle('active');
            });
        }
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (themeSelector.classList.contains('active') &&
                !themeSelector.contains(e.target) &&
                !themeToggle?.contains(e.target)) {
                themeSelector.classList.remove('active');
            }
        });
        
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && themeSelector.classList.contains('active')) {
                themeSelector.classList.remove('active');
            }
        });
    },
    
    getTheme() {
        return this.currentTheme;
    }
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
// UPDATE HEADER PROFILE - Shows logged-in user (FIXED: NO REDIRECT) */
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
        
        // FIX: Do NOT set onclick redirect here - handled by profile dropdown
        // The profile button click should toggle the dropdown, not redirect.
        
    } else {
        // Guest user
        if (profileNameSpan) {
            profileNameSpan.textContent = 'Guest';
        }
        profilePlaceholder.innerHTML = '<i class="fas fa-user"></i>';
        // Also no redirect - dropdown will handle sign-in
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
        
        // Make profile clickable to profile page (sidebar only)
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
// 1. PREMIUM SEARCH ENGINE - THREE-STATE SYSTEM */
// Complete replacement of old search modal with new premium system */
// ============================================ */

function setupSearchModal() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('search-input');
    const closeBtn = document.getElementById('close-search-btn');
    const searchTriggerBtn = document.getElementById('search-btn');
    const cancelVoiceBtn = document.getElementById('voice-search-cancel');

    if (!modal || !input) return;

    // Global Activation Shortcut (Cmd + K or Ctrl + K)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearchModal(modal, input);
        }
    });

    // Button Triggers
    if (searchTriggerBtn) {
        searchTriggerBtn.addEventListener('click', () => openSearchModal(modal, input));
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeSearchModal(modal));
    }

    // Modal Background Overlay Escape click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSearchModal(modal);
    });

    // Escape Key Safeguard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeSearchModal(modal);
        }
    });

    // Intelligent Input Event Router
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(window.platformComponents.searchDebounceTimer);
        
        if (query.length === 0) {
            renderSearchZeroState();
            return;
        }

        // Fast interactive debounce for high premium app performance
        window.platformComponents.searchDebounceTimer = setTimeout(() => {
            performAdvancedSearch(query);
        }, 350);
    });

    // Auto-routing if user focuses an empty search bar
    input.addEventListener('focus', () => {
        if (input.value.trim().length === 0) {
            renderSearchZeroState();
        }
    });

    // Set up voice capabilities and pill components
    setupFilterPills(input);
    setupVoiceSearch(input);
}

function openSearchModal(modal, input) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
    setTimeout(() => input.focus(), 50); // Fluid focus transition
    if (input.value.trim().length === 0) {
        renderSearchZeroState();
    }
}

function closeSearchModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Release scroll block
}

// ============================================ */
// 2. COMPONENT STRATEGY: MOOD/FILTER PILLS */
// ============================================ */
function setupFilterPills(inputElement) {
    const pills = document.querySelectorAll('.search-filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            const group = pill.dataset.filterGroup; // 'category', 'type', 'sort'
            const value = pill.dataset.filterValue;

            // Deactivate siblings in same functional group
            document.querySelectorAll(`.search-filter-pill[data-filter-group="${group}"]`)
                .forEach(sibling => sibling.classList.remove('active'));

            pill.classList.add('active');
            window.platformComponents.activeFilters[group] = value;

            // Re-execute lookup dynamically if query exists
            const currentQuery = inputElement.value.trim();
            if (currentQuery.length >= 2) {
                performAdvancedSearch(currentQuery);
            }
        });
    });
}

// ============================================ */
// 3. STATE CONTROLLER: ZERO-STATE ENGINE (History & Recommendations) */
// ============================================ */
function renderSearchZeroState() {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;

    const history = window.platformComponents.searchHistory;

    resultsGrid.innerHTML = `
        <div class="search-zero-state-container">
            <div class="search-history-section">
                <div class="section-header-row">
                    <h4>Recent Locks ⏱️</h4>
                    ${history.length > 0 ? `<button class="clear-history-btn" onclick="clearSearchHistory()">Clear All</button>` : ''}
                </div>
                <div class="history-pills-container">
                    ${history.length === 0 ? 
                        `<p class="neutral-placeholder-text">Your recent lookup history is clear.</p>` : 
                        history.map(term => `
                            <span class="history-pill" onclick="triggerFastSearch('${escapeHtml(term)}')">
                                <i class="fas fa-history"></i> <span class="term-text">${escapeHtml(term)}</span>
                            </span>
                        `).join('')
                    }
                </div>
            </div>
            <div class="search-trending-section">
                <h4>Trending Across The Stream 🌊</h4>
                <div id="trending-search-placeholder" class="trending-mini-grid">
                    <div class="loading-spinner-small"></div>
                </div>
            </div>
        </div>
    `;

    loadTrendingSearchItems();
}

async function loadTrendingSearchItems() {
    const placeholder = document.getElementById('trending-search-placeholder');
    if (!placeholder) return;

    // Check if supabaseClient is available
    if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        placeholder.innerHTML = '<p class="neutral-placeholder-text">Search is loading... Please refresh the page.</p>';
        console.warn('⚠️ [SEARCH] Supabase client not available for trending items');
        return;
    }

    try {
        // Query top premium recommendations ordered by view traction
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select(`
                id, 
                title, 
                thumbnail_url, 
                genre,
                content_engagement_stats!inner(total_views)
            `)
            .eq('status', 'published')
            .order('total_views', { referencedTable: 'content_engagement_stats', ascending: false })
            .limit(3);

        if (error || !data || data.length === 0) {
            placeholder.innerHTML = '<p class="neutral-placeholder-text">Checking live stream waves...</p>';
            return;
        }

        // Normalize data - flatten the nested stats object
        const normalizedData = data.map(item => ({
            ...item,
            total_views: item.content_engagement_stats?.total_views || 0
        }));

        placeholder.innerHTML = normalizedData.map(item => `
            <div class="trending-mini-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
                <img src="${parseThumbnailUrl(item.thumbnail_url)}" alt="" onerror="this.src='images/card-fallback.jpg'">
                <div class="mini-card-details">
                    <h5>${escapeHtml(item.title)}</h5>
                    <span>${formatNumber(item.total_views)} views · ${escapeHtml(item.genre || 'Vibe')}</span>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('⚠️ Failed to load search recommendations:', err.message);
        placeholder.innerHTML = '<p class="neutral-placeholder-text">Failed to fetch modern recommendations.</p>';
    }
}

// ============================================ */
// 4. SYSTEM PROCESSING: CORE FULL-TEXT MULTI-TRACK QUERY */
// ============================================ */
async function performAdvancedSearch(query) {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;

    // Check if supabaseClient is available
    if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
        resultsGrid.innerHTML = `
            <div class="search-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Search is not available. Please refresh the page.</p>
                <button onclick="location.reload()">Refresh Page</button>
            </div>
        `;
        return;
    }

    if (query.length < 2) {
        resultsGrid.innerHTML = `<div class="search-status-message"><p>Keep typing... find your path.</p></div>`;
        return;
    }

    resultsGrid.innerHTML = `
        <div class="search-loading-container">
            <div class="loading-spinner-small"></div>
            <p>Decoding Bantu Stream channels...</p>
        </div>
    `;

    const filters = window.platformComponents.activeFilters;

    try {
        // --- DATA TRACK 1: FETCH MATCHING CREATORS ---
        let creatorQuery = window.supabaseClient
            .from('user_profiles')
            .select('id, full_name, username, avatar_url, role')
            .eq('role', 'creator')
            .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
            .limit(4);

        // --- DATA TRACK 2: FETCH CONTENT DROPS (WITH TRANSFORMS) ---
        // FIXED: Join with content_engagement_stats for total_views
        let contentQuery = window.supabaseClient
            .from('Content')
            .select(`
                id, 
                title, 
                description, 
                thumbnail_url, 
                duration, 
                genre, 
                created_at, 
                content_type, 
                user_id,
                user_profiles!inner(full_name, username, avatar_url),
                content_engagement_stats(total_views)
            `)
            .eq('status', 'published')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,genre.ilike.%${query}%`);

        // Apply functional UI Pill Filters
        if (filters.category) contentQuery = contentQuery.eq('genre', filters.category);
        if (filters.type) contentQuery = contentQuery.eq('content_type', filters.type);
        
        // FIXED: Order by the joined table column
        if (filters.sort === 'popular') {
            contentQuery = contentQuery.order('total_views', { referencedTable: 'content_engagement_stats', ascending: false });
        } else {
            contentQuery = contentQuery.order('created_at', { ascending: false });
        }
        
        contentQuery = contentQuery.limit(24);

        // Execute queries parallelized for ultra-low platform overhead latency
        const [creatorsRes, contentRes] = await Promise.all([creatorQuery, contentQuery]);

        if (contentRes.error) {
            console.error('shared-components.js: Search failure response context:', contentRes.error);
            throw contentRes.error;
        }

        // Flatten the stats object structural payload for the Virtual Scroll array layer
        const localizedResults = (contentRes.data || []).map(row => ({
            ...row,
            total_views: row.content_engagement_stats?.total_views || 0
        }));

        saveSearchHistoryTerm(query);
        renderSplitSearchResults(creatorsRes.data || [], localizedResults, query);

    } catch (error) {
        console.error("Search failure response context: ", error);
        resultsGrid.innerHTML = `
            <div class="search-error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>An execution error interrupted the discovery system link.</p>
                <button onclick="performAdvancedSearch('${escapeHtml(query)}')">Retry Connection</button>
            </div>
        `;
    }
}

// ============================================ */
// 5. HIGH-FIDELITY RENDER MATRIX: SPLIT INTERACTIVE SECTIONS */
// ============================================ */
function renderSplitSearchResults(creators, drops, query) {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;

    if (creators.length === 0 && drops.length === 0) {
        resultsGrid.innerHTML = `
            <div class="search-empty-state">
                <p>No waves matching "<strong>${escapeHtml(query)}</strong>" discovered.</p>
                <span>Check your spelling or shift your mood filters to expand the pipeline parameters.</span>
            </div>
        `;
        return;
    }

    // Split items into sub-vibe categories instantly
    const longFormDrops = drops.filter(d => d.duration >= 600 || d.content_type === 'video');
    const shortAudioDrops = drops.filter(d => d.duration < 600 || d.content_type === 'audio');

    resultsGrid.innerHTML = `
        <div class="split-search-matrix-wrapper">
            
            ${creators.length > 0 ? `
                <div class="split-section creators-split-track">
                    <h4>Matching Channels 🎙️</h4>
                    <div class="creators-flex-row">
                        ${creators.map(creator => `
                            <div class="creator-mini-profile-card" onclick="window.location.href='creator-channel.html?id=${creator.id}&name=${encodeURIComponent(creator.full_name || creator.username || 'Creator')}'">
                                <img src="${creator.avatar_url || 'images/default-avatar.png'}" alt="">
                                <div class="creator-meta">
                                    <h6>${escapeHtml(creator.full_name)}</h6>
                                    <span>@${escapeHtml(creator.username)}</span>
                                </div>
                                <button class="lock-in-fast-btn"><i class="fas fa-link"></i> Look</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${longFormDrops.length > 0 ? `
                <div class="split-section drops-split-track">
                    <h4>Long-Form Drops & Features 🎞️</h4>
                    <div class="premium-search-grid-layout">
                        ${longFormDrops.map(drop => generatePremiumCardHtml(drop)).join('')}
                    </div>
                </div>
            ` : ''}

            ${shortAudioDrops.length > 0 ? `
                <div class="split-section audio-split-track">
                    <h4>Short Waves & Audio Drops 🎵</h4>
                    <div class="premium-search-grid-layout">
                        ${shortAudioDrops.map(drop => generatePremiumCardHtml(drop)).join('')}
                    </div>
                </div>
            ` : ''}

        </div>
    `;
}

function generatePremiumCardHtml(drop) {
    const durationStr = drop.duration ? formatDuration(drop.duration) : '';
    const creatorName = drop.user_profiles ? drop.user_profiles.full_name : 'Independent Creator';
    const viewCount = drop.total_views || 0;
    
    return `
        <div class="premium-search-card" onclick="window.location.href='content-detail.html?id=${drop.id}'">
            <div class="thumbnail-wrapper-frame">
                <img src="${parseThumbnailUrl(drop.thumbnail_url)}" alt="" onerror="this.src='images/card-fallback.jpg'">
                ${durationStr ? `<span class="premium-duration-badge">${durationStr}</span>` : ''}
            </div>
            <div class="premium-card-payload">
                <h5>${escapeHtml(drop.title)}</h5>
                <p class="premium-card-author-row">By <span>${escapeHtml(creatorName)}</span></p>
                <div class="premium-card-footer-metrics">
                    <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)} views</span>
                    <span class="genre-tag-node">${escapeHtml(drop.genre || 'Stream')}</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================ */
// 6. UTILITY METHODS & STORAGE HOOKS */
// ============================================ */
function parseThumbnailUrl(url) {
    if (!url) return 'images/card-fallback.jpg';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const storagePrefix = 'https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/';
    return storagePrefix + (url.startsWith('/') ? url.substring(1) : url);
}

function saveSearchHistoryTerm(term) {
    let history = window.platformComponents.searchHistory;
    if (!history.includes(term)) {
        history.unshift(term);
        if (history.length > 6) history.pop();
        window.platformComponents.searchHistory = history;
        localStorage.setItem('bantu_search_history', JSON.stringify(history));
    }
}

function triggerFastSearch(term) {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.value = term;
    performAdvancedSearch(term);
}

function clearSearchHistory() {
    window.platformComponents.searchHistory = [];
    localStorage.removeItem('bantu_search_history');
    renderSearchZeroState();
}

// Legacy search function kept for backward compatibility
async function performSearch(query, category = '', sortBy = 'newest') {
    // This is now handled by the new performAdvancedSearch
    // Keeping for backward compatibility
    if (query && query.length >= 2) {
        await performAdvancedSearch(query);
    }
}

// ============================================ */
// 7. EXPERIMENTAL ADAPTIVE VOICE CONTROLLER */
// ============================================ */
function setupVoiceSearch(inputElement) {
    const voiceTrigger = document.getElementById('voice-search-btn');
    const voiceStatus = document.getElementById('voice-search-status');
    const voiceText = document.getElementById('voice-status-text');
    const cancelVoiceBtn = document.getElementById('voice-search-cancel');

    if (!voiceTrigger || !voiceStatus) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceTrigger.style.display = 'none'; // Fallback safely if browser engine doesn't implement web speech APIs
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-ZA'; // Configured localized South African dialect capture context
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceTrigger.addEventListener('click', () => {
        try {
            recognition.start();
        } catch (e) {
            recognition.stop();
        }
    });

    recognition.onstart = () => {
        voiceStatus.classList.add('active');
        if (voiceText) voiceText.innerText = 'Listening to speech signatures...';
    };

    recognition.onerror = () => {
        if (voiceText) voiceText.innerText = 'Link failure. Try again.';
        setTimeout(() => voiceStatus.classList.remove('active'), 1500);
    };

    recognition.onend = () => {
        voiceStatus.classList.remove('active');
    };

    recognition.onresult = (event) => {
        const speechToTextResult = event.results[0][0].transcript;
        if (inputElement) {
            inputElement.value = speechToTextResult;
            performAdvancedSearch(speechToTextResult);
        }
    };

    if (cancelVoiceBtn) {
        cancelVoiceBtn.addEventListener('click', () => {
            recognition.stop();
            voiceStatus.classList.remove('active');
        });
    }
}

// ============================================ */
// 8. COMPLETE ANALYTICS FUNCTIONALITY (OPTIMIZED WITH content_engagement_stats) */
// ============================================ */

function setupAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const modal = document.getElementById('analytics-modal');
    const closeBtn = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !modal) return;
    
    analyticsBtn.onclick = async () => {
        const user = await getCurrentUser();
        if (!user || !user.id) {
            showToast('Please sign in to view analytics', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        modal.classList.add('active');
        await loadCompleteAnalyticsData();
    };
    
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }
    
    setupChartControls();
}

// ============================================ */
// LOAD COMPLETE ANALYTICS DATA (OPTIMIZED) */
// ============================================ */
async function loadCompleteAnalyticsData() {
    const user = await getCurrentUser();
    if (!user || !user.id) return;
    
    try {
        // Query only structural fields and inner-join the metrics table
        const { data: contentList, error: contentError } = await window.supabaseClient
            .from('Content')
            .select(`
                id, 
                title, 
                created_at,
                content_engagement_stats!inner(
                    total_views,
                    total_valid_views,
                    total_likes,
                    total_comments,
                    total_watch_time_ms,
                    total_shares
                )
            `)
            .eq('user_id', user.id);
        
        if (contentError) throw contentError;
        
        if (!contentList || contentList.length === 0) {
            showNoAnalyticsData();
            return;
        }
        
        const contentIds = contentList.map(c => c.id);
        
        // --------------------------------------------
        // HIGH-PERFORMANCE PRE-AGGREGATED METRICS CORRECTION
        // --------------------------------------------
        // Instead of processing raw array lengths locally, sum the metrics across columns
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalWatchTimeMs = 0;
        let totalShares = 0;

        contentList.forEach(item => {
            const stats = item.content_engagement_stats;
            if (stats) {
                totalViews += Number(stats.total_views || 0);
                totalLikes += Number(stats.total_likes || 0);
                totalComments += Number(stats.total_comments || 0);
                totalWatchTimeMs += Number(stats.total_watch_time_ms || 0);
                totalShares += Number(stats.total_shares || 0);
            }
        });

        // Convert milliseconds out to standard duration seconds for formatDuration utility
        const totalWatchTimeSec = Math.floor(totalWatchTimeMs / 1000);
        const avgWatchTimeSec = totalViews > 0 ? Math.floor(totalWatchTimeSec / totalViews) : 0;
        const engagementRate = totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1) : "0.0";
        
        // --------------------------------------------
        // UPDATE THE 4 CORE METRIC CORES WITH GRAPH STATS
        // --------------------------------------------
        const totalViewsEl = document.getElementById('total-views');
        const avgWatchTimeEl = document.getElementById('avg-watch-time');
        const engagementRateEl = document.getElementById('engagement-rate');
        const totalCommentsEl = document.getElementById('total-comments');
        
        if (totalViewsEl) totalViewsEl.textContent = formatNumber(totalViews);
        if (avgWatchTimeEl) avgWatchTimeEl.textContent = formatDuration(avgWatchTimeSec);
        if (engagementRateEl) engagementRateEl.textContent = engagementRate + '%';
        if (totalCommentsEl) totalCommentsEl.textContent = formatNumber(totalComments);
        
        // Secondary Metrics Mapping updates
        const totalLikesEl = document.getElementById('total-likes');
        if (totalLikesEl) totalLikesEl.textContent = formatNumber(totalLikes);
        
        const totalContentEl = document.getElementById('total-content');
        if (totalContentEl) totalContentEl.textContent = contentList.length.toString();
        
        // --------------------------------------------
        // HISTORICAL TIME-SERIES CHART QUERIES
        // --------------------------------------------
        // We look up historical data ONLY for the graph trends over time
        const { data: viewsData, error: viewsError } = await window.supabaseClient
            .from('content_views')
            .select('created_at')
            .in('content_id', contentIds);

        if (viewsError) throw viewsError;
        
        const dailyViews = getDailyViewsData(viewsData || []);
        renderAnalyticsChart(dailyViews);
        updateTrendIndicators();
        
    } catch (error) {
        console.error('❌ Error rendering aggregated analytics panels:', error);
        showToast('Error loading analytics data', 'error');
    }
}

// ============================================ */
// GET DAILY VIEWS DATA FOR CHART */
// ============================================ */
function getDailyViewsData(views) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayViews = views?.filter(v => {
            const viewDate = new Date(v.created_at);
            return viewDate.toDateString() === date.toDateString();
        }).length || 0;
        
        last7Days.push({ date: dateStr, views: dayViews });
    }
    return last7Days;
}

// ============================================ */
// UPDATE ANALYTICS UI */
// ============================================ */
function updateAnalyticsUI(totalViews, totalWatchTime, avgWatchTime, uniqueViewers, contentCount) {
    const elements = {
        'total-views': formatNumber(totalViews),
        'total-watch-time': formatDuration(totalWatchTime),
        'avg-watch-time': formatDuration(avgWatchTime),
        'unique-viewers': formatNumber(uniqueViewers),
        'total-content': contentCount.toString()
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    updateTrendIndicators();
}

// ============================================ */
// LOAD ENGAGEMENT METRICS (DEPRECATED SAFETY FALLBACK) */
// ============================================ */
async function loadEngagementMetrics(contentIds) {
    // This is now performed atomically in loadCompleteAnalyticsData inside the primary join query loop.
    // Preserved as an early exit method block to prevent legacy structural breakages elsewhere.
    console.log('✨ Engagement metrics derived natively via stats infrastructure pipeline.');
}

// ============================================ */
// UPDATE TREND INDICATORS */
// ============================================ */
function updateTrendIndicators() {
    const trends = {
        'views-trend': { value: '+12%', class: 'up' },
        'watch-time-trend': { value: '+8%', class: 'up' },
        'engagement-trend': { value: '+5%', class: 'up' }
    };
    
    for (const [id, trend] of Object.entries(trends)) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<i class="fas fa-arrow-${trend.class === 'up' ? 'up' : 'down'}"></i> ${trend.value}`;
            el.className = `analytics-trend ${trend.class}`;
        }
    }
}

// ============================================ */
// SETUP CHART CONTROLS */
// ============================================ */
function setupChartControls() {
    const chartButtons = document.querySelectorAll('.chart-btn');
    
    chartButtons.forEach(btn => {
        btn.onclick = async () => {
            chartButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const currentPeriod = btn.dataset.period;
            await refreshAnalyticsChart(currentPeriod);
        };
    });
}

// ============================================ */
// REFRESH ANALYTICS CHART */
// ============================================ */
async function refreshAnalyticsChart(period) {
    const user = await getCurrentUser();
    if (!user || !user.id) return;
    
    try {
        // Fetch matching creator records
        const { data: contentList } = await window.supabaseClient
            .from('Content')
            .select('id')
            .eq('user_id', user.id);

        if (!contentList || contentList.length === 0) return;
        const contentIds = contentList.map(c => c.id);

        // Fetch chronological view events for requested timeline tracking
        const { data: views, error } = await window.supabaseClient
            .from('content_views')
            .select('created_at')
            .in('content_id', contentIds);

        if (error) throw error;
        
        let filteredViews = views || [];
        const now = new Date();

        if (period === '7d') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            filteredViews = views?.filter(v => new Date(v.created_at) >= sevenDaysAgo) || [];
        } else if (period === '30d') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            filteredViews = views?.filter(v => new Date(v.created_at) >= thirtyDaysAgo) || [];
        }
        
        const chartData = getDailyViewsData(filteredViews);
        updateAnalyticsChart(chartData);
    } catch (err) {
        console.error('❌ Failed filtering time-series charts:', err.message);
    }
}

// ============================================ */
// RENDER ANALYTICS CHART */
// ============================================ */
function renderAnalyticsChart(data) {
    const canvas = document.getElementById('analytics-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (window.platformComponents.analyticsChart) {
        window.platformComponents.analyticsChart.destroy();
    }
    
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }
    
    window.platformComponents.analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Views',
                data: data.map(d => d.views),
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#F59E0B',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#F8FAFC' }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#94A3B8'
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94A3B8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94A3B8' }
                }
            }
        }
    });
}

// ============================================ */
// UPDATE ANALYTICS CHART */
// ============================================ */
function updateAnalyticsChart(data) {
    if (window.platformComponents.analyticsChart) {
        window.platformComponents.analyticsChart.data.labels = data.map(d => d.date);
        window.platformComponents.analyticsChart.data.datasets[0].data = data.map(d => d.views);
        window.platformComponents.analyticsChart.update();
    }
}

// ============================================ */
// SHOW NO ANALYTICS DATA STATE */
// ============================================ */
function showNoAnalyticsData() {
    const statsGrid = document.querySelector('.analytics-stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = '<div class="empty-state" style="grid-column: span 4;"><i class="fas fa-chart-line"></i><p>No analytics data yet. Start creating content to see your stats!</p></div>';
    }
}

// ============================================ */
// EXPOSE ANALYTICS FUNCTIONS GLOBALLY */
// ============================================ */
window.loadCompleteAnalyticsData = loadCompleteAnalyticsData;
window.renderAnalyticsChart = renderAnalyticsChart;
window.updateAnalyticsChart = updateAnalyticsChart;
window.refreshAnalyticsChart = refreshAnalyticsChart;
window.setupChartControls = setupChartControls;
window.showNoAnalyticsData = showNoAnalyticsData;

// ============================================ */
// 9. COMPLETE NOTIFICATIONS FUNCTIONALITY - PREMIUM GLASSMORPHIC ENGINE */
// ============================================ */

// Global state tracking for notification tab routing
let currentNotificationTab = 'all';

// ============================================ */
// 9A. SETUP NOTIFICATIONS - MAIN INITIALIZATION */
// ============================================ */
function setupNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const panel = document.getElementById('notifications-panel');
    const closeBtn = document.getElementById('close-notifications');
    const markAllReadBtn = document.getElementById('mark-all-read');
    const settingsBtn = document.getElementById('notification-settings');
    
    if (!notificationsBtn || !panel) return;
    
    // Open notifications panel
    notificationsBtn.onclick = (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            loadCompleteNotifications();
        }
    };
    
    // Close notifications panel on close click
    if (closeBtn) {
        closeBtn.onclick = () => panel.classList.remove('active');
    }

    // Close panel when clicking outside to maintain premium modal feel
    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== notificationsBtn) {
            panel.classList.remove('active');
        }
    });
    
    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.onclick = (e) => {
            e.stopPropagation();
            markAllNotificationsAsRead();
        };
    }
    
    // Settings button
    if (settingsBtn) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            openNotificationSettings();
        };
    }

    // Setup filter tabs
    setupNotificationTabs();
    
    // Setup realtime subscription
    setupRealtimeNotifications();
}

// ============================================ */
// 9B. SETUP DYNAMIC GLASS FILTER TABS */
// ============================================ */
function setupNotificationTabs() {
    const tabs = document.querySelectorAll('.notification-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
        tab.onclick = (e) => {
            e.stopPropagation();
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentNotificationTab = tab.dataset.tab; // 'all', 'unread', 'mentions'
            
            if (window.platformComponents.notifications) {
                renderNotificationsList(window.platformComponents.notifications);
            }
        };
    });
}

// ============================================ */
// 9C. LOAD COMPLETE NOTIFICATIONS */
// ============================================ */
async function loadCompleteNotifications() {
    const user = await getCurrentUser();
    const notificationsList = document.getElementById('notifications-list');
    
    if (!notificationsList) return;
    
    if (!user || !user.id) {
        notificationsList.innerHTML = `
            <div class="empty-notifications glassmorphic-empty">
                <div class="empty-icon-wrapper">
                    <i class="fas fa-lock"></i>
                </div>
                <p>Sign in to see notifications</p>
                <span class="empty-subtitle">Track custom platform streams, tips, and tracking.</span>
                <button class="premium-auth-btn" onclick="window.location.href='login.html'">Sign In</button>
            </div>
        `;
        return;
    }
    
    try {
        const { data: notifications, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        window.platformComponents.notifications = notifications || [];
        renderNotificationsList(window.platformComponents.notifications);
        
        const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        updateNotificationsHeaderCount(unreadCount);
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationsList.innerHTML = `
            <div class="empty-notifications glassmorphic-empty">
                <div class="empty-icon-wrapper crash-state">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <p>Failed to sync notifications</p>
                <span class="empty-subtitle">Our streaming pipeline had trouble fetching your feed.</span>
                <button class="premium-auth-btn" onclick="loadCompleteNotifications()">Retry Link</button>
            </div>
        `;
    }
}

// ============================================ */
// 9D. RENDER NOTIFICATIONS LIST (PREMIUM GLASSMORPHIC) */
// ============================================ */
function renderNotificationsList(notifications) {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    
    // Filter down local arrays based on selected glassmorphic tab
    let filtered = [...notifications];
    if (currentNotificationTab === 'unread') {
        filtered = notifications.filter(n => !n.is_read);
    } else if (currentNotificationTab === 'mentions') {
        filtered = notifications.filter(n => n.type === 'mention' || n.type === 'reply');
    }

    if (filtered.length === 0) {
        let emptyMessage = "No notifications yet";
        let emptySubtitle = "When creators interact with your profile, updates appear here.";
        let emptyIcon = "fa-bell-slash";

        if (currentNotificationTab === 'unread') {
            emptyMessage = "You're all caught up!";
            emptySubtitle = "No unread alerts resting in your system queue tracker.";
            emptyIcon = "fa-check-double";
        } else if (currentNotificationTab === 'mentions') {
            emptyMessage = "No mentions yet";
            emptySubtitle = "Threads, discussions, or comments referencing you land here.";
            emptyIcon = "fa-at";
        }

        notificationsList.innerHTML = `
            <div class="empty-notifications glassmorphic-empty">
                <div class="empty-icon-wrapper">
                    <i class="fas ${emptyIcon}"></i>
                </div>
                <p>${emptyMessage}</p>
                <span class="empty-subtitle">${emptySubtitle}</span>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = filtered.map(notification => {
        const iconMeta = getNotificationIconMeta(notification.type);
        return `
            <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-glass-wrapper"></div>
                
                <div class="notification-avatar-container">
                    <div class="notification-icon-badge" style="background: ${iconMeta.bg}; color: ${iconMeta.color};">
                        <i class="fas ${iconMeta.icon}"></i>
                    </div>
                </div>

                <div class="notification-content">
                    <div class="notification-title-row">
                        <h4>${escapeHtml(notification.title)}</h4>
                        <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
                    </div>
                    <p class="notification-msg-body">${escapeHtml(notification.message)}</p>
                </div>

                <div class="notification-meta-indicators">
                    ${!notification.is_read ? `<span class="notification-glow-dot" style="box-shadow: 0 0 10px ${iconMeta.bg}; background: ${iconMeta.bg};"></span>` : ''}
                </div>

                <div class="notification-action-slide">
                    ${!notification.is_read ? `
                        <button class="action-slide-btn mark-read-slide" data-id="${notification.id}" title="Mark as Read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="action-slide-btn delete-slide" data-id="${notification.id}" title="Dismiss">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Bind action events inside the sliding UI layer
    document.querySelectorAll('.mark-read-slide').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            markNotificationAsRead(btn.dataset.id);
        };
    });
    
    document.querySelectorAll('.delete-slide').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            // Optional: animate item slide-out before removing it from DOM
            const item = btn.closest('.notification-item');
            if (item) {
                item.style.transform = 'translateX(100%)';
                item.style.opacity = '0';
                setTimeout(() => deleteNotification(btn.dataset.id), 250);
            } else {
                deleteNotification(btn.dataset.id);
            }
        };
    });
    
    // Handle notification context router transitions
    document.querySelectorAll('.notification-item').forEach(item => {
        item.onclick = () => {
            const id = item.dataset.id;
            const notification = notifications.find(n => n.id === id);
            if (notification && !notification.is_read) {
                markNotificationAsReadSilent(id);
            }
            if (notification?.action_url) {
                window.location.href = notification.action_url;
            }
        };
    });
}

// ============================================ */
// 9E. MARK SINGLE NOTIFICATION AS READ */
// ============================================ */
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
        
        if (error) throw error;
        
        const notification = window.platformComponents.notifications.find(n => n.id === notificationId);
        if (notification) notification.is_read = true;
        
        renderNotificationsList(window.platformComponents.notifications);
        
        const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        updateNotificationsHeaderCount(unreadCount);
        
        showToast('Notification marked as read', 'success');
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('Error modifying alert queue state', 'error');
    }
}

// ============================================ */
// 9F. SILENT READING BACKEND ROUTE (FOR REDIRECTS) */
// ============================================ */
async function markNotificationAsReadSilent(notificationId) {
    try {
        await window.supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
    } catch (err) {
        console.warn('Silent read synchronization error:', err.message);
    }
}

// ============================================ */
// 9G. MARK ALL NOTIFICATIONS AS READ */
// ============================================ */
async function markAllNotificationsAsRead() {
    const user = await getCurrentUser();
    if (!user) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        window.platformComponents.notifications.forEach(n => n.is_read = true);
        renderNotificationsList(window.platformComponents.notifications);
        updateNotificationBadge(0);
        updateNotificationsHeaderCount(0);
        
        showToast('All alerts marked as read', 'success');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed executing batch operational sweeps', 'error');
    }
}

// ============================================ */
// 9H. DELETE NOTIFICATION */
// ============================================ */
async function deleteNotification(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .delete()
            .eq('id', notificationId);
        
        if (error) throw error;
        
        window.platformComponents.notifications = window.platformComponents.notifications.filter(n => n.id !== notificationId);
        renderNotificationsList(window.platformComponents.notifications);
        
        const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        updateNotificationsHeaderCount(unreadCount);
        
    } catch (error) {
        console.error('Error deleting notification:', error);
        showToast('Failed to drop targeted alert frame', 'error');
    }
}

// ============================================ */
// 9I. SETUP REALTIME NOTIFICATIONS */
// ============================================ */
async function setupRealtimeNotifications() {
    if (!window.supabaseClient) return;
    
    const user = await getCurrentUser();
    if (!user || !user.id) return;
    
    window.supabaseClient
        .channel('realtime-notifications-layer')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            const newNotification = payload.new;
            
            if (!window.platformComponents.notifications) {
                window.platformComponents.notifications = [];
            }
            
            window.platformComponents.notifications.unshift(newNotification);
            renderNotificationsList(window.platformComponents.notifications);
            
            const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
            updateNotificationBadge(unreadCount);
            updateNotificationsHeaderCount(unreadCount);
            
            // Dispatch a premium stylized system announcement message
            showToast(`🔔 ${newNotification.title}`, 'info');
        })
        .subscribe();
}

// ============================================ */
// 9J. OPEN NOTIFICATION SETTINGS */
// ============================================ */
function openNotificationSettings() {
    window.location.href = 'notification-settings.html';
}

// ============================================ */
// 9K. GET NOTIFICATION METADATA WITH BRAND CORES */
// ============================================ */
function getNotificationIconMeta(type) {
    const defaultMeta = { icon: 'fa-bell', bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA' };
    const mapping = {
        like: { icon: 'fa-heart', bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171' },
        comment: { icon: 'fa-comment', bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' },
        follow: { icon: 'fa-user-plus', bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399' },
        view_milestone: { icon: 'fa-trophy', bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' },
        achievement: { icon: 'fa-medal', bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' },
        system: { icon: 'fa-shield-alt', bg: 'rgba(107, 114, 128, 0.15)', color: '#9CA3AF' },
        warning: { icon: 'fa-exclamation-triangle', bg: 'rgba(220, 38, 38, 0.2)', color: '#F87171' },
        success: { icon: 'fa-check-circle', bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399' },
        share: { icon: 'fa-share-alt', bg: 'rgba(6, 182, 212, 0.15)', color: '#22D3EE' },
        mention: { icon: 'fa-at', bg: 'rgba(236, 72, 153, 0.15)', color: '#F472B6' },
        reply: { icon: 'fa-reply', bg: 'rgba(20, 184, 166, 0.15)', color: '#2DD4BF' },
        live: { icon: 'fa-broadcast-tower', bg: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }
    };
    return mapping[type] || defaultMeta;
}

// ============================================ */
// 9L. UPDATE NOTIFICATION BADGE (Header) */
// ============================================ */
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
// 9M. UPDATE NOTIFICATIONS HEADER COUNT */
// ============================================ */
function updateNotificationsHeaderCount(count) {
    const headerCount = document.getElementById('notifications-header-count');
    if (headerCount) {
        headerCount.textContent = count > 0 ? `(${count})` : '';
    }
}

// ============================================ */
// 9N. EXPOSE NOTIFICATIONS FUNCTIONS GLOBALLY */
// ============================================ */
window.loadCompleteNotifications = loadCompleteNotifications;
window.renderNotificationsList = renderNotificationsList;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.deleteNotification = deleteNotification;
window.setupRealtimeNotifications = setupRealtimeNotifications;
window.openNotificationSettings = openNotificationSettings;
window.updateNotificationBadge = updateNotificationBadge;
window.updateNotificationsHeaderCount = updateNotificationsHeaderCount;

// ============================================ */
// 10. PROFILE DROPDOWN (FIXED: No redirect, toggles dropdown) */
// ============================================ */

function setupProfileDropdown() {
    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    
    if (profileBtn && dropdown) {
        // Remove any existing click listeners by cloning
        const newProfileBtn = profileBtn.cloneNode(true);
        profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
        
        // FIX: This toggles the dropdown, does NOT redirect
        newProfileBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!newProfileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    if (manageProfilesBtn) {
        manageProfilesBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'manage-profiles.html';
        };
    }
}

// ============================================ */
// PROFILE MANAGEMENT FUNCTIONS */
// ============================================ */

async function createNewProfile(profileData) {
    const user = await getCurrentUser();
    if (!user) {
        showToast('Please sign in first', 'warning');
        return false;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .insert({
                user_id: user.id,
                name: profileData.name,
                avatar_url: profileData.avatar_url || null,
                is_child: profileData.is_child || false,
                pin_code: profileData.pin_code || null,
                settings: profileData.settings || {}
            })
            .select()
            .single();
        
        if (error) throw error;
        
        showToast(`Profile "${profileData.name}" created successfully`, 'success');
        await updateProfileDropdown();
        return data;
        
    } catch (error) {
        console.error('Error creating profile:', error);
        showToast('Error creating profile', 'error');
        return false;
    }
}

async function updateProfileAvatar(profileId, avatarFile) {
    if (!avatarFile) return false;
    
    try {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profileId}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await window.supabaseClient.storage
            .from('avatars')
            .upload(filePath, avatarFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        const { error: updateError } = await window.supabaseClient
            .from('user_profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', profileId);
        
        if (updateError) throw updateError;
        
        showToast('Avatar updated successfully', 'success');
        await updateHeaderProfile();
        await updateSidebarProfile();
        return publicUrl;
        
    } catch (error) {
        console.error('Error updating avatar:', error);
        showToast('Error updating avatar', 'error');
        return false;
    }
}

async function deleteProfile(profileId) {
    const confirmed = confirm('Are you sure you want to delete this profile? This action cannot be undone.');
    if (!confirmed) return false;
    
    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .delete()
            .eq('id', profileId);
        
        if (error) throw error;
        
        showToast('Profile deleted successfully', 'success');
        await updateProfileDropdown();
        return true;
        
    } catch (error) {
        console.error('Error deleting profile:', error);
        showToast('Error deleting profile', 'error');
        return false;
    }
}

async function switchProfile(profileId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', profileId)
            .eq('user_id', user.id)
            .single();
        
        if (error) throw error;
        
        window.platformComponents.currentProfile = profile;
        localStorage.setItem('currentProfileId', profileId);
        
        await updateHeaderProfile();
        await updateSidebarProfile();
        
        showToast(`Switched to ${profile.name}`, 'success');
        
        // Reload page content if needed
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            location.reload();
        }
        
    } catch (error) {
        console.error('Error switching profile:', error);
        showToast('Error switching profile', 'error');
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
// THEME MANAGEMENT - FIXED VERSION (AFFECTS ENTIRE PAGE)
// ============================================ */
function initThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    if (!themeSelector || !themeToggle) return;
    
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyThemeToDocument(savedTheme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        const newOption = option.cloneNode(true);
        option.parentNode?.replaceChild(newOption, option);
        
        newOption.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const theme = newOption.dataset.theme;
            if (theme) {
                applyThemeToDocument(theme);
                themeSelector.classList.remove('active');
                showToast(`Theme changed to ${theme}`, 'success');
            }
        };
    });
    
    const newToggle = themeToggle.cloneNode(true);
    themeToggle.parentNode?.replaceChild(newToggle, themeToggle);
    
    newToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    };
    
    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') &&
            !themeSelector.contains(e.target) &&
            !newToggle.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
}

function applyThemeToDocument(theme) {
    if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
        theme = 'dark';
    }
    
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);
    root.setAttribute('data-theme', theme);
    
    // Update meta theme color
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    
    const colors = { dark: '#0A0E12', light: '#F8FAFC', 'high-contrast': '#000000' };
    meta.setAttribute('content', colors[theme]);
    
    localStorage.setItem('bantu_theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    // Dispatch event for components that need to react
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    
    console.log('🎨 Theme applied to entire page:', theme);
}

// ============================================ */
// CREATOR MODE TOGGLE - From explore-screen */
// ============================================ */

async function initCreatorMode() {
    const creatorModeToggle = document.getElementById('creatorModeToggle');
    const creatorModeSwitch = document.getElementById('creatorModeSwitch');
    const creatorSection = document.querySelector('.sidebar-section[data-section="creator"]');
    
    if (!creatorModeToggle || !creatorModeSwitch) return;
    
    // Check if user is creator
    async function checkCreatorStatus() {
        const user = await getCurrentUser();
        if (user && user.id && window.supabaseClient) {
            try {
                // Check if user has published content
                const { data, error } = await window.supabaseClient
                    .from('Content')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('status', 'published')
                    .limit(1);
                
                if (!error && data && data.length > 0) {
                    creatorModeToggle.style.display = 'flex';
                    // Load saved preference
                    const savedMode = localStorage.getItem('creator_mode') === 'true';
                    creatorModeSwitch.checked = savedMode;
                    if (savedMode && creatorSection) {
                        creatorSection.style.display = 'block';
                    } else if (creatorSection) {
                        creatorSection.style.display = 'none';
                    }
                }
            } catch (e) {
                console.warn('Error checking creator status:', e);
            }
        }
    }
    
    // Toggle creator mode
    creatorModeSwitch.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        localStorage.setItem('creator_mode', isEnabled);
        if (creatorSection) {
            creatorSection.style.display = isEnabled ? 'block' : 'none';
        }
        if (window.showToast) {
            window.showToast(isEnabled ? 'Creator mode enabled' : 'Creator mode disabled', 'info');
        }
    });
    
    // Check on auth changes
    await checkCreatorStatus();
    document.addEventListener('authReady', checkCreatorStatus);
    
    // Also check when profile updates
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(() => {
            setTimeout(checkCreatorStatus, 500);
        });
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

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${url.replace(/^\/+/, '')}`;
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
                await loadCompleteNotifications();
                await initCreatorMode(); // Re-check creator mode on sign in
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
        await loadCompleteNotifications();
        await initCreatorMode(); // Re-check creator mode when auth is ready
    });
}

// ============================================ */
// MAKE HEADER BUTTONS CLICKABLE */
// ============================================ */
function setupHeaderButtons() {
    // All buttons are set up in their respective functions:
    // - Voice search: setupVoiceSearch
    // - Analytics: setupAnalytics
    // - Search: setupSearchModal (now uses premium search)
    // - Notifications: setupNotifications
    // - Profile: setupProfileDropdown
}

// ============================================ */
// MAIN INITIALIZATION */
// ============================================ */
async function initSharedComponents() {
    if (window.platformComponents.initialized) {
        console.log('⚠️ Shared components already initialized');
        return;
    }
    
    console.log('🚀 Initializing shared components with complete features...');
    
    // Setup theme selector FIRST (affects entire page)
    initThemeSelector();
    
    // Setup all components
    setupHeaderButtons();
    setupSearchModal();        // PREMIUM SEARCH with three-state system
    setupAnalytics();          // COMPLETE with optimized metrics
    setupNotifications();      // COMPLETE with premium glassmorphic engine
    setupBottomNavigation();
    setupSidebarClose();
    setupSidebarToggles();
    setupSidebarScaleControls();
    setupBackToTop();
    setupProfileDropdown();    // FIXED - no redirect, toggles dropdown
    setupLogout();
    setupAuthListener();
    
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
    
    // Initialize creator mode
    await initCreatorMode();
    
    // Make functions globally available
    window.showToast = showToast;
    window.getCurrentUser = getCurrentUser;
    window.updateHeaderProfile = updateHeaderProfile;
    window.updateSidebarProfile = updateSidebarProfile;
    window.performSearch = performSearch;
    window.performAdvancedSearch = performAdvancedSearch;
    window.switchProfile = switchProfile;
    window.createNewProfile = createNewProfile;
    window.markNotificationAsRead = markNotificationAsRead;
    window.applyThemeToDocument = applyThemeToDocument;
    window.initCreatorMode = initCreatorMode;
    window.clearSearchHistory = clearSearchHistory;
    window.triggerFastSearch = triggerFastSearch;
    
    window.platformComponents.initialized = true;
    console.log('✅ Shared components initialized successfully with premium search and optimized analytics');
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
        performSearch,
        performAdvancedSearch,
        switchProfile,
        createNewProfile,
        markNotificationAsRead,
        UIScaleController,
        applyThemeToDocument,
        initCreatorMode,
        clearSearchHistory,
        triggerFastSearch,
        loadCompleteAnalyticsData,
        renderAnalyticsChart,
        updateAnalyticsChart,
        refreshAnalyticsChart
    };
}
