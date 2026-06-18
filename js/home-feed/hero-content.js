/**
 * Hero Content Module - CORRECTED CONNECTORS COUNT
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 * 
 * FIXED: Correctly counts connectors/followers using the connectors table
 * - connector_id: the user who is following
 * - connected_id: the user being followed (creator)
 * - connection_type = 'creator' for creator follows
 * 
 * UPDATED: Cloudflare Stream/R2 video support
 * UPDATED: View recording for hero content
 * UPDATED: Proper audio control with volume persistence
 * UPDATED: Video source detection using getPlayableMediaUrl pattern
 */

(function() {
    'use strict';
    
    console.log('🎬 [HERO-LOAD] hero-content.js file has been loaded and is executing!');
    console.log('🎬 [HERO-LOAD] Timestamp:', new Date().toISOString());
    console.log('🎬 [HERO-LOAD] window.supabaseAuth exists?', !!window.supabaseAuth);
    
    const HeroContent = {
        // Configuration
        config: {
            sectionId: 'cinematic-hero',
            rotationHours: 3,
            rotationMs: 3 * 60 * 60 * 1000,
            videoFormats: ['video', 'movie', 'film', 'series_episode', 'short', 'music_video', 'documentary', 'long_form'],
            videoExtensions: ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.mkv', '.m3u8'],
            // View recording threshold (15 seconds or 30% of duration)
            viewThresholdSeconds: 15,
            viewPercentage: 0.3
        },
        
        // State
        state: {
            initialized: false,
            isLoading: false,
            currentContent: null,
            rotationInterval: null,
            viewRecorded: false,
            viewTimer: null,
            playbackSessionId: null,
            sessionId: null,
            isMuted: true,
            isPlaying: false,
            hasUserInteracted: false
        },
        
        // DOM Elements
        elements: {},
        
        // Initialize the module
        async init() {
            console.log('🎬 [HERO-INIT] HeroContent.init() called');
            
            // Prevent double initialization
            if (this.state.initialized) {
                console.log('⚠️ [HERO-INIT] Already initialized, skipping');
                return;
            }
            
            // Cache DOM elements
            this.cacheElements();
            
            // Check if hero section exists
            if (!this.elements.heroSection) {
                console.error('❌ [HERO-INIT] Hero section element NOT found! ID: cinematic-hero');
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
            
            const foundCount = Object.values(this.elements).filter(v => v !== null).length;
            console.log(`✅ [HERO-CACHE] Found ${foundCount} of ${Object.keys(this.elements).length} elements`);
        },
        
        setupEventListeners() {
            console.log('🎬 [HERO-EVENTS] Setting up event listeners...');
            
            if (this.elements.heroExploreBtn) {
                this.elements.heroExploreBtn.addEventListener('click', () => {
                    window.location.href = '/content-library';
                });
            }
            
            if (this.elements.heroWatchBtn) {
                this.elements.heroWatchBtn.addEventListener('click', () => {
                    const contentId = this.elements.heroWatchBtn.dataset.contentId;
                    if (contentId) {
                        window.location.href = `content-detail.html?id=${contentId}`;
                    }
                });
            }
            
            // Click on hero to play/pause
            if (this.elements.heroSection) {
                this.elements.heroSection.addEventListener('click', (e) => {
                    // Don't trigger if clicking on controls or buttons
                    if (e.target.closest('.hero-audio-control') || 
                        e.target.closest('.hero-explore-btn') || 
                        e.target.closest('.hero-watch-btn') ||
                        e.target.closest('.hero-video-play-btn')) {
                        return;
                    }
                    this.togglePlayback();
                });
            }
            
            // Video events for view tracking
            if (this.elements.heroVideo) {
                this.elements.heroVideo.addEventListener('timeupdate', () => {
                    this.checkAndRecordView();
                });
                
                this.elements.heroVideo.addEventListener('play', () => {
                    this.state.isPlaying = true;
                    this.startViewTimer();
                });
                
                this.elements.heroVideo.addEventListener('pause', () => {
                    this.state.isPlaying = false;
                    this.clearViewTimer();
                });
                
                this.elements.heroVideo.addEventListener('ended', () => {
                    this.state.isPlaying = false;
                    this.clearViewTimer();
                });
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
                if (!window.supabaseAuth) {
                    console.error('❌ [HERO-LOAD] window.supabaseAuth is not available!');
                    this.showPlaceholder('Supabase client not available');
                    return;
                }
                
                console.log('✅ [HERO-LOAD] supabaseAuth is available');
                
                // Fetch published content with video files including Cloudflare fields
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
                        streaming_provider,
                        provider_video_id,
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
                
                // Filter for video content (including Cloudflare Stream)
                const videoContent = allContent.filter(item => {
                    // Cloudflare Stream is always video
                    if (item.streaming_provider === 'cloudflare_stream') {
                        return true;
                    }
                    // Cloudflare R2 is audio, skip for hero (we want video)
                    if (item.streaming_provider === 'cloudflare_r2') {
                        return false;
                    }
                    // Check content_format
                    if (item.content_format && this.config.videoFormats.includes(item.content_format.toLowerCase())) {
                        return true;
                    }
                    if (item.content_type && this.config.videoFormats.includes(item.content_type.toLowerCase())) {
                        return true;
                    }
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
                    this.showPlaceholder('No video content available');
                    return;
                }
                
                // Get stored selection or select random
                const lastVideoId = localStorage.getItem('hero_last_content_id');
                const lastVideoTime = localStorage.getItem('hero_last_update_time');
                const now = Date.now();
                
                let selectedVideo = null;
                
                if (lastVideoId && lastVideoTime && (now - parseInt(lastVideoTime)) < this.config.rotationMs) {
                    selectedVideo = videoContent.find(v => v.id.toString() === lastVideoId);
                    if (selectedVideo) {
                        console.log(`🎬 [HERO-LOAD] Using existing video (within ${this.config.rotationHours} hours): "${selectedVideo.title}"`);
                    }
                }
                
                if (!selectedVideo) {
                    let availableVideos = videoContent;
                    if (lastVideoId && videoContent.length > 1) {
                        availableVideos = videoContent.filter(v => v.id.toString() !== lastVideoId);
                    }
                    const randomIndex = Math.floor(Math.random() * availableVideos.length);
                    selectedVideo = availableVideos[randomIndex];
                    
                    localStorage.setItem('hero_last_content_id', selectedVideo.id.toString());
                    localStorage.setItem('hero_last_update_time', now.toString());
                    
                    console.log(`🎬 [HERO-LOAD] Selected NEW random video: "${selectedVideo.title}" (index: ${randomIndex} of ${availableVideos.length})`);
                }
                
                // Generate session ID
                this.state.sessionId = 'hero_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
                
                // Fetch engagement stats and connectors count
                await this.fetchEngagementData(selectedVideo);
                
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
        
        /**
         * Get playable media URL for hero video
         * Supports Cloudflare Stream (HLS) and legacy file_url
         */
        getPlayableMediaUrl(content) {
            if (!content) return null;
            
            // Cloudflare Stream Video - Return HLS manifest URL
            if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
                const videoId = content.provider_video_id;
                return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
            }
            
            // Cloudflare R2 Audio - Skip for hero (we want video)
            if (content.streaming_provider === 'cloudflare_r2') {
                return null;
            }
            
            // Legacy fallback: file_url
            if (content.file_url) {
                let url = content.file_url;
                if (!url.startsWith('http')) {
                    url = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${url.replace(/^\/+/, '')}`;
                }
                return url;
            }
            
            return null;
        },
        
        async fetchEngagementData(content) {
            if (!content || !window.supabaseAuth) return;
            
            // Fetch engagement stats
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
                    // Fallback to content_views count
                    try {
                        const { count } = await window.supabaseAuth
                            .from('content_views')
                            .select('*', { count: 'exact', head: true })
                            .eq('content_id', content.id)
                            .eq('counted_as_view', true);
                        content.total_views = count || 0;
                    } catch {
                        content.total_views = 0;
                    }
                    content.total_likes = 0;
                    content.total_shares = 0;
                }
            } catch (err) {
                console.warn('⚠️ [HERO-STATS] Could not fetch stats:', err);
                content.total_views = 0;
                content.total_likes = 0;
                content.total_shares = 0;
            }
            
            // Fetch connectors count for the creator
            if (content.user_id) {
                try {
                    const { count, error: connError } = await window.supabaseAuth
                        .from('connectors')
                        .select('*', { count: 'exact', head: true })
                        .eq('connected_id', content.user_id)
                        .eq('connection_type', 'creator');
                    
                    if (!connError) {
                        content.connector_count = count || 0;
                        console.log(`👥 [HERO-STATS] Creator ${content.user_id} has ${content.connector_count} connectors/followers`);
                    } else {
                        console.warn('⚠️ [HERO-STATS] Could not fetch connector count:', connError.message);
                        content.connector_count = 0;
                    }
                } catch (err) {
                    console.warn('⚠️ [HERO-STATS] Exception fetching connector count:', err);
                    content.connector_count = 0;
                }
            } else {
                content.connector_count = 0;
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
            this.state.viewRecorded = false;
            this.state.playbackSessionId = null;
            
            // Update text
            this.updateText(content);
            
            // Update creator info
            this.updateCreatorInfo(content);
            
            // Update metrics (with correct connector count)
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
                img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
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
            const connectors = this.formatNumber(content.connector_count || 0);
            const shares = this.formatNumber(content.total_shares || 0);
            
            if (this.elements.heroViews) this.elements.heroViews.textContent = views;
            if (this.elements.heroFavorites) this.elements.heroFavorites.textContent = favorites;
            if (this.elements.heroConnectors) this.elements.heroConnectors.textContent = connectors;
            if (this.elements.heroShares) this.elements.heroShares.textContent = shares;
            
            console.log(`📊 [HERO-RENDER] Metrics: ${views} views, ${favorites} favs, ${connectors} connectors, ${shares} shares`);
        },
        
        updateBadges(content) {
            if (this.elements.heroVerifiedBadge) {
                const isVerified = (content.total_views || 0) > 10000 || (content.connector_count || 0) > 500;
                this.elements.heroVerifiedBadge.style.display = isVerified ? 'inline-flex' : 'none';
            }
            
            if (this.elements.heroFeaturedBadge) {
                this.elements.heroFeaturedBadge.style.display = 'flex';
                this.elements.heroFeaturedBadge.innerHTML = '<i class="fas fa-crown"></i> FEATURED VIDEO';
            }
            
            if (this.elements.heroTrendingText) {
                const views = content.total_views || 0;
                if (views > 1000) {
                    this.elements.heroTrendingText.innerHTML = '<i class="fas fa-fire"></i> Trending ↑ 24h';
                } else {
                    this.elements.heroTrendingText.innerHTML = '<i class="fas fa-star"></i> Featured';
                }
            }
        },
        
        async handleVideoBackground(content) {
            if (!this.elements.heroVideo || !this.elements.videoSource) {
                console.warn('⚠️ [HERO-VIDEO] Video elements not found');
                return;
            }
            
            // Use the getPlayableMediaUrl method
            let videoUrl = this.getPlayableMediaUrl(content);
            
            if (!videoUrl) {
                console.warn(`⚠️ [HERO-VIDEO] No video URL for content: ${content.title}`);
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
            
            const isCloudflareStream = content.streaming_provider === 'cloudflare_stream';
            
            console.log(`🎬 [HERO-VIDEO] Loading video: ${videoUrl.substring(0, 80)}...`);
            console.log(`🎬 [HERO-VIDEO] Cloudflare Stream: ${isCloudflareStream}`);
            
            // Reset video
            this.elements.heroVideo.pause();
            this.state.isPlaying = false;
            
            // For Cloudflare Stream, set the video source to the HLS manifest
            // HTML5 video can handle HLS natively in Safari, but needs hls.js for others
            this.elements.videoSource.src = videoUrl;
            
            // Set appropriate type for HLS
            if (isCloudflareStream || videoUrl.endsWith('.m3u8')) {
                this.elements.videoSource.type = 'application/vnd.apple.mpegurl';
                console.log('📺 [HERO-VIDEO] HLS manifest detected, type set to application/vnd.apple.mpegurl');
            } else {
                // Determine MIME type from extension
                const ext = videoUrl.split('.').pop()?.toLowerCase();
                const mimeTypes = {
                    'mp4': 'video/mp4',
                    'webm': 'video/webm',
                    'mov': 'video/quicktime',
                    'avi': 'video/x-msvideo',
                    'mkv': 'video/x-matroska'
                };
                this.elements.videoSource.type = mimeTypes[ext] || 'video/mp4';
            }
            
            this.elements.heroVideo.load();
            
            // Apply muted state from localStorage
            const savedMuted = localStorage.getItem('hero_audio_muted');
            if (savedMuted !== null) {
                this.state.isMuted = savedMuted === 'true';
            } else {
                this.state.isMuted = true; // Default muted for autoplay
            }
            this.elements.heroVideo.muted = this.state.isMuted;
            
            // Update audio control button
            if (this.elements.heroAudioControl) {
                this.elements.heroAudioControl.innerHTML = this.state.isMuted ? 
                    '<i class="fas fa-volume-mute"></i>' : 
                    '<i class="fas fa-volume-up"></i>';
            }
            
            // Try to play
            const playPromise = this.elements.heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ [HERO-VIDEO] Video playing successfully');
                    this.state.isPlaying = true;
                    this.startViewTimer();
                    // Initialize playback session
                    this.initializePlaybackSession(content);
                }).catch(error => {
                    console.log('⚠️ [HERO-VIDEO] Autoplay prevented:', error.message);
                    this.showPlayButton();
                });
            }
            
            // Handle errors
            this.elements.heroVideo.onerror = (e) => {
                const video = e.target;
                console.error('❌ [HERO-VIDEO] Video failed to load:', video.error?.message || 'Unknown error');
                
                // Try fallback with thumbnail
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
        
        /**
         * Initialize playback session for view tracking
         */
        initializePlaybackSession(content) {
            if (!content || !window.supabaseAuth) return;
            
            // Generate session ID if not exists
            if (!this.state.playbackSessionId) {
                this.state.playbackSessionId = 'hero_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
            
            const userId = this.getCurrentUserId();
            
            // Try to create playback session record
            window.supabaseAuth
                .from('playback_sessions')
                .insert({
                    playback_session_id: this.state.playbackSessionId,
                    content_id: parseInt(content.id, 10),
                    user_id: userId || null,
                    session_id: this.state.sessionId,
                    platform: 'Web',
                    device_type: this.getDeviceType(),
                    started_at: new Date().toISOString(),
                    media_type: 'video'
                })
                .then(({ error }) => {
                    if (error) {
                        console.warn('⚠️ [HERO-SESSION] Playback session creation failed:', error.message);
                    } else {
                        console.log('🎬 [HERO-SESSION] Playback session initialized:', this.state.playbackSessionId);
                    }
                });
        },
        
        showPlayButton() {
            if (!this.elements.heroSection) return;
            
            // Remove existing play button
            const existingBtn = this.elements.heroSection.querySelector('.hero-video-play-btn');
            if (existingBtn) existingBtn.remove();
            
            const playBtn = document.createElement('button');
            playBtn.className = 'hero-video-play-btn';
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.onclick = (e) => {
                e.stopPropagation();
                this.togglePlayback();
                playBtn.remove();
            };
            
            this.elements.heroSection.appendChild(playBtn);
            
            // Auto-hide after 5 seconds if still not playing
            setTimeout(() => {
                if (playBtn.parentNode && !this.state.isPlaying) {
                    playBtn.remove();
                }
            }, 5000);
        },
        
        togglePlayback() {
            if (!this.elements.heroVideo) return;
            
            this.state.hasUserInteracted = true;
            
            if (this.state.isPlaying) {
                this.elements.heroVideo.pause();
                this.state.isPlaying = false;
                this.clearViewTimer();
            } else {
                const playPromise = this.elements.heroVideo.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.state.isPlaying = true;
                        this.startViewTimer();
                        // Initialize playback session if not already done
                        if (!this.state.playbackSessionId && this.state.currentContent) {
                            this.initializePlaybackSession(this.state.currentContent);
                        }
                    }).catch(error => {
                        console.warn('⚠️ [HERO-VIDEO] Play failed:', error.message);
                        // Show play button on failure
                        this.showPlayButton();
                    });
                }
            }
        },
        
        setupAudioControl() {
            if (!this.elements.heroAudioControl || !this.elements.heroVideo) return;
            
            const newControl = this.elements.heroAudioControl.cloneNode(true);
            if (this.elements.heroAudioControl.parentNode) {
                this.elements.heroAudioControl.parentNode.replaceChild(newControl, this.elements.heroAudioControl);
            }
            this.elements.heroAudioControl = newControl;
            
            // Set initial state from localStorage
            const savedMuted = localStorage.getItem('hero_audio_muted');
            this.state.isMuted = savedMuted !== null ? savedMuted === 'true' : true;
            this.elements.heroVideo.muted = this.state.isMuted;
            this.elements.heroAudioControl.innerHTML = this.state.isMuted ? 
                '<i class="fas fa-volume-mute"></i>' : 
                '<i class="fas fa-volume-up"></i>';
            
            this.elements.heroAudioControl.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                this.state.isMuted = !this.state.isMuted;
                this.elements.heroVideo.muted = this.state.isMuted;
                
                // Save preference
                localStorage.setItem('hero_audio_muted', String(this.state.isMuted));
                
                // Update icon
                this.elements.heroAudioControl.innerHTML = this.state.isMuted ? 
                    '<i class="fas fa-volume-mute"></i>' : 
                    '<i class="fas fa-volume-up"></i>';
                
                // If unmuting and video is paused, try to play
                if (!this.state.isMuted && this.elements.heroVideo.paused) {
                    this.togglePlayback();
                }
            });
        },
        
        /**
         * Start view timer for recording views
         */
        startViewTimer() {
            this.clearViewTimer();
            if (!this.state.currentContent) return;
            if (this.state.viewRecorded) return;
            
            console.log('⏱️ [HERO-VIEW] View timer started for content:', this.state.currentContent.id);
            this.state.viewTimer = setTimeout(() => {
                this.recordView();
            }, this.config.viewThresholdSeconds * 1000);
        },
        
        clearViewTimer() {
            if (this.state.viewTimer) {
                clearTimeout(this.state.viewTimer);
                this.state.viewTimer = null;
            }
        },
        
        /**
         * Check and record view based on time progress
         */
        checkAndRecordView() {
            if (!this.state.currentContent) return;
            if (this.state.viewRecorded) return;
            
            const video = this.elements.heroVideo;
            if (!video) return;
            
            const currentTime = video.currentTime || 0;
            const duration = video.duration || 0;
            
            // Check if we've reached 15 seconds or 30% of duration
            const threshold = Math.min(this.config.viewThresholdSeconds, duration * this.config.viewPercentage);
            
            if (currentTime >= threshold) {
                console.log(`🎯 [HERO-VIEW] View threshold reached (${threshold}s), recording view for content:`, this.state.currentContent.id);
                this.recordView();
            }
        },
        
        /**
         * Get current user ID
         */
        getCurrentUserId() {
            if (window.currentUserId) return window.currentUserId;
            if (localStorage.getItem('userId')) return localStorage.getItem('userId');
            if (window.AuthHelper?.getCurrentUser) {
                const user = window.AuthHelper.getCurrentUser();
                if (user?.id) return user.id;
            }
            if (window.AuthHelper?.getUserProfile) {
                const profile = window.AuthHelper.getUserProfile();
                if (profile?.id) return profile.id;
            }
            return null;
        },
        
        /**
         * Get device type
         */
        getDeviceType() {
            return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        },
        
        /**
         * Record view using RPC (matches other modules)
         */
        async recordView() {
            if (this.state.viewRecorded) return;
            if (!this.state.currentContent) return;
            
            // Ensure supabase is available
            if (!window.supabaseAuth) {
                console.warn('⚠️ [HERO-VIEW] Supabase not available');
                return;
            }
            
            this.state.viewRecorded = true;
            this.clearViewTimer();
            
            const contentId = this.state.currentContent.id;
            const userId = this.getCurrentUserId();
            const sessionId = this.state.sessionId;
            const deviceType = this.getDeviceType();
            const currentTime = Math.floor(this.elements.heroVideo?.currentTime || 0);
            
            console.log('📝 [HERO-VIEW] Recording view for content:', contentId);
            
            try {
                // Use RPC for view recording
                const { data, error } = await window.supabaseAuth.rpc('record_content_view', {
                    p_content_id: parseInt(contentId, 10),
                    p_user_id: userId || null,
                    p_session_id: sessionId || this.state.sessionId,
                    p_device_type: deviceType
                });
                
                if (error) {
                    console.error('❌ [HERO-VIEW] RPC view recording failed:', error);
                    // Fallback to direct insert
                    await this.recordViewFallback(contentId, userId, sessionId, deviceType);
                    return;
                }
                
                console.log(`✅ [HERO-VIEW] View recorded for content ${contentId}, total views: ${data?.views || 0}`);
                
                // Update UI with new view count
                if (data?.views !== undefined) {
                    const views = this.formatNumber(data.views);
                    if (this.elements.heroViews) {
                        this.elements.heroViews.textContent = views;
                    }
                    // Update state
                    if (this.state.currentContent) {
                        this.state.currentContent.total_views = data.views;
                    }
                }
                
                // Dispatch global event
                window.dispatchEvent(new CustomEvent('content-views-updated', {
                    detail: { contentId: contentId, viewsCount: data?.views || 0 }
                }));
                
            } catch (err) {
                console.error('❌ [HERO-VIEW] View recording error:', err);
            }
        },
        
        /**
         * Fallback view recording if RPC fails
         */
        async recordViewFallback(contentId, userId, sessionId, deviceType) {
            try {
                const contentIdNum = parseInt(contentId, 10);
                if (isNaN(contentIdNum)) return;
                
                const finalSessionId = sessionId || this.state.sessionId || 'hero_' + Date.now();
                const finalDeviceType = deviceType || this.getDeviceType();
                
                // Check if view already exists
                const { data: existing, error: checkError } = await window.supabaseAuth
                    .from('content_views')
                    .select('id')
                    .eq('content_id', contentIdNum)
                    .eq('session_id', finalSessionId)
                    .maybeSingle();
                
                if (existing) {
                    console.log('⏭️ [HERO-VIEW] View already recorded, skipping');
                    return;
                }
                
                const viewRecord = {
                    content_id: contentIdNum,
                    user_id: userId || null,
                    session_id: finalSessionId,
                    counted_as_view: true,
                    view_duration: Math.floor(this.elements.heroVideo?.currentTime || 15),
                    device_type: finalDeviceType,
                    viewed_at: new Date().toISOString()
                };
                
                const { error: insertError } = await window.supabaseAuth
                    .from('content_views')
                    .insert([viewRecord]);
                
                if (insertError) throw insertError;
                
                console.log(`✅ [HERO-VIEW] View recorded via fallback for content ${contentId}`);
                
                // Get updated count
                const { count, error: countError } = await window.supabaseAuth
                    .from('content_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', contentIdNum)
                    .eq('counted_as_view', true);
                
                if (!countError && count !== null) {
                    const views = this.formatNumber(count);
                    if (this.elements.heroViews) {
                        this.elements.heroViews.textContent = views;
                    }
                }
                
            } catch (err) {
                console.error('❌ [HERO-VIEW] Fallback view recording error:', err);
            }
        },
        
        async rotateContent() {
            console.log('🔄 [HERO-ROTATE] Rotating hero content...');
            // Clean up current view state
            this.state.viewRecorded = false;
            this.clearViewTimer();
            this.state.playbackSessionId = null;
            this.state.initialized = false;
            await this.loadContent();
            this.state.initialized = true;
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
            
            if (this.elements.heroVideo) {
                this.elements.heroVideo.style.backgroundImage = 'url(https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop)';
                this.elements.heroVideo.style.backgroundSize = 'cover';
                this.elements.heroVideo.style.backgroundPosition = 'center';
            }
            
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
            this.clearViewTimer();
            if (this.elements.heroVideo) {
                this.elements.heroVideo.pause();
                this.elements.heroVideo.src = '';
                this.state.isPlaying = false;
            }
            this.state.initialized = false;
            this.state.viewRecorded = false;
            console.log('🎬 [HERO] Module destroyed');
        }
    };
    
    // Make available globally
    window.HeroContent = HeroContent;
    console.log('🎬 [HERO-LOAD] HeroContent module registered on window');
    
    // Auto-initialize with a delay to ensure DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.HeroContent.init(), 100);
        });
    } else {
        setTimeout(() => window.HeroContent.init(), 100);
    }
    
    // Fallback initialization
    window.addEventListener('load', () => {
        if (!window.HeroContent.state.initialized) {
            console.log('🎬 [HERO-LOAD] Load event fallback, initializing...');
            setTimeout(() => window.HeroContent.init(), 100);
        }
    });
    
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.HeroContent;
}
