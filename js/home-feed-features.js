// ============================================
// HOME FEED INITIALIZATION - PERFORMANCE ARCHITECTURE
// ============================================

// Check if languageMap already exists to avoid duplicate declaration errors
if (typeof window.languageMap === 'undefined') {
    window.languageMap = {
        'en': 'English',
        'zu': 'isiZulu',
        'xh': 'isiXhosa',
        'st': 'Sesotho',
        'tn': 'Setswana',
        'ss': 'Siswati',
        've': 'Tshivenḓa',
        'ts': 'Xitsonga',
        'nr': 'isiNdebele',
        'nso': 'Sesotho sa Leboa',
        'af': 'Afrikaans',
        'all': 'All Languages'
    };
}

// ============================================
// UTILITY FUNCTIONS (MUST BE DEFINED FIRST)
// ============================================

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 *returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
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

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 */
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

/**
 * Escape RegExp special characters for search highlighting
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight search query in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted text
 */
function highlightSearchQuery(text, query) {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark style="background:rgba(245,158,11,0.3);color:var(--soft-white);padding:0 2px;border-radius:3px;">$1</mark>');
}

// Only run DOMContentLoaded if document is still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Home Feed Initializing (Performance Mode)');
        
        // Override loading text
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = 'Building Your Feed...';
        
        // Initialize the feed
        await initializeHomeFeed();
    });
} else {
    // DOM is already loaded, run immediately
    console.log('🚀 Home Feed Initializing (Performance Mode) - DOM already loaded');
    
    // Override loading text
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Building Your Feed...';
    
    // Initialize the feed
    initializeHomeFeed().catch(err => {
        console.error("❌ Home Feed Initialization Error:", err);
    });
}

// ============================================
// HELPER FUNCTIONS FOR PERFORMANCE
// ============================================

function showAllSkeletons() {
    // Show skeletons for all sections immediately
    const sections = [
        'continue-watching-grid',
        'for-you-grid',
        'trending-grid',
        'new-content-grid',
        'community-favorites-grid',
        'live-streams-grid',
        'pulse-feed'
    ];
    
    sections.forEach(sectionId => {
        const container = document.getElementById(sectionId);
        if (container && container.children.length === 0) {
            container.innerHTML = Array(4).fill().map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-thumbnail"></div>
                    <div class="skeleton-title"></div>
                    <div class="skeleton-creator"></div>
                    <div class="skeleton-stats"></div>
                </div>
            `).join('');
        }
    });
}

// ✅ Load all cached sections at once
function loadAllCachedSections() {
    const sections = {
        'continue-watching-grid': 'feed_continueWatching',
        'for-you-grid': 'feed_forYou',
        'following-grid': 'feed_following',
        'community-favorites-grid': 'feed_communityFavorites',
        'trending-grid': 'feed_trending',
        'new-content-grid': 'feed_newContent'
    };
    
    Object.entries(sections).forEach(([containerId, cacheKey]) => {
        const container = document.getElementById(containerId);
        const cachedData = window.cacheManager?.get(cacheKey);
        
        if (container && cachedData && cachedData.length > 0) {
            console.log(`📦 Loading cached ${containerId}`);
            container.innerHTML = '';
            renderContentCards(container, cachedData);
            
            // Animate cards
            document.querySelectorAll(`#${containerId} .content-card`).forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 50);
            });
        }
    });
}

// ✅ Check and retry empty sections
function checkAndRetryEmptySections() {
    const sections = [
        { id: 'continue-watching-grid', loader: loadContinueWatchingSection, name: 'Continue Watching' },
        { id: 'following-grid', loader: loadFollowingSection, name: 'Following' },
        { id: 'community-favorites-grid', loader: loadCommunityFavoritesSection, name: 'Community Favorites' }
    ];
    
    sections.forEach(section => {
        const container = document.getElementById(section.id);
        if (container && (container.children.length === 0 || container.innerHTML.includes('skeleton'))) {
            console.log(`🔄 Retrying empty section: ${section.name}`);
            section.loader().catch(err => {
                console.error(`Retry failed for ${section.name}:`, err);
                // Show user-friendly message
                if (container && container.innerHTML.includes('skeleton')) {
                    container.innerHTML = `
                        <div class="empty-state" style="grid-column: 1 / -1;">
                            <div class="empty-icon"><i class="fas fa-sync-alt"></i></div>
                            <h3>Unable to load ${section.name}</h3>
                            <button class="see-all-btn" onclick="location.reload()">Refresh Page</button>
                        </div>
                    `;
                }
            });
        }
    });
}

// ============================================
// THEME FUNCTIONS - FIXED VERSION (INSTANT APPLY, NO REFRESH)
// ============================================

/**
 * Setup theme selector with proper event handling
 * Enhanced with better click handling and z-index management
 */
function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    console.log('🎨 Theme Setup - Selector:', !!themeSelector, 'Toggle:', !!themeToggle);
    
    if (!themeSelector) {
        console.error('❌ Theme selector element not found!');
        return;
    }
    
    // Apply saved theme IMMEDIATELY on load
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    // Theme option click handlers - Use event delegation with stopPropagation
    const themeOptions = document.querySelectorAll('.theme-option');
    console.log('🎨 Theme Options Found:', themeOptions.length);
    
    themeOptions.forEach((option, index) => {
        // Clone to remove any existing listeners
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        newOption.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Stop event from bubbling to overlay
            const theme = this.dataset.theme;
            console.log('🎨 Theme clicked:', theme);
            
            // Apply theme
            applyTheme(theme);
            
            // Hide selector after selection
            setTimeout(() => {
                themeSelector.classList.remove('active');
            }, 100);
            
            showToast(`Theme changed to ${theme}`, 'success');
        });
        
        console.log(`🎨 Theme option ${index + 1} listener attached`);
    });
    
    // Close when clicking outside theme selector - Use capture phase
    document.addEventListener('click', function(e) {
        if (themeSelector.classList.contains('active') && 
            !themeSelector.contains(e.target) && 
            !e.target.closest('#sidebar-theme-toggle') &&
            !e.target.closest('.sidebar-theme-toggle')) {
            themeSelector.classList.remove('active');
            console.log('🎨 Theme selector closed by outside click');
        }
    }, true); // Use capture phase to ensure it runs first
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && themeSelector.classList.contains('active')) {
            themeSelector.classList.remove('active');
        }
    });
}

/**
 * Apply theme to the document with INSTANT application (no refresh needed)
 * @param {string} theme - Theme name (dark, light, high-contrast)
 */
function applyTheme(theme) {
    const root = document.documentElement;
    console.log('🎨 Applying theme:', theme);
    
    // Remove all theme classes first
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    
    // Apply new theme class
    root.classList.add(`theme-${theme}`);
    
    // Force immediate CSS reflow for instant visual update
    void root.offsetWidth;
    
    // Save preference
    localStorage.setItem('bantu_theme', theme);
    
    // Update active state on theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    console.log('🎨 Theme applied successfully:', theme);
    console.log('🎨 Current HTML classes:', root.className);
    
    // Show confirmation toast
    if (typeof showToast === 'function') {
        showToast(`Theme changed to ${theme}`, 'success');
    }
    
    // Dispatch custom event for other components to react
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: theme }
    }));
}

/**
 * Setup sidebar theme toggle with proper event handling
 * Enhanced with delay to ensure sidebar closes before theme selector appears
 */
function setupSidebarThemeToggle() {
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    const themeSelector = document.getElementById('theme-selector');
    const sidebarClose = document.getElementById('sidebar-close');
    
    console.log('🎨 Sidebar Theme Toggle Setup - Toggle:', !!themeToggle, 'Selector:', !!themeSelector);
    
    if (!themeToggle) {
        console.error('❌ Sidebar theme toggle not found!');
        return;
    }
    
    // Remove existing listener by cloning to prevent duplicates
    const newToggle = themeToggle.cloneNode(true);
    themeToggle.parentNode.replaceChild(newToggle, themeToggle);
    
    newToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎨 Sidebar theme toggle clicked');
        
        // Close sidebar first
        if (sidebarClose) {
            sidebarClose.click();
        }
        
        // Small delay to ensure sidebar overlay is removed before showing theme selector
        setTimeout(() => {
            if (themeSelector) {
                const isActive = themeSelector.classList.contains('active');
                themeSelector.classList.toggle('active');
                console.log('🎨 Theme selector active:', !isActive, 'Classes:', themeSelector.className);
                
                // Force reflow to ensure CSS applies
                void themeSelector.offsetWidth;
            }
        }, 150); // 150ms delay for smooth transition
    });
}

// ============================================
// HOME FEED CONTROLLER (PERFORMANCE MODE) - FIXED
// ============================================
async function initializeHomeFeed() {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    const startTime = performance.now();
    
    try {
        console.log("🚀 Initializing Home Feed (Performance Mode)");
        
        // ✅ SHOW UI IMMEDIATELY
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
        
        // Show skeletons instantly
        showAllSkeletons();
        
        // ✅ CRITICAL: Try to load cached data for ALL sections immediately
        loadAllCachedSections();
        
        // ✅ 1. Check authentication (don't block sections)
        const authPromise = checkAuth();
        
        // ✅ 2. Start loading ALL sections in parallel IMMEDIATELY (don't wait for auth)
        // This is the key fix - sections load regardless of auth status
        const sectionPromises = [
            loadContinueWatchingSection(),  // Will handle null auth gracefully
            loadForYouSection(),
            loadFollowingSection(),          // Will handle null auth gracefully
            loadCommunityFavoritesSection(),
            loadTrendingSection(),
            loadNewContentSection(),
            loadShortsSection(),
            loadLiveStreamsSection(),
            loadFeaturedCreatorsSection(),
            loadEventsSection(),
            loadCommunityStats()
        ];
        
        // ✅ 3. Wait for auth to complete (but sections are already loading)
        await authPromise;
        
        // ✅ ADD THIS LINE - Setup auth state listener for real-time updates
        setupAuthStateListener();
        
        // Update app icon
        updateAppIcon();
        
        // ✅ 4. Load user profiles in background (non-blocking)
        if (window.currentUser) {
            Promise.all([
                loadUserProfiles(),
                loadUserProfile()
            ]).catch(console.warn);
            
            // Update UI profile elements
            Promise.all([
                updateHeaderProfile(),
                updateSidebarProfile(),
                updateProfileSwitcher()
            ]).catch(console.warn);
        }
        
        // ✅ 5. Load Hero section (independent)
        loadCinematicHero().catch(err => console.error('Hero failed:', err));
        
        // ✅ 6. Initialize UI components
        setupSidebar();
        setupThemeSelector();
        setupLanguageFilter();
        setupSearch();
        setupNotifications();
        setupAnalytics();
        setupVoiceSearch();
        setupWatchParty();
        setupTipSystem();
        setupBackToTop();
        setupInfiniteScroll();
        setupKeyboardNavigation();
        updateWelcomeMessage();
        renderCategoryTabs();
        setupNavigationButtons();
        
        // ✅ Load sidebar section states
        loadSidebarSectionStates();
        checkCreatorStatus();
        
        // ✅ 7. Wait for all sections to complete (or fail gracefully)
        const results = await Promise.allSettled(sectionPromises);
        
        // Log failures but don't break
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`❌ Section ${index} failed:`, result.reason);
            }
        });
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ Home Feed Loaded in ${totalTime.toFixed(0)}ms`);
        
        // Force a final check for any empty sections
        setTimeout(() => {
            checkAndRetryEmptySections();
        }, 2000);
        
    } catch (err) {
        console.error("❌ Home Feed Error:", err);
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
        showToast('Page loaded, but some content may be delayed', 'warning');
    }
}

// ============================================
// AUTH STATE LISTENER - FIX FOR WELCOME MESSAGE
// ============================================
// ✅ Listen for auth state changes
function setupAuthStateListener() {
    if (!window.supabaseAuth) return;
    
    // Listen for auth changes
    window.supabaseAuth.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
            window.currentUser = session.user;
            // Reload user profile
            Promise.all([
                loadUserProfile(),
                loadUserProfiles()
            ]).then(() => {
                // Update all UI elements
                updateWelcomeMessage();
                updateHeaderProfile();
                updateSidebarProfile();
                updateProfileSwitcher();
                
                // Reload personalized sections
                loadForYouSection();
                loadFollowingSection();
                loadContinueWatchingSection();
                
                // Re-check creator status
                checkCreatorStatus();
                
                showToast(`Welcome back, ${session.user.user_metadata?.full_name || 'User'}!`, 'success');
            }).catch(console.warn);
        }
        
        if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            window.currentProfile = null;
            
            // Update all UI elements to guest mode
            updateWelcomeMessage();
            updateHeaderProfile();
            updateSidebarProfile();
            updateProfileSwitcher();
            
            // Hide user-specific sections
            const followingSection = document.getElementById('following-section');
            const continueSection = document.getElementById('continue-watching-section');
            if (followingSection) followingSection.style.display = 'none';
            if (continueSection) continueSection.style.display = 'none';
            
            // Hide creator section
            const creatorSection = document.querySelector('.sidebar-section[data-section="creator"]');
            if (creatorSection) creatorSection.style.display = 'none';
            
            showToast('Signed out successfully', 'info');
        }
    });
}

// ============================================
// GLOBAL IMAGE ERROR HANDLER
// ============================================
function setupGlobalImageErrorHandler() {
    // Add global image error listener for profile images
    document.addEventListener('error', function(e) {
        const target = e.target;
        if (target.tagName === 'IMG') {
            // Check if it's a profile/avatar image
            if (target.classList.contains('profile-img') || 
                target.closest('.creator-avatar-small') ||
                target.closest('.profile-avatar-small')) {
                console.warn('🖼️ Profile image failed:', target.src);
                const container = target.parentElement;
                if (container) {
                    const initials = target.alt?.charAt(0)?.toUpperCase() || 'U';
                    const size = container.classList.contains('creator-avatar-small') ? 'small' : 'medium';
                    if (typeof getInitialsAvatar !== 'undefined') {
                        container.innerHTML = getInitialsAvatar(initials, size);
                    } else {
                        // Fallback if image-fix.js not loaded
                        container.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
                    }
                }
            }
        }
    }, true);
}

// ============================================
// SIDEBAR SECTION TOGGLE - YOUTUBE STYLE
// ============================================
function toggleSidebarSection(sectionName) {
    const section = document.querySelector(`.sidebar-section[data-section="${sectionName}"]`);
    const content = section?.querySelector('.sidebar-section-content');
    const header = section?.querySelector('.sidebar-section-header');
    
    if (!content || !header) return;
    
    const isCollapsed = content.classList.toggle('collapsed');
    header.classList.toggle('collapsed', isCollapsed);
    
    // Save preference
    localStorage.setItem(`sidebar_${sectionName}_collapsed`, isCollapsed);
    
    // Update icon
    const icon = header.querySelector('.section-toggle-icon');
    if (icon) {
        icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0)';
    }
}

// Load saved section states on init
function loadSidebarSectionStates() {
    ['main', 'categories', 'you', 'creator', 'community', 'account'].forEach(section => {
        const collapsed = localStorage.getItem(`sidebar_${section}_collapsed`) === 'true';
        if (collapsed) {
            const content = document.querySelector(`#section-${section}`);
            const header = document.querySelector(`[data-section="${section}"] .sidebar-section-header`);
            content?.classList.add('collapsed');
            header?.classList.add('collapsed');
            const icon = header?.querySelector('.section-toggle-icon');
            if (icon) icon.style.transform = 'rotate(-90deg)';
        }
    });
}

