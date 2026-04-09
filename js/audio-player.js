/**
 * Bantu Audio Player
 * Handles global playback for music/podcasts across the platform.
 * FIXED: Player now properly appears when triggered by Smart Link icons
 * FIXED: Added preload='none' to prevent unnecessary video/audio preloading
 */
const BantuAudio = {
  audio: new Audio(),
  state: {
    playing: false,
    track: null
  },

  init() {
    // Setup UI
    this.ui = {
      container: document.getElementById('global-audio-player'),
      playBtn: document.getElementById('player-play-pause'),
      prevBtn: document.getElementById('player-prev'),
      nextBtn: document.getElementById('player-next'),
      title: document.getElementById('player-title'),
      creator: document.getElementById('player-creator'),
      art: document.getElementById('player-art'),
      bar: document.getElementById('player-bar')
    };

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

    // ============================================
    // CRITICAL PERFORMANCE FIX: Prevent auto-preloading
    // ============================================
    // This prevents the browser from downloading audio/video until needed
    this.audio.preload = 'none';
    
    // Also set crossOrigin for CORS support if needed
    this.audio.crossOrigin = 'anonymous';
    
    console.log('🎵 Audio Player initialized with preload="none" (performance optimized)');

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration && this.ui.bar) {
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        this.ui.bar.style.width = `${pct}%`;
      }
    });

    this.audio.addEventListener('ended', () => this.pause());
    
    // Add click handler for progress bar seeking
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
    
    // Add error handling for audio loading issues
    this.audio.addEventListener('error', (e) => {
      console.warn('🎵 Audio error:', e);
      this.pause();
      if (typeof window.showToast === 'function') {
        window.showToast('Unable to play audio. Please try again.', 'error');
      }
    });
    
    // Add canplay event to ensure smooth playback
    this.audio.addEventListener('canplay', () => {
      console.log('🎵 Audio ready to play');
    });
    
    // Expose to global window for Smart Links to trigger
    window.playSmartLink = (url, title, creator, art = '') => this.play(url, title, creator, art);
    window.showAudioPlayer = () => this.show();
    window.hideAudioPlayer = () => this.hide();
    
    console.log('🎵 Audio Player initialization complete');
  },

  show() {
    if (this.ui.container) {
      this.ui.container.classList.remove('hidden');
      // Add slide-in animation class for better UX
      this.ui.container.style.animation = 'slideUp 0.3s ease';
    }
  },

  hide() {
    if (this.ui.container) {
      this.ui.container.classList.add('hidden');
    }
  },

  play(url, title, creator, art = '') {
    console.log('🎵 Playing:', title, 'by', creator);
    
    // If same track and playing, pause
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    // Set audio source - preload is already 'none' from init
    this.audio.src = url;
    
    // Load metadata only (not full preload)
    this.audio.load(); // This respects preload='none' - only loads metadata
    
    // Attempt to play
    const playPromise = this.audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.state = { playing: true, track: { url, title, creator, art } };
        this.updateUI();
      }).catch(e => {
        console.warn('Autoplay blocked or play failed:', e);
        // Still show player but in paused state
        this.state = { playing: false, track: { url, title, creator, art } };
        this.updateUI();
        // User will need to click play manually
        if (typeof window.showToast === 'function') {
          window.showToast('Click play to start audio', 'info');
        }
      });
    } else {
      // Fallback for older browsers
      this.state = { playing: true, track: { url, title, creator, art } };
      this.updateUI();
    }
    
    // Always show the player
    this.show();
  },
  
  updateUI() {
    // Update UI with track info
    if (this.ui.title && this.state.track) {
      this.ui.title.textContent = this.state.track.title || 'Track Title';
    }
    if (this.ui.creator && this.state.track) {
      this.ui.creator.textContent = this.state.track.creator || 'Creator';
    }
    if (this.ui.art && this.state.track) {
      this.ui.art.src = this.state.track.art || 'https://via.placeholder.com/40?text=🎵';
      this.ui.art.alt = this.state.track.title || 'Album art';
    }
    if (this.ui.playBtn) {
      this.ui.playBtn.innerHTML = this.state.playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }
    
    // Reset progress bar
    if (this.ui.bar) {
      this.ui.bar.style.width = '0%';
    }
  },

  pause() {
    this.audio.pause();
    this.state.playing = false;
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
        }).catch(e => {
          console.warn('Play failed:', e);
          if (typeof window.showToast === 'function') {
            window.showToast('Unable to play audio', 'error');
          }
        });
      } else {
        // Fallback for older browsers
        this.audio.play();
        this.state.playing = true;
        if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      }
    }
  },

  previous() {
    // For future playlist functionality
    console.log('Previous track - to be implemented');
    if (typeof window.showToast === 'function') {
      window.showToast('Playlist feature coming soon', 'info');
    }
  },

  next() {
    // For future playlist functionality
    console.log('Next track - to be implemented');
    if (typeof window.showToast === 'function') {
      window.showToast('Playlist feature coming soon', 'info');
    }
  },
  
  // Helper method to check if player is currently showing
  isVisible() {
    return this.ui.container && !this.ui.container.classList.contains('hidden');
  },
  
  // Helper method to get current track info
  getCurrentTrack() {
    return this.state.track;
  },
  
  // Helper method to set volume
  setVolume(volume) {
    if (volume >= 0 && volume <= 1) {
      this.audio.volume = volume;
      console.log('🎵 Volume set to:', volume);
    }
  },
  
  // Helper method to get current volume
  getVolume() {
    return this.audio.volume;
  },
  
  // Helper method to mute/unmute
  setMuted(muted) {
    this.audio.muted = muted;
    console.log('🎵 Muted:', muted);
  }
};

// Add CSS animation keyframes if not already present
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BantuAudio.init());
} else {
  BantuAudio.init();
}

// Export for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BantuAudio;
}
