/**
 * Hero Content Module
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 */

const HeroContent = (function() {
    'use strict';
    
    // Private variables
    let currentHeroContent = null;
    let heroRotationInterval = null;
    let currentVideo = null;
    let currentAudioControl = null;
    
    // Configuration
    const HERO_ROTATION_HOURS = 4;
    const HERO_ROTATION_MS = HERO_ROTATION_HOURS * 60 * 60 * 1000;
    
    // DOM Elements cache
    let elements = {};
    
    /**
     * Initialize Hero Content module
     */
    async function init() {
        console.log('🎬 Hero Content Module initializing...');
        
        // Cache DOM elements
        cacheElements();
        
        if (!elements.heroSection) {
            console.error('❌ Hero section elements not found');
            return;
        }
        
        // Load hero content
        await loadCinematicHero();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('✅ Hero Content Module initialized');
    }
    
    /**
     * Cache DOM elements for performance
     */
    function cacheElements() {
        elements = {
            heroSection: document.getElementById('cinematic-hero'),
            heroVideo: document.getElementById('hero-background-video'),
            videoSource: document.querySelector('#hero-background-video source'),
            heroTitle: document.getElementById('hero-title'),
            heroSubtitle: document.getElementById('hero-subtitle'),
            heroCreatorName: document.getElementById('hero-creator-name'),
            heroCreatorAvatar: document.getElementById('hero-creator-avatar'),
            heroCreatorAvatarImg: document.getElementById('hero-creator-avatar-img'),
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
    
    /**
     * Setup event listeners for hero buttons
     */
    function setupEventListeners() {
        // Explore button
        if (elements.heroExploreBtn) {
            elements.heroExploreBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/content-library';
            });
        }
        
        // Watch button
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.addEventListener('click', () => {
                const contentId = elements.heroWatchBtn.dataset.contentId;
                if (contentId) {
                    window.location.href = `content-detail.html?id=${contentId}`;
                } else {
                    window.location.href = 'https://bantustreamconnect.com/trending_screen';
                }
            });
        }
        
        // Setup audio control (will be reattached after video loads)
        setupAudioControl();
    }
    
    /**
     * Load cinematic hero content with rotation
     */
    async function loadCinematicHero() {
        console.log('🎬 Loading Cinematic Hero with rotation...');
        
        try {
            // Check if Supabase is available
            if (!window.supabaseAuth) {
                console.warn('Supabase not available, using placeholder');
                showHeroPlaceholder();
                return;
            }
            
            // Get all eligible content for hero rotation
            const { data: contentList, error } = await window.supabaseAuth
                .from('Content')
                .select('id, title, description, thumbnail_url, file_url, views_count, favorites_count, shares_count, language, created_at, user_id, user_profiles!user_id(id, full_name, username, avatar_url)')
                .eq('status', 'published')
                .not('file_url', 'is', null)
                .order('views_count', { ascending: false })
                .limit(20);
            
            if (error || !contentList || contentList.length === 0) {
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
                selectedContent = contentList.find(c => c.id.toString() === lastFeaturedId);
                console.log('🎬 Using existing featured content (within rotation window)');
            }
            
            // If no valid saved content, pick a new one
            if (!selectedContent) {
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
            heroRotationInterval = setInterval(rotateHeroContent, HERO_ROTATION_MS);
            
            // Render the selected content
            await renderHeroContent(selectedContent);
            
        } catch (error) {
            console.error('❌ Error loading cinematic hero:', error);
            showHeroPlaceholder();
        }
    }
    
    /**
     * Rotate hero content to next featured item
     */
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
        
        console.log('🔄 Hero rotated to:', newContent.title);
    }
    
    /**
     * Render hero content with the selected content item
     */
    async function renderHeroContent(content) {
        if (!content) {
            console.error('No content to render in hero');
            return;
        }
        
        console.log('🎬 Rendering hero content:', content.title);
        
        // Handle Background Video
        await handleBackgroundVideo(content);
        
        // Update Creator Info
        await updateCreatorInfo(content);
        
        // Update Title and Description
        updateTextContent(content);
        
        // Update Metrics
        await updateMetrics(content);
        
        // Update Verified Badge
        updateVerifiedBadge(content);
        
        // Store current content ID for watch button
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.dataset.contentId = content.id;
        }
        
        console.log('✅ Hero content rendered successfully');
    }
    
    /**
     * Handle background video loading and playback
     */
    async function handleBackgroundVideo(content) {
        if (!elements.heroVideo || !elements.videoSource) return;
        
        if (content.file_url) {
            const videoUrl = window.fixMediaUrl ? window.fixMediaUrl(content.file_url) : content.file_url;
            console.log('🎬 Loading video:', videoUrl);
            
            // Reset video
            elements.heroVideo.pause();
            elements.videoSource.src = videoUrl;
            elements.heroVideo.load();
            
            // Attempt to play with sound muted (autoplay policy)
            const playPromise = elements.heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ Hero video playing');
                    // Reset audio control icon to muted state
                    if (elements.heroAudioControl) {
                        elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                        elements.heroAudioControl.title = 'Unmute';
                    }
                }).catch(error => {
                    console.log('Video autoplay prevented:', error);
                    showVideoPlayButton();
                });
            }
            
            // Handle video errors
            elements.heroVideo.onerror = () => {
                console.error('Video failed to load:', videoUrl);
                // Fallback to thumbnail
                if (content.thumbnail_url) {
                    const thumbnailUrl = window.fixMediaUrl ? window.fixMediaUrl(content.thumbnail_url) : content.thumbnail_url;
                    elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
                    elements.heroVideo.style.backgroundSize = 'cover';
                    elements.heroVideo.style.backgroundPosition = 'center';
                    elements.heroVideo.style.backgroundColor = '#000';
                }
            };
            
            // Video loaded successfully
            elements.heroVideo.oncanplay = () => {
                console.log('✅ Hero video can play');
                if (elements.heroVideo) elements.heroVideo.style.opacity = '1';
            };
        } else if (content.thumbnail_url) {
            // Fallback to thumbnail as background
            const thumbnailUrl = window.fixMediaUrl ? window.fixMediaUrl(content.thumbnail_url) : content.thumbnail_url;
            elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
            elements.heroVideo.style.backgroundSize = 'cover';
            elements.heroVideo.style.backgroundPosition = 'center';
            console.log('🎬 Using thumbnail as background');
        }
    }
    
    /**
     * Show video play button overlay when autoplay is blocked
     */
    function showVideoPlayButton() {
        if (!elements.heroSection) return;
        
        // Check if play button already exists
        if (elements.heroSection.querySelector('.hero-video-play-btn')) return;
        
        const playBtn = document.createElement('button');
        playBtn.className = 'hero-video-play-btn';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        
        playBtn.onclick = () => {
            if (elements.heroVideo) {
                elements.heroVideo.play();
                playBtn.remove();
            }
        };
        
        elements.heroSection.appendChild(playBtn);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (playBtn.parentNode) playBtn.remove();
        }, 5000);
    }
    
    /**
     * Update creator information display
     */
    async function updateCreatorInfo(content) {
        const creator = content.user_profiles;
        
        if (creator && elements.heroCreatorName) {
            const displayName = creator.full_name || creator.username || 'Featured Creator';
            elements.heroCreatorName.textContent = displayName;
            
            // Handle avatar
            if (elements.heroCreatorAvatar) {
                elements.heroCreatorAvatar.innerHTML = '';
                
                if (creator.avatar_url) {
                    const avatarUrl = window.fixAvatarUrl ? window.fixAvatarUrl(creator.avatar_url) : creator.avatar_url;
                    const img = document.createElement('img');
                    img.src = avatarUrl;
                    img.alt = displayName;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.onerror = () => {
                        // Fallback to initials
                        elements.heroCreatorAvatar.innerHTML = '';
                        const initials = window.getInitials ? window.getInitials(displayName) : displayName.charAt(0).toUpperCase();
                        const initialsSpan = document.createElement('span');
                        initialsSpan.className = 'hero-creator-initials';
                        initialsSpan.textContent = initials;
                        elements.heroCreatorAvatar.appendChild(initialsSpan);
                    };
                    elements.heroCreatorAvatar.appendChild(img);
                } else {
                    const initials = window.getInitials ? window.getInitials(displayName) : displayName.charAt(0).toUpperCase();
                    const initialsSpan = document.createElement('span');
                    initialsSpan.className = 'hero-creator-initials';
                    initialsSpan.textContent = initials;
                    elements.heroCreatorAvatar.appendChild(initialsSpan);
                }
            }
            
            // Show trending badge
            if (elements.heroTrendingText) {
                elements.heroTrendingText.textContent = 'Trending ↑ 24h';
            }
        }
    }
    
    /**
     * Update title and subtitle with animation
     */
    function updateTextContent(content) {
        if (elements.heroTitle) {
            elements.heroTitle.textContent = content.title || 'DISCOVER & CONNECT';
            animateElement(elements.heroTitle);
        }
        
        if (elements.heroSubtitle) {
            elements.heroSubtitle.textContent = content.description || 'Explore amazing content from across Africa';
            animateElement(elements.heroSubtitle, 0.1);
        }
    }
    
    /**
     * Animate element fade-in
     */
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
    
    /**
     * Update metrics (views, favorites, connectors, shares)
     */
    async function updateMetrics(content) {
        const creator = content.user_profiles;
        
        // Fetch metrics if available
        let metrics = { views: {}, favorites: {}, shares: {}, connectors: {} };
        
        if (window.fetchAllMetrics && typeof window.fetchAllMetrics === 'function') {
            const contentIds = [content.id];
            const creatorIds = creator ? [creator.id] : [];
            metrics = await window.fetchAllMetrics(contentIds, creatorIds);
        }
        
        if (elements.heroViews) {
            elements.heroViews.textContent = formatNumber(metrics.views[content.id] || content.views_count || 0);
        }
        
        if (elements.heroFavorites) {
            elements.heroFavorites.textContent = formatNumber(content.favorites_count || 0);
        }
        
        if (elements.heroConnectors && creator) {
            elements.heroConnectors.textContent = formatNumber(metrics.connectors[creator.id] || 0);
        }
        
        if (elements.heroShares) {
            elements.heroShares.textContent = formatNumber(metrics.shares[content.id] || content.shares_count || 0);
        }
    }
    
    /**
     * Update verified badge visibility
     */
    function updateVerifiedBadge(content) {
        const creator = content.user_profiles;
        
        if (elements.heroVerifiedBadge && creator) {
            // Use a metric check for verified status (over 1000 connectors)
            const isVerified = (content.views_count || 0) > 10000;
            elements.heroVerifiedBadge.style.display = isVerified ? 'inline-flex' : 'none';
        }
    }
    
    /**
     * Setup audio control for hero video
     */
    function setupAudioControl() {
        if (!elements.heroAudioControl || !elements.heroVideo) return;
        
        // Remove existing listener by cloning
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
                elements.heroAudioControl.title = 'Unmute';
            } else {
                elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-up"></i>';
                elements.heroAudioControl.title = 'Mute';
                
                // Try to play if paused
                if (elements.heroVideo.paused) {
                    elements.heroVideo.play().catch(console.log);
                }
            }
        });
    }
    
    /**
     * Show placeholder when no content exists
     */
    function showHeroPlaceholder() {
        console.log('🎬 Showing hero placeholder');
        
        if (elements.heroTitle) {
            elements.heroTitle.textContent = 'WELCOME TO BANTU STREAM CONNECT';
        }
        
        if (elements.heroSubtitle) {
            elements.heroSubtitle.textContent = 'No content yet. Be the first to upload and share your story!';
        }
        
        // Show upload CTA
        const heroActions = document.querySelector('.hero-actions');
        if (heroActions && !heroActions.querySelector('.hero-upload-btn')) {
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'hero-primary-btn hero-upload-btn';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Content';
            uploadBtn.onclick = () => {
                if (window.currentUser) {
                    window.location.href = 'creator-upload.html';
                } else {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Please sign in to upload content', 'warning');
                    }
                    window.location.href = 'login.html';
                }
            };
            heroActions.appendChild(uploadBtn);
        }
    }
    
    /**
     * Format number with K/M suffixes
     */
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Clean up module (stop rotation interval)
     */
    function destroy() {
        if (heroRotationInterval) {
            clearInterval(heroRotationInterval);
            heroRotationInterval = null;
        }
        
        if (elements.heroVideo) {
            elements.heroVideo.pause();
            elements.heroVideo.src = '';
        }
        
        console.log('🎬 Hero Content Module destroyed');
    }
    
    // Public API
    return {
        init,
        destroy,
        rotate: rotateHeroContent,
        reload: loadCinematicHero
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HeroContent.init());
} else {
    HeroContent.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroContent;
}
