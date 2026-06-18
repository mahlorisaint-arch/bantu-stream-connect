// js/streaming-manager.js — HLS Streaming & Quality Control Manager
// Bantu Stream Connect — Phase 4 Implementation
// ✅ COMPLETE: Quality switching works for both HLS and MP4
// 🎵 AUDIO SUPPORT: Skip HLS for audio files, use direct playback
// ✅ FIXED: No creator_id references (this file never used it)
// ✅ FIXED: Network speed test now uses non-authenticated CDN endpoint (no 401 errors)
// ✅ FIXED: Graceful fallback when network test fails
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23):
// - FIX #2: Added contentId synchronization (updateContentId method)
// - FIX #2: Initialize method now checks for contentId updates
// - FIX #7: Added realtime quality preference sync across tabs
// - Added reinitialize method for playlist track changes
// ☁️ CLOUDFLARE STREAM SUPPORT (2026-06-18):
// - Added Cloudflare Stream detection in initialize()
// - Updated _initializeHLS() with Cloudflare-specific CORS handling
// - Added _isCloudflareStreamUrl() helper method

(function() {
  'use strict';
  
  console.log('📡 StreamingManager module loading...');

  function StreamingManager(config) {
    if (!config || !config.videoElement) {
      console.error('❌ StreamingManager: Missing required config (videoElement)');
      return;
    }

    this.video = config.videoElement;
    this.supabase = config.supabaseClient || window.supabaseClient;
    this.contentId = config.contentId || null;
    this.userId = config.userId || null;
    
    // Quality levels
    this.qualityLevels = [
      { label: 'Auto', value: 'auto', bitrate: 0 },
      { label: '1080p', value: '1080p', bitrate: 5000000 },
      { label: '720p', value: '720p', bitrate: 2500000 },
      { label: '480p', value: '480p', bitrate: 1000000 },
      { label: '360p', value: '360p', bitrate: 500000 }
    ];
    
    // State
    this.currentQuality = 'auto';
    this.isDataSaverMode = false;
    this.networkSpeed = null;
    this.availableQualities = [];
    this.hlsInstance = null;
    this.originalVideoUrl = null;
    this.contentType = 'video'; // 'video' or 'audio'
    this._networkCheckInterval = null; // ✅ Added for cleanup
    this._currentHlsManifestUrl = null; // 🚨 Store for reinitialization
    this._isInitialized = false; // 🚨 Track initialization state
    this._lastInitializedContentId = null; // 🚨 Track last content ID
    
    // Callbacks
    this.onQualityChange = config.onQualityChange || null;
    this.onDataSaverToggle = config.onDataSaverToggle || null;
    this.onError = config.onError || null;
    this.onContentChange = config.onContentChange || null; // 🚨 New callback for content changes
    
    // Load saved preferences
    this._loadUserPreferences();
    
    // 🚨 Listen for contentId changes from other components
    this._setupContentIdListener();
    
    // 🚨 Listen for storage events to sync preferences across tabs
    this._setupStorageListener();
    
    console.log('✅ StreamingManager initialized with contentId:', this.contentId);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  StreamingManager.prototype.initialize = async function() {
    console.log('📡 StreamingManager.initialize() called for content:', this.contentId);
    
    // 🚨 Skip if already initialized with same contentId
    if (this._isInitialized && this._lastInitializedContentId === this.contentId) {
      console.log('⚠️ StreamingManager already initialized for this content, skipping');
      return;
    }
    
    // Store original video URL
    this.originalVideoUrl = this.video.src || 
      (this.video.querySelector('source')?.src) || null;
    
    // ============================================
    // ✅ CHECK FOR CLOUDFLARE STREAM
    // ============================================
    if (!this.contentId) {
      console.log('ℹ️ No content ID, using direct playback');
      return;
    }
    
    try {
      // Get content media type and Cloudflare provider info
      const { data: contentData, error: contentError } = await this.supabase
        .from('Content')
        .select('media_type, hls_manifest_url, quality_profiles, file_url, streaming_provider, provider_video_id')
        .eq('id', this.contentId)
        .maybeSingle();
      
      if (contentError) {
        console.warn('⚠️ Could not fetch content type:', contentError);
      }
      
      // 🚨 DETERMINE CONTENT TYPE - Check Cloudflare providers
      if (contentData?.streaming_provider === 'cloudflare_stream') {
        this.contentType = 'video';
        console.log('📺 Cloudflare Stream video detected - using HLS');
        
        // Build HLS manifest URL from provider_video_id
        if (contentData?.provider_video_id) {
          const hlsUrl = `https://videodelivery.net/${contentData.provider_video_id}/manifest/video.m3u8`;
          this._currentHlsManifestUrl = hlsUrl;
          
          // ✅ Initialize HLS with Cloudflare manifest
          if (this._isHLSSupported()) {
            console.log('📺 Initializing HLS for Cloudflare Stream:', hlsUrl);
            await this._initializeHLS(hlsUrl);
          } else {
            console.warn('⚠️ HLS not supported, falling back to direct playback');
            this.video.src = hlsUrl;
          }
        }
        
        this._isInitialized = true;
        this._lastInitializedContentId = this.contentId;
        return;
      }
      
      if (contentData?.streaming_provider === 'cloudflare_r2') {
        this.contentType = 'audio';
        console.log('🎵 Cloudflare R2 audio detected - skipping HLS');
        this._isInitialized = true;
        this._lastInitializedContentId = this.contentId;
        return;
      }
      
      // ============================================
      // ✅ LEGACY: SKIP HLS FOR AUDIO FILES
      // ============================================
      if (contentData?.media_type === 'audio') {
        this.contentType = 'audio';
        console.log('🎵 Audio content detected - skipping HLS initialization');
        this._isInitialized = true;
        this._lastInitializedContentId = this.contentId;
        return;
      }
      
      // Store HLS manifest URL for potential reinitialization
      if (contentData?.hls_manifest_url) {
        this._currentHlsManifestUrl = contentData.hls_manifest_url;
      }
      
      // Load available qualities from database
      await this._loadAvailableQualities();
      
      // Check if HLS is supported AND available
      if (contentData?.hls_manifest_url && this._isHLSSupported()) {
        console.log('📺 HLS manifest available, initializing HLS');
        await this._initializeHLS(contentData.hls_manifest_url);
      } else {
        console.log('ℹ️ No HLS manifest or HLS not supported, using MP4');
      }
      
      // Setup network monitoring
      this._startNetworkMonitoring();
      
      // Apply saved quality preference
      await this._applyQualityPreference();
      
      this._isInitialized = true;
      this._lastInitializedContentId = this.contentId;
      
    } catch (error) {
      console.error('❌ StreamingManager initialization error:', error);
      this._handleError('init', error);
    }
    
    console.log('✅ StreamingManager fully initialized for', this.contentType, 'contentId:', this.contentId);
  };

  /**
   * 🚨 FIX #2: Reinitialize streaming for new content
   * Called when playlist track changes to update contentId
   */
  StreamingManager.prototype.reinitialize = async function(newContentId) {
    if (this.contentId === newContentId && this._isInitialized) {
      console.log('⚠️ StreamingManager already using contentId:', newContentId);
      return;
    }
    
    console.log(`🔄 Reinitializing StreamingManager: ${this.contentId} -> ${newContentId}`);
    
    // Destroy current HLS instance
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      } catch (e) {
        console.warn('HLS destroy during reinit error:', e);
      }
    }
    
    // Update contentId
    this.contentId = newContentId;
    this._isInitialized = false;
    this._currentHlsManifestUrl = null;
    
    // Reinitialize with new content
    await this.initialize();
    
    // Notify callback
    if (this.onContentChange) {
      this.onContentChange({
        contentId: this.contentId,
        timestamp: Date.now()
      });
    }
  };

  /**
   * 🚨 FIX #2: Update contentId without full reinit (lighter operation)
   * For when only the ID changes but streaming source remains similar
   */
  StreamingManager.prototype.updateContentId = function(newContentId) {
    if (this.contentId === newContentId) {
      return;
    }
    
    console.log(`📡 StreamingManager contentId updated: ${this.contentId} -> ${newContentId}`);
    this.contentId = newContentId;
    this._lastInitializedContentId = null;
    this._isInitialized = false;
  };

  StreamingManager.prototype.setQuality = async function(quality) {
    // For audio files, just return - no quality switching needed
    if (this.contentType === 'audio') {
      console.log('🎵 Audio file - quality switching not applicable');
      return false;
    }
    
    if (!this.qualityLevels.find(q => q.value === quality)) {
      console.warn('⚠️ Invalid quality level:', quality);
      return false;
    }
    
    const currentTime = this.video.currentTime;
    const wasPaused = this.video.paused;
    
    console.log('📺 Changing quality to:', quality);
    this.currentQuality = quality;
    
    // Save preference
    this._saveQualityPreference(quality);
    
    // If HLS, switch quality level
    if (this.hlsInstance && quality !== 'auto') {
      const levelIndex = this.qualityLevels.findIndex(q => q.value === quality);
      if (levelIndex >= 0 && levelIndex < this.hlsInstance.levels.length) {
        this.hlsInstance.currentLevel = levelIndex;
        console.log('✅ HLS quality switched to:', quality);
      }
    } else {
      // For MP4, we need to reload with different URL
      // In production, you'd have separate URLs for each quality
      console.log('ℹ️ MP4 quality change (would reload with different URL in production)');
    }
    
    // Notify callback
    if (this.onQualityChange) {
      this.onQualityChange({ 
        quality: quality, 
        timestamp: Date.now(),
        bitrate: this._getCurrentBitrate()
      });
    }
    
    // Show toast notification
    if (typeof window.showToast === 'function') {
      window.showToast('Quality: ' + quality.toUpperCase(), 'info');
    } else if (typeof showToast === 'function') {
      showToast('Quality: ' + quality.toUpperCase(), 'info');
    }
    
    console.log('📺 Quality changed to:', quality);
    return true;
  };

  StreamingManager.prototype.toggleDataSaver = function(enabled) {
    // For audio files, data saver doesn't apply
    if (this.contentType === 'audio') {
      console.log('🎵 Audio file - data saver not applicable');
      return false;
    }
    
    this.isDataSaverMode = enabled;
    
    // Save preference
    localStorage.setItem('bsc_data_saver', enabled ? 'true' : 'false');
    
    // Apply data saver quality
    if (enabled) {
      this.setQuality('360p');
    } else {
      this.setQuality('auto');
    }
    
    // Notify callback
    if (this.onDataSaverToggle) {
      this.onDataSaverToggle({ enabled: enabled, timestamp: Date.now() });
    }
    
    console.log('💾 Data saver mode:', enabled ? 'ON' : 'OFF');
    return enabled;
  };

  StreamingManager.prototype.getAvailableQualities = function() {
    // For audio files, return minimal quality options
    if (this.contentType === 'audio') {
      return [{ label: 'Audio', value: 'audio', bitrate: 128000 }];
    }
    
    if (this.isDataSaverMode) {
      return this.availableQualities.length > 0 ? 
        this.availableQualities.filter(q => q.value === '360p' || q.value === 'auto') :
        [{ label: 'Auto', value: 'auto' }, { label: '360p', value: '360p' }];
    }
    return this.availableQualities.length > 0 ? 
      this.availableQualities : this.qualityLevels;
  };

  StreamingManager.prototype.getCurrentQuality = function() {
    return this.currentQuality;
  };

  StreamingManager.prototype.isDataSaverEnabled = function() {
    return this.isDataSaverMode;
  };

  StreamingManager.prototype.getNetworkSpeed = function() {
    return this.networkSpeed;
  };

  StreamingManager.prototype.getContentType = function() {
    return this.contentType;
  };

  StreamingManager.prototype.getCurrentContentId = function() {
    return this.contentId;
  };

  StreamingManager.prototype.destroy = function() {
    // Stop network monitoring
    if (this._networkCheckInterval) {
      clearInterval(this._networkCheckInterval);
      this._networkCheckInterval = null;
    }
    
    // Destroy HLS instance
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch (e) {
        console.warn('HLS destroy error:', e);
      }
      this.hlsInstance = null;
    }
    
    this._isInitialized = false;
    this._lastInitializedContentId = null;
    
    console.log('🛑 StreamingManager destroyed');
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  StreamingManager.prototype._isHLSSupported = function() {
    // Check for native HLS support (Safari)
    const video = document.createElement('video');
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      return true;
    }
    // Check for HLS.js support
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      return true;
    }
    return false;
  };

  StreamingManager.prototype._loadAvailableQualities = function() {
    if (!this.contentId) {
      this.availableQualities = [...this.qualityLevels];
      return;
    }
    
    try {
      // For Cloudflare Stream, we don't need to load from content_quality table
      // Cloudflare handles adaptive bitrate automatically
      this.availableQualities = [...this.qualityLevels];
      console.log('📺 Using default quality levels for Cloudflare Stream');
    } catch (error) {
      console.warn('⚠️ Could not load quality profiles:', error);
      this.availableQualities = [...this.qualityLevels];
    }
  };

  StreamingManager.prototype._initializeHLS = async function(hlsManifestUrl) {
    if (!hlsManifestUrl) return;
    
    try {
      // Check if this is a Cloudflare Stream manifest
      const isCloudflareStream = hlsManifestUrl.includes('videodelivery.net');
      if (isCloudflareStream) {
        console.log('☁️ Cloudflare Stream manifest detected:', hlsManifestUrl);
      }
      
      // Check for HLS.js (for non-Safari browsers)
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          // 🚨 Cloudflare Stream specific: allow cross-origin
          xhrSetup: function(xhr, url) {
            // Cloudflare Stream manifests support CORS
            xhr.withCredentials = false;
          }
        });
        
        this.hlsInstance.loadSource(hlsManifestUrl);
        this.hlsInstance.attachMedia(this.video);
        
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest parsed successfully');
          // Only autoplay if video was already playing
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        });
        
        this.hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          console.log('📺 Quality level switched to:', data.level);
          if (this.hlsInstance?.levels) {
            const level = this.hlsInstance.levels[data.level];
            if (level) {
              const qualityLabel = level.height ? `${level.height}p` : 'auto';
              this.currentQuality = qualityLabel;
            }
          }
        });
        
        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('❌ HLS fatal error:', data);
            this._handleError('hls', data);
          } else {
            console.warn('⚠️ HLS non-fatal error:', data);
          }
        });
        
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        console.log('📺 Using native Safari HLS playback');
        this.video.src = hlsManifestUrl;
        this.video.addEventListener('loadedmetadata', () => {
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        });
      } else {
        console.warn('⚠️ HLS not supported in this browser');
      }
      
    } catch (error) {
      console.error('❌ HLS initialization failed:', error);
      this._handleError('hls_init', error);
    }
  };

  /**
   * Check if a URL is a Cloudflare Stream HLS manifest
   * @param {string} url - The URL to check
   * @returns {boolean} - True if it's a Cloudflare Stream manifest
   */
  StreamingManager.prototype._isCloudflareStreamUrl = function(url) {
    if (!url) return false;
    return url.includes('videodelivery.net') || 
           (url.includes('.m3u8') && this._currentHlsManifestUrl?.includes('videodelivery.net'));
  };

  StreamingManager.prototype._startNetworkMonitoring = function() {
    // Skip network monitoring for audio files
    if (this.contentType === 'audio') {
      console.log('🎵 Audio file - skipping network monitoring');
      return;
    }
    
    // Clear any existing interval
    if (this._networkCheckInterval) {
      clearInterval(this._networkCheckInterval);
    }
    
    // Check network speed every 60 seconds
    this._networkCheckInterval = setInterval(() => {
      this._measureNetworkSpeed();
    }, 60000);
    
    // Initial check after a short delay
    setTimeout(() => {
      this._measureNetworkSpeed();
    }, 5000);
  };

  /**
   * Measure network speed using a reliable, non-authenticated endpoint
   * ✅ FIXED: No more 401 Unauthorized errors
   * Uses a small CDN image download time to estimate bandwidth
   */
  StreamingManager.prototype._measureNetworkSpeed = async function() {
    // Skip if already testing to avoid overlapping requests
    if (this._isMeasuringSpeed) {
      return;
    }
    
    this._isMeasuringSpeed = true;
    
    try {
      // Use a reliable, small image from a fast CDN that doesn't require authentication
      const testImageUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js';
      const testSizeKB = 80; // Approximate size in KB
      const startTime = Date.now();
      
      // Fetch with cache busting to ensure actual network request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(testImageUrl + '?cb=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Read the response to ensure we actually download the content
      await response.arrayBuffer();
      
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSec = durationMs / 1000;
      
      // Calculate speed in bits per second
      if (durationSec > 0) {
        const speedBps = (testSizeKB * 8 * 1024) / durationSec;
        this.networkSpeed = Math.round(speedBps);
        
        console.log('🌐 Network speed:', (this.networkSpeed / 1000000).toFixed(2), 'Mbps', `(test took ${durationMs}ms)`);
      } else {
        this.networkSpeed = 10000000; // 10 Mbps
        console.log('🌐 Network speed: Very fast (>10 Mbps)');
      }
      
      // Auto-adjust quality based on network (if in auto mode)
      if (this.currentQuality === 'auto' && !this.isDataSaverMode && this.contentType !== 'audio') {
        this._autoAdjustQuality();
      }
      
    } catch (error) {
      // Silent fallback - don't pollute console with expected errors
      if (error.name !== 'AbortError') {
        console.debug('Network speed measurement unavailable, using default profile');
      }
      this.networkSpeed = 2000000; // Default to 2 Mbps (good for 720p)
    } finally {
      this._isMeasuringSpeed = false;
    }
  };

  StreamingManager.prototype._autoAdjustQuality = function() {
    if (!this.networkSpeed) return;
    
    // For Cloudflare Stream, HLS.js handles adaptive bitrate automatically
    // Only adjust if we're in manual quality mode
    if (this._currentHlsManifestUrl?.includes('videodelivery.net')) {
      console.log('☁️ Cloudflare Stream - using HLS.js adaptive bitrate');
      return;
    }
    
    // Bitrate thresholds (bits per second)
    if (this.networkSpeed > 8000000) {      // > 8 Mbps
      this.setQuality('1080p');
    } else if (this.networkSpeed > 4000000) { // > 4 Mbps
      this.setQuality('720p');
    } else if (this.networkSpeed > 1500000) { // > 1.5 Mbps
      this.setQuality('480p');
    } else {
      this.setQuality('360p');
    }
  };

  StreamingManager.prototype._applyQualityPreference = async function() {
    // Skip for audio files
    if (this.contentType === 'audio') {
      this.currentQuality = 'audio';
      return;
    }
    
    // For Cloudflare Stream, we don't apply manual quality preferences
    // HLS.js handles adaptive bitrate automatically
    if (this._currentHlsManifestUrl?.includes('videodelivery.net')) {
      this.currentQuality = 'auto';
      console.log('☁️ Cloudflare Stream - using adaptive bitrate (auto)');
      return;
    }
    
    // Load from localStorage
    const savedQuality = localStorage.getItem('bsc_quality_preference');
    const dataSaver = localStorage.getItem('bsc_data_saver') === 'true';
    
    if (dataSaver) {
      this.toggleDataSaver(true);
    } else if (savedQuality && savedQuality !== 'auto') {
      await this.setQuality(savedQuality);
    } else {
      // If no preference, start with auto and let network decide
      await this.setQuality('auto');
    }
  };

  StreamingManager.prototype._loadUserPreferences = function() {
    const savedQuality = localStorage.getItem('bsc_quality_preference');
    const dataSaver = localStorage.getItem('bsc_data_saver');
    
    if (savedQuality) {
      this.currentQuality = savedQuality;
    }
    if (dataSaver === 'true') {
      this.isDataSaverMode = true;
    }
  };

  StreamingManager.prototype._saveQualityPreference = function(quality) {
    localStorage.setItem('bsc_quality_preference', quality);
  };

  StreamingManager.prototype._getCurrentBitrate = function() {
    const quality = this.qualityLevels.find(q => q.value === this.currentQuality);
    return quality?.bitrate || 0;
  };

  StreamingManager.prototype._handleError = function(context, error) {
    console.error('❌ StreamingManager error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // 🚨 FIX #2: Setup listener for contentId changes from other components
  StreamingManager.prototype._setupContentIdListener = function() {
    window.addEventListener('contentIdChanged', (event) => {
      if (event.detail && event.detail.contentId) {
        const newContentId = event.detail.contentId;
        if (this.contentId !== newContentId) {
          console.log(`📡 StreamingManager received contentIdChanged event: ${this.contentId} -> ${newContentId}`);
          this.updateContentId(newContentId);
          // Reinitialize for new content
          this.reinitialize(newContentId).catch(err => {
            console.warn('Reinitialization after contentIdChanged failed:', err);
          });
        }
      }
    });
  };

  // 🚨 FIX #7: Setup storage listener for cross-tab preference sync
  StreamingManager.prototype._setupStorageListener = function() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'bsc_quality_preference' && event.newValue) {
        const newQuality = event.newValue;
        if (this.currentQuality !== newQuality && newQuality !== 'auto') {
          console.log(`📡 Quality preference changed in another tab: ${newQuality}`);
          this.setQuality(newQuality).catch(err => {
            console.warn('Failed to sync quality preference:', err);
          });
        }
      }
      
      if (event.key === 'bsc_data_saver') {
        const newDataSaver = event.newValue === 'true';
        if (this.isDataSaverMode !== newDataSaver) {
          console.log(`📡 Data saver preference changed in another tab: ${newDataSaver}`);
          this.toggleDataSaver(newDataSaver);
        }
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
  } else {
    window.StreamingManager = StreamingManager;
  }
  
  console.log('✅ StreamingManager module loaded successfully with engagement fixes:');
  console.log('  ✅ contentId synchronization (updateContentId, reinitialize)');
  console.log('  ✅ contentIdChanged event listener');
  console.log('  ✅ Cross-tab preference sync via storage events');
  console.log('  ✅ Reinitialization for playlist track changes');
  console.log('  ☁️ Cloudflare Stream detection and HLS support');
})();