// Show creator section if user is a creator
function checkCreatorStatus() {
    if (!window.currentUser) return;
    
    // Check if user has creator role or uploaded content
    supabaseAuth
        .from('Content')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', window.currentUser.id)
        .limit(1)
        .then(({ count, error }) => {
            if (error) {
                console.warn('Creator check error:', error);
                return;
            }
            if (count > 0) {
                const creatorSection = document.querySelector('.sidebar-section[data-section="creator"]');
                if (creatorSection) {
                    creatorSection.style.display = 'block';
                    console.log('✅ Creator section enabled');
                }
            }
        })
        .catch(err => console.warn('Creator check failed:', err));
}

// ============================================
// METRICS AGGREGATOR - OPTIMIZED VERSION
// ============================================

// Master builder - composes complete dataset for a section
async function buildSectionData(contentList) {
    if (!contentList || contentList.length === 0) return [];
    
    const contentIds = contentList.map(c => c.id);
    const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
    
    // Don't fetch metrics if we have no IDs
    if (contentIds.length === 0) {
        return contentList.map(item => ({ ...item, metrics: { views: 0, likes: 0, shares: 0, connectors: 0 } }));
    }
    
    console.log('📊 Fetching metrics for', contentIds.length, 'content items');
    
    // Use Promise.allSettled to prevent one failing from breaking everything
    const metricsResults = await Promise.allSettled([
        fetchViewCounts(contentIds),
        fetchLikeCounts(contentIds),
        fetchShareCounts(contentIds),
        fetchConnectorCounts(creatorIds)
    ]);
    
    // Extract results with fallbacks
    const views = metricsResults[0]?.status === 'fulfilled' ? metricsResults[0].value : {};
    const likes = metricsResults[1]?.status === 'fulfilled' ? metricsResults[1].value : {};
    const shares = metricsResults[2]?.status === 'fulfilled' ? metricsResults[2].value : {};
    const connectors = metricsResults[3]?.status === 'fulfilled' ? metricsResults[3].value : {};
    
    return contentList.map(item => ({
        ...item,
        metrics: {
            views: views[item.id] || item.views_count || 0,
            likes: likes[item.id] || 0,
            shares: shares[item.id] || 0,
            favorites: item.favorites_count || 0,
            connectors: connectors[item.user_id] || 0
        }
    }));
}

// View counts
async function fetchViewCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_views")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching view counts:', error);
        return {};
    }
}

// Like counts
async function fetchLikeCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_likes")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching like counts:', error);
        return {};
    }
}

// Share counts
async function fetchShareCounts(contentIds) {
    if (!contentIds.length) return {};
    
    try {
        const { data } = await supabaseAuth
            .from("content_shares")
            .select("content_id")
            .in("content_id", contentIds);

        const counts = {};
        data?.forEach(row => {
            counts[row.content_id] = (counts[row.content_id] || 0) + 1;
        });
        return counts;
    } catch (error) {
        console.error('Error fetching share counts:', error);
        return {};
    }
}

// Connector counts per creator - OPTIMIZED
async function fetchConnectorCounts(creatorIds) {
    if (!creatorIds || creatorIds.length === 0) {
        return {};
    }
    
    try {
        // Use in() with a reasonable limit
        const limitedIds = creatorIds.slice(0, 50);
        
        const { data, error } = await supabaseAuth
            .from("connectors")
            .select("connected_id")
            .in("connected_id", limitedIds)
            .eq("connection_type", "creator");
        
        if (error) {
            console.warn('Connector fetch error:', error);
            return {};
        }
        
        const counts = {};
        data?.forEach(row => {
            counts[row.connected_id] = (counts[row.connected_id] || 0) + 1;
        });
        
        return counts;
    } catch (error) {
        console.error('Error fetching connector counts:', error);
        return {};
    }
}

