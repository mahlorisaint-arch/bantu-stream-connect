// js/state-manager.js - Bantu Stream Connect State Manager
// COMPLETE FIXED VERSION WITH VIEW STATE TRACKING AND ALBUM MANAGEMENT
// ✅ FIXED: View state persistence with DB confirmation tracking
// ✅ FIXED: Album/playlist state management with track source detection
// ✅ FIXED: Session recovery with proper cleanup prevention
// ✅ FIXED: Content view recording state tracking
// 🔧 ALBUM FIX: Added albumTracks state with multiple source support
// 🔧 VIEWS FIX: Added viewRecordingState tracking

class StateManager {
  constructor() {
    this.state = {
      user: null,
      preferences: {
        theme: 'dark',
        playbackSpeed: 1.0,
        autoplay: true,
        quality: 'auto',
        subtitles: null
      },
      watchHistory: {},
      favorites: new Set(),
      likes: new Set(),
      connections: new Set(),
      
      // 🔧 VIEWS FIX: View recording state tracking
      viewRecordingState: {
        currentSessionId: null,
        recordedContentIds: new Set(), // Track which content IDs have been recorded this session
        pendingRecordings: new Map(), // Content IDs pending DB confirmation
        lastViewTimestamp: null
      },
      
      // 🔧 ALBUM FIX: Album/Playlist state
      albumState: {
        currentAlbumId: null,
        currentAlbumTracks: [],
        currentTrackIndex: -1,
        albumTrackSources: new Map(), // Cache of tracks by album ID
        expandedState: new Set() // Track which albums are expanded
      },
      
      // Content state
      currentContent: null,
      contentLoading: false,
      contentError: null,
      
      session: {
        currentContentId: null,
        currentTime: 0,
        playing: false,
        volume: 1.0,
        muted: false,
        lastActivityTime: Date.now(),
        isCleanupBlocked: false // 🔧 CRITICAL FIX: Block cleanup during interactions
      },
      
      cache: {
        content: new Map(),
        creators: new Map(),
        comments: new Map(),
        albums: new Map(), // 🔧 ALBUM FIX: Cache album data
        tracks: new Map()  // 🔧 ALBUM FIX: Cache track data
      }
    };
    
    this.listeners = new Map();
    this.isLoading = false;
    this.pendingActions = [];
    this.syncQueue = [];
    this.isSyncing = false;
    
    this.init();
  }
  
  init() {
    // Load persisted state
    this.loadPersistedState();
    
    // Setup state persistence
    this.setupPersistence();
    
    // Setup session recovery
    this.setupSessionRecovery();
    
    // Setup view state recovery
    this.setupViewStateRecovery();
  }
  
  loadPersistedState() {
    try {
      const saved = localStorage.getItem('bantu_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Merge with current state, converting Sets back from Arrays
        this.state = {
          ...this.state,
          ...parsed,
          favorites: new Set(parsed.favorites || []),
          likes: new Set(parsed.likes || []),
          connections: new Set(parsed.connections || []),
          viewRecordingState: {
            ...this.state.viewRecordingState,
            recordedContentIds: new Set(parsed.viewRecordingState?.recordedContentIds || []),
            pendingRecordings: new Map(Object.entries(parsed.viewRecordingState?.pendingRecordings || {})),
            currentSessionId: parsed.viewRecordingState?.currentSessionId || null,
            lastViewTimestamp: parsed.viewRecordingState?.lastViewTimestamp || null
          },
          albumState: {
            ...this.state.albumState,
            expandedState: new Set(parsed.albumState?.expandedState || []),
            albumTrackSources: new Map(Object.entries(parsed.albumState?.albumTrackSources || {}))
          },
          cache: this.state.cache // Don't restore cache from storage
        };
      }
      
      // Restore view recording session if exists
      this.restoreViewRecordingSession();
      
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      this.clearCorruptedState();
    }
  }
  
