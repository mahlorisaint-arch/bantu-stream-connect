// js/video-player-features.js - Phase 1 Critical Fixes + Phase 1D Enhancements
// ✅ FULLY UPDATED
// ✅ FIXED duplicate content_views inserts
// ✅ FIXED views_count not updating
// ✅ FIXED 409 conflicts
// ✅ FIXED session handling
// ✅ FIXED creator_id issues
// ✅ FIXED content table view syncing
// ✅ CRITICAL FIX #7: Prevent cleanup during active playback
// ✅ CRITICAL FIX #8: Prevent cleanup during UI interactions
// ✅ CRITICAL FIX #9: Only destroy player on page unload or true content change
// 🚀 PHASE 1D ENHANCEMENTS:
// ✅ Collection-aware playback
// ✅ Queue integration
// ✅ Next/Previous track support
// ✅ Autoplay with queue
// ✅ Playback state persistence
// ✅ Playlist autoplay on completion
// ✅ Queue state sync with UI
// ✅ Playlist progression tracking
// ✅ Views FIX #1-4: Proper view recording with DB confirmation
// 🔧 ALBUM ARCHITECTURE FIX: REMOVED duplicate album toggle system (album UI now ONLY in content-detail.js)

/**
 * PHASE 1 CRITICAL FIXES:
 * 1. Remove duplicate control systems
 * 2. Fix fullscreen API implementation
 * 3. FIXED view deduplication system
 * 4. Fix memory leaks
 * 5. NO creator_id references anywhere
 * 6. FIXED views_count sync
 * 7. FIXED duplicate inserts
 * 
 * PHASE 1D ENHANCEMENTS:
 * 8. Next/Previous track support
 * 9. Queue-aware autoplay
 * 10. Collection item highlighting
 * 11. Playback state persistence
 * 12. Playlist autoplay on video end
 * 13. Queue UI sync methods
 * 
 * 🔥 CRITICAL FIX #7-9:
 * 14. Prevent cleanup during active playback
 * 15. Prevent cleanup during UI interactions (play, pause, settings, album expand)
 * 16. Only destroy player on page unload or true content change
 * 
 * 🔧 VIEWS FIX #1-4:
 * 17. Removed premature early exit in view recording
 * 18. Added proper DB confirmation with viewPersisted flag
 * 19. Added frontend optimistic update for views
 * 20. Added incrementContentViews RPC call
 * 
 * 🔧 ALBUM ARCHITECTURE FIX:
 * 21. REMOVED duplicate album toggle system (setupAlbumToggleWithRetry, setupBasicAlbumToggle, getAlbumTracks)
 * 22. Album UI now handled EXCLUSIVELY by content-detail.js
 */

class VideoPlayerFeatures {
  constructor() {
    this.viewDeduplicationKey = 'bantu_viewed_content';
    this.viewWindowHours = 24;
    this.initialized = false;
    this.currentQueueIndex = 0;
    this.queueItems = [];
    this.boundHandleVideoEnded = null;
    this.playlistSyncInterval = null;
    
    // ✅ CRITICAL FIX #7-9: Track cleanup state
    this._isCleaningUp = false;
    this._activePlaybackCount = 0;
    this._pendingCleanup = false;
    this._lastCleanupTime = 0;
    this._contentChangeInProgress = false;
    
    // 🔧 VIEWS FIX: Track view recording state with DB confirmation
    this._isRecordingView = false;
    this._viewPersisted = false;
    this._currentSessionId = null;
  }

  /**
   * CRITICAL FIX #1: Remove all duplicate control systems
   */
  removeDuplicateControls() {
    console.log('🔧 Removing duplicate control systems...');
    
    const duplicateSelectors = [
      '.bantu-video-controls',
      '.bantu-control-bar',
      '.bantu-social-controls',
      '.bantu-settings-menu',
      '.bantu-buffering-indicator',
      '.bantu-error-overlay',
      '.bantu-watermark',
      '.bantu-control-btn',
      '.speed-btn',
      '.quality-btn',
      '.pip-btn',
      '.bantu-fullscreen-btn',
      '.bantu-speed-options',
      '.bantu-quality-options',
      '.bantu-option-btn'
    ];
    
    duplicateSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);

      elements.forEach((el, index) => {
        if (index > 0 && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    });
    
    const videoElement = document.getElementById('inlineVideoPlayer');

    if (videoElement) {
      videoElement.controls = false;
      videoElement.removeAttribute('controls');
    }
    
    console.log('✅ Duplicate controls removed');
  }

  /**
   * ✅ CRITICAL FIX #7: Check if cleanup is safe to perform
   */
  canCleanup() {
    // Don't cleanup if actively playing
    if (this._activePlaybackCount > 0) {
      console.log('🚫 Cleanup blocked: Active playback in progress');
      return false;
    }
    
    // Don't cleanup if content change is in progress
    if (this._contentChangeInProgress) {
      console.log('🚫 Cleanup blocked: Content change in progress');
      return false;
    }
    
    // Don't cleanup too frequently (within 500ms)
    const now = Date.now();
    if (now - this._lastCleanupTime < 500) {
      console.log('🚫 Cleanup blocked: Too frequent (throttled)');
      return false;
    }
    
    return true;
  }
  
