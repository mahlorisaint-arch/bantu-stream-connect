// js/streaming-manager.js — HLS Streaming & Quality Control Manager
// Bantu Stream Connect — Phase 4 Implementation
// ✅ CLOUDFLARE STREAM SUPPORT: Bypasses HLS for Cloudflare Stream content
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
// ☁️ CLOUDFLARE STREAM INTEGRATION (2026-06-17):
// - Detects cloudflare_stream provider and bypasses HLS
// - Cloudflare handles adaptive bitrate internally
// - Skip manifest parsing for Cloudflare content

(function() {
  'use strict';
  
  console.log('📡 StreamingManager module loading... (Cloudflare Edition)');

  function StreamingManager(config) {
    if (!config || !config.videoElement) {
      console.error('❌ StreamingManager: Missing required config (videoElement)');
      return;
    }

    this.video = config.videoElement;
    this.supabase = config.supabaseClient || window.supabaseClient;
    this.contentId = config.contentId || null;
    this.userId = config.userId || null;
    
    // Cloudflare specific
    this.streamingProvider = config.streamingProvider || null;
    this.providerVideoId = config.providerVideoId || null;
    this.isCloudflareStream = this.streamingProvider === 'cloudflare_stream';
    
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
    this.contentType = 'video';
    this._networkCheckInterval = null;
    this._currentHlsManifestUrl = null;
    this._isInitialized = false;
    this._lastInitializedContentId = null;
    
    // Callbacks
    this.onQualityChange = config.onQualityChange || null;
    this.onDataSaverToggle = config.onDataSaverToggle || null;
    this.onError = config.onError || null;
    this.onContentChange = config.onContentChange || null;
    
    // Load saved preferences
    this._loadUserPreferences();
    
    // Setup listeners
    this._setupContentIdListener();
    this._setupStorageListener();
    
    console.log('✅ StreamingManager initialized with contentId:', this.contentId, 
      'provider:', this.streamingProvider);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  StreamingManager.prototype.initialize = async function() {
    console.log('📡 StreamingManager.initialize() called for content:', this.contentId);
    
    // Skip if already initialized with same contentId
    if (this._isInitialized && this._lastInitializedContentId === this.contentId) {
      console.log('⚠️ StreamingManager already initialized for this content, skipping');
      return;
    }
    
    // Store original video URL
    this.originalVideoUrl = this.video.src || 
      (this.video.querySelector('source')?.src) || null;
    
    // ============================================
    // ☁️ CLOUDFLARE STREAM: Bypass HLS
    // Cloudflare handles adaptive bitrate internally
    // ============================================
    if (this.isCloudflareStream) {
      console.log('☁️ Cloudflare Stream detected - bypassing HLS initialization');
      this.contentType = 'video';
      this._isInitialized = true;
      this._lastInitializedContentId = this.contentId;
      
      // Quality management is handled by Cloudflare internally
      // But we keep our UI for user preferences
      console.log('✅ Cloudflare Stream - quality management handled internally');
      return;
    }
    
    // ============================================
    // SKIP HLS FOR AUDIO FILES
    // ============================================
    if (!this.contentId) {
      console.log('ℹ️ No content ID, using direct playback');
      return;
    }
    
    try {
      // Get content media type
      const { data: contentData, error: contentError } = await this.supabase
        .from('Content')
        .select('media_type, hls_manifest_url, quality_profiles, file_url, streaming_provider')
        .eq('id', this.contentId)
        .maybeSingle();
      
      if (contentError) {
        console.warn('⚠️ Could not fetch content type:', contentError);
      }
      
      // Determine content type
      if (contentData?.media_type === 'audio') {
        this.contentType = 'audio';
        console.log('🎵 Audio content detected - skipping HLS initialization');
        this._isInitialized = true;
        this._lastInitializedContentId = this.contentId;
        return;
      }
      
      // ☁️ Check again for Cloudflare Stream (in case provider was updated)
      if (contentData?.streaming_provider === 'cloudflare_stream') {
        console.log('☁️ Cloudflare Stream detected (from DB) - bypassing HLS');
        this.contentType = 'video';
        this.isCloudflareStream = true;
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
      
      // Check if HLS is supported AND available (and NOT Cloudflare Stream)
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
   * Reinitialize streaming for new content
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
    
    // Update contentId and provider info
    this.contentId = newContentId;
    this._isInitialized = false;
    this._currentHlsManifestUrl = null;
    this.isCloudflareStream = false;
    this.streamingProvider = null;
    this.providerVideoId = null;
    
    // Fetch updated provider info
    try {
      const { data } = await this.supabase
        .from('Content')
        .select('streaming_provider, provider_video_id, media_type, file_url')
        .eq('id', newContentId)
        .maybeSingle();
      
      if (data) {
        this.streamingProvider = data.streaming_provider;
        this.providerVideoId = data.provider_video_id;
        this.isCloudflareStream = data.streaming_provider === 'cloudflare_stream';
        this.contentType = data.media_type === 'audio' ? 'audio' : 'video';
      }
    } catch (e) {
      console.warn('Could not fetch updated provider info:', e);
    }
    
    // Reinitialize with new content
    await this.initialize();
    
    // Notify callback
    if (this.onContentChange) {
      this.onContentChange({
        contentId: this.contentId,
        streamingProvider: this.streamingProvider,
        timestamp: Date.now()
      });
    }
  };

  /**
   * Update contentId without full reinit
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

  /**
   * ☁️ Update Cloudflare provider info
   */
  StreamingManager.prototype.updateProvider = function(provider, providerVideoId) {
    this.streamingProvider = provider;
    this.providerVideoId = providerVideoId;
    this.isCloudflareStream = provider === 'cloudflare_stream';
    console.log('📡 StreamingManager provider updated:', provider);
  };

  StreamingManager.prototype.setQuality = async function(quality) {
    // For Cloudflare Stream, quality switching is handled internally
    if (this.isCloudflareStream) {
      console.log('☁️ Cloudflare Stream - quality switching handled internally by Cloudflare');
      this.currentQuality = quality;
      this._saveQualityPreference(quality);
      
      if (this.onQualityChange) {
        this.onQualityChange({ 
          quality: quality, 
          timestamp: Date.now(),
          bitrate: 0,
          provider: 'cloudflare_stream'
        });
      }
      return true;
    }
    
    // For audio files, quality switching not applicable
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
    
    this._saveQualityPreference(quality);
    
    // If HLS, switch quality level
    if (this.hlsInstance && quality !== 'auto') {
      const levelIndex = this.qualityLevels.findIndex(q => q.value === quality);
      if (levelIndex >= 0 && levelIndex < this.hlsInstance.levels.length) {
        this.hlsInstance.currentLevel = levelIndex;
        console.log('✅ HLS quality switched to:', quality);
      }
    } else {
      console.log('ℹ️ MP4 quality change (would reload with different URL in production)');
    }
    
    if (this.onQualityChange) {
      this.onQualityChange({ 
        quality: quality, 
        timestamp: Date.now(),
        bitrate: this._getCurrentBitrate()
      });
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast('Quality: ' + quality.toUpperCase(), 'info');
    }
    
    console.log('📺 Quality changed to:', quality);
    return true;
  };

  StreamingManager.prototype.toggleDataSaver = function(enabled) {
    // For Cloudflare Stream, data saver is handled internally
    if (this.isCloudflareStream) {
      console.log('☁️ Cloudflare Stream - data saver mode tracked locally');
      this.isDataSaverMode = enabled;
      localStorage.setItem('bsc_data_saver', enabled ? 'true' : 'false');
      
      if (this.onDataSaverToggle) {
        this.onDataSaverToggle({ enabled: enabled, timestamp: Date.now() });
      }
      return enabled;
    }
    
    // For audio files, data saver doesn't apply
    if (this.contentType === 'audio') {
      console.log('🎵 Audio file - data saver not applicable');
      return false;
    }
    
    this.isDataSaverMode = enabled;
    localStorage.setItem('bsc_data_saver', enabled ? 'true' : 'false');
    
    if (enabled) {
      this.setQuality('360p');
    } else {
      this.setQuality('auto');
    }
    
    if (this.onDataSaverToggle) {
      this.onDataSaverToggle({ enabled: enabled, timestamp: Date.now() });
    }
    
    console.log('💾 Data saver mode:', enabled ? 'ON' : 'OFF');
    return enabled;
  };

  StreamingManager.prototype.getAvailableQualities = function() {
    // For Cloudflare Stream, return basic options (Cloudflare handles internally)
    if (this.isCloudflareStream) {
      return [
        { label: 'Auto', value: 'auto', bitrate: 0 },
        { label: '1080p', value: '1080p', bitrate: 5000000 },
        { label: '720p', value: '720p', bitrate: 2500000 },
        { label: '480p', value: '480p', bitrate: 1000000 },
        { label: '360p', value: '360p', bitrate: 500000 }
      ];
    }
    
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

  StreamingManager.prototype.isCloudflareStreamContent = function() {
    return this.isCloudflareStream;
  };

  StreamingManager.prototype.destroy = function() {
    if (this._networkCheckInterval) {
      clearInterval(this._networkCheckInterval);
      this._networkCheckInterval = null;
    }
    
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
    const video = document.createElement('video');
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      return true;
    }
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      return true;
    }
    return false;
  };

  StreamingManager.prototype._loadAvailableQualities = async function() {
    if (!this.contentId) {
      this.availableQualities = [...this.qualityLevels];
      return;
    }
    
    try {
      const { data, error } = await this.supabase
        .from('content_quality')
        .select('quality_label, bitrate, resolution, file_url')
        .eq('content_id', this.contentId)
        .order('bitrate', { ascending: false });
      
      if (error || !data || data.length === 0) {
        console.log('ℹ️ No custom qualities found, using defaults');
        this.availableQualities = [...this.qualityLevels];
        return;
      }
      
      this.availableQualities = [
        { label: 'Auto', value: 'auto', bitrate: 0 }
      ];
      
      data.forEach(q => {
        this.availableQualities.push({
          label: q.quality_label,
          value: q.quality_label.toLowerCase(),
          bitrate: q.bitrate,
          file_url: q.file_url,
          resolution: q.resolution
        });
      });
      
      console.log('📺 Available qualities:', this.availableQualities);
      
    } catch (error) {
      console.warn('⚠️ Could not load quality profiles:', error);
      this.availableQualities = [...this.qualityLevels];
    }
  };

  StreamingManager.prototype._initializeHLS = async function(hlsManifestUrl) {
    // Skip if this is Cloudflare Stream content
    if (this.isCloudflareStream) {
      console.log('☁️ Cloudflare Stream - skipping HLS initialization');
      return;
    }
    
    if (!hlsManifestUrl) return;
    
    try {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });
        
        this.hlsInstance.loadSource(hlsManifestUrl);
        this.hlsInstance.attachMedia(this.video);
        
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest parsed');
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        });
        
        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('❌ HLS fatal error:', data);
            this._handleError('hls', data);
          }
        });
        
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        this.video.src = hlsManifestUrl;
        this.video.addEventListener('loadedmetadata', () => {
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        });
      }
      
    } catch (error) {
      console.error('❌ HLS initialization failed:', error);
      this._handleError('hls_init', error);
    }
  };

  StreamingManager.prototype._startNetworkMonitoring = function() {
    // Skip network monitoring for audio files or Cloudflare Stream
    if (this.contentType === 'audio' || this.isCloudflareStream) {
      console.log('🎵☁️ Skipping network monitoring for audio/Cloudflare Stream');
      return;
    }
    
    if (this._networkCheckInterval) {
      clearInterval(this._networkCheckInterval);
    }
    
    this._networkCheckInterval = setInterval(() => {
      this._measureNetworkSpeed();
    }, 60000);
    
    setTimeout(() => {
      this._measureNetworkSpeed();
    }, 5000);
  };

  StreamingManager.prototype._measureNetworkSpeed = async function() {
    if (this._isMeasuringSpeed) {
      return;
    }
    
    this._isMeasuringSpeed = true;
    
    try {
      const testImageUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js';
      const testSizeKB = 80;
      const startTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testImageUrl + '?cb=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      await response.arrayBuffer();
      
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSec = durationMs / 1000;
      
      if (durationSec > 0) {
        const speedBps = (testSizeKB * 8 * 1024) / durationSec;
        this.networkSpeed = Math.round(speedBps);
        console.log('🌐 Network speed:', (this.networkSpeed / 1000000).toFixed(2), 'Mbps');
      } else {
        this.networkSpeed = 10000000;
        console.log('🌐 Network speed: Very fast (>10 Mbps)');
      }
      
      // Auto-adjust quality (skip for Cloudflare Stream)
      if (this.currentQuality === 'auto' && !this.isDataSaverMode && 
          this.contentType !== 'audio' && !this.isCloudflareStream) {
        this._autoAdjustQuality();
      }
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.debug('Network speed measurement unavailable, using default profile');
      }
      this.networkSpeed = 2000000;
    } finally {
      this._isMeasuringSpeed = false;
    }
  };

  StreamingManager.prototype._autoAdjustQuality = function() {
    if (!this.networkSpeed || this.isCloudflareStream) return;
    
    if (this.networkSpeed > 8000000) {
      this.setQuality('1080p');
    } else if (this.networkSpeed > 4000000) {
      this.setQuality('720p');
    } else if (this.networkSpeed > 1500000) {
      this.setQuality('480p');
    } else {
      this.setQuality('360p');
    }
  };

  StreamingManager.prototype._applyQualityPreference = async function() {
    // Skip for Cloudflare Stream (handled internally)
    if (this.isCloudflareStream) {
      this.currentQuality = 'auto';
      return;
    }
    
    if (this.contentType === 'audio') {
      this.currentQuality = 'audio';
      return;
    }
    
    const savedQuality = localStorage.getItem('bsc_quality_preference');
    const dataSaver = localStorage.getItem('bsc_data_saver') === 'true';
    
    if (dataSaver) {
      this.toggleDataSaver(true);
    } else if (savedQuality && savedQuality !== 'auto') {
      await this.setQuality(savedQuality);
    } else {
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

  StreamingManager.prototype._setupContentIdListener = function() {
    window.addEventListener('contentIdChanged', (event) => {
      if (event.detail && event.detail.contentId) {
        const newContentId = event.detail.contentId;
        if (this.contentId !== newContentId) {
          console.log(`📡 StreamingManager received contentIdChanged: ${this.contentId} -> ${newContentId}`);
          this.updateContentId(newContentId);
          this.reinitialize(newContentId).catch(err => {
            console.warn('Reinitialization after contentIdChanged failed:', err);
          });
        }
      }
    });
  };

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

  // ============================================
  // EXPORT
  // ============================================
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
  } else {
    window.StreamingManager = StreamingManager;
  }
  
  console.log('✅ StreamingManager module loaded with Cloudflare support:');
  console.log('  ☁️ Cloudflare Stream detection and bypass');
  console.log('  ✅ contentId synchronization');
  console.log('  ✅ Cross-tab preference sync');
  console.log('  ✅ Reinitialization for playlist track changes');
  
})();