// ============================================
// SECTION 1: CONTINUE WATCHING - FIXED
// ============================================
async function loadContinueWatchingSection() {
    const section = document.getElementById('continue-watching-section');
    const container = document.getElementById('continue-watching-grid');
    
    console.log('📺 Loading Continue Watching...');
    
    if (!section || !container) {
        console.warn('Continue watching elements not found');
        return;
    }
    
    const cacheKey = 'feed_continueWatching';
    
    // Try cached data first
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        console.log('📦 Continue Watching: Using cached data,', cachedData.length, 'items');
        section.style.display = 'block';
        container.innerHTML = '';
        renderContinueWatchingCards(container, cachedData, cachedData.progressMap || {});
        document.querySelectorAll('#continue-watching-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        // Still refresh in background
        refreshContinueWatchingInBackground(cacheKey, section, container);
        return;
    }
    
    // Show skeletons
    container.innerHTML = Array(4).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
    section.style.display = 'block';
    
    // If not logged in, show empty state after skeletons
    if (!window.currentUser) {
        console.log('ℹ️ No user logged in, hiding continue watching');
        setTimeout(() => {
            section.style.display = 'none';
        }, 1000);
        return;
    }
    
    try {
        console.log('📺 Fetching continue watching for user:', window.currentUser.id);
        
        // ✅ FIX: Use maybeSingle() pattern and better error handling
        const { data: watchProgress, error } = await supabaseAuth
            .from('watch_progress')
            .select(`
                content_id,
                last_position,
                total_watch_time,
                is_completed,
                updated_at
            `)
            .eq('user_id', window.currentUser.id)
            .eq('is_completed', false)
            .neq('last_position', 0)
            .order('updated_at', { ascending: false })
            .limit(20);
        
        if (error) {
            console.error('❌ Continue Watching query error:', error);
            throw error;
        }
        
        if (!watchProgress || watchProgress.length === 0) {
            console.log('ℹ️ No watch progress found');
            section.style.display = 'none';
            return;
        }
        
        // Get content IDs
        const contentIds = watchProgress.map(item => item.content_id).filter(Boolean);
        
        if (contentIds.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Fetch content details
        const { data: contentData, error: contentError } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .in('id', contentIds)
            .eq('status', 'published');
        
        if (contentError) {
            console.error('Content fetch error:', contentError);
            throw contentError;
        }
        
        if (!contentData || contentData.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        // Build progress map
        const progressMap = {};
        watchProgress.forEach(item => {
            const content = contentData.find(c => c.id === item.content_id);
            if (content && content.duration) {
                const progress = Math.min(100, Math.floor((item.last_position / content.duration) * 100));
                progressMap[item.content_id] = {
                    progress: progress,
                    current: item.last_position,
                    total: content.duration
                };
            }
        });
        
        // Get metrics
        const creatorIds = [...new Set(contentData.map(c => c.user_id).filter(Boolean))];
        const metrics = await fetchAllMetrics(contentIds, creatorIds);
        
        // Enrich content with metrics
        const enrichedData = contentData.map(item => ({
            ...item,
            metrics: {
                views: metrics.views[item.id] || 0,
                likes: metrics.likes[item.id] || 0,
                shares: metrics.shares[item.id] || 0,
                connectors: metrics.connectors[item.user_id] || 0
            },
            progressMap: progressMap
        }));
        
        // Cache with progress map
        const cacheData = { data: enrichedData, progressMap: progressMap };
        window.cacheManager?.set(cacheKey, cacheData, 5 * 60 * 1000);
        
        // Render
        section.style.display = 'block';
        container.innerHTML = '';
        renderContinueWatchingCards(container, enrichedData, progressMap);
        
        document.querySelectorAll('#continue-watching-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
        console.log('✅ Continue Watching loaded:', enrichedData.length, 'items');
        
    } catch (err) {
        console.error("❌ Continue Watching Section Error:", err);
        // Don't hide the section, show error but keep skeletons
        setTimeout(() => {
            if (container && container.innerHTML.includes('skeleton')) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <h3>Unable to load continue watching</h3>
                        <button class="see-all-btn" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }, 3000);
    }
}

// Helper function to refresh in background
async function refreshContinueWatchingInBackground(cacheKey, section, container) {
    try {
        if (!window.currentUser) return;
        
        const { data: watchProgress } = await supabaseAuth
            .from('watch_progress')
            .select('content_id, last_position, updated_at')
            .eq('user_id', window.currentUser.id)
            .eq('is_completed', false)
            .limit(10);
        
        if (watchProgress && watchProgress.length > 0) {
            // Refresh the section
            await loadContinueWatchingSection();
        }
    } catch (err) {
        console.log('Background refresh failed:', err);
    }
}

// Specialized renderer for continue watching (includes progress)
function renderContinueWatchingCards(container, contents, progressMap) {
    container.innerHTML = '';
    
    console.log('🎨 Rendering', contents.length, 'continue watching cards');
    console.log('📊 Progress map:', progressMap);
    
    contents.forEach(content => {
        if (!content) return;
        
        // ✅ Get ACTUAL progress from watch_progress table
        const progress = progressMap[content.id] || { progress: 0, current: 0, total: 0 };
        const connectorCount = content.metrics?.connectors || 0;
        
        console.log('🎨 Card:', content.id, '- Connectors:', connectorCount);
        
        const thumbnailUrl = content.thumbnail_url
            ? fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
        const initials = getInitials(creatorName);
        
        const durationFormatted = formatDuration(progress.total || content.duration || 0);
        const currentFormatted = formatDuration(progress.current || 0);
        
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
            avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(creatorName)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">`;
        } else {
            avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
        }
        
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}&resume=true`;
        card.dataset.contentId = content.id;
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        
        // ✅ HTML with CORRECT progress bar and resume time
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';">
                <div class="card-badges">
                    <div class="card-badge continue-badge">
                        <i class="fas fa-play-circle"></i> CONTINUE
                    </div>
                </div>
                <div class="thumbnail-overlay"></div>
                
                <!-- ✅ PROGRESS BAR with ACTUAL width -->
                <div class="watch-progress-container">
                    <div class="watch-progress-bar" style="width: ${progress.progress}%"></div>
                </div>
                
                <div class="play-overlay">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                <div class="creator-info">
                    <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                    <div class="creator-name-small">${escapeHtml(creatorName)}</div>
                </div>
                
                <!-- ✅ ACTUAL RESUME TIME (not 0:00) -->
                <div class="card-meta">
                    <span><i class="fas fa-clock"></i> ${currentFormatted} / ${durationFormatted}</span>
                    <span>${progress.progress}%</span>
                </div>
                
                <div class="connector-info">
                    <i class="fas fa-user-friends"></i> ${formatNumber(connectorCount)} Connectors
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// SECTION 2: FOR YOU (Personalized) with Amplification Logic & Caching
// ============================================
async function loadForYouSection() {
    const container = document.getElementById('for-you-grid');
    if (!container) return;
    
    const cacheKey = 'feed_forYou';
    const startTime = performance.now();
    
    // 1. Try to show cached data IMMEDIATELY
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        console.log('📦 For You: Using cached data');
        container.innerHTML = '';
        renderContentCards(container, cachedData);
        // Animate them in
        document.querySelectorAll('#for-you-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
    } else {
        // Show skeletons
        container.innerHTML = Array(4).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
    }
    
    try {
        let contentList = [];
        
        if (window.currentUser) {
            // Get user's liked content for genre preferences - WITH LIMIT
            const { data: likedContent } = await supabaseAuth
                .from('content_likes')
                .select('content_id')
                .eq('user_id', window.currentUser.id)
                .limit(20); // ✅ ADDED LIMIT
            
            const likedIds = (likedContent || []).map(l => l.content_id);
            
            // Get genres from liked content
            let genres = [];
            if (likedIds.length > 0) {
                const { data: likedGenres } = await supabaseAuth
                    .from('Content')
                    .select('genre')
                    .in('id', likedIds.slice(0, 10));
                
                genres = [...new Set((likedGenres || []).map(g => g.genre).filter(Boolean))];
            }
            
            // Build query with SELECT only needed fields
            let query = supabaseAuth
                .from('Content')
                .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)') // ✅ SELECT specific fields
                .eq('status', 'published');
            
            if (genres.length > 0) {
                query = query.in('genre', genres.slice(0, 3)); // ✅ LIMIT genres
            }
            
            const { data } = await query
                .order('views_count', { ascending: false })
                .limit(12); // ✅ ADDED LIMIT
            
            contentList = data || [];
        }
        
        // Fallback to trending if no personalized content
        if (contentList.length === 0) {
            const { data } = await supabaseAuth
                .from('Content')
                .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)') // ✅ SELECT specific fields
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(8); // ✅ ADDED LIMIT
            
            contentList = data || [];
        }
        
        if (contentList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon"><i class="fas fa-magic"></i></div>
                    <h3>No Recommendations Yet</h3>
                    <p>Start watching and liking content to get personalized picks</p>
                </div>
            `;
            return;
        }
        
        // Build complete dataset with metrics (optimized)
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        
        // ✅ Apply Amplification Logic
        const boostedData = applyAmplificationLogic(sectionData);
        boostedData.sort((a, b) => (b.amplification_score || 0) - (a.amplification_score || 0));
        
        // Render
        container.innerHTML = '';
        renderContentCards(container, boostedData);
        
        // Cache the result
        window.cacheManager?.set(cacheKey, boostedData, 5 * 60 * 1000);
        
        // Animate cards
        document.querySelectorAll('#for-you-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
        const loadTime = performance.now() - startTime;
        console.log(`📊 For You section loaded in ${loadTime.toFixed(0)}ms`);
        
    } catch (err) {
        console.error("❌ For You Section Error:", err);
        if (!cachedData) {
            container.innerHTML = '<div class="empty-state">Failed to load recommendations</div>';
        }
    }
}

// ✅ Amplification Logic Implementation
function applyAmplificationLogic(items) {
    const localLanguages = ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso'];
    
    return items.map(item => {
        let score = item.metrics?.base_score || 0;
        
        // Use metrics for amplification if available
        const baseScore = (item.metrics?.views || 0) + 
                         ((item.metrics?.likes || 0) * 5) + 
                         ((item.metrics?.shares || 0) * 10);
        
        score = baseScore;
        
        // 1. Local Language Boost (IsiZulu, IsiXhosa, etc.)
        if (localLanguages.includes(item.language)) {
            score = score * 1.3; 
        }
        
        // 2. Emerging Creator Boost (< 1000 connectors)
        if (item.metrics?.connectors < 1000) {
            score = score * 1.2;
        }
        
        // 3. Freshness Boost (< 7 days)
        const daysOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) {
            score = score * 1.4;
        }
        
        return { 
            ...item, 
            amplification_score: score,
            metrics: {
                ...item.metrics,
                base_score: baseScore
            }
        };
    });
}

// ============================================
// SECTION 3: FROM CREATORS YOU CONNECTED WITH - FIXED
// ============================================
async function loadFollowingSection() {
    const section = document.getElementById('following-section');
    const container = document.getElementById('following-grid');
    
    console.log('👥 Loading Following section...');
    
    if (!section || !container) return;
    
    const cacheKey = 'feed_following';
    
    // Try cached data
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        console.log('📦 Following: Using cached data,', cachedData.length, 'items');
        section.style.display = 'block';
        container.innerHTML = '';
        renderContentCards(container, cachedData);
        document.querySelectorAll('#following-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        return;
    }
    
    // Show skeletons
    container.innerHTML = Array(4).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
    
    // If not logged in, hide section
    if (!window.currentUser) {
        console.log('ℹ️ No user logged in, hiding following section');
        section.style.display = 'none';
        return;
    }
    
    try {
        // 1️⃣ Get creators user follows
        const { data: following, error } = await supabaseAuth
            .from('connectors')
            .select('connected_id')
            .eq('connector_id', window.currentUser.id)
            .eq('connection_type', 'creator')
            .limit(50);
        
        if (error) {
            console.warn('Following fetch error:', error);
            section.style.display = 'none';
            return;
        }
        
        if (!following || following.length === 0) {
            console.log('ℹ️ User follows no creators');
            section.style.display = 'none';
            return;
        }
        
        const creatorIds = following.map(f => f.connected_id).slice(0, 20);
        
        // 2️⃣ Fetch content from followed creators
        const { data: contentList, error: contentError } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .in('user_id', creatorIds)
            .order('created_at', { ascending: false })
            .limit(12);
        
        if (contentError) {
            console.error('Content fetch error:', contentError);
            section.style.display = 'none';
            return;
        }
        
        if (!contentList || contentList.length === 0) {
            console.log('ℹ️ No content from followed creators');
            section.style.display = 'none';
            return;
        }
        
        // 3️⃣ Build complete dataset with metrics
        const contentIds = contentList.map(c => c.id);
        const metrics = await fetchAllMetrics(contentIds, creatorIds);
        
        const sectionData = contentList.map(item => ({
            ...item,
            metrics: {
                views: metrics.views[item.id] || 0,
                likes: metrics.likes[item.id] || 0,
                shares: metrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: metrics.connectors[item.user_id] || 0
            }
        }));
        
        // 4️⃣ Render
        section.style.display = 'block';
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
        // Cache
        window.cacheManager?.set(cacheKey, sectionData, 5 * 60 * 1000);
        
        document.querySelectorAll('#following-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
        console.log('✅ Following section loaded:', sectionData.length, 'items');
        
    } catch (err) {
        console.error("❌ Following Section Error:", err);
        section.style.display = 'none';
    }
}

// ============================================
// SECTION 4: QUICK BITS (SHORTS)
// ============================================
async function loadShortsSection() {
    const container = document.getElementById('shorts-container');
    if (!container) return;
    
    try {
        // 1️⃣ Fetch short content - ✅ Explicitly select language
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .eq('media_type', 'short')
            .or('media_type.eq.short,duration.lte.60')
            .order('views_count', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList);
        
        // 3️⃣ Render shorts
        container.style.display = 'flex';
        renderShortsCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Shorts Section Error:", err);
    }
}

// Specialized renderer for shorts
function renderShortsCards(container, contents) {
    container.innerHTML = '';
    
    contents.forEach(content => {
        const thumbnailUrl = content.thumbnail_url
            ? fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const creatorName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
        const durationFormatted = formatDuration(content.duration || 0);
        
        const card = document.createElement('a');
        card.className = 'short-card';
        card.href = `shorts-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        
        card.innerHTML = `
            <div class="short-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';">
                <div class="short-overlay">
                    <i class="fas fa-play"></i>
                </div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="short-info">
                <h4>${truncateText(escapeHtml(content.title), 30)}</h4>
                <p>${escapeHtml(creatorName)}</p>
                <div class="connector-info-small">
                    <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics.connectors)}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// SECTION 5: COMMUNITY FAVORITES - FIXED
// ============================================
async function loadCommunityFavoritesSection() {
    const container = document.getElementById('community-favorites-grid');
    
    console.log('⭐ Loading Community Favorites...');
    
    if (!container) return;
    
    const cacheKey = 'feed_communityFavorites';
    
    // Try cached data
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        console.log('📦 Community Favorites: Using cached data,', cachedData.length, 'items');
        container.innerHTML = '';
        renderContentCards(container, cachedData);
        document.querySelectorAll('#community-favorites-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        return;
    }
    
    // Show skeletons
    container.innerHTML = Array(4).fill().map(() => `
        <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
        </div>
    `).join('');
    
    try {
        // Fetch by favorites_count
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .gt('favorites_count', 0)  // Only content with favorites
            .order('favorites_count', { ascending: false })
            .limit(12);
        
        if (error) {
            console.error('Community favorites fetch error:', error);
            throw error;
        }
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = '<div class="empty-state">No community favorites yet</div>';
            return;
        }
        
        // Get metrics
        const contentIds = contentList.map(c => c.id);
        const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
        const metrics = await fetchAllMetrics(contentIds, creatorIds);
        
        const sectionData = contentList.map(item => ({
            ...item,
            metrics: {
                views: metrics.views[item.id] || 0,
                likes: metrics.likes[item.id] || 0,
                shares: metrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: metrics.connectors[item.user_id] || 0
            }
        }));
        
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
        // Cache
        window.cacheManager?.set(cacheKey, sectionData, 5 * 60 * 1000);
        
        document.querySelectorAll('#community-favorites-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
        console.log('✅ Community Favorites loaded:', sectionData.length, 'items');
        
    } catch (err) {
        console.error("❌ Community Favorites Section Error:", err);
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-heart-broken"></i></div>
                <h3>Unable to load favorites</h3>
                <button class="see-all-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

// ============================================
// LIVE STREAMS SECTION
// ============================================
async function loadLiveStreamsSection() {
    const container = document.getElementById('live-streams-grid');
    const noLiveStreams = document.getElementById('no-live-streams');
    
    if (!container || !noLiveStreams) return;
    
    try {
        // 1️⃣ Fetch live streams - ✅ Explicitly select language
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('media_type', 'live')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.style.display = 'none';
            noLiveStreams.style.display = 'block';
            return;
        }
        
        // 2️⃣ Build complete dataset with metrics
        const sectionData = await buildSectionData(contentList);
        
        // 3️⃣ Render
        container.style.display = 'grid';
        noLiveStreams.style.display = 'none';
        container.innerHTML = '';
        renderContentCards(container, sectionData);
        
    } catch (err) {
        console.error("❌ Live Streams Section Error:", err);
    }
}

// ============================================
// SECTION 6: TRENDING NOW with Amplification Logic & Caching
// ============================================
async function loadTrendingSection() {
    const container = document.getElementById('trending-grid');
    if (!container) return;
    
    const cacheKey = 'feed_trending';
    
    // Show cached data instantly
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        container.innerHTML = '';
        renderContentCards(container, cachedData);
        document.querySelectorAll('#trending-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
    } else {
        container.innerHTML = Array(4).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
    }
    
    try {
        // ✅ SELECT only needed fields + LIMIT
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .order('views_count', { ascending: false })
            .limit(12); // ✅ ADDED LIMIT
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = `<div class="empty-state">No Trending Content</div>`;
            return;
        }
        
        // Build with metrics
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        const boostedData = applyAmplificationLogic(sectionData);
        boostedData.sort((a, b) => (b.amplification_score || 0) - (a.amplification_score || 0));
        
        container.innerHTML = '';
        renderContentCards(container, boostedData);
        
        // Cache
        window.cacheManager?.set(cacheKey, boostedData, 5 * 60 * 1000);
        
        document.querySelectorAll('#trending-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
    } catch (err) {
        console.error("❌ Trending Section Error:", err);
    }
}

// ============================================
// SECTION 7: LATEST GEMS (NEW CONTENT) with Amplification Logic & Caching
// ============================================
async function loadNewContentSection() {
    const container = document.getElementById('new-content-grid');
    if (!container) return;
    
    const cacheKey = 'feed_newContent';
    
    // Show cached data instantly
    const cachedData = window.cacheManager?.get(cacheKey);
    if (cachedData && cachedData.length > 0) {
        container.innerHTML = '';
        renderContentCards(container, cachedData);
        document.querySelectorAll('#new-content-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
    } else {
        container.innerHTML = Array(4).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
    }
    
    try {
        // ✅ SELECT only needed fields + LIMIT
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(12); // ✅ ADDED LIMIT
        
        if (error) throw error;
        
        if (!contentList || contentList.length === 0) {
            container.innerHTML = `<div class="empty-state">No New Content</div>`;
            return;
        }
        
        const sectionData = await buildSectionData(contentList.slice(0, 8));
        const boostedData = applyAmplificationLogic(sectionData);
        boostedData.sort((a, b) => (b.amplification_score || 0) - (a.amplification_score || 0));
        
        container.innerHTML = '';
        renderContentCards(container, boostedData);
        
        window.cacheManager?.set(cacheKey, boostedData, 5 * 60 * 1000);
        
        document.querySelectorAll('#new-content-grid .content-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 50);
        });
        
    } catch (err) {
        console.error("❌ New Content Section Error:", err);
    }
}

// ============================================
// FEATURED CREATORS SECTION
// ============================================
async function loadFeaturedCreatorsSection() {
    const creatorsList = document.getElementById('creators-list');
    if (!creatorsList) return;
    
    try {
        // Get content counts per creator
        const { data: contentData } = await supabaseAuth
            .from('Content')
            .select('user_id')
            .eq('status', 'published');
        
        const contentCountMap = new Map();
        contentData?.forEach(item => {
            if (item.user_id) {
                contentCountMap.set(item.user_id, (contentCountMap.get(item.user_id) || 0) + 1);
            }
        });
        
        // Get connector counts per creator
        const { data: connectorData } = await supabaseAuth
            .from('connectors')
            .select('connected_id')
            .eq('connection_type', 'creator');
        
        const connectorCountMap = new Map();
        connectorData?.forEach(item => {
            if (item.connected_id) {
                connectorCountMap.set(item.connected_id, (connectorCountMap.get(item.connected_id) || 0) + 1);
            }
        });
        
        // Calculate scores and get top creators
        const creatorScores = new Map();
        contentCountMap.forEach((count, userId) => {
            creatorScores.set(userId, (creatorScores.get(userId) || 0) + count * 2);
        });
        connectorCountMap.forEach((count, userId) => {
            creatorScores.set(userId, (creatorScores.get(userId) || 0) + count);
        });
        
        const sortedCreators = Array.from(creatorScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([userId]) => userId);
        
        if (sortedCreators.length === 0) {
            creatorsList.innerHTML = `
                <div class="swiper-slide">
                    <div class="creator-card">
                        <div class="empty-icon"><i class="fas fa-users"></i></div>
                        <h3>No Featured Creators</h3>
                        <p>Top creators will appear here</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Fetch creator profiles
        const { data: profiles } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .in('id', sortedCreators);
        
        const featuredCreators = profiles?.map(profile => ({
            ...profile,
            video_count: contentCountMap.get(profile.id) || 0,
            follower_count: connectorCountMap.get(profile.id) || 0
        })) || [];
        
        // Render creators
        renderCreatorsCards(creatorsList, featuredCreators);
        
    } catch (err) {
        console.error("❌ Featured Creators Section Error:", err);
    }
}

function renderCreatorsCards(container, creators) {
    container.innerHTML = creators.map(creator => {
        const avatarUrl = creator.avatar_url
            ? fixAvatarUrl(creator.avatar_url)
            : null;
        
        const bio = creator.bio || 'Passionate content creator sharing authentic stories and experiences.';
        const truncatedBio = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
        const fullName = creator.full_name || creator.username || 'Creator';
        const username = creator.username || 'creator';
        const initials = getInitials(fullName);
        const videoCount = creator.video_count || 0;
        const followerCount = creator.follower_count || 0;
        const isTopCreator = videoCount > 5 || followerCount > 100;
        
        return `
            <div class="swiper-slide">
                <div class="creator-card">
                    ${isTopCreator ? '<div class="founder-badge">TOP CREATOR</div>' : ''}
                    <div class="creator-avatar">
                        ${avatarUrl ? `
                            <img src="${avatarUrl}" alt="${fullName}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:2rem;\'>${initials}</div>';">
                        ` : `
                            <div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:2rem;">${initials}</div>
                        `}
                    </div>
                    <div class="creator-name">${fullName}</div>
                    <div class="creator-username">@${username}</div>
                    <div class="creator-bio">${escapeHtml(truncatedBio)}</div>
                    <div class="creator-stats">
                        <div class="stat">
                            <div class="stat-number">${videoCount}</div>
                            <div class="stat-label">Videos</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${formatNumber(followerCount)}</div>
                            <div class="stat-label">Connectors</div>
                        </div>
                    </div>
                    <div class="creator-actions">
                        <button class="view-channel-btn" onclick="window.location.href='creator-channel.html?id=${creator.id}'">
                            View Channel
                        </button>
                        <button class="tip-creator-btn" data-creator-id="${creator.id}" data-creator-name="${fullName}">
                            <i class="fas fa-gift"></i> Tip
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize Swiper after render
    setTimeout(() => {
        if (typeof Swiper !== 'undefined') {
            new Swiper('#creators-swiper', {
                slidesPerView: 1,
                spaceBetween: 20,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                breakpoints: {
                    640: { slidesPerView: 2 },
                    1024: { slidesPerView: 3 }
                }
            });
        }
    }, 100);
}

// ============================================
// EVENTS SECTION
// ============================================
async function loadEventsSection() {
    const eventsList = document.getElementById('events-list');
    const noEvents = document.getElementById('no-events');
    
    if (!eventsList || !noEvents) return;
    
    try {
        let data = [];
        
        try {
            const result = await supabaseAuth
                .from('events')
                .select('*')
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(5);
            
            data = result.data || [];
        } catch (e) {
            console.warn('Events table may not exist, using mock data');
            data = getMockEvents();
        }
        
        if (!data || data.length === 0) {
            eventsList.style.display = 'none';
            noEvents.style.display = 'block';
            return;
        }
        
        eventsList.style.display = 'block';
        noEvents.style.display = 'none';
        
        renderEventsCards(eventsList, data);
        
    } catch (err) {
        console.error("❌ Events Section Error:", err);
        
        const mockEvents = getMockEvents();
        if (mockEvents.length > 0) {
            eventsList.style.display = 'block';
            noEvents.style.display = 'none';
            renderEventsCards(eventsList, mockEvents);
        } else {
            eventsList.style.display = 'none';
            noEvents.style.display = 'block';
        }
    }
}

function renderEventsCards(container, events) {
    container.innerHTML = events.map(event => {
        const eventDate = new Date(event.start_time || event.time);
        const formattedDate = eventDate.toLocaleDateString('en-ZA', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="event-card">
                <div class="event-header">
                    <div>
                        <div class="event-title">${escapeHtml(event.title)}</div>
                        <div class="event-time">${formattedDate}</div>
                    </div>
                </div>
                <div class="event-description">${escapeHtml(event.description || '')}</div>
                <div class="event-actions">
                    <button class="reminder-btn" onclick="setReminder('${event.id}')">
                        <i class="fas fa-bell"></i> Set Reminder
                    </button>
                    ${event.tags ? `
                    <div class="event-tags">
                        ${event.tags.map(tag => `<span class="event-tag">${tag}</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CINEMATIC HERO SECTION - WITH ROTATION LOGIC
// ============================================

// ✅ HERO ROTATION STATE
let currentHeroContent = null;
let heroRotationInterval = null;
const HERO_ROTATION_HOURS = 4; // Change every 4 hours
const HERO_ROTATION_MS = HERO_ROTATION_HOURS * 60 * 60 * 1000;

async function loadCinematicHero() {
    console.log('🎬 Loading Cinematic Hero with rotation...');
    
    try {
        // Get all eligible content for hero rotation
        const { data: contentList, error } = await supabaseAuth
            .from('Content')
            .select('id, title, description, thumbnail_url, file_url, views_count, favorites_count, shares_count, language, created_at, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .not('file_url', 'is', null)  // Must have video file
            .order('views_count', { ascending: false })
            .limit(20);  // Get top 20 for rotation
        
        if (error) {
            console.error('Hero content fetch error:', error);
            showHeroPlaceholder();
            return;
        }
        
        if (!contentList || contentList.length === 0) {
            console.warn('No video content available for hero');
            showHeroPlaceholder();
            return;
        }
        
        // Store all content for rotation
        window.heroContentList = contentList;
        
        // Get last featured content from localStorage
        const lastFeaturedId = localStorage.getItem('hero_last_content_id');
        const lastFeaturedTime = localStorage.getItem('hero_last_update_time');
        const now = Date.now();
        
        let selectedContent = null;
        
        // Check if we need to rotate
        if (lastFeaturedId && lastFeaturedTime && (now - parseInt(lastFeaturedTime)) < HERO_ROTATION_MS) {
            // Use the same content if within rotation window
            selectedContent = contentList.find(c => c.id.toString() === lastFeaturedId);
            console.log('🎬 Using existing featured content (within rotation window)');
        }
        
        // If no valid saved content, pick a new one
        if (!selectedContent) {
            // Try to avoid showing the same content twice in a row
            const availableContent = contentList.filter(c => c.id.toString() !== lastFeaturedId);
            const randomIndex = Math.floor(Math.random() * (availableContent.length || contentList.length));
            selectedContent = (availableContent.length ? availableContent[randomIndex] : contentList[randomIndex]);
            
            // Save to localStorage
            localStorage.setItem('hero_last_content_id', selectedContent.id.toString());
            localStorage.setItem('hero_last_update_time', now.toString());
            
            console.log('🎬 Rotated to new featured content:', selectedContent.title);
        }
        
        // Set up rotation timer for next change
        if (heroRotationInterval) clearInterval(heroRotationInterval);
        heroRotationInterval = setInterval(() => {
            console.log('🔄 Hero rotation interval triggered');
            rotateHeroContent();
        }, HERO_ROTATION_MS);
        
        // Render the selected content
        await renderHeroContent(selectedContent);
        
    } catch (error) {
        console.error('❌ Error loading cinematic hero:', error);
        showHeroPlaceholder();
    }
}

// ✅ Rotate hero content
async function rotateHeroContent() {
    console.log('🔄 Rotating hero content...');
    
    if (!window.heroContentList || window.heroContentList.length === 0) {
        await loadCinematicHero();
        return;
    }
    
    const lastFeaturedId = localStorage.getItem('hero_last_content_id');
    
    // Pick a different content
    let availableContent = window.heroContentList.filter(c => c.id.toString() !== lastFeaturedId);
    if (availableContent.length === 0) {
        availableContent = window.heroContentList;
    }
    
    const randomIndex = Math.floor(Math.random() * availableContent.length);
    const newContent = availableContent[randomIndex];
    
    // Update localStorage
    localStorage.setItem('hero_last_content_id', newContent.id.toString());
    localStorage.setItem('hero_last_update_time', Date.now().toString());
    
    // Animate out and in
    const heroSection = document.querySelector('.cinematic-hero');
    if (heroSection) {
        heroSection.style.opacity = '0';
        heroSection.style.transition = 'opacity 0.5s ease';
        
        setTimeout(async () => {
            await renderHeroContent(newContent);
            heroSection.style.opacity = '1';
        }, 500);
    } else {
        await renderHeroContent(newContent);
    }
    
    console.log('🔄 Hero rotated to:', newContent.title);
}

// ✅ Render hero content (separated for rotation)
async function renderHeroContent(content) {
    if (!content) {
        console.error('No content to render in hero');
        return;
    }
    
    console.log('🎬 Rendering hero content:', content.title);
    
    // 1. Handle Background Video
    const heroVideo = document.getElementById('hero-background-video');
    const videoSource = heroVideo?.querySelector('source');
    
    if (heroVideo && videoSource && content.file_url) {
        const videoUrl = fixMediaUrl(content.file_url);
        console.log('🎬 Loading video:', videoUrl);
        
        // Reset video
        heroVideo.pause();
        videoSource.src = videoUrl;
        heroVideo.load();
        
        // Attempt to play with sound muted (autoplay policy)
        const playPromise = heroVideo.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ Hero video playing');
                // Try to unmute after user interaction
                const audioControl = document.getElementById('hero-audio-control');
                if (audioControl) {
                    audioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    audioControl.title = 'Unmute';
                }
            }).catch(error => {
                console.log('Video autoplay prevented:', error);
                // Show play button overlay
                showVideoPlayButton();
            });
        }
        
        // Handle video errors
        heroVideo.onerror = () => {
            console.error('Video failed to load:', videoUrl);
            // Fallback to thumbnail
            if (content.thumbnail_url) {
                const thumbnailUrl = fixMediaUrl(content.thumbnail_url);
                heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
                heroVideo.style.backgroundSize = 'cover';
                heroVideo.style.backgroundPosition = 'center';
                heroVideo.style.backgroundColor = '#000';
            }
        };
        
        // Video loaded successfully
        heroVideo.oncanplay = () => {
            console.log('✅ Hero video can play');
            heroVideo.style.opacity = '1';
        };
    } else if (heroVideo && content.thumbnail_url) {
        // Fallback to thumbnail as background
        const thumbnailUrl = fixMediaUrl(content.thumbnail_url);
        heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
        heroVideo.style.backgroundSize = 'cover';
        heroVideo.style.backgroundPosition = 'center';
        console.log('🎬 Using thumbnail as background');
    }
    
    // 2. Update Creator Info
    const creator = content.user_profiles;
    const creatorNameElem = document.getElementById('hero-creator-name');
    const creatorBadge = document.getElementById('hero-creator-badge');
    const avatarContainer = document.getElementById('hero-creator-avatar');
    const avatarImg = document.getElementById('hero-creator-avatar-img');
    
    if (creator && creatorNameElem) {
        const displayName = creator.full_name || creator.username || 'Featured Creator';
        creatorNameElem.textContent = displayName;
        
        // Handle avatar
        if (avatarContainer) {
            // Clear existing content
            avatarContainer.innerHTML = '';
            
            if (creator.avatar_url) {
                const avatarUrl = fixAvatarUrl(creator.avatar_url);
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = displayName;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = () => {
                    // Fallback to initials
                    avatarContainer.innerHTML = '';
                    const initials = getInitials(displayName);
                    const initialsSpan = document.createElement('span');
                    initialsSpan.className = 'hero-creator-initials';
                    initialsSpan.textContent = initials;
                    avatarContainer.appendChild(initialsSpan);
                };
                avatarContainer.appendChild(img);
            } else {
                const initials = getInitials(displayName);
                const initialsSpan = document.createElement('span');
                initialsSpan.className = 'hero-creator-initials';
                initialsSpan.textContent = initials;
                avatarContainer.appendChild(initialsSpan);
            }
        }
        
        // Show trending badge
        const trendingBadge = document.getElementById('hero-trending-text');
        if (trendingBadge) {
            trendingBadge.textContent = 'Trending ↑ 24h';
        }
    }
    
    // 3. Update Title and Description
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    
    if (heroTitle) {
        heroTitle.textContent = content.title || 'DISCOVER & CONNECT';
        heroTitle.style.opacity = '0';
        heroTitle.style.transform = 'translateY(20px)';
        setTimeout(() => {
            heroTitle.style.opacity = '1';
            heroTitle.style.transform = 'translateY(0)';
            heroTitle.style.transition = 'all 0.5s ease';
        }, 100);
    }
    
    if (heroSubtitle) {
        heroSubtitle.textContent = content.description || 'Explore amazing content from across Africa';
        heroSubtitle.style.opacity = '0';
        heroSubtitle.style.transform = 'translateY(20px)';
        setTimeout(() => {
            heroSubtitle.style.opacity = '1';
            heroSubtitle.style.transform = 'translateY(0)';
            heroSubtitle.style.transition = 'all 0.5s ease 0.1s';
        }, 150);
    }
    
    // 4. Update Metrics
    const metrics = await fetchAllMetrics([content.id], creator ? [creator.id] : []);
    
    const viewsElem = document.getElementById('hero-views');
    const favoritesElem = document.getElementById('hero-favorites');
    const connectorsElem = document.getElementById('hero-connectors');
    const sharesElem = document.getElementById('hero-shares');
    
    if (viewsElem) viewsElem.textContent = formatNumber(metrics.views[content.id] || content.views_count || 0);
    if (favoritesElem) favoritesElem.textContent = formatNumber(content.favorites_count || 0);
    if (connectorsElem && creator) connectorsElem.textContent = formatNumber(metrics.connectors[creator.id] || 0);
    if (sharesElem) sharesElem.textContent = formatNumber(metrics.shares[content.id] || content.shares_count || 0);
    
    // 5. Update Verified Badge
    const verifiedBadge = document.getElementById('hero-verified-badge');
    if (verifiedBadge && creator) {
        const connectorCount = metrics.connectors[creator.id] || 0;
        verifiedBadge.style.display = connectorCount > 1000 ? 'inline-flex' : 'none';
    }
    
    // 6. Store current content ID for watch button
    const heroWatchBtn = document.getElementById('hero-watch-btn');
    if (heroWatchBtn) {
        heroWatchBtn.dataset.contentId = content.id;
        heroWatchBtn.dataset.creatorId = creator?.id;
    }
    
    // 7. Update audio control
    setupHeroAudioControl(heroVideo);
    
    // 8. Setup buttons
    setupHeroButtons();
    
    console.log('✅ Hero content rendered successfully');
}

// ✅ Show video play button overlay
function showVideoPlayButton() {
    const heroSection = document.querySelector('.cinematic-hero');
    if (!heroSection) return;
    
    // Check if play button already exists
    if (heroSection.querySelector('.hero-video-play-btn')) return;
    
    const playBtn = document.createElement('button');
    playBtn.className = 'hero-video-play-btn';
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    playBtn.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(245, 158, 11, 0.9);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    `;
    
    playBtn.onclick = () => {
        const heroVideo = document.getElementById('hero-background-video');
        if (heroVideo) {
            heroVideo.play();
            playBtn.remove();
        }
    };
    
    heroSection.appendChild(playBtn);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (playBtn.parentNode) playBtn.remove();
    }, 5000);
}

// ✅ Setup hero audio control
function setupHeroAudioControl(heroVideo) {
    const audioControl = document.getElementById('hero-audio-control');
    if (!audioControl || !heroVideo) return;
    
    // Remove existing listener by cloning
    const newControl = audioControl.cloneNode(true);
    audioControl.parentNode.replaceChild(newControl, audioControl);
    
    let isMuted = true;
    heroVideo.muted = true;
    newControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
    
    newControl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isMuted = !isMuted;
        heroVideo.muted = isMuted;
        
        if (isMuted) {
            newControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
            newControl.title = 'Unmute';
        } else {
            newControl.innerHTML = '<i class="fas fa-volume-up"></i>';
            newControl.title = 'Mute';
            
            // Try to play if paused
            if (heroVideo.paused) {
                heroVideo.play().catch(console.log);
            }
        }
    });
}

// ✅ Show placeholder when no content exists
function showHeroPlaceholder() {
    console.log('🎬 Showing hero placeholder');
    
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    
    if (heroTitle) heroTitle.textContent = 'WELCOME TO BANTU STREAM CONNECT';
    if (heroSubtitle) heroSubtitle.textContent = 'No content yet. Be the first to upload and share your story!';
    
    // Show upload CTA
    const heroActions = document.querySelector('.hero-actions');
    if (heroActions && !heroActions.querySelector('.hero-upload-btn')) {
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'hero-primary-btn';
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Content';
        uploadBtn.onclick = () => {
            if (window.currentUser) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to upload content', 'warning');
                window.location.href = 'login.html';
            }
        };
        heroActions.appendChild(uploadBtn);
    }
}

// ============================================
// COMMUNITY STATS
// ============================================
async function loadCommunityStats() {
    try {
        const { count: connectorsCount } = await supabaseAuth
            .from('connectors')
            .select('*', { count: 'exact', head: true });
        
        const { count: contentCount } = await supabaseAuth
            .from('Content')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: newConnectors } = await supabaseAuth
            .from('connectors')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());
        
        document.getElementById('total-connectors').textContent = formatNumber(connectorsCount || 12500);
        document.getElementById('total-content').textContent = formatNumber(contentCount || 2300);
        document.getElementById('new-connectors').textContent = `+${formatNumber(newConnectors || 342)}`;
    } catch (error) {
        console.error('Error loading community stats:', error);
        document.getElementById('total-connectors').textContent = '12.5K';
        document.getElementById('total-content').textContent = '2.3K';
        document.getElementById('new-connectors').textContent = '+342';
    }
}

// ============================================
// PURE RENDER FUNCTION - WITH ENHANCED IMAGE HANDLING
// ============================================
function renderContentCards(container, contents) {
    if (!container || !contents || contents.length === 0) return;
    
    const fragment = document.createDocumentFragment();
    
    contents.forEach(content => {
        if (!content) return;
        
        const thumbnailUrl = content.thumbnail_url
            ? fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
        const initials = getInitials(displayName);
        const username = creatorProfile?.username || 'creator';
        const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
        const durationFormatted = formatDuration(content.duration || 0);
        
        // Generate avatar HTML with error handling
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
            avatarHtml = `
                <div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;">
                    <img src="${avatarUrl}" 
                         alt="${escapeHtml(displayName)}" 
                         loading="lazy"
                         style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">
                </div>
            `;
        } else {
            avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
        }
        
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = `content-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" 
                     alt="${escapeHtml(content.title)}" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                <div class="card-badges">
                    ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                    <div class="connector-badge"><i class="fas fa-star"></i><span>${formatNumber(content.metrics?.favorites || 0)} Favorites</span></div>
                </div>
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                <div class="creator-info">
                    <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                    <div class="creator-name-small">@${escapeHtml(username)}</div>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                    <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                    <span><i class="fas fa-language"></i> ${window.languageMap[content.language] || 'English'}</span>
                </div>
                <div class="connector-info">
                    <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

// ============================================
// FETCH ALL METRICS HELPER
// ============================================
async function fetchAllMetrics(contentIds, creatorIds) {
    const [views, likes, shares, connectors] = await Promise.all([
        fetchViewCounts(contentIds),
        fetchLikeCounts(contentIds),
        fetchShareCounts(contentIds),
        fetchConnectorCounts(creatorIds)
    ]);
    
    return { views, likes, shares, connectors };
}

// ============================================
// MOCK DATA FUNCTIONS (Fallbacks)
// ============================================
function getMockHeroContent() {
    return {
        id: 1,
        title: 'African Music Festival 2025',
        description: 'Experience the rhythm of Africa with live performances from top artists across the continent.',
        views_count: 15420,
        favorites_count: 3450,
        shares_count: 1200,
        file_url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-playing-the-saxophone-4864-large.mp4',
        language: 'en',
        user_profiles: {
            id: 'creator-1',
            full_name: 'AfroBeats Official',
            username: 'afrobeats',
            avatar_url: null
        }
    };
}

function loadMockHeroContent() {
    const mock = getMockHeroContent();
    
    document.getElementById('hero-creator-name').textContent = mock.user_profiles.full_name;
    document.getElementById('hero-title').textContent = mock.title;
    document.getElementById('hero-subtitle').textContent = mock.description;
    document.getElementById('hero-views').textContent = formatNumber(mock.views_count);
    document.getElementById('hero-favorites').textContent = formatNumber(mock.favorites_count);
    document.getElementById('hero-connectors').textContent = '1.2K';
    document.getElementById('hero-shares').textContent = formatNumber(mock.shares_count);
    
    const heroVideo = document.getElementById('hero-background-video');
    const videoSource = heroVideo?.querySelector('source');
    if (heroVideo && videoSource) {
        videoSource.src = mock.file_url;
        heroVideo.load();
    }
}

function getMockEvents() {
    return [
        {
            id: 1,
            title: 'African Music Festival Live Stream',
            description: 'Join us for the biggest African music festival with live performances from top artists across the continent.',
            time: 'Tomorrow 7:00 PM SAST',
            tags: ['Music', 'Live', 'Festival']
        },
        {
            id: 2,
            title: 'Tech Startup Pitch Competition',
            description: 'Watch innovative African startups pitch their ideas to a panel of investors.',
            time: 'Friday 3:00 PM WAT',
            tags: ['Technology', 'Startups', 'Business']
        },
        {
            id: 3,
            title: 'Cooking Masterclass: Traditional Dishes',
            description: 'Learn to cook authentic African dishes with master chefs.',
            time: 'Saturday 2:00 PM EAT',
            tags: ['Food', 'Cooking', 'Education']
        }
    ];
}

window.setReminder = function(eventId) {
    showToast('Reminder set for this event!', 'success');
};

function setupHeroButtons() {
    const exploreBtn = document.getElementById('hero-explore-btn');
    const watchBtn = document.getElementById('hero-watch-btn');
    const audioControl = document.getElementById('hero-audio-control');
    const heroVideo = document.getElementById('hero-background-video');
    
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            window.location.href = 'https://bantustreamconnect.com/content-library';
        });
    }
    
    if (watchBtn && heroVideo) {
        watchBtn.addEventListener('click', () => {
            const contentId = watchBtn.dataset.contentId;
            if (contentId) {
                window.location.href = `content-detail.html?id=${contentId}`;
            } else {
                window.location.href = 'https://bantustreamconnect.com/trending_screen';
            }
        });
    }
    
    if (audioControl && heroVideo) {
        audioControl.addEventListener('click', () => {
            heroVideo.muted = !heroVideo.muted;
            audioControl.innerHTML = heroVideo.muted ? 
                '<i class="fas fa-volume-mute"></i>' : 
                '<i class="fas fa-volume-up"></i>';
            audioControl.title = heroVideo.muted ? 'Unmute' : 'Mute';
        });
    }
}

// ============================================
// AUTHENTICATION & PROFILE FUNCTIONS
// ============================================
async function checkAuth() {
    const startTime = performance.now();
    try {
        const { data, error } = await supabaseAuth.auth.getSession();
        if (error) throw error;
        
        const session = data?.session;
        window.currentUser = session?.user || null;
        
        const authTime = performance.now() - startTime;
        console.log(`🔐 Auth check completed in ${authTime.toFixed(0)}ms`);
        
        if (window.currentUser) {
            console.log('✅ User authenticated:', window.currentUser.email);
            // Don't await profile load - do it in background
            loadUserProfile().catch(console.warn);
        } else {
            console.log('⚠️ User not authenticated');
        }
        
        return window.currentUser;
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

async function loadUserProfile() {
    try {
        if (!window.currentUser) return;
        
        const { data: profile, error } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id)
            .maybeSingle();
        
        if (error) {
            console.warn('Profile fetch error:', error);
            return;
        }
        
        if (profile) {
            window.currentProfile = profile;
        }
        
        await loadNotifications();
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadUserProfiles() {
    if (!window.currentUser) return;
    
    try {
        const { data, error } = await supabaseAuth
            .from('user_profiles')
            .select('*')
            .eq('id', window.currentUser.id);
        
        if (error) {
            console.warn('Error loading profiles, using default:', error);
            window.userProfiles = [{
                id: window.currentUser.id,
                name: window.currentUser.user_metadata?.full_name || 'Default',
                avatar_url: null
            }];
        } else {
            window.userProfiles = data || [];
        }
        
        if (window.userProfiles.length === 0) {
            window.userProfiles = [{
                id: window.currentUser.id,
                name: window.currentUser.user_metadata?.full_name || 'Default',
                avatar_url: null
            }];
        }
        
        const savedProfileId = localStorage.getItem('currentProfileId');
        window.currentProfile = window.userProfiles.find(p => p.id === savedProfileId) || window.userProfiles[0];
        
        updateProfileSwitcher();
    } catch (error) {
        console.error('Error loading profiles:', error);
    }
}

// ============================================
// PROFILE AVATAR HELPER FUNCTIONS (FIXED)
// ============================================

/**
 * Fix Media URL - Handles all Supabase storage paths
 * @param {string} url - The URL from database
 * @returns {string} Properly formatted URL
 */
function fixMediaUrl(url) {
    if (!url) return '';
    
    // Already a valid full URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // Check if it's a working Supabase URL
        if (url.includes('supabase.co/storage/v1/object/public')) {
            return url;
        }
        // If it's a different domain, return as-is
        return url;
    }
    
    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
    
    // Remove leading slashes
    let cleanPath = url.replace(/^\/+/, '');
    
    // Handle different path formats
    if (cleanPath.includes('storage/v1/object/public')) {
        // Already has storage path, just prepend domain if needed
        return cleanPath.startsWith('http') ? cleanPath : `${SUPABASE_URL}/${cleanPath}`;
    }
    
    // Determine bucket type based on path or content type
    let bucket = 'content'; // default bucket
    if (cleanPath.includes('avatar') || cleanPath.includes('profile')) {
        bucket = 'avatars';
    } else if (cleanPath.includes('thumbnail') || cleanPath.includes('thumb')) {
        bucket = 'thumbnails';
    } else if (cleanPath.includes('video') || cleanPath.includes('content')) {
        bucket = 'content';
    }
    
    // Construct full URL
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Fix Avatar URL - Handles all edge cases for consistent loading
 * @param {string} url - The avatar URL from database
 * @returns {string} Properly formatted URL
 */
function fixAvatarUrl(url) {
    if (!url) return '';
    
    // Already a full URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        if (url.includes('supabase.co')) return url;
        return url;
    }
    
    const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
    
    // Remove leading slashes and common prefixes
    let cleanPath = url.replace(/^\/+/, '')
                       .replace(/^avatars\//, '')
                       .replace(/^user_avatars\//, '')
                       .replace(/^profile_pictures\//, '');
    
    // Use avatars bucket
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${cleanPath}`;
}

/**
 * Render initials profile (fallback when no avatar)
 * @param {HTMLElement} container - Container element
 * @param {Object} profile - Profile object with name/username
 */
function renderInitialsProfile(container, profile) {
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

/**
 * Render fallback profile (error state)
 * @param {HTMLElement} container - Container element
 * @param {HTMLElement} nameElement - Name element to update
 * @param {Object} user - User object
 */
function renderFallbackProfile(container, nameElement, user) {
    if (!container) return;
    container.innerHTML = '';
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
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
    `;
    div.textContent = initials;
    container.appendChild(div);
    
    if (nameElement) {
        nameElement.textContent = name;
    }
}

/**
 * Render guest profile
 * @param {HTMLElement} container - Container element
 * @param {HTMLElement} nameElement - Name element to update
 */
function renderGuestProfile(container, nameElement) {
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

/**
 * Render sidebar initials fallback
 * @param {HTMLElement} container - Container element
 * @param {Object} profile - Profile object
 */
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

/**
 * Render sidebar fallback profile (error state)
 * @param {HTMLElement} avatar - Avatar container
 * @param {HTMLElement} name - Name element
 * @param {HTMLElement} email - Email element
 * @param {Object} user - User object
 */
function renderSidebarFallback(avatar, name, email, user) {
    if (!avatar) return;
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const initials = getInitials(displayName);
    
    if (name) name.textContent = displayName;
    if (email) email.textContent = user?.email || 'Signed in';
    
    avatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;color:var(--soft-white);">${initials}</span>`;
}

// ============================================
// UPDATED HEADER PROFILE FUNCTION (FIXED)
// ============================================
async function updateHeaderProfile() {
    try {
        const profilePlaceholder = document.getElementById('userProfilePlaceholder');
        const currentProfileName = document.getElementById('current-profile-name');
        
        if (!profilePlaceholder || !currentProfileName) {
            console.warn('⚠️ Profile elements not found in header');
            return;
        }

        // Clear existing content first
        profilePlaceholder.innerHTML = '';

        if (window.currentUser) {
            console.log('👤 Updating header profile for:', window.currentUser.email);
            
            try {
                // Fetch profile with explicit fields
                const { data: profile, error } = await supabaseAuth
                    .from('user_profiles')
                    .select('id, full_name, username, avatar_url')
                    .eq('id', window.currentUser.id)
                    .maybeSingle();
                
                if (error) {
                    console.warn('⚠️ Profile fetch error:', error.message);
                    renderFallbackProfile(profilePlaceholder, currentProfileName, window.currentUser);
                    return;
                }

                if (profile && profile.avatar_url) {
                    // Fix the media URL properly
                    const avatarUrl = fixAvatarUrl(profile.avatar_url);
                    console.log('🖼️ Avatar URL:', avatarUrl);
                    
                    // Create image with error handling
                    const img = document.createElement('img');
                    img.className = 'profile-img';
                    img.src = avatarUrl;
                    img.alt = profile.full_name || profile.username || 'Profile';
                    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
                    
                    // Handle image load errors
                    img.onerror = function() {
                        console.warn('⚠️ Failed to load avatar, falling back to initials');
                        renderInitialsProfile(profilePlaceholder, profile);
                    };
                    
                    img.onload = function() {
                        console.log('✅ Avatar loaded successfully');
                    };
                    
                    profilePlaceholder.appendChild(img);
                    currentProfileName.textContent = profile.full_name || profile.username || window.currentUser.email?.split('@')[0] || 'User';
                    
                } else {
                    // No avatar - show initials
                    renderInitialsProfile(profilePlaceholder, profile || { full_name: window.currentUser.user_metadata?.full_name });
                    currentProfileName.textContent = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
                }
                
            } catch (fetchError) {
                console.error('❌ Profile fetch exception:', fetchError);
                renderFallbackProfile(profilePlaceholder, currentProfileName, window.currentUser);
            }
            
        } else {
            // Guest user
            renderGuestProfile(profilePlaceholder, currentProfileName);
        }
        
    } catch (error) {
        console.error('❌ updateHeaderProfile error:', error);
        const placeholder = document.getElementById('userProfilePlaceholder');
        const nameEl = document.getElementById('current-profile-name');
        if (placeholder && nameEl) {
            renderFallbackProfile(placeholder, nameEl, window.currentUser);
        }
    }
}

// ============================================
// UPDATED SIDEBAR PROFILE FUNCTION (FIXED - SPLIT AVATAR)
// ============================================
async function updateSidebarProfile() {
    const avatar = document.getElementById('sidebar-profile-avatar');
    const name = document.getElementById('sidebar-profile-name');
    const email = document.getElementById('sidebar-profile-email');
    const profileSection = document.getElementById('sidebar-profile');
    
    console.log('👤 Updating sidebar profile, logged in:', !!window.currentUser);
    
    if (!avatar || !name || !email) {
        console.warn('⚠️ Sidebar profile elements not found');
        return;
    }

    // Clear existing avatar content
    avatar.innerHTML = '';
    
    // Reset any inline styles that might cause issues
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';

    if (window.currentUser) {
        console.log('👤 Updating sidebar profile for:', window.currentUser.email);
        
        try {
            const { data: profile, error } = await supabaseAuth
                .from('user_profiles')
                .select('id, full_name, username, avatar_url')
                .eq('id', window.currentUser.id)
                .maybeSingle();
            
            if (error) {
                console.warn('⚠️ Sidebar profile fetch error:', error.message);
                renderSidebarInitials(avatar, { full_name: window.currentUser.user_metadata?.full_name || 'User' });
                name.textContent = window.currentUser.user_metadata?.full_name || window.currentUser.email?.split('@')[0] || 'User';
                email.textContent = window.currentUser.email || 'Signed in';
                return;
            }

            if (profile) {
                // Update name and email
                const displayName = profile.full_name || profile.username || 'User';
                name.textContent = displayName;
                email.textContent = window.currentUser.email || 'Signed in';
                
                // Handle avatar
                if (profile.avatar_url) {
                    const avatarUrl = fixAvatarUrl(profile.avatar_url);
                    console.log('🖼️ Sidebar avatar URL:', avatarUrl);
                    
                    // Create image with proper styling
                    const img = document.createElement('img');
                    img.src = avatarUrl;
                    img.alt = displayName;
                    img.style.cssText = `
                        width: 100% !important;
                        height: 100% !important;
                        min-width: 100% !important;
                        min-height: 100% !important;
                        object-fit: cover !important;
                        object-position: center center !important;
                        border-radius: 50% !important;
                        display: block !important;
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                    `;
                    
                    // Clear and set up container for absolute positioning
                    avatar.style.position = 'relative';
                    avatar.innerHTML = '';
                    avatar.appendChild(img);
                    
                    // Handle image load error
                    img.onerror = () => {
                        console.warn('⚠️ Sidebar avatar failed to load:', avatarUrl);
                        avatar.innerHTML = '';
                        renderSidebarInitials(avatar, profile);
                    };
                    
                    img.onload = () => {
                        console.log('✅ Sidebar avatar loaded successfully');
                    };
                } else {
                    renderSidebarInitials(avatar, profile);
                }
                
                // Make profile section clickable
                if (profileSection) {
                    profileSection.onclick = (e) => {
                        e.preventDefault();
                        const sidebarClose = document.getElementById('sidebar-close');
                        if (sidebarClose) sidebarClose.click();
                        window.location.href = 'manage-profiles.html';
                    };
                }
                
            } else {
                renderSidebarInitials(avatar, { full_name: window.currentUser.user_metadata?.full_name || 'User' });
                name.textContent = window.currentUser.user_metadata?.full_name || window.currentUser.email?.split('@')[0] || 'User';
                email.textContent = window.currentUser.email || 'Signed in';
            }
            
        } catch (err) {
            console.error('❌ Sidebar profile error:', err);
            renderSidebarInitials(avatar, { full_name: 'User' });
            name.textContent = 'User';
            email.textContent = window.currentUser.email || 'Signed in';
        }
        
    } else {
        // Guest state
        console.log('👤 Setting sidebar to guest mode');
        name.textContent = 'Guest';
        email.textContent = 'Sign in to continue';
        
        // Create a nice guest icon
        const guestIcon = document.createElement('i');
        guestIcon.className = 'fas fa-user';
        guestIcon.style.cssText = `
            font-size: calc(1.3rem * var(--ui-scale));
            color: var(--soft-white);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        `;
        avatar.appendChild(guestIcon);
        
        if (profileSection) {
            profileSection.onclick = (e) => {
                e.preventDefault();
                const sidebarClose = document.getElementById('sidebar-close');
                if (sidebarClose) sidebarClose.click();
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
}

// ============================================
// SIDEBAR SETUP
// ============================================
function setupSidebar() {
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
    
    updateSidebarProfile(); // Using the fixed version
    setupSidebarNavigation();
    setupSidebarThemeToggle(); // ✅ Enhanced version
    setupSidebarScaleControls();
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
        const { data } = await supabaseAuth.auth.getSession();
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
        const { data } = await supabaseAuth.auth.getSession();
        if (!data?.session) {
            showToast('Please sign in to access dashboard', 'warning');
            window.location.href = `login.html?redirect=creator-dashboard.html`;
        } else {
            window.location.href = 'creator-dashboard.html';
        }
    });
    
    // ✅ Watch History
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

function setupSidebarScaleControls() {
    if (!window.uiScaleController) return;
    
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');
    
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

// ============================================
// BOTTOM NAVIGATION BUTTONS
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
            const { data } = await supabaseAuth.auth.getSession();
            if (data?.session) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = 'login.html?redirect=creator-upload.html';
            }
        });
    }
    
    // ✅ Watch History navigation
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

// ============================================
// LANGUAGE FILTER
// ============================================
function setupLanguageFilter() {
    const languageChips = document.querySelectorAll('.language-chip');
    const moreLanguagesBtn = document.getElementById('more-languages-btn');
    
    languageChips.forEach(chip => {
        const newChip = chip.cloneNode(true);
        chip.parentNode.replaceChild(newChip, chip);
        
        newChip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
            newChip.classList.add('active');
            
            const selectedLang = newChip.dataset.lang;
            filterContentByLanguage(selectedLang);
            
            const langName = getLanguageName(selectedLang);
            showToast(`Showing: ${langName}`, 'info');
        });
    });
    
    if (moreLanguagesBtn) {
        const newMoreBtn = moreLanguagesBtn.cloneNode(true);
        moreLanguagesBtn.parentNode.replaceChild(newMoreBtn, moreLanguagesBtn);
        
        newMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const languageContainer = document.querySelector('.language-chips');
            const hiddenLanguages = ['nr', 'ss', 've', 'ts'];
            
            hiddenLanguages.forEach(lang => {
                if (!document.querySelector(`.language-chip[data-lang="${lang}"]`)) {
                    const newChip = document.createElement('button');
                    newChip.className = 'language-chip';
                    newChip.dataset.lang = lang;
                    newChip.textContent = window.languageMap[lang] || lang;
                    
                    newChip.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
                        newChip.classList.add('active');
                        filterContentByLanguage(lang);
                        showToast(`Showing: ${window.languageMap[lang]}`, 'info');
                    });
                    
                    languageContainer.insertBefore(newChip, newMoreBtn);
                }
            });
            
            newMoreBtn.style.display = 'none';
            showToast('All languages shown', 'info');
        });
    }
    
    const defaultChip = document.querySelector('.language-chip[data-lang="all"]');
    if (defaultChip) {
        defaultChip.classList.add('active');
    }
}

function getLanguageName(code) {
    return window.languageMap[code] || code || 'All Languages';
}

function filterContentByLanguage(lang) {
    const contentCards = document.querySelectorAll('.content-card');
    let visibleCount = 0;
    
    contentCards.forEach(card => {
        const contentLang = card.dataset.language || 'en';
        
        if (lang === 'all' || contentLang === lang) {
            card.style.display = 'block';
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50);
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    if (visibleCount === 0 && lang !== 'all') {
        showToast(`No content in ${getLanguageName(lang)} yet`, 'warning');
    }
}

// ============================================
// SEARCH - FIXED VERSION
// ============================================
function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    const searchResultsGrid = document.getElementById('search-results-grid');
    
    console.log('🔍 Search Setup - Btn:', !!searchBtn, 'Modal:', !!searchModal, 'Input:', !!searchInput, 'Grid:', !!searchResultsGrid);
    
    if (!searchBtn || !searchModal || !searchInput) {
        console.error('❌ Search elements not found!');
        return;
    }
    
    // Open search modal
    searchBtn.addEventListener('click', () => {
        console.log('🔍 Search button clicked');
        searchModal.classList.add('active');
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    });
    
    // Close search modal
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            console.log('🔍 Search close clicked');
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            if (searchResultsGrid) searchResultsGrid.innerHTML = '';
        });
    }
    
    // Close on backdrop click
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            if (searchResultsGrid) searchResultsGrid.innerHTML = '';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal.classList.contains('active')) {
            searchModal.classList.remove('active');
            if (searchInput) searchInput.value = '';
            if (searchResultsGrid) searchResultsGrid.innerHTML = '';
        }
    });
    
    // Search input with debounce
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const category = document.getElementById('category-filter')?.value || '';
            const sortBy = document.getElementById('sort-filter')?.value || 'newest';
            const language = document.getElementById('language-filter')?.value || '';
            
            console.log('🔍 Search input:', query, 'Category:', category, 'Sort:', sortBy, 'Language:', language);
            
            if (!searchResultsGrid) return;
            
            if (query.length < 2) {
                searchResultsGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-icon"><i class="fas fa-search"></i></div>
                        <h3>Start Typing</h3>
                        <p>Enter at least 2 characters to search</p>
                    </div>
                `;
                return;
            }
            
            // Show loading state
            searchResultsGrid.innerHTML = `
                <div class="infinite-scroll-loading" style="grid-column: 1 / -1;">
                    <div class="infinite-scroll-spinner"></div>
                    <div>Searching...</div>
                </div>
            `;
            
            try {
                const results = await searchContent(query, category, sortBy, language);
                console.log('🔍 Search results:', results.length);
                renderSearchResults(results, query);
            } catch (error) {
                console.error('❌ Search error:', error);
                searchResultsGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <h3>Search Error</h3>
                        <p>Failed to load results. Please try again.</p>
                        <button class="see-all-btn" onclick="document.getElementById('search-input').dispatchEvent(new Event('input'))">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                `;
            }
        }, 500)); // Increased debounce to 500ms for better performance
    }
    
    // Filter change handlers
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const languageFilter = document.getElementById('language-filter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            console.log('🔍 Category filter changed');
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }
    
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            console.log('🔍 Sort filter changed');
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }
    
    if (languageFilter) {
        languageFilter.addEventListener('change', () => {
            console.log('🔍 Language filter changed');
            if (searchInput && searchInput.value.trim().length >= 2) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }
    
    // Keyboard shortcut (Ctrl+K)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchModal.classList.add('active');
            setTimeout(() => searchInput?.focus(), 300);
        }
    });
    
    console.log('✅ Search setup complete');
}