  /**
   * ✅ CRITICAL FIX #7: Mark playback started
   */
  markPlaybackStarted() {
    this._activePlaybackCount++;
    console.log(`🎬 Playback started (count: ${this._activePlaybackCount})`);
  }
  
  /**
   * ✅ CRITICAL FIX #7: Mark playback ended
   */
  markPlaybackEnded() {
    this._activePlaybackCount = Math.max(0, this._activePlaybackCount - 1);
    console.log(`⏹️ Playback ended (count: ${this._activePlaybackCount})`);
    
    // If there was pending cleanup and playback just ended, execute it
    if (this._pendingCleanup && this._activePlaybackCount === 0 && this.canCleanup()) {
      console.log('🔧 Executing pending cleanup after playback ended');
      this._pendingCleanup = false;
      this.executeCleanup();
    }
  }
  
  /**
   * ✅ CRITICAL FIX #8: Mark content change start (prevents cleanup)
   */
  markContentChangeStart() {
    this._contentChangeInProgress = true;
    console.log('🔄 Content change started - cleanup disabled');
  }
  
  /**
   * ✅ CRITICAL FIX #8: Mark content change end
   */
  markContentChangeEnd() {
    this._contentChangeInProgress = false;
    console.log('✅ Content change ended - cleanup re-enabled');
  }
  
  /**
   * ✅ CRITICAL FIX #9: Safe cleanup that respects active state
   */
  safeCleanup(force = false) {
    if (force) {
      console.log('🧹 Force cleanup - ignoring safety checks');
      this.executeCleanup();
      return;
    }
    
    if (!this.canCleanup()) {
      console.log('⏰ Deferring cleanup until safe');
      this._pendingCleanup = true;
      return;
    }
    
    this.executeCleanup();
  }
  