  restoreViewRecordingSession() {
    // Check if there's an existing session in sessionStorage
    const existingSession = sessionStorage.getItem('bantu_view_session');
    if (existingSession && !this.state.viewRecordingState.currentSessionId) {
      this.state.viewRecordingState.currentSessionId = existingSession;
      console.log('♻️ Restored view recording session:', existingSession);
    } else if (!this.state.viewRecordingState.currentSessionId) {
      // Create new session if none exists
      this.state.viewRecordingState.currentSessionId = this.generateSessionId();
      sessionStorage.setItem('bantu_view_session', this.state.viewRecordingState.currentSessionId);
      console.log('🆕 Created new view recording session');
    }
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  clearCorruptedState() {
    localStorage.removeItem('bantu_state');
    this.state = {
      ...this.state,
      favorites: new Set(),
      likes: new Set(),
      connections: new Set(),
      viewRecordingState: {
        currentSessionId: this.generateSessionId(),
        recordedContentIds: new Set(),
        pendingRecordings: new Map(),
        lastViewTimestamp: null
      },
      albumState: {
        currentAlbumId: null,
        currentAlbumTracks: [],
        currentTrackIndex: -1,
        albumTrackSources: new Map(),
        expandedState: new Set()
      },
      watchHistory: {}
    };
    sessionStorage.setItem('bantu_view_session', this.state.viewRecordingState.currentSessionId);
  }
  
  setupPersistence() {
    // Throttled save to localStorage
    let saveTimeout = null;
    
    const saveState = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      
      saveTimeout = setTimeout(() => {
        try {
          const stateToSave = {
            user: this.state.user,
            preferences: this.state.preferences,
            watchHistory: this.state.watchHistory,
            favorites: Array.from(this.state.favorites),
            likes: Array.from(this.state.likes),
            connections: Array.from(this.state.connections),
            viewRecordingState: {
              currentSessionId: this.state.viewRecordingState.currentSessionId,
              recordedContentIds: Array.from(this.state.viewRecordingState.recordedContentIds),
              pendingRecordings: Object.fromEntries(this.state.viewRecordingState.pendingRecordings),
              lastViewTimestamp: this.state.viewRecordingState.lastViewTimestamp
            },
            albumState: {
              currentAlbumId: this.state.albumState.currentAlbumId,
              currentTrackIndex: this.state.albumState.currentTrackIndex,
              expandedState: Array.from(this.state.albumState.expandedState),
              albumTrackSources: Object.fromEntries(this.state.albumState.albumTrackSources)
            },
            session: {
              currentContentId: this.state.session.currentContentId,
              currentTime: this.state.session.currentTime,
              volume: this.state.session.volume,
              muted: this.state.session.muted
            }
          };
          
          localStorage.setItem('bantu_state', JSON.stringify(stateToSave));
        } catch (error) {
          console.error('Failed to save state:', error);
        }
      }, 1000);
    };
    
    // Auto-save on state changes
    this.subscribe('*', saveState);
  }
  
  setupSessionRecovery() {
    // Attempt to recover interrupted playback
    window.addEventListener('beforeunload', () => {
      this.savePlaybackState();
      this.saveViewRecordingState();
    });
    
    // Attempt to restore playback state on page load
    this.restorePlaybackState();
  }
  
  setupViewStateRecovery() {
    // Restore any pending view recordings
    const pendingRecordings = this.state.viewRecordingState.pendingRecordings;
    if (pendingRecordings && pendingRecordings.size > 0) {
      console.log(`🔄 Found ${pendingRecordings.size} pending view recordings to retry`);
      // Attempt to retry pending recordings
      setTimeout(() => this.retryPendingViewRecordings(), 5000);
    }
  }
  
  async retryPendingViewRecordings() {
    const pending = Array.from(this.state.viewRecordingState.pendingRecordings.entries());
    for (const [contentId, data] of pending) {
      if (Date.now() - data.timestamp < 300000) { // Only retry within 5 minutes
        console.log(`🔄 Retrying view recording for content: ${contentId}`);
        // Emit event for retry
        this.notifyListeners('view:retry', { contentId, data });
      } else {
        // Remove expired pending recording
        this.state.viewRecordingState.pendingRecordings.delete(contentId);
      }
    }
  }
  
