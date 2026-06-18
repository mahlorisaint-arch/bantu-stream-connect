// js/content-detail/video-player-section.js
// ============================================
// VIDEO PLAYER SECTION MODULE - CLOUDFLARE INTEGRATION
// Uses the main EnhancedVideoPlayer from js/video-player.js
// ============================================
console.log('🎬 Video Player Section Module Loading... (Cloudflare Edition)');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get playable media URL from content object
 * Supports all Cloudflare provider types
 * @param {Object} content - Content object
 * @returns {string|null} - Playable URL or null
 */
function getPlayableMediaUrl(content) {
    if (!content) return null;
    
    // Cloudflare Stream (video)
    if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
        return `https://iframe.videodelivery.net/${content.provider_video_id}`;
    }
    
    // Cloudflare R2 (audio)
    if (content.streaming_provider === 'cloudflare_r2' && content.file_url) {
        return content.file_url;
    }
    
    // Legacy fallback
    return (
        content.file_url ||
        content.audio_url ||
        content.video_url ||
        content.media_url ||
        null
    );
}

/**
 * Detect if content is Cloudflare Stream
 */
function isCloudflareStreamContent(content) {
    return content?.streaming_provider === 'cloudflare_stream' && content?.provider_video_id;
}

/**
 * Detect if content is Cloudflare R2 (audio)
 */
function isCloudflareR2Content(content) {
    return content?.streaming_provider === 'cloudflare_r2' && content?.file_url;
}

/**
 * Detect media type (audio vs video) from content
 * @param {Object} content - Content object
 * @returns {string} - 'audio' or 'video'
 */
