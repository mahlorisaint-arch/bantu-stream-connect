/**
 * Hero Content Module
 * Handles cinematic hero section with video background, rotation logic,
 * creator recognition, social proof metrics, and audio control.
 * UPDATED: Uses content_engagement_stats for metrics
 */

const HeroContent = (function() {
    'use strict';
    
    let currentHeroContent = null;
    let heroRotationInterval = null;
    let currentVideo = null;
    
    const HERO_ROTATION_HOURS = 4;
    const HERO_ROTATION_MS = HERO_ROTATION_HOURS * 60 * 60 * 1000;
    
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
                window.location.href = 'https://bantustreamconnect.com/content-library';
            });
        }
        
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
        
        setupAudioControl();
    }
    
    async function loadCinematicHero() {
        console.log('🎬 Loading Cinematic Hero with rotation...');
        
        try {
            if (!window.supabaseAuth) {
                console.warn('Supabase not available, using placeholder');
                showHeroPlaceholder();
                return;
            }
            
            // Get content with engagement stats
            const { data: contentList, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, file_url, 
                    favorites_count, shares_count, language, created_at, 
                    user_id, user_profiles!user_id(id, full_name, username, avatar_url)
                `)
                .eq('status', 'published')
                .not('file_url', 'is', null)
                .limit(20);
            
            if (error || !contentList || contentList.length === 0) {
                console.warn('No video content available for hero');
                showHeroPlaceholder();
                return;
            }
            
            // Get engagement stats for these content items
            const contentIds = contentList.map(c => c.id);
            const { data: engagementStats } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_shares')
                .in('content_id', contentIds);
            
            const statsMap = {};
            engagementStats?.forEach(stat => {
                statsMap[stat.content_id] = stat;
            });
            
            // Merge stats into content
            const enrichedContent = contentList.map(content => ({
                ...content,
                total_views: statsMap[content.id]?.total_views || 0,
                total_likes: statsMap[content.id]?.total_likes || 0,
                total_shares: statsMap[content.id]?.total_shares || 0
            }));
            
            // Sort by total_views for featured content
            enrichedContent.sort((a, b) => (b.total_views || 0) - (a.total_views || 0));
            
            window.heroContentList = enrichedContent;
            
            const lastFeaturedId = localStorage.getItem('hero_last_content_id');
            const lastFeaturedTime = localStorage.getItem('hero_last_update_time');
            const now = Date.now();
            
            let selectedContent = null;
            
            if (lastFeaturedId && lastFeaturedTime && (now - parseInt(lastFeaturedTime)) < HERO_ROTATION_MS) {
                selectedContent = enrichedContent.find(c => c.id.toString() === lastFeaturedId);
            }
            
            if (!selectedContent) {
                const availableContent = enrichedContent.filter(c => c.id.toString() !== lastFeaturedId);
                const randomIndex = Math.floor(Math.random() * (availableContent.length || enrichedContent.length));
                selectedContent = (availableContent.length ? availableContent[randomIndex] : enrichedContent[randomIndex]);
                
                localStorage.setItem('hero_last_content_id', selectedContent.id.toString());
                localStorage.setItem('hero_last_update_time', now.toString());
                
                console.log('🎬 Rotated to new featured content:', selectedContent.title);
            }
            
            if (heroRotationInterval) clearInterval(heroRotationInterval);
            heroRotationInterval = setInterval(rotateHeroContent, HERO_ROTATION_MS);
            
            await renderHeroContent(selectedContent);
            
        } catch (error) {
            console.error('❌ Error loading cinematic hero:', error);
            showHeroPlaceholder();
        }
    }
    
    async function rotateHeroContent() {
        console.log('🔄 Rotating hero content...');
        
        if (!window.heroContentList || window.heroContentList.length === 0) {
            await loadCinematicHero();
            return;
        }
        
        const lastFeaturedId = localStorage.getItem('hero_last_content_id');
        
        let availableContent = window.heroContentList.filter(c => c.id.toString() !== lastFeaturedId);
        if (availableContent.length === 0) {
            availableContent = window.heroContentList;
        }
        
        const randomIndex = Math.floor(Math.random() * availableContent.length);
        const newContent = availableContent[randomIndex];
        
        localStorage.setItem('hero_last_content_id', newContent.id.toString());
        localStorage.setItem('hero_last_update_time', Date.now().toString());
        
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
    
    async function renderHeroContent(content) {
        if (!content) {
            console.error('No content to render in hero');
            return;
        }
        
        console.log('🎬 Rendering hero content:', content.title);
        
        await handleBackgroundVideo(content);
        await updateCreatorInfo(content);
        updateTextContent(content);
        await updateMetrics(content);
        updateVerifiedBadge(content);
        
        if (elements.heroWatchBtn) {
            elements.heroWatchBtn.dataset.contentId = content.id;
        }
        
        console.log('✅ Hero content rendered successfully');
    }
    
    async function handleBackgroundVideo(content) {
        if (!elements.heroVideo || !elements.videoSource) return;
        
        if (content.file_url) {
            const videoUrl = window.fixMediaUrl ? window.fixMediaUrl(content.file_url) : content.file_url;
            console.log('🎬 Loading video:', videoUrl);
            
            elements.heroVideo.pause();
            elements.videoSource.src = videoUrl;
            elements.heroVideo.load();
            
            const playPromise = elements.heroVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ Hero video playing');
                    if (elements.heroAudioControl) {
                        elements.heroAudioControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    }
                }).catch(error => {
                    console.log('Video autoplay prevented:', error);
                    showVideoPlayButton();
                });
            }
            
            elements.heroVideo.onerror = () => {
                console.error('Video failed to load:', videoUrl);
                if (content.thumbnail_url) {
                    const thumbnailUrl = window.fixMediaUrl ? window.fixMediaUrl(content.thumbnail_url) : content.thumbnail_url;
                    elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
                    elements.heroVideo.style.backgroundSize = 'cover';
                }
            };
            
            elements.heroVideo.oncanplay = () => {
                if (elements.heroVideo) elements.heroVideo.style.opacity = '1';
            };
        } else if (content.thumbnail_url) {
            const thumbnailUrl = window.fixMediaUrl ? window.fixMediaUrl(content.thumbnail_url) : content.thumbnail_url;
            elements.heroVideo.style.backgroundImage = `url(${thumbnailUrl})`;
            elements.heroVideo.style.backgroundSize = 'cover';
        }
    }
    
    function showVideoPlayButton() {
        if (!elements.heroSection) return;
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
        
        setTimeout(() => {
            if (playBtn.parentNode) playBtn.remove();
        }, 5000);
    }
    
    async function updateCreatorInfo(content) {
        const creator = content.user_profiles;
        
        if (creator && elements.heroCreatorName) {
            const displayName = creator.full_name || creator.username || 'Featured Creator';
            elements.heroCreatorName.textContent = displayName;
            
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
                        elements.heroCreatorAvatar.innerHTML = '';
                        const initials = (window.getInitials ? window.getInitials(displayName) : displayName.charAt(0).toUpperCase());
                        const initialsSpan = document.createElement('span');
                        initialsSpan.className = 'hero-creator-initials';
                        initialsSpan.textContent = initials;
                        elements.heroCreatorAvatar.appendChild(initialsSpan);
                    };
                    elements.heroCreatorAvatar.appendChild(img);
                } else {
                    const initials = (window.getInitials ? window.getInitials(displayName) : displayName.charAt(0).toUpperCase());
                    const initialsSpan = document.createElement('span');
                    initialsSpan.className = 'hero-creator-initials';
                    initialsSpan.textContent = initials;
                    elements.heroCreatorAvatar.appendChild(initialsSpan);
                }
            }
            
            if (elements.heroTrendingText) {
                elements.heroTrendingText.textContent = 'Trending ↑ 24h';
            }
        }
    }
    
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
        
        // Get fresh metrics from engagement stats
        if (window.supabaseAuth) {
            const { data: metricsData } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('total_views, total_shares')
                .eq('content_id', content.id)
                .single();
            
            if (metricsData) {
                totalViews = metricsData.total_views || totalViews;
                totalShares = metricsData.total_shares || totalShares;
            }
            
            if (creator) {
                const { count } = await window.supabaseAuth
                    .from('connectors')
                    .select('*', { count: 'exact', head: true })
                    .eq('connected_id', creator.id)
                    .eq('connection_type', 'creator');
                connectorCount = count || 0;
            }
        }
        
        if (elements.heroViews) elements.heroViews.textContent = formatNumber(totalViews);
        if (elements.heroFavorites) elements.heroFavorites.textContent = formatNumber(content.favorites_count || 0);
        if (elements.heroConnectors) elements.heroConnectors.textContent = formatNumber(connectorCount);
        if (elements.heroShares) elements.heroShares.textContent = formatNumber(totalShares);
    }
    
    function updateVerifiedBadge(content) {
        const creator = content.user_profiles;
        
        if (elements.heroVerifiedBadge && creator) {
            const isVerified = (content.total_views || 0) > 10000;
            elements.heroVerifiedBadge.style.display = isVerified ? 'inline-flex' : 'none';
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
                    elements.heroVideo.play().catch(console.log);
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
            elements.heroSubtitle.textContent = 'No content yet. Be the first to upload and share your story!';
        }
        
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
    
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
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
        console.log('🎬 Hero Content Module destroyed');
    }
    
    return { init, destroy, rotate: rotateHeroContent, reload: loadCinematicHero };
})();

// Auto-initialization disabled - handled by master init
