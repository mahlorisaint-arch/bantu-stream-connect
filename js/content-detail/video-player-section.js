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
    if (!content) return null;
    
    // ✅ Cloudflare Stream Video - Return HLS manifest URL
    if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
        const videoId = content.provider_video_id;
        return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
    }
    
    // ✅ Cloudflare R2 Audio - Use file_url (custom domain)
    if (content.streaming_provider === 'cloudflare_r2' && content.file_url) {
        return content.file_url;
    }
    
    // 🔄 Legacy fallback: file_url, audio_url, video_url, media_url
    return (
        content.file_url ||
        content.audio_url ||
        content.video_url ||
        content.media_url ||
        null
    );
}

/**
 * Detect media type (audio vs video) from content
 * @param {Object} content - Content object
 * @returns {string} - 'audio' or 'video'
 */
function detectMediaType(content) {
    if (!content) return 'video';
    
    // ✅ Cloudflare Stream is always video
    if (content.streaming_provider === 'cloudflare_stream') {
        return 'video';
    }
    
    // ✅ Cloudflare R2 is always audio
    if (content.streaming_provider === 'cloudflare_r2') {
        return 'audio';
    }
    
    // 📋 Check media_type field
    if (content.media_type) {
        if (content.media_type.toLowerCase() === 'audio') return 'audio';
        if (content.media_type.toLowerCase() === 'video') return 'video';
    }
    
    // 📋 Check content_format
    const format = (content.content_format || '').toLowerCase();
    if (format.includes('audio') || format.includes('podcast') || format.includes('music')) {
        return 'audio';
    }
    
    // 📋 Fallback: check file extension
    const url = getPlayableMediaUrl(content);
    if (url) {
        const ext = url.split('.').pop()?.toLowerCase();
        // Audio extensions
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'aac' || ext === 'm4a' || ext === 'flac') {
            return 'audio';
        }
        // Video extensions (including m3u8 for HLS)
        if (ext === 'mp4' || ext === 'webm' || ext === 'mov' || ext === 'mkv' || ext === 'm3u8' || ext === 'avi') {
            return 'video';
        }
    }
    
    // Default to video
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
// LOAD CONTENT INTO PLAYER
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
    
    // 🎯 Get media URL using the updated getPlayableMediaUrl
    let fileUrl = getPlayableMediaUrl(content);
    const isCloudflareStream = content.streaming_provider === 'cloudflare_stream';
    const isCloudflareR2 = content.streaming_provider === 'cloudflare_r2';
    
    console.log('📥 Loading media:', { 
        provider: content.streaming_provider, 
        url: fileUrl,
        isCloudflareStream,
        isCloudflareR2,
        media_type: content.media_type,
        content_format: content.content_format
    });
    
    // 🔥 CRITICAL FIX: If no URL found, try to use file_url directly as fallback
    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined') {
        console.warn('⚠️ No playable URL from getPlayableMediaUrl, trying file_url fallback...');
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
    
    // Handle audio mode with poster
    const isAudio = detectMediaType(content) === 'audio';
    console.log('🎵 Is audio mode:', isAudio);
    
    if (isAudio && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        videoElement.setAttribute('poster', imgUrl);
        videoElement.classList.add('audio-mode');
        // For audio, we want to show the poster and hide the video
        videoElement.style.objectFit = 'contain';
        videoElement.style.background = 'var(--bg-secondary)';
    } else {
        videoElement.removeAttribute('poster');
        videoElement.classList.remove('audio-mode');
        videoElement.style.objectFit = '';
        videoElement.style.background = '';
    }
    
    // Get MIME type - handle HLS manifests
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
    
    // 🚨 Load source - prefer loadSource method for reuse
    if (window.enhancedVideoPlayer && typeof window.enhancedVideoPlayer.loadSource === 'function') {
        console.log('♻️ Reusing existing player instance with loadSource');
        try {
            await window.enhancedVideoPlayer.loadSource({
                url: fileUrl,
                type: mimeType,
                title: content.title,
                isHLS: isHLS,
                streamingProvider: content.streaming_provider
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
    
    // 🚨 Initialize streaming manager AFTER source change
    // This ensures HLS.js picks up Cloudflare manifests
    setTimeout(() => {
        if (window.streamingManager) {
            window.streamingManager.destroy();
            window.streamingManager = null;
        }
        if (typeof window.initializeStreamingManager === 'function') {
            window.initializeStreamingManager();
        }
    }, 100);
    
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
                streamingProvider: this._currentStreamingProvider || null
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
        
        console.log('🔄 Loading new source without destroying player:', { 
            url, 
            contentId, 
            streamingProvider,
            isHLS 
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
        if (isHLS || url.includes('videodelivery.net') || url.endsWith('.m3u8')) {
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
            isHLS: isHLS
        };
        
        this.emit('source:loaded', { url, contentId, type, streamingProvider, isHLS });
        
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

console.log('✅ Video Player Section Module loaded (with full brain + Cloudflare support + Audio fixes)');
