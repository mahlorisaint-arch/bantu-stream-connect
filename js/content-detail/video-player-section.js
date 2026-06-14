// js/content-detail/video-player-section.js
// Extracted from content-detail.js - Video Player Initialization and Management

console.log('🎬 Video Player module loading...');

// ============================================
// ENHANCED VIDEO PLAYER CLASS
// ============================================
class EnhancedVideoPlayer {
    constructor(options = {}) {
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
        
        this.video = null;
        this.container = null;
        this.controls = null;
        this.isPlaying = false;
        this.isFullscreen = false;
        this.currentSpeed = this.options.defaultSpeed;
        this.currentQuality = this.options.defaultQuality;
        this.volume = this.options.defaultVolume;
        this.muted = this.options.muted;
        this.progressBar = null;
        this.currentTimeDisplay = null;
        this.durationDisplay = null;
        this.playPauseBtn = null;
        this.volumeBtn = null;
        this.volumeSlider = null;
        this.fullscreenBtn = null;
        this.settingsBtn = null;
        this.settingsMenu = null;
        this.progressContainer = null;
        this.events = {};
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        this.on = (event, callback) => {
            if (!this.events[event]) this.events[event] = [];
            this.events[event].push(callback);
        };
        
        this.emit = (event, data) => {
            if (this.events[event]) {
                this.events[event].forEach(callback => callback(data));
            }
        };
    }
    
    attach(videoElement, container) {
        this.video = videoElement;
        this.container = container;
        
        if (!this.video || !this.container) {
            console.error('❌ Cannot attach player: missing video or container');
            return;
        }
        
        this._setupDOMReferences();
        this._bindEvents();
        this._initializeControls();
        
        if (this.options.autoplay) {
            this.play();
        }
        
        console.log('✅ EnhancedVideoPlayer attached');
        this.emit('ready', { player: this });
    }
    
    _setupDOMReferences() {
        this.controls = this.container.querySelector('.enhanced-video-controls');
        this.progressBar = this.container.querySelector('.progress-bar');
        this.currentTimeDisplay = this.container.querySelector('.current-time');
        this.durationDisplay = this.container.querySelector('.duration');
        this.playPauseBtn = this.container.querySelector('.play-pause');
        this.volumeBtn = this.container.querySelector('.volume-btn');
        this.volumeSlider = this.container.querySelector('.volume-bar');
        this.fullscreenBtn = this.container.querySelector('.fullscreen-btn');
        this.settingsBtn = this.container.querySelector('.settings-btn');
        this.settingsMenu = this.container.querySelector('.settings-menu');
        this.progressContainer = this.container.querySelector('.progress-container');
    }
    
