/**
 * Bantu Audio Player - Glassmorphism Edition with View Tracking
 * Handles global playback for music/podcasts across the platform.
 * UPDATES: Glassmorphism UI, close button, thumbnail fix, 15-second view recording
 */
const BantuAudio = {
  audio: new Audio(),
  state: {
    playing: false,
    track: null,
    viewRecorded: false,      // Prevents duplicate view records
    viewTimer: null,          // Timer for 15-second view tracking
    contentId: null,          // Store content_id for RPC call
    sessionId: null           // Unique session per playback
  },

  // Supabase client (must be initialized by your app, or set via setSupabaseClient)
  supabase: null,

  init(supabaseClient = null) {
    // Setup UI
    this.ui = {
      container: document.getElementById('global-audio-player'),
      playBtn: document.getElementById('player-play-pause'),
      prevBtn: document.getElementById('player-prev'),
      nextBtn: document.getElementById('player-next'),
      title: document.getElementById('player-title'),
      creator: document.getElementById('player-creator'),
      art: document.getElementById('player-art'),
      bar: document.getElementById('player-bar'),
      closeBtn: document.getElementById('player-close-btn')  // NEW
    };

    // Store supabase client reference
    if (supabaseClient) this.supabase = supabaseClient;

    // Hide player initially
    if (this.ui.container) {
      this.ui.container.classList.add('hidden');
    }

    // Setup Events
    if (this.ui.playBtn) {
      this.ui.playBtn.addEventListener('click', () => this.toggle());
    }

    if (this.ui.prevBtn) {
      this.ui.prevBtn.addEventListener('click', () => this.previous());
    }

    if (this.ui.nextBtn) {
      this.ui.nextBtn.addEventListener('click', () => this.next());
    }

    // NEW: Close button functionality
    if (this.ui.closeBtn) {
      this.ui.closeBtn.addEventListener('click', () => this.closeAndReset());
    }

    // Performance: prevent auto-preloading
    this.audio.preload = 'none';
    this.audio.crossOrigin = 'anonymous';

    // Progress bar update
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration && this.ui.bar) {
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        this.ui.bar.style.width = `${pct}%`;
      }
      
      // View tracking: record after 15 seconds of continuous playback
      this.checkAndRecordView();
    });

    this.audio.addEventListener('ended', () => {
      this.pause();
      // Reset view flag for next track
      this.resetViewTracking();
    });

    this.audio.addEventListener('play', () => {
      // Start fresh view timer when playback begins
      this.resetViewTracking();
      this.startViewTimer();
    });

    this.audio.addEventListener('pause', () => {
      this.clearViewTimer();
    });

    // Progress bar seeking click
    if (this.ui.container) {
      const progressBar = this.ui.container.querySelector('.player-progress');
      if (progressBar) {
        progressBar.addEventListener('click', (e) => {
          const rect = progressBar.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const width = rect.width;
          const percentage = x / width;
          if (this.audio.duration) {
            this.audio.currentTime = percentage * this.audio.duration;
          }
        });
      }
    }

    // Error handling
    this.audio.addEventListener('error', (e) => {
      console.warn('🎵 Audio error:', e);
      this.pause();
      if (typeof window.showToast === 'function') {
        window.showToast('Unable to play audio. Please try again.', 'error');
      }
    });

    // Expose to global window
    window.playSmartLink = (url, title, creator, art = '', contentId = null) => 
      this.play(url, title, creator, art, contentId);
    window.showAudioPlayer = () => this.show();
    window.hideAudioPlayer = () => this.hide();
    
    console.log('🎵 Audio Player initialized with glassmorphism, close button & view tracking');
  },

  // Set Supabase client after init (if needed)
  setSupabaseClient(client) {
    this.supabase = client;
  },

  show() {
    if (this.ui.container) {
      this.ui.container.classList.remove('hidden');
    }
  },

  hide() {
    if (this.ui.container) {
      this.ui.container.classList.add('hidden');
    }
  },

  // NEW: Close and fully reset player (stops audio, resets state)
  closeAndReset() {
    this.stop();                    // Stop audio and reset view timers
    this.hide();                   // Hide the player UI
    this.state.track = null;       // Clear track info
    this.state.viewRecorded = false;
    this.state.contentId = null;
    this.updateUI();               // Clear UI display
  },

  // Stop audio and cleanup timers without resetting track display (used internally)
  stop() {
    if (this.state.playing) {
      this.audio.pause();
      this.state.playing = false;
      if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    this.clearViewTimer();
    // Reset audio source to stop network activity
    this.audio.src = '';
    this.audio.load();
  },

  play(url, title, creator, art = '', contentId = null) {
    console.log('🎵 Playing:', title, 'by', creator, 'contentId:', contentId);
    
    // If same track and playing, pause
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    // Stop current playback and clear timers before loading new track
    if (this.state.playing) {
      this.audio.pause();
    }
    this.clearViewTimer();
    this.state.viewRecorded = false;
    
    // Store content ID for view tracking
    this.state.contentId = contentId;
    
    // Generate unique session ID for this playback session
    this.state.sessionId = this.generateSessionId();
    
    // Set audio source
    this.audio.src = url;
    this.audio.load();
    
    // Update track state BEFORE play attempt
    this.state.track = { url, title, creator, art, contentId };
    this.updateUI();
    
    // Attempt to play
    const playPromise = this.audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.state.playing = true;
        this.updateUI();
        // Start 15-second view timer
        this.startViewTimer();
      }).catch(e => {
        console.warn('Autoplay blocked:', e);
        this.state.playing = false;
        this.updateUI();
        if (typeof window.showToast === 'function') {
          window.showToast('Click play to start audio', 'info');
        }
      });
    } else {
      this.state.playing = true;
      this.updateUI();
      this.startViewTimer();
    }
    
    this.show();
  },
  
  updateUI() {
    // Update track info with proper thumbnail handling
    if (this.ui.title && this.state.track) {
      this.ui.title.textContent = this.state.track.title || 'Untitled Track';
    }
    if (this.ui.creator && this.state.track) {
      this.ui.creator.textContent = this.state.track.creator || 'Unknown Artist';
    }
    
    // FIXED: Thumbnail now properly displays the correct image or fallback
    if (this.ui.art && this.state.track) {
      const artUrl = this.state.track.art;
      // Only set if valid URL, otherwise use clean placeholder
      if (artUrl && artUrl !== '' && artUrl !== '#' && !artUrl.includes('placeholder')) {
        this.ui.art.src = artUrl;
        this.ui.art.alt = this.state.track.title || 'Album art';
        // Ensure image loads, fallback on error
        this.ui.art.onerror = () => {
          this.ui.art.src = 'https://placehold.co/400x400/1e293b/f59e0b?text=🎵';
        };
      } else {
        // Use styled placeholder that looks good
        this.ui.art.src = 'https://placehold.co/400x400/1e293b/f59e0b?text=🎵';
        this.ui.art.alt = 'Audio thumbnail';
      }
    }
    
    if (this.ui.playBtn) {
      this.ui.playBtn.innerHTML = this.state.playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }
    
    if (this.ui.bar) {
      this.ui.bar.style.width = '0%';
    }
  },

  pause() {
    this.audio.pause();
    this.state.playing = false;
    this.clearViewTimer();
    if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-play"></i>';
  },

  toggle() {
    if (this.state.playing) {
      this.pause();
    } else {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.state.playing = true;
          if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
          this.startViewTimer();
        }).catch(e => {
          console.warn('Play failed:', e);
          if (typeof window.showToast === 'function') {
            window.showToast('Unable to play audio', 'error');
          }
        });
      } else {
        this.audio.play();
        this.state.playing = true;
        if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.startViewTimer();
      }
    }
  },

  // ========== VIEW TRACKING (15 seconds + RPC to content_views) ==========
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  },

  startViewTimer() {
    this.clearViewTimer(); // Clear any existing timer
    if (!this.state.contentId) {
      console.log('⏭️ No contentId provided, skipping view tracking');
      return;
    }
    
    this.state.viewTimer = setTimeout(() => {
      this.recordView();
    }, 15000); // 15 seconds
  },

  clearViewTimer() {
    if (this.state.viewTimer) {
      clearTimeout(this.state.viewTimer);
      this.state.viewTimer = null;
    }
  },

  checkAndRecordView() {
    // This gets called on timeupdate, but we only record once via timer.
    // The timer handles the 15-second mark independently.
    // Additional safeguard: if currentTime >= 15 and not recorded, record (backup)
    if (!this.state.viewRecorded && this.state.contentId && this.audio.currentTime >= 15) {
      this.recordView();
    }
  },

  async recordView() {
    if (this.state.viewRecorded) return;
    if (!this.state.contentId) {
      console.warn('⚠️ Cannot record view: missing content_id');
      return;
    }
    
    this.state.viewRecorded = true;
    this.clearViewTimer();
    
    // Get viewer info from session if available (adjust according to your auth system)
    const viewerId = this.getCurrentUserId();     // override with your user ID getter
    const profileId = viewerId;
    const deviceType = this.getDeviceType();
    const sessionId = this.state.sessionId;
    
    // Call RPC or insert directly using Supabase
    if (!this.supabase) {
      console.warn('⚠️ Supabase client not set. View not recorded. Call BantuAudio.setSupabaseClient()');
      return;
    }
    
    // Insert view record using Supabase client (RPC or direct insert)
    // Option 1: Direct insert (simpler, matches schema)
    const viewRecord = {
      content_id: parseInt(this.state.contentId, 10) || this.state.contentId,
      viewer_id: viewerId,
      view_duration: Math.floor(this.audio.currentTime || 15),
      device_type: deviceType,
      session_id: sessionId,
      user_id: viewerId,           // if viewer matches auth user
      creator_id: null,            // can be populated from content metadata
      counted_as_view: true,
      completed_at: null
    };
    
    try {
      const { data, error } = await this.supabase
        .from('content_views')
        .insert([viewRecord])
        .select();
      
      if (error) {
        console.error('❌ Failed to record view:', error);
      } else {
        console.log('✅ View recorded for content:', this.state.contentId, 'after 15+ seconds', data);
        if (typeof window.showToast === 'function') {
          // Optional subtle notification
          // window.showToast('View recorded', 'info');
        }
      }
    } catch (err) {
      console.error('❌ View recording error:', err);
    }
  },

  resetViewTracking() {
    this.state.viewRecorded = false;
    this.clearViewTimer();
  },

  // Helper: get current user ID from your auth system (override as needed)
  getCurrentUserId() {
    // Example: if you store user in window or localStorage, adjust here
    if (window.currentUserId) return window.currentUserId;
    if (localStorage.getItem('userId')) return localStorage.getItem('userId');
    return null; // anonymous viewing
  },

  getDeviceType() {
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  },

  previous() {
    console.log('Previous track - to be implemented');
    if (typeof window.showToast === 'function') {
      window.showToast('Playlist feature coming soon', 'info');
    }
  },

  next() {
    console.log('Next track - to be implemented');
    if (typeof window.showToast === 'function') {
      window.showToast('Playlist feature coming soon', 'info');
    }
  },

  isVisible() {
    return this.ui.container && !this.ui.container.classList.contains('hidden');
  },

  getCurrentTrack() {
    return this.state.track;
  },

  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.audio.volume = volume;
    }
  },

  getVolume() {
    return this.audio.volume;
  },

  setMuted(muted) {
    this.audio.muted = muted;
  }
};

// Add CSS animations if missing
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
if (!document.querySelector('#audio-player-styles')) {
  style.id = 'audio-player-styles';
  document.head.appendChild(style);
}

// Initialize when DOM ready (without supabase initially, can be set later)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BantuAudio.init());
} else {
  BantuAudio.init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BantuAudio;
}
