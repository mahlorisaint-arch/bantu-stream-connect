// Main Home Feed Application
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
        
        // Initialize feature systems
        this.initializeFeatureSystems();
        
        // Initialize utilities
        this.initializeUtilities();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check authentication
        await this.checkAuthentication();
        
        // Load content with phased loading
        await this.loadContentWithPhasedLoading();
        
        // Final initialization
        this.finalizeInitialization();
        
        console.log('✅ Home Feed fully initialized');
    }
    
    async initializeCoreSystems() {
        console.log('🔄 Initializing core systems...');
        
        // Initialize cache manager
        await cacheManager.init();
        
        // Initialize performance monitor
        performanceMonitor.reportMetrics();
        
        // Load initial state
        const cachedContent = cacheManager.getCachedContent();
        if (cachedContent) {
            this.allContentData = cachedContent;
            this.filteredContentData = cachedContent;
            stateManager.setState({ content: cachedContent, filtered: cachedContent });
        }
    }
    
    initializeUISystems() {
        console.log('🔄 Initializing UI systems...');
        
        // Initialize development window (always visible)
        developmentWindow.init();
        
        // Initialize navigation
        navigationSystem.init();
        
        // Initialize theme system
        themeSystem.init();
        
        // Initialize content card system
        contentCardSystem.init();
        
        // Initialize modals
        searchModal.init();
        analyticsModal.init();
    }
    
    initializeFeatureSystems() {
        console.log('🔄 Initializing feature systems...');
        
        // Initialize video preview system
        videoPreviewSystem.init();
        
        // Initialize recommendation engine
        recommendationEngine.init();
        
        // Initialize notification system
        notificationSystem.init();
        
        // Initialize analytics system
        analyticsSystem.init();
        
        // Initialize search system
        searchSystem.init();
        
        // Initialize continue watching system
        continueWatchingSystem.init();
    }
    
    initializeUtilities() {
        console.log('🔄 Initializing utilities...');
        
        // Initialize accessibility
        accessibility.init();
        
        // Initialize animations
        animations.init();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    async checkAuthentication() {
        const { data: { session }, error } = await supabaseAuth.auth.getSession();
        const isAuthenticated = !!session;
        
        console.log(`🔐 User ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);
        
        // Update user state
        stateManager.setState({ user: session?.user || null });
        
        // Update recommendation engine status
        recommendationEngine.isUserLoggedIn = isAuthenticated;
        
        // Load user profile picture if authenticated
        if (isAuthenticated) {
            await this.loadUserProfilePicture(session.user);
        }
        
        // Setup profile button
        this.setupProfileButton(isAuthenticated, session?.user);
        
        // Listen for auth state changes
        supabaseAuth.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            this.handleAuthStateChange(event, session);
        });
    }
    
    async loadUserProfilePicture(user) {
        try {
            const profileBtn = document.getElementById('profile-btn');
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
            recommendationEngine.isUserLoggedIn = true;
            stateManager.setState({ user: session.user });
            
            if (session?.user) {
                this.loadUserProfilePicture(session.user);
                toast.success(`Welcome back, ${session.user.email}!`);
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            recommendationEngine.isUserLoggedIn = false;
            stateManager.setState({ user: null });
            
            const profileBtn = document.getElementById('profile-btn');
            if (profileBtn) {
                profileBtn.innerHTML = `
                    <div class="profile-placeholder">
                        <i class="fas fa-user"></i>
                    </div>
                `;
            }
            
            toast.info('Signed out successfully');
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
                    stateManager.setState({ content: freshContent, filtered: freshContent });
                    
                    // Cache the content
                    await cacheManager.cacheContent(freshContent);
                    
                    // Render with fresh content
                    this.renderContentSections();
                    
                    // Show toast if we updated from cache
                    if (this.allContentData.length > 0) {
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
                    toast.error('Using sample data. Check your connection.');
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
            }, 1000);
        }, 50);
        
        await this.phasedLoader.execute();
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
                    media_type: item.media_type || 'video',
                    genre: item.genre,
                    created_at: item.created_at,
                    creator: creatorName,
                    creator_display_name: creatorName,
                    creator_id: item.creator_id || item.user_id,
                    user_id: item.user_id,
                    views: item.views_count || item.views || 0,
                    likes: item.likes_count || item.likes || 0
                };
            });
            
            console.log('✅ Processed content:', processedData.length, 'items');
            return processedData;
            
        } catch (error) {
            console.error('❌ Error fetching content:', error);
            throw error;
        }
    }
    
    getTestContent() {
        return [
            {
                id: 1,
                title: 'African Music Festival Highlights',
                description: 'Highlights from the biggest African music festival',
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
                likes: 890
            },
            {
                id: 2,
                title: 'Tech Innovation in Africa',
                description: 'How technology is transforming African economies',
                thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                media_type: 'video',
                genre: 'STEM',
                created_at: new Date().toISOString(),
                creator: '@tech_africa',
                creator_display_name: 'Tech Africa',
                creator_id: '2',
                user_id: '2',
                views: 8900,
                likes: 650
            },
            {
                id: 3,
                title: 'Traditional Dance Performance',
                description: 'Beautiful traditional dance from West Africa',
                thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
                file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                media_type: 'video',
                genre: 'Culture',
                created_at: new Date().toISOString(),
                creator: '@cultural_hub',
                creator_display_name: 'Cultural Hub',
                creator_id: '3',
                user_id: '3',
                views: 15600,
                likes: 1200
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
            'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop'
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
        const personalizedRecommendations = recommendationEngine.getPersonalizedRecommendations(this.filteredContentData);
        const trendingFallback = recommendationEngine.getTrendingFallback(this.filteredContentData);
        
        // Determine what to show in Recommended For You section
        const showRecommendedSection = recommendationEngine.isUserLoggedIn || trendingFallback.length > 0;
        const recommendedContent = personalizedRecommendations.length > 0 ? personalizedRecommendations : trendingFallback;
        
        // Get continue watching
        const continueWatching = continueWatchingSystem.getContinueWatchingContent(this.filteredContentData);
        
        // Get trending content
        const trendingContent = this.getTrendingContent(this.filteredContentData);
        
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
                            contentCardSystem.createContentCard(item, { showContinueWatching: true })
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        // Recommended For You Section
        if (showRecommendedSection && recommendedContent.length > 0) {
            const description = !recommendationEngine.isUserLoggedIn 
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
                            contentCardSystem.createRecommendedCard(item)
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
                        contentCardSystem.createContentCard(item)
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
                            contentCardSystem.createTrendingCard(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        // Most Viewed
        const mostViewed = this.getMostViewedContent(this.filteredContentData);
        if (mostViewed.length > 0) {
            sectionsHTML += `
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Most Viewed</h2>
                        <button class="see-all-btn" data-action="see-all" data-target="content-library">See All</button>
                    </div>
                    <div class="content-grid">
                        ${mostViewed.slice(0, 5).map(item => 
                            contentCardSystem.createContentCard(item)
                        ).join('')}
                    </div>
                </section>
            `;
        }
        
        contentSections.innerHTML = sectionsHTML;
        
        // Setup event listeners for the new content
        this.setupContentCardListeners();
    }
    
    getMostViewedContent(contentData) {
        if (!contentData || contentData.length === 0) return [];
        return [...contentData].sort((a, b) => b.views - a.views).slice(0, 5);
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
                    contentCardSystem.createTrendingCard(item)
                ).join('');
                
                // Re-setup listeners
                this.setupContentCardListenersForSection(trendingSection);
            }
        }
    }
    
    setupContentCardListeners() {
        // Use unified tap for better mobile support
        document.querySelectorAll('.content-card:not(.click-initialized)').forEach(card => {
            card.classList.add('click-initialized');
            
            unifiedTap(card, (e) => {
                // Check if clicking on interactive elements
                if (e.target.closest('.share-btn') || 
                    e.target.closest('.creator-btn') ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'A') {
                    return;
                }
                
                const contentId = card.dataset.contentId;
                if (contentId) {
                    // Track view
                    analyticsSystem.trackContentInteraction(contentId, 'view');
                    
                    // Navigate to content detail
                    setTimeout(() => {
                        window.location.href = `content-detail.html?id=${contentId}`;
                    }, 100);
                }
            }, 50);
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
                    toast.error(`Cannot view ${creatorName}'s channel - missing creator information`);
                }
            });
        });
    }
    
    setupContentCardListenersForSection(section) {
        section.querySelectorAll('.content-card:not(.click-initialized)').forEach(card => {
            card.classList.add('click-initialized');
            
            unifiedTap(card, (e) => {
                if (e.target.closest('.share-btn') || 
                    e.target.closest('.creator-btn') ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'A') {
                    return;
                }
                
                const contentId = card.dataset.contentId;
                if (contentId) {
                    analyticsSystem.trackContentInteraction(contentId, 'view');
                    
                    setTimeout(() => {
                        window.location.href = `content-detail.html?id=${contentId}`;
                    }, 100);
                }
            }, 50);
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
            toast.success('Link copied to clipboard!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            toast.success('Link copied to clipboard!');
        });
    }
    
    setupEventListeners() {
        // Search button
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
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
                toast.info('Continuing with cached content');
            });
        }
        
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                toast.success('Issue reported. Thank you!');
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
                searchSystem.openSearch();
            }
            
            // Ctrl+R for refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshContent();
            }
            
            // Space to play/pause video preview
            if (e.key === ' ' && !e.target.tagName === 'BUTTON') {
                e.preventDefault();
                this.handleSpaceKey();
            }
        });
    }
    
    handleSpaceKey() {
        const currentPreview = videoPreviewSystem.currentPreview;
        if (currentPreview) {
            if (currentPreview.paused) {
                currentPreview.play().catch(e => console.log('Play failed:', e));
            } else {
                currentPreview.pause();
            }
        }
    }
    
    handleSeeAllClick(target) {
        switch(target) {
            case 'trending':
                window.location.href = 'trending_screen.html';
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
        toast.info('Refreshing content...');
        
        try {
            const freshContent = await this.fetchHomeFeedContent();
            if (freshContent.length > 0) {
                this.allContentData = freshContent;
                this.filteredContentData = freshContent;
                stateManager.setState({ content: freshContent, filtered: freshContent });
                
                await cacheManager.cacheContent(freshContent);
                this.renderContentSections();
                
                toast.success('Content refreshed!');
            }
        } catch (error) {
            console.error('Error refreshing content:', error);
            toast.error('Failed to refresh content');
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
        analyticsSystem.trackEvent('app_initialized', {
            load_time: Date.now() - performanceMonitor.sessionStart,
            content_count: this.allContentData.length,
            has_cache: cacheManager.getCachedContent() !== null
        });
        
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

// Initialize the app when DOM is loaded
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
