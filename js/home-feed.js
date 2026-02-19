// ============================================
// MAIN HOME FEED APPLICATION
// ============================================
class HomeFeedApp {
    constructor() {
        this.allContentData = [];
        this.filteredContentData = [];
        this.isLoading = false;
        this.phasedLoader = new PhasedLoader();
    }
    
    async init() {
        console.log('🚀 Bantu Stream Connect Home Feed Initializing...');
        
        // Initialize core systems first
        await this.initializeCoreSystems();
        
        // Initialize UI systems
        this.initializeUISystems();
        
        // Initialize feature systems (including all new features)
        this.initializeFeatureSystems();
        
        // Initialize utilities
        this.initializeUtilities();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check authentication
        await this.checkAuthentication();
        
        // Load content with phased loading
        await this.loadContentWithPhasedLoading();
        
        // Load metrics for initial content cards
        this.loadInitialContentMetrics();
        
        // Final initialization
        this.finalizeInitialization();
        
        console.log('✅ Home Feed fully initialized');
    }
    
    async initializeCoreSystems() {
        console.log('🔄 Initializing core systems...');
        
        // Initialize cache manager
        if (typeof cacheManager !== 'undefined') {
            await cacheManager.init();
        } else {
            // Create global cache manager if not exists
            window.cacheManager = new CacheManager();
        }
        
        // Initialize performance monitor
        if (typeof performanceMonitor !== 'undefined') {
            performanceMonitor.reportMetrics();
        }
        
        // Initialize state manager
        if (typeof stateManager !== 'undefined') {
            // Load initial state
            const cachedContent = cacheManager?.getCachedContent ? cacheManager.getCachedContent() : null;
            if (cachedContent) {
                this.allContentData = cachedContent;
                this.filteredContentData = cachedContent;
                stateManager.setState({ content: cachedContent, filtered: cachedContent });
            }
        }
    }
    
    initializeUISystems() {
        console.log('🔄 Initializing UI systems...');
        
        // Initialize development window (always visible)
        if (typeof developmentWindow !== 'undefined') {
            developmentWindow.init();
        }
        
        // Initialize navigation
        if (typeof navigationSystem !== 'undefined') {
            navigationSystem.init();
        }
        
        // Initialize theme system
        if (typeof themeSystem !== 'undefined') {
            themeSystem.init();
        }
        
        // Initialize content card system
        if (typeof contentCardSystem !== 'undefined') {
            contentCardSystem.init();
        }
        
        // Initialize modals
        if (typeof searchModal !== 'undefined') {
            searchModal.init();
        }
        
        if (typeof analyticsModal !== 'undefined') {
            analyticsModal.init();
        }
    }
    
    initializeFeatureSystems() {
        console.log('🔄 Initializing all feature systems...');
        
        // Initialize video preview system
        if (typeof videoPreviewSystem !== 'undefined') {
            videoPreviewSystem.init();
        }
        
        // Initialize recommendation engine
        if (typeof recommendationEngine !== 'undefined') {
            recommendationEngine.init();
        }
        
        // Initialize notification system
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.init();
        }
        
        // Initialize analytics system
        if (typeof analyticsSystem !== 'undefined') {
            analyticsSystem.init();
        }
        
        // Initialize search system
        if (typeof searchSystem !== 'undefined') {
            searchSystem.init();
        }
        
        // Initialize continue watching system
        if (typeof continueWatchingSystem !== 'undefined') {
            continueWatchingSystem.init();
        }
        
        // ===== NEW: Sidebar & UI Scaling =====
        console.log('🔄 Initializing Sidebar & UI Scaling...');
        
        // Initialize sidebar
        if (typeof setupSidebar === 'function') {
            setupSidebar();
        }
        
        // Initialize UI scale controller
        if (typeof UIScaleController !== 'undefined') {
            window.uiScaleController = new UIScaleController();
            window.uiScaleController.init();
        }
        
        // ===== NEW: Video Hero =====
        console.log('🔄 Initializing Video Hero...');
        if (typeof initVideoHero === 'function') {
            initVideoHero();
        }
        
        // ===== NEW: Content Metrics System =====
        console.log('🔄 Initializing Content Metrics System...');
        window.contentMetrics = window.contentMetrics || new Map();
        
        // ===== NEW: Language Filter =====
        if (typeof setupLanguageFilter === 'function') {
            setupLanguageFilter();
        }
        
        // ===== NEW: Community Stats =====
        if (typeof loadCommunityStats === 'function') {
            loadCommunityStats();
        }
        
        // ===== NEW: Shorts Section =====
        if (typeof loadShorts === 'function') {
            loadShorts();
        }
        
        // ===== NEW: Badges System =====
        if (typeof initBadgesSystem === 'function') {
            initBadgesSystem();
        }
        
        // ===== NEW: Tip System =====
        if (typeof setupTipSystem === 'function') {
            setupTipSystem();
        }
        