  savePlaybackState() {
    if (this.state.session.currentContentId && this.state.session.currentTime > 0) {
      localStorage.setItem(
        `playback_${this.state.session.currentContentId}`,
        JSON.stringify({
          time: this.state.session.currentTime,
          timestamp: Date.now()
        })
      );
    }
  }
  
  saveViewRecordingState() {
    // Save current view recording state to sessionStorage for recovery
    const viewState = {
      sessionId: this.state.viewRecordingState.currentSessionId,
      recordedIds: Array.from(this.state.viewRecordingState.recordedContentIds),
      timestamp: Date.now()
    };
    sessionStorage.setItem('bantu_view_state', JSON.stringify(viewState));
  }
  
  restorePlaybackState() {
    try {
      // Find any interrupted playback
      const interruptedKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('playback_'));
      
      interruptedKeys.forEach(key => {
        const data = JSON.parse(localStorage.getItem(key));
        const contentId = key.replace('playback_', '');
        
        // Only restore if within 7 days
        if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
          if (!this.state.watchHistory[contentId]) {
            this.state.watchHistory[contentId] = {};
          }
          this.state.watchHistory[contentId].resumeTime = data.time;
          this.state.watchHistory[contentId].lastWatched = data.timestamp;
        }
        
        // Clean up
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to restore playback state:', error);
    }
  }
  
  // ============================================
  // 🔧 VIEWS FIX: View Recording State Management
  // ============================================
  
  /**
   * Mark content as viewed in state
   */
  markContentAsViewed(contentId, confirmed = true) {
    if (!contentId) return false;
    
    if (confirmed) {
      // Add to recorded set
      this.state.viewRecordingState.recordedContentIds.add(contentId);
      this.state.viewRecordingState.lastViewTimestamp = Date.now();
      
      // Remove from pending if exists
      this.state.viewRecordingState.pendingRecordings.delete(contentId);
      
      // Update watch history
      this.updateWatchHistory(contentId, 0, null);
      
      console.log('✅ Content marked as viewed in state:', contentId);
      this.notifyListeners('view:recorded', { contentId, confirmed: true });
      
      return true;
    } else {
      // Add to pending recordings
      this.state.viewRecordingState.pendingRecordings.set(contentId, {
        timestamp: Date.now(),
        retries: 0
      });
      
      console.log('⏳ Content marked as pending view:', contentId);
      this.notifyListeners('view:pending', { contentId });
      
      return false;
    }
  }
  
  /**
   * Check if content has been viewed in this session
   */
  hasViewedContent(contentId) {
    return this.state.viewRecordingState.recordedContentIds.has(contentId);
  }
  
  /**
   * Check if content is pending view recording
   */
  isPendingViewRecording(contentId) {
    return this.state.viewRecordingState.pendingRecordings.has(contentId);
  }
  
  /**
   * Get current view session ID
   */
  getCurrentViewSessionId() {
    return this.state.viewRecordingState.currentSessionId;
  }
  
  /**
   * Clear view recording state (for testing or logout)
   */
  clearViewRecordingState() {
    this.state.viewRecordingState.recordedContentIds.clear();
    this.state.viewRecordingState.pendingRecordings.clear();
    this.state.viewRecordingState.currentSessionId = this.generateSessionId();
    this.state.viewRecordingState.lastViewTimestamp = null;
    sessionStorage.setItem('bantu_view_session', this.state.viewRecordingState.currentSessionId);
    sessionStorage.removeItem('bantu_view_state');
    console.log('🗑️ View recording state cleared');
    this.notifyListeners('view:cleared', null);
  }
  
  // ============================================
  // 🔧 ALBUM FIX: Album/Playlist State Management
  // ============================================
  
