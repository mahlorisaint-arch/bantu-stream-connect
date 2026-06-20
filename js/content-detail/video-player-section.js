// js/content-detail/video-player-section.js
// ============================================
// VIDEO PLAYER SECTION MODULE - COMPLETE BRAIN
// Contains EnhancedVideoPlayer class, player controls, media loading,
// playback gestures, and video player UI management
// ============================================
console.log('🎬 Video Player Section Module Loading...');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get playable media URL from content object
 * Supports Cloudflare Stream (HLS), Cloudflare R2, and legacy file_url
 * @param {Object} content - Content object
 * @returns {string|null} - Playable URL or null
 */
function getPlayableMediaUrl(content) {
    if (!content) return '';
    
    // 🎵 Audio Lane (Cloudflare R2)
    if (content.streaming_provider === 'cloudflare_r2') {
        return content.file_url;
    }
    
    // 🎬 Video Lane (Cloudflare Stream Manifest)
    if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
        return `https://videodelivery.net/${content.provider_video_id}/manifest/video.m3u8`;
    }
    
    // 🔄 Legacy fallback
    return content.file_url || '';
}

/**
 * Detect media type (audio vs video) from content
 * @param {Object} content - Content object
 * @returns {string} - 'audio' or 'video'
 */
function detectMediaType(content) {
    if (!content) return 'video';
    
    if (content.streaming_provider === 'cloudflare_r2' || content.media_type === 'audio') {
        return 'audio';
    }
    if (content.streaming_provider === 'cloudflare_stream' || content.media_type === 'video') {
        return 'video';
    }
    
    // Fallback check for file extensions if provider isn't set
    const url = content.file_url || '';
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    if (audioExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
        return 'audio';
    }
    
    return 'video';
}

/**
 * Initialize video player skeleton (preload=none for performance)
 */
function initializeVideoPlayerSkeleton() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (videoElement) {
        videoElement.preload = 'none';
        videoElement.controls = false;
        console.log('🎥 Video skeleton ready (preload=none)');
    }
}

/**
 * Close video player and reset UI
 */
