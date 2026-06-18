/**
 * Bantu Audio Player - Glassmorphism Edition with View Tracking
 * FIXED: Better audio format handling and error recovery
 * FIXED: RPC view recording integration (matches video player)
 * FIXED: Live engagement counts update
 * FIXED: Cloudflare R2 audio support
 * FIXED: Session management consistency
 */

const BantuAudio = {
  audio: new Audio(),
  state: {
    playing: false,
    track: null,
    viewRecorded: false,
    viewTimer: null,
    contentId: null,
    sessionId: null,
    viewThresholdReached: false,
    playbackSessionId: null
  },

  supabase: null,
  currentUserId: null,

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
      closeBtn: document.getElementById('player-close-btn'),
      progress: document.querySelector('.player-progress'),
      viewsCount: document.getElementById('player-views')
    };

    if (supabaseClient) {
      this.supabase = supabaseClient;
      console.log('🎵 Supabase client set for audio player');
    } else if (window.supabaseAuth) {
      this.supabase = window.supabaseAuth;
      console.log('🎵 Using window.supabaseAuth for audio player');
    } else if (window.supabaseClient) {
      this.supabase = window.supabaseClient;
      console.log('🎵 Using window.supabaseClient for audio player');
    }

    // Get current user
    this.currentUserId = this.getCurrentUserId();

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
      // Emit ended event for playlist progression
      this.emit('audioEnded', {
        contentId: this.state.contentId,
        playlistIndex: window.currentPlaylistIndex
      });
    });

    this.audio.addEventListener('play', () => {
      console.log('🎵 Play event fired');
      this.resetViewTracking();
      this.startViewTimer();
      // Initialize playback session
      this.initializePlaybackSession();
    });

    this.audio.addEventListener('pause', () => {
      this.clearViewTimer();
    });

    this.audio.addEventListener('canplay', () => {
      console.log('🎵 Audio can play now');
    });

    // Progress bar seeking
    if (this.ui.progress) {
      this.ui.progress.addEventListener('click', (e) => {
        const rect = this.ui.progress.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        if (this.audio.duration && !isNaN(this.audio.duration)) {
          this.audio.currentTime = percentage * this.audio.duration;
        }
      });
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
    
    // Listen for contentId changes
    window.addEventListener('contentIdChanged', (event) => {
      if (event.detail && event.detail.contentId) {
        console.log('📡 Audio player received contentIdChanged:', event.detail.contentId);
        // Update session if needed
      }
    });

    // Listen for engagement count updates
    window.addEventListener('content-views-updated', (event) => {
      if (event.detail && event.detail.contentId && event.detail.viewsCount) {
        if (String(event.detail.contentId) === String(this.state.contentId)) {
          this.updateViewsDisplay(event.detail.viewsCount);
        }
      }
    });

    console.log('🎵 Audio Player initialized with view tracking');
  },

  /**
   * Get current user ID from various sources
   */
  getCurrentUserId() {
    if (window.currentUserId) return window.currentUserId;
    if (localStorage.getItem('userId')) return localStorage.getItem('userId');
    if (window.AuthHelper?.getCurrentUser) {
      const user = window.AuthHelper.getCurrentUser();
      if (user?.id) return user.id;
    }
    if (window.AuthHelper?.getUserProfile) {
      const profile = window.AuthHelper.getUserProfile();
      if (profile?.id) return profile.id;
    }
    return null;
  },

  /**
   * Update current user ID (called after auth changes)
   */
  updateCurrentUserId() {
    this.currentUserId = this.getCurrentUserId();
    console.log('🎵 Audio player user ID updated:', this.currentUserId);
  },

  /**
   * Initialize playback session for view tracking
   */
  initializePlaybackSession() {
    if (!this.state.contentId || !this.supabase) return;
    
    // Use existing session or create new one
    if (!this.state.playbackSessionId) {
      this.state.playbackSessionId = 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Try to create playback session record
    this.supabase
      .from('playback_sessions')
      .insert({
        playback_session_id: this.state.playbackSessionId,
        content_id: parseInt(this.state.contentId, 10),
        user_id: this.currentUserId,
        session_id: this.state.sessionId || this.generateSessionId(),
        platform: 'Web',
        device_type: this.getDeviceType(),
        started_at: new Date().toISOString(),
        media_type: 'audio'
      })
      .then(({ error }) => {
        if (error) {
          console.warn('⚠️ Playback session creation failed:', error.message);
        } else {
          console.log('🎵 Playback session initialized:', this.state.playbackSessionId);
        }
      });
  },

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  },

  /**
   * Record view using RPC (matches video player pattern)
   */
  async recordViewViaRPC(contentId, userId, sessionId, deviceType) {
    if (!contentId) {
      console.error('❌ Cannot record view: missing contentId');
      return { success: false, views: 0 };
    }
    
    try {
      const finalDeviceType = deviceType || this.getDeviceType();
      const finalSessionId = sessionId || this.state.sessionId || this.generateSessionId();
      
      const { data, error } = await this.supabase.rpc('record_content_view', {
        p_content_id: parseInt(contentId),
        p_user_id: userId || null,
        p_session_id: finalSessionId,
        p_device_type: finalDeviceType
      });
      
      if (error) {
        console.error('❌ RPC view recording failed:', error);
        return await this.recordViewFallback(contentId, userId, finalSessionId, finalDeviceType);
      }
      
      console.log(`✅ View recorded via RPC for content ${contentId}, total views: ${data?.views || 0}`);
      
      // Update UI with new view count
      if (data?.views !== undefined) {
        this.updateViewsDisplay(data.views);
      }
      
      // Dispatch global event
      window.dispatchEvent(new CustomEvent('content-views-updated', {
        detail: { contentId: contentId, viewsCount: data?.views || 0 }
      }));
      
      return { success: true, views: data?.views || 0 };
    } catch (error) {
      console.error('❌ RPC view recording error:', error);
      return await this.recordViewFallback(contentId, userId, sessionId, deviceType);
    }
  },

  /**
   * Fallback view recording if RPC fails
   */
  async recordViewFallback(contentId, userId, sessionId, deviceType) {
    try {
      const finalSessionId = sessionId || this.state.sessionId || this.generateSessionId();
      const finalDeviceType = deviceType || this.getDeviceType();
      const contentIdNum = parseInt(contentId, 10);
      
      if (isNaN(contentIdNum)) {
        console.error('❌ Invalid content_id:', contentId);
        return { success: false, views: 0 };
      }
      
      // Check if view already exists for this session
      const { data: existing, error: checkError } = await this.supabase
        .from('content_views')
        .select('id')
        .eq('content_id', contentIdNum)
        .eq('session_id', finalSessionId)
        .maybeSingle();
      
      if (existing) {
        console.log('⏭️ View already recorded for this session, skipping');
        return { success: true, views: null };
      }
      
      const viewRecord = {
        content_id: contentIdNum,
        user_id: userId || this.currentUserId || null,
        session_id: finalSessionId,
        counted_as_view: true,
        view_duration: Math.floor(this.audio.currentTime || 15),
        device_type: finalDeviceType,
        viewed_at: new Date().toISOString()
      };
      
      const { error: insertError } = await this.supabase
        .from('content_views')
        .insert([viewRecord]);
      
      if (insertError) throw insertError;
      
      // Get updated count
      const { count, error: countError } = await this.supabase
        .from('content_views')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', contentIdNum)
        .eq('counted_as_view', true);
      
      if (!countError && count !== null) {
        this.updateViewsDisplay(count);
      }
      
      console.log(`✅ View recorded via fallback for content ${contentId}`);
      return { success: true, views: count || 0 };
    } catch (error) {
      console.error('❌ Fallback view recording failed:', error);
      return { success: false, views: 0 };
    }
  },

  /**
   * Update views display in UI
   */
  updateViewsDisplay(viewsCount) {
    if (this.ui.viewsCount) {
      const formatted = this.formatNumber(viewsCount);
      this.ui.viewsCount.textContent = formatted;
      console.log('🎵 Views updated:', formatted);
    }
  },

  /**
   * Format number with K/M suffix
   */
  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  /**
   * Get device type
   */
  getDeviceType() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
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
    this.state.playbackSessionId = null;
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

  /**
   * Play audio with view tracking
   */
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
    this.state.viewThresholdReached = false;
    
    this.state.contentId = contentId;
    this.state.sessionId = this.generateSessionId();
    this.state.playbackSessionId = null; // Reset to create new session on play
    
    // Update current user ID
    this.currentUserId = this.getCurrentUserId();
    
    // 🔥 FIXED: Better URL handling with Cloudflare R2 support
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
    
    // Reset views display
    this.updateViewsDisplay(0);
    
    // Load live engagement counts
    if (contentId) {
      this.loadLiveEngagementCounts(contentId);
    }
    
    // Small delay before playing to allow loading
    setTimeout(() => {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.state.playing = true;
          this.updateUI();
          this.startViewTimer();
          this.initializePlaybackSession();
          console.log('🎵 Playback started successfully');
        }).catch(e => {
          console.warn('Autoplay blocked or play failed:', e);
          this.state.playing = false;
          this.updateUI();
          if (typeof window.showToast === 'function') {
            window.showToast('Click the play button to start audio', 'info');
          }
        });
      } else {
        this.audio.play();
        this.state.playing = true;
        this.updateUI();
        this.startViewTimer();
        this.initializePlaybackSession();
      }
    }, 100);
    
    this.show();
  },

  /**
   * Load live engagement counts from canonical tables
   */
  async loadLiveEngagementCounts(contentId) {
    if (!contentId || !this.supabase) return;
    
    try {
      const { data: stats, error } = await this.supabase
        .from('content_engagement_stats')
        .select('total_views, total_likes')
        .eq('content_id', parseInt(contentId, 10))
        .maybeSingle();
      
      if (!error && stats) {
        if (stats.total_views !== null) {
          this.updateViewsDisplay(stats.total_views);
        }
        console.log('🎵 Live counts loaded:', stats);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load live counts:', error);
    }
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
    
    // Update playback session
    if (this.state.playbackSessionId && this.supabase) {
      this.supabase
        .from('playback_sessions')
        .update({
          exited_at: new Date().toISOString(),
          max_progress_seconds: Math.floor(this.audio.currentTime || 0)
        })
        .eq('playback_session_id', this.state.playbackSessionId)
        .then(() => {});
    }
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
          this.initializePlaybackSession();
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
        this.initializePlaybackSession();
      }
    }
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
    this.state.viewThresholdReached = false;
    this.clearViewTimer();
  },

  /**
   * Record view using the RPC method (matches video player)
   */
  async recordView() {
    if (this.state.viewRecorded) return;
    if (!this.state.contentId) {
      console.warn('⚠️ Cannot record view: missing content_id');
      return;
    }
    
    // Ensure supabase client is available
    if (!this.supabase) {
      if (window.supabaseClient) {
        this.supabase = window.supabaseClient;
      } else if (window.supabaseAuth) {
        this.supabase = window.supabaseAuth;
      } else {
        console.warn('⚠️ Supabase client not set. View not recorded.');
        return;
      }
    }
    
    this.state.viewRecorded = true;
    this.clearViewTimer();
    
    const userId = this.currentUserId || this.getCurrentUserId();
    const sessionId = this.state.sessionId;
    const deviceType = this.getDeviceType();
    const contentId = this.state.contentId;
    
    console.log('📝 Recording view via RPC for content:', contentId);
    
    try {
      const result = await this.recordViewViaRPC(contentId, userId, sessionId, deviceType);
      if (result.success) {
        console.log('✅ View recorded successfully for content:', contentId);
        // Update the global content if available
        if (window.currentContent && window.currentContent.id == contentId) {
          window.currentContent.views_count = result.views || window.currentContent.views_count;
        }
      }
    } catch (err) {
      console.error('❌ View recording error:', err);
    }
  },

  previous() {
    console.log('⏮️ Previous track');
    if (typeof window.playPreviousPlaylistItem === 'function') {
      window.playPreviousPlaylistItem();
    } else {
      this.emit('previousRequested', { contentId: this.state.contentId });
    }
  },

  next() {
    console.log('⏭️ Next track');
    if (typeof window.playNextPlaylistItem === 'function') {
      window.playNextPlaylistItem();
    } else {
      this.emit('nextRequested', { contentId: this.state.contentId });
    }
  },

  /**
   * Emit events for playlist integration
   */
  emit(event, data) {
    const customEvent = new CustomEvent(`audio:${event}`, {
      detail: { ...data, player: this }
    });
    window.dispatchEvent(customEvent);
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
  },

  getPlaybackState() {
    return {
      playing: this.state.playing,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration,
      contentId: this.state.contentId,
      track: this.state.track,
      viewRecorded: this.state.viewRecorded
    };
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
    BantuAudio.init(window.supabaseAuth || window.supabaseClient || null);
  });
} else {
  BantuAudio.init(window.supabaseAuth || window.supabaseClient || null);
}

// Update user ID when auth changes
document.addEventListener('auth:stateChanged', () => {
  BantuAudio.updateCurrentUserId();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BantuAudio;
}