  /**
   * Set current album tracks with multiple source support
   */
  setAlbumTracks(albumId, tracks, source = 'unknown') {
    if (!albumId) return;
    
    // Normalize tracks format
    const normalizedTracks = this.normalizeTracks(tracks);
    
    this.state.albumState.currentAlbumId = albumId;
    this.state.albumState.currentAlbumTracks = normalizedTracks;
    
    // Cache tracks by album ID
    this.state.albumState.albumTrackSources.set(albumId, {
      tracks: normalizedTracks,
      source: source,
      timestamp: Date.now()
    });
    
    // Also cache in regular cache
    this.cacheAlbumTracks(albumId, normalizedTracks);
    
    console.log(`📀 Album tracks set for ${albumId}: ${normalizedTracks.length} tracks from ${source}`);
    this.notifyListeners('album:tracks-updated', { albumId, tracks: normalizedTracks, source });
    
    return normalizedTracks;
  }
  
  /**
   * Normalize tracks to consistent format
   */
  normalizeTracks(tracks) {
    if (!Array.isArray(tracks)) return [];
    
    return tracks.map((track, index) => {
      // If track is already normalized
      if (track.id && track.title) {
        return track;
      }
      
      // If track has Content object (from DB query)
      if (track.Content) {
        return {
          id: track.content_id || track.Content.id,
          title: track.Content.title || 'Untitled',
          thumbnail_url: track.Content.thumbnail_url,
          duration: track.Content.duration,
          artist: track.Content.user_profiles?.full_name || track.Content.user_profiles?.username,
          added_at: track.added_at,
          index: index
        };
      }
      
      // If track is simple object with basic properties
      return {
        id: track.id || track.content_id || index,
        title: track.title || track.name || 'Untitled',
        thumbnail_url: track.thumbnail_url || track.thumbnail,
        duration: track.duration,
        artist: track.artist || track.creator_name,
        index: index
      };
    });
  }
  
  /**
   * Get current album tracks
   */
  getCurrentAlbumTracks() {
    return this.state.albumState.currentAlbumTracks;
  }
  