// ============================================
// SEARCH CONTENT - FIXED VERSION
// ============================================
async function searchContent(query, category = '', sortBy = 'newest', language = '') {
    console.log('🔍 Searching:', query, 'Category:', category, 'Sort:', sortBy, 'Language:', language);
    
    try {
        // Build search query with proper Supabase syntax
        let queryBuilder = supabaseAuth
            .from('Content')
            .select(`
                id, title, description, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published');
        
        // Search by title OR description (using or condition)
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
        
        // Apply category filter
        if (category && category !== '' && category !== 'all') {
            queryBuilder = queryBuilder.eq('genre', category);
            console.log('🔍 Filtering by category:', category);
        }
        
        // Apply language filter
        if (language && language !== '' && language !== 'all') {
            queryBuilder = queryBuilder.eq('language', language);
            console.log('🔍 Filtering by language:', language);
        }
        
        // Execute query
        const { data, error } = await queryBuilder.limit(50);
        
        if (error) {
            console.error('❌ Search query error:', error);
            throw error;
        }
        
        console.log('🔍 Raw search results:', data?.length || 0);
        
        let results = data || [];
        
        // Enrich results with metrics if we have results
        if (results.length > 0) {
            const contentIds = results.map(r => r.id);
            const creatorIds = [...new Set(results.map(r => r.user_id).filter(Boolean))];
            
            console.log('🔍 Fetching metrics for', contentIds.length, 'content items');
            
            const metrics = await fetchAllMetrics(contentIds, creatorIds);
            
            // Enrich results with metrics
            results = results.map(item => ({
                ...item,
                metrics: {
                    views: metrics.views[item.id] || 0,
                    likes: metrics.likes[item.id] || 0,
                    shares: metrics.shares[item.id] || 0,
                    connectors: metrics.connectors[item.user_id] || 0
                }
            }));
        }
        
        // Apply sorting
        if (sortBy === 'popular') {
            results.sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0));
            console.log('🔍 Sorted by popular');
        } else if (sortBy === 'trending') {
            results.sort((a, b) => {
                const scoreA = (a.metrics?.views || 0) + (a.metrics?.likes || 0) * 5;
                const scoreB = (b.metrics?.views || 0) + (b.metrics?.likes || 0) * 5;
                return scoreB - scoreA;
            });
            console.log('🔍 Sorted by trending');
        } else if (sortBy === 'connectors') {
            results.sort((a, b) => (b.metrics?.connectors || 0) - (a.metrics?.connectors || 0));
            console.log('🔍 Sorted by connectors');
        } else {
            // Default: newest first
            results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            console.log('🔍 Sorted by newest');
        }
        
        console.log('✅ Search complete:', results.length, 'results');
        return results;
        
    } catch (error) {
        console.error('❌ Search function error:', error);
        showToast('Search failed. Please try again.', 'error');
        return [];
    }
}

// ============================================
// RENDER SEARCH RESULTS - FIXED VERSION
// ============================================
function renderSearchResults(results, searchQuery = '') {
    const grid = document.getElementById('search-results-grid');
    
    console.log('🎨 Rendering search results:', results.length);
    
    if (!grid) {
        console.error('❌ Search results grid not found!');
        return;
    }
    
    if (!results || results.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-search"></i></div>
                <h3>No Results Found</h3>
                <p>Try different keywords or check your spelling</p>
                <p style="color: var(--warm-gold); margin-top: 10px;">Searched for: "${escapeHtml(searchQuery)}"</p>
            </div>
        `;
        return;
    }
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Add results count header
    const resultsHeader = document.createElement('div');
    resultsHeader.style.cssText = 'grid-column: 1 / -1; margin-bottom: 1rem; color: var(--slate-grey); font-size: var(--font-sm);';
    resultsHeader.innerHTML = `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${escapeHtml(searchQuery)}"`;
    fragment.appendChild(resultsHeader);
    
    // Render each result
    results.slice(0, 24).forEach((content, index) => {
        if (!content) return;
        
        const thumbnailUrl = content.thumbnail_url
            ? fixMediaUrl(content.thumbnail_url)
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
        
        const creatorProfile = content.user_profiles;
        const displayName = creatorProfile?.full_name || creatorProfile?.username || 'Creator';
        const username = creatorProfile?.username || 'creator';
        const durationFormatted = formatDuration(content.duration || 0);
        const initials = getInitials(displayName);
        
        let avatarHtml = '';
        if (creatorProfile?.avatar_url) {
            const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
            avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">`;
        } else {
            avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
        }
        
        const card = document.createElement('a');
        card.className = 'content-card search-result-card';
        card.href = `content-detail.html?id=${content.id}`;
        card.dataset.contentId = content.id;
        card.dataset.language = content.language || 'en';
        card.dataset.category = content.genre || '';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.3s ease';
        
        // Highlight search query in title
        const highlightedTitle = highlightSearchQuery(escapeHtml(content.title), searchQuery);
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                <div class="thumbnail-overlay"></div>
                <div class="play-overlay">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
                ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
                ${content.media_type === 'live' ? `
                    <div class="card-badge badge-live" style="position:absolute;top:10px;left:10px;z-index:4;">
                        <i class="fas fa-circle"></i> LIVE
                    </div>
                ` : ''}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${escapeHtml(content.title)}">${highlightedTitle}</h3>
                <div class="creator-info">
                    <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                    <div class="creator-name-small">@${escapeHtml(username)}</div>
                </div>
                <div class="card-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                    <span><i class="fas fa-share"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                    ${content.language ? `<span><i class="fas fa-language"></i> ${window.languageMap[content.language] || content.language}</span>` : ''}
                </div>
                ${content.metrics?.connectors > 0 ? `
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics.connectors)} Connectors
                    </div>
                ` : ''}
            </div>
        `;
        
        fragment.appendChild(card);
        
        // Animate cards in with stagger
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50 + (index * 50));
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
    
    console.log('✅ Search results rendered');
}

// ============================================
// NOTIFICATIONS
// ============================================
function setupNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsPanel = document.getElementById('notifications-panel');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllRead = document.getElementById('mark-all-read');
    
    if (!notificationsBtn || !notificationsPanel) return;
    
    const openNotifications = () => {
        notificationsPanel.classList.add('active');
        renderNotifications();
    };
    
    notificationsBtn.addEventListener('click', openNotifications);
    
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
    
    if (markAllRead) {
        markAllRead.addEventListener('click', async () => {
            if (!window.currentUser) return;
            
            try {
                const { error } = await supabaseAuth
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', window.currentUser.id)
                    .eq('is_read', false);
                
                if (error) throw error;
                
                if (window.notifications) {
                    window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
                }
                
                renderNotifications();
                updateNotificationBadge(0);
                showToast('All notifications marked as read', 'success');
            } catch (error) {
                console.error('Error marking all as read:', error);
                showToast('Failed to mark notifications as read', 'error');
            }
        });
    }
    
    document.getElementById('notification-settings')?.addEventListener('click', () => {
        window.location.href = 'notification-settings.html';
    });
}

async function loadNotifications() {
    try {
        if (!window.currentUser) {
            updateNotificationBadge(0);
            return;
        }
        
        const { data, error } = await supabaseAuth
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
    } catch (error) {
        console.error('Error loading notifications:', error);
        updateNotificationBadge(0);
    }
}

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
// ANALYTICS
// ============================================
function setupAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const analyticsModal = document.getElementById('analytics-modal');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !analyticsModal) return;
    
    analyticsBtn.addEventListener('click', async () => {
        const { data } = await supabaseAuth.auth.getSession();
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
}

async function loadPersonalAnalytics() {
    if (!window.currentUser || !window.currentProfile) return;
    
    try {
        const { data: views } = await supabaseAuth
            .from('content_views')
            .select('*')
            .eq('profile_id', window.currentProfile.id);
        
        const totalViews = views?.length || 0;
        const totalWatchTime = views?.reduce((acc, v) => acc + (v.view_duration || 0), 0) || 0;
        const hours = Math.floor(totalWatchTime / 3600);
        
        document.getElementById('personal-watch-time').textContent = hours + 'h';
        document.getElementById('personal-views').textContent = totalViews;
        document.getElementById('personal-sessions').textContent = Math.ceil(totalViews / 5) || 1;
        
        const uniqueDays = new Set(views?.map(v => new Date(v.created_at).toDateString())).size;
        const returnRate = uniqueDays > 0 ? Math.min(100, Math.floor((uniqueDays / 7) * 100)) : 0;
        document.getElementById('return-rate').textContent = returnRate + '%';
        
        await loadEngagementChart();
    } catch (error) {
        console.error('Error loading personal analytics:', error);
    }
}

async function loadEngagementChart() {
    const ctx = document.getElementById('engagement-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: viewsData } = await supabaseAuth
            .from('content_views')
            .select('created_at')
            .gte('created_at', sevenDaysAgo.toISOString());
        
        const viewsByDay = new Array(7).fill(0);
        const today = new Date();
        
        viewsData?.forEach(view => {
            const viewDate = new Date(view.created_at);
            const dayDiff = Math.floor((today - viewDate) / (1000 * 60 * 60 * 24));
            if (dayDiff >= 0 && dayDiff < 7) {
                viewsByDay[6 - dayDiff]++;
            }
        });
        
        if (window.engagementChart) {
            window.engagementChart.destroy();
        }
        
        window.engagementChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', 'Yesterday', 'Today'],
                datasets: [{
                    label: 'Views',
                    data: viewsByDay,
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--soft-white)'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--slate-grey)' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'var(--slate-grey)' }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading engagement chart:', error);
    }
}

// ============================================
// VOICE SEARCH
// ============================================
function setupVoiceSearch() {
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const voiceSearchModalBtn = document.getElementById('voice-search-modal-btn');
    const voiceStatus = document.getElementById('voice-search-status');
    const voiceStatusText = document.getElementById('voice-status-text');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (voiceSearchBtn) voiceSearchBtn.style.display = 'none';
        if (voiceSearchModalBtn) voiceSearchModalBtn.style.display = 'none';
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
        
        if (voiceStatus) {
            voiceStatus.classList.add('active');
            voiceStatusText.textContent = 'Listening...';
        }
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');
        
        if (searchInput) {
            searchInput.value = transcript;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
            voiceStatusText.textContent = 'Listening...';
        }
        
        showToast(`Searching: "${transcript}"`, 'info');
    };
    
    recognition.onerror = (event) => {
        console.error('Voice search error:', event.error);
        
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
            voiceStatusText.textContent = 'Error';
        }
        
        if (event.error === 'not-allowed') {
            showToast('Microphone access denied', 'error');
        }
    };
    
    recognition.onend = () => {
        if (voiceStatus) {
            voiceStatus.classList.remove('active');
        }
    };
    
    if (voiceSearchBtn) {
        voiceSearchBtn.addEventListener('click', startVoiceSearch);
    }
    
    if (voiceSearchModalBtn) {
        voiceSearchModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startVoiceSearch();
        });
    }
}

// ============================================
// WATCH PARTY
// ============================================
function setupWatchParty() {
    const watchPartyModal = document.getElementById('watch-party-modal');
    const closeWatchParty = document.getElementById('close-watch-party');
    const startWatchParty = document.getElementById('start-watch-party');
    const copyPartyLink = document.getElementById('copy-party-link');
    
    if (!watchPartyModal) return;
    
    if (closeWatchParty) {
        closeWatchParty.addEventListener('click', () => {
            watchPartyModal.classList.remove('active');
        });
    }
    
    if (startWatchParty) {
        startWatchParty.addEventListener('click', async () => {
            const selectedContent = document.querySelector('.watch-party-content-item.selected');
            if (!selectedContent) {
                showToast('Please select content to watch', 'warning');
                return;
            }
            
            const contentId = selectedContent.dataset.contentId;
            const syncPlayback = document.getElementById('party-sync-playback')?.checked;
            const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
            
            try {
                const { data, error } = await supabaseAuth
                    .from('watch_parties')
                    .insert({
                        host_id: window.currentUser?.id,
                        profile_id: window.currentProfile?.id,
                        content_id: contentId,
                        sync_playback: syncPlayback,
                        chat_enabled: chatEnabled,
                        invite_code: generateInviteCode()
                    })
                    .select()
                    .single();
                
                if (error) {
                    console.warn('Watch party error:', error);
                    showToast('Watch party created! (Demo mode)', 'success');
                    watchPartyModal.classList.remove('active');
                    return;
                }
                
                watchPartyModal.classList.remove('active');
                
                const inviteLink = `${window.location.origin}/watch-party.html?code=${data.invite_code}`;
                navigator.clipboard.writeText(inviteLink);
                
                showToast('Watch party created! Invite link copied to clipboard', 'success');
            } catch (error) {
                console.error('Error creating watch party:', error);
                showToast('Watch party created! (Demo mode)', 'success');
                watchPartyModal.classList.remove('active');
            }
        });
    }
    
    if (copyPartyLink) {
        copyPartyLink.addEventListener('click', () => {
            showToast('Start a watch party first', 'warning');
        });
    }
    
    const searchInput = document.getElementById('watch-party-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                loadWatchPartyContent();
                return;
            }
            
            const results = await searchContent(query);
            renderWatchPartyContentList(results);
        }, 300));
    }
}

async function loadWatchPartyContent() {
    try {
        const { data, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        renderWatchPartyContentList(data || []);
    } catch (error) {
        console.error('Error loading watch party content:', error);
    }
}

function renderWatchPartyContentList(contents) {
    const list = document.getElementById('watch-party-content-list');
    if (!list) return;
    
    list.innerHTML = contents.map(content => {
        const thumbnailUrl = content.thumbnail_url
            ? fixMediaUrl(content.thumbnail_url)
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
}

function generateInviteCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ============================================
// TIP SYSTEM
// ============================================
function setupTipSystem() {
    const tipModal = document.getElementById('tip-modal');
    const closeTip = document.getElementById('close-tip');
    const sendTip = document.getElementById('send-tip');
    
    if (!tipModal) return;
    
    document.addEventListener('click', (e) => {
        if (e.target.closest('.tip-creator-btn')) {
            const btn = e.target.closest('.tip-creator-btn');
            const creatorId = btn.dataset.creatorId;
            const creatorName = btn.dataset.creatorName;
            
            openTipModal(creatorId, creatorName);
        }
    });
    
    if (closeTip) {
        closeTip.addEventListener('click', () => {
            tipModal.classList.remove('active');
        });
    }
    
    document.querySelectorAll('.tip-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            const customAmount = document.getElementById('custom-amount');
            if (btn.dataset.amount === 'custom') {
                customAmount.style.display = 'block';
            } else {
                customAmount.style.display = 'none';
            }
        });
    });
    
    if (sendTip) {
        sendTip.addEventListener('click', async () => {
            const selectedOption = document.querySelector('.tip-option.selected');
            if (!selectedOption) {
                showToast('Please select an amount', 'warning');
                return;
            }
            
            let amount = selectedOption.dataset.amount;
            if (amount === 'custom') {
                amount = document.getElementById('custom-tip-amount').value;
                if (!amount || amount < 1) {
                    showToast('Please enter a valid amount', 'warning');
                    return;
                }
            }
            
            const message = document.getElementById('tip-message').value;
            const creatorId = tipModal.dataset.creatorId;
            
            if (!window.currentUser) {
                showToast('Please sign in to send tips', 'warning');
                return;
            }
            
            try {
                const { error } = await supabaseAuth
                    .from('tips')
                    .insert({
                        sender_id: window.currentUser.id,
                        recipient_id: creatorId,
                        amount: parseFloat(amount),
                        message: message,
                        status: 'completed'
                    });
                
                if (error) {
                    console.warn('Tip error:', error);
                    showToast(`Thank you for supporting this creator! (Demo)`, 'success');
                } else {
                    showToast(`Thank you for supporting this creator!`, 'success');
                }
                
                tipModal.classList.remove('active');
                
                document.getElementById('tip-message').value = '';
                document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
                document.getElementById('custom-amount').style.display = 'none';
            } catch (error) {
                console.error('Error sending tip:', error);
                showToast('Thank you for supporting this creator! (Demo)', 'success');
                tipModal.classList.remove('active');
            }
        });
    }
}

function openTipModal(creatorId, creatorName) {
    const tipModal = document.getElementById('tip-modal');
    const creatorInfo = document.getElementById('tip-creator-info');
    
    tipModal.dataset.creatorId = creatorId;
    
    creatorInfo.innerHTML = `
        <h3>${escapeHtml(creatorName)}</h3>
        <p>Show your appreciation with a tip</p>
    `;
    
    tipModal.classList.add('active');
}

// ============================================
// BADGES
// ============================================
async function loadUserBadges() {
    if (!window.currentUser) return;
    
    try {
        const { data, error } = await supabaseAuth
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
        
        badgesEarned.textContent = window.userBadges.length;
        
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// ============================================
// CATEGORY TABS
// ============================================
function renderCategoryTabs() {
    const categoryTabs = document.getElementById('category-tabs');
    if (!categoryTabs) return;
    
    const categories = ['All', 'Music', 'STEM', 'Culture', 'News', 'Sports', 'Movies', 'Documentaries', 'Podcasts'];
    
    categoryTabs.innerHTML = categories.map((category, index) => `
        <button class="category-tab ${index === 0 ? 'active' : ''}"
                data-category="${category}">
            ${escapeHtml(category)}
        </button>
    `).join('');
    
    document.querySelectorAll('.category-tab').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            onCategoryChanged(category);
        });
    });
}

async function onCategoryChanged(category) {
    document.querySelectorAll('.category-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    window.currentCategory = category === 'All' ? null : category;
    showToast(`Filtering by: ${category}`, 'info');
    
    await reloadContentByCategory(category);
}

async function reloadContentByCategory(category) {
    try {
        let query = supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published');
        
        if (category !== 'All') {
            query = query.eq('genre', category);
        }
        
        const { data: trendingData } = await query
            .order('views_count', { ascending: false })
            .limit(8);
        
        const trendingIds = (trendingData || []).map(c => c.id);
        const trendingCreatorIds = [...new Set((trendingData || []).map(c => c.user_id).filter(Boolean))];
        
        const trendingMetrics = await fetchAllMetrics(trendingIds, trendingCreatorIds);
        
        const trendingWithMetrics = (trendingData || []).map(item => ({
            ...item,
            metrics: {
                views: trendingMetrics.views[item.id] || 0,
                likes: trendingMetrics.likes[item.id] || 0,
                shares: trendingMetrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: trendingMetrics.connectors[item.user_id] || 0
            }
        }));
        
        const trendingGrid = document.getElementById('trending-grid');
        if (trendingGrid && trendingWithMetrics.length > 0) {
            trendingGrid.innerHTML = '';
            renderContentCards(trendingGrid, trendingWithMetrics);
        }
        
        const { data: newData } = await query
            .order('created_at', { ascending: false })
            .limit(8);
        
        const newIds = (newData || []).map(c => c.id);
        const newCreatorIds = [...new Set((newData || []).map(c => c.user_id).filter(Boolean))];
        
        const newMetrics = await fetchAllMetrics(newIds, newCreatorIds);
        
        const newWithMetrics = (newData || []).map(item => ({
            ...item,
            metrics: {
                views: newMetrics.views[item.id] || 0,
                likes: newMetrics.likes[item.id] || 0,
                shares: newMetrics.shares[item.id] || 0,
                favorites: item.favorites_count || 0,
                connectors: newMetrics.connectors[item.user_id] || 0
            }
        }));
        
        const newContentGrid = document.getElementById('new-content-grid');
        if (newContentGrid && newWithMetrics.length > 0) {
            newContentGrid.innerHTML = '';
            renderContentCards(newContentGrid, newWithMetrics);
        }
    } catch (error) {
        console.error('Error reloading content by category:', error);
        showToast('Failed to filter content', 'error');
    }
}

// ============================================
// PROFILE SWITCHER
// ============================================
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
            img.src = fixAvatarUrl(window.currentProfile.avatar_url);
            img.alt = window.currentProfile.name;
            img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            img.onerror = function() {
                this.style.display = 'none';
                const initials = getInitials(window.currentProfile.name);
                const div = document.createElement('div');
                div.className = 'profile-placeholder';
                div.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
                div.textContent = initials;
                profilePlaceholder.appendChild(div);
            };
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
                        ? `<img src="${fixAvatarUrl(profile.avatar_url)}" alt="${escapeHtml(profile.name)}" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\'profile-initials\'>${initials}</div>';">`
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
}

// ============================================
// BACK TO TOP
// ============================================
function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    window.addEventListener('scroll', () => {
        backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
    });
}

// ============================================
// INFINITE SCROLL
// ============================================
function setupInfiniteScroll() {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    
    const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && window.hasMoreContent && !window.isLoadingMore) {
            await loadMoreContent();
        }
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });
    
    if (sentinel) {
        observer.observe(sentinel);
    }
}