function detectMediaType(content) {
    if (!content) return 'video';
    
    // Check media_type from database
    if (content.media_type) {
        if (content.media_type.toLowerCase() === 'audio') return 'audio';
        if (content.media_type.toLowerCase() === 'video') return 'video';
    }
    
    // Check streaming provider
    if (isCloudflareStreamContent(content)) return 'video';
    if (isCloudflareR2Content(content)) return 'audio';
    
    const format = (content.content_format || '').toLowerCase();
    if (format.includes('audio') || format.includes('podcast') || format.includes('music')) {
        return 'audio';
    }
    
    const url = getPlayableMediaUrl(content);
    if (url) {
        const ext = url.split('.').pop()?.toLowerCase();
        if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'aac' || ext === 'm4a') {
            return 'audio';
        }
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
        if (typeof playerInstance.destroy === 'function') {
            playerInstance.destroy();
        } else if (playerInstance.video) {
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
 * Uses the main EnhancedVideoPlayer with Cloudflare support
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
        
        // Get the main player instance
        let playerInstance = window.enhancedVideoPlayer;
        
        // If no player instance, create one
        if (!playerInstance) {
            console.log('🔄 Creating new EnhancedVideoPlayer instance...');
            await initializeEnhancedVideoPlayer();
            playerInstance = window.enhancedVideoPlayer;
        }
        
        if (!playerInstance) {
            console.error('❌ Player instance not found.');
            if (typeof window.showToast === 'function') {
                window.showToast('Player not available. Please refresh.', 'error');
            }
            return;
        }
        
        // If player has loadContent method, use it (Cloudflare-aware)
        if (typeof playerInstance.loadContent === 'function' && window.currentContent) {
            console.log('🔄 Loading content with Cloudflare support');
            await playerInstance.loadContent(window.currentContent);
            
            // Play after loading
            if (typeof playerInstance.play === 'function') {
                await playerInstance.play();
            }
            
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
            
            if (window.currentContent?.id && !window.watchSession) {
                initializeWatchSessionOnPlay();
            }
            return;
        }
        
        // Fallback: try standard play
        if (typeof playerInstance.play === 'function') {
            await playerInstance.play();
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
            if (window.currentContent?.id && !window.watchSession) {
                initializeWatchSessionOnPlay();
            }
            return;
        }
        
        // Last resort: try video element directly
        const video = playerInstance.video;
        if (video) {
            if (!video.src && !window.isPlaylistMode && window.currentContent) {
                const fileUrl = getPlayableMediaUrl(window.currentContent);
                if (fileUrl && fileUrl.startsWith('http')) {
                    video.src = fileUrl;
                    video.load();
                }
            }
            
            video.muted = false;
            video.volume = 1.0;
            window.userHasInteractedWithMedia = true;
            document.body.classList.add('user-interacted');
            
            await video.play();
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
            
            if (window.currentContent?.id && !window.watchSession) {
                initializeWatchSessionOnPlay();
            }
            return;
        }
        
        console.error('❌ No playback method available');
        if (typeof window.showToast === 'function') {
            window.showToast('Unable to start playback. Please try again.', 'error');
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
 * Load content into video player using the main EnhancedVideoPlayer
 * @param {Object} content - Content object to play
 * @param {number} index - Optional playlist index
 */
async function loadContentIntoPlayer(content, index = null) {
    if (!content) {
        console.warn('⚠️ No content provided to loadContentIntoPlayer');
        return;
    }
    
    console.log('📦 loadContentIntoPlayer called for content:', content.id, 'provider:', content.streaming_provider);
    
    const player = document.getElementById('inlinePlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (!player) {
        console.warn('Player container not ready');
        return;
    }
    
    if (index !== null) {
        window.currentPlaylistIndex = index;
    }
    
    // Ensure contentId is synced
    if (typeof window.updateGlobalContentId === 'function') {
        window.updateGlobalContentId(content.id);
    }
    
    // Make player visible
    player.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    
    // Get or create player instance
    let playerInstance = window.enhancedVideoPlayer;
    
    if (!playerInstance) {
        console.log('🔄 Creating new EnhancedVideoPlayer instance for content load...');
        await initializeEnhancedVideoPlayer();
        playerInstance = window.enhancedVideoPlayer;
    }
    
    if (!playerInstance) {
        console.error('❌ Failed to create player instance');
        return;
    }
    
    // Use loadContent if available (Cloudflare-aware)
    if (typeof playerInstance.loadContent === 'function') {
        console.log('🔄 Loading content via player.loadContent');
        await playerInstance.loadContent(content);
    } else if (typeof playerInstance.loadSource === 'function') {
        // Fallback: use loadSource with file URL
        const fileUrl = getPlayableMediaUrl(content);
        if (fileUrl) {
            console.log('🔄 Loading content via player.loadSource');
            await playerInstance.loadSource({
                url: fileUrl,
                type: 'video/mp4',
                contentId: content.id
            });
        } else {
            console.warn('⚠️ No playable URL found for content');
        }
    } else {
        console.warn('⚠️ Player instance has no loadContent or loadSource method');
    }
    
    // Initialize streaming manager
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
            
            const instance = window.enhancedVideoPlayer;
            if (instance && typeof instance.play === 'function') {
                await instance.play();
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
// INITIALIZE ENHANCED VIDEO PLAYER
// ============================================

/**
 * Initialize the main EnhancedVideoPlayer from js/video-player.js
 * This uses the Cloudflare-aware player engine
 */
function initializeEnhancedVideoPlayer() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const videoContainer = document.querySelector('.video-container');
    
    if (!videoElement || !videoContainer) {
        console.warn('⚠️ Video elements not found');
        return;
    }
    
    // Check if main EnhancedVideoPlayer is available
    if (typeof window.EnhancedVideoPlayer === 'undefined') {
        console.warn('⚠️ Main EnhancedVideoPlayer not loaded yet, waiting...');
        setTimeout(initializeEnhancedVideoPlayer, 500);
        return;
    }
    
    // Don't recreate if already exists
    if (window.enhancedVideoPlayer && window.enhancedVideoPlayer._isAttached) {
        console.log('ℹ️ Player already initialized');
        return;
    }
    
    try {
        console.log('🎬 Creating EnhancedVideoPlayer with Cloudflare support...');
        
        const config = {
            contentId: window.currentContentId || window.currentContent?.id || null,
            content: window.currentContent || null,
            userId: window.currentUserId || null,
            autoplay: false,
            muted: true,
            enableTelemetry: true,
            enableCollectionNav: true,
            minViewThresholdSeconds: 15,
            percentageViewThreshold: 0.3
        };
        
        const player = new window.EnhancedVideoPlayer(config);
        window.enhancedVideoPlayer = player;
        
        // Attach to DOM
        player.attach(videoElement, videoContainer, {
            contentId: config.contentId,
            content: config.content
        }).then(() => {
            console.log('✅ EnhancedVideoPlayer attached successfully');
            
            // If content is available, load it
            if (window.currentContent) {
                player.loadContent(window.currentContent).catch(err => {
                    console.warn('⚠️ Content load after attach failed:', err);
                });
            }
            
            // Setup ended listener for playlist progression
            player.on('ended', function(data) {
                console.log('🏁 Player ended - checking for playlist progression');
                if (typeof window.playNextPlaylistItem === 'function') {
                    window.playNextPlaylistItem();
                }
            });
            
            // Emit ready event
            window.dispatchEvent(new CustomEvent('playerReady', {
                detail: { player: player, content: window.currentContent }
            }));
            
        }).catch((error) => {
            console.error('❌ Player attach failed:', error);
        });
        
        console.log('✅ EnhancedVideoPlayer initialization started');
        
    } catch (error) {
        console.error('❌ Failed to initialize EnhancedVideoPlayer:', error);
        // Fallback: use basic video element
        if (videoElement) {
            videoElement.controls = true;
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Video player failed to load. Using basic player.', 'warning');
        }
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
            if (error) {
                console.error('Session init error:', error);
                return false;
            }
            this.isActive = true;
            console.log(`🎬 Watch session initialized: ${this.playbackSessionId}`);
            return true;
        } catch (error) {
            console.error('Session init error:', error);
            return false;
        }
    }
    
    startHeartbeatLoop(videoElement) {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (!this.isActive || !videoElement || videoElement.paused) return;
            
            // Get current time - handle Cloudflare player if needed
            let currentTime = Math.floor(videoElement.currentTime || 0);
            const player = window.enhancedVideoPlayer;
            if (player && player.isCloudflareStream && typeof player.getCurrentTime === 'function') {
                currentTime = Math.floor(player.getCurrentTime());
            }
            
            if (currentTime === 0) return;
            
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
            let duration = videoElement.duration || 0;
            if (player && player.isCloudflareStream && typeof player.getDuration === 'function') {
                duration = player.getDuration();
            }
            
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
    
    start(videoElement) { 
        if (videoElement) this.startHeartbeatLoop(videoElement); 
    }
    
    stop() {
        this.isActive = false;
        if (this.heartbeatInterval) { 
            clearInterval(this.heartbeatInterval); 
            this.heartbeatInterval = null; 
        }
        window.supabaseClient.from('playback_sessions')
            .update({ completed: true, exited_at: new Date().toISOString() })
            .eq('playback_session_id', this.playbackSessionId)
            .catch(e => console.error('Session close error:', e));
    }
}

function initializeWatchSessionOnPlay() {
    if (!window.currentContent || !window.currentUserId) return;
    const player = window.enhancedVideoPlayer;
    const video = player?.video;
    
    if (!video && !player?.isCloudflareStream) return;
    
    if (window.watchSession) { 
        window.watchSession.stop(); 
        window.watchSession = null; 
    }
    
    try {
        window.currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        window.watchSession = new WatchSessionManager(window.currentContentId, window.currentUserId);
        window.watchSession.initializeSession('Web', 'Desktop');
        
        // For Cloudflare Stream, pass the player instance
        if (player && player.isCloudflareStream) {
            // The watch session will use the player's getCurrentTime
            window.watchSession.start(video || { currentTime: 0, duration: 0 });
        } else if (video) {
            window.watchSession.start(video);
        }
        console.log('✅ Watch session started');
    } catch (error) { 
        console.error('Failed to initialize watch session:', error); 
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Note: We do NOT overwrite window.EnhancedVideoPlayer here
// We use the one from js/video-player.js

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
window.isCloudflareStreamContent = isCloudflareStreamContent;
window.isCloudflareR2Content = isCloudflareR2Content;

console.log('✅ Video Player Section Module loaded (Cloudflare Edition - using main player)');