    _bindEvents() {
        // Video events
        this.video.addEventListener('play', () => {
            this.isPlaying = true;
            this._updatePlayPauseIcon();
            this.emit('play', { player: this });
        });
        
        this.video.addEventListener('pause', () => {
            this.isPlaying = false;
            this._updatePlayPauseIcon();
            this.emit('pause', { player: this });
        });
        
        this.video.addEventListener('timeupdate', () => {
            this._updateProgress();
            this.emit('timeupdate', { currentTime: this.video.currentTime });
        });
        
        this.video.addEventListener('loadedmetadata', () => {
            this._updateDuration();
            this.emit('loadedmetadata', { duration: this.video.duration });
        });
        
        this.video.addEventListener('ended', () => {
            this.emit('ended', { player: this });
        });
        
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            this.emit('error', { error: e, player: this });
        });
        
        this.video.addEventListener('volumechange', () => {
            this.volume = this.video.volume;
            this.muted = this.video.muted;
            this._updateVolumeIcon();
            this.emit('volumechange', { volume: this.volume, muted: this.muted });
        });
        
        // Control buttons
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => {
                const seekTime = (e.target.value / 100) * this.video.duration;
                this.video.currentTime = seekTime;
                this.emit('seek', { currentTime: seekTime });
            });
        }
        
        if (this.volumeBtn) {
            this.volumeBtn.addEventListener('click', () => this.toggleMute());
        }
        
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.setVolume(value / 100);
            });
        }
        
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        
        if (this.settingsBtn && this.settingsMenu) {
            this.settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.settingsMenu.classList.toggle('active');
            });
            
            document.addEventListener('click', (e) => {
                if (this.settingsMenu && this.settingsMenu.classList.contains('active') &&
                    !this.settingsMenu.contains(e.target) &&
                    !this.settingsBtn.contains(e.target)) {
                    this.settingsMenu.classList.remove('active');
                }
            });
        }
        
        // Quality options
        const qualityOptions = this.container.querySelectorAll('.quality-option');
        qualityOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const quality = option.dataset.quality;
                await this.setQuality(quality);
            });
        });
        
        // Speed options
        const speedOptions = this.container.querySelectorAll('.speed-option');
        speedOptions.forEach(option => {
            option.addEventListener('click', () => {
                const speed = parseFloat(option.dataset.speed);
                this.setPlaybackSpeed(speed);
            });
        });
        
        // Data saver toggle
        const dataSaverToggle = this.container.querySelector('#dataSaverToggle');
        if (dataSaverToggle) {
            dataSaverToggle.addEventListener('change', (e) => {
                this.emit('dataSaverToggled', { enabled: e.target.checked });
            });
        }
    }
    
    _initializeControls() {
        this.setVolume(this.volume * 100);
        this.video.muted = this.muted;
        this.setPlaybackSpeed(this.currentSpeed);
        this._updateVolumeIcon();
        this._updatePlayPauseIcon();
    }
    
    _updateProgress() {
        if (!this.progressBar || !this.currentTimeDisplay) return;
        
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.progressBar.value = percent;
        this.currentTimeDisplay.textContent = this._formatTime(this.video.currentTime);
    }
    
    _updateDuration() {
        if (!this.durationDisplay) return;
        this.durationDisplay.textContent = this._formatTime(this.video.duration);
    }
    
    _updatePlayPauseIcon() {
        if (!this.playPauseBtn) return;
        const icon = this.playPauseBtn.querySelector('i');
        if (icon) {
            if (this.isPlaying) {
                icon.className = 'fas fa-pause';
            } else {
                icon.className = 'fas fa-play';
            }
        }
    }
    
    _updateVolumeIcon() {
        if (!this.volumeBtn) return;
        const icon = this.volumeBtn.querySelector('i');
        if (icon) {
            if (this.muted || this.volume === 0) {
                icon.className = 'fas fa-volume-mute';
            } else if (this.volume < 0.5) {
                icon.className = 'fas fa-volume-down';
            } else {
                icon.className = 'fas fa-volume-up';
            }
        }
    }
    
    _formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.video) {
            this.video.play().catch(err => {
                console.warn('Playback prevented:', err);
                this.emit('playblocked', { error: err });
            });
        }
    }
    
    pause() {
        if (this.video) {
            this.video.pause();
        }
    }
    
    setVolume(value) {
        let volumeValue = Math.min(100, Math.max(0, value));
        this.video.volume = volumeValue / 100;
        this.volume = this.video.volume;
        this.muted = false;
        this.video.muted = false;
        if (this.volumeSlider) {
            this.volumeSlider.value = volumeValue;
        }
        this._updateVolumeIcon();
        this.emit('volumechange', { volume: this.volume, muted: false });
    }
    
    toggleMute() {
        this.video.muted = !this.video.muted;
        this.muted = this.video.muted;
        if (!this.muted && this.volumeSlider) {
            this.volumeSlider.value = this.volume * 100;
        }
        this._updateVolumeIcon();
        this.emit('volumechange', { volume: this.volume, muted: this.muted });
    }
    
    toggleFullscreen() {
        if (!this.container) return;
        
        if (!this.isFullscreen) {
            if (this.container.requestFullscreen) {
                this.container.requestFullscreen();
            } else if (this.container.webkitRequestFullscreen) {
                this.container.webkitRequestFullscreen();
            } else if (this.container.msRequestFullscreen) {
                this.container.msRequestFullscreen();
            }
            this.isFullscreen = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.isFullscreen = false;
        }
        
        if (this.fullscreenBtn) {
            const icon = this.fullscreenBtn.querySelector('i');
            if (icon) {
                if (this.isFullscreen) {
                    icon.className = 'fas fa-compress';
                } else {
                    icon.className = 'fas fa-expand';
                }
            }
        }
    }
    
    setPlaybackSpeed(speed) {
        this.currentSpeed = speed;
        this.video.playbackRate = speed;
        
        const speedOptions = this.container.querySelectorAll('.speed-option');
        speedOptions.forEach(option => {
            const optionSpeed = parseFloat(option.dataset.speed);
            if (optionSpeed === speed) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        this.emit('speedchange', { speed: speed });
    }
    
    async setQuality(quality) {
        this.currentQuality = quality;
        
        const qualityOptions = this.container.querySelectorAll('.quality-option');
        qualityOptions.forEach(option => {
            if (option.dataset.quality === quality) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        this.emit('qualitychange', { quality: quality });
    }
    
    async loadSource(sourceConfig) {
        if (!this.video) return;
        
        const wasPlaying = this.isPlaying;
        this.pause();
        
        this.video.src = sourceConfig.url;
        this.video.load();
        
        if (wasPlaying && document.body.classList.contains('user-interacted')) {
            try {
                await this.video.play();
            } catch(e) {
                console.warn('Auto-play after source change blocked:', e);
            }
        }
        
        console.log('🔄 Source changed without destroying player:', sourceConfig.url);
    }
    
    setCurrentTime(time) {
        if (this.video && typeof time !== 'undefined') {
            this.video.currentTime = time;
        }
    }
    
    destroy() {
        this.pause();
        this.video.src = '';
        this.video.load();
        
        Object.keys(this.events).forEach(event => {
            delete this.events[event];
        });
        
        console.log('✅ EnhancedVideoPlayer destroyed');
    }
}

// ============================================
// INITIALIZE ENHANCED VIDEO PLAYER
// ============================================
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
        
        console.log('🎬 Creating EnhancedVideoPlayer with safe assignments...');
        
        const player = new EnhancedVideoPlayer({
            autoplay: preferences.autoplay,
            defaultSpeed: preferences.playbackSpeed,
            defaultQuality: preferences.quality,
            defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
            muted: window.stateManager ? window.stateManager.getState('session.muted') : false,
            contentId: window.currentContentId || null,
            supabaseClient: window.supabaseClient,
            userId: window.currentUserId
        });
        
        window.enhancedVideoPlayer = player;
        player.attach(videoElement, videoContainer);
        
        // Add convenience methods
        player.setCurrentTime = function(time) {
            if (this.video && typeof time !== 'undefined') {
                this.video.currentTime = time;
            }
        };
        
        player.setVolume = function(value) {
            if (this.video) {
                this.video.volume = value;
            }
        };
        
        player.setMuted = function(isMuted) {
            if (this.video) {
                this.video.muted = isMuted;
            }
        };
        
        player.loadSource = async function(sourceConfig) {
            if (!player.video) return;
            player.video.pause();
            player.video.src = sourceConfig.url;
            player.video.load();
            if (document.body.classList.contains('user-interacted')) {
                try {
                    await player.video.play();
                } catch(e) {
                    console.warn('Auto-play after source change blocked:', e);
                }
            }
            console.log('🔄 Source changed without destroying player:', sourceConfig.url);
        };
        
        player.on('play', () => {
            console.log('▶️ Video playing...');
            if (window.stateManager) {
                window.stateManager.setState('session.playing', true);
            }
            if (typeof initializeWatchSessionOnPlay === 'function') {
                initializeWatchSessionOnPlay();
            }
        });
        
        player.on('pause', () => {
            if (window.stateManager) {
                window.stateManager.setState('session.playing', false);
            }
        });
        
        player.on('volumechange', (volume) => {
            if (window.stateManager) {
                window.stateManager.setState('session.volume', volume);
            }
        });
        
        player.on('error', (event) => {
            const media = player?.video;
            if (media && media.error === null && media.networkState !== 3) {
                return;
            }
            console.error('🔴 Video player error:', event);
            if (typeof showToast === 'function') {
                showToast('Playback error occurred', 'error');
            }
        });
        
        player.on('loadeddata', () => {
            console.log('✅ Video metadata loaded, ready to play');
            const placeholder = document.getElementById('videoPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });
        
        player.on('canplay', () => {
            console.log('✅ Video can start playing');
        });
        
        console.log('✅ Enhanced video player initialized with contentId:', window.currentContentId);
        return player;
        
    } catch (error) {
        console.error('❌ Failed to initialize enhanced video player:', error);
        if (typeof showToast === 'function') {
            showToast('Video player failed to load. Using basic player.', 'warning');
        }
        videoElement.controls = true;
        return null;
    }
}

// ============================================
// LOAD CONTENT INTO PLAYER (NON-DESTRUCTIVE)
// ============================================
async function loadContentIntoPlayer(content, index = null) {
    if (!content) return;
    
    const player = document.getElementById('inlinePlayer');
    const videoElement = document.getElementById('inlineVideoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (!player || !videoElement) {
        console.warn('Player elements not ready');
        return;
    }
    
    if (index !== null) {
        window.currentPlaylistIndex = index;
    }
    
    // Ensure contentId is synced before loading
    if (typeof updateGlobalContentId === 'function') {
        updateGlobalContentId(content.id);
    }
    
    player.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) heroPoster.style.opacity = '0.3';
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) closeFromHero.style.display = 'flex';
    
    let fileUrl = getPlayableMediaUrl(content);
    console.log('📥 Loading media URL:', fileUrl);
    
    if (fileUrl && !fileUrl.startsWith('http')) {
        if (fileUrl.startsWith('/')) fileUrl = fileUrl.substring(1);
        fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
    }
    
    if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined') {
        if (content.thumbnail_url) {
            const cleanPath = content.thumbnail_url.startsWith('/') ? content.thumbnail_url.substring(1) : content.thumbnail_url;
            fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
        }
    }
    
    const isAudio = detectMediaType(content) === 'audio';
    if (isAudio && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
        videoElement.setAttribute('poster', imgUrl);
        videoElement.classList.add('audio-mode');
    } else {
        videoElement.removeAttribute('poster');
        videoElement.classList.remove('audio-mode');
    }
    
    function getMediaMimeType(url = '') {
        const lower = url.toLowerCase();
        if (lower.endsWith('.mp4')) return 'video/mp4';
        if (lower.endsWith('.webm')) return 'video/webm';
        if (lower.endsWith('.mov')) return 'video/quicktime';
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.m4a')) return 'audio/mp4';
        return 'video/mp4';
    }
    
    if (window.enhancedVideoPlayer && typeof window.enhancedVideoPlayer.loadSource === 'function') {
        console.log('♻️ Reusing existing player instance with loadSource');
        await window.enhancedVideoPlayer.loadSource({
            url: fileUrl,
            type: getMediaMimeType(fileUrl),
            title: content.title
        });
    } else if (typeof enhancedVideoPlayer !== 'undefined' && enhancedVideoPlayer && typeof enhancedVideoPlayer.loadSource === 'function') {
        console.log('♻️ Reusing existing player instance (fallback) with loadSource');
        await enhancedVideoPlayer.loadSource({
            url: fileUrl,
            type: getMediaMimeType(fileUrl),
            title: content.title
        });
    } else {
        console.log('⚠️ loadSource not available, updating video source directly');
        if (window.watchSession) {
            window.watchSession.stop();
            window.watchSession = null;
        }
        while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
        videoElement.removeAttribute('src');
        const source = document.createElement('source');
        source.src = fileUrl;
        source.type = getMediaMimeType(fileUrl);
        videoElement.appendChild(source);
        videoElement.load();
    }
    
    setTimeout(() => {
        if (window.streamingManager) {
            window.streamingManager.destroy();
            window.streamingManager = null;
        }
        if (typeof initializeStreamingManager === 'function') {
            initializeStreamingManager();
        }
    }, 100);
    
    setTimeout(() => {
        if (typeof initializeWatchSessionOnPlay === 'function') {
            initializeWatchSessionOnPlay();
        }
    }, 100);
    
    setTimeout(async () => {
        try {
            const canAutoplay = document.body.classList.contains('user-interacted');
            if (!canAutoplay) {
                console.log('⛔ Autoplay blocked until user interaction');
                if (typeof showInitialPlayOverlay === 'function') {
                    showInitialPlayOverlay();
                }
                return;
            }
            const playerInstance = window.enhancedVideoPlayer || (typeof enhancedVideoPlayer !== 'undefined' ? enhancedVideoPlayer : null);
            if (playerInstance && typeof playerInstance.play === 'function') {
                await playerInstance.play();
            } else {
                await videoElement.play();
            }
            console.log('▶️ Playback started successfully');
            const overlay = document.getElementById('initialPlayOverlay');
            if (overlay) overlay.classList.add('hidden');
        } catch (error) {
            console.warn('⚠️ Playback blocked:', error);
            if (typeof showInitialPlayOverlay === 'function') {
                showInitialPlayOverlay();
            }
        }
    }, 300);
    
    setTimeout(() => {
        player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// ============================================
// GET PLAYABLE MEDIA URL
// ============================================
function getPlayableMediaUrl(content) {
    if (!content) return null;
    return (
        content.file_url ||
        content.audio_url ||
        content.video_url ||
        content.media_url ||
        null
    );
}

// ============================================
// DETECT MEDIA TYPE
// ============================================
function detectMediaType(content) {
    if (!content) return 'video';
    if (content.media_type) {
        if (content.media_type.toLowerCase() === 'audio') return 'audio';
        if (content.media_type.toLowerCase() === 'video') return 'video';
    }
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

// ============================================
// INITIALIZE VIDEO PLAYER SKELETON
// ============================================
function initializeVideoPlayerSkeleton() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (videoElement) {
        videoElement.preload = 'none';
        videoElement.controls = false;
        console.log('🎥 Video skeleton ready (preload=none)');
    }
}

// ============================================
// CLOSE VIDEO PLAYER
// ============================================
function closeVideoPlayer() {
    const player = document.getElementById('inlinePlayer');
    const video = document.getElementById('inlineVideoPlayer');
    
    if (player) {
        player.style.display = 'none';
    }
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
    if (window.watchSession) {
        window.watchSession.stop();
        window.watchSession = null;
    }
    
    const playerInstance = window.enhancedVideoPlayer || (typeof enhancedVideoPlayer !== 'undefined' ? enhancedVideoPlayer : null);
    if (playerInstance) {
        if (playerInstance.video) {
            playerInstance.video.pause();
            playerInstance.video.currentTime = 0;
        }
    }
    
    if (window.streamingManager) {
        window.streamingManager.destroy();
        window.streamingManager = null;
    }
    
    if (window.viewValidationTimer) {
        clearTimeout(window.viewValidationTimer);
        window.viewValidationTimer = null;
    }
    
    if (window._currentPlayingContentId) {
        if (window.cleanupContentSession) {
            window.cleanupContentSession(window._currentPlayingContentId);
        }
        window._currentPlayingContentId = null;
    }
    
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    
    const heroPoster = document.getElementById('heroPoster');
    if (heroPoster) {
        heroPoster.style.opacity = '1';
    }
    
    const closeFromHero = document.getElementById('closePlayerFromHero');
    if (closeFromHero) {
        closeFromHero.style.display = 'none';
    }
    
    const hero = document.querySelector('.content-hero');
    if (hero) {
        hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// SHOW INITIAL PLAY OVERLAY
// ============================================
function showInitialPlayOverlay() {
    const overlay = document.getElementById('initialPlayOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================
window.EnhancedVideoPlayer = EnhancedVideoPlayer;
window.initializeEnhancedVideoPlayer = initializeEnhancedVideoPlayer;
window.loadContentIntoPlayer = loadContentIntoPlayer;
window.getPlayableMediaUrl = getPlayableMediaUrl;
window.detectMediaType = detectMediaType;
window.initializeVideoPlayerSkeleton = initializeVideoPlayerSkeleton;
window.closeVideoPlayer = closeVideoPlayer;
window.showInitialPlayOverlay = showInitialPlayOverlay;

console.log('✅ Video Player module loaded');