async function loadMoreContent() {
    if (window.isLoadingMore || !window.hasMoreContent) return;
    
    window.isLoadingMore = true;
    window.currentPage++;
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'infinite-scroll-loading';
    loadingIndicator.id = 'infinite-scroll-loading';
    loadingIndicator.innerHTML = `
        <div class="infinite-scroll-spinner"></div>
        <div>Loading more content...</div>
    `;
    document.querySelector('.container')?.appendChild(loadingIndicator);
    
    try {
        const from = window.currentPage * window.PAGE_SIZE;
        const to = (window.currentPage + 1) * window.PAGE_SIZE - 1;
        
        const { data, error } = await supabaseAuth
            .from('Content')
            .select('id, title, thumbnail_url, duration, genre, language, created_at, views_count, favorites_count, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(from, to);
        
        if (error) throw error;
        
        document.getElementById('infinite-scroll-loading')?.remove();
        
        if (data && data.length > 0) {
            const contentIds = data.map(c => c.id);
            const creatorIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
            const metrics = await fetchAllMetrics(contentIds, creatorIds);
            
            const dataWithMetrics = data.map(item => ({
                ...item,
                metrics: {
                    views: metrics.views[item.id] || 0,
                    likes: metrics.likes[item.id] || 0,
                    shares: metrics.shares[item.id] || 0,
                    favorites: item.favorites_count || 0,
                    connectors: metrics.connectors[item.user_id] || 0
                }
            }));
            
            appendMoreContent(dataWithMetrics);
            window.hasMoreContent = data.length === window.PAGE_SIZE;
        } else {
            window.hasMoreContent = false;
            
            const endMessage = document.createElement('div');
            endMessage.className = 'infinite-scroll-end';
            endMessage.innerHTML = 'You\'ve reached the end of content';
            document.querySelector('.container')?.appendChild(endMessage);
            setTimeout(() => endMessage.remove(), 3000);
        }
    } catch (error) {
        console.error('Error loading more content:', error);
        document.getElementById('infinite-scroll-loading')?.remove();
        window.hasMoreContent = false;
    } finally {
        window.isLoadingMore = false;
    }
}

function appendMoreContent(newItems) {
    const newContentGrid = document.getElementById('new-content-grid');
    if (!newContentGrid) return;
    
    renderContentCards(newContentGrid, newItems);
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea, select')) return;
        
        switch(e.key) {
            case '?':
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    const shortcutsModal = document.getElementById('shortcuts-modal');
                    if (shortcutsModal) {
                        shortcutsModal.style.display = 'flex';
                    }
                }
                break;
            case '/':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    document.getElementById('search-btn')?.click();
                }
                break;
            case 'Escape':
                closeAllModals();
                break;
        }
    });
    
    const closeShortcuts = document.getElementById('close-shortcuts');
    if (closeShortcuts) {
        closeShortcuts.addEventListener('click', () => {
            document.getElementById('shortcuts-modal').style.display = 'none';
        });
    }
    
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) {
                shortcutsModal.style.display = 'none';
            }
        });
    }
}

