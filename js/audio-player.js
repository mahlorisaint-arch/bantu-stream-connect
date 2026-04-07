/**
 * Bantu Audio Player
 * Handles global playback for music/podcasts across the platform.
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
      title: document.getElementById('player-title'),
      creator: document.getElementById('player-creator'),
      art: document.getElementById('player-art'),
      bar: document.getElementById('player-bar')
    };

    // Setup Events
    if (this.ui.playBtn) {
      this.ui.playBtn.addEventListener('click', () => this.toggle());
    }

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration) {
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        this.ui.bar.style.width = `${pct}%`;
      }
    });

    this.audio.addEventListener('ended', () => this.pause());
    
    // Expose to global window for Smart Links to trigger
    window.playSmartLink = (url, title, creator, art) => this.play(url, title, creator, art);
  },

  play(url, title, creator, art = '') {
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    this.audio.src = url;
    this.audio.play().catch(e => console.warn('Autoplay blocked:', e));
    
    this.state = { playing: true, track: { url, title, creator } };
    
    // Update UI
    this.ui.container.classList.remove('hidden');
    this.ui.title.textContent = title;
    this.ui.creator.textContent = creator;
    this.ui.art.src = art || 'assets/icon/bantu_stream_connect_icon.png';
    this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
  },

  pause() {
    this.audio.pause();
    this.state.playing = false;
    if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-play"></i>';
  },

  toggle() {
    this.state.playing ? this.pause() : this.audio.play();
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BantuAudio.init());
} else {
  BantuAudio.init();
}