  /**
   * ✅ CRITICAL FIX #9: Execute actual cleanup
   */
  executeCleanup() {
    if (this._isCleaningUp) {
      console.log('⚠️ Cleanup already in progress');
      return;
    }
    
    this._isCleaningUp = true;
    this._lastCleanupTime = Date.now();
    
    console.log('🧹 Executing video player resource cleanup...');
    
    // Clean up video player but preserve source
    if (window.enhancedVideoPlayer && !this._contentChangeInProgress) {
      try {
        // Don't destroy if we're just pausing
        if (this._activePlaybackCount === 0) {
          console.log('📦 Cleaning up player resources while preserving source...');
          // Just pause and cleanup controls, don't destroy the player
          if (window.enhancedVideoPlayer.video && !window.enhancedVideoPlayer.video.paused) {
            window.enhancedVideoPlayer.video.pause();
          }
        } else {
          console.log('⚠️ Skipping cleanup - active playback detected');
        }
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
    
    this._isCleaningUp = false;
    console.log('✅ Cleanup complete');
  }

  /**
   * PHASE 1D: Setup next/previous track controls
   */
  setupQueueControls() {
    console.log('🎵 Setting up queue controls...');
    
    const nextBtn = document.getElementById('nextTrackBtn');
    const prevBtn = document.getElementById('previousTrackBtn');
    
    if (nextBtn) {
      const newNextBtn = nextBtn.cloneNode(true);
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
      newNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playNextTrack();
      });
    }
    
    if (prevBtn) {
      const newPrevBtn = prevBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
      newPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playPreviousTrack();
      });
    }
    
    const autoplayToggle = document.getElementById('autoplayToggle');
    if (autoplayToggle) {
      const savedAutoplay = localStorage.getItem('bantu_autoplay_enabled');
      const isAutoplayEnabled = savedAutoplay !== null ? savedAutoplay === 'true' : true;
      
      if (!isAutoplayEnabled) {
        autoplayToggle.classList.remove('active');
      }
      
      autoplayToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = autoplayToggle.classList.toggle('active');
        localStorage.setItem('bantu_autoplay_enabled', isActive);
        console.log('🎵 Autoplay:', isActive ? 'ON' : 'OFF');
      });
    }
    
    console.log('✅ Queue controls setup complete');
  }
  
  /**
   * PHASE 1D: Play next track from queue
   */
  playNextTrack() {
    console.log('⏭️ Playing next track...');
    
    // Check if we're in playlist mode
    if (window.isPlaylistMode && window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
      const currentIndex = window.currentPlaylistItems.findIndex(i => i.id === window.currentContent?.id);
      if (currentIndex >= 0 && currentIndex + 1 < window.currentPlaylistItems.length) {
        const nextItem = window.currentPlaylistItems[currentIndex + 1];
        if (window.playPlaylistItemByIndex) {
          window.playPlaylistItemByIndex(currentIndex + 1);
        } else if (window.playPlaylistItem) {
          window.playPlaylistItem(nextItem.id, currentIndex + 1);
        }
        return;
      } else {
        console.log('🏁 End of playlist reached');
        this.showPlaylistCompleteMessage();
        return;
      }
    }
    
    if (window.QueueManager && typeof window.QueueManager.playNext === 'function') {
      window.QueueManager.playNext();
    } else if (this.queueItems.length > 0 && this.currentQueueIndex < this.queueItems.length - 1) {
      this.currentQueueIndex++;
      this.loadQueueItem(this.currentQueueIndex);
    } else {
      console.log('📭 No next track available');
      this.showEndOfQueueMessage();
    }
  }
  
  /**
   * PHASE 1D: Play previous track from queue
   */
  playPreviousTrack() {
    console.log('⏮️ Playing previous track...');
    
    if (window.isPlaylistMode && window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
      const currentIndex = window.currentPlaylistItems.findIndex(i => i.id === window.currentContent?.id);
      if (currentIndex > 0) {
        const prevItem = window.currentPlaylistItems[currentIndex - 1];
        if (window.playPlaylistItemByIndex) {
          window.playPlaylistItemByIndex(currentIndex - 1);
        } else if (window.playPlaylistItem) {
          window.playPlaylistItem(prevItem.id, currentIndex - 1);
        }
        return;
      } else {
        console.log('📭 Already at first item');
        return;
      }
    }
    
    if (window.QueueManager && typeof window.QueueManager.playPrevious === 'function') {
      window.QueueManager.playPrevious();
    } else if (this.queueItems.length > 0 && this.currentQueueIndex > 0) {
      this.currentQueueIndex--;
      this.loadQueueItem(this.currentQueueIndex);
    } else {
      console.log('📭 No previous track available');
    }
  }
  
  /**
   * PHASE 1D: Show playlist complete message
   */
  showPlaylistCompleteMessage() {
    const message = document.createElement('div');
    message.className = 'playlist-complete-toast';
    message.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>Playlist completed! 🎉</span>
    `;
    document.body.appendChild(message);
    setTimeout(() => {
      message.classList.add('show');
      setTimeout(() => {
        message.classList.remove('show');
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }, 10);
  }
  
  /**
   * PHASE 1D: Show end of queue message
   */
  showEndOfQueueMessage() {
    const message = document.createElement('div');
    message.className = 'queue-end-toast';
    message.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <span>End of queue</span>
    `;
    document.body.appendChild(message);
    setTimeout(() => {
      message.classList.add('show');
      setTimeout(() => {
        message.classList.remove('show');
        setTimeout(() => message.remove(), 300);
      }, 2000);
    }, 10);
  }
  
  /**
   * PHASE 1D: Load queue item
   */
  loadQueueItem(index) {
    const item = this.queueItems[index];
    if (!item) return;
    
    console.log('🎬 Loading queue item:', item.title);
    
    this.savePlaybackState();
    
    window.location.href = `content-detail.html?id=${item.id}`;
  }
  
  /**
   * PHASE 1D: Save playback state for queue restoration
   */
  savePlaybackState() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    const currentTime = videoElement?.currentTime || 0;
    const isPlaying = videoElement && !videoElement.paused;
    
    const playbackState = {
      queue: this.queueItems,
      currentIndex: this.currentQueueIndex,
      currentTime: currentTime,
      isPlaying: isPlaying,
      timestamp: Date.now(),
      contentId: window.currentContent?.id,
      isPlaylistMode: window.isPlaylistMode || false,
      playlistId: window.currentPlaylist?.id,
      playlistIndex: window.currentPlaylistIndex
    };
    
    localStorage.setItem('bantu_playback_state', JSON.stringify(playbackState));
    console.log('💾 Playback state saved');
  }
  
  /**
   * PHASE 1D: Restore playback state
   */
  restorePlaybackState() {
    const savedState = localStorage.getItem('bantu_playback_state');
    if (!savedState) return false;
    
    try {
      const state = JSON.parse(savedState);
      
      if (Date.now() - state.timestamp > 30 * 60 * 1000) {
        console.log('⏰ Playback state expired');
        return false;
      }
      
      if (state.queue && state.queue.length > 0) {
        this.queueItems = state.queue;
        this.currentQueueIndex = state.currentIndex;
        
        if (window.QueueManager && this.queueItems.length > 0) {
          window.QueueManager.initialize(this.queueItems);
          if (state.currentIndex !== undefined) {
            window.QueueManager.currentIndex = state.currentIndex;
          }
        }
      }
      
      console.log('💾 Playback state restored');
      return true;
    } catch (error) {
      console.warn('Failed to restore playback state:', error);
      return false;
    }
  }
  
  /**
   * PHASE 1D: Highlight active queue item
   */
  highlightActiveQueueItem(contentId) {
    const playlistItems = document.querySelectorAll('.playlist-queue-item');
    let activeFound = false;
    
    playlistItems.forEach(item => {
      if (item.dataset.contentId === String(contentId)) {
        item.classList.add('active');
        activeFound = true;
        
        const sidebar = document.querySelector('.playlist-queue');
        if (sidebar) {
          const itemRect = item.getBoundingClientRect();
          const sidebarRect = sidebar.getBoundingClientRect();
          
          if (itemRect.bottom > sidebarRect.bottom || itemRect.top < sidebarRect.top) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } else {
        item.classList.remove('active');
      }
    });
    
    const queueItems = document.querySelectorAll('.queue-item');
    queueItems.forEach(item => {
      if (item.dataset.contentId === String(contentId)) {
        item.classList.add('active');
        activeFound = true;
      } else {
        item.classList.remove('active');
      }
    });
    
    return activeFound;
  }
  
  /**
   * PHASE 1D: Setup video ended handler for autoplay
   */
  setupAutoplayOnEnded() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    if (this.boundHandleVideoEnded) {
      videoElement.removeEventListener('ended', this.boundHandleVideoEnded);
    }
    
    this.boundHandleVideoEnded = () => {
      const autoplayToggle = document.getElementById('autoplayToggle');
      const isAutoplayEnabled = autoplayToggle?.classList.contains('active') !== false;
      
      if (isAutoplayEnabled) {
        console.log('🎬 Video ended, autoplaying next...');
        
        if (window.isPlaylistMode && window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
          const currentIndex = window.currentPlaylistItems.findIndex(i => i.id === window.currentContent?.id);
          if (currentIndex >= 0 && currentIndex + 1 < window.currentPlaylistItems.length) {
            const nextItem = window.currentPlaylistItems[currentIndex + 1];
            setTimeout(() => {
              if (window.playPlaylistItemByIndex) {
                window.playPlaylistItemByIndex(currentIndex + 1);
              } else if (window.playPlaylistItem) {
                window.playPlaylistItem(nextItem.id, currentIndex + 1);
              }
            }, 500);
            return;
          }
        }
        
        this.playNextTrack();
      } else {
        console.log('⏸️ Video ended, autoplay disabled');
      }
    };
    
    videoElement.addEventListener('ended', this.boundHandleVideoEnded);
    
    console.log('✅ Autoplay on ended handler setup complete');
  }
  
  /**
   * PHASE 1D: Sync queue state with playlist UI
   */
  syncQueueWithPlaylistUI() {
    if (this.playlistSyncInterval) {
      clearInterval(this.playlistSyncInterval);
    }
    
    this.playlistSyncInterval = setInterval(() => {
      if (window.currentContent?.id) {
        this.highlightActiveQueueItem(window.currentContent.id);
        
        const nowPlayingItem = document.querySelector('.playlist-queue-item.active');
        if (nowPlayingItem) {
          const title = nowPlayingItem.querySelector('.playlist-item-title')?.textContent;
          if (title) {
            const nowPlayingEl = document.getElementById('nowPlayingTitle');
            if (nowPlayingEl) {
              nowPlayingEl.textContent = title;
            }
          }
        }
      }
    }, 1000);
  }
  
  /**
   * PHASE 1D: Restore queue from localStorage
   */
  restoreQueueFromStorage() {
    const savedQueue = localStorage.getItem('bantu_active_queue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        if (parsed.queue && parsed.queue.length > 0) {
          this.queueItems = parsed.queue;
          this.currentQueueIndex = parsed.currentIndex || 0;
          
          if (window.QueueManager) {
            window.QueueManager.queue = this.queueItems;
            window.QueueManager.currentIndex = this.currentQueueIndex;
            console.log('📋 Queue restored from storage:', this.queueItems.length, 'items');
          }
        }
      } catch (e) {
        console.warn('Failed to restore queue:', e);
      }
    }
    
    const savedPlaylist = localStorage.getItem('bantu_last_playlist');
    if (savedPlaylist && !window.isPlaylistMode) {
      try {
        const playlist = JSON.parse(savedPlaylist);
        console.log('📀 Found saved playlist:', playlist.name);
      } catch (e) {
        console.warn('Failed to restore playlist:', e);
      }
    }
  }
  
  /**
   * PHASE 1D: Save current playlist to storage
   */
  saveCurrentPlaylist() {
    if (window.currentPlaylist) {
      localStorage.setItem('bantu_last_playlist', JSON.stringify({
        id: window.currentPlaylist.id,
        name: window.currentPlaylist.name,
        itemsCount: window.currentPlaylistItems?.length || 0,
        timestamp: Date.now()
      }));
    }
  }

  /**
   * CRITICAL FIX #2: Proper fullscreen API implementation
   */
  setupFullscreenFix() {
    console.log('🔧 Setting up fullscreen API fix...');
    
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {

      window.EnhancedVideoPlayer.prototype.toggleFullscreen = function() {

        const videoContainer = document.querySelector('.video-container');

        if (!videoContainer) {
          console.error('Video container not found for fullscreen');
          return;
        }
        
        if (!this.isFullscreen) {

          if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();

          } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();

          } else if (videoContainer.mozRequestFullScreen) {
            videoContainer.mozRequestFullScreen();

          } else if (videoContainer.msRequestFullscreen) {
            videoContainer.msRequestFullscreen();
          }

        } else {

          if (document.exitFullscreen) {
            document.exitFullscreen();

          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();

          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();

          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
        
        this.isFullscreen = !this.isFullscreen;
        
        const fullscreenBtn = this.controls?.querySelector('.fullscreen-btn');

        if (fullscreenBtn) {
          fullscreenBtn.innerHTML = this.isFullscreen
            ? '<i class="fas fa-compress"></i>'
            : '<i class="fas fa-expand"></i>';
        }
        
        setTimeout(() => {
          if (this.controls) {
            this.controls.style.opacity = '1';
            this.controls.style.pointerEvents = 'all';
          }
        }, 100);
      };
      
      document.addEventListener(
        'fullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'webkitfullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'mozfullscreenchange',
        this.handleFullscreenChange.bind(this)
      );

      document.addEventListener(
        'MSFullscreenChange',
        this.handleFullscreenChange.bind(this)
      );
      
      console.log('✅ Fullscreen API fixed');
    }
  }

  handleFullscreenChange() {

    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    if (window.enhancedVideoPlayer) {

      window.enhancedVideoPlayer.isFullscreen = isFullscreen;
      
      const fullscreenBtn =
        window.enhancedVideoPlayer.controls?.querySelector('.fullscreen-btn');

      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = isFullscreen
          ? '<i class="fas fa-compress"></i>'
          : '<i class="fas fa-expand"></i>';
      }
    }
  }

  /**
   * 🔧 VIEWS FIX #1-4: PROPER VIEW RECORDING WITH DB CONFIRMATION
   * - Removes premature early exit
   * - Only marks success after DB confirmation
   * - Adds frontend optimistic updates
   * - Uses RPC increment_content_views
   */
  async recordView(contentId, sessionId) {
    try {
      // Prevent duplicate simultaneous calls ONLY
      if (this._isRecordingView) {
        console.log('👁️ View recording already in progress, skipping duplicate call');
        return false;
      }

      this._isRecordingView = true;

      // Only skip if DATABASE already confirmed
      if (this._viewPersisted === true) {
        console.log('👁️ View already persisted to database for this session');
        return true;
      }

      console.log('👁️ Recording content view (YouTube-style)...');

      const contentIdNum = parseInt(contentId);
      if (!contentIdNum) {
        console.error('❌ Invalid content ID');
        return false;
      }

      // Step 1: Insert into content_views
      const { data: viewData, error: viewError } = await window.supabaseClient
        .from('content_views')
        .insert({
          content_id: contentIdNum,
          viewer_id: window.AuthHelper?.getUserProfile()?.id || null,
          session_id: sessionId,
          watched_seconds: 0,
          device_type: /Mobile|Android|iP(hone|od)|IEMobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        })
        .select()
        .single();

      if (viewError) {
        // Check if it's a duplicate (already viewed this session)
        if (viewError.code === '23505') {
          console.log('👁️ View already recorded in database (duplicate prevented)');
          this._viewPersisted = true;
          return true;
        }
        console.error('❌ Failed to record view:', viewError);
        return false;
      }

      console.log('✅ View recorded successfully in content_views:', viewData.id);

      // Step 2: Increment content.views_count using RPC
      const { error: rpcError } = await window.supabaseClient
        .rpc('increment_content_views', {
          content_id_input: contentIdNum
        });

      if (rpcError) {
        console.error('❌ Failed to increment content views count:', rpcError);
        // Don't return false - the view was still recorded
      } else {
        console.log('✅ Content views count incremented');
      }

      // Step 3: Mark as persisted
      this._viewPersisted = true;

      // Step 4: Store in sessionStorage as backup
      sessionStorage.setItem(
        `view_recorded_${contentIdNum}_${sessionId}`,
        Date.now().toString()
      );

      // Step 5: Update frontend UI immediately (optimistic update)
      this.incrementFrontendViewCount();

      return true;

    } catch (error) {
      console.error('❌ View recording crashed:', error);
      return false;
    } finally {
      this._isRecordingView = false;
    }
  }

  /**
   * 🔧 VIEWS FIX: Increment frontend view count (optimistic update)
   */
  incrementFrontendViewCount() {
    const selectors = [
      '.view-count',
      '.views-count',
      '[data-view-count]',
      '#viewsCount',
      '#viewsCountFull'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const current = parseInt(el.textContent.replace(/\D/g, '')) || 0;
        const newViews = current + 1;
        if (el.textContent.includes('views')) {
          el.textContent = `${VideoPlayerFeatures.formatNumber(newViews)} views`;
        } else {
          el.textContent = VideoPlayerFeatures.formatNumber(newViews);
        }
        console.log(`📊 Updated view count for ${selector}: ${newViews}`);
      });
    });
  }

  /**
   * Format number with K/M suffixes
   */
  static formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  /**
   * Mark content as viewed in localStorage
   */
  static markContentAsViewed(contentId) {
    try {
      const viewedContent = JSON.parse(
        localStorage.getItem('bantu_viewed_content') || '{}'
      );
      viewedContent[contentId] = Date.now();
      localStorage.setItem(
        'bantu_viewed_content',
        JSON.stringify(viewedContent)
      );
    } catch (error) {
      console.warn('Could not mark content as viewed:', error);
    }
  }

  /**
   * Check if content was viewed recently
   */
  static hasViewedContent(contentId) {
    try {
      const viewedContent = JSON.parse(
        localStorage.getItem('bantu_viewed_content') || '{}'
      );
      const viewTime = viewedContent[contentId];
      if (!viewTime) return false;
      return (Date.now() - viewTime) < 3600000; // 1 hour window
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear view cache
   */
  static clearViewCache() {
    localStorage.removeItem('bantu_viewed_content');
    console.log('🧹 View cache cleared');
  }

  /**
   * CRITICAL FIX #4: Fix memory leaks with safe cleanup
   */
  setupMemoryLeakFix() {

    console.log('🔧 Setting up memory leak fixes...');
    
    if (window.EnhancedVideoPlayer && window.EnhancedVideoPlayer.prototype) {

      const originalDestroy =
        window.EnhancedVideoPlayer.prototype.destroy;
      
      window.EnhancedVideoPlayer.prototype.destroy = function() {

        console.log('🧹 Cleaning up video player resources...');
        
        if (this.video) {

          this.video.pause();

          if (!this.video.dataset.keepSource) {
            this.video.src = '';
            this.video.load();
          }
        }
        
        if (this.bufferingTimeout) {
          clearTimeout(this.bufferingTimeout);
        }

        if (this.networkCheckInterval) {
          clearInterval(this.networkCheckInterval);
        }
        
        if (this.video) {

          const events = [
            'play',
            'pause',
            'ended',
            'error',
            'waiting',
            'canplay',
            'canplaythrough',
            'loadeddata',
            'loadedmetadata',
            'timeupdate',
            'progress',
            'seeking',
            'seeked',
            'volumechange',
            'ratechange'
          ];

          events.forEach(event => {

            this.video.removeEventListener(
              event,
              this.handleVideoEvent
            );
          });
        }
        
        if (this.controls && this.controls.parentNode) {

          this.controls.parentNode.removeChild(this.controls);
        }
        
        if (this.eventListeners) {

          this.eventListeners.clear();
        }
        
        if (originalDestroy) {

          originalDestroy.call(this);
        }
        
        console.log(
          '✅ Video player resources cleaned up'
        );
      };
      
      console.log('✅ Memory leak fixes applied');
    }
  }

  /**
   * PHASE 1D: Clear playback state on page unload
   */
  setupPlaybackStateCleanup() {
    window.addEventListener('beforeunload', () => {
      // Only save final state, don't destroy player aggressively
      const videoElement = document.getElementById('inlineVideoPlayer');
      if (videoElement && window.currentContent) {
        const playbackState = {
          queue: this.queueItems,
          currentIndex: this.currentQueueIndex,
          currentTime: videoElement.currentTime,
          isPlaying: !videoElement.paused,
          timestamp: Date.now(),
          contentId: window.currentContent?.id,
          isPlaylistMode: window.isPlaylistMode || false,
          playlistId: window.currentPlaylist?.id,
          playlistIndex: window.currentPlaylistIndex
        };
        localStorage.setItem('bantu_playback_state', JSON.stringify(playbackState));
      }
      
      if (window.isPlaylistMode && window.currentPlaylist) {
        this.saveCurrentPlaylist();
      }
      
      if (this.playlistSyncInterval) {
        clearInterval(this.playlistSyncInterval);
      }
    });
  }

  /**
   * Initialize all Phase 1 fixes and Phase 1D enhancements
   */
  initialize() {

    if (this.initialized) return;
    
    // Store reference to self for static methods
    window.videoPlayerFeatures = this;
    
    console.log(
      '🚀 Initializing Phase 1 video player fixes and Phase 1D enhancements...'
    );
    
    this.removeDuplicateControls();
    this.setupFullscreenFix();
    this.setupMemoryLeakFix();
    this.setupQueueControls();
    this.restoreQueueFromStorage();
    this.setupAutoplayOnEnded();
    this.setupPlaybackStateCleanup();
    this.syncQueueWithPlaylistUI();
    
    this.initialized = true;

    console.log(
      '✅ Phase 1 and Phase 1D fixes initialized successfully'
    );
    
    this.setupAdditionalEventListeners();
    this.setupPlaybackTracking(); // ✅ NEW: Track playback for cleanup prevention
    this.setupUIInteractionTracking(); // ✅ NEW: Track UI interactions
  }
  
  /**
   * ✅ CRITICAL FIX #7: Track playback for cleanup prevention
   */
  setupPlaybackTracking() {
    const videoElement = document.getElementById('inlineVideoPlayer');
    if (!videoElement) return;
    
    videoElement.addEventListener('play', () => {
      this.markPlaybackStarted();
    });
    
    videoElement.addEventListener('pause', () => {
      this.markPlaybackEnded();
    });
    
    videoElement.addEventListener('ended', () => {
      this.markPlaybackEnded();
    });
    
    console.log('✅ Playback tracking initialized');
  }
  
  /**
   * ✅ CRITICAL FIX #8: Track UI interactions to prevent cleanup
   */
  setupUIInteractionTracking() {
    // Track play/pause button interactions
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 500);
      });
    }
    
    // Track settings menu interactions
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 300);
      });
    }
    
    // Track album expand/collapse - Note: Album UI is now handled by content-detail.js,
    // but we still need to track the interaction to prevent cleanup
    const albumToggleBtn = document.getElementById('albumToggleBtn');
    if (albumToggleBtn) {
      albumToggleBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 500);
      });
    }
    
    // Track like button
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 300);
      });
    }
    
    // Track favorite button
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 300);
      });
    }
    
    // Track watch later button
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
      watchLaterBtn.addEventListener('click', () => {
        this.markContentChangeStart();
        setTimeout(() => this.markContentChangeEnd(), 300);
      });
    }
    
    console.log('✅ UI interaction tracking initialized');
  }

  /**
   * Setup additional event listeners
   */
  setupAdditionalEventListeners() {

    document.addEventListener('keydown', (e) => {

      if (!window.enhancedVideoPlayer) return;
      
      switch (e.key.toLowerCase()) {

        case ' ':
        case 'k':

          e.preventDefault();
          window.enhancedVideoPlayer.togglePlay();
          break;

        case 'f':

          if (window.enhancedVideoPlayer.toggleFullscreen) {

            e.preventDefault();
            window.enhancedVideoPlayer.toggleFullscreen();
          }
          break;

        case 'm':

          if (window.enhancedVideoPlayer.video) {

            e.preventDefault();
            window.enhancedVideoPlayer.video.muted =
              !window.enhancedVideoPlayer.video.muted;
          }
          break;

        case 'arrowleft':

          e.preventDefault();

          if (window.enhancedVideoPlayer.video) {

            window.enhancedVideoPlayer.video.currentTime -= 10;
          }
          break;

        case 'arrowright':

          e.preventDefault();

          if (window.enhancedVideoPlayer.video) {

            window.enhancedVideoPlayer.video.currentTime += 10;
          }
          break;
          
        case 'n':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.playNextTrack();
          }
          break;
          
        case 'p':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.playPreviousTrack();
          }
          break;
          
        case 'a':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const autoplayToggle = document.getElementById('autoplayToggle');
            if (autoplayToggle) {
              const isActive = autoplayToggle.classList.toggle('active');
              localStorage.setItem('bantu_autoplay_enabled', isActive);
              console.log('🎵 Autoplay toggled via keyboard:', isActive ? 'ON' : 'OFF');
            }
          }
          break;
      }
    });
    
    const videoContainer =
      document.querySelector('.video-container');

    if (videoContainer) {

      videoContainer.addEventListener('dblclick', () => {

        if (
          window.enhancedVideoPlayer &&
          window.enhancedVideoPlayer.toggleFullscreen
        ) {

          window.enhancedVideoPlayer.toggleFullscreen();
        }
      });
    }
  }

  /**
   * Touch device support
   */
  setupTouchDeviceSupport() {

    if ('ontouchstart' in window) {

      const videoContainer =
        document.querySelector('.video-container');

      if (videoContainer) {

        let touchTimer;
        
        videoContainer.addEventListener('touchstart', () => {

          if (
            window.enhancedVideoPlayer &&
            window.enhancedVideoPlayer.controls
          ) {

            window.enhancedVideoPlayer.controls.style.opacity = '1';

            window.enhancedVideoPlayer.controls.style.pointerEvents = 'all';
            
            clearTimeout(touchTimer);

            touchTimer = setTimeout(() => {

              if (
                window.enhancedVideoPlayer &&
                window.enhancedVideoPlayer.controls &&
                !window.enhancedVideoPlayer.video.paused
              ) {

                window.enhancedVideoPlayer.controls.style.opacity = '0';

                window.enhancedVideoPlayer.controls.style.pointerEvents = 'none';
              }

            }, 3000);
          }
        });
      }
    }
  }
  
  /**
   * PHASE 1D: Public method to set queue items
   */
  setQueue(items, currentIndex = 0) {
    this.queueItems = items || [];
    this.currentQueueIndex = currentIndex;
    
    localStorage.setItem('bantu_active_queue', JSON.stringify({
      queue: this.queueItems,
      currentIndex: this.currentQueueIndex,
      timestamp: Date.now()
    }));
    
    console.log('📋 Queue set:', this.queueItems.length, 'items');
  }
  
  /**
   * PHASE 1D: Get current queue
   */
  getQueue() {
    return {
      items: this.queueItems,
      currentIndex: this.currentQueueIndex
    };
  }
  
  /**
   * PHASE 1D: Clear queue
   */
  clearQueue() {
    this.queueItems = [];
    this.currentQueueIndex = 0;
    localStorage.removeItem('bantu_active_queue');
    localStorage.removeItem('bantu_playback_state');
    console.log('🗑️ Queue cleared');
  }
  
  /**
   * PHASE 1D: Update playlist UI when track changes
   */
  updatePlaylistUIOnTrackChange(contentId) {
    this.highlightActiveQueueItem(contentId);
    
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');
    const nowPlayingThumb = document.getElementById('nowPlayingThumb');
    
    if (nowPlayingTitle && window.currentContent) {
      nowPlayingTitle.textContent = window.currentContent.title || 'Now Playing';
    }
    
    if (nowPlayingThumb && window.currentContent?.thumbnail_url) {
      nowPlayingThumb.src = window.currentContent.thumbnail_url;
    }
    
    if (window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
      const currentIndex = window.currentPlaylistItems.findIndex(i => i.id === contentId);
      const progressEl = document.getElementById('playlistProgress');
      if (progressEl && currentIndex >= 0) {
        const percent = ((currentIndex + 1) / window.currentPlaylistItems.length) * 100;
        progressEl.style.width = `${percent}%`;
        
        const progressText = document.getElementById('playlistProgressText');
        if (progressText) {
          progressText.textContent = `${currentIndex + 1} / ${window.currentPlaylistItems.length}`;
        }
      }
    }
  }
  
  /**
   * Initialize view recording for a specific session
   */
  async initializeViewRecording(contentId) {
    // Generate or retrieve session ID
    if (!this._currentSessionId) {
      this._currentSessionId = sessionStorage.getItem('bantu_view_session');
      if (!this._currentSessionId) {
        this._currentSessionId = crypto.randomUUID();
        sessionStorage.setItem('bantu_view_session', this._currentSessionId);
      }
    }
    
    // Reset persistence flag for new content
    this._viewPersisted = false;
    this._isRecordingView = false;
    
    // Record the view
    return await this.recordView(contentId, this._currentSessionId);
  }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  setTimeout(() => {

    const videoPlayerFeatures = new VideoPlayerFeatures();

    videoPlayerFeatures.initialize();

    videoPlayerFeatures.setupTouchDeviceSupport();
    
    // 🔧 ALBUM ARCHITECTURE FIX: Album toggle setup REMOVED from here
    // Album UI is now handled EXCLUSIVELY by content-detail.js
    // This prevents duplicate event handlers and DOM synchronization issues
    
    // Expose helper methods globally
    window.clearViewCache = () =>
      VideoPlayerFeatures.clearViewCache();

    window.hasViewedContent = (id) =>
      VideoPlayerFeatures.hasViewedContent(id);
    
    window.setVideoQueue = (items, currentIndex) =>
      videoPlayerFeatures.setQueue(items, currentIndex);
    
    window.getVideoQueue = () =>
      videoPlayerFeatures.getQueue();
    
    window.clearVideoQueue = () =>
      videoPlayerFeatures.clearQueue();
    
    window.highlightQueueItem = (contentId) =>
      videoPlayerFeatures.highlightActiveQueueItem(contentId);
    
    window.updatePlaylistUI = (contentId) =>
      videoPlayerFeatures.updatePlaylistUIOnTrackChange(contentId);
    
    window.playNextTrack = () =>
      videoPlayerFeatures.playNextTrack();
    
    window.playPreviousTrack = () =>
      videoPlayerFeatures.playPreviousTrack();
    
    // Expose cleanup control methods
    window.safeCleanup = (force) =>
      videoPlayerFeatures.safeCleanup(force);
    
    window.markContentChangeStart = () =>
      videoPlayerFeatures.markContentChangeStart();
    
    window.markContentChangeEnd = () =>
      videoPlayerFeatures.markContentChangeEnd();
    
    // Expose view recording methods
    window.recordContentView = (contentId) =>
      videoPlayerFeatures.initializeViewRecording(contentId);
    
    window.incrementFrontendViewCount = () =>
      videoPlayerFeatures.incrementFrontendViewCount();

  }, 1000);
});

window.VideoPlayerFeatures = VideoPlayerFeatures;

console.log(
  '✅ Video Player Features (Phase 1 + Phase 1D) loaded - FULLY FIXED with:'
);
console.log('  ✅ CRITICAL FIX #7: Prevent cleanup during active playback');
console.log('  ✅ CRITICAL FIX #8: Prevent cleanup during UI interactions');
console.log('  ✅ CRITICAL FIX #9: Only destroy player on page unload or true content change');
console.log('  ✅ Playlist autoplay and queue sync');
console.log('  🔧 VIEWS FIX #1-4: View recording with RPC and frontend updates (NO premature early exit)');
console.log('  🔧 ALBUM ARCHITECTURE FIX: REMOVED duplicate album toggle system - album UI now ONLY in content-detail.js');