function closeAllModals() {
    document.querySelectorAll('.analytics-modal.active, .search-modal.active, .notifications-panel.active, .watch-party-modal.active, .tip-modal.active, .badges-modal.active')
        .forEach(el => el.classList.remove('active'));
    
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal) {
        shortcutsModal.style.display = 'none';
    }
}

// ============================================
// WELCOME MESSAGE - FIXED VERSION
// ============================================
function updateWelcomeMessage() {
    const userNameSpan = document.getElementById('user-name');
    const welcomeSubtitle = document.getElementById('welcome-subtitle');
    const welcomeMessage = document.getElementById('welcome-message');
    
    console.log('👋 Updating welcome message, logged in:', !!window.currentUser);
    
    // Check if we have a current user AND profile
    if (window.currentUser) {
        // Try to get name from multiple sources
        let displayName = 'User';
        
        if (window.currentProfile) {
            displayName = window.currentProfile.full_name || 
                         window.currentProfile.username || 
                         window.currentProfile.name || 'User';
        } else if (window.currentUser.user_metadata) {
            displayName = window.currentUser.user_metadata.full_name || 
                         window.currentUser.user_metadata.name || 'User';
        } else if (window.currentUser.email) {
            displayName = window.currentUser.email.split('@')[0];
        }
        
        // Capitalize first letter
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        
        if (userNameSpan) userNameSpan.textContent = displayName;
        
        // Get time-based greeting
        const hour = new Date().getHours();
        let greeting = '';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';
        
        if (welcomeMessage) {
            welcomeMessage.innerHTML = `${greeting}, <span id="user-name">${displayName}</span>! 👋`;
        }
        
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Here\'s what we picked for you today';
        }
        
        console.log('✅ Welcome message updated for user:', displayName);
        
    } else {
        // Guest user
        if (userNameSpan) userNameSpan.textContent = 'Guest';
        
        if (welcomeMessage) {
            welcomeMessage.innerHTML = 'Welcome, <span id="user-name">Guest</span>! 👋';
        }
        
        if (welcomeSubtitle) {
            welcomeSubtitle.textContent = 'Sign in for personalized recommendations';
        }
        
        console.log('✅ Welcome message updated for guest');
    }
}

// ============================================
// UPDATE APP ICON
// ============================================
function updateAppIcon() {
    // Update logo icon in header
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        // Clear existing content
        logoIcon.innerHTML = '';
        
        // Add img element
        const img = document.createElement('img');
        img.src = 'assets/icon/bantu_stream_connect_icon.png';
        img.alt = 'Bantu Stream Connect';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        logoIcon.appendChild(img);
    }
    
    // Update sidebar logo icon
    const sidebarLogoIcon = document.querySelector('.sidebar-logo .logo-icon');
    if (sidebarLogoIcon) {
        sidebarLogoIcon.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = 'assets/icon/bantu_stream_connect_icon.png';
        img.alt = 'Bantu Stream Connect';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        sidebarLogoIcon.appendChild(img);
    }
}
