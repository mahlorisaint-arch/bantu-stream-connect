/**
 * Hero Content Module - DIAGNOSTIC VERSION
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 * 
 * This version includes extensive logging to debug loading issues
 */

(function() {
    'use strict';
    
    // DIAGNOSTIC: Log immediately when file loads
    console.log('🎬 [HERO-LOAD] hero-content.js file has been loaded and is executing!');
    console.log('🎬 [HERO-LOAD] Timestamp:', new Date().toISOString());
    
    // Check if supabaseAuth is available at load time
    console.log('🎬 [HERO-LOAD] window.supabaseAuth exists?', !!window.supabaseAuth);
    console.log('🎬 [HERO-LOAD] window.supabaseAuth type:', typeof window.supabaseAuth);
    
    const HeroContent = {
        // Configuration
        config: {
            sectionId: 'cinematic-hero',
            rotationHours: 3,
            rotationMs: 3 * 60 * 60 * 1000,
            videoFormats: ['video', 'movie', 'film', 'series_episode', 'short', 'music_video', 'documentary', 'long_form'],
            videoExtensions: ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.mkv']
        },
        
        // State
        state: {
            initialized: false,
            isLoading: false,
            currentContent: null,
            rotationInterval: null
        },
        
        // DOM Elements
        elements: {},
        
        // Initialize the module
        async init() {
            console.log('🎬 [HERO-INIT] HeroContent.init() called');
            
            // Cache DOM elements
            this.cacheElements();
            
            // Check if hero section exists
            if (!this.elements.heroSection) {
                console.error('❌ [HERO-INIT] Hero section element NOT found! ID: cinematic-hero');
                console.log('🔍 [HERO-INIT] Available elements with cinematic-hero id:', document.getElementById('cinematic-hero'));
                console.log('🔍 [HERO-INIT] All sections:', document.querySelectorAll('section'));
                return;
            }
            
            console.log('✅ [HERO-INIT] Hero section element found:', this.elements.heroSection);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load content
            await this.loadContent();
            
            this.state.initialized = true;
            console.log('✅ [HERO-INIT] Hero Content Module initialized successfully');
        },
        
        cacheElements() {
            console.log('🎬 [HERO-CACHE] Caching DOM elements...');
            
            this.elements = {
                heroSection: document.getElementById('cinematic-hero'),
                heroVideo: document.getElementById('hero-background-video'),
                videoSource: document.querySelector('#hero-background-video source'),
                heroTitle: document.getElementById('hero-title'),
                heroSubtitle: document.getElementById('hero-subtitle'),
                heroCreatorName: document.getElementById('hero-creator-name'),
                heroCreatorAvatar: document.getElementById('hero-creator-avatar'),
                heroTrendingText: document.getElementById('hero-trending-text'),
                heroVerifiedBadge: document.getElementById('hero-verified-badge'),
                heroViews: document.getElementById('hero-views'),
                heroFavorites: document.getElementById('hero-favorites'),
                heroConnectors: document.getElementById('hero-connectors'),
                heroShares: document.getElementById('hero-shares'),
                heroExploreBtn: document.getElementById('hero-explore-btn'),
                heroWatchBtn: document.getElementById('hero-watch-btn'),
                heroAudioControl: document.getElementById('hero-audio-control'),
                heroFeaturedBadge: document.getElementById('hero-featured-badge')
            };
            
            // Log which elements were found
            const foundElements = Object.entries(this.elements)
                .filter(([key, val]) => val !== null)
                .map(([key]) => key);
            
            const missingElements = Object.entries(this.elements)
                .filter(([key, val]) => val === null)
                .map(([key]) => key);
            
            console.log(`✅ [HERO-CACHE] Found elements: ${foundElements.length} -`, foundElements);
            if (missingElements.length) {
                console.warn(`⚠️ [HERO-CACHE] Missing elements: ${missingElements.length} -`, missingElements);
            }
        },
        
        setupEventListeners() {
            console.log('🎬 [HERO-EVENTS] Setting up event listeners...');
            
            if (this.elements.heroExploreBtn) {
                this.elements.heroExploreBtn.addEventListener('click', () => {
                    window.location.href = '/content-library';
                });
                console.log('✅ [HERO-EVENTS] Explore button listener added');
            }
            
            if (this.elements.heroWatchBtn) {
                this.elements.heroWatchBtn.addEventListener('click', () => {
                    const contentId = this.elements.heroWatchBtn.dataset.contentId;
                    if (contentId) {
                        window.location.href = `content-detail.html?id=${contentId}`;
                    }
                });
                console.log('✅ [HERO-EVENTS] Watch button listener added');
            }
            
            this.setupAudioControl();
        },
        
        async loadContent() {
            console.log('🎬 [HERO-LOAD] Starting to load hero content...');
            
            if (this.state.isLoading) {
                console.log('⚠️ [HERO-LOAD] Already loading, skipping...');
                return;
            }
            
            this.state.isLoading = true;
            this.showLoading();
            
            try {
                // Check if supabaseAuth is available
                if (!window.supabaseAuth) {
                    console.error('❌ [HERO-LOAD] window.supabaseAuth is not available!');
                    console.log('🔍 [HERO-LOAD] Available window properties:', Object.keys(window).filter(k => k.includes('supabase') || k.includes('Supabase')));
                    this.showPlaceholder('Supabase client not available');
                    return;
                }
                
                console.log('✅ [HERO-LOAD] supabaseAuth is available');
                
                // Fetch published content with video files
                console.log('🎬 [HERO-LOAD] Fetching content from Supabase...');
                
                const { data: allContent, error } = await window.supabaseAuth
                    .from('Content')
                    .select(`
                        id, 
                        title, 
                        description, 
                        thumbnail_url, 
                        file_url, 
                        favorites_count, 
                        shares_count, 
                        language, 
                        created_at, 
                        content_format,
                        content_type,
                        duration,
                        user_id, 
                        user_profiles!user_id(id, full_name, username, avatar_url)
                    `)
                    .eq('status', 'published')
                    .not('file_url', 'is', null)
                    .limit(100);
                
                if (error) {
                    console.error('❌ [HERO-LOAD] Supabase error:', error);
                    this.showPlaceholder(`Database error: ${error.message}`);
                    return;
                }
                
                if (!allContent || allContent.length === 0) {
                    console.warn('⚠️ [HERO-LOAD] No content found in database!');
                    this.showPlaceholder('No content available');
                    return;
                }
                
                console.log(`📊 [HERO-LOAD] Fetched ${allContent.length} total content items`);
                
                // Log first few items for debugging
                allContent.slice(0, 5).forEach((item, idx) => {
                    console.log(`   Item ${idx + 1}: ID=${item.id}, Title="${item.title}", Format=${item.content_format}, HasVideo=${!!item.file_url}`);
                });
                
                // Filter for video content
                const videoContent = allContent.filter(item => {
                    // Check by content_format
                    if (item.content_format && this.config.videoFormats.includes(item.content_format.toLowerCase())) {
                        return true;
                    }
                    // Check by content_type
                    if (item.content_type && this.config.videoFormats.includes(item.content_type.toLowerCase())) {
                        return true;
                    }
                    // Check file extension
                    const fileUrl = (item.file_url || '').toLowerCase();
                    for (const ext of this.config.videoExtensions) {
                        if (fileUrl.endsWith(ext)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                console.log(`📹 [HERO-LOAD] Filtered to ${videoContent.length} video items`);
                
                if (videoContent.length === 0) {
                    console.warn('⚠️ [HERO-LOAD] No video content found!');
                    this.showPlaceholder('No video content available. Please upload videos.');
                    return;
                }
                
                // Log video titles
                videoContent.forEach((video, idx) => {
                    console.log(`   Video ${idx + 1}: "${video.title}" (${video.content_format || 'unknown format'})`);
                });
                
                // Get stored selection or select random
                const lastVideoId = localStorage.getItem('hero_last_content_id');
                const lastVideoTime = localStorage.getItem('hero_last_update_time');
                const now = Date.now();
                
                let selectedVideo = null;
                
                if (lastVideoId && lastVideoTime && (now - parseInt(lastVideoTime)) < this.config.rotationMs) {
                    // Try to use existing video
                    selectedVideo = videoContent.find(v => v.id.toString() === lastVideoId);
                    if (selectedVideo) {
                        console.log(`🎬 [HERO-LOAD] Using existing video (within ${this.config.rotationHours} hours): "${selectedVideo.title}"`);
                    }
                }
                
                if (!selectedVideo) {
                    // Select random video
                    let availableVideos = videoContent;
                    if (lastVideoId && videoContent.length > 1) {
                        availableVideos = videoContent.filter(v => v.id.toString() !== lastVideoId);
                    }
                    
                    const randomIndex = Math.floor(Math.random() * availableVideos.length);
                    selectedVideo = availableVideos[randomIndex];
                    
                    // Save selection
                    localStorage.setItem('hero_last_content_id', selectedVideo.id.toString());
                    localStorage.setItem('hero_last_update_time', now.toString());
                    
                    console.log(`🎬 [HERO-LOAD] Selected NEW random video: "${selectedVideo.title}" (index: ${randomIndex} of ${availableVideos.length})`);
                }
                
                // Get engagement stats
                await this.fetchEngagementStats(selectedVideo);
                
                // Render the video
                await this.renderContent(selectedVideo);
                
                // Set up rotation interval
                if (this.state.rotationInterval) clearInterval(this.state.rotationInterval);
                this.state.rotationInterval = setInterval(() => this.rotateContent(), this.config.rotationMs);
                console.log(`⏰ [HERO-LOAD] Rotation set for ${this.config.rotationHours} hours`);
                
            } catch (error) {
                console.error('❌ [HERO-LOAD] Fatal error:', error);
                this.showPlaceholder(`Error: ${error.message}`);
            } finally {
                this.state.isLoading = false;
                this.hideLoading();
            }
        },
        
        async fetchEngagementStats(content) {
            if (!content || !window.supabaseAuth) return;
            
            try {
                const { data, error } = await window.supabaseAuth
                    .from('content_engagement_stats')
                    .select('total_views, total_likes, total_shares')
                    .eq('content_id', content.id)
                    .maybeSingle();
                
                if (!error && data) {
                    content.total_views = data.total_views || 0;
                    content.total_likes = data.total_likes || 0;
                    content.total_shares = data.total_shares || 0;
                    console.log(`📊 [HERO-STATS] Stats: ${content.total_views} views, ${content.total_likes} likes`);
                } else {
                    content.total_views = 0;
                    content.total_likes = 0;
                    content.total_shares = 0;
                    console.log('📊 [HERO-STATS] No stats available');
                }
            } catch (err) {
                console.warn('⚠️ [HERO-STATS] Could not fetch stats:', err);
                content.total_views = 0;
                content.total_likes = 0;
                content.total_shares = 0;
            }
        },
        
        async renderContent(content) {
            console.log(`🎬 [HERO-RENDER] Rendering content: "${content.title}"`);
            
            if (!content) {
                console.error('❌ [HERO-RENDER] No content to render');
                this.showPlaceholder('No content selected');
                return;
            }
            
            this.state.currentContent = content;
            
            // Update text
            this.updateText(content);
            
            // Update creator info
            this.updateCreatorInfo(content);
            
            // Update metrics
            this.updateMetrics(content);
            
            // Update badges
            this.updateBadges(content);
            
            // Handle video background
            await this.handleVideoBackground(content);
            
            // Update watch button
            if (this.elements.heroWatchBtn) {
                this.elements.heroWatchBtn.dataset.contentId = content.id;
            }
            
            console.log('✅ [HERO-RENDER] Content rendered successfully');
        },
        
        updateText(content) {
            if (this.elements.heroTitle) {
                this.elements.heroTitle.textContent = content.title || 'DISCOVER & CONNECT';
                console.log(`📝 [HERO-RENDER] Title: ${this.elements.heroTitle.textContent}`);
            }
            
            if (this.elements.heroSubtitle) {
                let description = content.description || 'Explore amazing video content from across Africa';
                if (description.length > 120) {
                    description = description.substring(0, 117) + '...';
                }
                this.elements.heroSubtitle.textContent = description;
            }
        },
        
        updateCreatorInfo(content) {
            const creator = content.user_profiles;
            
            if (this.elements.heroCreatorName) {
                const displayName = creator?.full_name || creator?.username || 'Featured Creator';
                this.elements.heroCreatorName.textContent = displayName;
                console.log(`👤 [HERO-RENDER] Creator: ${displayName}`);
            }
            
            if (this.elements.heroCreatorAvatar && creator?.avatar_url) {
                let avatarUrl = creator.avatar_url;
                if (!avatarUrl.startsWith('http')) {
                    avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl.replace(/^\/+/, '')}`;
                }
                
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = creator.full_name || 'Creator';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = () => {
                    this.elements.heroCreatorAvatar.innerHTML = '<span>' + (creator.full_name?.charAt(0).toUpperCase() || 'C') + '</span>';
                };
                
                this.elements.heroCreatorAvatar.innerHTML = '';
                this.elements.heroCreatorAvatar.appendChild(img);
            }
        },
        
        updateMetrics(content) {
            const views = this.formatNumber(content.total_views || 0);
            const favorites = this.formatNumber(content.favorites_count || 0);
            const shares = this.formatNumber(content.total_shares || 0);
            
            if (this.elements.heroViews) this.elements.heroViews.textContent = views;
            if (this.elements.heroFavorites) this.elements.heroFavorites.textContent = favorites;
            if (this.elements.heroShares) this.elements.heroShares.textContent = shares;
            
            console.log(`📊 [HERO-RENDER] Metrics: ${views} views, ${favorites} favorites, ${shares} shares`);
        },
        
        updateBadges(content) {
            if (this.elements.heroVerifiedBadge) {
                const isVerified = (content.total_views || 0) > 10000;
                this.elements.heroVerifiedBadge.style.display = isVerified ? 'inline-flex' : 'none';
            }
            
            if (this.elements.heroFeaturedBadge) {
                this.elements.heroFeaturedBadge.style.display = 'flex';
                this.elements.heroFeaturedBadge.innerHTML = '<i class="fas fa-star"></i> Featured Video';
            }
        },
        
        async handleVideoBackground(content) {
            if (!this.elements.heroVideo || !this.elements.videoSource) {
                console.warn('⚠️ [HERO-VIDEO] Video elements not found');
                return;
            }
            
            let videoUrl = content.file_url;
            
            if (!videoUrl) {
                console.warn(`⚠️ [HERO-VIDEO] No video URL for content: ${content.title}`);
                // Fallback to thumbnail
                if (content.thumbnail_url) {
                    let thumbUrl = content.thumbnail_url;
                    if (!thumbUrl.startsWith('http')) {
                        thumbUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${thumbUrl.replace(/^\/+/, '')}`;
                    }
                    this.elements.heroVideo.style.backgroundImage = `url(${thumbUrl})`;
                    this.elements.heroVideo.style.backgroundSize = 'cover';
                }
                return;
            }
            
            // Fix URL
            if (!videoUrl.startsWith('http')) {
                videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${videoUrl.replace(/^\/+/, '')}`;
            }
            
            console.log(`🎬 [HERO-VIDEO] Loading video: ${videoUrl.substring(0, 80)}...`);
            
            // Reset video
            this.elements.heroVideo.pause();
            this.elements.videoSource.src = videoUrl;
            this.elements.heroVideo.load();
            
            // Try to play
            const playPromise = this.elements.heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ [HERO-VIDEO] Video playing successfully');
                    if (this.elements.heroAudioControl) {
                        this.elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    }
                }).catch(error => {
                    console.log('⚠️ [HERO-VIDEO] Autoplay prevented:', error.message);
                    this.showPlayButton();
                });
            }
            
            // Handle errors
            this.elements.heroVideo.onerror = (e) => {
                console.error('❌ [HERO-VIDEO] Video failed to load');
                if (content.thumbnail_url) {
                    let thumbUrl = content.thumbnail_url;
                    if (!thumbUrl.startsWith('http')) {
                        thumbUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${thumbUrl.replace(/^\/+/, '')}`;
                    }
                    this.elements.heroVideo.style.backgroundImage = `url(${thumbUrl})`;
                    this.elements.heroVideo.style.backgroundSize = 'cover';
                }
            };
        },
        
        showPlayButton() {
            if (!this.elements.heroSection) return;
            if (this.elements.heroSection.querySelector('.hero-video-play-btn')) return;
            
            const playBtn = document.createElement('button');
            playBtn.className = 'hero-video-play-btn';
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.onclick = () => {
                if (this.elements.heroVideo) {
                    this.elements.heroVideo.play().catch(console.log);
                    playBtn.remove();
                }
            };
            
            this.elements.heroSection.appendChild(playBtn);
            
            setTimeout(() => {
                if (playBtn.parentNode) playBtn.remove();
            }, 5000);
        },
        
        setupAudioControl() {
            if (!this.elements.heroAudioControl || !this.elements.heroVideo) return;
            
            const newControl = this.elements.heroAudioControl.cloneNode(true);
            if (this.elements.heroAudioControl.parentNode) {
                this.elements.heroAudioControl.parentNode.replaceChild(newControl, this.elements.heroAudioControl);
            }
            this.elements.heroAudioControl = newControl;
            
            let isMuted = true;
            this.elements.heroVideo.muted = true;
            this.elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
            
            this.elements.heroAudioControl.addEventListener('click', (e) => {
                e.preventDefault();
                isMuted = !isMuted;
                this.elements.heroVideo.muted = isMuted;
                this.elements.heroAudioControl.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
                if (!isMuted && this.elements.heroVideo.paused) {
                    this.elements.heroVideo.play().catch(console.log);
                }
            });
        },
        
        async rotateContent() {
            console.log('🔄 [HERO-ROTATE] Rotating hero content...');
            await this.loadContent();
        },
        
        showLoading() {
            if (this.elements.heroVideo) {
                this.elements.heroVideo.style.opacity = '0.5';
            }
        },
        
        hideLoading() {
            if (this.elements.heroVideo) {
                this.elements.heroVideo.style.opacity = '1';
            }
        },
        
        showPlaceholder(reason) {
            console.log(`🎬 [HERO-PLACEHOLDER] Showing placeholder: ${reason}`);
            
            if (this.elements.heroTitle) {
                this.elements.heroTitle.textContent = 'WELCOME TO BANTU STREAM CONNECT';
            }
            
            if (this.elements.heroSubtitle) {
                this.elements.heroSubtitle.textContent = 'No video content available. Be the first to upload and share your story!';
            }
            
            // Set default background
            if (this.elements.heroVideo) {
                this.elements.heroVideo.style.backgroundImage = 'url(https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop)';
                this.elements.heroVideo.style.backgroundSize = 'cover';
                this.elements.heroVideo.style.backgroundPosition = 'center';
            }
            
            // Reset metrics
            if (this.elements.heroViews) this.elements.heroViews.textContent = '0';
            if (this.elements.heroFavorites) this.elements.heroFavorites.textContent = '0';
            if (this.elements.heroConnectors) this.elements.heroConnectors.textContent = '0';
            if (this.elements.heroShares) this.elements.heroShares.textContent = '0';
        },
        
        formatNumber(num) {
            if (!num && num !== 0) return '0';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        },
        
        destroy() {
            if (this.state.rotationInterval) {
                clearInterval(this.state.rotationInterval);
                this.state.rotationInterval = null;
            }
            if (this.elements.heroVideo) {
                this.elements.heroVideo.pause();
                this.elements.heroVideo.src = '';
            }
            console.log('🎬 [HERO] Module destroyed');
        }
    };
    
    // Make available globally
    window.HeroContent = HeroContent;
    
    // DIAGNOSTIC: Log that the module is ready
    console.log('🎬 [HERO-LOAD] HeroContent module registered on window');
    console.log('🎬 [HERO-LOAD] window.HeroContent exists:', !!window.HeroContent);
    
    // Auto-initialize with a delay to ensure DOM is ready
    if (document.readyState === 'loading') {
        console.log('🎬 [HERO-LOAD] Document still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🎬 [HERO-LOAD] DOMContentLoaded fired, initializing...');
            setTimeout(() => window.HeroContent.init(), 100);
        });
    } else {
        console.log('🎬 [HERO-LOAD] Document already loaded, initializing immediately...');
        setTimeout(() => window.HeroContent.init(), 100);
    }
    
    // Also try to initialize if window.load fires (fallback)
    window.addEventListener('load', () => {
        if (!window.HeroContent.state || !window.HeroContent.state.initialized) {
            console.log('🎬 [HERO-LOAD] Load event fallback, initializing...');
            setTimeout(() => window.HeroContent.init(), 100);
        }
    });
    
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.HeroContent;
}
