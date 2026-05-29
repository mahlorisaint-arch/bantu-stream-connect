/**
 * Hero Content Module
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 * 
 * FIXED: 
 * - Only selects VIDEO content (no audio, no articles)
 * - Random selection every 3 hours (not 4 hours)
 * - Prioritizes featured content but falls back to random videos
 * - Enhanced with better error handling and fallbacks
 */

const HeroContent = (function() {
    'use strict';
    
    let currentHeroContent = null;
    let heroRotationInterval = null;
    let currentVideo = null;
    
    // FIXED: Changed from 4 hours to 3 hours (10800000 ms)
    const HERO_ROTATION_HOURS = 3;
    const HERO_ROTATION_MS = HERO_ROTATION_HOURS * 60 * 60 * 1000;
    
    // FIXED: Video-only content formats
    const VIDEO_FORMATS = ['video', 'movie', 'film', 'series_episode', 'short', 'music_video', 'documentary', 'long_form'];
    const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    
    let elements = {};
    
    async function init() {
        console.log('🎬 Hero Content Module initializing...');
        cacheElements();
        
        if (!elements.heroSection) {
            console.error('❌ Hero section elements not found');
            return;
        }
        
        await loadCinematicHero();
        setupEventListeners();
        console.log('✅ Hero Content Module initialized');
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
        console.log('🎬 Loading Cinematic Hero with 3-hour random rotation...');
        
        try {
            if (!window.supabaseAuth) {
                console.warn('Supabase not available, using placeholder');
                showHeroPlaceholder();
                return;
            }
            
            // FIXED: Get only VIDEO content (filter by content_format and file_url)
            const videoContent = await fetchVideoOnlyContent();
            
            if (!videoContent || videoContent.length === 0) {
                console.warn('No video content available for hero');
                showHeroPlaceholder();
                return;
            }
            
            // Store all video content for rotation
            window.heroContentList = videoContent;
            
            // Get the last featured content and time from localStorage
            const lastFeaturedId = localStorage.getItem('hero_last_content_id');
            const lastFeaturedTime = localStorage.getItem('hero_last_update_time');
            const now = Date.now();
            
            let selectedContent = null;
            
            // Check if we should use the same content or rotate
            if (lastFeaturedId && lastFeaturedTime && (now - parseInt(lastFeaturedTime)) < HERO_ROTATION_MS) {
                // Still within rotation period, try to keep same content
                selectedContent = videoContent.find(c => c.id.toString() === lastFeaturedId);
                if (selectedContent) {
                    console.log('🎬 Using existing featured content (within 3-hour window):', selectedContent.title);
                }
            }
            
            // FIXED: Always select RANDOM content from available videos (no sorting by views)
            if (!selectedContent) {
                // Filter out the last featured content to avoid repetition when possible
                let availableContent = videoContent;
                if (lastFeaturedId && videoContent.length > 1) {
                    availableContent = videoContent.filter(c => c.id.toString() !== lastFeaturedId);
                }
                
                // Select random video from available content
                const randomIndex = Math.floor(Math.random() * availableContent.length);
                selectedContent = availableContent[randomIndex];
                
                // Store the selected content ID and timestamp
                localStorage.setItem('hero_last_content_id', selectedContent.id.toString());
                localStorage.setItem('hero_last_update_time', now.toString());
                
                console.log('🎬 Rotated to new random featured video:', selectedContent.title);
                console.log('   Available videos count:', videoContent.length);
                console.log('   Random selection index:', randomIndex);
            }
            
            // Clear existing rotation interval and set new one
            if (heroRotationInterval) clearInterval(heroRotationInterval);
            heroRotationInterval = setInterval(rotateHeroContent, HERO_ROTATION_MS);
            
            // Render the selected content
            await renderHeroContent(selectedContent);
            
        } catch (error) {
            console.error('❌ Error loading cinematic hero:', error);
            showHeroPlaceholder();
        }
    }
    
    // FIXED: New function to fetch only video content
    async function fetchVideoOnlyContent() {
        if (!window.supabaseAuth) return [];
        
        try {
            // First fetch all published content
            const { data: contentList, error } = await window.supabaseAuth
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
                .limit(50); // Fetch more to have enough videos to choose from
            
            if (error) {
                console.error('Error fetching content:', error);
                return [];
            }
            
            if (!contentList || contentList.length === 0) {
                return [];
            }
            
            // FIXED: Filter to keep only video content
            const videoContent = contentList.filter(item => {
                // Check by content_format
                if (item.content_format && VIDEO_FORMATS.includes(item.content_format.toLowerCase())) {
                    return true;
                }
                // Check by content_type
                if (item.content_type && VIDEO_FORMATS.includes(item.content_type.toLowerCase())) {
                    return true;
                }
                // Check file_url extension for video files
                const fileUrl = (item.file_url || '').toLowerCase();
                if (fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm') || 
                    fileUrl.endsWith('.mov') || fileUrl.endsWith('.avi') ||
                    fileUrl.endsWith('.m4v') || fileUrl.endsWith('.mkv')) {
                    return true;
                }
                return false;
            });
            
            console.log(`📹 Found ${videoContent.length} video items out of ${contentList.length} total content`);
            
            // Get engagement stats for these video items
            if (videoContent.length > 0) {
                const contentIds = videoContent.map(c => c.id);
                const { data: engagementStats } = await window.supabaseAuth
                    .from('content_engagement_stats')
                    .select('content_id, total_views, total_likes, total_shares')
                    .in('content_id', contentIds);
                
                const statsMap = {};
                engagementStats?.forEach(stat => {
                    statsMap[stat.content_id] = stat;
                });
                
                // Merge stats into content
                return videoContent.map(content => ({
                    ...content,
                    total_views: statsMap[content.id]?.total_views || 0,
                    total_likes: statsMap[content.id]?.total_likes || 0,
                    total_shares: statsMap[content.id]?.total_shares || 0
                }));
            }
            
            return videoContent;
            
        } catch (err) {
            console.error('Exception in fetchVideoOnlyContent:', err);
            return [];
        }
    }
    
    async function rotateHeroContent() {
        console.log('🔄 Rotating hero content (3-hour interval)...');
        
        if (!window.heroContentList || window.heroContentList.length === 0) {
            await loadCinematicHero();
            return;
        }
        
        const lastFeaturedId = localStorage.getItem('hero_last_content_id');
        
        // FIXED: Select random video, avoiding last one if possible
        let availableContent = window.heroContentList;
        if (lastFeaturedId && window.heroContentList.length > 1) {
            availableContent = window.heroContentList.filter(c => c.id.toString() !== lastFeaturedId);
        }
        
        // Random selection
        const randomIndex = Math.floor(Math.random() * availableContent.length);
        const newContent = availableContent[randomIndex];
        
        // Store new rotation info
        localStorage.setItem('hero_last_content_id', newContent.id.toString());
        localStorage.setItem('hero_last_update_time', Date.now().toString());
        
        // Animate transition
        if (elements.heroSection) {
            elements.heroSection.style.opacity = '0';
            elements.heroSection.style.transition = 'opacity 0.5s ease';
            
            setTimeout(async () => {
                await renderHeroContent(newContent);
                elements.heroSection.style.opacity = '1';
            }, 500);
        } else {
            await renderHeroContent(newContent);
        }
        
        console.log('🔄 Hero rotated to random video:', newContent.title);
    }
    
    async function renderHeroContent(content) {
        if (!content) {
            console.error('No content to render in hero');
            showHeroPlaceholder();
            return;
        }
        
        console.log('🎬 Rendering hero content:', content.title);
        currentHeroContent = content;
        
        await handleBackgroundVideo(content);
        await updateCreatorInfo(content);
        updateTextContent(content);
        await updateMetrics(content);
        updateVerifiedBadge(content);
        updateFeaturedBadge(content);
        
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.dataset.contentId = content.id;
        }
        
        console.log('✅ Hero content rendered successfully');
    }
    
    async function handleBackgroundVideo(content) {
        if (!elements.heroVideo || !elements.videoSource) return;
        
        if (content.file_url) {
            let videoUrl = content.file_url;
            if (window.fixMediaUrl) {
                videoUrl = window.fixMediaUrl(content.file_url);
            } else if (!videoUrl.startsWith('http')) {
                videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${content.file_url.replace(/^\/+/, '')}`;
            }
            
            console.log('🎬 Loading video:', videoUrl.substring(0, 100) + '...');
            
            // Reset video element
            elements.heroVideo.pause();
            elements.videoSource.src = videoUrl;
            elements.heroVideo.load();
            elements.heroVideo.style.opacity = '0';
            
            // Try to play the video
            const playPromise = elements.heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ Hero video playing');
                    elements.heroVideo.style.opacity = '1';
                    if (elements.heroAudioControl) {
                        elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    }
                }).catch(error => {
                    console.log('Video autoplay prevented:', error.message);
                    showVideoPlayButton();
                    // Still show the video thumbnail
                    elements.heroVideo.style.opacity = '1';
                });
            }
            
            // Handle video loading errors
            elements.heroVideo.onerror = (e) => {
                console.error('Video failed to load:', videoUrl);
                console.error('Error details:', e);
                // Fallback to thumbnail if video fails
                if (content.thumbnail_url) {
                    let thumbnailUrl = content.thumbnail_url;
                    if (window.fixMediaUrl) {
                        thumbnailUrl = window.fixMediaUrl(content.thumbnail_url);
                    } else if (!thumbnailUrl.startsWith('http')) {
                        thumbnailUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${content.thumbnail_url.replace(/^\/+/, '')}`;
                    }
                    elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
                    elements.heroVideo.style.backgroundSize = 'cover';
                    elements.heroVideo.style.backgroundPosition = 'center';
                }
            };
            
            elements.heroVideo.oncanplay = () => {
                if (elements.heroVideo) {
                    elements.heroVideo.style.opacity = '1';
                }
            };
        } else if (content.thumbnail_url) {
            // No video URL, use thumbnail as background
            let thumbnailUrl = content.thumbnail_url;
            if (window.fixMediaUrl) {
                thumbnailUrl = window.fixMediaUrl(content.thumbnail_url);
            } else if (!thumbnailUrl.startsWith('http')) {
                thumbnailUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${content.thumbnail_url.replace(/^\/+/, '')}`;
            }
            elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
            elements.heroVideo.style.backgroundSize = 'cover';
            elements.heroVideo.style.backgroundPosition = 'center';
            elements.heroVideo.style.opacity = '1';
        }
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
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (playBtn && playBtn.parentNode) {
                playBtn.remove();
            }
        }, 5000);
    }
    
    async function updateCreatorInfo(content) {
        const creator = content.user_profiles;
        
        if (creator && elements.heroCreatorName) {
            const displayName = creator.full_name || creator.username || 'Featured Creator';
            elements.heroCreatorName.textContent = displayName;
            elements.heroCreatorName.title = displayName;
            
            if (elements.heroCreatorAvatar) {
                elements.heroCreatorAvatar.innerHTML = '';
                
                if (creator.avatar_url) {
                    let avatarUrl = creator.avatar_url;
                    if (window.fixAvatarUrl) {
                        avatarUrl = window.fixAvatarUrl(creator.avatar_url);
                    } else if (!avatarUrl.startsWith('http')) {
                        avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${creator.avatar_url.replace(/^\/+/, '')}`;
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
                        const initialsSpan = document.createElement('span');
                        initialsSpan.className = 'hero-creator-initials';
                        initialsSpan.textContent = initials;
                        elements.heroCreatorAvatar.appendChild(initialsSpan);
                    };
                    elements.heroCreatorAvatar.appendChild(img);
                } else {
                    const initials = getInitials(displayName);
                    const initialsSpan = document.createElement('span');
                    initialsSpan.className = 'hero-creator-initials';
                    initialsSpan.textContent = initials;
                    elements.heroCreatorAvatar.appendChild(initialsSpan);
                }
            }
            
            if (elements.heroTrendingText) {
                elements.heroTrendingText.textContent = '🌟 Featured Video';
            }
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
        const creator = content.user_profiles;
        
        let totalViews = content.total_views || 0;
        let totalShares = content.total_shares || 0;
        let connectorCount = 0;
        
        // Get fresh metrics from engagement stats if available
        if (window.supabaseAuth && content.id) {
            try {
                const { data: metricsData, error: metricsError } = await window.supabaseAuth
                    .from('content_engagement_stats')
                    .select('total_views, total_shares')
                    .eq('content_id', content.id)
                    .maybeSingle();
                
                if (!metricsError && metricsData) {
                    totalViews = metricsData.total_views || totalViews;
                    totalShares = metricsData.total_shares || totalShares;
                }
                
                // Get connector count for creator
                if (creator && creator.id) {
                    const { count, error: connError } = await window.supabaseAuth
                        .from('connectors')
                        .select('*', { count: 'exact', head: true })
                        .eq('connected_id', creator.id)
                        .eq('connection_type', 'creator');
                    
                    if (!connError && count !== null) {
                        connectorCount = count;
                    }
                }
            } catch (err) {
                console.warn('Error fetching metrics:', err);
            }
        }
        
        if (elements.heroViews) elements.heroViews.textContent = formatNumber(totalViews);
        if (elements.heroFavorites) elements.heroFavorites.textContent = formatNumber(content.favorites_count || 0);
        if (elements.heroConnectors) elements.heroConnectors.textContent = formatNumber(connectorCount);
        if (elements.heroShares) elements.heroShares.textContent = formatNumber(totalShares);
    }
    
    function updateVerifiedBadge(content) {
        const creator = content.user_profiles;
        
        if (elements.heroVerifiedBadge) {
            // Show verified badge for creators with over 10K views OR if they have a verified flag
            const isVerified = (content.total_views || 0) > 10000 || (creator?.is_verified === true);
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
        
        // Clone to remove existing listeners
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
                // Try to play if paused
                if (elements.heroVideo.paused) {
                    elements.heroVideo.play().catch(err => console.log('Play on unmute failed:', err));
                }
            }
        });
    }
    
    function showHeroPlaceholder() {
        console.log('🎬 Showing hero placeholder');
        
        if (elements.heroTitle) {
            elements.heroTitle.textContent = 'WELCOME TO BANTU STREAM CONNECT';
        }
        
        if (elements.heroSubtitle) {
            elements.heroSubtitle.textContent = 'No video content yet. Be the first to upload and share your story!';
        }
        
        // Add upload button to hero actions
        const heroActions = document.querySelector('.hero-actions');
        if (heroActions && !heroActions.querySelector('.hero-upload-btn')) {
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'hero-primary-btn hero-upload-btn';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Content';
            uploadBtn.onclick = (e) => {
                e.preventDefault();
                if (window.currentUser || (window.supabaseAuth?.auth?.getUser())) {
                    window.location.href = '/creator-upload.html';
                } else {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Please sign in to upload content', 'warning');
                    }
                    window.location.href = '/login.html';
                }
            };
            heroActions.appendChild(uploadBtn);
        }
        
        // Try to load a default background
        if (elements.heroVideo) {
            elements.heroVideo.style.backgroundImage = 'url(https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop)';
            elements.heroVideo.style.backgroundSize = 'cover';
            elements.heroVideo.style.backgroundPosition = 'center';
        }
    }
    
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    // Public method to manually refresh hero content
    async function refreshHeroContent() {
        console.log('🔄 Manually refreshing hero content...');
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
            elements.heroVideo.load();
        }
        console.log('🎬 Hero Content Module destroyed');
    }
    
    // Return public API
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