        // ===== NEW: Voice Search =====
        if (typeof setupVoiceSearch === 'function') {
            setupVoiceSearch();
        }
    }
    
    initializeUtilities() {
        console.log('🔄 Initializing utilities...');
        
        // Initialize accessibility
        if (typeof accessibility !== 'undefined') {
            accessibility.init();
        }
        
        // Initialize animations
        if (typeof animations !== 'undefined') {
            animations.init();
        }
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    async checkAuthentication() {
        const { data: { session }, error } = await supabaseAuth.auth.getSession();
        const isAuthenticated = !!session;
        
        console.log(`🔐 User ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);
        
        // Update user state
        if (typeof stateManager !== 'undefined') {
            stateManager.setState({ user: session?.user || null });
        }
        window.currentUser = session?.user || null; // Set global for other systems
        
        // Update recommendation engine status
        if (typeof recommendationEngine !== 'undefined') {
            recommendationEngine.isUserLoggedIn = isAuthenticated;
        }
        
        // Load user profile picture if authenticated
        if (isAuthenticated) {
            await this.loadUserProfilePicture(session.user);
        }
        
        // Setup profile button
        this.setupProfileButton(isAuthenticated, session?.user);
        
        // Update sidebar profile if function exists
        if (isAuthenticated && typeof updateSidebarProfile === 'function') {
            updateSidebarProfile();
        }
        
        // Listen for auth state changes
        supabaseAuth.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            this.handleAuthStateChange(event, session);
        });
    }
    
    async loadUserProfilePicture(user) {
        try {
            const profileBtn = document.getElementById('profile-btn');
            const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
            
            if (!user || !profileBtn) return;
            
            const userInitials = this.getInitials(user.email);
            profileBtn.innerHTML = `
                <div class="profile-placeholder">
                    ${userInitials}
                </div>
            `;
            
            // Try to fetch user profile
            try {
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();
                
                if (!profileError && profile && profile.avatar_url) {
                    let avatarUrl = profile.avatar_url;
                    if (!avatarUrl.startsWith('http')) {
                        if (avatarUrl.startsWith('avatars/')) {
                            avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
                        } else {
                            avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
                        }
                    }
                    
                    const profileImg = document.createElement('img');
                    profileImg.className = 'profile-img';
                    profileImg.src = avatarUrl;
                    profileImg.alt = 'Profile Picture';
                    profileImg.onerror = function() {
                        this.parentElement.innerHTML = `
                            <div class="profile-placeholder">
                                ${userInitials}
                            </div>
                        `;
                    };
                    
                    profileBtn.innerHTML = '';
                    profileBtn.appendChild(profileImg);
                    
                    // Update sidebar avatar if it exists
                    if (sidebarAvatar) {
                        sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Profile">`;
                    }
                }
            } catch (error) {
                console.log('No user profile found:', error);
            }
        } catch (error) {
            console.error('Error loading user profile picture:', error);
        }
    }
    
    getInitials(email) {
        if (!email) return 'U';
        const parts = email.split('@')[0];
        if (parts.length >= 2) {
            return parts.substring(0, 2).toUpperCase();
        }
        return email.charAt(0).toUpperCase();
    }
    
    setupProfileButton(isAuthenticated, user) {
        const profileBtn = document.getElementById('profile-btn');
        if (!profileBtn) return;
        
        if (isAuthenticated) {
            profileBtn.addEventListener('click', () => {
                window.location.href = 'profile.html';
            });
        } else {
            profileBtn.addEventListener('click', () => {
                window.location.href = 'login.html?redirect=index.html';
            });
        }
    }
    
    handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN') {
            console.log('User signed in');
            if (typeof recommendationEngine !== 'undefined') {
                recommendationEngine.isUserLoggedIn = true;
            }
            if (typeof stateManager !== 'undefined') {
                stateManager.setState({ user: session.user });
            }
            window.currentUser = session.user;
            
            if (session?.user) {
                this.loadUserProfilePicture(session.user);
                if (typeof updateSidebarProfile === 'function') {
                    updateSidebarProfile();
                }
                if (typeof toast !== 'undefined') {
                    toast.success(`Welcome back, ${session.user.email}!`);
                }
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            if (typeof recommendationEngine !== 'undefined') {
                recommendationEngine.isUserLoggedIn = false;
            }
            if (typeof stateManager !== 'undefined') {
                stateManager.setState({ user: null });
            }
            window.currentUser = null;
            
            const profileBtn = document.getElementById('profile-btn');
            if (profileBtn) {
                profileBtn.innerHTML = `
                    <div class="profile-placeholder">
                        <i class="fas fa-user"></i>
                    </div>
                `;
            }
            
            // Update sidebar profile
            if (typeof updateSidebarProfile === 'function') {
                updateSidebarProfile();
            }
            
            if (typeof toast !== 'undefined') {
                toast.info('Signed out successfully');
            }
        }
        
        // Re-render sections that depend on auth state
        this.renderContentSections();
    }
    
    async loadContentWithPhasedLoading() {
        console.log('🔄 Starting phased content loading...');
        
        // Phase 1: Critical - Show skeleton and cached content (0-100ms)
        this.phasedLoader.addPhase('critical', async () => {
            // Show app skeleton immediately
            const loadingScreen = document.getElementById('loading');
            const app = document.getElementById('app');
            
            if (loadingScreen && app) {
                loadingScreen.style.display = 'none';
                app.style.display = 'block';
            }
            
            // If we have cached content, render it immediately
            if (this.allContentData.length > 0) {
                this.renderContentSections();
            } else {
                // Show skeleton UI
                this.showSkeletonUI();
            }
        }, 100);
        
        // Phase 2: Important - Load fresh content (100-1000ms)
        this.phasedLoader.addPhase('important', async () => {
            try {
                const freshContent = await this.fetchHomeFeedContent();
                if (freshContent.length > 0) {
                    this.allContentData = freshContent;
                    this.filteredContentData = freshContent;
                    if (typeof stateManager !== 'undefined') {
                        stateManager.setState({ content: freshContent, filtered: freshContent });
                    }
                    
                    // Cache the content
                    if (typeof cacheManager?.cacheContent === 'function') {
                        await cacheManager.cacheContent(freshContent);
                    }
                    
                    // Render with fresh content
                    this.renderContentSections();
                    
                    // Load metrics for the new content
                    this.loadInitialContentMetrics();
                    
                    // Show toast if we updated from cache
                    if (this.allContentData.length > 0 && typeof toast !== 'undefined') {
                        toast.success('Content updated');
                    }
                }
            } catch (error) {
                console.error('Error loading fresh content:', error);
                // Fallback to cached or test content
                if (this.allContentData.length === 0) {
                    this.allContentData = this.getTestContent();
                    this.filteredContentData = this.allContentData;
                    this.renderContentSections();
                    this.loadInitialContentMetrics();
                    if (typeof toast !== 'undefined') {
                        toast.error('Using sample data. Check your connection.');
                    }
                }
            }
        }, 90);
        
        // Phase 3: Background - Load non-critical systems (after 1 second)
        this.phasedLoader.addPhase('background', async () => {
            setTimeout(() => {
                // Initialize trending system
                this.initializeTrendingSystem();
                
                // Preload more content
                this.preloadAdditionalContent();
                
                // Reload community stats with fresh data
                if (typeof loadCommunityStats === 'function') {
                    loadCommunityStats();
                }
                
                // Reload shorts with fresh data
                if (typeof loadShorts === 'function') {
                    loadShorts();
                }
                
                // Update hero video
                if (typeof initVideoHero === 'function') {
                    initVideoHero();
                }
                
                // Update sidebar profile if user is logged in
                if (window.currentUser && typeof updateSidebarProfile === 'function') {
                    updateSidebarProfile();
                }
            }, 1000);
        }, 50);
        
        await this.phasedLoader.execute();
    }
    
    loadInitialContentMetrics() {
        // Get all content card IDs
        const cards = document.querySelectorAll('.content-card');
        const contentIds = Array.from(cards)
            .map(card => card.dataset.contentId)
            .filter(Boolean);
        
        if (contentIds.length > 0 && typeof loadContentMetrics === 'function') {
            loadContentMetrics(contentIds);
        }
    }
    
    showSkeletonUI() {
        const contentSections = document.getElementById('content-sections');
        if (!contentSections) return;
        
        // Create skeleton loading UI
        contentSections.innerHTML = `
            <div class="section">
                <div class="section-header">
                    <div class="skeleton-title" style="width: 200px; height: 30px; background: var(--card-bg); border-radius: 8px; margin-bottom: 20px;"></div>
                </div>
                <div class="content-grid">
                    ${Array(5).fill().map(() => `
                        <div class="content-card skeleton-card">
                            <div class="card-thumbnail" style="background: var(--card-bg);"></div>
                            <div class="card-content">
                                <div class="skeleton-text" style="width: 80%; height: 20px; background: var(--card-bg); border-radius: 4px; margin-bottom: 10px;"></div>
                                <div class="skeleton-text" style="width: 60%; height: 20px; background: var(--card-bg); border-radius: 4px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    async fetchHomeFeedContent() {
        console.log('🔄 Fetching content from Supabase...');
        
        try {
            let contentData = [];
            
            // Try to fetch from Content table
            try {
                contentData = await contentSupabase.query('Content', {
                    select: '*,user_profiles!user_id(*)',
                    where: { status: 'published' },
                    orderBy: 'created_at',
                    order: 'desc',
                    limit: 100
                });
                console.log('✅ Fetched from Content table:', contentData.length, 'items');
            } catch (error) {
                console.log('⚠️ Content table failed, trying content table...');
                
                try {
                    contentData = await contentSupabase.query('content', {
                        select: '*',
                        where: { status: 'published' },
                        orderBy: 'created_at',
                        order: 'desc',
                        limit: 100
                    });
                    console.log('✅ Fetched from content table:', contentData.length, 'items');
                } catch (error2) {
                    console.log('⚠️ Both table names failed, using test data');
                    return this.getTestContent();
                }
            }
            
            // Process the data
            const processedData = contentData.map(item => {
                let creatorName = 'Content Creator';
                let creatorId = item.creator_id || item.user_id;
                let language = item.language || 'en';
                
                if (item.user_profiles) {
                    creatorName = item.user_profiles.full_name || 
                                item.user_profiles.username || 
                                'Content Creator';
                } else if (item.creator) {
                    creatorName = item.creator;
                }
                
                return {
                    id: item.id,
                    title: item.title || 'Untitled',
                    description: item.description || '',
                    thumbnail_url: item.thumbnail_url,
                    file_url: item.file_url,
                    preview_url: item.preview_url,
                    media_type: item.media_type || 'video',
                    genre: item.genre,
                    created_at: item.created_at,
                    creator: creatorName,
                    creator_display_name: creatorName,
                    creator_id: creatorId,
                    user_id: item.user_id,
                    user_profiles: item.user_profiles,
                    views: item.views_count || item.views || 0,
                    likes: item.likes_count || item.likes || 0,
                    language: language,
                    duration: item.duration || 0,
                    is_new: this.isNewContent(item.created_at),
                    is_trending: this.isTrendingContent(item)
                };
            });
            
            console.log('✅ Processed content:', processedData.length, 'items');
            return processedData;
            
        } catch (error) {
            console.error('❌ Error fetching content:', error);
            throw error;
        }
    }
    
    isNewContent(createdAt) {
        if (!createdAt) return false;
        try {
            const created = new Date(createdAt);
            const now = new Date();
            const diffHours = (now - created) / (1000 * 60 * 60);
            return diffHours < 24; // Less than 24 hours old
        } catch {
            return false;
        }
    }
    
    isTrendingContent(item) {
        // Simple trending detection - high views in last 7 days
        if (!item.views || item.views < 100) return false;
        return item.views > 500; // Simplified for demo
    }
    
    getTestContent() {
        return [
            {
                id: '1',
                title: 'African Music Festival Highlights',
                description: 'Highlights from the biggest African music festival featuring top artists from across the continent.',
                thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                media_type: 'video',
                genre: 'Music',
                created_at: new Date().toISOString(),
                creator: '@music_africa',
                creator_display_name: 'Music Africa',
                creator_id: '1',
                user_id: '1',
                views: 12500,
                likes: 890,
                shares: 234,
                language: 'en',
                duration: 120,
                is_new: true,
                is_trending: true
            },
            {
                id: '2',
                title: 'Tech Innovation in Africa: The Future is Now',
                description: 'How technology is transforming African economies and creating new opportunities.',
                thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                media_type: 'video',
                genre: 'STEM',
                created_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days old
                creator: '@tech_africa',
                creator_display_name: 'Tech Africa',
                creator_id: '2',
                user_id: '2',
                views: 8900,
                likes: 650,
                shares: 123,
                language: 'en',
                duration: 180,
                is_new: false,
                is_trending: true
            },
            {
                id: '3',
                title: 'Traditional Dance Performance: Zulu Heritage',
                description: 'Beautiful traditional dance from South Africa showcasing Zulu culture and heritage.',
                thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                media_type: 'video',
                genre: 'Culture',
                created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days old
                creator: '@cultural_hub',
                creator_display_name: 'Cultural Hub',
                creator_id: '3',
                user_id: '3',
                views: 15600,
                likes: 1200,
                shares: 456,
                language: 'zu',
                duration: 240,
                is_new: false,
                is_trending: true
            },
            {
                id: '4',
                title: 'Cooking with Mama: Authentic Jollof Rice',
                description: 'Learn how to make the perfect Jollof Rice with this step-by-step tutorial.',
                thumbnail_url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                media_type: 'video',
                genre: 'Cooking',
                created_at: new Date().toISOString(),
                creator: '@mama_cooks',
                creator_display_name: 'Mama Cooks',
                creator_id: '4',
                user_id: '4',
                views: 5300,
                likes: 420,
                shares: 89,
                language: 'en',
                duration: 900,
                is_new: true,
                is_trending: false
            },
            {
                id: '5',
                title: 'African Wildlife Safari: Big Five Adventure',
                description: 'Experience the thrill of spotting the Big Five on a safari in Kenya.',
                thumbnail_url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
                media_type: 'video',
                genre: 'Travel',
                created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day old
                creator: '@wild_africa',
                creator_display_name: 'Wild Africa',
                creator_id: '5',
                user_id: '5',
                views: 7200,
                likes: 580,
                shares: 167,
                language: 'en',
                duration: 600,
                is_new: true,
                is_trending: false
            },
            {
                id: '6',
                title: 'Language Lesson: Learn Xhosa Click Sounds',
                description: 'Master the distinctive click sounds of the Xhosa language.',
                thumbnail_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
                media_type: 'video',
                genre: 'Education',
                created_at: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days old
                creator: '@language_hub',
                creator_display_name: 'Language Hub',
                creator_id: '6',
                user_id: '6',
                views: 3200,
                likes: 280,
                shares: 95,
                language: 'xh',
                duration: 450,
                is_new: false,
                is_trending: false
            }
        ];
    }
    
    initializeTrendingSystem() {
        // This would be a separate trending system
        // For now, we'll update the trending section
        this.updateTrendingSection();
    }
    
    async preloadAdditionalContent() {
        // Preload images for better UX
        const imagesToPreload = [
            'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
            'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
            'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
            'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400&h=225&fit=crop',
            'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=225&fit=crop'
        ];
        
        imagesToPreload.forEach(src => {
            const img = new Image();
            img.src = src;
        });
        
        // Preload more content in background
        try {
            await contentSupabase.preloadContent();
        } catch (error) {
            console.log('Background preloading failed:', error);
        }
    }
    
    renderContentSections() {
        const contentSections = document.getElementById('content-sections');
        if (!contentSections) return;
        
        if (this.filteredContentData.length === 0) {
            contentSections.innerHTML = `
                <div class="empty-state">
                    <h3>No Content Available</h3>
                    <p>Check back later for new content!</p>
                </div>
            `;
            return;
        }
        
        // Get recommendations
        let personalizedRecommendations = [];
        let trendingFallback = [];
        
        if (typeof recommendationEngine !== 'undefined') {
            personalizedRecommendations = recommendationEngine.getPersonalizedRecommendations(this.filteredContentData);
            trendingFallback = recommendationEngine.getTrendingFallback(this.filteredContentData);
        }
        
        // Determine what to show in Recommended For You section
        const isUserLoggedIn = !!(stateManager?.state?.user || window.currentUser);
        const showRecommendedSection = isUserLoggedIn || trendingFallback.length > 0;
        const recommendedContent = personalizedRecommendations.length > 0 ? personalizedRecommendations : trendingFallback;
        
        // Get continue watching
        let continueWatching = [];
        if (typeof continueWatchingSystem !== 'undefined') {
            continueWatching = continueWatchingSystem.getContinueWatchingContent(this.filteredContentData);
        }
        
        // Get trending content
        const trendingContent = this.getTrendingContent(this.filteredContentData);
        
        // Get most viewed content
        const mostViewed = this.getMostViewedContent(this.filteredContentData);
        
        // Build sections HTML
        let sectionsHTML = '';
        
        // Continue Watching Section
        if (continueWatching.length > 0) {
            sectionsHTML += `
                <section class="section" data-type="continue-watching">
                    <div class="section-header">
                        <h2 class="section-title">Continue Watching</h2>
                        <button class="see-all-btn" data-action="see-all" data-target="continue-watching">See All</button>
                    </div>
                    <div class="content-grid">
                        ${continueWatching.slice(0, 5).map(item => 
                            contentCardSystem?.createContentCard ? 
                            contentCardSystem.createContentCard(item, { showContinueWatching: true }) :
                            this.createContentCardWithMetrics(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        // Recommended For You Section
        if (showRecommendedSection && recommendedContent.length > 0) {
            const description = !isUserLoggedIn 
                ? 'Trending content for new users. <span class="highlight">Sign in for personalized recommendations!</span>'
                : (personalizedRecommendations.length > 0 
                    ? 'Based on your preferences'
                    : 'Based on trending content. <span class="highlight">Like some content to get personalized recommendations!</span>');
            
            sectionsHTML += `
                <section class="section recommended-for-you-section" data-type="recommended-for-you">
                    <div class="section-header">
                        <h2 class="section-title">Recommended For You</h2>
                        <div class="recommended-description">
                            ${description}
                        </div>
                    </div>
                    <div class="content-grid">
                        ${recommendedContent.slice(0, 5).map(item => 
                            contentCardSystem?.createRecommendedCard ? 
                            contentCardSystem.createRecommendedCard(item) :
                            this.createContentCardWithMetrics(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        // Latest Uploads
        sectionsHTML += `
            <section class="section">
                <div class="section-header">
                    <h2 class="section-title">Latest Uploads</h2>
                    <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
                </div>
                <div class="content-grid">
                    ${this.filteredContentData.slice(0, 10).map(item => 
                        contentCardSystem?.createContentCard ? 
                        contentCardSystem.createContentCard(item) :
                        this.createContentCardWithMetrics(item)
                    ).join('')}
                </div>
            </section>
        `;
        
        // Trending Now Section
        if (trendingContent.length > 0) {
            sectionsHTML += `
                <section class="section" data-type="trending">
                    <div class="section-header">
                        <h2 class="section-title">Trending Now</h2>
                        <button class="see-all-btn" data-action="see-all" data-target="trending">See All</button>
                    </div>
                    <div class="content-grid">
                        ${trendingContent.slice(0, 5).map(item => 
                            contentCardSystem?.createTrendingCard ? 
                            contentCardSystem.createTrendingCard(item) :
                            this.createContentCardWithMetrics(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        // Most Viewed
        if (mostViewed.length > 0) {
            sectionsHTML += `
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Most Viewed</h2>
                        <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
                    </div>
                    <div class="content-grid">
                        ${mostViewed.slice(0, 5).map(item => 
                            contentCardSystem?.createContentCard ? 
                            contentCardSystem.createContentCard(item) :
                            this.createContentCardWithMetrics(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        contentSections.innerHTML = sectionsHTML;
        
        // Setup event listeners for the new content
        this.setupContentCardListeners();
        
        // Apply language filter if active
        const activeLang = document.querySelector('.language-chip.active')?.dataset.lang;
        if (activeLang && activeLang !== 'all' && typeof filterContentByLanguage === 'function') {
            filterContentByLanguage(activeLang);
        }
        
        // Load metrics for the newly rendered cards
        this.loadInitialContentMetrics();
    }
    
    createContentCardWithMetrics(item) {
        // Use the global function if available
        if (typeof createContentCardWithMetrics === 'function') {
            return createContentCardWithMetrics(item);
        }
        
        // Fallback implementation
        const metrics = window.contentMetrics?.get(item.id) || { 
            views: item.views || 0, 
            likes: item.likes || 0, 
            shares: item.shares || 0 
        };
        
        const thumbnailUrl = item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
        const creatorName = item.creator || item.creator_display_name || 'Creator';
        const initials = this.getInitials(creatorName);
        
        return `
            <a href="content-detail.html?id=${item.id}" class="content-card" 
               data-content-id="${item.id}" 
               data-language="${item.language || 'en'}"
               data-category="${item.genre || ''}">
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${item.title}" 
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
                    <div class="card-badges">
                        ${item.is_new ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
                        ${item.is_trending ? '<div class="card-badge badge-trending"><i class="fas fa-fire"></i> TRENDING</div>' : ''}
                    </div>
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${item.title}">
                        ${item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                    </h3>
                    <div class="creator-info">
                        <div class="creator-avatar-small">${initials}</div>
                        <div class="creator-name-small">@${creatorName.split(' ')[0].toLowerCase()}</div>
                    </div>
                    <div class="card-stats">
                        <span class="card-stat" title="Views">
                            <i class="fas fa-eye"></i> ${this.formatNumber(metrics.views)}
                        </span>
                        <span class="card-stat" title="Likes">
                            <i class="fas fa-heart"></i> ${this.formatNumber(metrics.likes)}
                        </span>
                        <span class="card-stat" title="Shares">
                            <i class="fas fa-share"></i> ${this.formatNumber(metrics.shares)}
                        </span>
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-language"></i> ${this.getLanguageName(item.language)}</span>
                        <span><i class="fas fa-clock"></i> ${this.formatDate(item.created_at)}</span>
                    </div>
                </div>
            </a>
        `;
    }
    
    formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toString() || '0';
    }
    
    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'zu': 'IsiZulu',
            'xh': 'IsiXhosa',
            'af': 'Afrikaans',
            'nso': 'Sepedi',
            'st': 'Sesotho',
            'tn': 'Setswana',
            'ss': 'siSwati',
            've': 'Tshivenda',
            'ts': 'Xitsonga',
            'nr': 'isiNdebele'
        };
        return languages[code] || code || 'English';
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            }
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (error) {
            return '';
        }
    }
    
    getInitials(name) {
        if (!name || name.trim() === '') return '?';
        const names = name.trim().split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    }
    
    getMostViewedContent(contentData) {
        if (!contentData || contentData.length === 0) return [];
        return [...contentData].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    }
    
    getTrendingContent(contentData) {
        if (!contentData || contentData.length === 0) return [];
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentContent = contentData.filter(item => {
            try {
                const createdAt = new Date(item.created_at);
                return createdAt >= oneWeekAgo;
            } catch {
                return false;
            }
        });
        
        return recentContent.sort((a, b) => {
            const aScore = (a.views || 0) + ((a.likes || 0) * 2);
            const bScore = (b.views || 0) + ((b.likes || 0) * 2);
            return bScore - aScore;
        }).slice(0, 5);
    }
    
    updateTrendingSection() {
        // This would update trending content in real-time
        // For now, we'll just re-render the trending section
        const trendingContent = this.getTrendingContent(this.filteredContentData);
        const trendingSection = document.querySelector('.section[data-type="trending"]');
        
        if (trendingSection && trendingContent.length > 0) {
            const grid = trendingSection.querySelector('.content-grid');
            if (grid) {
                grid.innerHTML = trendingContent.slice(0, 5).map(item => 
                    contentCardSystem?.createTrendingCard ? 
                    contentCardSystem.createTrendingCard(item) :
                    this.createContentCardWithMetrics(item)
                ).join('');
                
                // Re-setup listeners
                this.setupContentCardListenersForSection(trendingSection);
                
                // Load metrics for these cards
                const contentIds = trendingContent.slice(0, 5).map(item => item.id);
                if (contentIds.length > 0 && typeof loadContentMetrics === 'function') {
                    loadContentMetrics(contentIds);
                }
            }
        }
    }
    
    setupContentCardListeners() {
        // Use unified tap for better mobile support
        document.querySelectorAll('.content-card:not(.click-initialized)').forEach(card => {
            card.classList.add('click-initialized');
            
            if (typeof unifiedTap !== 'undefined') {
                unifiedTap(card, (e) => {
                    // Check if clicking on interactive elements
                    if (e.target.closest('.share-btn') || 
                        e.target.closest('.creator-btn') ||
                        e.target.closest('.tip-creator-btn') ||
                        e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'A') {
                        return;
                    }
                    
                    const contentId = card.dataset.contentId;
                    if (contentId) {
                        // Track view
                        if (typeof analyticsSystem !== 'undefined') {
                            analyticsSystem.trackContentInteraction(contentId, 'view');
                        }
                        
                        // Navigate to content detail
                        setTimeout(() => {
                            window.location.href = `content-detail.html?id=${contentId}`;
                        }, 100);
                    }
                }, 50);
            } else {
                // Fallback click handler
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.share-btn') || 
                        e.target.closest('.creator-btn') ||
                        e.target.closest('.tip-creator-btn') ||
                        e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'A') {
                        return;
                    }
                    
                    const contentId = card.dataset.contentId;
                    if (contentId) {
                        window.location.href = `content-detail.html?id=${contentId}`;
                    }
                });
            }
        });
        
        // Share buttons
        document.querySelectorAll('.share-btn:not(.initialized)').forEach(btn => {
            btn.classList.add('initialized');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const contentId = btn.dataset.contentId;
                const content = this.filteredContentData.find(c => c.id == contentId);
                if (content) {
                    this.shareContent(content);
                }
            });
        });
        
        // Creator buttons
        document.querySelectorAll('.creator-btn:not(.initialized)').forEach(btn => {
            btn.classList.add('initialized');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const creatorId = btn.dataset.creatorId;
                const creatorName = btn.dataset.creatorName;
                if (creatorId) {
                    window.location.href = `creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creatorName)}`;
                } else {
                    if (typeof toast !== 'undefined') {
                        toast.error(`Cannot view ${creatorName}'s channel - missing creator information`);
                    }
                }
            });
        });
    }
    
    setupContentCardListenersForSection(section) {
        section.querySelectorAll('.content-card:not(.click-initialized)').forEach(card => {
            card.classList.add('click-initialized');
            
            if (typeof unifiedTap !== 'undefined') {
                unifiedTap(card, (e) => {
                    if (e.target.closest('.share-btn') || 
                        e.target.closest('.creator-btn') ||
                        e.target.closest('.tip-creator-btn') ||
                        e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'A') {
                        return;
                    }
                    
                    const contentId = card.dataset.contentId;
                    if (contentId) {
                        if (typeof analyticsSystem !== 'undefined') {
                            analyticsSystem.trackContentInteraction(contentId, 'view');
                        }
                        
                        setTimeout(() => {
                            window.location.href = `content-detail.html?id=${contentId}`;
                        }, 100);
                    }
                }, 50);
            }
        });
    }
    
    shareContent(content) {
        const title = content.title || 'Amazing Content';
        const creatorName = content.creator || 'Bantu Creator';
        const shareText = `Check out "${title}" by ${creatorName} on Bantu Stream Connect!`;
        const shareUrl = `${window.location.origin}/content-detail.html?id=${content.id}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Amazing content on Bantu Stream Connect',
                text: shareText,
                url: shareUrl
            }).catch(error => {
                console.log('Share failed:', error);
                this.copyToClipboard(`${shareText} ${shareUrl}`);
            });
        } else {
            this.copyToClipboard(`${shareText} ${shareUrl}`);
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof toast !== 'undefined') {
                toast.success('Link copied to clipboard!');
            }
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            if (typeof toast !== 'undefined') {
                toast.success('Link copied to clipboard!');
            }
        });
    }
    
    setupEventListeners() {
        // Search button
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn && typeof searchSystem !== 'undefined') {
            searchBtn.addEventListener('click', () => {
                searchSystem.openSearch();
            });
        }
        
        // Browse all buttons
        const browseAllBtn = document.getElementById('browse-all-btn');
        const browseAllCta = document.getElementById('browse-all-cta');
        
        if (browseAllBtn) {
            browseAllBtn.addEventListener('click', () => {
                window.location.href = 'explore-screen.html';
            });
        }
        
        if (browseAllCta) {
            browseAllCta.addEventListener('click', () => {
                window.location.href = 'content-library.html';
            });
        }
        
        // See all buttons (delegated)
        document.addEventListener('click', (e) => {
            const seeAllBtn = e.target.closest('[data-action="see-all"]');
            if (seeAllBtn) {
                const target = seeAllBtn.dataset.target;
                this.handleSeeAllClick(target);
            }
        });
        
        // Performance metrics toggle
        const toggleMetrics = document.getElementById('toggle-performance');
        if (toggleMetrics) {
            toggleMetrics.addEventListener('click', () => {
                const metricsDisplay = document.getElementById('performance-metrics');
                if (metricsDisplay) {
                    metricsDisplay.classList.toggle('active');
                }
            });
        }
        
        // Error recovery modal
        const retryBtn = document.getElementById('retry-connection');
        const continueBtn = document.getElementById('continue-offline');
        const reportBtn = document.getElementById('report-issue');
        const errorModal = document.getElementById('error-recovery-modal');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                if (errorModal) errorModal.style.display = 'none';
                // Continue with cached content
                if (typeof toast !== 'undefined') {
                    toast.info('Continuing with cached content');
                }
            });
        }
        
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                if (typeof toast !== 'undefined') {
                    toast.success('Issue reported. Thank you!');
                }
                if (errorModal) errorModal.style.display = 'none';
            });
        }
        
        if (errorModal) {
            errorModal.addEventListener('click', (e) => {
                if (e.target === errorModal) {
                    errorModal.style.display = 'none';
                }
            });
        }
        
        // Keyboard shortcuts help
        const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
        if (closeShortcutsBtn) {
            closeShortcutsBtn.addEventListener('click', () => {
                const helpModal = document.getElementById('keyboard-shortcuts-help');
                if (helpModal) {
                    helpModal.classList.remove('active');
                }
            });
        }
        
        // Badges modal close
        const closeBadges = document.getElementById('close-badges');
        if (closeBadges) {
            closeBadges.addEventListener('click', () => {
                const badgesModal = document.getElementById('badges-modal');
                if (badgesModal) {
                    badgesModal.classList.remove('active');
                }
            });
        }
        
        // Tip modal close
        const closeTip = document.getElementById('close-tip');
        if (closeTip) {
            closeTip.addEventListener('click', () => {
                const tipModal = document.getElementById('tip-modal');
                if (tipModal) {
                    tipModal.classList.remove('active');
                }
            });
        }
        
        // Listen for scale changes to update UI
        document.addEventListener('scaleChanged', (e) => {
            console.log('Scale changed to:', e.detail.scale);
            // Update any UI elements that need to adjust to scale
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            // Ctrl+K or Cmd+K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (typeof searchSystem !== 'undefined') {
                    searchSystem.openSearch();
                }
            }
            
            // Ctrl+R for refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshContent();
            }
            
            // Ctrl+Plus for increase scale
            if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                if (window.uiScaleController) {
                    window.uiScaleController.increase();
                }
            }
            
            // Ctrl+Minus for decrease scale
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                if (window.uiScaleController) {
                    window.uiScaleController.decrease();
                }
            }
            
            // Ctrl+0 for reset scale
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                if (window.uiScaleController) {
                    window.uiScaleController.reset();
                }
            }
            
            // Space to play/pause video preview
            if (e.key === ' ' && !e.target.tagName === 'BUTTON') {
                e.preventDefault();
                this.handleSpaceKey();
            }
        });
    }
    
    handleSpaceKey() {
        if (typeof videoPreviewSystem !== 'undefined') {
            const currentPreview = videoPreviewSystem.currentPreview;
            if (currentPreview) {
                if (currentPreview.paused) {
                    currentPreview.play().catch(e => console.log('Play failed:', e));
                } else {
                    currentPreview.pause();
                }
            }
        }
    }
    
    handleSeeAllClick(target) {
        switch(target) {
            case 'trending':
                window.location.href = 'trending-screen.html';
                break;
            case 'continue-watching':
                window.location.href = 'continue-watching.html';
                break;
            case 'recommendations':
                window.location.href = 'recommendations.html';
                break;
            default:
                window.location.href = 'content-library.html';
        }
    }
    
    async refreshContent() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        if (typeof toast !== 'undefined') {
            toast.info('Refreshing content...');
        }
        
        try {
            const freshContent = await this.fetchHomeFeedContent();
            if (freshContent.length > 0) {
                this.allContentData = freshContent;
                this.filteredContentData = freshContent;
                if (typeof stateManager !== 'undefined') {
                    stateManager.setState({ content: freshContent, filtered: freshContent });
                }
                
                if (typeof cacheManager?.cacheContent === 'function') {
                    await cacheManager.cacheContent(freshContent);
                }
                this.renderContentSections();
                
                // Refresh explore features
                if (typeof loadCommunityStats === 'function') {
                    loadCommunityStats();
                }
                if (typeof loadShorts === 'function') {
                    loadShorts();
                }
                if (typeof initVideoHero === 'function') {
                    initVideoHero();
                }
                
                if (typeof toast !== 'undefined') {
                    toast.success('Content refreshed!');
                }
            }
        } catch (error) {
            console.error('Error refreshing content:', error);
            if (typeof toast !== 'undefined') {
                toast.error('Failed to refresh content');
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    finalizeInitialization() {
        // Hide loading screen completely
        const loadingScreen = document.getElementById('loading');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Show app
        const app = document.getElementById('app');
        if (app) {
            app.style.display = 'block';
        }
        
        // Setup pull-to-refresh for mobile
        this.setupPullToRefresh();
        
        // Register service worker if not already
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
        }
        
        // Send analytics event
        if (typeof analyticsSystem !== 'undefined') {
            analyticsSystem.trackEvent('app_initialized', {
                load_time: Date.now() - (performanceMonitor?.sessionStart || Date.now()),
                content_count: this.allContentData.length,
                has_cache: cacheManager?.getCachedContent ? cacheManager.getCachedContent() !== null : false
            });
        }
        
        console.log('🎉 Home Feed ready!');
    }
    
    setupPullToRefresh() {
        if (!('ontouchstart' in window)) return;
        
        let startY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            const currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 50) {
                // Show pull to refresh indicator
                this.showPullToRefreshIndicator(pullDistance);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!isPulling) return;
            
            isPulling = false;
            this.hidePullToRefreshIndicator();
            
            const currentY = e.changedTouches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 100) {
                this.refreshContent();
            }
        }, { passive: true });
    }
    
    showPullToRefreshIndicator(pullDistance) {
        // Implementation would show a pull-to-refresh UI
        // For now, we'll just log
        if (pullDistance > 100) {
            console.log('Pull to refresh triggered');
        }
    }
    
    hidePullToRefreshIndicator() {
        // Hide the pull-to-refresh UI
    }
}

// ============================================
// INITIALIZE THE APP
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const app = new HomeFeedApp();
    
    try {
        await app.init();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        
        // Show error state
        const loadingScreen = document.getElementById('loading');
        const appContainer = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="color: var(--error-color); font-size: 48px; margin-bottom: 20px;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3 style="color: var(--soft-white); margin-bottom: 10px;">Failed to Load</h3>
                    <p style="color: var(--slate-grey); margin-bottom: 20px;">There was an error loading the application.</p>
                    <button onclick="window.location.reload()" style="background: var(--bantu-blue); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
        
        if (appContainer) {
            appContainer.style.display = 'none';
        }
    }
});

// Make app instance available globally for debugging
window.HomeFeedApp = HomeFeedApp;
