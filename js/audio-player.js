/**
 * Bantu Audio Player - Glassmorphism Edition with View Tracking
 * FIXED: Better audio format handling and error recovery
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

    if (supabaseClient) {
      this.supabase = supabaseClient;
      console.log('🎵 Supabase client set for audio player');
    } else if (window.supabaseAuth) {
      this.supabase = window.supabaseAuth;
      console.log('🎵 Using window.supabaseAuth for audio player');
    }

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

    this.audio.preload = 'metadata';
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
      console.log('🎵 Play event fired');
      this.resetViewTracking();
      this.startViewTimer();
    });

    this.audio.addEventListener('pause', () => {
      this.clearViewTimer();
    });

    this.audio.addEventListener('canplay', () => {
      console.log('🎵 Audio can play now');
    });

    // FIXED: Better error handling - don't kill the player on error
    this.audio.addEventListener('error', (e) => {
      console.warn('🎵 Audio error:', e);
      const error = this.audio.error;
      if (error) {
        console.warn('Error code:', error.code, 'Message:', error.message);
        // Error code 3 = MEDIA_ERR_DECODE - format issue
        if (error.code === 3) {
          console.warn('Audio format may not be supported. Try converting to MP3.');
          if (typeof window.showToast === 'function') {
            window.showToast('Audio format not fully supported. Trying alternative format...', 'warning');
          }
          // Try to reload with different approach
          this.retryWithDifferentFormat();
        } else if (error.code === 4) {
          console.warn('Network error loading audio');
          if (typeof window.showToast === 'function') {
            window.showToast('Network issue loading audio. Please try again.', 'error');
          }
        } else {
          if (typeof window.showToast === 'function') {
            window.showToast('Unable to play audio. Please try again.', 'error');
          }
        }
      }
      // Don't pause here - let user retry
    });

    // Progress bar seeking
    if (this.ui.container) {
      const progressBar = this.ui.container.querySelector('.player-progress');
      if (progressBar) {
        progressBar.addEventListener('click', (e) => {
          const rect = progressBar.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          if (this.audio.duration && !isNaN(this.audio.duration)) {
            this.audio.currentTime = percentage * this.audio.duration;
          }
        });
      }
    }

    // Expose to global window
    window.playSmartLink = (url, title, creator, art = '', contentId = null) => {
      this.play(url, title, creator, art, contentId);
    };
    window.showAudioPlayer = () => this.show();
    window.hideAudioPlayer = () => this.hide();
    window.setAudioPlayerSupabase = (client) => {
      this.supabase = client;
      console.log('🎵 Supabase client updated');
    };
    
    console.log('🎵 Audio Player initialized with view tracking');
  },

  retryWithDifferentFormat() {
    // Try to load with different approach
    const currentSrc = this.audio.src;
    if (currentSrc && currentSrc.includes('.wav')) {
      console.log('⚠️ WAV file may be causing issues. Consider converting to MP3/OGG.');
    }
    // Attempt to reload after a delay
    setTimeout(() => {
      if (this.state.track && !this.state.playing) {
        console.log('🔄 Retrying audio playback...');
        this.audio.load();
      }
    }, 1000);
  },

  setSupabaseClient(client) {
    this.supabase = client;
    console.log('🎵 Supabase client set via method');
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

  play(url, title, creator, art = '', contentId = null) {
    console.log('🎵 Playing:', title, 'by', creator, 'contentId:', contentId);
    
    if (this.state.track?.url === url && this.state.playing) {
      this.pause();
      return;
    }

    if (this.state.playing) {
      this.audio.pause();
    }
    this.clearViewTimer();
    this.state.viewRecorded = false;
    
    this.state.contentId = contentId;
    this.state.sessionId = this.generateSessionId();
    
    // FIXED: Better URL handling
    let audioUrl = url;
    if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('blob:')) {
      if (window.SupabaseHelper?.fixMediaUrl) {
        audioUrl = window.SupabaseHelper.fixMediaUrl(audioUrl);
      } else {
        const cleanUrl = audioUrl.replace(/^\/+/, '');
        audioUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanUrl}`;
      }
    }
    
    // Add timestamp to avoid cache issues
    if (audioUrl && !audioUrl.includes('?t=')) {
      audioUrl = audioUrl + (audioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    }
    
    console.log('🎵 Audio URL:', audioUrl);
    this.audio.src = audioUrl;
    this.audio.load();
    
    this.state.track = { url: audioUrl, title, creator, art, contentId };
    this.updateUI();
    
    // Small delay before playing to allow loading
    setTimeout(() => {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.state.playing = true;
          this.updateUI();
          this.startViewTimer();
          console.log('🎵 Playback started successfully');
        }).catch(e => {
          console.warn('Autoplay blocked or play failed:', e);
          this.state.playing = false;
          this.updateUI();
          if (typeof window.showToast === 'function') {
            window.showToast('Click the play button to start audio', 'info');
          }
        });
      }
    }, 100);
    
    this.show();
  },
  
  updateUI() {
    if (this.ui.title && this.state.track) {
      this.ui.title.textContent = this.state.track.title || 'Untitled Track';
    }
    if (this.ui.creator && this.state.track) {
      this.ui.creator.textContent = this.state.track.creator || 'Unknown Artist';
    }
    
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
        }).catch(e => {
          console.warn('Play failed:', e);
          if (typeof window.showToast === 'function') {
            window.showToast('Click play to start audio', 'info');
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

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  },

  startViewTimer() {
    this.clearViewTimer();
    if (!this.state.contentId) {
      console.log('⏭️ No contentId provided, skipping view tracking');
      return;
    }
    if (this.state.viewRecorded) {
      console.log('⏭️ View already recorded for this session');
      return;
    }
    console.log('⏱️ View timer started for content:', this.state.contentId, '- will record after 15 seconds');
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
      console.log('🎯 15 seconds reached, recording view for content:', this.state.contentId);
      this.recordView();
    }
  },

  resetViewTracking() {
    this.state.viewRecorded = false;
    this.clearViewTimer();
  },

  getCurrentUserId() {
    if (window.currentUserId) return window.currentUserId;
    if (localStorage.getItem('userId')) return localStorage.getItem('userId');
    if (window.AuthHelper?.getCurrentUser) {
      const user = window.AuthHelper.getCurrentUser();
      if (user?.id) return user.id;
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
    
    let supabase = this.supabase;
    if (!supabase && window.supabaseAuth) {
      supabase = window.supabaseAuth;
      this.supabase = supabase;
    }
    
    if (!supabase) {
      console.warn('⚠️ Supabase client not set. View not recorded.');
      return;
    }
    
    const viewerId = this.getCurrentUserId();
    const sessionId = this.state.sessionId;
    const deviceType = this.getDeviceType();
    
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
      counted_as_view: true,
      created_at: new Date().toISOString()
    };
    
    console.log('📝 Recording view for content_id:', contentIdNum);
    
    try {
      const { error } = await supabase
        .from('content_views')
        .insert([viewRecord]);
      
      if (error) {
        console.error('❌ Failed to record view:', error);
      } else {
        console.log('✅ View recorded successfully for content:', this.state.contentId);
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
  document.addEventListener('DOMContentLoaded', () => {
    BantuAudio.init(window.supabaseAuth || null);
  });
} else {
  BantuAudio.init(window.supabaseAuth || null);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BantuAudio;
}