  /**
   * Get cached album tracks by ID
   */
  getCachedAlbumTracks(albumId) {
    const cached = this.state.albumState.albumTrackSources.get(albumId);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
      return cached.tracks;
    }
    return null;
  }
  
  /**
   * Cache album tracks
   */
  cacheAlbumTracks(albumId, tracks) {
    this.state.cache.albums.set(albumId, {
      tracks: tracks,
      cachedAt: Date.now()
    });
    
    // Also cache individual tracks
    tracks.forEach(track => {
      if (track.id) {
        this.state.cache.tracks.set(track.id, {
          ...track,
          cachedAt: Date.now(),
          albumId: albumId
        });
      }
    });
    
    // Limit cache size
    if (this.state.cache.albums.size > 50) {
      const oldestKey = Array.from(this.state.cache.albums.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0][0];
      this.state.cache.albums.delete(oldestKey);
    }
  }
  
  /**
   * Get cached track by ID
   */
  getCachedTrack(trackId) {
    const cached = this.state.cache.tracks.get(trackId);
    if (cached && Date.now() - cached.cachedAt < 3600000) { // 1 hour cache
      return cached;
    }
    return null;
  }
  
  /**
   * Set current track index
   */
  setCurrentTrackIndex(index) {
    if (index >= 0 && index < this.state.albumState.currentAlbumTracks.length) {
      this.state.albumState.currentTrackIndex = index;
      this.notifyListeners('album:track-changed', {
        index: index,
        track: this.state.albumState.currentAlbumTracks[index]
      });
      return true;
    }
    return false;
  }
  
  /**
   * Get current track
   */
  getCurrentTrack() {
    if (this.state.albumState.currentTrackIndex >= 0 && 
        this.state.albumState.currentTrackIndex < this.state.albumState.currentAlbumTracks.length) {
      return this.state.albumState.currentAlbumTracks[this.state.albumState.currentTrackIndex];
    }
    return null;
  }
  
  /**
   * Toggle album expanded state
   */
  toggleAlbumExpanded(albumId) {
    if (this.state.albumState.expandedState.has(albumId)) {
      this.state.albumState.expandedState.delete(albumId);
    } else {
      this.state.albumState.expandedState.add(albumId);
    }
    
    this.notifyListeners('album:expanded-toggled', {
      albumId,
      expanded: this.state.albumState.expandedState.has(albumId)
    });
    
    return this.state.albumState.expandedState.has(albumId);
  }
  
  /**
   * Check if album is expanded
   */
  isAlbumExpanded(albumId) {
    return this.state.albumState.expandedState.has(albumId);
  }
  
  /**
   * Clear album state
   */
  clearAlbumState() {
    this.state.albumState.currentAlbumId = null;
    this.state.albumState.currentAlbumTracks = [];
    this.state.albumState.currentTrackIndex = -1;
    // Don't clear cache or expanded state
    this.notifyListeners('album:cleared', null);
  }
  
  // ============================================
  // Core API
  // ============================================
  
  getState(path = null) {
    if (!path) return this.cloneState(this.state);
    return this.getNestedValue(this.state, path);
  }
  
  setState(path, value) {
    const oldValue = this.getNestedValue(this.state, path);
    
    // Deep clone value to prevent mutation
    const clonedValue = this.cloneState(value);
    
    // Set the value
    this.setNestedValue(this.state, path, clonedValue);
    
    // Notify listeners
    this.notifyListeners(path, clonedValue, oldValue);
    
    return clonedValue;
  }
  
  async updateState(path, updater) {
    return new Promise((resolve) => {
      this.pendingActions.push(async () => {
        try {
          const current = this.getNestedValue(this.state, path);
          const newValue = await updater(current);
          const result = this.setState(path, newValue);
          resolve(result);
        } catch (error) {
          console.error('State update failed:', error);
          resolve(null);
        } finally {
          this.pendingActions.shift();
          if (this.pendingActions.length > 0) {
            this.pendingActions[0]();
          }
        }
      });
      
      if (this.pendingActions.length === 1) {
        this.pendingActions[0]();
      }
    });
  }
  
  // ============================================
  // Watch history management
  // ============================================
  
  updateWatchHistory(contentId, time, duration) {
    const percentWatched = duration ? (time / duration) * 100 : 0;
    
    this.setState(`watchHistory.${contentId}`, {
      lastWatched: Date.now(),
      resumeTime: time,
      duration: duration,
      percentWatched: percentWatched,
      completed: percentWatched >= 90
    });
    
    // Track in analytics
    if (window.track) {
      window.track.watchProgress(contentId, percentWatched, time);
    }
    
    this.notifyListeners('watch:history-updated', { contentId, time, percentWatched });
  }
  
  getResumeTime(contentId) {
    const history = this.getState(`watchHistory.${contentId}`);
    if (history && history.resumeTime > 0 && !history.completed) {
      return history.resumeTime;
    }
    return 0;
  }
  
  // ============================================
  // Favorites management
  // ============================================
  
  toggleFavorite(contentId) {
    const isFavorited = this.state.favorites.has(contentId);
    
    if (isFavorited) {
      this.state.favorites.delete(contentId);
    } else {
      this.state.favorites.add(contentId);
    }
    
    this.notifyListeners('favorites', this.state.favorites);
    this.notifyListeners(`favorites:${contentId}`, !isFavorited);
    
    // Sync with server in background
    this.syncWithServer('favorites', contentId, !isFavorited);
    
    return !isFavorited;
  }
  
  isFavorite(contentId) {
    return this.state.favorites.has(contentId);
  }
  
  getFavorites() {
    return Array.from(this.state.favorites);
  }
  
  // ============================================
  // Likes management
  // ============================================
  
  toggleLike(contentId) {
    const isLiked = this.state.likes.has(contentId);
    
    if (isLiked) {
      this.state.likes.delete(contentId);
    } else {
      this.state.likes.add(contentId);
    }
    
    this.notifyListeners('likes', this.state.likes);
    this.notifyListeners(`likes:${contentId}`, !isLiked);
    
    // Sync with server in background
    this.syncWithServer('likes', contentId, !isLiked);
    
    return !isLiked;
  }
  
  isLiked(contentId) {
    return this.state.likes.has(contentId);
  }
  
  // ============================================
  // Connections management
  // ============================================
  
  toggleConnection(creatorId) {
    const isConnected = this.state.connections.has(creatorId);
    
    if (isConnected) {
      this.state.connections.delete(creatorId);
    } else {
      this.state.connections.add(creatorId);
    }
    
    this.notifyListeners('connections', this.state.connections);
    this.notifyListeners(`connections:${creatorId}`, !isConnected);
    
    // Sync with server in background
    this.syncWithServer('connections', creatorId, !isConnected);
    
    return !isConnected;
  }
  
  isConnected(creatorId) {
    return this.state.connections.has(creatorId);
  }
  
  // ============================================
  // Session management
  // ============================================
  
  setCurrentContent(contentId, contentData = null) {
    this.setState('session.currentContentId', contentId);
    if (contentData) {
      this.setState('currentContent', contentData);
    }
    this.notifyListeners('session:content-changed', { contentId, contentData });
  }
  
  setPlaybackTime(time) {
    this.setState('session.currentTime', time);
  }
  
  setPlaying(playing) {
    this.setState('session.playing', playing);
    this.setState('session.lastActivityTime', Date.now());
    this.notifyListeners('session:play-state-changed', { playing });
  }
  
  setVolume(volume, muted = false) {
    this.setState('session.volume', Math.max(0, Math.min(1, volume)));
    this.setState('session.muted', muted);
    this.notifyListeners('session:volume-changed', { volume, muted });
  }
  
  /**
   * 🔧 CRITICAL FIX: Block cleanup during interactions
   */
  blockCleanup(blocked = true) {
    this.setState('session.isCleanupBlocked', blocked);
    this.notifyListeners('session:cleanup-blocked', { blocked });
  }
  
  isCleanupBlocked() {
    return this.state.session.isCleanupBlocked;
  }
  
  updateLastActivity() {
    this.setState('session.lastActivityTime', Date.now());
  }
  
  // ============================================
  // Content cache management
  // ============================================
  
  cacheContent(content) {
    if (!content?.id) return;
    
    this.state.cache.content.set(content.id, {
      ...content,
      cachedAt: Date.now()
    });
    
    // Limit cache size
    if (this.state.cache.content.size > 100) {
      const oldestKey = Array.from(this.state.cache.content.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0][0];
      this.state.cache.content.delete(oldestKey);
    }
  }
  
  getCachedContent(contentId) {
    const cached = this.state.cache.content.get(contentId);
    
    // Check if cache is stale (> 1 hour)
    if (cached && Date.now() - cached.cachedAt > 60 * 60 * 1000) {
      this.state.cache.content.delete(contentId);
      return null;
    }
    
    return cached;
  }
  
  // ============================================
  // Subscription system
  // ============================================
  
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }
  
  notifyListeners(path, newValue, oldValue) {
    // Notify specific path listeners
    if (this.listeners.has(path)) {
      this.listeners.get(path).forEach(callback => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error('Listener error:', error);
        }
      });
    }
    
    // Notify wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          console.error('Wildcard listener error:', error);
        }
      });
    }
  }
  
  // ============================================
  // Server sync
  // ============================================
  
  async syncWithServer(type, id, value) {
    try {
      console.log(`Syncing ${type}: ${id} = ${value}`);
      
      if (window.SupabaseHelper && window.SupabaseHelper.isInitialized && this.state.user) {
        // Implement actual sync with Supabase based on type
        switch (type) {
          case 'favorites':
            if (value) {
              await window.SupabaseHelper.addToFavorites(id);
            } else {
              await window.SupabaseHelper.removeFromFavorites(id);
            }
            break;
          case 'likes':
            if (value) {
              await window.SupabaseHelper.likeContent(id);
            } else {
              await window.SupabaseHelper.unlikeContent(id);
            }
            break;
          case 'connections':
            if (value) {
              await window.SupabaseHelper.followCreator(id);
            } else {
              await window.SupabaseHelper.unfollowCreator(id);
            }
            break;
        }
      }
    } catch (error) {
      console.error(`Failed to sync ${type}:`, error);
      this.queueForRetry({ type, id, value });
    }
  }
  
  queueForRetry(action) {
    this.syncQueue.push({
      ...action,
      timestamp: Date.now(),
      retries: 0
    });
    
    // Process queue if not already processing
    if (!this.isSyncing) {
      this.processSyncQueue();
    }
  }
  
  async processSyncQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    while (this.syncQueue.length > 0) {
      const action = this.syncQueue.shift();
      if (action.retries < 3) {
        try {
          await this.syncWithServer(action.type, action.id, action.value);
        } catch (error) {
          action.retries++;
          this.syncQueue.push(action);
          await new Promise(resolve => setTimeout(resolve, 2000 * action.retries));
        }
      }
    }
    
    this.isSyncing = false;
  }
  
  // ============================================
  // Helper methods
  // ============================================
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
  
  cloneState(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Set) return new Set(Array.from(obj));
    if (obj instanceof Map) return new Map(Array.from(obj.entries()));
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cloneState(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.cloneState(obj[key]);
      }
    }
    
    return cloned;
  }
  
  // ============================================
  // Reset and cleanup
  // ============================================
  
  resetState() {
    this.state = {
      ...this.state,
      favorites: new Set(),
      likes: new Set(),
      connections: new Set(),
      viewRecordingState: {
        currentSessionId: this.generateSessionId(),
        recordedContentIds: new Set(),
        pendingRecordings: new Map(),
        lastViewTimestamp: null
      },
      albumState: {
        currentAlbumId: null,
        currentAlbumTracks: [],
        currentTrackIndex: -1,
        albumTrackSources: new Map(),
        expandedState: new Set()
      },
      watchHistory: {},
      session: {
        currentContentId: null,
        currentTime: 0,
        playing: false,
        volume: 1.0,
        muted: false,
        lastActivityTime: Date.now(),
        isCleanupBlocked: false
      }
    };
    
    localStorage.removeItem('bantu_state');
    sessionStorage.setItem('bantu_view_session', this.state.viewRecordingState.currentSessionId);
    this.notifyListeners('*', this.state);
    console.log('🔄 State reset to initial values');
  }
  
  // ============================================
  // Export/Import state (for debugging)
  // ============================================
  
  exportState() {
    return JSON.stringify({
      user: this.state.user,
      preferences: this.state.preferences,
      watchHistory: this.state.watchHistory,
      favorites: Array.from(this.state.favorites),
      likes: Array.from(this.state.likes),
      connections: Array.from(this.state.connections),
      viewRecordingState: {
        currentSessionId: this.state.viewRecordingState.currentSessionId,
        recordedContentIds: Array.from(this.state.viewRecordingState.recordedContentIds),
        pendingRecordings: Object.fromEntries(this.state.viewRecordingState.pendingRecordings),
        lastViewTimestamp: this.state.viewRecordingState.lastViewTimestamp
      },
      albumState: {
        currentAlbumId: this.state.albumState.currentAlbumId,
        currentAlbumTracks: this.state.albumState.currentAlbumTracks,
        currentTrackIndex: this.state.albumState.currentTrackIndex,
        expandedState: Array.from(this.state.albumState.expandedState)
      },
      session: {
        currentContentId: this.state.session.currentContentId,
        currentTime: this.state.session.currentTime,
        volume: this.state.session.volume,
        muted: this.state.session.muted
      }
    }, null, 2);
  }
  
  importState(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.state = {
        ...this.state,
        ...imported,
        favorites: new Set(imported.favorites || []),
        likes: new Set(imported.likes || []),
        connections: new Set(imported.connections || []),
        viewRecordingState: {
          ...this.state.viewRecordingState,
          recordedContentIds: new Set(imported.viewRecordingState?.recordedContentIds || []),
          pendingRecordings: new Map(Object.entries(imported.viewRecordingState?.pendingRecordings || {})),
          currentSessionId: imported.viewRecordingState?.currentSessionId || this.generateSessionId(),
          lastViewTimestamp: imported.viewRecordingState?.lastViewTimestamp || null
        },
        albumState: {
          ...this.state.albumState,
          expandedState: new Set(imported.albumState?.expandedState || []),
          currentAlbumTracks: imported.albumState?.currentAlbumTracks || []
        }
      };
      this.notifyListeners('*', this.state);
      return true;
    } catch (error) {
      console.error('Failed to import state:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const stateManager = new StateManager();

// Export utility functions for common state operations
window.state = {
  // Getters
  getUser: () => stateManager.getState('user'),
  getPreferences: () => stateManager.getState('preferences'),
  getFavorites: () => Array.from(stateManager.getState('favorites')),
  getWatchHistory: (contentId) => stateManager.getState(`watchHistory.${contentId}`),
  getResumeTime: (contentId) => stateManager.getResumeTime(contentId),
  isFavorite: (contentId) => stateManager.isFavorite(contentId),
  isLiked: (contentId) => stateManager.isLiked(contentId),
  isConnected: (creatorId) => stateManager.isConnected(creatorId),
  
  // View recording state
  hasViewedContent: (contentId) => stateManager.hasViewedContent(contentId),
  getCurrentViewSessionId: () => stateManager.getCurrentViewSessionId(),
  markContentAsViewed: (contentId, confirmed) => stateManager.markContentAsViewed(contentId, confirmed),
  clearViewRecordingState: () => stateManager.clearViewRecordingState(),
  
  // Album state
  getCurrentAlbumTracks: () => stateManager.getCurrentAlbumTracks(),
  getCurrentTrack: () => stateManager.getCurrentTrack(),
  setAlbumTracks: (albumId, tracks, source) => stateManager.setAlbumTracks(albumId, tracks, source),
  setCurrentTrackIndex: (index) => stateManager.setCurrentTrackIndex(index),
  toggleAlbumExpanded: (albumId) => stateManager.toggleAlbumExpanded(albumId),
  isAlbumExpanded: (albumId) => stateManager.isAlbumExpanded(albumId),
  clearAlbumState: () => stateManager.clearAlbumState(),
  getCachedAlbumTracks: (albumId) => stateManager.getCachedAlbumTracks(albumId),
  getCachedTrack: (trackId) => stateManager.getCachedTrack(trackId),
  
  // Setters
  setUser: (userData) => stateManager.setState('user', userData),
  setPreference: (key, value) => stateManager.setState(`preferences.${key}`, value),
  toggleFavorite: (contentId) => stateManager.toggleFavorite(contentId),
  toggleLike: (contentId) => stateManager.toggleLike(contentId),
  toggleConnection: (creatorId) => stateManager.toggleConnection(creatorId),
  
  // Session
  setCurrentContent: (contentId, contentData) => stateManager.setCurrentContent(contentId, contentData),
  setPlaybackTime: (time) => stateManager.setPlaybackTime(time),
  setPlaying: (playing) => stateManager.setPlaying(playing),
  setVolume: (volume, muted) => stateManager.setVolume(volume, muted),
  blockCleanup: (blocked) => stateManager.blockCleanup(blocked),
  isCleanupBlocked: () => stateManager.isCleanupBlocked(),
  updateLastActivity: () => stateManager.updateLastActivity(),
  
  // Cache
  cacheContent: (content) => stateManager.cacheContent(content),
  getCachedContent: (contentId) => stateManager.getCachedContent(contentId),
  
  // Subscriptions
  subscribe: (path, callback) => stateManager.subscribe(path, callback),
  
  // Helper methods
  updateWatchHistory: (contentId, time, duration) => 
    stateManager.updateWatchHistory(contentId, time, duration),
  
  // Reset and debug
  resetState: () => stateManager.resetState(),
  exportState: () => stateManager.exportState(),
  importState: (json) => stateManager.importState(json)
};

// Make available globally
window.stateManager = stateManager;

console.log('✅ State Manager initialized with view recording and album state tracking');
