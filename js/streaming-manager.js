// js/streaming-manager.js — HLS Streaming & Quality Control Manager
// Bantu Stream Connect — Phase 4 Implementation

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
    
    // Quality levels (for HLS or multi-quality MP4)
    this.qualityLevels = config.qualityLevels || [
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
    this.bufferHealth = 100;
    this.hlsInstance = null;
    
    // Callbacks
    this.onQualityChange = config.onQualityChange || null;
    this.onDataSaverToggle = config.onDataSaverToggle || null;
    this.onError = config.onError || null;
    
    // Load saved preferences
    this._loadUserPreferences();
    
    console.log('✅ StreamingManager initialized');
  }

  // ============================================
  // PUBLIC API
  // ============================================

  StreamingManager.prototype.initialize = async function() {
    // Check if HLS is supported
    if (this._isHLSSupported()) {
      await this._initializeHLS();
    }
    
    // Setup network monitoring
    this._startNetworkMonitoring();
    
    // Apply saved quality preference
    await this._applyQualityPreference();
    
    console.log('✅ StreamingManager fully initialized');
  };

  StreamingManager.prototype.setQuality = async function(quality) {
    if (!this.qualityLevels.find(q => q.value === quality)) {
      console.warn('⚠️ Invalid quality level:', quality);
      return false;
    }
    
    const currentTime = this.video.currentTime;
    const wasPaused = this.video.paused;
    
    this.currentQuality = quality;
    
    // Save preference
    this._saveQualityPreference(quality);
    
    // If HLS, switch quality
    if (this.hlsInstance && quality !== 'auto') {
      const level = this.qualityLevels.findIndex(q => q.value === quality);
      if (level >= 0) {
        this.hlsInstance.currentLevel = level;
      }
    }
    
    // Notify callback
    if (this.onQualityChange) {
      this.onQualityChange({ quality: quality, timestamp: Date.now() });
    }
    
    console.log('📺 Quality changed to:', quality);
    return true;
  };

  StreamingManager.prototype.toggleDataSaver = function(enabled) {
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
    if (this.isDataSaverMode) {
      return this.qualityLevels.filter(q => q.value === '360p' || q.value === 'auto');
    }
    return this.qualityLevels;
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

  StreamingManager.prototype.getBufferHealth = function() {
    return this.bufferHealth;
  };

  StreamingManager.prototype.destroy = function() {
    // Stop network monitoring
    if (this._networkCheckInterval) {
      clearInterval(this._networkCheckInterval);
    }
    
    // Destroy HLS instance
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    
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

  StreamingManager.prototype._initializeHLS = async function() {
    if (!this.contentId) return;
    
    try {
      // Fetch content with HLS manifest URL
      const { data: content } = await this.supabase
        .from('Content')
        .select('hls_manifest_url, quality_profiles')
        .eq('id', this.contentId)
        .single();
      
      if (!content?.hls_manifest_url) {
        console.log('ℹ️ No HLS manifest available, using MP4');
        return;
      }
      
      // Check for HLS.js (for non-Safari browsers)
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        this.hlsInstance.loadSource(content.hls_manifest_url);
        this.hlsInstance.attachMedia(this.video);
        
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest parsed');
          this.video.play().catch(() => {});
        });
        
        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('❌ HLS fatal error:', data);
            this._handleError('hls', data);
          }
        });
        
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        this.video.src = content.hls_manifest_url;
        this.video.addEventListener('loadedmetadata', () => {
          this.video.play().catch(() => {});
        });
      }
      
      // Store quality profiles
      if (content.quality_profiles?.length > 0) {
        this.qualityLevels = content.quality_profiles;
      }
      
    } catch (error) {
      console.error('❌ HLS initialization failed:', error);
      this._handleError('hls_init', error);
    }
  };

  StreamingManager.prototype._startNetworkMonitoring = function() {
    // Check network speed every 30 seconds
    this._networkCheckInterval = setInterval(() => {
      this._measureNetworkSpeed();
    }, 30000);
    
    // Initial check
    this._measureNetworkSpeed();
  };

  StreamingManager.prototype._measureNetworkSpeed = async function() {
    try {
      const startTime = Date.now();
      const testSize = 100000; // 100KB test
      
      // Fetch a small test file (could be a thumbnail)
      const response = await fetch(
        'https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-thumbnails/test.bin?t=' + Date.now(),
        { cache: 'no-store' }
      );
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const speed = (testSize / duration) * 8; // bits per second
      
      this.networkSpeed = speed;
      
      // Auto-adjust quality based on network
      if (this.currentQuality === 'auto' && !this.isDataSaverMode) {
        this._autoAdjustQuality();
      }
      
    } catch (error) {
      console.warn('⚠️ Network speed test failed:', error);
    }
  };

  StreamingManager.prototype._autoAdjustQuality = function() {
    if (!this.networkSpeed) return;
    
    // Bitrate thresholds (bits per second)
    if (this.networkSpeed > 5000000) {
      this.setQuality('1080p');
    } else if (this.networkSpeed > 2500000) {
      this.setQuality('720p');
    } else if (this.networkSpeed > 1000000) {
      this.setQuality('480p');
    } else {
      this.setQuality('360p');
    }
  };

  StreamingManager.prototype._applyQualityPreference = async function() {
    // Load from localStorage
    const savedQuality = localStorage.getItem('bsc_quality_preference');
    const dataSaver = localStorage.getItem('bsc_data_saver') === 'true';
    
    if (dataSaver) {
      this.toggleDataSaver(true);
    } else if (savedQuality) {
      await this.setQuality(savedQuality);
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

  StreamingManager.prototype._handleError = function(context, error) {
    console.error('❌ StreamingManager error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
  } else {
    window.StreamingManager = StreamingManager;
  }
  
  console.log('✅ StreamingManager module loaded successfully');
})();
