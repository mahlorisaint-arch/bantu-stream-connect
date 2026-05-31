/**
 * Bantu Audio Player - Glassmorphism Edition with View Tracking
 * FIXED: Proper contentId handling and view recording to content_views table
 */
const BantuAudio = {
  audio: new Audio(),
  state: {
    playing: false,
    track: null,
    viewRecorded: false,
    viewTimer: null,
    contentId: null,
    sessionId: null
  },

  supabase: null,

  init(supabaseClient = null) {
    this.ui = {
      container: document.getElementById('global-audio-player'),
      playBtn: document.getElementById('player-play-pause'),
      prevBtn: document.getElementById('player-prev'),
      nextBtn: document.getElementById('player-next'),
      title: document.getElementById('player-title'),
      creator: document.getElementById('player-creator'),
      art: document.getElementById('player-art'),
      bar: document.getElementById('player-bar'),
      closeBtn: document.getElementById('player-close-btn')
    };

    if (supabaseClient) this.supabase = supabaseClient;

    if (this.ui.container) this.ui.container.classList.add('hidden');

    // Event listeners
    if (this.ui.playBtn) {
      this.ui.playBtn.addEventListener('click', () => this.toggle());
    }
    if (this.ui.prevBtn) {
      this.ui.prevBtn.addEventListener('click', () => this.previous());
    }
    if (this.ui.nextBtn) {
      this.ui.nextBtn.addEventListener('click', () => this.next());
    }
    if (this.ui.closeBtn) {
      this.ui.closeBtn.addEventListener('click', () => this.closeAndReset());
    }

    this.audio.preload = 'none';
    this.audio.crossOrigin = 'anonymous';

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration && this.ui.bar) {
        const pct = (this.audio.currentTime / this.audio.duration) * 100;
        this.ui.bar.style.width = `${pct}%`;
      }
      this.checkAndRecordView();
    });

    this.audio.addEventListener('ended', () => {
      this.pause();
      this.resetViewTracking();
    });

    this.audio.addEventListener('play', () => {
      this.resetViewTracking();
      this.startViewTimer();
    });

    this.audio.addEventListener('pause', () => {
      this.clearViewTimer();
    });

    // Progress bar seeking
    if (this.ui.container) {
      const progressBar = this.ui.container.querySelector('.player-progress');
      if (progressBar) {
        progressBar.addEventListener('click', (e) => {
          const rect = progressBar.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          if (this.audio.duration) {
            this.audio.currentTime = percentage * this.audio.duration;
          }
        });
      }
    }

    this.audio.addEventListener('error', (e) => {
      console.warn('🎵 Audio error:', e);
      this.pause();
      if (typeof window.showToast === 'function') {
        window.showToast('Unable to play audio. Please try again.', 'error');
      }
    });

    // Expose to global window - IMPORTANT: now expects contentId parameter
    window.playSmartLink = (url, title, creator, art = '', contentId = null) => {
      this.play(url, title, creator, art, contentId);
    };
    window.showAudioPlayer = () => this.show();
    window.hideAudioPlayer = () => this.hide();
    
    console.log('🎵 Audio Player initialized with view tracking');
  },

  setSupabaseClient(client) {
    this.supabase = client;
  },

  show() {
    if (this.ui.container) this.ui.container.classList.remove('hidden');
  },

  hide() {
    if (this.ui.container) this.ui.container.classList.add('hidden');
  },

  closeAndReset() {
    this.stop();
    this.hide();
    this.state.track = null;
    this.state.viewRecorded = false;
    this.state.contentId = null;
    this.updateUI();
  },

  stop() {
    if (this.state.playing) {
      this.audio.pause();
      this.state.playing = false;
      if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    this.clearViewTimer();
    this.audio.src = '';
    this.audio.load();
  },

  // FIXED: Now expects contentId (bigint from Content table)
  play(url, title, creator, art = '', contentId = null) {
    console.log('🎵 Playing:', title, 'by', creator, 'contentId:', contentId);
    
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    if (this.state.playing) this.audio.pause();
    this.clearViewTimer();
    this.state.viewRecorded = false;
    
    // Store contentId for view tracking
    this.state.contentId = contentId;
    this.state.sessionId = this.generateSessionId();
    
    this.audio.src = url;
    this.audio.load();
    
    this.state.track = { url, title, creator, art, contentId };
    this.updateUI();
    
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.state.playing = true;
        this.updateUI();
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
    if (this.ui.title && this.state.track) {
      this.ui.title.textContent = this.state.track.title || 'Untitled Track';
    }
    if (this.ui.creator && this.state.track) {
      this.ui.creator.textContent = this.state.track.creator || 'Unknown Artist';
    }
    
    // Fixed thumbnail handling
    if (this.ui.art && this.state.track) {
      const artUrl = this.state.track.art;
      if (artUrl && artUrl !== '' && artUrl !== '#') {
        this.ui.art.src = artUrl;
        this.ui.art.onerror = () => {
          this.ui.art.src = 'https://placehold.co/400x400/1e293b/f59e0b?text=🎵';
        };
      } else {
        this.ui.art.src = 'https://placehold.co/400x400/1e293b/f59e0b?text=🎵';
      }
    }
    
    if (this.ui.playBtn) {
      this.ui.playBtn.innerHTML = this.state.playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }
    if (this.ui.bar) this.ui.bar.style.width = '0%';
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
        }).catch(e => console.warn('Play failed:', e));
      } else {
        this.audio.play();
        this.state.playing = true;
        if (this.ui.playBtn) this.ui.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.startViewTimer();
      }
    }
  },

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  },

  startViewTimer() {
    this.clearViewTimer();
    if (!this.state.contentId) {
      console.log('⏭️ No contentId provided, skipping view tracking');
      return;
    }
    this.state.viewTimer = setTimeout(() => {
      this.recordView();
    }, 15000);
  },

  clearViewTimer() {
    if (this.state.viewTimer) {
      clearTimeout(this.state.viewTimer);
      this.state.viewTimer = null;
    }
  },

  checkAndRecordView() {
    if (!this.state.viewRecorded && this.state.contentId && this.audio.currentTime >= 15) {
      this.recordView();
    }
  },

  resetViewTracking() {
    this.state.viewRecorded = false;
    this.clearViewTimer();
  },

  getCurrentUserId() {
    // Try to get from window or localStorage
    if (window.currentUserId) return window.currentUserId;
    if (localStorage.getItem('userId')) return localStorage.getItem('userId');
    // Try to get from supabase session
    if (this.supabase) {
      this.supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) return data.session.user.id;
      }).catch(() => {});
    }
    return null;
  },

  getDeviceType() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  },

  async recordView() {
    if (this.state.viewRecorded) return;
    if (!this.state.contentId) {
      console.warn('⚠️ Cannot record view: missing content_id');
      return;
    }
    
    this.state.viewRecorded = true;
    this.clearViewTimer();
    
    if (!this.supabase) {
      console.warn('⚠️ Supabase client not set. Call BantuAudio.setSupabaseClient()');
      return;
    }
    
    const viewerId = this.getCurrentUserId();
    const sessionId = this.state.sessionId;
    const deviceType = this.getDeviceType();
    
    // Parse contentId to number (bigint)
    const contentIdNum = parseInt(this.state.contentId, 10);
    if (isNaN(contentIdNum)) {
      console.error('❌ Invalid content_id:', this.state.contentId);
      return;
    }
    
    const viewRecord = {
      content_id: contentIdNum,
      viewer_id: viewerId,
      view_duration: Math.floor(this.audio.currentTime || 15),
      device_type: deviceType,
      session_id: sessionId,
      user_id: viewerId,
      counted_as_view: true
    };
    
    console.log('📝 Recording view for content_id:', contentIdNum);
    
    try {
      const { data, error } = await this.supabase
        .from('content_views')
        .insert([viewRecord])
        .select();
      
      if (error) {
        console.error('❌ Failed to record view:', error);
      } else {
        console.log('✅ View recorded for content:', this.state.contentId, 'duration:', Math.floor(this.audio.currentTime || 15), 's');
      }
    } catch (err) {
      console.error('❌ View recording error:', err);
    }
  },

  previous() {
    console.log('Previous track - to be implemented');
  },

  next() {
    console.log('Next track - to be implemented');
  },

  isVisible() {
    return this.ui.container && !this.ui.container.classList.contains('hidden');
  },

  getCurrentTrack() {
    return this.state.track;
  },

  setVolume(volume) {
    if (volume >= 0 && volume <= 1) this.audio.volume = volume;
  },

  getVolume() {
    return this.audio.volume;
  },

  setMuted(muted) {
    this.audio.muted = muted;
  }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
if (!document.querySelector('#audio-player-styles')) {
  style.id = 'audio-player-styles';
  document.head.appendChild(style);
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BantuAudio.init());
} else {
  BantuAudio.init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BantuAudio;
}
