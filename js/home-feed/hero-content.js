/**
 * Hero Content Module
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 * 
 * FIXED: Complete rewrite with proper debugging
 * - Shows detailed console logs
 * - Actually fetches real video content
 * - Random selection every 3 hours
 */

const HeroContent = (function() {
    'use strict';
    
    let currentHeroContent = null;
    let heroRotationInterval = null;
    
    // 3 hours in milliseconds
    const HERO_ROTATION_MS = 3 * 60 * 60 * 1000;
    
    // Video-only content formats to filter
    const VIDEO_FORMATS = ['video', 'movie', 'film', 'series_episode', 'short', 'music_video', 'documentary', 'long_form'];
    const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.mkv'];
    
    let elements = {};
    
    async function init() {
        console.log('🎬 [HERO] Hero Content Module initializing...');
        cacheElements();
        
        if (!elements.heroSection) {
            console.error('❌ [HERO] Hero section elements not found - check HTML IDs');
            return;
        }
        
        console.log('✅ [HERO] Elements found, loading content...');
        await loadCinematicHero();
        setupEventListeners();
        console.log('✅ [HERO] Hero Content Module initialized');
    }
    
    function cacheElements() {
        elements = {
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
        
        console.log('🎬 [HERO] Elements cached:', {
            heroSection: !!elements.heroSection,
            heroVideo: !!elements.heroVideo,
            heroTitle: !!elements.heroTitle
        });
    }
    
    function setupEventListeners() {
        if (elements.heroExploreBtn) {
            elements.heroExploreBtn.addEventListener('click', () => {
                window.location.href = '/content-library';
            });
        }
        
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.addEventListener('click', () => {
                const contentId = elements.heroWatchBtn.dataset.contentId;
                if (contentId) {
                    window.location.href = `content-detail.html?id=${contentId}`;
                } else {
                    window.location.href = '/trending_screen';
                }
            });
        }
        
        setupAudioControl();
    }
    
    async function loadCinematicHero() {
        console.log('🎬 [HERO] Loading cinematic hero content...');
        
        try {
            // Check if supabaseAuth is available
            if (!window.supabaseAuth) {
                console.error('❌ [HERO] window.supabaseAuth is not available!');
                showHeroPlaceholder('Supabase not available');
                return;
            }
            
            console.log('✅ [HERO] supabaseAuth available, fetching video content...');
            
            // Fetch all published content with file_url
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
                console.error('❌ [HERO] Error fetching content:', error);
                showHeroPlaceholder(`Database error: ${error.message}`);
                return;
            }
            
            if (!allContent || allContent.length === 0) {
                console.warn('⚠️ [HERO] No content found in database!');
                showHeroPlaceholder('No content available');
                return;
            }
            
            console.log(`📊 [HERO] Fetched ${allContent.length} total content items`);
            
            // Filter for video content only
            const videoContent = allContent.filter(item => {
                const fileUrl = (item.file_url || '').toLowerCase();
                const format = (item.content_format || '').toLowerCase();
                const type = (item.content_type || '').toLowerCase();
                
                // Check by content_format or content_type
                if (VIDEO_FORMATS.includes(format) || VIDEO_FORMATS.includes(type)) {
                    return true;
                }
                
                // Check by file extension
                for (const ext of VIDEO_EXTENSIONS) {
                    if (fileUrl.endsWith(ext)) {
                        return true;
                    }
                }
                
                return false;
            });
            
            console.log(`📹 [HERO] Found ${videoContent.length} video content items out of ${allContent.length}`);
            
            if (videoContent.length === 0) {
                console.warn('⚠️ [HERO] No video content found! Showing placeholder.');
                showHeroPlaceholder('No video content available. Please upload videos.');
                return;
            }
            
            // Log first few videos for debugging
            videoContent.slice(0, 3).forEach((v, i) => {
                console.log(`   Video ${i + 1}: "${v.title}" (${v.content_format || 'unknown format'})`);
            });
            
            // Get engagement stats for these videos
            const videoIds = videoContent.map(v => v.id);
            let engagementStats = [];
            
            try {
                const { data: stats, error: statsError } = await window.supabaseAuth
                    .from('content_engagement_stats')
                    .select('content_id, total_views, total_likes, total_shares')
                    .in('content_id', videoIds);
                
                if (!statsError && stats) {
                    engagementStats = stats;
                    console.log(`📊 [HERO] Fetched engagement stats for ${engagementStats.length} videos`);
                } else {
                    console.log('📊 [HERO] No engagement stats available');
                }
            } catch (err) {
                console.log('📊 [HERO] Engagement stats table may not exist yet');
            }
            
            // Create stats map
            const statsMap = {};
            engagementStats.forEach(stat => {
                statsMap[stat.content_id] = stat;
            });
            
            // Enrich video content with stats
            const enrichedVideos = videoContent.map(video => ({
                ...video,
                total_views: statsMap[video.id]?.total_views || 0,
                total_likes: statsMap[video.id]?.total_likes || 0,
                total_shares: statsMap[video.id]?.total_shares || 0
            }));
            
            // Store all videos for rotation
            window.heroContentList = enrichedVideos;
            
            // Select random video
            const lastFeaturedId = localStorage.getItem('hero_last_content_id');
            const lastFeaturedTime = localStorage.getItem('hero_last_update_time');
            const now = Date.now();
            
            let selectedVideo = null;
            
            // Check if we should use existing or select new
            if (lastFeaturedId && lastFeaturedTime && (now - parseInt(lastFeaturedTime)) < HERO_ROTATION_MS) {
                // Still within 3-hour window, try to use same video
                selectedVideo = enrichedVideos.find(v => v.id.toString() === lastFeaturedId);
                if (selectedVideo) {
                    console.log(`🎬 [HERO] Using existing video (within 3-hour window): "${selectedVideo.title}"`);
                }
            }
            
            if (!selectedVideo) {
                // Select random video
                let availableVideos = enrichedVideos;
                if (lastFeaturedId && enrichedVideos.length > 1) {
                    availableVideos = enrichedVideos.filter(v => v.id.toString() !== lastFeaturedId);
                }
                
                const randomIndex = Math.floor(Math.random() * availableVideos.length);
                selectedVideo = availableVideos[randomIndex];
                
                // Save selection
                localStorage.setItem('hero_last_content_id', selectedVideo.id.toString());
                localStorage.setItem('hero_last_update_time', now.toString());
                
                console.log(`🎬 [HERO] Selected NEW random video: "${selectedVideo.title}" (index: ${randomIndex} of ${availableVideos.length})`);
            }
            
            // Set up rotation interval
            if (heroRotationInterval) clearInterval(heroRotationInterval);
            heroRotationInterval = setInterval(rotateHeroContent, HERO_ROTATION_MS);
            console.log(`⏰ [HERO] Rotation set for ${HERO_ROTATION_MS / 1000 / 60 / 60} hours`);
            
            // Render the selected video
            await renderHeroContent(selectedVideo);
            
        } catch (error) {
            console.error('❌ [HERO] Fatal error loading hero content:', error);
            showHeroPlaceholder(`Error: ${error.message}`);
        }
    }
    
    async function rotateHeroContent() {
        console.log('🔄 [HERO] Rotating hero content (3-hour interval)...');
        
        if (!window.heroContentList || window.heroContentList.length === 0) {
            console.warn('⚠️ [HERO] No content list available, reloading...');
            await loadCinematicHero();
            return;
        }
        
        const lastFeaturedId = localStorage.getItem('hero_last_content_id');
        let availableVideos = window.heroContentList;
        
        if (lastFeaturedId && window.heroContentList.length > 1) {
            availableVideos = window.heroContentList.filter(v => v.id.toString() !== lastFeaturedId);
        }
        
        const randomIndex = Math.floor(Math.random() * availableVideos.length);
        const newVideo = availableVideos[randomIndex];
        
        localStorage.setItem('hero_last_content_id', newVideo.id.toString());
        localStorage.setItem('hero_last_update_time', Date.now().toString());
        
        console.log(`🔄 [HERO] Rotating to: "${newVideo.title}"`);
        
        // Animate transition
        if (elements.heroSection) {
            elements.heroSection.style.opacity = '0';
            elements.heroSection.style.transition = 'opacity 0.5s ease';
            
            setTimeout(async () => {
                await renderHeroContent(newVideo);
                elements.heroSection.style.opacity = '1';
            }, 500);
        } else {
            await renderHeroContent(newVideo);
        }
    }
    
    async function renderHeroContent(content) {
        if (!content) {
            console.error('❌ [HERO] No content to render');
            showHeroPlaceholder('No content selected');
            return;
        }
        
        console.log(`🎬 [HERO] Rendering content: "${content.title}"`);
        console.log(`   File URL: ${content.file_url ? content.file_url.substring(0, 100) + '...' : 'MISSING'}`);
        console.log(`   Thumbnail: ${content.thumbnail_url || 'MISSING'}`);
        
        currentHeroContent = content;
        
        // Update text content first
        updateTextContent(content);
        
        // Update creator info
        await updateCreatorInfo(content);
        
        // Update metrics
        await updateMetrics(content);
        
        // Update badges
        updateVerifiedBadge(content);
        updateFeaturedBadge(content);
        
        // Handle video background
        await handleBackgroundVideo(content);
        
        // Update watch button
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.dataset.contentId = content.id;
        }
        
        console.log('✅ [HERO] Content rendered successfully');
    }
    
    async function handleBackgroundVideo(content) {
        if (!elements.heroVideo || !elements.videoSource) {
            console.warn('⚠️ [HERO] Video elements not found');
            return;
        }
        
        let videoUrl = content.file_url;
        
        if (!videoUrl) {
            console.warn(`⚠️ [HERO] No video URL for content: ${content.title}`);
            // Fallback to thumbnail
            if (content.thumbnail_url) {
                let thumbUrl = content.thumbnail_url;
                if (window.fixMediaUrl) thumbUrl = window.fixMediaUrl(content.thumbnail_url);
                else if (!thumbUrl.startsWith('http')) {
                    thumbUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${thumbUrl.replace(/^\/+/, '')}`;
                }
                elements.heroVideo.style.backgroundImage = `url(${thumbUrl})`;
                elements.heroVideo.style.backgroundSize = 'cover';
                elements.heroVideo.style.backgroundPosition = 'center';
            }
            return;
        }
        
        // Fix the URL if needed
        if (window.fixMediaUrl) {
            videoUrl = window.fixMediaUrl(videoUrl);
        } else if (!videoUrl.startsWith('http')) {
            videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${videoUrl.replace(/^\/+/, '')}`;
        }
        
        console.log(`🎬 [HERO] Loading video: ${videoUrl.substring(0, 80)}...`);
        
        // Reset video element
        elements.heroVideo.pause();
        elements.videoSource.src = videoUrl;
        elements.heroVideo.load();
        elements.heroVideo.style.opacity = '0';
        
        // Try to play
        const playPromise = elements.heroVideo.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ [HERO] Video playing successfully');
                elements.heroVideo.style.opacity = '1';
                if (elements.heroAudioControl) {
                    elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                }
            }).catch(error => {
                console.log('⚠️ [HERO] Video autoplay prevented:', error.message);
                elements.heroVideo.style.opacity = '1';
                showVideoPlayButton();
            });
        }
        
        // Handle errors
        elements.heroVideo.onerror = (e) => {
            console.error('❌ [HERO] Video failed to load:', videoUrl);
            console.error('   Error:', e);
            
            // Fallback to thumbnail
            if (content.thumbnail_url) {
                let thumbUrl = content.thumbnail_url;
                if (window.fixMediaUrl) thumbUrl = window.fixMediaUrl(content.thumbnail_url);
                else if (!thumbUrl.startsWith('http')) {
                    thumbUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${thumbUrl.replace(/^\/+/, '')}`;
                }
                elements.heroVideo.style.backgroundImage = `url(${thumbUrl})`;
                elements.heroVideo.style.backgroundSize = 'cover';
                elements.heroVideo.style.backgroundPosition = 'center';
            }
        };
        
        elements.heroVideo.oncanplay = () => {
            console.log('✅ [HERO] Video can play');
            elements.heroVideo.style.opacity = '1';
        };
    }
    
    function showVideoPlayButton() {
        if (!elements.heroSection) return;
        if (elements.heroSection.querySelector('.hero-video-play-btn')) return;
        
        const playBtn = document.createElement('button');
        playBtn.className = 'hero-video-play-btn';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.setAttribute('aria-label', 'Play Video');
        
        playBtn.onclick = (e) => {
            e.stopPropagation();
            if (elements.heroVideo) {
                elements.heroVideo.play().catch(err => console.log('Play failed:', err));
                playBtn.remove();
            }
        };
        
        elements.heroSection.appendChild(playBtn);
        
        setTimeout(() => {
            if (playBtn && playBtn.parentNode) playBtn.remove();
        }, 5000);
    }
    
    async function updateCreatorInfo(content) {
        const creator = content.user_profiles;
        
        if (elements.heroCreatorName) {
            const displayName = creator?.full_name || creator?.username || 'Featured Creator';
            elements.heroCreatorName.textContent = displayName;
            elements.heroCreatorName.title = displayName;
            console.log(`👤 [HERO] Creator: ${displayName}`);
        }
        
        if (elements.heroCreatorAvatar) {
            elements.heroCreatorAvatar.innerHTML = '';
            
            if (creator?.avatar_url) {
                let avatarUrl = creator.avatar_url;
                if (window.fixAvatarUrl) avatarUrl = window.fixAvatarUrl(creator.avatar_url);
                else if (!avatarUrl.startsWith('http')) {
                    avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl.replace(/^\/+/, '')}`;
                }
                
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = displayName;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = () => {
                    elements.heroCreatorAvatar.innerHTML = '';
                    const initials = getInitials(displayName);
                    const span = document.createElement('span');
                    span.className = 'hero-creator-initials';
                    span.textContent = initials;
                    elements.heroCreatorAvatar.appendChild(span);
                };
                elements.heroCreatorAvatar.appendChild(img);
            } else {
                const initials = getInitials(displayName);
                const span = document.createElement('span');
                span.className = 'hero-creator-initials';
                span.textContent = initials;
                elements.heroCreatorAvatar.appendChild(span);
            }
        }
        
        if (elements.heroTrendingText) {
            elements.heroTrendingText.textContent = '🌟 Featured Video';
        }
    }
    
    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(part => part.charAt(0).toUpperCase()).join('').substring(0, 2);
    }
    
    function updateTextContent(content) {
        if (elements.heroTitle) {
            elements.heroTitle.textContent = content.title || 'DISCOVER & CONNECT';
            animateElement(elements.heroTitle);
        }
        
        if (elements.heroSubtitle) {
            let description = content.description || 'Explore amazing video content from across Africa';
            if (description.length > 120) {
                description = description.substring(0, 117) + '...';
            }
            elements.heroSubtitle.textContent = description;
            animateElement(elements.heroSubtitle, 0.1);
        }
    }
    
    function animateElement(element, delay = 0) {
        if (!element) return;
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            element.style.transition = 'all 0.5s ease';
        }, 100 + (delay * 100));
    }
    
    async function updateMetrics(content) {
        const views = formatNumber(content.total_views || 0);
        const favorites = formatNumber(content.favorites_count || 0);
        const shares = formatNumber(content.total_shares || 0);
        
        if (elements.heroViews) elements.heroViews.textContent = views;
        if (elements.heroFavorites) elements.heroFavorites.textContent = favorites;
        if (elements.heroShares) elements.heroShares.textContent = shares;
        
        // Get connector count
        let connectorCount = 0;
        if (content.user_profiles?.id && window.supabaseAuth) {
            try {
                const { count } = await window.supabaseAuth
                    .from('connectors')
                    .select('*', { count: 'exact', head: true })
                    .eq('connected_id', content.user_profiles.id)
                    .eq('connection_type', 'creator');
                
                connectorCount = count || 0;
            } catch (err) {
                console.log('📊 [HERO] Could not fetch connector count');
            }
        }
        
        if (elements.heroConnectors) elements.heroConnectors.textContent = formatNumber(connectorCount);
        
        console.log(`📊 [HERO] Metrics: ${views} views, ${favorites} favorites, ${shares} shares`);
    }
    
    function updateVerifiedBadge(content) {
        if (elements.heroVerifiedBadge) {
            const isVerified = (content.total_views || 0) > 10000;
            elements.heroVerifiedBadge.style.display = isVerified ? 'inline-flex' : 'none';
        }
    }
    
    function updateFeaturedBadge(content) {
        if (elements.heroFeaturedBadge) {
            elements.heroFeaturedBadge.style.display = 'flex';
            elements.heroFeaturedBadge.innerHTML = '<i class="fas fa-star"></i> Featured Video';
        }
    }
    
    function setupAudioControl() {
        if (!elements.heroAudioControl || !elements.heroVideo) return;
        
        const newControl = elements.heroAudioControl.cloneNode(true);
        if (elements.heroAudioControl.parentNode) {
            elements.heroAudioControl.parentNode.replaceChild(newControl, elements.heroAudioControl);
        }
        elements.heroAudioControl = newControl;
        
        let isMuted = true;
        elements.heroVideo.muted = true;
        elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
        
        elements.heroAudioControl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isMuted = !isMuted;
            elements.heroVideo.muted = isMuted;
            
            if (isMuted) {
                elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
            } else {
                elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-up"></i>';
                if (elements.heroVideo.paused) {
                    elements.heroVideo.play().catch(err => console.log('Play on unmute failed:', err));
                }
            }
        });
    }
    
    function showHeroPlaceholder(reason = 'No content available') {
        console.log(`🎬 [HERO] Showing placeholder: ${reason}`);
        
        if (elements.heroTitle) {
            elements.heroTitle.textContent = 'WELCOME TO BANTU STREAM CONNECT';
        }
        
        if (elements.heroSubtitle) {
            elements.heroSubtitle.textContent = 'No video content available. Be the first to upload and share your story!';
        }
        
        // Add upload button
        const heroActions = document.querySelector('.hero-actions');
        if (heroActions && !heroActions.querySelector('.hero-upload-btn')) {
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'hero-primary-btn hero-upload-btn';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Content';
            uploadBtn.onclick = (e) => {
                e.preventDefault();
                window.location.href = '/creator-upload.html';
            };
            heroActions.appendChild(uploadBtn);
        }
        
        // Set default background
        if (elements.heroVideo) {
            elements.heroVideo.style.backgroundImage = 'url(https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop)';
            elements.heroVideo.style.backgroundSize = 'cover';
            elements.heroVideo.style.backgroundPosition = 'center';
        }
        
        // Hide metrics if no content
        if (elements.heroViews) elements.heroViews.textContent = '0';
        if (elements.heroFavorites) elements.heroFavorites.textContent = '0';
        if (elements.heroConnectors) elements.heroConnectors.textContent = '0';
        if (elements.heroShares) elements.heroShares.textContent = '0';
    }
    
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    async function refreshHeroContent() {
        console.log('🔄 [HERO] Manual refresh requested');
        await loadCinematicHero();
    }
    
    function destroy() {
        if (heroRotationInterval) {
            clearInterval(heroRotationInterval);
            heroRotationInterval = null;
        }
        if (elements.heroVideo) {
            elements.heroVideo.pause();
            elements.heroVideo.src = '';
        }
        console.log('🎬 [HERO] Module destroyed');
    }
    
    // Public API
    return { 
        init, 
        destroy, 
        rotate: rotateHeroContent, 
        reload: loadCinematicHero,
        refresh: refreshHeroContent
    };
})();

// Auto-initialization disabled - handled by master init
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroContent;
}