function closeVideoPlayer() {
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    const heroPoster = document.getElementById('heroPoster');
    const closeFromHero = document.getElementById('closePlayerFromHero');
    
    if (player) player.style.display = 'none';
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
    
    // Stop watch session
    if (window.watchSession) {
        window.watchSession.stop();
        window.watchSession = null;
    }
    
    // Clean up player instance
    const playerInstance = window.enhancedVideoPlayer;
    if (playerInstance) {
        if (playerInstance.video) {
            playerInstance.video.pause();
            playerInstance.video.currentTime = 0;
        }
    }
    
    // Clean up streaming manager
    if (window.streamingManager) {
        window.streamingManager.destroy();
        window.streamingManager = null;
    }
    
    // Show placeholder and reset poster
    if (placeholder) placeholder.style.display = 'flex';
    if (heroPoster) heroPoster.style.opacity = '1';
    if (closeFromHero) closeFromHero.style.display = 'none';
    
    // Scroll back to hero
    const hero = document.querySelector('.content-hero');
    if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Show initial play overlay (for autoplay blocked state)
 */
function showInitialPlayOverlay() {
    const overlay = document.getElementById('initialPlayOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

/**
 * Hide initial play overlay
 */
function hideInitialPlayOverlay() {
    const overlay = document.getElementById('initialPlayOverlay');
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Setup initial play button click handler
 */
function setupInitialPlayButton() {
    const playButton = document.getElementById('initialPlayButton');
    if (!playButton) return;
    
    const newPlayButton = playButton.cloneNode(true);
    playButton.parentNode.replaceChild(newPlayButton, playButton);
    newPlayButton.addEventListener('click', startPlaybackFromUserGesture);
    console.log('✅ Initial play overlay button bound to direct user gesture');
}

// ============================================
// DIRECT USER GESTURE PLAYBACK
// ============================================

/**
 * Start playback from user gesture (bypasses autoplay restrictions)
 * Shows player container, ensures visibility, then plays
 */
const startPlaybackFromUserGesture = async () => {
    try {
        // Ensure player container is visible FIRST
        const player = document.getElementById('inlinePlayer');
        const placeholder = document.getElementById('videoPlaceholder');
        const heroPoster = document.getElementById('heroPoster');
        
        if (player) {
            player.style.display = 'block';
            player.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (placeholder) placeholder.style.display = 'none';
        if (heroPoster) heroPoster.style.opacity = '0.3';
        
        // Get player instance
        const playerInstance = window.enhancedVideoPlayer;
        if (!playerInstance || !playerInstance.video) {
            console.error('❌ Player instance or native video element not found.');
            // Try to initialize player if not ready
            if (typeof initializeEnhancedVideoPlayer === 'function') {
                initializeEnhancedVideoPlayer();
                setTimeout(startPlaybackFromUserGesture, 500);
            }
            return;
        }
        
        const video = playerInstance.video;
        
        // Fallback: load media if source is missing and we're not in playlist mode
        if (!video.src && !window.isPlaylistMode && window.currentContent) {
            const fileUrl = getPlayableMediaUrl(window.currentContent);
            if (fileUrl) {
                console.log('🎬 Single Mode Fallback: Loading media source directly.', fileUrl);
                video.src = fileUrl;
                video.load();
            } else {
                console.warn('⚠️ No playable URL found for content:', window.currentContent.id);
                if (typeof window.showToast === 'function') {
                    window.showToast('No playable media found for this content', 'error');
                }
                return;
            }
        }
        
        // Unlock autoplay
        video.muted = false;
        video.volume = 1.0;
        window.userHasInteractedWithMedia = true;
        document.body.classList.add('user-interacted');
        
        // Play with fallback
        await video.play().catch(async (err) => {
            console.warn('⚠️ Unmuted play failed, trying muted fallback:', err.message);
            video.muted = true;
            await video.play().catch(fallbackErr => {
                console.error('❌ Fallback play failed:', fallbackErr);
                if (typeof window.showToast === 'function') {
                    window.showToast('Playback blocked. Please interact with the page and try again.', 'warning');
                }
            });
        });
        
        console.log('🔊 Core playback successfully initiated via direct user gesture.');
        
        // Hide overlay
        hideInitialPlayOverlay();
        
        // Initialize watch session if not already done
        if (window.currentContent?.id && !window.watchSession && typeof window.initializeWatchSessionOnPlay === 'function') {
            window.initializeWatchSessionOnPlay();
        }
        
    } catch (error) {
        console.warn('⚠️ Direct playback failed:', error.message);
        if (typeof window.showToast === 'function') {
            window.showToast('Unable to start playback. Please try again.', 'error');
        }
    }
};

// ============================================
// 🖼️ ISOLATED SINGLE-MEDIA THUMBNAIL FIX
// Runs independently of the core player loop
// Guarantees zero interference with Cloudflare streams or playlist mode
// ============================================

/**
 * Isolated thumbnail initializer specifically for Single Media Mode.
 * Runs independently of the core player loop to guarantee zero interference with Cloudflare streams.
 * @param {Object} content - Content object with thumbnail_url
 */
function applySingleMediaThumbnail(content) {
    if (!content) {
        console.warn('⚠️ applySingleMediaThumbnail called with no content');
        return;
    }
    
    console.log('🎬 Initializing single media thumbnail layout safely...');
    
    try {
        // 1. Safely handle Hero Poster Backdrop
        const heroPoster = document.getElementById('heroPoster');
        const posterPlaceholder = document.getElementById('posterPlaceholder');
        
        if (heroPoster && content.thumbnail_url) {
            const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
            
            // Check if there's already an image inside heroPoster
            let existingImg = heroPoster.querySelector('img');
            if (existingImg) {
                existingImg.src = imgUrl;
                existingImg.alt = content.title || 'Content thumbnail';
                console.log('🖼️ Single Mode: Updated existing hero poster image');
            } else {
                // Create new image
                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = content.title || 'Content thumbnail';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = function() {
                    console.warn('🖼️ Single Mode: Hero poster image failed to load, showing placeholder');
                    this.style.display = 'none';
                    if (posterPlaceholder) posterPlaceholder.style.display = 'flex';
                };
                // Hide placeholder
                if (posterPlaceholder) posterPlaceholder.style.display = 'none';
                heroPoster.appendChild(img);
                console.log('🖼️ Single Mode: Created new hero poster image');
            }
            
            // Also set background for fallback
            heroPoster.style.backgroundImage = `url('${imgUrl}')`;
            heroPoster.style.backgroundSize = 'cover';
            heroPoster.style.backgroundPosition = 'center';
            console.log('🖼️ Single Mode: Hero backdrop updated.');
        } else if (heroPoster && posterPlaceholder) {
            // Show placeholder if no thumbnail
            posterPlaceholder.style.display = 'flex';
            // Remove any existing img
            const existingImg = heroPoster.querySelector('img');
            if (existingImg) existingImg.remove();
            console.log('🖼️ Single Mode: No thumbnail, showing placeholder');
        }

        // 2. Safely handle Native Player Poster
        const videoElement = document.getElementById('inlineVideoPlayer');
        if (videoElement && content.thumbnail_url) {
            const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
            
            // Set native attribute safely
            videoElement.setAttribute('poster', imgUrl);
            console.log('🖼️ Single Mode: Video element poster attribute attached.');
            
            // Also check for custom poster overlay
            let posterOverlay = document.querySelector('.player-poster-overlay');
            if (!posterOverlay) {
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer) {
                    posterOverlay = document.createElement('div');
                    posterOverlay.className = 'player-poster-overlay';
                    videoContainer.appendChild(posterOverlay);
                    console.log('🖼️ Single Mode: Created custom poster overlay element');
                }
            }
            
            if (posterOverlay) {
                posterOverlay.style.backgroundImage = `url('${imgUrl}')`;
                posterOverlay.style.backgroundSize = detectMediaType(content) === 'audio' ? 'contain' : 'cover';
                posterOverlay.style.backgroundPosition = 'center';
                posterOverlay.style.backgroundRepeat = 'no-repeat';
                posterOverlay.style.display = 'block';
                posterOverlay.style.opacity = '1';
                posterOverlay.classList.add('active');
                console.log('🖼️ Single Mode: Custom poster overlay updated');
            }
        } else if (videoElement) {
            videoElement.removeAttribute('poster');
            console.log('🖼️ Single Mode: No thumbnail, removed poster attribute');
        }
        
        // 3. Force browser layout redraw for the poster attribute
        if (videoElement) {
            const currentSrc = videoElement.getAttribute('src');
            if (!currentSrc || currentSrc === '') {
                videoElement.load();
                console.log('🖼️ Single Mode: Triggered video load for poster to render');
            }
        }
        
    } catch (error) {
        // Fallback guard ensures a failure here never halts the rest of the application
        console.error('⚠️ Non-blocking error inside applySingleMediaThumbnail:', error);
    }
}

// ============================================
// LOAD CONTENT INTO PLAYER - UNCHANGED!
// Playlist mode works perfectly, DO NOT MODIFY
// ============================================

/**
 * Load content into video player (non-destructive)
 * Reuses existing player instance when possible
 * @param {Object} content - Content object to play
 * @param {number} index - Optional playlist index
 */
async function loadContentIntoPlayer(content, index = null) {
    if (!content) {
        console.warn('⚠️ loadContentIntoPlayer called with no content');
        return;
    }
    
    const player = document.getElementById('inlinePlayer');
    const videoElement = document.getElementById('inlineVideoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    const videoContainer = document.querySelector('.video-container');
    
    if (!player || !videoElement) {
        console.warn('⚠️ Player elements not ready, retrying...');
        // Retry after a short delay
        setTimeout(() => loadContentIntoPlayer(content, index), 300);
        return;
    }
    
    if (index !== null) window.currentPlaylistIndex = index;
    
    // Ensure contentId is synced before loading
    if (typeof window.updateGlobalContentId === 'function') {
        window.updateGlobalContentId(content.id);
    }
    
    player.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    
    // ============================================
    // 🖼️ CUSTOM POSTER OVERLAY - BULLETPROOF THUMBNAIL
    // ============================================
    
    // Create or get the poster overlay
    let posterOverlay = document.querySelector('.player-poster-overlay');
    if (!posterOverlay && videoContainer) {
        posterOverlay = document.createElement('div');
        posterOverlay.className = 'player-poster-overlay';
        videoContainer.appendChild(posterOverlay);
        console.log('🖼️ Created custom poster overlay element');
    }
    
    // Detect media type
    const isAudio = detectMediaType(content) === 'audio';
    console.log('🎵 Is audio mode:', isAudio);
    
    // Set audio mode class on container
    if (videoContainer) {
        if (isAudio) {
            videoContainer.classList.add('audio-active');
        } else {
            videoContainer.classList.remove('audio-active');
        }
    }
    
    // ============================================
    // 🖼️ THUMBNAIL ENGINE - Both native poster AND custom overlay
    // ============================================
    
    if (content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        
        // 1. Set native poster attribute (for browsers that support it)
        videoElement.setAttribute('poster', imgUrl);
        
        // 2. Set custom overlay background (BULLETPROOF - works everywhere)
        if (posterOverlay) {
            posterOverlay.style.backgroundImage = `url('${imgUrl}')`;
            posterOverlay.style.backgroundSize = isAudio ? 'contain' : 'cover';
            posterOverlay.style.backgroundPosition = 'center';
            posterOverlay.style.backgroundRepeat = 'no-repeat';
            posterOverlay.style.display = 'block';
            posterOverlay.style.opacity = '1';
            posterOverlay.classList.add('active');
            
            // For audio, keep overlay visible permanently
            if (isAudio) {
                posterOverlay.classList.add('keep-visible');
                console.log('🎵 Audio mode - keeping poster overlay visible');
            } else {
                posterOverlay.classList.remove('keep-visible');
            }
        }
        
        console.log('🖼️ Thumbnail Engine Activated:', imgUrl, '| Audio mode:', isAudio);
    } else {
        // No thumbnail - hide overlay
        videoElement.removeAttribute('poster');
        if (posterOverlay) {
            posterOverlay.style.display = 'none';
            posterOverlay.classList.remove('active');
        }
        console.log('🖼️ No thumbnail available for content:', content.id);
    }
    
    // ============================================
    // VIDEO/AUDIO MODE STYLING
    // ============================================
    
    if (isAudio && content.thumbnail_url) {
        videoElement.classList.add('audio-mode');
        videoElement.style.objectFit = 'contain';
        videoElement.style.background = 'var(--bg-secondary, #0a0a0a)';
    } else {
        videoElement.classList.remove('audio-mode');
        videoElement.style.objectFit = '';
        videoElement.style.background = '';
    }
    
    // ============================================
    // GET MEDIA URL
    // ============================================
    
    let fileUrl = getPlayableMediaUrl(content);
    const isCloudflareStream = content.streaming_provider === 'cloudflare_stream';
    const isCloudflareR2 = content.streaming_provider === 'cloudflare_r2';
    
    console.log('📥 Loading media:', { 
        provider: content.streaming_provider, 
        url: fileUrl,
        isCloudflareStream,
        isCloudflareR2,
        media_type: content.media_type,
        isAudio: isAudio
    });
    
    // 🔥 CRITICAL FIX: If no URL found, try to use file_url directly as fallback
    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined') {
        console.warn('⚠️ No playable URL from getPlayableMediaUrl, trying fallbacks...');
        if (content.file_url) {
            fileUrl = content.file_url;
            console.log('✅ Using file_url fallback:', fileUrl);
        } else if (content.audio_url) {
            fileUrl = content.audio_url;
            console.log('✅ Using audio_url fallback:', fileUrl);
        } else if (content.video_url) {
            fileUrl = content.video_url;
            console.log('✅ Using video_url fallback:', fileUrl);
        } else {
            console.error('❌ No playable URL found for content:', content.id);
            if (typeof window.showToast === 'function') {
                window.showToast('No playable media found for this content', 'error');
            }
            return;
        }
    }
    
    // ============================================
    // GET MIME TYPE
    // ============================================
    
    function getMediaMimeType(url = '') {
        const lower = url.toLowerCase();
        // HLS manifest
        if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
        if (lower.includes('videodelivery.net')) return 'application/vnd.apple.mpegurl';
        // Video
        if (lower.endsWith('.mp4')) return 'video/mp4';
        if (lower.endsWith('.webm')) return 'video/webm';
        if (lower.endsWith('.mov')) return 'video/quicktime';
        // Audio
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.m4a')) return 'audio/mp4';
        if (lower.endsWith('.flac')) return 'audio/flac';
        return 'video/mp4';
    }
    
    const mimeType = getMediaMimeType(fileUrl);
    const isHLS = mimeType === 'application/vnd.apple.mpegurl' || fileUrl?.includes('videodelivery.net');
    
    console.log('📄 MIME type detected:', mimeType, 'isHLS:', isHLS);
    
    // ============================================
    // AUTO-HIDE POSTER OVERLAY (for video only)
    // ============================================
    
    // Auto-hide poster overlay when video starts playing (only for video)
    const handleVideoPlaying = function() {
        if (!isAudio && posterOverlay && !posterOverlay.classList.contains('keep-visible')) {
            posterOverlay.style.opacity = '0';
            setTimeout(() => {
                if (posterOverlay && !posterOverlay.classList.contains('keep-visible')) {
                    posterOverlay.style.display = 'none';
                }
            }, 400);
        }
        // Remove listener after first play
        videoElement.removeEventListener('playing', handleVideoPlaying);
    };
    
    videoElement.addEventListener('playing', handleVideoPlaying);
    
    // Show loading state on container
    if (videoContainer) {
        videoContainer.classList.add('loading');
    }
    
    // ============================================
    // LOAD SOURCE
    // ============================================
    
    if (window.enhancedVideoPlayer && typeof window.enhancedVideoPlayer.loadSource === 'function') {
        console.log('♻️ Reusing existing player instance with loadSource');
        try {
            await window.enhancedVideoPlayer.loadSource({
                url: fileUrl,
                type: mimeType,
                title: content.title,
                isHLS: isHLS,
                streamingProvider: content.streaming_provider,
                isAudio: isAudio
            });
        } catch (loadError) {
            console.error('❌ loadSource failed, falling back to direct source:', loadError);
            // Fallback to direct source setting
            if (window.watchSession) {
                window.watchSession.stop();
                window.watchSession = null;
            }
            while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
            videoElement.removeAttribute('src');
            const source = document.createElement('source');
            source.src = fileUrl;
            source.type = mimeType;
            videoElement.appendChild(source);
            videoElement.load();
        }
    } else {
        console.log('⚠️ loadSource not available, updating video source directly');
        
        if (window.watchSession) {
            window.watchSession.stop();
            window.watchSession = null;
        }
        
        // Clear and set new source
        while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
        videoElement.removeAttribute('src');
        const source = document.createElement('source');
        source.src = fileUrl;
        source.type = mimeType;
        videoElement.appendChild(source);
        videoElement.load();
    }
    
    // Remove loading state when metadata loaded
    const handleMetadataLoaded = function() {
        if (videoContainer) {
            videoContainer.classList.remove('loading');
        }
        videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
    };
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    
    // ============================================
    // STREAMING MANAGER
    // ============================================
    
    if (!isAudio) {
        setTimeout(() => {
            if (window.streamingManager) {
                window.streamingManager.destroy();
                window.streamingManager = null;
            }
            if (typeof window.initializeStreamingManager === 'function') {
                window.initializeStreamingManager();
            }
        }, 100);
    } else {
        console.log('🎵 Audio mode - skipping streaming manager initialization');
        // Ensure any existing streaming manager is destroyed
        if (window.streamingManager) {
            window.streamingManager.destroy();
            window.streamingManager = null;
        }
    }
    
    // Initialize watch session
    setTimeout(() => {
        if (typeof window.initializeWatchSessionOnPlay === 'function') {
            window.initializeWatchSessionOnPlay();
        }
    }, 100);
    
    // Attempt autoplay if user has interacted
    setTimeout(async () => {
        try {
            const canAutoplay = document.body.classList.contains('user-interacted');
            if (!canAutoplay) {
                console.log('⛔ Autoplay blocked until user interaction');
                showInitialPlayOverlay();
                return;
            }
            const playerInstance = window.enhancedVideoPlayer;
            if (playerInstance && typeof playerInstance.play === 'function') {
                await playerInstance.play();
            } else {
                await videoElement.play();
            }
            console.log('▶️ Playback started successfully');
            hideInitialPlayOverlay();
        } catch (error) {
            console.warn('⚠️ Playback blocked:', error);
            showInitialPlayOverlay();
        }
    }, 300);
    
    // Scroll to player
    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ============================================
// ENHANCED VIDEO PLAYER CLASS
// ============================================

class EnhancedVideoPlayer {
    constructor(options = {}) {
        this.video = null;
        this.container = null;
        this.options = {
            autoplay: options.autoplay || false,
            defaultSpeed: options.defaultSpeed || 1.0,
            defaultQuality: options.defaultQuality || 'auto',
            defaultVolume: options.defaultVolume !== undefined ? options.defaultVolume : 1.0,
            muted: options.muted || false,
            contentId: options.contentId || null,
            supabaseClient: options.supabaseClient || null,
            userId: options.userId || null
        };
        
        this.currentSpeed = this.options.defaultSpeed;
        this.currentQuality = this.options.defaultQuality;
        this.volume = this.options.defaultVolume;
        this.isMuted = this.options.muted;
        this.fullscreen = false;
        this.eventListeners = {};
        this._currentStreamingProvider = null;
        this._isHLSStream = false;
        this._isAudioMode = false;
        this.viewRecorded = false;
        this._viewThresholdReached = false;
        this.contentId = this.options.contentId;
        this._sourcePreserved = null;
    }
    
    attach(videoElement, containerElement) {
        this.video = videoElement;
        this.container = containerElement;
        
        if (!this.video || !this.container) {
            console.error('Failed to attach video player: missing elements');
            return;
        }
        
        this.setupVideoEvents();
        this.applyInitialSettings();
        console.log('✅ EnhancedVideoPlayer attached');
    }
    
    setupVideoEvents() {
        // Volume change
        this.video.addEventListener('volumechange', () => {
            this.volume = this.video.volume;
            this.isMuted = this.video.muted;
            this.emit('volumechange', { volume: this.volume, muted: this.isMuted });
        });
        
        // Play
        this.video.addEventListener('play', () => {
            this.emit('play', { currentTime: this.video.currentTime });
        });
        
        // Pause
        this.video.addEventListener('pause', () => {
            this.emit('pause', { currentTime: this.video.currentTime });
        });
        
        // Time update
        this.video.addEventListener('timeupdate', () => {
            this.emit('timeupdate', { currentTime: this.video.currentTime, duration: this.video.duration });
        });
        
        // Ended
        this.video.addEventListener('ended', () => {
            this.emit('mediaEnded', {
                contentId: this.contentId,
                playlistIndex: window.currentPlaylistIndex,
                currentTime: this.video ? this.video.currentTime : 0,
                duration: this.video ? this.video.duration : 0,
                streamingProvider: this._currentStreamingProvider || null,
                isAudio: this._isAudioMode
            });
        });
        
        // Error
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            this.emit('error', { error: e, message: this.video.error?.message });
        });
        
        // Loaded metadata
        this.video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded');
            this.emit('loadedmetadata', { duration: this.video.duration, width: this.video.videoWidth, height: this.video.videoHeight });
        });
        
        // Can play
        this.video.addEventListener('canplay', () => {
            console.log('Video can play');
            this.emit('canplay', {});
        });
        
        // Fullscreen change
        document.addEventListener('fullscreenchange', () => {
            this.fullscreen = !!document.fullscreenElement;
            this.emit('fullscreenchange', { fullscreen: this.fullscreen });
        });
    }
    
    applyInitialSettings() {
        this.video.volume = this.volume;
        this.video.muted = this.isMuted;
        this.setPlaybackSpeed(this.currentSpeed);
        
        if (this.options.autoplay) {
            this.video.play().catch(e => console.log('Autoplay prevented:', e));
        }
    }
    
    play() {
        if (this.video) return this.video.play();
        return Promise.reject(new Error('Video element not attached'));
    }
    
    pause() {
        if (this.video) this.video.pause();
    }
    
    setPlaybackSpeed(speed) {
        if (this.video) {
            this.video.playbackRate = speed;
            this.currentSpeed = speed;
            this.emit('speedchange', { speed: speed });
        }
    }
    
    setVolume(volume) {
        if (this.video && volume >= 0 && volume <= 1) {
            this.video.volume = volume;
            this.volume = volume;
        }
    }
    
    setMuted(muted) {
        if (this.video) {
            this.video.muted = muted;
            this.isMuted = muted;
        }
    }
    
    toggleMute() {
        this.setMuted(!this.isMuted);
    }
    
    toggleFullscreen() {
        if (!this.container) return;
        
        if (!this.fullscreen) {
            this.container.requestFullscreen?.().catch(e => console.log('Fullscreen error:', e));
        } else {
            document.exitFullscreen?.();
        }
    }
    
    seekTo(time) {
        if (this.video && time >= 0 && time <= this.video.duration) {
            this.video.currentTime = time;
        }
    }
    
    /**
     * Check if current source is audio
     */
    isAudioSource() {
        return this._isAudioMode;
    }
    
    /**
     * 🚨 CRITICAL: Load source without destroying player instance
     * Used for playlist track changes to preserve player state
     * This is the preferred method for non-destructive source changes
     */
    async loadSource(sourceConfig) {
        if (!this.video) return Promise.reject('Player not attached');
        if (!sourceConfig || !sourceConfig.url) return Promise.reject('Invalid source config');
        
        const url = sourceConfig.url;
        const type = sourceConfig.type || this.getMediaMimeType(url);
        const contentId = sourceConfig.contentId || this.contentId;
        const streamingProvider = sourceConfig.streamingProvider || null;
        const isHLS = sourceConfig.isHLS || false;
        const isAudio = sourceConfig.isAudio || false;
        
        console.log('🔄 Loading new source without destroying player:', { 
            url, 
            contentId, 
            streamingProvider,
            isHLS,
            isAudio
        });
        
        // Update contentId
        if (contentId && contentId !== this.contentId) {
            this.updateContentId(contentId);
        }
        
        // 🚨 Store streaming provider for context
        if (streamingProvider) {
            this._currentStreamingProvider = streamingProvider;
            this._isHLSStream = isHLS;
        }
        this._isAudioMode = isAudio;
        
        // Reset view recording flags for new source
        this.viewRecorded = false;
        this._viewThresholdReached = false;
        
        // Pause current playback
        this.video.pause();
        
        // Update source
        while (this.video.firstChild) {
            this.video.removeChild(this.video.firstChild);
        }
        this.video.removeAttribute('src');
        
        // 🚨 For HLS manifests (Cloudflare Stream), set appropriate type
        const source = document.createElement('source');
        source.src = url;
        source.type = type;
        this.video.appendChild(source);
        
        // 🚨 If this is an HLS stream, notify streaming manager
        // BUT skip for audio
        if (!isAudio && (isHLS || url.includes('videodelivery.net') || url.endsWith('.m3u8'))) {
            console.log('📺 HLS stream detected - ensuring streaming manager handles it');
            if (window.streamingManager) {
                // Give streaming manager a moment to reinitialize
                setTimeout(() => {
                    if (window.streamingManager && typeof window.streamingManager.reinitialize === 'function') {
                        window.streamingManager.reinitialize(contentId).catch(err => {
                            console.warn('Streaming manager reinit after loadSource:', err);
                        });
                    }
                }, 50);
            }
        } else if (isAudio) {
            console.log('🎵 Audio mode - bypassing HLS initialization');
            // Ensure streaming manager is destroyed for audio
            if (window.streamingManager) {
                window.streamingManager.destroy();
                window.streamingManager = null;
            }
        }
        
        // Load and attempt to play if user has interacted
        this.video.load();
        
        if (document.body.classList.contains('user-interacted')) {
            this.play().catch(err => {
                console.warn('Auto-play after source change blocked:', err);
                this._showPlayOverlay();
            });
        }
        
        // Update preserved source with provider info
        this._sourcePreserved = { 
            url, 
            type, 
            method: 'loadSource',
            streamingProvider: streamingProvider,
            isHLS: isHLS,
            isAudio: isAudio
        };
        
        this.emit('source:loaded', { url, contentId, type, streamingProvider, isHLS, isAudio });
        
        return Promise.resolve();
    }
    
    /**
     * Update contentId and sync with streaming manager
     */
    updateContentId(newContentId) {
        if (this.contentId === newContentId) {
            console.log('⚠️ Player contentId unchanged:', newContentId);
            return;
        }
        
        console.log(`🔄 Player contentId updated: ${this.contentId} -> ${newContentId}`);
        this.contentId = newContentId;
        
        // Reset view recording state for new content
        this.viewRecorded = false;
        this._viewThresholdReached = false;
        
        // 🚨 Update session with new content ID
        if (this.watchSession && typeof this.watchSession.updateContentId === 'function') {
            this.watchSession.updateContentId(newContentId);
        }
        
        // 🚨 If streaming provider changed, notify streaming manager
        if (window.streamingManager && typeof window.streamingManager.updateContentId === 'function') {
            window.streamingManager.updateContentId(newContentId);
        }
        
        this.emit('content:changed', { 
            contentId: newContentId,
            streamingProvider: this._currentStreamingProvider 
        });
    }
    
    /**
     * Get media MIME type from URL
     */
    getMediaMimeType(url = '') {
        const lower = url.toLowerCase();
        // HLS manifest
        if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
        if (lower.includes('videodelivery.net')) return 'application/vnd.apple.mpegurl';
        // Video
        if (lower.endsWith('.mp4')) return 'video/mp4';
        if (lower.endsWith('.webm')) return 'video/webm';
        if (lower.endsWith('.mov')) return 'video/quicktime';
        // Audio
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.m4a')) return 'audio/mp4';
        return 'video/mp4';
    }
    
    /**
     * Show play overlay (for autoplay blocked state)
     */
    _showPlayOverlay() {
        const overlay = document.getElementById('initialPlayOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }
    
    on(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }
    
    off(event, callback) {
        if (!this.eventListeners[event]) return;
        if (callback) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        } else {
            delete this.eventListeners[event];
        }
    }
    
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
    
    destroy() {
        if (this.video) {
            this.pause();
            this.video.src = '';
            this.video.load();
        }
        this.eventListeners = {};
        console.log('EnhancedVideoPlayer destroyed');
    }
}

/**
 * Initialize enhanced video player with error handling
 */
function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');
    
    if (!videoElement || !videoContainer) {
        console.warn('⚠️ Video elements not found');
        return;
    }
    
    try {
        const preferences = window.state ? window.state.getPreferences() : {
            autoplay: false,
            playbackSpeed: 1.0,
            quality: 'auto'
        };
        
        console.log('🎬 Creating EnhancedVideoPlayer...');
        
        const player = new EnhancedVideoPlayer({
            autoplay: preferences.autoplay,
            defaultSpeed: preferences.playbackSpeed,
            defaultQuality: preferences.quality,
            defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
            muted: window.stateManager ? window.stateManager.getState('session.muted') : false,
            contentId: window.currentContentId || window.currentContent?.id || null,
            supabaseClient: window.supabaseClient,
            userId: window.currentUserId
        });
        
        window.enhancedVideoPlayer = player;
        player.attach(videoElement, videoContainer);
        
        // Ensure loadSource method exists
        if (!player.loadSource) {
            player.loadSource = async function(sourceConfig) {
                if (!player.video) return;
                const url = sourceConfig.url;
                const type = sourceConfig.type || player.getMediaMimeType(url);
                const isAudio = sourceConfig.isAudio || false;
                player._isAudioMode = isAudio;
                player.pause();
                while (player.video.firstChild) player.video.removeChild(player.video.firstChild);
                player.video.removeAttribute('src');
                const source = document.createElement('source');
                source.src = url;
                source.type = type;
                player.video.appendChild(source);
                player.video.load();
                if (document.body.classList.contains('user-interacted')) {
                    try { await player.video.play(); } catch(e) {}
                }
            };
        }
        
        // Ensure updateContentId method exists
        if (!player.updateContentId) {
            player.updateContentId = function(newContentId) {
                if (this.contentId === newContentId) return;
                console.log(`🔄 Player contentId updated: ${this.contentId} -> ${newContentId}`);
                this.contentId = newContentId;
                this.viewRecorded = false;
                this._viewThresholdReached = false;
            };
        }
        
        // Set up event handlers
        player.on('play', () => {
            console.log('▶️ Video playing...');
            if (window.stateManager) window.stateManager.setState('session.playing', true);
            if (typeof window.initializeWatchSessionOnPlay === 'function') window.initializeWatchSessionOnPlay();
        });
        
        player.on('pause', () => {
            if (window.stateManager) window.stateManager.setState('session.playing', false);
        });
        
        player.on('volumechange', (data) => {
            if (window.stateManager) window.stateManager.setState('session.volume', data.volume);
        });
        
        player.on('error', (event) => {
            const media = player?.video;
            if (media && media.error === null && media.networkState !== 3) return;
            console.error('🔴 Video player error:', event);
            if (typeof window.showToast === 'function') {
                window.showToast('Playback error occurred', 'error');
            }
        });
        
        player.on('loadedmetadata', () => {
            console.log('✅ Video metadata loaded, ready to play');
            const placeholder = document.getElementById('videoPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });
        
        // 🚨 Listen for mediaEnded event (YouTube-style architecture)
        player.on('mediaEnded', (data) => {
            console.log('🏁 Media ended event received in content-detail player module:', data);
            // Forward to global handler
            if (typeof window.playNextPlaylistItem === 'function') {
                window.playNextPlaylistItem();
            }
        });
        
        console.log('✅ Enhanced video player initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Video player failed to load. Using basic player.', 'warning');
        }
        const videoElement = document.getElementById('inlineVideoPlayer');
        if (videoElement) videoElement.controls = true;
    }
}

// ============================================
// WATCH SESSION MANAGER (for view recording)
// ============================================

class WatchSessionManager {
    constructor(contentId, userId) {
        this.contentId = contentId;
        this.userId = userId || null;
        this.playbackSessionId = this._generateUUID();
        this.sequenceNumber = 0;
        this.totalWatchTimeMs = 0;
        this.maxProgressSeconds = 0;
        this.heartbeatInterval = null;
        this.lastHeartbeatTime = Date.now();
        this.isActive = false;
        this.viewRecorded = false;
        this.viewThresholdReached = false;
    }
    
    _generateUUID() {
        return crypto.randomUUID ? crypto.randomUUID() : 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async initializeSession(platform = 'Web', deviceType = 'Desktop') {
        try {
            const { error } = await window.supabaseClient
                .from('playback_sessions')
                .insert({
                    playback_session_id: this.playbackSessionId,
                    content_id: parseInt(this.contentId),
                    user_id: this.userId,
                    session_id: window.currentSessionId || this._generateUUID(),
                    platform: platform,
                    device_type: deviceType,
                    started_at: new Date().toISOString()
                });
            if (error) return false;
            this.isActive = true;
            console.log(`🎬 Watch session initialized: ${this.playbackSessionId}`);
            return true;
        } catch (error) { return false; }
    }
    
    startHeartbeatLoop(videoElement) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (!this.isActive || !videoElement || videoElement.paused) return;
            
            const currentTime = Math.floor(videoElement.currentTime);
            const now = Date.now();
            const deltaWatchTimeMs = now - this.lastHeartbeatTime;
            this.sequenceNumber++;
            this.totalWatchTimeMs += deltaWatchTimeMs;
            if (currentTime > this.maxProgressSeconds) this.maxProgressSeconds = currentTime;
            this.lastHeartbeatTime = now;
            
            await window.supabaseClient.from('playback_heartbeats').insert({
                playback_session_id: this.playbackSessionId,
                content_id: parseInt(this.contentId),
                user_id: this.userId,
                sequence_number: this.sequenceNumber,
                progress_seconds: currentTime,
                cumulative_watch_time_ms: this.totalWatchTimeMs,
                playback_state: 'PLAYING'
            }).catch(e => console.error('Heartbeat failed:', e));
            
            await window.supabaseClient.from('playback_sessions').update({
                total_watch_time_ms: this.totalWatchTimeMs,
                max_progress_seconds: this.maxProgressSeconds,
                heartbeat_count: this.sequenceNumber,
                last_heartbeat_at: new Date().toISOString()
            }).eq('playback_session_id', this.playbackSessionId);
            
            // Record view at threshold (15 seconds or 30% duration)
            const duration = videoElement.duration || 0;
            const thresholdSeconds = Math.min(15, duration * 0.3);
            
            if (!this.viewRecorded && this.totalWatchTimeMs >= thresholdSeconds * 1000) {
                this.viewRecorded = true;
                this.viewThresholdReached = true;
                
                if (typeof window.recordContentViewRPC === 'function') {
                    await window.recordContentViewRPC(this.contentId, this.userId, this.playbackSessionId);
                }
            }
        }, 10000);
    }
    
    start(videoElement) { if (videoElement) this.startHeartbeatLoop(videoElement); }
    
    stop() {
        this.isActive = false;
        if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
        window.supabaseClient.from('playback_sessions').update({ completed: true, exited_at: new Date().toISOString() }).eq('playback_session_id', this.playbackSessionId);
    }
}

function initializeWatchSessionOnPlay() {
    if (!window.currentContent || !window.currentUserId) return;
    const player = window.enhancedVideoPlayer;
    if (!player?.video) return;
    
    if (window.watchSession) { window.watchSession.stop(); window.watchSession = null; }
    
    try {
        window.currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        window.watchSession = new WatchSessionManager(window.currentContentId, window.currentUserId);
        window.watchSession.initializeSession('Web', 'Desktop');
        window.watchSession.start(player.video);
        console.log('✅ Watch session started');
    } catch (error) { console.error('Failed to initialize watch session:', error); }
}

// ============================================
// SINGLE MEDIA PAGE INITIALIZATION HOOK
// ============================================

/**
 * Initialize a single media page with isolated thumbnail handling
 * This is the safe entry point for single media mode
 */
async function initializeSingleMediaPage(contentItem) {
    if (!contentItem) {
        console.warn('⚠️ initializeSingleMediaPage called with no content');
        return;
    }
    
    console.log('🎬 Initializing Single Media Page...');
    
    // 1. Set playlist states to false to keep playlist arrays completely clear
    window.isPlaylistMode = false;
    window.playlistData = null;
    window.currentPlaylistIndex = null;
    window.currentPlaylistItems = [];
    
    // 2. Fire the isolated thumbnail application completely independently
    applySingleMediaThumbnail(contentItem);
    
    // 3. Launch your original, stable streaming player
    await loadContentIntoPlayer(contentItem, null);
    
    console.log('✅ Single Media Page initialized successfully');
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.EnhancedVideoPlayer = EnhancedVideoPlayer;
window.initializeEnhancedVideoPlayer = initializeEnhancedVideoPlayer;
window.loadContentIntoPlayer = loadContentIntoPlayer;
window.getPlayableMediaUrl = getPlayableMediaUrl;
window.detectMediaType = detectMediaType;
window.initializeVideoPlayerSkeleton = initializeVideoPlayerSkeleton;
window.closeVideoPlayer = closeVideoPlayer;
window.showInitialPlayOverlay = showInitialPlayOverlay;
window.hideInitialPlayOverlay = hideInitialPlayOverlay;
window.setupInitialPlayButton = setupInitialPlayButton;
window.startPlaybackFromUserGesture = startPlaybackFromUserGesture;
window.WatchSessionManager = WatchSessionManager;
window.initializeWatchSessionOnPlay = initializeWatchSessionOnPlay;
window.applySingleMediaThumbnail = applySingleMediaThumbnail;
window.initializeSingleMediaPage = initializeSingleMediaPage;

console.log('✅ Video Player Section Module loaded (with full brain + Cloudflare support + Audio fixes + Custom Poster Overlay + Single-Media Thumbnail Fix)');
console.log('   🖼️ Single-Media Thumbnail: Isolated applySingleMediaThumbnail() function');
console.log('   🖼️ Single-Media Thumbnail: initializeSingleMediaPage() entry point');
console.log('   🔧 loadContentIntoPlayer: UNCHANGED - Playlist mode safe');
