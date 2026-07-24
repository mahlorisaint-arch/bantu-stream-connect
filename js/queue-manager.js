// js/queue-manager.js — Intelligent Queue Manager
// Bantu Stream Connect — Phase 3 Telemetry + Phase 1D Collection/Queue Enhancements
// ✅ Collection/series-aware queue navigation with sort_index support
// ✅ Polymorphic content handling (video, audio, episode, playlist item)
// ✅ Queue persistence with localStorage/sessionStorage recovery
// ✅ Smart queue modes: shuffle, repeat (off/one/all), auto-advance
// ✅ StateManager integration for synchronized app state
// ✅ WatchSessionManager integration for telemetry continuity
// ✅ Event emission system for cross-component communication
// ✅ Memory-safe cleanup with reference management
// ✅ Offline-aware queue operations with retry queuing

(function() {
  'use strict';
  
  console.log('🎵 QueueManager module loading... (Phase 3 + Phase 1D Enhanced)');

  /**
   * QueueManager — Intelligent playback queue with collection awareness,
   * persistence, and Phase 3 telemetry integration
   */
  class QueueManager {
    constructor(config = {}) {
      // Configuration
      this.config = {
        storageKey: config.storageKey || 'bantu_queue_state',
        autoplayDefault: config.autoplayDefault ?? true,
        shuffleDefault: config.shuffleDefault ?? false,
        repeatDefault: config.repeatDefault || 'off', // 'off' | 'one' | 'all'
        maxQueueSize: config.maxQueueSize || 100,
        cacheTTL: config.cacheTTL || 1800000, // 30 minutes
        ...config
      };
      
      // Core queue state
      this.queue = [];
      this.currentIndex = 0;
      
      // Queue behavior modes
      this.autoplay = this.config.autoplayDefault;
      this.shuffleMode = this.config.shuffleDefault;
      this.repeatMode = this.config.repeatDefault;
      
      // Queue metadata
      this.source = null; // 'playlist' | 'collection' | 'search' | 'manual'
      this.sourceId = null; // playlist_id, collection_id, or search query
      this.sourceMetadata = null; // Additional context from source
      
      // Phase 1D: Collection/series context
      this.collectionContext = {
        collectionId: null,
        playlistId: null,
        currentSortIndex: null,
        episodeNumber: null
      };
      
      // Phase 3: Telemetry integration
      this.playbackSessionId = null;
      this.watchSession = null;
      
      // State management
      this._stateManager = null;
      this._isInitialized = false;
      this._isTransitioning = false;
      
      // Event system
      this._listeners = new Map();
      
      // DOM references (lazy-loaded)
      this._dom = {
        nextBtn: null,
        prevBtn: null,
        autoplayToggle: null,
        shuffleToggle: null,
        repeatToggle: null,
        queueList: null,
        videoElement: null
      };
      
      // Persistence
      this._lastSavedAt = 0;
      this._saveDebounceTimer = null;
      
      console.log('✅ QueueManager instantiated', {
        autoplay: this.autoplay,
        shuffle: this.shuffleMode,
        repeat: this.repeatMode
      });
    }
    
    // =====================================================
    // INITIALIZATION & SETUP
    // =====================================================
    
    /**
     * Initialize queue with items and optional context
     * @param {Array} items - Queue items (any format)
     * @param {Object} options - { source, sourceId, startIndex, context, autoplay }
     */
    initialize(items = [], options = {}) {
      if (this._isInitialized) {
        console.log('⚠️ QueueManager already initialized, re-initializing...');
        this.destroy();
      }
      
      const {
        source = 'manual',
        sourceId = null,
        startIndex = 0,
        context = null,
        autoplay = this.autoplay,
        shuffle = this.shuffleMode,
        repeat = this.repeatMode,
        collectionId = null,
        playlistId = null
      } = options;
      
      // Normalize and validate items
      this.queue = this._normalizeItems(items);
      
      // Validate start index
      this.currentIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
      
      // Set metadata
      this.source = source;
      this.sourceId = sourceId;
      this.sourceMetadata = context;
      this.autoplay = autoplay;
      this.shuffleMode = shuffle;
      this.repeatMode = repeat;
      
      // Set collection context (Phase 1D)
      this.collectionContext = {
        collectionId: collectionId || null,
        playlistId: playlistId || null,
        currentSortIndex: this.queue[this.currentIndex]?.sort_index ?? null,
        episodeNumber: this.queue[this.currentIndex]?.episode_number ?? null
      };
      
      // Generate/restore playback session ID (Phase 3)
      this.playbackSessionId = this._getOrCreatePlaybackSessionId();
      
      // Connect to StateManager if available
      this._connectToStateManager();
      
      // Setup DOM controls
      this._attachControls();
      
      // Setup event listeners
      this._setupEventListeners();
      
      // Restore/persist state
      this._restoreFromStorage();
      this._saveToStorage();
      
      // Mark as initialized
      this._isInitialized = true;
      
      console.log('🎬 QueueManager initialized', {
        itemCount: this.queue.length,
        currentIndex: this.currentIndex,
        source: this.source,
        sourceId: this.sourceId,
        collectionId: this.collectionContext.collectionId
      });
      
      // Emit initialization event
      this._emit('queue:initialized', {
        queue: this._getPublicQueue(),
        currentIndex: this.currentIndex,
        metadata: this._getQueueMetadata()
      });
      
      return this;
    }
    
    /**
     * Normalize queue items to consistent format
     */
    _normalizeItems(items) {
      if (!Array.isArray(items)) return [];
      
      return items
        .filter(item => item && (item.id || item.content_id))
        .map((item, index) => {
          // Already normalized
          if (item._normalized) return item;
          
          // Handle nested Content object (from DB queries)
          if (item.Content) {
            return {
              _normalized: true,
              id: item.content_id || item.Content.id,
              content_id: item.Content.id,
              title: item.Content.title || 'Untitled',
              description: item.Content.description,
              thumbnail_url: item.Content.thumbnail_url,
              file_url: item.Content.file_url,
              duration: item.Content.duration,
              media_type: item.Content.media_type,
              genre: item.Content.genre,
              episode_number: item.Content.episode_number,
              series_id: item.Content.series_id,
              user_id: item.Content.user_id,
              creator_name: item.Content.user_profiles?.full_name || 
                           item.Content.user_profiles?.username,
              views_count: item.Content.content_engagement_stats?.total_views || 0,
              likes_count: item.Content.content_engagement_stats?.total_likes || 0,
              // Queue-specific metadata
              sort_index: item.sort_index ?? item.Content.episode_number ?? index,
              playlist_relation: item.playlist_relation || null,
              added_at: item.added_at || item.created_at || new Date().toISOString(),
              index: index
            };
          }
          
          // Handle simple object format
          return {
            _normalized: true,
            id: item.id || item.content_id,
            content_id: item.id || item.content_id,
            title: item.title || item.name || 'Untitled',
            description: item.description,
            thumbnail_url: item.thumbnail_url || item.thumbnail,
            file_url: item.file_url,
            duration: item.duration,
            media_type: item.media_type,
            genre: item.genre,
            episode_number: item.episode_number,
            series_id: item.series_id,
            user_id: item.user_id || item.creator_id,
            creator_name: item.artist || item.creator_name,
            views_count: item.views_count || 0,
            likes_count: item.likes_count || 0,
            // Queue-specific metadata
            sort_index: item.sort_index ?? item.episode_number ?? index,
            playlist_relation: item.playlist_relation || null,
            added_at: item.added_at || new Date().toISOString(),
            index: index
          };
        })
        .slice(0, this.config.maxQueueSize); // Enforce max size
    }
    
    /**
     * Connect to StateManager for synchronized state
     */
    _connectToStateManager() {
      if (window.stateManager || window.state?._manager) {
        this._stateManager = window.stateManager || window.state._manager;
        
        // Subscribe to relevant state changes
        this._stateManager.subscribe('queue:updated', (data) => {
          if (data && data.items) {
            // External queue update - sync if different
            if (JSON.stringify(data.items) !== JSON.stringify(this._getPublicQueue())) {
              console.log('🔄 Syncing queue from StateManager');
              this.initialize(data.items, {
                startIndex: data.currentIndex ?? 0,
                source: data.source || this.source,
                sourceId: data.sourceId || this.sourceId
              });
            }
          }
        });
        
        // Subscribe to playback state for telemetry coordination
        this._stateManager.subscribe('session:play-state-changed', (data) => {
          if (data.playing && this.watchSession && !this.watchSession.isActive) {
            // Resume telemetry session if player starts
            const currentItem = this.getCurrentItem();
            if (currentItem) {
              this._ensureWatchSession(currentItem.id);
            }
          }
        });
        
        console.log('🔗 Connected to StateManager');
      }
    }
    
    /**
     * Get or create playback session ID (Phase 3)
     */
    _getOrCreatePlaybackSessionId() {
      // Check sessionStorage first
      let sessionId = sessionStorage.getItem('bantu_playback_session');
      
      if (!sessionId) {
        // Generate new UUID
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          sessionId = crypto.randomUUID();
        } else {
          sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        sessionStorage.setItem('bantu_playback_session', sessionId);
      }
      
      return sessionId;
    }
    
    // =====================================================
    // DOM & EVENT SETUP
    // =====================================================
    
    /**
     * Attach DOM controls with event delegation
     */
    _attachControls() {
      // Lazy-load DOM references
      this._dom.nextBtn = document.getElementById('nextTrackBtn');
      this._dom.prevBtn = document.getElementById('previousTrackBtn');
      this._dom.autoplayToggle = document.getElementById('autoplayToggle');
      this._dom.shuffleToggle = document.getElementById('shuffleToggle');
      this._dom.repeatToggle = document.getElementById('repeatToggle');
      this._dom.queueList = document.querySelector('.queue-list, .playlist-queue');
      this._dom.videoElement = document.getElementById('inlineVideoPlayer');

      // Prev/Next only make sense with an actual queue behind them — the
      // player's default visual spec doesn't include them at all, so both
      // stay hidden until a real multi-item queue exists.
      const hasQueue = this.queue.length > 1;
      if (this._dom.nextBtn) this._dom.nextBtn.style.display = hasQueue ? '' : 'none';
      if (this._dom.prevBtn) this._dom.prevBtn.style.display = hasQueue ? '' : 'none';

      // Next button
      if (this._dom.nextBtn) {
        // Clone to remove existing listeners, then attach new
        const newNextBtn = this._dom.nextBtn.cloneNode(true);
        this._dom.nextBtn.parentNode.replaceChild(newNextBtn, this._dom.nextBtn);
        this._dom.nextBtn = newNextBtn;
        
        this._dom.nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.playNext();
        });
      }
      
      // Previous button
      if (this._dom.prevBtn) {
        const newPrevBtn = this._dom.prevBtn.cloneNode(true);
        this._dom.prevBtn.parentNode.replaceChild(newPrevBtn, this._dom.prevBtn);
        this._dom.prevBtn = newPrevBtn;
        
        this._dom.prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.playPrevious();
        });
      }
      
      // Autoplay toggle
      if (this._dom.autoplayToggle) {
        // Restore saved state
        const savedAutoplay = localStorage.getItem('bantu_autoplay_enabled');
        if (savedAutoplay !== null) {
          this.autoplay = savedAutoplay === 'true';
        }
        this._dom.autoplayToggle.classList.toggle('active', this.autoplay);
        
        const newAutoplayToggle = this._dom.autoplayToggle.cloneNode(true);
        this._dom.autoplayToggle.parentNode.replaceChild(newAutoplayToggle, this._dom.autoplayToggle);
        this._dom.autoplayToggle = newAutoplayToggle;
        
        this._dom.autoplayToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setAutoplay(!this.autoplay);
        });
      }
      
      // Shuffle toggle
      if (this._dom.shuffleToggle) {
        const savedShuffle = localStorage.getItem('bantu_shuffle_enabled');
        if (savedShuffle !== null) {
          this.shuffleMode = savedShuffle === 'true';
        }
        this._dom.shuffleToggle.classList.toggle('active', this.shuffleMode);
        
        const newShuffleToggle = this._dom.shuffleToggle.cloneNode(true);
        this._dom.shuffleToggle.parentNode.replaceChild(newShuffleToggle, this._dom.shuffleToggle);
        this._dom.shuffleToggle = newShuffleToggle;
        
        this._dom.shuffleToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setShuffle(!this.shuffleMode);
        });
      }
      
      // Repeat toggle (cycles: off → one → all → off)
      if (this._dom.repeatToggle) {
        this._updateRepeatToggleUI();
        
        const newRepeatToggle = this._dom.repeatToggle.cloneNode(true);
        this._dom.repeatToggle.parentNode.replaceChild(newRepeatToggle, this._dom.repeatToggle);
        this._dom.repeatToggle = newRepeatToggle;
        
        this._dom.repeatToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.cycleRepeatMode();
        });
      }
      
      // Video ended handler for autoplay
      if (this._dom.videoElement) {
        this._dom.videoElement.addEventListener('ended', () => {
          if (this.autoplay && !this._isTransitioning) {
            console.log('🎬 Video ended, autoplaying next...');
            this.playNext();
          }
        });
      }
      
      console.log('🔧 DOM controls attached');
    }
    
    /**
     * Setup additional event listeners
     */
    _setupEventListeners() {
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.key.toLowerCase()) {
          case 'n':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              this.playNext();
            }
            break;
          case 'p':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              this.playPrevious();
            }
            break;
          case 'a':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              this.setAutoplay(!this.autoplay);
            }
            break;
          case 's':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              this.setShuffle(!this.shuffleMode);
            }
            break;
          case 'r':
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              this.cycleRepeatMode();
            }
            break;
        }
      });
      
      // Page visibility for persistence
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this._saveToStorage();
        }
      });
      
      // Before unload for final save
      window.addEventListener('beforeunload', () => {
        this._saveToStorage();
        this._cleanupWatchSession();
      });
    }
    
    /**
     * Update repeat toggle UI based on current mode
     */
    _updateRepeatToggleUI() {
      if (!this._dom.repeatToggle) return;
      
      const iconMap = {
        'off': '<i class="fas fa-repeat"></i>',
        'one': '<i class="fas fa-repeat-1"></i>',
        'all': '<i class="fas fa-repeat"></i>'
      };
      
      this._dom.repeatToggle.innerHTML = iconMap[this.repeatMode] || iconMap.off;
      this._dom.repeatToggle.classList.toggle('active', this.repeatMode !== 'off');
      this._dom.repeatToggle.setAttribute('data-mode', this.repeatMode);
      this._dom.repeatToggle.setAttribute('title', `Repeat: ${this.repeatMode}`);
    }
    
    // =====================================================
    // PUBLIC QUEUE API
    // =====================================================
    
    /**
     * Play item by content ID
     */
    playById(contentId) {
      const index = this.queue.findIndex(item => 
        String(item.id) === String(contentId) || 
        String(item.content_id) === String(contentId)
      );
      
      if (index === -1) {
        console.warn('⚠️ Content not found in queue:', contentId);
        return false;
      }
      
      return this.playAtIndex(index);
    }
    
    /**
     * Play item at specific index
     */
    playAtIndex(index) {
      if (index < 0 || index >= this.queue.length) {
        console.warn('⚠️ Invalid queue index:', index);
        return false;
      }
      
      // Prevent rapid repeated calls during transition
      if (this._isTransitioning) {
        console.log('⏳ Queue transition in progress, deferring...');
        return false;
      }
      
      this._isTransitioning = true;
      const previousIndex = this.currentIndex;
      
      // Update index
      this.currentIndex = index;
      
      // Update collection context
      const currentItem = this.getCurrentItem();
      if (currentItem) {
        this.collectionContext.currentSortIndex = currentItem.sort_index ?? null;
        this.collectionContext.episodeNumber = currentItem.episode_number ?? null;
      }
      
      // Emit event before navigation
      this._emit('queue:item-selected', {
        item: currentItem,
        index: this.currentIndex,
        previousIndex
      });
      
      // Update StateManager if connected
      if (this._stateManager) {
        this._stateManager.setState('queue.currentIndex', this.currentIndex);
        if (currentItem) {
          this._stateManager.setCollectionContext(
            this.collectionContext.collectionId,
            this.collectionContext.episodeNumber,
            this.collectionContext.currentSortIndex
          );
        }
      }
      
      // Load the item
      this._loadCurrentItem();
      
      return true;
    }
    
    /**
     * Play next item in queue
     */
    playNext() {
      if (this.queue.length === 0) return false;
      
      // Handle repeat one mode
      if (this.repeatMode === 'one') {
        return this.playAtIndex(this.currentIndex);
      }
      
      let nextIndex;
      
      if (this.shuffleMode) {
        // Random next (not current)
        const available = this.queue.map((_, i) => i).filter(i => i !== this.currentIndex);
        nextIndex = available[Math.floor(Math.random() * available.length)];
      } else if (this.currentIndex < this.queue.length - 1) {
        // Normal sequential
        nextIndex = this.currentIndex + 1;
      } else if (this.repeatMode === 'all') {
        // Loop to start
        nextIndex = 0;
      } else {
        // End of queue
        console.log('🏁 End of queue reached');
        this._emit('queue:ended', {
          totalPlayed: this.queue.length,
          source: this.source
        });
        return false;
      }
      
      return this.playAtIndex(nextIndex);
    }
    
    /**
     * Play previous item in queue
     */
    playPrevious() {
      if (this.queue.length === 0 || this.currentIndex <= 0) return false;
      
      // Handle repeat one mode
      if (this.repeatMode === 'one') {
        return this.playAtIndex(this.currentIndex);
      }
      
      const prevIndex = this.currentIndex - 1;
      return this.playAtIndex(prevIndex);
    }
    
    /**
     * Load current item (navigates to content page)
     */
    _loadCurrentItem() {
      const item = this.getCurrentItem();
      if (!item) {
        this._isTransitioning = false;
        return;
      }
      
      console.log('▶️ Loading queue item:', item.title, `(index: ${this.currentIndex})`);
      
      // Ensure telemetry session for this content
      this._ensureWatchSession(item.id);
      
      // Build URL with queue context params for seamless navigation
      const params = new URLSearchParams();
      params.set('id', item.id);
      
      // Add queue context for restoration on next page
      if (this.sourceId) params.set('sourceId', this.sourceId);
      if (this.source) params.set('source', this.source);
      params.set('queueIndex', this.currentIndex);
      params.set('queueLength', this.queue.length);
      
      if (this.collectionContext.collectionId) {
        params.set('collectionId', this.collectionContext.collectionId);
      }
      if (this.collectionContext.playlistId) {
        params.set('playlistId', this.collectionContext.playlistId);
      }
      
      const baseUrl = 'content-detail.html';
      const url = `${baseUrl}?${params.toString()}`;
      
      // Save state before navigation
      this._saveToStorage();
      
      // Small delay to ensure save completes
      setTimeout(() => {
        window.location.href = url;
      }, 50);
    }
    
    /**
     * Ensure WatchSession exists for current content (Phase 3)
     */
    _ensureWatchSession(contentId) {
      // Only initialize if WatchSessionManager is available
      if (typeof WatchSessionManager !== 'function') return;
      
      // Clean up existing session if different content
      if (this.watchSession && this.watchSession.contentId !== contentId) {
        this._cleanupWatchSession();
      }
      
      // Create new session if needed
      if (!this.watchSession || !this.watchSession.isActive) {
        try {
          this.watchSession = new WatchSessionManager({
            supabase: window.supabase,
            contentId: contentId,
            userId: this._stateManager?.getState('user')?.id || null,
            sessionId: this.playbackSessionId,
            heartbeatInterval: 10000,
            validViewThreshold: 30,
            // Collection context
            collectionId: this.collectionContext.collectionId,
            playlistId: this.collectionContext.playlistId,
            sortIndex: this.collectionContext.currentSortIndex,
            episodeNumber: this.collectionContext.episodeNumber,
            autoplay: this.autoplay,
            // Callbacks
            onViewValidated: (data) => {
              console.log('✅ View validated for content:', contentId);
              this._emit('queue:view-validated', data);
            },
            onCompletion: (data) => {
              console.log('✅ Content completed:', contentId);
              this._emit('queue:content-completed', data);
              // Auto-advance if autoplay enabled
              if (this.autoplay) {
                setTimeout(() => this.playNext(), 1000);
              }
            },
            onAutoplayTrigger: () => {
              console.log('🎬 Autoplay triggered from WatchSession');
              this.playNext();
            }
          });
          
          // Initialize when video is ready (handled by content-detail.js)
          console.log('🎬 WatchSession prepared for content:', contentId);
          
        } catch (error) {
          console.error('❌ Failed to initialize WatchSession:', error);
        }
      }
    }
    
    /**
     * Cleanup current WatchSession
     */
    _cleanupWatchSession() {
      if (this.watchSession?.isActive) {
        try {
          this.watchSession.end();
        } catch (e) {
          console.warn('⚠️ Error ending WatchSession:', e);
        }
      }
      this.watchSession = null;
    }
    
    // =====================================================
    // QUEUE MODIFICATION API
    // =====================================================
    
    /**
     * Add item to end of queue
     */
    addToQueue(item, options = {}) {
      const { playNext = false, normalize = true } = options;
      
      const normalizedItem = normalize ? this._normalizeItems([item])[0] : item;
      if (!normalizedItem) return false;
      
      if (playNext) {
        // Insert after current item
        this.queue.splice(this.currentIndex + 1, 0, normalizedItem);
        // Adjust indices of subsequent items
        this.queue.forEach((item, idx) => item.index = idx);
      } else {
        // Append to end
        normalizedItem.index = this.queue.length;
        this.queue.push(normalizedItem);
      }
      
      console.log(`➕ Added to queue: ${normalizedItem.title} (${playNext ? 'play next' : 'end'})`);
      
      this._emit('queue:item-added', {
        item: normalizedItem,
        index: playNext ? this.currentIndex + 1 : this.queue.length - 1,
        playNext
      });
      
      this._saveToStorage();
      return true;
    }
    
    /**
     * Add multiple items to queue
     */
    addManyToQueue(items, options = {}) {
      const { atIndex = null, playFirst = false } = options;
      
      const normalized = this._normalizeItems(items);
      if (normalized.length === 0) return false;
      
      if (atIndex !== null && atIndex >= 0 && atIndex <= this.queue.length) {
        // Insert at specific index
        this.queue.splice(atIndex, 0, ...normalized);
      } else {
        // Append to end
        this.queue.push(...normalized);
      }
      
      // Re-index all items
      this.queue.forEach((item, idx) => item.index = idx);
      
      console.log(`➕ Added ${normalized.length} items to queue`);
      
      this._emit('queue:items-added', {
        items: normalized,
        count: normalized.length
      });
      
      // Optionally play first added item
      if (playFirst && normalized.length > 0) {
        const firstIndex = atIndex !== null ? atIndex : this.queue.length - normalized.length;
        this.playAtIndex(firstIndex);
      }
      
      this._saveToStorage();
      return true;
    }
    
    /**
     * Remove item from queue by ID
     */
    removeFromQueue(contentId) {
      const idx = this.queue.findIndex(item => 
        String(item.id) === String(contentId) || 
        String(item.content_id) === String(contentId)
      );
      
      if (idx === -1) {
        console.warn('⚠️ Item not found in queue:', contentId);
        return false;
      }
      
      const removed = this.queue.splice(idx, 1)[0];
      
      // Adjust current index if needed
      if (idx < this.currentIndex) {
        this.currentIndex--;
      } else if (idx === this.currentIndex) {
        // If removing current item, move to next or previous
        if (this.currentIndex >= this.queue.length) {
          this.currentIndex = Math.max(0, this.queue.length - 1);
        }
        // Auto-load new current if queue not empty
        if (this.queue.length > 0) {
          this._loadCurrentItem();
        }
      }
      
      // Re-index remaining items
      this.queue.forEach((item, i) => item.index = i);
      
      console.log(`➖ Removed from queue: ${removed.title}`);
      
      this._emit('queue:item-removed', {
        item: removed,
        index: idx
      });
      
      this._saveToStorage();
      return true;
    }
    
    /**
     * Clear entire queue
     */
    clearQueue() {
      const previousQueue = [...this.queue];
      
      this.queue = [];
      this.currentIndex = 0;
      this.source = null;
      this.sourceId = null;
      this.collectionContext = {
        collectionId: null,
        playlistId: null,
        currentSortIndex: null,
        episodeNumber: null
      };
      
      // Cleanup telemetry
      this._cleanupWatchSession();
      
      console.log('🗑️ Queue cleared');
      
      this._emit('queue:cleared', {
        previousCount: previousQueue.length
      });
      
      localStorage.removeItem(this.config.storageKey);
      
      return true;
    }
    
    /**
     * Shuffle queue (Fisher-Yates algorithm)
     */
    shuffleQueue() {
      if (this.queue.length <= 1) return;
      
      // Preserve current item at its position
      const currentItem = this.queue[this.currentIndex];
      const otherItems = this.queue.filter((_, i) => i !== this.currentIndex);
      
      // Shuffle other items
      for (let i = otherItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
      }
      
      // Rebuild queue with current item in place
      this.queue = [
        ...otherItems.slice(0, this.currentIndex),
        currentItem,
        ...otherItems.slice(this.currentIndex)
      ];
      
      // Re-index
      this.queue.forEach((item, i) => item.index = i);
      
      console.log('🔀 Queue shuffled');
      
      this._emit('queue:shuffled', {
        itemCount: this.queue.length,
        currentIndex: this.currentIndex
      });
      
      return true;
    }
    
    // =====================================================
    // MODE & BEHAVIOR CONTROLS
    // =====================================================
    
    /**
     * Set autoplay mode
     */
    setAutoplay(enabled) {
      this.autoplay = enabled;
      localStorage.setItem('bantu_autoplay_enabled', enabled);
      
      if (this._dom.autoplayToggle) {
        this._dom.autoplayToggle.classList.toggle('active', enabled);
      }
      
      console.log(`🎵 Autoplay: ${enabled ? 'ON' : 'OFF'}`);
      
      this._emit('queue:autoplay-changed', { enabled });
      return enabled;
    }
    
    /**
     * Set shuffle mode
     */
    setShuffle(enabled) {
      this.shuffleMode = enabled;
      localStorage.setItem('bantu_shuffle_enabled', enabled);
      
      if (this._dom.shuffleToggle) {
        this._dom.shuffleToggle.classList.toggle('active', enabled);
      }
      
      if (enabled && this.queue.length > 1) {
        this.shuffleQueue();
      }
      
      console.log(`🔀 Shuffle: ${enabled ? 'ON' : 'OFF'}`);
      
      this._emit('queue:shuffle-changed', { enabled });
      return enabled;
    }
    
    /**
     * Cycle repeat mode: off → one → all → off
     */
    cycleRepeatMode() {
      const modes = ['off', 'one', 'all'];
      const currentIndex = modes.indexOf(this.repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      
      this.repeatMode = modes[nextIndex];
      
      this._updateRepeatToggleUI();
      
      console.log(`🔁 Repeat mode: ${this.repeatMode}`);
      
      this._emit('queue:repeat-changed', { mode: this.repeatMode });
      return this.repeatMode;
    }
    
    /**
     * Set repeat mode directly
     */
    setRepeatMode(mode) {
      if (!['off', 'one', 'all'].includes(mode)) {
        console.warn('⚠️ Invalid repeat mode:', mode);
        return this.repeatMode;
      }
      
      this.repeatMode = mode;
      this._updateRepeatToggleUI();
      
      console.log(`🔁 Repeat mode set: ${mode}`);
      
      this._emit('queue:repeat-changed', { mode });
      return mode;
    }
    
    // =====================================================
    // GETTERS & STATE
    // =====================================================
    
    /**
     * Get current queue item
     */
    getCurrentItem() {
      return this.queue[this.currentIndex] || null;
    }
    
    /**
     * Get next queue item (without advancing)
     */
    getNextItem() {
      if (this.queue.length === 0) return null;
      
      if (this.shuffleMode) {
        // Return random item (not current)
        const available = this.queue.filter((_, i) => i !== this.currentIndex);
        return available[Math.floor(Math.random() * available.length)] || null;
      }
      
      if (this.currentIndex < this.queue.length - 1) {
        return this.queue[this.currentIndex + 1];
      }
      
      if (this.repeatMode === 'all') {
        return this.queue[0];
      }
      
      return null;
    }
    
    /**
     * Get previous queue item (without rewinding)
     */
    getPreviousItem() {
      if (this.currentIndex <= 0) return null;
      return this.queue[this.currentIndex - 1];
    }
    
    /**
     * Get queue metadata
     */
    _getQueueMetadata() {
      return {
        source: this.source,
        sourceId: this.sourceId,
        sourceMetadata: this.sourceMetadata,
        collectionContext: { ...this.collectionContext },
        modes: {
          autoplay: this.autoplay,
          shuffle: this.shuffleMode,
          repeat: this.repeatMode
        },
        playbackSessionId: this.playbackSessionId
      };
    }
    
    /**
     * Get public-facing queue (without internal fields)
     */
    _getPublicQueue() {
      return this.queue.map(item => {
        const { _normalized, index, ...publicItem } = item;
        return publicItem;
      });
    }
    
    /**
     * Get full queue state for export
     */
    getState() {
      return {
        queue: this._getPublicQueue(),
        currentIndex: this.currentIndex,
        metadata: this._getQueueMetadata(),
        timestamp: Date.now()
      };
    }
    
    // =====================================================
    // PERSISTENCE
    // =====================================================
    
    /**
     * Save queue state to localStorage
     */
    _saveToStorage() {
      if (this._saveDebounceTimer) {
        clearTimeout(this._saveDebounceTimer);
      }
      
      this._saveDebounceTimer = setTimeout(() => {
        try {
          const state = this.getState();
          localStorage.setItem(this.config.storageKey, JSON.stringify(state));
          this._lastSavedAt = Date.now();
          console.log('💾 Queue state saved');
        } catch (error) {
          console.warn('⚠️ Failed to save queue state:', error);
        }
      }, 500); // Debounce saves
    }
    
    /**
     * Restore queue state from localStorage
     */
    _restoreFromStorage() {
      try {
        const saved = localStorage.getItem(this.config.storageKey);
        if (!saved) return false;
        
        const state = JSON.parse(saved);
        const maxAge = this.config.cacheTTL;
        
        // Check if state is too old
        if (Date.now() - state.timestamp > maxAge) {
          console.log('⏰ Queue state expired, clearing');
          localStorage.removeItem(this.config.storageKey);
          return false;
        }
        
        // Restore queue if items exist
        if (state.queue?.length > 0) {
          // Preserve current behavior modes
          const preservedModes = {
            autoplay: this.autoplay,
            shuffle: this.shuffleMode,
            repeat: this.repeatMode
          };
          
          // Re-initialize with restored data
          this.initialize(state.queue, {
            startIndex: state.currentIndex ?? 0,
            source: state.metadata?.source,
            sourceId: state.metadata?.sourceId,
            autoplay: preservedModes.autoplay,
            shuffle: preservedModes.shuffle,
            repeat: preservedModes.repeat,
            collectionId: state.metadata?.collectionContext?.collectionId,
            playlistId: state.metadata?.collectionContext?.playlistId
          });
          
          console.log('💾 Queue state restored');
          return true;
        }
        
      } catch (error) {
        console.warn('⚠️ Failed to restore queue state:', error);
        // Clear corrupted state
        localStorage.removeItem(this.config.storageKey);
      }
      
      return false;
    }
    
    // =====================================================
    // EVENT SYSTEM
    // =====================================================
    
    /**
     * Subscribe to queue events
     */
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      
      // Return unsubscribe function
      return () => {
        const set = this._listeners.get(event);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this._listeners.delete(event);
          }
        }
      };
    }
    
    /**
     * Emit event to listeners
     */
    _emit(event, data) {
      if (this._listeners.has(event)) {
        for (const callback of this._listeners.get(event)) {
          try {
            callback(data);
          } catch (error) {
            console.error(`❌ Error in ${event} listener:`, error);
          }
        }
      }
      
      // Also emit to global event system if available
      if (window.dispatchEvent) {
        try {
          window.dispatchEvent(new CustomEvent(`queue:${event}`, {
            detail: { ...data, queueManager: this }
          }));
        } catch (e) {
          // Ignore global dispatch errors
        }
      }
    }
    
    // =====================================================
    // CLEANUP & DESTROY
    // =====================================================
    
    /**
     * Cleanup resources and detach listeners
     */
    destroy() {
      console.log('🧹 QueueManager destroying...');
      
      // Cleanup telemetry session
      this._cleanupWatchSession();
      
      // Save final state
      this._saveToStorage();
      
      // Clear DOM event listeners (handled by clone/replace in _attachControls)
      
      // Clear internal references
      this.queue = [];
      this._listeners.clear();
      this._dom = {};
      this._stateManager = null;
      
      this._isInitialized = false;
      
      console.log('✅ QueueManager destroyed');
    }
  }
  
  // =====================================================
  // GLOBAL EXPORT & INITIALIZATION
  // =====================================================
  
  // Create singleton instance
  const queueManager = new QueueManager();
  
  // Export for global access
  window.QueueManager = queueManager;
  
  // Also export class for advanced usage
  window.QueueManagerClass = QueueManager;
  
  // Auto-initialize if queue data exists in URL params
  document.addEventListener('DOMContentLoaded', () => {
    // Check for queue restoration params
    const params = new URLSearchParams(window.location.search);
    const queueParam = params.get('queue');
    
    if (queueParam) {
      try {
        const queueData = JSON.parse(decodeURIComponent(queueParam));
        if (Array.isArray(queueData.items) && queueData.items.length > 0) {
          queueManager.initialize(queueData.items, {
            startIndex: queueData.currentIndex ?? 0,
            source: queueData.source,
            sourceId: queueData.sourceId,
            collectionId: queueData.collectionId,
            playlistId: queueData.playlistId
          });
          console.log('🔄 Queue restored from URL params');
        }
      } catch (e) {
        console.warn('⚠️ Failed to parse queue from URL:', e);
      }
    }
  });
  
  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QueueManager;
  }
  
  console.log('✅ QueueManager module loaded successfully (Phase 3 + Phase 1D Enhanced)');
  
})();
