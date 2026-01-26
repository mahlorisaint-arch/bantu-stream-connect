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
      session: {
        currentContentId: null,
        currentTime: 0,
        playing: false,
        volume: 1.0,
        muted: false
      },
      cache: {
        content: new Map(),
        creators: new Map(),
        comments: new Map()
      }
    };
    
    this.listeners = new Map();
    this.isLoading = false;
    this.pendingActions = [];
    
    this.init();
  }
  
  init() {
    // Load persisted state
    this.loadPersistedState();
    
    // Setup state persistence
    this.setupPersistence();
    
    // Setup session recovery
    this.setupSessionRecovery();
  }
  
  loadPersistedState() {
    try {
      const saved = localStorage.getItem('bantu_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Merge with current state
        this.state = {
          ...this.state,
          ...parsed,
          favorites: new Set(parsed.favorites || []),
          likes: new Set(parsed.likes || []),
          connections: new Set(parsed.connections || []),
          cache: this.state.cache // Don't restore cache
        };
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      this.clearCorruptedState();
    }
  }
  
  clearCorruptedState() {
    localStorage.removeItem('bantu_state');
    this.state = {
      ...this.state,
      favorites: new Set(),
      likes: new Set(),
      connections: new Set(),
      watchHistory: {}
    };
  }
  
  setupPersistence() {
    // Throttled save to localStorage
    let saveTimeout = null;
    
    const saveState = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      
      saveTimeout = setTimeout(() => {
        try {
          const stateToSave = {
            ...this.state,
            favorites: Array.from(this.state.favorites),
            likes: Array.from(this.state.likes),
            connections: Array.from(this.state.connections),
            cache: undefined // Don't save cache
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
    });
    
    // Attempt to restore playback state on page load
    this.restorePlaybackState();
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
  
  // Core API
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
  
  // Watch history management
  updateWatchHistory(contentId, time, duration) {
    const percentWatched = (time / duration) * 100;
    
    this.setState(`watchHistory.${contentId}`, {
      lastWatched: Date.now(),
      resumeTime: time,
      duration,
      percentWatched,
      completed: percentWatched >= 90
    });
    
    // Track in analytics
    if (window.track) {
      window.track.watchProgress(contentId, percentWatched, time);
    }
  }
  
  // Favorites management
  toggleFavorite(contentId) {
    const isFavorited = this.state.favorites.has(contentId);
    
    if (isFavorited) {
      this.state.favorites.delete(contentId);
    } else {
      this.state.favorites.add(contentId);
    }
    
    this.notifyListeners('favorites', this.state.favorites);
    
    // Sync with server in background
    this.syncWithServer('favorites', contentId, !isFavorited);
    
    return !isFavorited;
  }
  
  // Likes management
  toggleLike(contentId) {
    const isLiked = this.state.likes.has(contentId);
    
    if (isLiked) {
      this.state.likes.delete(contentId);
    } else {
      this.state.likes.add(contentId);
    }
    
    this.notifyListeners('likes', this.state.likes);
    
    // Sync with server in background
    this.syncWithServer('likes', contentId, !isLiked);
    
    return !isLiked;
  }
  
  // Connections management
  toggleConnection(creatorId) {
    const isConnected = this.state.connections.has(creatorId);
    
    if (isConnected) {
      this.state.connections.delete(creatorId);
    } else {
      this.state.connections.add(creatorId);
    }
    
    this.notifyListeners('connections', this.state.connections);
    
    // Sync with server in background
    this.syncWithServer('connections', creatorId, !isConnected);
    
    return !isConnected;
  }
  
  async syncWithServer(type, id, value) {
    try {
      // Simulate API call - integrate with your Supabase later
      console.log(`Syncing ${type}: ${id} = ${value}`);
      
      if (window.SupabaseHelper && window.SupabaseHelper.isInitialized) {
        // TODO: Implement actual sync with Supabase
      }
    } catch (error) {
      console.error(`Failed to sync ${type}:`, error);
      this.queueForRetry({ type, id, value });
    }
  }
  
  queueForRetry(action) {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({
      ...action,
      timestamp: Date.now(),
      retries: 0
    });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  }
  
  // Cache management
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
  
  // Subscription system
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
  
  // Helper methods
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
  
  // Reset state (for testing/logout)
  resetState() {
    this.state = {
      ...this.state,
      favorites: new Set(),
      likes: new Set(),
      connections: new Set(),
      watchHistory: {},
      session: {
        currentContentId: null,
        currentTime: 0,
        playing: false,
        volume: 1.0,
        muted: false
      }
    };
    
    localStorage.removeItem('bantu_state');
    this.notifyListeners('*', this.state);
  }
  
  // Export/Import state (for debugging)
  exportState() {
    return JSON.stringify({
      ...this.state,
      favorites: Array.from(this.state.favorites),
      likes: Array.from(this.state.likes),
      connections: Array.from(this.state.connections),
      cache: undefined
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
        connections: new Set(imported.connections || [])
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
  isFavorite: (contentId) => stateManager.getState('favorites').has(contentId),
  isLiked: (contentId) => stateManager.getState('likes').has(contentId),
  isConnected: (creatorId) => stateManager.getState('connections').has(creatorId),
  
  // Setters
  setUser: (userData) => stateManager.setState('user', userData),
  setPreference: (key, value) => stateManager.setState(`preferences.${key}`, value),
  toggleFavorite: (contentId) => stateManager.toggleFavorite(contentId),
  toggleLike: (contentId) => stateManager.toggleLike(contentId),
  toggleConnection: (creatorId) => stateManager.toggleConnection(creatorId),
  
  // Session
  setCurrentContent: (contentId) => stateManager.setState('session.currentContentId', contentId),
  setPlaybackTime: (time) => stateManager.setState('session.currentTime', time),
  setPlaying: (playing) => stateManager.setState('session.playing', playing),
  
  // Cache
  cacheContent: (content) => stateManager.cacheContent(content),
  getCachedContent: (contentId) => stateManager.getCachedContent(contentId),
  
  // Subscriptions
  subscribe: (path, callback) => stateManager.subscribe(path, callback),
  
  // Helper methods
  updateWatchHistory: (contentId, time, duration) => 
    stateManager.updateWatchHistory(contentId, time, duration)
};

// Make available globally
window.stateManager = stateManager;

console.log('✅ State Manager initialized');
