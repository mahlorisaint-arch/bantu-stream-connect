/**
 * Creator of the Week Module
 * Displays featured creators with scoring system, Swiper carousel,
 * and creator spotlight functionality.
 * 
 * FIXED: Proper loading states, Swiper initialization timing,
 * and mobile responsiveness. Added debugging for visibility issues.
 * FIXED: Infinite loading issue - proper error handling and fallback content
 * ADDED: Extensive debugging to identify visibility issues
 */

const CreatorOfTheWeek = (function() {
    'use strict';
    
    // Private variables
    let creatorsList = null;
    let swiperInstance = null;
    let currentUser = null;
    let refreshInterval = null;
    let featuredCreators = [];
    let initPromise = null;
    let isLoading = false;
    let isInitialized = false;
    
    // Configuration
    const CACHE_KEY = 'feed_creators';
    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    const MAX_CREATORS = 12;
    const DISPLAY_CREATORS = 6;
    const REFRESH_INTERVAL = 600000; // 10 minutes
    
    // Creator scoring weights
    const SCORE_WEIGHTS = {
        CONTENT_COUNT: 2,
        CONNECTOR_COUNT: 1,
        ENGAGEMENT_RATE: 1.5,
        RECENCY_BOOST: 1.2
    };
    
    /**
     * Initialize Creator of the Week module
     */
    async function init() {
        // Prevent multiple initializations
        if (initPromise) {
            console.log('⭐ Creator of the Week already initializing, waiting...');
            return initPromise;
        }
        
        if (isLoading) {
            console.log('⭐ Creator of the Week already loading, skipping...');
            return;
        }
        
        if (isInitialized) {
            console.log('⭐ Creator of the Week already initialized, skipping...');
            return;
        }
        
        isLoading = true;
        initPromise = (async () => {
            try {
                console.log('⭐ Creator of the Week Module initializing...');
                
                // Make sure swiper container exists with navigation buttons
                ensureSwiperContainer();
                
                creatorsList = document.getElementById('creators-list');
                
                if (!creatorsList) {
                    console.warn('Creators list element not found, creating fallback');
                    createFallbackElements();
                    creatorsList = document.getElementById('creators-list');
                }
                
                // DEBUG: Log element status
                console.log('🔍 DEBUG: creatorsList element:', creatorsList);
                console.log('🔍 DEBUG: creatorsList parent:', creatorsList?.parentElement);
                
                // Get current user
                await getCurrentUser();
                
                // Load content
                await loadCreators();
                
                // Setup see all button
                setupSeeAllButton();
                
                // Start background refresh
                startBackgroundRefresh();
                
                // Setup resize handler for Swiper
                window.addEventListener('resize', () => {
                    if (swiperInstance && swiperInstance.destroyed === false) {
                        setTimeout(() => {
                            if (swiperInstance && swiperInstance.update) {
                                swiperInstance.update();
                            }
                        }, 100);
                    }
                });
                
                isInitialized = true;
                console.log('✅ Creator of the Week Module initialized');
                
            } catch (err) {
                console.error('❌ Creator of the Week initialization error:', err);
                showErrorState();
            } finally {
                isLoading = false;
                initPromise = null;
            }
        })();
        
        return initPromise;
    }
    
    /**
     * Ensure swiper container has navigation buttons
     */
    function ensureSwiperContainer() {
        const swiperContainer = document.getElementById('creators-swiper');
        if (swiperContainer && !swiperContainer.querySelector('.swiper-button-next')) {
            // Add navigation buttons
            const prevBtn = document.createElement('div');
            prevBtn.className = 'swiper-button-prev';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            
            const nextBtn = document.createElement('div');
            nextBtn.className = 'swiper-button-next';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            
            swiperContainer.appendChild(prevBtn);
            swiperContainer.appendChild(nextBtn);
        }
    }
    
    /**
     * Create fallback elements if not present in DOM
     */
    function createFallbackElements() {
        // Check if swiper container exists
        let swiperContainer = document.getElementById('creators-swiper');
        
        if (!swiperContainer) {
            const featuredCreatorsDiv = document.querySelector('.featured-creators');
            if (featuredCreatorsDiv) {
                featuredCreatorsDiv.innerHTML = `
                    <div class="swiper" id="creators-swiper">
                        <div class="swiper-wrapper" id="creators-list"></div>
                        <div class="swiper-pagination"></div>
                        <div class="swiper-button-prev"></div>
                        <div class="swiper-button-next"></div>
                    </div>
                `;
            } else {
                // Find or create the section
                let section = document.getElementById('creator-of-the-week-section');
                if (!section) {
                    section = document.createElement('section');
                    section.id = 'creator-of-the-week-section';
                    section.className = 'section';
                    section.innerHTML = `
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fas fa-star" style="color: var(--warm-gold);"></i>
                                CREATOR OF THE WEEK
                                <span class="creator-week-badge">
                                    <i class="fas fa-crown"></i> Featured
                                </span>
                            </h2>
                            <a href="https://bantustreamconnect.com/creators" class="see-all-btn">
                                See All
                                <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                        <div class="featured-creators">
                            <div class="swiper" id="creators-swiper">
                                <div class="swiper-wrapper" id="creators-list"></div>
                                <div class="swiper-pagination"></div>
                                <div class="swiper-button-prev"></div>
                                <div class="swiper-button-next"></div>
                            </div>
                        </div>
                    `;
                    
                    const latestGemsSection = document.getElementById('latest-gems-section');
                    if (latestGemsSection && latestGemsSection.parentNode) {
                        latestGemsSection.insertAdjacentElement('afterend', section);
                    } else {
                        const main = document.querySelector('main.container');
                        if (main) main.appendChild(section);
                    }
                }
            }
        }
        
        creatorsList = document.getElementById('creators-list');
    }
    
    /**
     * Get current user from Supabase
     */
    async function getCurrentUser() {
        try {
            if (!window.supabaseAuth) {
                currentUser = null;
                return;
            }
            
            const { data: { session } } = await window.supabaseAuth.auth.getSession();
            currentUser = session?.user || null;
            console.log('⭐ Creator of the Week user:', currentUser ? currentUser.id : 'guest');
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load featured creators
     */
    async function loadCreators() {
        console.log('⭐ Loading Creator of the Week...');
        
        // Make sure creatorsList exists
        if (!creatorsList) {
            console.warn('Creators list still not available, retrying...');
            creatorsList = document.getElementById('creators-list');
            if (!creatorsList) {
                createFallbackElements();
                creatorsList = document.getElementById('creators-list');
                if (!creatorsList) {
                    console.error('Cannot find creators list element');
                    showErrorState();
                    return;
                }
            }
        }
        
        // Try cached data first
        const cachedData = loadFromCache();
        if (cachedData && cachedData.length > 0) {
            console.log('📦 Creators: Using cached data,', cachedData.length, 'items');
            featuredCreators = cachedData;
            renderCreators(cachedData);
            initializeSwiper();
            return;
        }
        
        // Show skeletons
        showSkeletons();
        
        try {
            const creators = await fetchFeaturedCreators();
            
            if (!creators || creators.length === 0) {
                console.log('No creators found, showing empty state');
                showEmptyState();
                return;
            }
            
            console.log(`📊 Fetched ${creators.length} creators, calculating scores...`);
            
            // Calculate scores and sort
            const scoredCreators = calculateCreatorScores(creators);
            const topCreators = scoredCreators.slice(0, DISPLAY_CREATORS);
            
            // Add week badge to top creator
            if (topCreators.length > 0) {
                topCreators[0].isCreatorOfTheWeek = true;
            }
            
            featuredCreators = topCreators;
            
            console.log(`🏆 Top ${topCreators.length} creators selected`);
            
            // DEBUG: Log the rendered HTML before rendering
            console.log('🔍 DEBUG: About to render creators, container exists:', !!creatorsList);
            console.log('🔍 DEBUG: Container dimensions:', creatorsList?.getBoundingClientRect());
            
            // Render
            renderCreators(topCreators);
            
            // DEBUG: Log after rendering
            console.log('🔍 DEBUG: After render, creatorsList innerHTML length:', creatorsList?.innerHTML?.length);
            console.log('🔍 DEBUG: Number of .swiper-slide elements:', document.querySelectorAll('#creators-list .swiper-slide').length);
            console.log('🔍 DEBUG: Number of .creator-card elements:', document.querySelectorAll('.creator-card').length);
            
            // Initialize Swiper with a small delay to ensure DOM is ready
            setTimeout(() => {
                initializeSwiper();
            }, 100);
            
            // Cache the result
            saveToCache(topCreators);
            
            console.log('✅ Creator of the Week loaded:', topCreators.length, 'creators');
            
            // Log creator names for debugging
            topCreators.forEach((creator, idx) => {
                console.log(`  ${idx + 1}. ${creator.full_name || creator.username} (Score: ${creator.creator_score})`);
            });
            
            // Add spotlight animation to top creator
            setTimeout(() => {
                const topCard = document.querySelector('.creator-card.creator-of-week');
                if (topCard) {
                    topCard.classList.add('spotlight');
                    setTimeout(() => topCard.classList.remove('spotlight'), 2000);
                }
            }, 500);
            
        } catch (err) {
            console.error("❌ Creator of the Week Error:", err);
            const cached = loadFromCache();
            if (cached && cached.length > 0) {
                featuredCreators = cached;
                renderCreators(cached);
                initializeSwiper();
            } else {
                showErrorState();
            }
        }
    }
    
    /**
     * Fetch featured creators from Supabase
     */
    async function fetchFeaturedCreators() {
        if (!window.supabaseAuth) {
            console.warn('SupabaseAuth not available');
            return [];
        }
        
        try {
            // Get content counts per creator
            const { data: contentData, error: contentError } = await window.supabaseAuth
                .from('Content')
                .select('user_id')
                .eq('status', 'published');
            
            if (contentError) {
                console.warn('Error fetching content data:', contentError.message);
            }
            
            const contentCountMap = new Map();
            contentData?.forEach(item => {
                if (item.user_id) {
                    contentCountMap.set(item.user_id, (contentCountMap.get(item.user_id) || 0) + 1);
                }
            });
            
            console.log(`📊 Found ${contentCountMap.size} creators with content`);
            
            // Get connector counts per creator
            const { data: connectorData, error: connectorError } = await window.supabaseAuth
                .from('connectors')
                .select('connected_id')
                .eq('connection_type', 'creator');
            
            if (connectorError) {
                console.warn('Error fetching connector data:', connectorError.message);
            }
            
            const connectorCountMap = new Map();
            connectorData?.forEach(item => {
                if (item.connected_id) {
                    connectorCountMap.set(item.connected_id, (connectorCountMap.get(item.connected_id) || 0) + 1);
                }
            });
            
            // Get user profiles that have content
            const creatorIds = Array.from(contentCountMap.keys());
            
            if (creatorIds.length === 0) {
                console.log('No creators with content found');
                return [];
            }
            
            const { data: profiles, error: profilesError } = await window.supabaseAuth
                .from('user_profiles')
                .select('*')
                .in('id', creatorIds.slice(0, MAX_CREATORS * 2));
            
            if (profilesError) {
                console.warn('Error fetching profiles:', profilesError.message);
                return [];
            }
            
            if (!profiles || profiles.length === 0) {
                return [];
            }
            
            // Get engagement metrics from content_engagement_stats
            const { data: engagementData, error: engagementError } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_likes');
            
            if (engagementError) {
                console.warn('Error fetching engagement metrics:', engagementError.message);
            }
            
            // Map content to creator for likes
            const contentToCreator = new Map();
            contentData?.forEach(c => {
                if (c.user_id) {
                    contentToCreator.set(c.id, c.user_id);
                }
            });
            
            const creatorLikesMap = new Map();
            engagementData?.forEach(stat => {
                const creatorId = contentToCreator.get(stat.content_id);
                if (creatorId) {
                    creatorLikesMap.set(creatorId, (creatorLikesMap.get(creatorId) || 0) + (stat.total_likes || 0));
                }
            });
            
            return profiles.map(profile => {
                const videoCount = contentCountMap.get(profile.id) || 0;
                const likeCount = creatorLikesMap.get(profile.id) || 0;
                
                return {
                    ...profile,
                    video_count: videoCount,
                    connector_count: connectorCountMap.get(profile.id) || 0,
                    like_count: likeCount,
                    engagement_rate: videoCount > 0 ? likeCount / videoCount : 0
                };
            });
            
        } catch (err) {
            console.error('Error fetching featured creators:', err);
            return [];
        }
    }
    
    /**
     * Calculate creator scores based on multiple factors
     */
    function calculateCreatorScores(creators) {
        return creators.map(creator => {
            let score = 0;
            
            // Content count contribution (max weight)
            score += (creator.video_count || 0) * SCORE_WEIGHTS.CONTENT_COUNT;
            
            // Connector count contribution
            score += (creator.connector_count || 0) * SCORE_WEIGHTS.CONNECTOR_COUNT;
            
            // Engagement rate contribution
            score += (creator.engagement_rate || 0) * SCORE_WEIGHTS.ENGAGEMENT_RATE * 50;
            
            // Ensure minimum score for creators with content
            if (score === 0 && creator.video_count > 0) {
                score = 10;
            }
            
            // Recency boost (newer creators get slight boost)
            if (creator.created_at) {
                const daysSinceJoin = (new Date() - new Date(creator.created_at)) / (1000 * 60 * 60 * 24);
                if (daysSinceJoin < 30) {
                    score *= SCORE_WEIGHTS.RECENCY_BOOST;
                    creator.is_new = true;
                }
            }
            
            // Check if creator is verified (has high connector count)
            if (creator.connector_count > 500) {
                creator.is_verified = true;
                score *= 1.1;
            }
            
            creator.creator_score = Math.round(score);
            
            return creator;
        }).sort((a, b) => b.creator_score - a.creator_score).filter(c => c.video_count > 0);
    }
    
    /**
     * Render creators cards
     */
    function renderCreators(creators) {
        if (!creatorsList) return;
        
        if (!creators || creators.length === 0) {
            showEmptyState();
            return;
        }
        
        const html = creators.map((creator, index) => {
            const avatarUrl = creator.avatar_url ? fixAvatarUrl(creator.avatar_url) : null;
            const bio = creator.bio || 'Passionate content creator sharing authentic stories and experiences from South Africa.';
            const truncatedBio = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
            const fullName = creator.full_name || creator.username || 'Creator';
            const username = creator.username || 'creator';
            const initials = getInitials(fullName);
            const videoCount = creator.video_count || 0;
            const connectorCount = creator.connector_count || 0;
            const isTopCreator = videoCount > 5 || connectorCount > 100;
            const isCreatorOfWeek = creator.isCreatorOfTheWeek || index === 0;
            const isVerified = creator.is_verified || connectorCount > 500;
            const isNew = creator.is_new;
            
            return `
                <div class="swiper-slide">
                    <div class="creator-card ${isCreatorOfWeek ? 'creator-of-week' : ''}">
                        ${isCreatorOfWeek ? '<div class="creator-week-special"><i class="fas fa-crown"></i> CREATOR OF THE WEEK</div>' : ''}
                        ${isTopCreator && !isCreatorOfWeek ? '<div class="founder-badge"><i class="fas fa-fire"></i> TOP CREATOR</div>' : ''}
                        ${isNew && !isCreatorOfWeek ? '<div class="founder-badge" style="background: #10B981;"><i class="fas fa-sparkle"></i> NEW</div>' : ''}
                        <div class="creator-avatar">
                            ${avatarUrl ? `
                                <img src="${avatarUrl}" 
                                     alt="${escapeHtml(fullName)}" 
                                     loading="lazy" 
                                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'creator-initials\\'>${initials}</div>';">
                                <div class="avatar-overlay">
                                    <i class="fas fa-camera" style="color: white; font-size: 12px;"></i>
                                </div>
                            ` : `
                                <div class="creator-initials creator-initials-large">${initials}</div>
                            `}
                        </div>
                        <div class="creator-name">
                            ${escapeHtml(fullName)}
                            ${isVerified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
                        </div>
                        <div class="creator-username">@${escapeHtml(username)}</div>
                        <div class="creator-bio">${escapeHtml(truncatedBio)}</div>
                        <div class="creator-stats">
                            <div class="stat">
                                <div class="stat-number">${videoCount}</div>
                                <div class="stat-label">Videos</div>
                            </div>
                            <div class="stat">
                                <div class="stat-number">${formatNumber(connectorCount)}</div>
                                <div class="stat-label">Connectors</div>
                            </div>
                            <div class="stat">
                                <div class="stat-number">${creator.creator_score || 0}</div>
                                <div class="stat-label">Impact Score</div>
                            </div>
                        </div>
                        <div class="creator-actions">
                            <button class="view-channel-btn" data-creator-id="${creator.id}">
                                <i class="fas fa-eye"></i> View Channel
                            </button>
                            <button class="tip-creator-btn" data-creator-id="${creator.id}" data-creator-name="${escapeHtml(fullName)}">
                                <i class="fas fa-gift"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        creatorsList.innerHTML = html;
        
        // DEBUG: Verify HTML was inserted
        console.log('🔍 DEBUG: HTML inserted into creatorsList, length:', html.length);
        console.log('🔍 DEBUG: First 200 chars of HTML:', html.substring(0, 200));
        
        // Attach event listeners to buttons
        attachButtonListeners();
        
        // DEBUG: Check if creator cards are visible
        const cards = document.querySelectorAll('.creator-card');
        console.log(`🔍 DEBUG: Found ${cards.length} creator cards in DOM`);
        if (cards.length > 0) {
            const firstCard = cards[0];
            const styles = window.getComputedStyle(firstCard);
            console.log('🔍 DEBUG: First card styles - display:', styles.display);
            console.log('🔍 DEBUG: First card styles - visibility:', styles.visibility);
            console.log('🔍 DEBUG: First card styles - opacity:', styles.opacity);
            console.log('🔍 DEBUG: First card offsetHeight:', firstCard.offsetHeight);
            console.log('🔍 DEBUG: First card offsetWidth:', firstCard.offsetWidth);
            console.log('🔍 DEBUG: First card parent element:', firstCard.parentElement?.className);
        }
        
        // Log rendered creators for debugging
        console.log(`🎨 Rendered ${creators.length} creator cards`);
    }
    
    /**
     * Attach event listeners to creator action buttons
     */
    function attachButtonListeners() {
        // View channel buttons
        document.querySelectorAll('.view-channel-btn').forEach(btn => {
            btn.removeEventListener('click', handleViewChannel);
            btn.addEventListener('click', handleViewChannel);
        });
        
        // Tip creator buttons
        document.querySelectorAll('.tip-creator-btn').forEach(btn => {
            btn.removeEventListener('click', handleTipCreator);
            btn.addEventListener('click', handleTipCreator);
        });
    }
    
    function handleViewChannel(e) {
        e.preventDefault();
        e.stopPropagation();
        const creatorId = e.currentTarget.dataset.creatorId;
        if (creatorId) {
            window.location.href = `creator-channel.html?id=${creatorId}`;
        }
    }
    
    function handleTipCreator(e) {
        e.preventDefault();
        e.stopPropagation();
        const creatorId = e.currentTarget.dataset.creatorId;
        const creatorName = e.currentTarget.dataset.creatorName;
        openTipModal(creatorId, creatorName);
    }
    
    /**
     * Open tip modal for creator
     */
    function openTipModal(creatorId, creatorName) {
        if (!currentUser) {
            showToast('Please sign in to support creators', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // Dispatch custom event for tip modal
        const tipEvent = new CustomEvent('openTipModal', {
            detail: { creatorId, creatorName }
        });
        document.dispatchEvent(tipEvent);
        
        // Fallback if modal system not available
        showToast(`Support ${creatorName} with a tip!`, 'info');
    }
    
    /**
     * Initialize Swiper carousel
     */
    function initializeSwiper() {
        // Check if Swiper is available
        if (typeof Swiper === 'undefined') {
            console.warn('Swiper not loaded, retrying in 500ms');
            setTimeout(initializeSwiper, 500);
            return;
        }
        
        // Check if swiper container exists
        const swiperContainer = document.querySelector('#creators-swiper');
        if (!swiperContainer) {
            console.warn('Swiper container not found');
            return;
        }
        
        // Check if there are slides
        const slides = document.querySelectorAll('#creators-list .swiper-slide');
        if (slides.length === 0) {
            console.warn('No slides found for swiper');
            return;
        }
        
        console.log(`🔄 Initializing Swiper with ${slides.length} slides`);
        
        // DEBUG: Log swiper container dimensions
        console.log('🔍 DEBUG: Swiper container dimensions:', swiperContainer.getBoundingClientRect());
        console.log('🔍 DEBUG: Swiper container parent:', swiperContainer.parentElement?.className);
        
        // Destroy existing swiper instance
        if (swiperInstance && swiperInstance.destroy) {
            swiperInstance.destroy(true, true);
            swiperInstance = null;
        }
        
        // Wait for DOM to be fully ready
        setTimeout(() => {
            try {
                swiperInstance = new Swiper('#creators-swiper', {
                    slidesPerView: 1,
                    spaceBetween: 20,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    breakpoints: {
                        640: {
                            slidesPerView: 2,
                            spaceBetween: 20,
                        },
                        768: {
                            slidesPerView: 2,
                            spaceBetween: 25,
                        },
                        1024: {
                            slidesPerView: 3,
                            spaceBetween: 30,
                        },
                        1280: {
                            slidesPerView: 4,
                            spaceBetween: 30,
                        }
                    },
                    autoplay: {
                        delay: 5000,
                        disableOnInteraction: false,
                        pauseOnMouseEnter: true,
                    },
                    loop: slides.length >= 3,
                    speed: 800,
                    effect: 'slide',
                    grabCursor: true,
                    touchRatio: 1,
                    resistance: true,
                    resistanceRatio: 0.85,
                    observer: true,
                    observeParents: true,
                    on: {
                        init: function() {
                            console.log('✅ Swiper initialized successfully with', slides.length, 'slides');
                            // DEBUG: Log swiper after initialization
                            console.log('🔍 DEBUG: Swiper after init - slides:', this.slides?.length);
                            console.log('🔍 DEBUG: Swiper wrapper dimensions:', this.wrapperEl?.getBoundingClientRect());
                        },
                        error: function(err) {
                            console.error('Swiper initialization error:', err);
                        }
                    }
                });
                
                // Force update after initialization
                setTimeout(() => {
                    if (swiperInstance && swiperInstance.update) {
                        swiperInstance.update();
                        console.log('🔍 DEBUG: Swiper updated, current slide index:', swiperInstance.activeIndex);
                    }
                }, 200);
                
            } catch (err) {
                console.error('Error initializing Swiper:', err);
                // Fallback: just show the slides as a grid without swiper
                const swiperWrapper = document.querySelector('#creators-list');
                if (swiperWrapper && swiperWrapper.parentElement) {
                    swiperWrapper.parentElement.style.overflow = 'visible';
                    swiperWrapper.style.display = 'grid';
                    swiperWrapper.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
                    swiperWrapper.style.gap = '20px';
                    console.log('🔍 DEBUG: Fallback grid mode activated');
                }
            }
        }, 100);
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        if (!creatorsList) return;
        
        creatorsList.innerHTML = Array(3).fill().map(() => `
            <div class="swiper-slide">
                <div class="creator-skeleton">
                    <div class="creator-skeleton-avatar"></div>
                    <div class="creator-skeleton-name"></div>
                    <div class="creator-skeleton-username"></div>
                    <div class="creator-skeleton-bio"></div>
                    <div class="creator-skeleton-stats">
                        <div class="stat-skeleton"></div>
                        <div class="stat-skeleton"></div>
                        <div class="stat-skeleton"></div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Don't initialize swiper with skeletons - wait for real data
    }
    
    /**
     * Show empty state
     */
    function showEmptyState() {
        if (!creatorsList) return;
        
        creatorsList.innerHTML = `
            <div class="swiper-slide">
                <div class="creator-card empty-creator-card">
                    <div class="empty-icon"><i class="fas fa-users"></i></div>
                    <h3>No Featured Creators</h3>
                    <p>Top creators will appear here soon!</p>
                    <button class="see-all-btn" onclick="window.location.href='https://bantustreamconnect.com/creators'">
                        Discover Creators
                    </button>
                </div>
            </div>
        `;
        
        // Initialize swiper with single slide
        initializeSwiper();
    }
    
    /**
     * Show error state
     */
    function showErrorState() {
        if (!creatorsList) return;
        
        creatorsList.innerHTML = `
            <div class="swiper-slide">
                <div class="creator-card error-creator-card">
                    <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <h3>Unable to Load Creators</h3>
                    <p>Please check your connection and try again</p>
                    <button class="retry-btn" onclick="CreatorOfTheWeek.refresh()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            </div>
        `;
        
        // Initialize swiper with single slide
        initializeSwiper();
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.querySelector('#creator-of-the-week-section .see-all-btn');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://bantustreamconnect.com/creators';
            });
        }
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        if (isLoading) return;
        
        try {
            const creators = await fetchFeaturedCreators();
            if (creators && creators.length > 0) {
                const scoredCreators = calculateCreatorScores(creators);
                const topCreators = scoredCreators.slice(0, DISPLAY_CREATORS);
                
                // Check if the top creator changed
                if (featuredCreators.length > 0 && topCreators.length > 0 && 
                    featuredCreators[0]?.id !== topCreators[0]?.id) {
                    console.log('⭐ New Creator of the Week detected!');
                    await loadCreators(); // Full refresh
                }
            }
        } catch (err) {
            console.log('Background refresh failed:', err);
        }
    }
    
    /**
     * Start background refresh interval
     */
    function startBackgroundRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            refreshInBackground();
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Load from cache
     */
    function loadFromCache() {
        try {
            if (window.cacheManager && typeof window.cacheManager.get === 'function') {
                return window.cacheManager.get(CACHE_KEY);
            }
            
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < CACHE_TTL) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to load from cache:', e);
        }
        return null;
    }
    
    /**
     * Save to cache
     */
    function saveToCache(data) {
        try {
            if (window.cacheManager && typeof window.cacheManager.set === 'function') {
                window.cacheManager.set(CACHE_KEY, data, CACHE_TTL);
            }
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save to cache:', e);
        }
    }
    
    /**
     * Fix avatar URL
     */
    function fixAvatarUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.fixAvatarUrl) return window.fixAvatarUrl(url);
        return url;
    }
    
    /**
     * Format number
     */
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Get initials
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
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.log(`[${type}] ${message}`);
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        `;
        
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Refresh module
     */
    async function refresh() {
        // Clear cache to force refresh
        try {
            localStorage.removeItem(CACHE_KEY);
            if (window.cacheManager && window.cacheManager.remove) {
                window.cacheManager.remove(CACHE_KEY);
            }
        } catch (e) {
            console.warn('Cache clear error:', e);
        }
        
        isInitialized = false;
        await getCurrentUser();
        await loadCreators();
    }
    
    /**
     * Destroy module
     */
    function destroy() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (swiperInstance && swiperInstance.destroy) {
            swiperInstance.destroy(true, true);
            swiperInstance = null;
        }
        if (creatorsList) {
            creatorsList.innerHTML = '';
        }
        isInitialized = false;
        console.log('⭐ Creator of the Week Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy
    };
})();

// Auto-initialize when DOM is ready with proper delay
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => CreatorOfTheWeek.init(), 200);
    });
} else {
    setTimeout(() => CreatorOfTheWeek.init(), 200);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatorOfTheWeek;
}
