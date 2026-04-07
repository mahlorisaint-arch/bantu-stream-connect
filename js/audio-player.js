/**
 * Bantu Audio Player
 * Handles global playback for music/podcasts across the platform.
 * FIXED: Player now properly appears when triggered by Smart Link icons
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
    
    // Expose to global window for Smart Links to trigger
    window.playSmartLink = (url, title, creator, art = '') => this.play(url, title, creator, art);
    window.showAudioPlayer = () => this.show();
    window.hideAudioPlayer = () => this.hide();
    
    console.log('🎵 Audio Player initialized');
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

  play(url, title, creator, art = '') {
    console.log('🎵 Playing:', title, 'by', creator);
    
    // If same track and playing, pause
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    // Set audio source and play
    this.audio.src = url;
    this.audio.play().catch(e => {
      console.warn('Autoplay blocked:', e);
      // Still show player but in paused state
      this.state.playing = false;
    });
    
    this.state = { playing: true, track: { url, title, creator, art } };
    
    // Update UI and SHOW the player
    this.show();
    if (this.ui.title) this.ui.title.textContent = title || 'Track Title';
    if (this.ui.creator) this.ui.creator.textContent = creator || 'Creator';
    if (this.ui.art) this.ui.art.src = art || 'https://via.placeholder.com/40?text=🎵';
    if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    
    // Reset progress bar
    if (this.ui.bar) this.ui.bar.style.width = '0%';
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
      this.audio.play().then(() => {
        this.state.playing = true;
        if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      }).catch(e => console.warn('Play failed:', e));
    }
  },

  previous() {
    // For future playlist functionality
    console.log('Previous track - to be implemented');
  },

  next() {
    // For future playlist functionality
    console.log('Next track - to be implemented');
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BantuAudio.init());
} else {
  BantuAudio.init();
}
