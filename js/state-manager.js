// js/state-manager.js — Bantu Stream Connect State Manager
// Phase 3 Schema Integration + Phase 1D Collection/Queue Enhancements
// ✅ View state persistence with DB confirmation tracking
// ✅ Album/playlist state management with track source detection
// ✅ Session recovery with cleanup prevention guards
// ✅ Content view recording with RPC confirmation flow
// ✅ Collection/series context tracking for recommendations
// ✅ Queue state synchronization with playback session
// ✅ Graceful degradation and offline-first caching

(function() {
  'use strict';
  
  console.log('🗄️ StateManager module loading... (Phase 3 + Phase 1D Enhanced)');

  /**
   * StateManager — Centralized application state with persistence, 
   * subscriptions, and Phase 3/1D feature integration
   */
  class StateManager {
    constructor(config = {}) {
      // Configuration
      this.config = {
        storageKey: config.storageKey || 'bantu_state',
        cacheTTL: config.cacheTTL || 3600000, // 1 hour default
        syncRetryLimit: config.syncRetryLimit || 3,
        syncRetryDelay: config.syncRetryDelay || 2000,
        ...config
      };
      
      // Core state tree
      this.state = {
        // User & Authentication
        user: null,
        auth: {
          isLoading: false,
          error: null,
          lastVerified: null
        },
        
        // User Preferences (persisted)
        preferences: {
          theme: 'dark',
          playbackSpeed: 1.0,
          autoplay: true,
          quality: 'auto',
          subtitles: null,
          notifications: {
            enabled: true,
            newReleases: true,
            creatorUpdates: true
          }
        },
        
        // Engagement State (persisted as arrays for JSON serialization)
        favorites: [],
        likes: [],
        connections: [], // Followed creators
        watchHistory: {},
        
        // 🔧 VIEWS FIX: View recording state with DB confirmation tracking
        viewRecording: {
          currentSessionId: null,
          recordedContentIds: [], // Array for JSON serialization
          pendingRecordings: {}, // { contentId: { timestamp, retries, data } }
          lastViewTimestamp: null,
          validationCallbacks: {} // { contentId: [callbacks] } for post-validation actions
        },
        
        // 🔧 ALBUM FIX: Album/Playlist state with multi-source support
        album: {
          currentAlbumId: null,
          currentPlaylistId: null,
          currentAlbumTracks: [],
          currentTrackIndex: -1,
          albumTrackSources: {}, // { albumId: { tracks, source, timestamp, metadata } }
          expandedState: [], // Array of expanded album IDs
          queueContext: null // { playlistId, startIndex, autoAdvance }
        },
        
        // Content & Playback State
        currentContent: null,
        contentLoading: false,
        contentError: null,
        
        session: {
          currentContentId: null,
          playbackSessionId: null, // Phase 3: playback_sessions UUID
          currentTime: 0,
          duration: 0,
          playing: false,
          volume: 1.0,
          muted: false,
          lastActivityTime: Date.now(),
          isCleanupBlocked: false, // Critical: prevent cleanup during interactions
          deviceInfo: null // Populated on init
        },
        
        // Phase 1D: Collection/Series Context
        collection: {
          currentCollectionId: null,
          currentEpisodeNumber: null,
          currentSortIndex: null,
          collectionMetadata: null
        },
        
        // Phase 1D: Queue State
        queue: {
          items: [],
          currentIndex: 0,
          shuffleMode: false,
          repeatMode: 'off', // 'off' | 'one' | 'all'
          source: null // 'playlist' | 'collection' | 'manual'
        },
        
        // Caching Layer (not persisted)
        cache: {
          content: new Map(), // contentId -> { data, cachedAt, expiresAt }
          creators: new Map(),
          albums: new Map(),
          tracks: new Map(),
          recommendations: new Map(),
          metrics: new Map() // For content_public_metrics caching
        },
        
        // UI State (ephemeral)
        ui: {
          activeModal: null,
          toastQueue: [],
          loadingOverlays: {},
          sidebarCollapsed: false,
          nowPlayingExpanded: false
        }
      };
      
      // Subscription system
      this.listeners = new Map(); // path -> Set<callback>
      this.wildcardListeners = new Set();
      
      // Sync & Queue Management
      this.isLoading = false;
      this.pendingActions = [];
      this.syncQueue = [];
      this.isSyncing = false;
      this.offlineQueue = [];
      
      // Debounced function placeholder
      this._debouncedWatchHistoryUpdate = null;
      
      // Initialization
      this._initDeviceDetection();
      this._initSessionManagement();
      this._initDebouncedWatchHistory();
      this.init();
      
      console.log('✅ StateManager initialized', {
        userId: this.state.user?.id || 'guest',
        sessionId: this.state.session.playbackSessionId,
        collectionId: this.state.collection.currentCollectionId
      });
    }
    
    // =====================================================
    // INITIALIZATION
    // =====================================================
    
    init() {
      this._loadPersistedState();
      this._setupPersistence();
      this._setupSessionRecovery();
      this._setupViewStateRecovery();
      this._setupNetworkHandling();
      this._setupVisibilityHandling();
    }
    
    _initDeviceDetection() {
      const ua = navigator.userAgent || '';
      this.state.session.deviceInfo = {
        isMobile: /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(ua),
        isTablet: /Tablet|iPad/i.test(ua),
        platform: navigator.platform,
        language: navigator.language,
        connection: navigator.connection?.effectiveType || 'unknown'
      };
    }
    
    _initSessionManagement() {
      // Generate or restore playback session ID (Phase 3)
      if (!this.state.session.playbackSessionId) {
        const existing = sessionStorage.getItem('bantu_playback_session');
        this.state.session.playbackSessionId = existing || this._generateUUID();
        sessionStorage.setItem('bantu_playback_session', this.state.session.playbackSessionId);
      }
      
      // Generate or restore view recording session
      if (!this.state.viewRecording.currentSessionId) {
        const existing = sessionStorage.getItem('bantu_view_session');
        this.state.viewRecording.currentSessionId = existing || this._generateUUID();
        sessionStorage.setItem('bantu_view_session', this.state.viewRecording.currentSessionId);
      }
    }
    
    _generateUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // =====================================================
    // PERSISTENCE LAYER
    // =====================================================
    
    _loadPersistedState() {
      try {
        const saved = localStorage.getItem(this.config.storageKey);
        if (!saved) return;
        
        const parsed = JSON.parse(saved);
        
        // Merge persisted state with defaults, converting arrays back to Sets where needed
        this.state = {
          ...this.state,
          user: parsed.user || null,
          preferences: { ...this.state.preferences, ...(parsed.preferences || {}) },
          favorites: parsed.favorites || [],
          likes: parsed.likes || [],
          connections: parsed.connections || [],
          watchHistory: parsed.watchHistory || {},
          
          // View recording state
          viewRecording: {
            ...this.state.viewRecording,
            currentSessionId: parsed.viewRecording?.currentSessionId || this.state.viewRecording.currentSessionId,
            recordedContentIds: parsed.viewRecording?.recordedContentIds || [],
            pendingRecordings: parsed.viewRecording?.pendingRecordings || {},
            lastViewTimestamp: parsed.viewRecording?.lastViewTimestamp || null
          },
          
          // Album state
          album: {
            ...this.state.album,
            currentAlbumId: parsed.album?.currentAlbumId || null,
            currentAlbumTracks: parsed.album?.currentAlbumTracks || [],
            currentTrackIndex: parsed.album?.currentTrackIndex ?? -1,
            albumTrackSources: parsed.album?.albumTrackSources || {},
            expandedState: parsed.album?.expandedState || [],
            queueContext: parsed.album?.queueContext || null
          },
          
          // Session state (partial restore)
          session: {
            ...this.state.session,
            currentContentId: parsed.session?.currentContentId || null,
            currentTime: parsed.session?.currentTime || 0,
            volume: parsed.session?.volume ?? 1.0,
            muted: parsed.session?.muted ?? false
          },
          
          // Collection context
          collection: {
            ...this.state.collection,
            currentCollectionId: parsed.collection?.currentCollectionId || null,
            currentEpisodeNumber: parsed.collection?.currentEpisodeNumber || null,
            currentSortIndex: parsed.collection?.currentSortIndex ?? null
          },
          
          // Queue state
          queue: {
            ...this.state.queue,
            items: parsed.queue?.items || [],
            currentIndex: parsed.queue?.currentIndex ?? 0,
            shuffleMode: parsed.queue?.shuffleMode ?? false,
            repeatMode: parsed.queue?.repeatMode || 'off',
            source: parsed.queue?.source || null
          }
        };
        
        // Restore session IDs from sessionStorage (higher priority than localStorage)
        const playbackSession = sessionStorage.getItem('bantu_playback_session');
        if (playbackSession) {
          this.state.session.playbackSessionId = playbackSession;
        }
        
        const viewSession = sessionStorage.getItem('bantu_view_session');
        if (viewSession) {
          this.state.viewRecording.currentSessionId = viewSession;
        }
        
        console.log('💾 Persisted state loaded');
        
      } catch (error) {
        console.error('❌ Failed to load persisted state:', error);
        this._handleCorruptedState();
      }
    }
    
    _handleCorruptedState() {
      console.warn('🗑️ State corrupted, resetting to defaults');
      localStorage.removeItem(this.config.storageKey);
      
      // Reset critical state while preserving device info
      this.state = {
        ...this.state,
        user: null,
        favorites: [],
        likes: [],
        connections: [],
        watchHistory: {},
        viewRecording: {
          currentSessionId: this._generateUUID(),
          recordedContentIds: [],
          pendingRecordings: {},
          lastViewTimestamp: null,
          validationCallbacks: {}
        },
        album: {
          currentAlbumId: null,
          currentPlaylistId: null,
          currentAlbumTracks: [],
          currentTrackIndex: -1,
          albumTrackSources: {},
          expandedState: [],
          queueContext: null
        },
        session: {
          ...this.state.session,
          currentContentId: null,
          currentTime: 0,
          playing: false
        },
        collection: {
          currentCollectionId: null,
          currentEpisodeNumber: null,
          currentSortIndex: null,
          collectionMetadata: null
        },
        queue: {
          items: [],
          currentIndex: 0,
          shuffleMode: false,
          repeatMode: 'off',
          source: null
        }
      };
      
      // Regenerate session IDs
      sessionStorage.setItem('bantu_playback_session', this.state.session.playbackSessionId);
      sessionStorage.setItem('bantu_view_session', this.state.viewRecording.currentSessionId);
    }
    
    _setupPersistence() {
      let saveTimeout = null;
      let lastSaveTime = 0;
      const SAVE_THROTTLE_MS = 1000;
      const MIN_SAVE_INTERVAL_MS = 5000;
      
      const saveState = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        
        // Throttle saves
        const now = Date.now();
        if (now - lastSaveTime < MIN_SAVE_INTERVAL_MS) {
          saveTimeout = setTimeout(saveState, MIN_SAVE_INTERVAL_MS - (now - lastSaveTime));
          return;
        }
        
        saveTimeout = setTimeout(() => {
          try {
            // Prepare state for serialization (exclude non-serializable fields)
            const stateToSave = {
              user: this.state.user,
              preferences: this.state.preferences,
              favorites: this.state.favorites,
              likes: this.state.likes,
              connections: this.state.connections,
              watchHistory: this.state.watchHistory,
              
              viewRecording: {
                currentSessionId: this.state.viewRecording.currentSessionId,
                recordedContentIds: this.state.viewRecording.recordedContentIds,
                pendingRecordings: this.state.viewRecording.pendingRecordings,
                lastViewTimestamp: this.state.viewRecording.lastViewTimestamp
              },
              
              album: {
                currentAlbumId: this.state.album.currentAlbumId,
                currentPlaylistId: this.state.album.currentPlaylistId,
                currentAlbumTracks: this.state.album.currentAlbumTracks,
                currentTrackIndex: this.state.album.currentTrackIndex,
                albumTrackSources: this.state.album.albumTrackSources,
                expandedState: this.state.album.expandedState,
                queueContext: this.state.album.queueContext
              },
              
              session: {
                currentContentId: this.state.session.currentContentId,
                currentTime: this.state.session.currentTime,
                volume: this.state.session.volume,
                muted: this.state.session.muted
              },
              
              collection: {
                currentCollectionId: this.state.collection.currentCollectionId,
                currentEpisodeNumber: this.state.collection.currentEpisodeNumber,
                currentSortIndex: this.state.collection.currentSortIndex
              },
              
              queue: {
                items: this.state.queue.items,
                currentIndex: this.state.queue.currentIndex,
                shuffleMode: this.state.queue.shuffleMode,
                repeatMode: this.state.queue.repeatMode,
                source: this.state.queue.source
              }
            };
            
            localStorage.setItem(this.config.storageKey, JSON.stringify(stateToSave));
            lastSaveTime = Date.now();
            
          } catch (error) {
            console.error('❌ Failed to save state:', error);
            // Don't retry on quota errors
            if (error.name !== 'QuotaExceededError') {
              saveTimeout = setTimeout(saveState, 5000);
            }
          }
        }, SAVE_THROTTLE_MS);
      };
      
      // Auto-save on any state change via wildcard subscription
      this.subscribe('*', () => {
        // Only save if user is authenticated or has engagement data
        if (this.state.user || this.state.favorites.length > 0 || 
            this.state.likes.length > 0 || Object.keys(this.state.watchHistory).length > 0) {
          saveState();
        }
      });
      
      // Save on page hide (mobile optimization)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          saveState();
        }
      });
    }
    
    _setupSessionRecovery() {
      // Save critical state before unload
      window.addEventListener('beforeunload', () => {
        this._savePlaybackState();
        this._saveViewRecordingState();
        this._saveQueueState();
      });
      
      // Restore interrupted playback on load
      this._restorePlaybackState();
    }
    
    _savePlaybackState() {
      const { currentContentId, currentTime, playbackSessionId } = this.state.session;
      
      if (currentContentId && currentTime > 0 && playbackSessionId) {
        try {
          localStorage.setItem(
            `playback_${currentContentId}`,
            JSON.stringify({
              time: currentTime,
              sessionId: playbackSessionId,
              timestamp: Date.now(),
              duration: this.state.session.duration
            })
          );
        } catch (e) {
          console.warn('⚠️ Failed to save playback state:', e);
        }
      }
    }
    
    _restorePlaybackState() {
      try {
        const interruptedKeys = Object.keys(localStorage)
          .filter(key => key.startsWith('playback_'));
        
        interruptedKeys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const contentId = key.replace('playback_', '');
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            // Only restore recent, valid playback state
            if (data.timestamp && 
                Date.now() - data.timestamp < maxAge && 
                data.time > 0 && 
                !this.state.watchHistory[contentId]?.completed) {
              
              if (!this.state.watchHistory[contentId]) {
                this.state.watchHistory[contentId] = {};
              }
              
              this.state.watchHistory[contentId] = {
                ...this.state.watchHistory[contentId],
                resumeTime: data.time,
                lastWatched: data.timestamp,
                duration: data.duration,
                playbackSessionId: data.sessionId
              };
              
              console.log('🔄 Restored playback state for content:', contentId);
            }
            
            // Clean up restored entry
            localStorage.removeItem(key);
            
          } catch (e) {
            console.warn('⚠️ Failed to parse playback state for', key, e);
            localStorage.removeItem(key);
          }
        });
        
      } catch (error) {
        console.error('❌ Failed to restore playback state:', error);
      }
    }
    
    _saveViewRecordingState() {
      try {
        const viewState = {
          sessionId: this.state.viewRecording.currentSessionId,
          recordedIds: this.state.viewRecording.recordedContentIds,
          pendingCount: Object.keys(this.state.viewRecording.pendingRecordings).length,
          timestamp: Date.now()
        };
        sessionStorage.setItem('bantu_view_state', JSON.stringify(viewState));
      } catch (e) {
        console.warn('⚠️ Failed to save view recording state:', e);
      }
    }
    
    _saveQueueState() {
      if (this.state.queue.items.length > 0) {
        try {
          localStorage.setItem('bantu_active_queue', JSON.stringify({
            items: this.state.queue.items,
            currentIndex: this.state.queue.currentIndex,
            source: this.state.queue.source,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('⚠️ Failed to save queue state:', e);
        }
      }
    }
    
    _setupViewStateRecovery() {
      // Retry pending view recordings on load
      const pending = this.state.viewRecording.pendingRecordings;
      const pendingCount = Object.keys(pending).length;
      
      if (pendingCount > 0) {
        console.log(`🔄 Found ${pendingCount} pending view recordings to retry`);
        
        // Retry after short delay to allow network initialization
        setTimeout(() => {
          this._retryPendingViewRecordings();
        }, 3000);
      }
      
      // Listen for online event to retry failed recordings
      window.addEventListener('online', () => {
        console.log('🌐 Network restored, retrying pending view recordings');
        this._retryPendingViewRecordings();
      });
    }
    
    async _retryPendingViewRecordings() {
      const pending = this.state.viewRecording.pendingRecordings;
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      for (const [contentId, record] of Object.entries(pending)) {
        // Skip if too old or max retries exceeded
        if (now - record.timestamp > maxAge || record.retries >= this.config.syncRetryLimit) {
          console.log(`🗑️ Removing expired/failed view recording for content: ${contentId}`);
          delete this.state.viewRecording.pendingRecordings[contentId];
          continue;
        }
        
        console.log(`🔄 Retrying view recording for content: ${contentId} (attempt ${record.retries + 1})`);
        
        // Emit event for external retry handler (e.g., WatchSessionManager)
        this.notifyListeners('view:retry', {
          contentId,
          data: record.data,
          attempt: record.retries + 1
        });
      }
    }
    
    _setupNetworkHandling() {
      // Queue sync actions when offline
      window.addEventListener('offline', () => {
        console.log('📴 Offline detected, queuing sync actions');
        this.state.ui.toastQueue.push({
          type: 'warning',
          message: 'You\'re offline. Changes will sync when connection is restored.',
          duration: 5000
        });
        this.notifyListeners('ui:toast', this.state.ui.toastQueue[this.state.ui.toastQueue.length - 1]);
      });
      
      // Process offline queue when back online
      window.addEventListener('online', async () => {
        console.log('🌐 Online detected, processing queued actions');
        
        this.state.ui.toastQueue.push({
          type: 'success',
          message: 'Connection restored. Syncing changes...',
          duration: 3000
        });
        this.notifyListeners('ui:toast', this.state.ui.toastQueue[this.state.ui.toastQueue.length - 1]);
        
        await this._processOfflineQueue();
      });
    }
    
    _setupVisibilityHandling() {
      // Pause cleanup blocking when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Allow cleanup when tab is hidden (user isn't interacting)
          if (this.state.session.isCleanupBlocked && !this.state.session.playing) {
            this.blockCleanup(false);
          }
        } else {
          // Re-block cleanup when tab becomes visible and video is playing
          if (this.state.session.playing) {
            this.blockCleanup(true);
          }
        }
      });
    }
    
    // =====================================================
    // 🔧 VIEWS FIX: View Recording State Management
    // =====================================================
    
    /**
     * Mark content as viewed in state with optional DB confirmation
     * @param {string|number} contentId - Content identifier
     * @param {boolean} confirmed - Whether DB has confirmed the view
     * @param {Object} metadata - Optional recording metadata
     * @returns {boolean} Success status
     */
    markContentAsViewed(contentId, confirmed = true, metadata = {}) {
      if (!contentId) {
        console.warn('⚠️ markContentAsViewed called without contentId');
        return false;
      }
      
      const contentIdStr = String(contentId);
      
      if (confirmed) {
        // Add to confirmed recordings if not already present
        if (!this.state.viewRecording.recordedContentIds.includes(contentIdStr)) {
          this.state.viewRecording.recordedContentIds.push(contentIdStr);
        }
        
        this.state.viewRecording.lastViewTimestamp = Date.now();
        
        // Remove from pending if exists
        if (this.state.viewRecording.pendingRecordings[contentIdStr]) {
          delete this.state.viewRecording.pendingRecordings[contentIdStr];
        }
        
        // Update watch history with view confirmation
        this._updateWatchHistoryOnView(contentIdStr, metadata);
        
        console.log('✅ Content marked as viewed (confirmed):', contentIdStr);
        
        // Execute any pending validation callbacks
        const callbacks = this.state.viewRecording.validationCallbacks[contentIdStr];
        if (callbacks?.length) {
          callbacks.forEach(cb => {
            try {
              cb({ contentId: contentIdStr, confirmed: true, metadata });
            } catch (e) {
              console.error('❌ View validation callback error:', e);
            }
          });
          delete this.state.viewRecording.validationCallbacks[contentIdStr];
        }
        
        this.notifyListeners('view:recorded', { 
          contentId: contentIdStr, 
          confirmed: true, 
          metadata,
          sessionId: this.state.viewRecording.currentSessionId
        });
        
        return true;
        
      } else {
        // Add to pending recordings
        this.state.viewRecording.pendingRecordings[contentIdStr] = {
          timestamp: Date.now(),
          retries: 0,
          data: {
            contentId: contentIdStr,
            sessionId: this.state.viewRecording.currentSessionId,
            deviceId: this.state.session.deviceInfo?.platform,
            ...metadata
          }
        };
        
        console.log('⏳ Content marked as pending view:', contentIdStr);
        
        this.notifyListeners('view:pending', { 
          contentId: contentIdStr, 
          sessionId: this.state.viewRecording.currentSessionId,
          metadata 
        });
        
        return false;
      }
    }
    
    /**
     * Register callback to execute when view is confirmed by DB
     */
    onViewValidated(contentId, callback) {
      const contentIdStr = String(contentId);
      
      // If already confirmed, execute immediately
      if (this.state.viewRecording.recordedContentIds.includes(contentIdStr)) {
        callback({ contentId: contentIdStr, confirmed: true });
        return () => {}; // No-op unsubscribe
      }
      
      // Add to callbacks list
      if (!this.state.viewRecording.validationCallbacks[contentIdStr]) {
        this.state.viewRecording.validationCallbacks[contentIdStr] = [];
      }
      this.state.viewRecording.validationCallbacks[contentIdStr].push(callback);
      
      // Return unsubscribe function
      return () => {
        const cbs = this.state.viewRecording.validationCallbacks[contentIdStr];
        if (cbs) {
          const idx = cbs.indexOf(callback);
          if (idx > -1) cbs.splice(idx, 1);
          if (cbs.length === 0) {
            delete this.state.viewRecording.validationCallbacks[contentIdStr];
          }
        }
      };
    }
    
    /**
     * Check if content has been viewed (confirmed) in this session
     */
    hasViewedContent(contentId) {
      return this.state.viewRecording.recordedContentIds.includes(String(contentId));
    }
    
    /**
     * Check if content view recording is pending DB confirmation
     */
    isPendingViewRecording(contentId) {
      return !!this.state.viewRecording.pendingRecordings[String(contentId)];
    }
    
    /**
     * Get current view recording session ID
     */
    getCurrentViewSessionId() {
      return this.state.viewRecording.currentSessionId;
    }
    
    /**
     * Get playback session ID (Phase 3)
     */
    getPlaybackSessionId() {
      return this.state.session.playbackSessionId;
    }
    
    /**
     * Clear view recording state (for logout or testing)
     */
    clearViewRecordingState() {
      this.state.viewRecording.recordedContentIds = [];
      this.state.viewRecording.pendingRecordings = {};
      this.state.viewRecording.validationCallbacks = {};
      this.state.viewRecording.currentSessionId = this._generateUUID();
      this.state.viewRecording.lastViewTimestamp = null;
      
      // Update sessionStorage
      sessionStorage.setItem('bantu_view_session', this.state.viewRecording.currentSessionId);
      sessionStorage.removeItem('bantu_view_state');
      
      console.log('🗑️ View recording state cleared');
      this.notifyListeners('view:cleared', null);
    }
    
    _updateWatchHistoryOnView(contentId, metadata = {}) {
      const now = Date.now();
      
      if (!this.state.watchHistory[contentId]) {
        this.state.watchHistory[contentId] = {};
      }
      
      this.state.watchHistory[contentId] = {
        ...this.state.watchHistory[contentId],
        viewed: true,
        viewCount: (this.state.watchHistory[contentId].viewCount || 0) + 1,
        lastViewed: now,
        lastViewSessionId: this.state.viewRecording.currentSessionId,
        viewMetadata: {
          ...(this.state.watchHistory[contentId].viewMetadata || {}),
          ...metadata
        }
      };
    }
    
    // =====================================================
    // 🔧 ALBUM FIX: Album/Playlist State Management
    // =====================================================
    
    /**
     * Set current album/playlist tracks with source tracking
     * @param {string} albumId - Album/playlist identifier
     * @param {Array} tracks - Track items (any format)
     * @param {Object} options - { source, metadata, playlistId, collectionId }
     * @returns {Array} Normalized tracks
     */
    setAlbumTracks(albumId, tracks, options = {}) {
      if (!albumId) {
        console.warn('⚠️ setAlbumTracks called without albumId');
        return [];
      }
      
      const {
        source = 'unknown',
        metadata = {},
        playlistId = null,
        collectionId = null
      } = options;
      
      // Normalize tracks to consistent format
      const normalizedTracks = this._normalizeTracks(tracks, albumId);
      
      // Update current album state
      this.state.album.currentAlbumId = albumId;
      this.state.album.currentPlaylistId = playlistId;
      this.state.album.currentAlbumTracks = normalizedTracks;
      this.state.album.currentTrackIndex = -1; // Reset to start
      
      // Cache tracks with source metadata
      this.state.album.albumTrackSources[albumId] = {
        tracks: normalizedTracks,
        source,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          playlistId,
          collectionId,
          trackCount: normalizedTracks.length
        }
      };
      
      // Also cache in general cache layer
      this._cacheAlbumTracks(albumId, normalizedTracks);
      
      console.log(`📀 Album tracks set: ${albumId} (${normalizedTracks.length} tracks from ${source})`);
      
      this.notifyListeners('album:tracks-updated', {
        albumId,
        playlistId,
        collectionId,
        tracks: normalizedTracks,
        source,
        metadata
      });
      
      return normalizedTracks;
    }
    
    /**
     * Normalize tracks from various sources to consistent format
     */
    _normalizeTracks(tracks, albumId) {
      if (!Array.isArray(tracks)) return [];
      
      return tracks.map((track, index) => {
        // Already normalized
        if (track.id && track.title) {
          return {
            index,
            albumId,
            ...track
          };
        }
        
        // From DB query with nested Content object
        if (track.Content) {
          return {
            index,
            albumId,
            id: track.content_id || track.Content.id,
            content_id: track.Content.id,
            title: track.Content.title || 'Untitled',
            description: track.Content.description,
            thumbnail_url: track.Content.thumbnail_url,
            file_url: track.Content.file_url,
            duration: track.Content.duration,
            media_type: track.Content.media_type,
            genre: track.Content.genre,
            episode_number: track.Content.episode_number,
            series_id: track.Content.series_id,
            artist: track.Content.user_profiles?.full_name || 
                    track.Content.user_profiles?.username ||
                    'Unknown Artist',
            creator_id: track.Content.user_id,
            added_at: track.added_at || track.created_at || new Date().toISOString(),
            sort_index: track.sort_index ?? index,
            playlist_relation: track.playlist_relation || null,
            // Phase 3 metrics
            views_count: track.Content.content_engagement_stats?.total_views || 0,
            likes_count: track.Content.content_engagement_stats?.total_likes || 0
          };
        }
        
        // Simple object format
        return {
          index,
          albumId,
          id: track.id || track.content_id || `temp_${index}`,
          title: track.title || track.name || 'Untitled',
          description: track.description,
          thumbnail_url: track.thumbnail_url || track.thumbnail,
          file_url: track.file_url,
          duration: track.duration,
          media_type: track.media_type,
          genre: track.genre,
          episode_number: track.episode_number,
          series_id: track.series_id,
          artist: track.artist || track.creator_name || 'Unknown Artist',
          creator_id: track.creator_id || track.user_id,
          added_at: track.added_at || new Date().toISOString(),
          sort_index: track.sort_index ?? index,
          playlist_relation: track.playlist_relation || null,
          views_count: track.views_count || 0,
          likes_count: track.likes_count || 0
        };
      });
    }
    
    /**
     * Get current album tracks
     */
    getCurrentAlbumTracks() {
      return this.state.album.currentAlbumTracks;
    }
    
    /**
     * Get cached album tracks by ID
     * @param {string} albumId
     * @param {number} maxAge - Max cache age in ms (default: 5 min)
     * @returns {Array|null} Cached tracks or null
     */
    getCachedAlbumTracks(albumId, maxAge = 300000) {
      const cached = this.state.album.albumTrackSources[albumId];
      if (cached && Date.now() - cached.timestamp < maxAge) {
        return cached.tracks;
      }
      return null;
    }
    
    /**
     * Cache album tracks in general cache layer
     */
    _cacheAlbumTracks(albumId, tracks) {
      const now = Date.now();
      const expiresAt = now + this.config.cacheTTL;
      
      // Cache album
      this.state.cache.albums.set(albumId, {
        tracks,
        cachedAt: now,
        expiresAt,
        trackCount: tracks.length
      });
      
      // Cache individual tracks
      tracks.forEach(track => {
        if (track.id) {
          this.state.cache.tracks.set(track.id, {
            ...track,
            cachedAt: now,
            expiresAt,
            albumId
          });
        }
      });
      
      // Limit cache size
      this._pruneCache('albums', 50);
      this._pruneCache('tracks', 200);
    }
    
    /**
     * Get cached track by ID
     */
    getCachedTrack(trackId) {
      const cached = this.state.cache.tracks.get(trackId);
      if (cached && Date.now() < cached.expiresAt) {
        return cached;
      }
      return null;
    }
    
    /**
     * Set current track index within album
     */
    setCurrentTrackIndex(index) {
      const tracks = this.state.album.currentAlbumTracks;
      
      if (index >= 0 && index < tracks.length) {
        this.state.album.currentTrackIndex = index;
        
        this.notifyListeners('album:track-changed', {
          index,
          track: tracks[index],
          albumId: this.state.album.currentAlbumId,
          totalTracks: tracks.length
        });
        
        return true;
      }
      
      console.warn('⚠️ Invalid track index:', index, 'for album with', tracks.length, 'tracks');
      return false;
    }
    
    /**
     * Get current track
     */
    getCurrentTrack() {
      const { currentTrackIndex, currentAlbumTracks } = this.state.album;
      
      if (currentTrackIndex >= 0 && currentTrackIndex < currentAlbumTracks.length) {
        return currentAlbumTracks[currentTrackIndex];
      }
      return null;
    }
    
    /**
     * Get next track in album/playlist
     */
    getNextTrack() {
      const { currentTrackIndex, currentAlbumTracks } = this.state.album;
      const nextIndex = currentTrackIndex + 1;
      
      if (nextIndex < currentAlbumTracks.length) {
        return currentAlbumTracks[nextIndex];
      }
      return null;
    }
    
    /**
     * Get previous track in album/playlist
     */
    getPreviousTrack() {
      const { currentTrackIndex, currentAlbumTracks } = this.state.album;
      const prevIndex = currentTrackIndex - 1;
      
      if (prevIndex >= 0) {
        return currentAlbumTracks[prevIndex];
      }
      return null;
    }
    
    /**
     * Toggle album expanded/collapsed state
     */
    toggleAlbumExpanded(albumId) {
      const expanded = this.state.album.expandedState;
      const albumIdStr = String(albumId);
      const idx = expanded.indexOf(albumIdStr);
      
      if (idx > -1) {
        expanded.splice(idx, 1);
      } else {
        expanded.push(albumIdStr);
      }
      
      this.notifyListeners('album:expanded-toggled', {
        albumId: albumIdStr,
        expanded: idx === -1
      });
      
      return idx === -1;
    }
    
    /**
     * Check if album is expanded
     */
    isAlbumExpanded(albumId) {
      return this.state.album.expandedState.includes(String(albumId));
    }
    
    /**
     * Clear album state (but preserve cache)
     */
    clearAlbumState() {
      this.state.album.currentAlbumId = null;
      this.state.album.currentPlaylistId = null;
      this.state.album.currentAlbumTracks = [];
      this.state.album.currentTrackIndex = -1;
      // Preserve albumTrackSources and expandedState for UX continuity
      
      this.notifyListeners('album:cleared', null);
    }
    
    // =====================================================
    // PHASE 1D: Collection & Queue Management
    // =====================================================
    
    /**
     * Set collection/series context for recommendations
     */
    setCollectionContext(collectionId, episodeNumber = null, sortIndex = null, metadata = null) {
      this.state.collection.currentCollectionId = collectionId || null;
      this.state.collection.currentEpisodeNumber = episodeNumber ?? null;
      this.state.collection.currentSortIndex = sortIndex ?? null;
      this.state.collection.collectionMetadata = metadata || null;
      
      console.log('📁 Collection context set:', {
        collectionId,
        episodeNumber,
        sortIndex
      });
      
      this.notifyListeners('collection:context-changed', {
        collectionId,
        episodeNumber,
        sortIndex,
        metadata
      });
    }
    
    /**
     * Clear collection context
     */
    clearCollectionContext() {
      this.state.collection = {
        currentCollectionId: null,
        currentEpisodeNumber: null,
        currentSortIndex: null,
        collectionMetadata: null
      };
      this.notifyListeners('collection:context-cleared', null);
    }
    
    /**
     * Initialize or update playback queue
     */
    setQueue(items, options = {}) {
      const {
        currentIndex = 0,
        source = 'manual',
        playlistId = null,
        collectionId = null,
        shuffleMode = false,
        repeatMode = 'off'
      } = options;
      
      this.state.queue.items = items || [];
      this.state.queue.currentIndex = Math.max(0, Math.min(currentIndex, items?.length - 1 || 0));
      this.state.queue.source = source;
      this.state.queue.shuffleMode = shuffleMode;
      this.state.queue.repeatMode = repeatMode;
      
      // Link to album state if from playlist/collection
      if (playlistId || collectionId) {
        this.state.album.currentPlaylistId = playlistId;
        this.state.collection.currentCollectionId = collectionId;
      }
      
      console.log(`🎵 Queue set: ${items?.length || 0} items from ${source}`);
      
      this.notifyListeners('queue:updated', {
        items: this.state.queue.items,
        currentIndex: this.state.queue.currentIndex,
        source,
        playlistId,
        collectionId
      });
      
      // Persist queue state
      this._saveQueueState();
    }
    
    /**
     * Add item to end of queue
     */
    addToQueue(item, options = {}) {
      const { playNext = false } = options;
      
      if (playNext) {
        // Insert after current item
        this.state.queue.items.splice(this.state.queue.currentIndex + 1, 0, item);
      } else {
        // Append to end
        this.state.queue.items.push(item);
      }
      
      this.notifyListeners('queue:item-added', {
        item,
        index: playNext ? this.state.queue.currentIndex + 1 : this.state.queue.items.length - 1,
        playNext
      });
      
      this._saveQueueState();
    }
    
    /**
     * Remove item from queue by ID
     */
    removeFromQueue(contentId) {
      const idx = this.state.queue.items.findIndex(item => 
        String(item.id) === String(contentId)
      );
      
      if (idx === -1) return false;
      
      const removed = this.state.queue.items.splice(idx, 1)[0];
      
      // Adjust current index if needed
      if (idx < this.state.queue.currentIndex) {
        this.state.queue.currentIndex--;
      } else if (idx === this.state.queue.currentIndex) {
        // If removing current item, move to next or previous
        if (this.state.queue.currentIndex >= this.state.queue.items.length) {
          this.state.queue.currentIndex = Math.max(0, this.state.queue.items.length - 1);
        }
      }
      
      this.notifyListeners('queue:item-removed', {
        item: removed,
        index: idx
      });
      
      this._saveQueueState();
      return true;
    }
    
    /**
     * Get current queue item
     */
    getCurrentQueueItem() {
      return this.state.queue.items[this.state.queue.currentIndex] || null;
    }
    
    /**
     * Advance queue to next item
     */
    nextQueueItem() {
      const { items, currentIndex, repeatMode, shuffleMode } = this.state.queue;
      
      if (items.length === 0) return null;
      
      let nextIndex;
      
      if (shuffleMode) {
        // Random next (not current)
        const available = items.map((_, i) => i).filter(i => i !== currentIndex);
        nextIndex = available[Math.floor(Math.random() * available.length)];
      } else if (currentIndex < items.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // End of queue
        return null;
      }
      
      this.state.queue.currentIndex = nextIndex;
      
      this.notifyListeners('queue:advanced', {
        currentIndex: nextIndex,
        item: items[nextIndex],
        totalItems: items.length
      });
      
      return items[nextIndex];
    }
    
    /**
     * Go to previous queue item
     */
    previousQueueItem() {
      const { items, currentIndex, repeatMode } = this.state.queue;
      
      if (items.length === 0) return null;
      
      let prevIndex;
      
      if (currentIndex > 0) {
        prevIndex = currentIndex - 1;
      } else if (repeatMode === 'all') {
        prevIndex = items.length - 1;
      } else {
        // Start of queue
        return null;
      }
      
      this.state.queue.currentIndex = prevIndex;
      
      this.notifyListeners('queue:rewound', {
        currentIndex: prevIndex,
        item: items[prevIndex],
        totalItems: items.length
      });
      
      return items[prevIndex];
    }
    
    /**
     * Clear queue
     */
    clearQueue() {
      this.state.queue.items = [];
      this.state.queue.currentIndex = 0;
      this.state.queue.source = null;
      
      localStorage.removeItem('bantu_active_queue');
      
      this.notifyListeners('queue:cleared', null);
    }
    
    // =====================================================
    // CORE STATE API
    // =====================================================
    
    /**
     * Get state value by path (dot notation)
     */
    getState(path = null) {
      if (!path) return this._deepClone(this.state);
      return this._getNestedValue(this.state, path);
    }
    
    /**
     * Set state value by path with change notification
     */
    setState(path, value, options = {}) {
      const { notify = true, persist = true } = options;
      
      const oldValue = this._getNestedValue(this.state, path);
      const clonedValue = this._deepClone(value);
      
      this._setNestedValue(this.state, path, clonedValue);
      
      if (notify) {
        this._notifyListeners(path, clonedValue, oldValue);
      }
      
      return clonedValue;
    }
    
    /**
     * Async state update with queued execution
     */
    async updateState(path, updater) {
      return new Promise((resolve, reject) => {
        const execute = async () => {
          try {
            const current = this._getNestedValue(this.state, path);
            const newValue = await updater(current);
            const result = this.setState(path, newValue);
            resolve(result);
          } catch (error) {
            console.error('❌ State update failed:', error);
            reject(error);
          }
        };
        
        this.pendingActions.push(execute);
        
        if (this.pendingActions.length === 1) {
          this.pendingActions[0]();
        }
      });
    }
    
    // =====================================================
    // SESSION & PLAYBACK MANAGEMENT
    // =====================================================
    
    setCurrentContent(contentId, contentData = null) {
      const oldContentId = this.state.session.currentContentId;
      
      this.setState('session.currentContentId', contentId, { notify: false });
      
      if (contentData) {
        this.setState('currentContent', contentData, { notify: false });
        this.cacheContent(contentData);
      }
      
      // Notify after all updates
      this.notifyListeners('session:content-changed', {
        contentId,
        contentData,
        previousContentId: oldContentId
      });
    }
    
    setPlaybackTime(time, duration = null) {
      this.setState('session.currentTime', time, { notify: false });
      
      if (duration !== null) {
        this.setState('session.duration', duration, { notify: false });
      }
      
      // Update watch history periodically
      const contentId = this.state.session.currentContentId;
      if (contentId && time > 0) {
        this._debouncedWatchHistoryUpdate(contentId, time, duration);
      }
      
      this.notifyListeners('session:time-updated', { time, duration });
    }
    
    // Debounced watch history update (every 10 seconds)
    _initDebouncedWatchHistory() {
      let timeout = null;
      let lastContentId = null;
      
      this._debouncedWatchHistoryUpdate = (contentId, time, duration) => {
        if (timeout) clearTimeout(timeout);
        
        timeout = setTimeout(() => {
          if (contentId === lastContentId) {
            this.updateWatchHistory(contentId, time, duration);
          }
        }, 10000);
        
        lastContentId = contentId;
      };
    }
    
    setPlaying(playing) {
      const wasPlaying = this.state.session.playing;
      
      this.setState('session.playing', playing, { notify: false });
      this.setState('session.lastActivityTime', Date.now(), { notify: false });
      
      // Block cleanup during active playback
      if (playing) {
        this.blockCleanup(true);
      } else if (!this.state.session.isCleanupBlocked) {
        // Only unblock if not manually blocked
        this.blockCleanup(false);
      }
      
      this.notifyListeners('session:play-state-changed', {
        playing,
        wasPlaying,
        contentId: this.state.session.currentContentId
      });
    }
    
    setVolume(volume, muted = null) {
      this.setState('session.volume', Math.max(0, Math.min(1, volume)), { notify: false });
      
      if (muted !== null) {
        this.setState('session.muted', muted, { notify: false });
      }
      
      this.notifyListeners('session:volume-changed', {
        volume: this.state.session.volume,
        muted: muted !== null ? muted : this.state.session.muted
      });
    }
    
    /**
     * 🔧 CRITICAL FIX: Block/unblock cleanup during interactions
     */
    blockCleanup(blocked = true) {
      const wasBlocked = this.state.session.isCleanupBlocked;
      
      this.setState('session.isCleanupBlocked', blocked);
      
      if (blocked !== wasBlocked) {
        this.notifyListeners('session:cleanup-blocked', {
          blocked,
          wasBlocked,
          reason: blocked ? 'user-interaction' : 'interaction-ended'
        });
      }
    }
    
    isCleanupBlocked() {
      return this.state.session.isCleanupBlocked;
    }
    
    updateLastActivity() {
      this.setState('session.lastActivityTime', Date.now());
    }
    
    // =====================================================
    // WATCH HISTORY MANAGEMENT
    // =====================================================
    
    updateWatchHistory(contentId, time, duration) {
      const contentIdStr = String(contentId);
      const percentWatched = duration > 0 ? (time / duration) * 100 : 0;
      
      if (!this.state.watchHistory[contentIdStr]) {
        this.state.watchHistory[contentIdStr] = {};
      }
      
      this.state.watchHistory[contentIdStr] = {
        ...this.state.watchHistory[contentIdStr],
        lastWatched: Date.now(),
        resumeTime: time,
        duration: duration || this.state.watchHistory[contentIdStr].duration,
        percentWatched: Math.round(percentWatched * 10) / 10,
        completed: percentWatched >= 90,
        playbackSessionId: this.state.session.playbackSessionId
      };
      
      // Track in analytics if available
      if (window.track?.watchProgress) {
        window.track.watchProgress(contentIdStr, percentWatched, time);
      }
      
      this.notifyListeners('watch:history-updated', {
        contentId: contentIdStr,
        time,
        duration,
        percentWatched,
        completed: percentWatched >= 90
      });
    }
    
    getResumeTime(contentId) {
      const history = this.state.watchHistory[String(contentId)];
      
      if (history?.resumeTime > 0 && !history.completed) {
        return history.resumeTime;
      }
      return 0;
    }
    
    isContentCompleted(contentId) {
      return !!this.state.watchHistory[String(contentId)]?.completed;
    }
    
    // =====================================================
    // ENGAGEMENT MANAGEMENT (Favorites, Likes, Connections)
    // =====================================================
    
    _toggleEngagement(type, id) {
      const stateKey = type; // 'favorites', 'likes', 'connections'
      const idStr = String(id);
      const array = this.state[stateKey];
      const idx = array.indexOf(idStr);
      
      let newState;
      if (idx > -1) {
        array.splice(idx, 1);
        newState = false;
      } else {
        array.push(idStr);
        newState = true;
      }
      
      this.notifyListeners(stateKey, array);
      this.notifyListeners(`${stateKey}:${idStr}`, newState);
      
      // Sync with server in background
      this._syncWithServer(type, idStr, newState);
      
      return newState;
    }
    
    toggleFavorite(contentId) {
      return this._toggleEngagement('favorites', contentId);
    }
    
    isFavorite(contentId) {
      return this.state.favorites.includes(String(contentId));
    }
    
    getFavorites() {
      return [...this.state.favorites];
    }
    
    toggleLike(contentId) {
      return this._toggleEngagement('likes', contentId);
    }
    
    isLiked(contentId) {
      return this.state.likes.includes(String(contentId));
    }
    
    toggleConnection(creatorId) {
      return this._toggleEngagement('connections', creatorId);
    }
    
    isConnected(creatorId) {
      return this.state.connections.includes(String(creatorId));
    }
    
    // =====================================================
    // CONTENT CACHING
    // =====================================================
    
    cacheContent(content, options = {}) {
      if (!content?.id) return;
      
      const { ttl = this.config.cacheTTL } = options;
      const contentId = String(content.id);
      const now = Date.now();
      
      this.state.cache.content.set(contentId, {
        ...content,
        cachedAt: now,
        expiresAt: now + ttl
      });
      
      // Prune if over limit
      this._pruneCache('content', 100);
    }
    
    getCachedContent(contentId, options = {}) {
      const { checkExpiry = true } = options;
      const cached = this.state.cache.content.get(String(contentId));
      
      if (!cached) return null;
      
      if (checkExpiry && Date.now() >= cached.expiresAt) {
        this.state.cache.content.delete(String(contentId));
        return null;
      }
      
      return { ...cached };
    }
    
    _pruneCache(cacheName, maxSize) {
      const cache = this.state.cache[cacheName];
      if (!(cache instanceof Map) || cache.size <= maxSize) return;
      
      // Remove oldest entries
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt);
      
      const toRemove = entries.slice(0, cache.size - maxSize);
      toRemove.forEach(([key]) => cache.delete(key));
      
      console.log(`🧹 Pruned ${toRemove.length} entries from ${cacheName} cache`);
    }
    
    clearCache(type = null) {
      if (type && this.state.cache[type]) {
        if (this.state.cache[type] instanceof Map) {
          this.state.cache[type].clear();
        } else {
          this.state.cache[type] = {};
        }
        console.log(`🧹 Cleared ${type} cache`);
      } else {
        // Clear all caches
        Object.keys(this.state.cache).forEach(key => {
          if (this.state.cache[key] instanceof Map) {
            this.state.cache[key].clear();
          } else {
            this.state.cache[key] = {};
          }
        });
        console.log('🧹 Cleared all caches');
      }
    }
    
    // =====================================================
    // SUBSCRIPTION SYSTEM
    // =====================================================
    
    subscribe(path, callback) {
      if (path === '*') {
        this.wildcardListeners.add(callback);
        return () => this.wildcardListeners.delete(callback);
      }
      
      if (!this.listeners.has(path)) {
        this.listeners.set(path, new Set());
      }
      
      this.listeners.get(path).add(callback);
      
      return () => {
        const set = this.listeners.get(path);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.listeners.delete(path);
          }
        }
      };
    }
    
    notifyListeners(path, newValue, oldValue) {
      // Specific path listeners
      if (this.listeners.has(path)) {
        for (const callback of this.listeners.get(path)) {
          try {
            callback(newValue, oldValue, path);
          } catch (error) {
            console.error('❌ Listener error for path', path + ':', error);
          }
        }
      }
      
      // Wildcard listeners
      for (const callback of this.wildcardListeners) {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error('❌ Wildcard listener error:', error);
        }
      }
    }
    
    _notifyListeners(path, newValue, oldValue) {
      this.notifyListeners(path, newValue, oldValue);
    }
    
    // =====================================================
    // SERVER SYNC & OFFLINE SUPPORT
    // =====================================================
    
    async _syncWithServer(type, id, value) {
      try {
        console.log(`🔄 Syncing ${type}: ${id} = ${value}`);
        
        // Check if online and Supabase is available
        if (!navigator.onLine || !window.supabase) {
          throw new Error('Offline or Supabase unavailable');
        }
        
        // Route to appropriate sync handler
        switch (type) {
          case 'favorites':
            await this._syncFavorite(id, value);
            break;
          case 'likes':
            await this._syncLike(id, value);
            break;
          case 'connections':
            await this._syncConnection(id, value);
            break;
          default:
            console.warn('⚠️ Unknown sync type:', type);
        }
        
      } catch (error) {
        console.error(`❌ Failed to sync ${type}:`, error);
        this._queueForRetry({ type, id, value, error: error.message });
      }
    }
    
    async _syncFavorite(contentId, add) {
      if (!this.state.user?.id) return;
      
      if (add) {
        await window.supabase
          .from('user_favorites')
          .upsert({
            user_id: this.state.user.id,
            content_id: contentId,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id,content_id' });
      } else {
        await window.supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', this.state.user.id)
          .eq('content_id', contentId);
      }
    }
    
    async _syncLike(contentId, add) {
      // Likes are handled by content_likes table with RPC for atomic counter
      if (!this.state.user?.id) return;
      
      if (add) {
        await window.supabase
          .from('content_likes')
          .upsert({
            user_id: this.state.user.id,
            content_id: contentId
          }, { onConflict: 'user_id,content_id' });
        
        // Increment counter via RPC
        await window.supabase.rpc('increment_engagement_stats_likes', {
          target_content_id: contentId,
          increment_value: 1
        });
      } else {
        await window.supabase
          .from('content_likes')
          .delete()
          .eq('user_id', this.state.user.id)
          .eq('content_id', contentId);
        
        await window.supabase.rpc('increment_engagement_stats_likes', {
          target_content_id: contentId,
          increment_value: -1
        });
      }
    }
    
    async _syncConnection(creatorId, follow) {
      if (!this.state.user?.id) return;
      
      if (follow) {
        await window.supabase
          .from('user_connections')
          .upsert({
            user_id: this.state.user.id,
            connected_user_id: creatorId,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id,connected_user_id' });
      } else {
        await window.supabase
          .from('user_connections')
          .delete()
          .eq('user_id', this.state.user.id)
          .eq('connected_user_id', creatorId);
      }
    }
    
    _queueForRetry(action) {
      this.offlineQueue.push({
        ...action,
        timestamp: Date.now(),
        retries: 0
      });
      
      console.log(`📦 Queued for retry: ${action.type}:${action.id}`);
      
      // Process queue if not already processing and online
      if (!this.isSyncing && navigator.onLine) {
        this._processOfflineQueue();
      }
    }
    
    async _processOfflineQueue() {
      if (this.isSyncing || this.offlineQueue.length === 0) return;
      
      this.isSyncing = true;
      console.log(`🔄 Processing ${this.offlineQueue.length} queued actions`);
      
      const remaining = [];
      
      for (const action of this.offlineQueue) {
        if (action.retries >= this.config.syncRetryLimit) {
          console.warn(`🗑️ Dropping failed action after max retries: ${action.type}:${action.id}`);
          continue;
        }
        
        try {
          await this._syncWithServer(action.type, action.id, action.value);
          console.log(`✅ Synced queued action: ${action.type}:${action.id}`);
        } catch (error) {
          action.retries++;
          remaining.push(action);
          console.warn(`⚠️ Retry ${action.retries}/${this.config.syncRetryLimit} failed for ${action.type}:${action.id}`);
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, this.config.syncRetryDelay * Math.pow(2, action.retries - 1))
          );
        }
      }
      
      this.offlineQueue = remaining;
      this.isSyncing = false;
      
      if (remaining.length > 0) {
        console.log(`⏳ ${remaining.length} actions still pending retry`);
      }
    }
    
    // =====================================================
    // UI STATE MANAGEMENT
    // =====================================================
    
    showToast(message, options = {}) {
      const toast = {
        id: this._generateUUID(),
        message,
        type: options.type || 'info',
        duration: options.duration || 4000,
        action: options.action || null,
        timestamp: Date.now()
      };
      
      this.state.ui.toastQueue.push(toast);
      
      // Auto-remove after duration
      if (toast.duration > 0) {
        setTimeout(() => {
          this.removeToast(toast.id);
        }, toast.duration);
      }
      
      this.notifyListeners('ui:toast', toast);
      return toast.id;
    }
    
    removeToast(toastId) {
      const idx = this.state.ui.toastQueue.findIndex(t => t.id === toastId);
      if (idx > -1) {
        const removed = this.state.ui.toastQueue.splice(idx, 1)[0];
        this.notifyListeners('ui:toast-removed', removed);
      }
    }
    
    clearToasts() {
      this.state.ui.toastQueue = [];
      this.notifyListeners('ui:toasts-cleared', null);
    }
    
    setLoading(key, loading, options = {}) {
      if (loading) {
        this.state.ui.loadingOverlays[key] = {
          active: true,
          message: options.message || null,
          timestamp: Date.now()
        };
      } else {
        delete this.state.ui.loadingOverlays[key];
      }
      
      this.notifyListeners(`ui:loading:${key}`, { loading, ...options });
    }
    
    isLoading(key) {
      return !!this.state.ui.loadingOverlays[key]?.active;
    }
    
    // =====================================================
    // USER & AUTH MANAGEMENT
    // =====================================================
    
    setUser(userData) {
      const oldUser = this.state.user;
      
      this.setState('user', userData, { notify: false });
      this.setState('auth.lastVerified', Date.now(), { notify: false });
      
      // If user changed, clear user-specific state
      if (oldUser?.id !== userData?.id) {
        if (userData) {
          console.log('👤 User set:', userData.id);
        } else {
          console.log('👋 User cleared');
          this._clearUserState();
        }
      }
      
      this.notifyListeners('user:changed', {
        user: userData,
        previousUser: oldUser
      });
    }
    
    _clearUserState() {
      // Clear user-specific engagement data but preserve preferences
      this.state.favorites = [];
      this.state.likes = [];
      this.state.connections = [];
      this.state.watchHistory = {};
      
      // Clear view recording state
      this.clearViewRecordingState();
      
      // Clear album/queue state
      this.clearAlbumState();
      this.clearQueue();
      
      // Clear collection context
      this.clearCollectionContext();
      
      console.log('🧹 User-specific state cleared');
      this.notifyListeners('user:state-cleared', null);
    }
    
    setPreference(key, value) {
      this.setState(`preferences.${key}`, value);
    }
    
    // =====================================================
    // UTILITY METHODS
    // =====================================================
    
    _getNestedValue(obj, path) {
      return path.split('.').reduce((current, key) => {
        return current?.[key] !== undefined ? current[key] : undefined;
      }, obj);
    }
    
    _setNestedValue(obj, path, value) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      
      const target = keys.reduce((current, key) => {
        if (current[key] === undefined || typeof current[key] !== 'object') {
          current[key] = {};
        }
        return current[key];
      }, obj);
      
      target[lastKey] = value;
    }
    
    _deepClone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime());
      if (Array.isArray(obj)) return obj.map(item => this._deepClone(item));
      
      const cloned = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = this._deepClone(obj[key]);
        }
      }
      return cloned;
    }
    
    // =====================================================
    // RESET & DEBUG
    // =====================================================
    
    resetState(options = {}) {
      const {
        keepPreferences = true,
        keepCache = false,
        keepDevice = true
      } = options;
      
      const deviceInfo = keepDevice ? this.state.session.deviceInfo : null;
      const preferences = keepPreferences ? this.state.preferences : null;
      
      this.state = {
        ...this.state,
        user: null,
        auth: { isLoading: false, error: null, lastVerified: null },
        preferences: preferences || this.state.preferences,
        favorites: [],
        likes: [],
        connections: [],
        watchHistory: {},
        viewRecording: {
          currentSessionId: this._generateUUID(),
          recordedContentIds: [],
          pendingRecordings: {},
          lastViewTimestamp: null,
          validationCallbacks: {}
        },
        album: {
          currentAlbumId: null,
          currentPlaylistId: null,
          currentAlbumTracks: [],
          currentTrackIndex: -1,
          albumTrackSources: {},
          expandedState: [],
          queueContext: null
        },
        currentContent: null,
        contentLoading: false,
        contentError: null,
        session: {
          currentContentId: null,
          playbackSessionId: this._generateUUID(),
          currentTime: 0,
          duration: 0,
          playing: false,
          volume: 1.0,
          muted: false,
          lastActivityTime: Date.now(),
          isCleanupBlocked: false,
          deviceInfo: deviceInfo
        },
        collection: {
          currentCollectionId: null,
          currentEpisodeNumber: null,
          currentSortIndex: null,
          collectionMetadata: null
        },
        queue: {
          items: [],
          currentIndex: 0,
          shuffleMode: false,
          repeatMode: 'off',
          source: null
        },
        cache: keepCache ? this.state.cache : {
          content: new Map(),
          creators: new Map(),
          albums: new Map(),
          tracks: new Map(),
          recommendations: new Map(),
          metrics: new Map()
        },
        ui: {
          activeModal: null,
          toastQueue: [],
          loadingOverlays: {},
          sidebarCollapsed: false,
          nowPlayingExpanded: false
        }
      };
      
      // Update sessionStorage
      sessionStorage.setItem('bantu_playback_session', this.state.session.playbackSessionId);
      sessionStorage.setItem('bantu_view_session', this.state.viewRecording.currentSessionId);
      
      // Clear persisted state if not keeping preferences
      if (!keepPreferences) {
        localStorage.removeItem(this.config.storageKey);
      }
      
      console.log('🔄 State reset', { keepPreferences, keepCache, keepDevice });
      this.notifyListeners('*', this.state);
    }
    
    exportState() {
      // Export serializable state for debugging
      return JSON.stringify({
        user: this.state.user,
        preferences: this.state.preferences,
        favorites: this.state.favorites,
        likes: this.state.likes,
        connections: this.state.connections,
        watchHistory: this.state.watchHistory,
        viewRecording: {
          currentSessionId: this.state.viewRecording.currentSessionId,
          recordedContentIds: this.state.viewRecording.recordedContentIds,
          pendingRecordings: this.state.viewRecording.pendingRecordings,
          lastViewTimestamp: this.state.viewRecording.lastViewTimestamp
        },
        album: {
          currentAlbumId: this.state.album.currentAlbumId,
          currentPlaylistId: this.state.album.currentPlaylistId,
          currentAlbumTracks: this.state.album.currentAlbumTracks,
          currentTrackIndex: this.state.album.currentTrackIndex,
          expandedState: this.state.album.expandedState
        },
        session: {
          currentContentId: this.state.session.currentContentId,
          currentTime: this.state.session.currentTime,
          volume: this.state.session.volume,
          muted: this.state.session.muted
        },
        collection: {
          currentCollectionId: this.state.collection.currentCollectionId,
          currentEpisodeNumber: this.state.collection.currentEpisodeNumber,
          currentSortIndex: this.state.collection.currentSortIndex
        },
        queue: {
          items: this.state.queue.items,
          currentIndex: this.state.queue.currentIndex
        },
        exportedAt: new Date().toISOString()
      }, null, 2);
    }
    
    importState(jsonString) {
      try {
        const imported = JSON.parse(jsonString);
        
        // Merge imported state carefully
        this.state = {
          ...this.state,
          user: imported.user || this.state.user,
          preferences: { ...this.state.preferences, ...(imported.preferences || {}) },
          favorites: imported.favorites || this.state.favorites,
          likes: imported.likes || this.state.likes,
          connections: imported.connections || this.state.connections,
          watchHistory: imported.watchHistory || this.state.watchHistory,
          viewRecording: {
            ...this.state.viewRecording,
            ...(imported.viewRecording || {})
          },
          album: {
            ...this.state.album,
            ...(imported.album || {})
          },
          session: {
            ...this.state.session,
            ...(imported.session || {})
          },
          collection: {
            ...this.state.collection,
            ...(imported.collection || {})
          },
          queue: {
            ...this.state.queue,
            ...(imported.queue || {})
          }
        };
        
        this.notifyListeners('*', this.state);
        console.log('✅ State imported successfully');
        return true;
        
      } catch (error) {
        console.error('❌ Failed to import state:', error);
        return false;
      }
    }
  }
  
  // =====================================================
  // EXPORT & GLOBAL ACCESS
  // =====================================================
  
  // Create singleton instance
  const stateManager = new StateManager();
  
  // Export utility functions for global access
  window.state = {
    // Getters
    getUser: () => stateManager.getState('user'),
    getPreferences: () => stateManager.getState('preferences'),
    getFavorites: () => stateManager.getFavorites(),
    getWatchHistory: (contentId) => stateManager.getState(`watchHistory.${contentId}`),
    getResumeTime: (contentId) => stateManager.getResumeTime(contentId),
    isFavorite: (contentId) => stateManager.isFavorite(contentId),
    isLiked: (contentId) => stateManager.isLiked(contentId),
    isConnected: (creatorId) => stateManager.isConnected(creatorId),
    
    // View recording
    hasViewedContent: (contentId) => stateManager.hasViewedContent(contentId),
    getCurrentViewSessionId: () => stateManager.getCurrentViewSessionId(),
    getPlaybackSessionId: () => stateManager.getPlaybackSessionId(),
    markContentAsViewed: (contentId, confirmed, metadata) => 
      stateManager.markContentAsViewed(contentId, confirmed, metadata),
    onViewValidated: (contentId, callback) => 
      stateManager.onViewValidated(contentId, callback),
    clearViewRecordingState: () => stateManager.clearViewRecordingState(),
    
    // Album/Playlist
    getCurrentAlbumTracks: () => stateManager.getCurrentAlbumTracks(),
    getCurrentTrack: () => stateManager.getCurrentTrack(),
    getNextTrack: () => stateManager.getNextTrack(),
    getPreviousTrack: () => stateManager.getPreviousTrack(),
    setAlbumTracks: (albumId, tracks, options) => 
      stateManager.setAlbumTracks(albumId, tracks, options),
    setCurrentTrackIndex: (index) => stateManager.setCurrentTrackIndex(index),
    toggleAlbumExpanded: (albumId) => stateManager.toggleAlbumExpanded(albumId),
    isAlbumExpanded: (albumId) => stateManager.isAlbumExpanded(albumId),
    clearAlbumState: () => stateManager.clearAlbumState(),
    getCachedAlbumTracks: (albumId, maxAge) => 
      stateManager.getCachedAlbumTracks(albumId, maxAge),
    getCachedTrack: (trackId) => stateManager.getCachedTrack(trackId),
    
    // Queue
    setQueue: (items, options) => stateManager.setQueue(items, options),
    addToQueue: (item, options) => stateManager.addToQueue(item, options),
    removeFromQueue: (contentId) => stateManager.removeFromQueue(contentId),
    getCurrentQueueItem: () => stateManager.getCurrentQueueItem(),
    nextQueueItem: () => stateManager.nextQueueItem(),
    previousQueueItem: () => stateManager.previousQueueItem(),
    clearQueue: () => stateManager.clearQueue(),
    
    // Collection
    setCollectionContext: (collectionId, episodeNumber, sortIndex, metadata) => 
      stateManager.setCollectionContext(collectionId, episodeNumber, sortIndex, metadata),
    clearCollectionContext: () => stateManager.clearCollectionContext(),
    
    // Setters
    setUser: (userData) => stateManager.setUser(userData),
    setPreference: (key, value) => stateManager.setPreference(key, value),
    toggleFavorite: (contentId) => stateManager.toggleFavorite(contentId),
    toggleLike: (contentId) => stateManager.toggleLike(contentId),
    toggleConnection: (creatorId) => stateManager.toggleConnection(creatorId),
    
    // Session
    setCurrentContent: (contentId, contentData) => 
      stateManager.setCurrentContent(contentId, contentData),
    setPlaybackTime: (time, duration) => stateManager.setPlaybackTime(time, duration),
    setPlaying: (playing) => stateManager.setPlaying(playing),
    setVolume: (volume, muted) => stateManager.setVolume(volume, muted),
    blockCleanup: (blocked) => stateManager.blockCleanup(blocked),
    isCleanupBlocked: () => stateManager.isCleanupBlocked(),
    updateLastActivity: () => stateManager.updateLastActivity(),
    
    // Cache
    cacheContent: (content, options) => stateManager.cacheContent(content, options),
    getCachedContent: (contentId, options) => stateManager.getCachedContent(contentId, options),
    clearCache: (type) => stateManager.clearCache(type),
    
    // Subscriptions
    subscribe: (path, callback) => stateManager.subscribe(path, callback),
    
    // Watch history
    updateWatchHistory: (contentId, time, duration) => 
      stateManager.updateWatchHistory(contentId, time, duration),
    isContentCompleted: (contentId) => stateManager.isContentCompleted(contentId),
    
    // UI
    showToast: (message, options) => stateManager.showToast(message, options),
    removeToast: (toastId) => stateManager.removeToast(toastId),
    clearToasts: () => stateManager.clearToasts(),
    setLoading: (key, loading, options) => stateManager.setLoading(key, loading, options),
    isLoading: (key) => stateManager.isLoading(key),
    
    // Reset & Debug
    resetState: (options) => stateManager.resetState(options),
    exportState: () => stateManager.exportState(),
    importState: (json) => stateManager.importState(json),
    
    // Direct access to manager for advanced use
    _manager: stateManager
  };
  
  // Also expose the full manager instance
  window.stateManager = stateManager;
  
  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
  }
  
  console.log('✅ StateManager module loaded successfully (Phase 3 + Phase 1D Enhanced)');
  
})();
