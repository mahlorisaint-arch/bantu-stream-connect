// js/streaming-manager.js — HLS Streaming & Quality Control Manager
// Bantu Stream Connect — Phase 4 Implementation
// ✅ FIXED: Network speed test uses public endpoint, HLS integration complete

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
    this.availableQualities = [];
    this.currentBitrate = 0;
    
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
    // Load available qualities from database
    await this._loadAvailableQualities();
    
    // Check if HLS is supported and manifest exists
    if (this._isHLSSupported()) {
      await this._initializeHLS();
    }
    
    // Setup network monitoring (less aggressive - every 60s)
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
      const levelIndex = this.qualityLevels.findIndex(q => q.value === quality);
      if (levelIndex >= 0 && levelIndex < this.hlsInstance.levels.length) {
        this.hlsInstance.currentLevel = levelIndex;
        console.log('📺 HLS quality switched to:', quality);
      }
    }
    
    // For MP4, we'd need to reload with different URL (implement if needed)
    if (!this.hlsInstance && quality !== 'auto') {
      await this._switchQualityMP4(quality);
    }
    
    // Notify callback
    if (this.onQualityChange) {
      this.onQualityChange({ 
        quality: quality, 
        timestamp: Date.now(),
        bitrate: this.currentBitrate
      });
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
    return this.availableQualities.length > 0 ? this.availableQualities : this.qualityLevels;
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
      this._networkCheckInterval = null;
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

  StreamingManager.prototype._loadAvailableQualities = async function() {
    if (!this.contentId) return;
    
    try {
      const { data, error } = await this.supabase
        .from('content_quality')
        .select('quality_label, bitrate, resolution')
        .eq('content_id', this.contentId)
        .order('bitrate', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        this.availableQualities = data.map(q => ({
          label: q.quality_label,
          value: q.quality_label.toLowerCase(),
          bitrate: q.bitrate
        }));
        
        // Add Auto option
        this.availableQualities.unshift({ 
          label: 'Auto', 
          value: 'auto', 
          bitrate: 0 
        });
        
        console.log('📺 Available qualities:', this.availableQualities);
      }
    } catch (error) {
      console.warn('⚠️ Could not load quality profiles:', error);
    }
  };

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
      const { data: content, error } = await this.supabase
        .from('Content')
        .select('hls_manifest_url, quality_profiles, file_url')
        .eq('id', this.contentId)
        .single();
      
      if (error) throw error;
      
      // Check if HLS manifest exists
      if (!content?.hls_manifest_url) {
        console.log('ℹ️ No HLS manifest available, using MP4');
        return;
      }
      
      // Check for HLS.js (for non-Safari browsers)
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // Auto-select
          capLevelToPlayerSize: true
        });
        
        this.hlsInstance.loadSource(content.hls_manifest_url);
        this.hlsInstance.attachMedia(this.video);
        
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('✅ HLS manifest parsed', data);
          
          // Update available qualities from manifest
          if (data.levels && data.levels.length > 0) {
            this.availableQualities = data.levels.map((level, index) => ({
              label: this._getQualityLabel(level.height),
              value: this._getQualityLabel(level.height).toLowerCase(),
              bitrate: level.bitrate,
              height: level.height
            }));
            
            this.availableQualities.unshift({ 
              label: 'Auto', 
              value: 'auto', 
              bitrate: 0 
            });
          }
          
          // Auto-play if not paused
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        });
        
        this.hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = this.hlsInstance.levels[data.level];
          this.currentBitrate = level.bitrate;
          console.log('📺 Quality level switched:', this._getQualityLabel(level.height));
        });
        
        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('❌ HLS fatal error:', data);
            this._handleError('hls', data);
            
            // Try to recover
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                this.hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                this.hlsInstance.recoverMediaError();
                break;
              default:
                this._handleError('hls_unrecoverable', data);
                break;
            }
          }
        });
        
        console.log('✅ HLS.js initialized');
        
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        this.video.src = content.hls_manifest_url;
        this.video.addEventListener('loadedmetadata', () => {
          console.log('✅ Native HLS loaded');
          this.video.play().catch(() => {});
        });
      }
      
      // Store quality profiles from database
      if (content.quality_profiles?.length > 0) {
        this.qualityLevels = content.quality_profiles;
      }
      
    } catch (error) {
      console.error('❌ HLS initialization failed:', error);
      this._handleError('hls_init', error);
    }
  };

  StreamingManager.prototype._getQualityLabel = function(height) {
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    return '360p';
  };

  StreamingManager.prototype._switchQualityMP4 = async function(quality) {
    // For MP4 files, we need to reload with different URL
    // This is a simplified version - implement based on your storage structure
    if (!this.contentId) return;
    
    try {
      const { data } = await this.supabase
        .from('content_quality')
        .select('file_url')
        .eq('content_id', this.contentId)
        .eq('quality_label', quality.toUpperCase())
        .single();
      
      if (data?.file_url) {
        const currentTime = this.video.currentTime;
        const wasPaused = this.video.paused;
        
        this.video.src = data.file_url;
        this.video.currentTime = currentTime;
        
        if (!wasPaused) {
          await this.video.play();
        }
        
        console.log('📺 MP4 quality switched to:', quality);
      }
    } catch (error) {
      console.warn('⚠️ Could not switch MP4 quality:', error);
    }
  };

  StreamingManager.prototype._startNetworkMonitoring = function() {
    // Check network speed every 60 seconds (not 30) to reduce requests
    this._networkCheckInterval = setInterval(() => {
      this._measureNetworkSpeed();
    }, 60000); // 60 seconds
    
    // Initial check after a short delay
    setTimeout(() => {
      this._measureNetworkSpeed();
    }, 5000);
  };

  StreamingManager.prototype._measureNetworkSpeed = async function() {
    try {
      const startTime = Date.now();
      
      // Use a small, reliable endpoint for testing
      // Using a 1KB test file from a CDN (no auth required)
      const testUrl = 'https://httpbin.org/bytes/1024?t=' + Date.now();
      
      const response = await fetch(testUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error('Network test failed');
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const bytesLoaded = 1024; // 1KB
      const bitsLoaded = bytesLoaded * 8;
      const speedBps = bitsLoaded / duration;
      
      this.networkSpeed = speedBps;
      
      console.log('🌐 Network speed:', (speedBps / 1000000).toFixed(2), 'Mbps');
      
      // Auto-adjust quality based on network (if in auto mode)
      if (this.currentQuality === 'auto' && !this.isDataSaverMode) {
        this._autoAdjustQuality();
      }
      
    } catch (error) {
      // Fail silently — don't spam console
      this.networkSpeed = 2000000; // Default to 2 Mbps on error
      console.warn('⚠️ Network speed test failed, using default');
    }
  };

  StreamingManager.prototype._autoAdjustQuality = function() {
    if (!this.networkSpeed) return;
    
    // Bitrate thresholds (bits per second)
    // Add 20% buffer for stability
    const targetBitrate = this.networkSpeed * 0.8;
    
    if (targetBitrate > 5000000) {
      this.setQuality('1080p');
    } else if (targetBitrate > 2500000) {
      this.setQuality('720p');
    } else if (targetBitrate > 1000000) {
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
