// js/content-collections-engine.js — Collection & Series Engine
// Bantu Stream Connect — Phase 3 Schema + Phase 1D Collection Intelligence
// ✅ Uses playlist_contents junction table for polymorphic collections
// ✅ Read-optimized metrics via content_public_metrics view
// ✅ Unified support for series (episodes) and albums (tracks)
// ✅ StateManager integration for synchronized app state
// ✅ RecommendationEngine integration for smart "next up" suggestions
// ✅ Collection progress tracking with watch_progress integration
// ✅ Caching layer with TTL-based invalidation
// ✅ Event emission system for cross-component communication
// ✅ Offline-aware loading with graceful degradation
// ✅ Telemetry context propagation to WatchSessionManager

(function() {
  'use strict';
  
  console.log('📚 ContentCollectionsEngine module loading... (Phase 3 + Phase 1D Enhanced)');

  /**
   * ContentCollectionsEngine — Manages collection/series/album loading,
   * rendering, and navigation with Phase 3 schema compatibility
   */
  class ContentCollectionsEngine {
    constructor(config = {}) {
      // Configuration
      this.config = {
        supabase: config.supabase || window.supabase,
        cacheTTL: config.cacheTTL || 300000, // 5 minutes
        maxItemsPerCollection: config.maxItemsPerCollection || 100,
        enableRecommendations: config.enableRecommendations !== false,
        enableProgressTracking: config.enableProgressTracking !== false,
        ...config
      };
      
      // Core state
      this.currentCollection = null;
      this.currentItems = [];
      this.collectionMetadata = null;
      
      // Loading state
      this.isLoading = false;
      this.loadError = null;
      this.lastLoadedAt = null;
      
      // Cache layer
      this._cache = new Map(); // collectionId -> { data, metadata, cachedAt, expiresAt }
      
      // DOM references (lazy-loaded)
      this._dom = {};
      
      // Event system
      this._listeners = new Map();
      
      // Integration references
      this._stateManager = null;
      this._recommendationEngine = null;
      
      // Collection type detection
      this.COLLECTION_TYPES = {
        SERIES: 'series',      // Episodic video content
        ALBUM: 'album',        // Audio/music tracks
        PLAYLIST: 'playlist',  // Mixed media collections
        SEASON: 'season',      // Season within a series
        COMPILATION: 'compilation' // Curated mixed content
      };
      
      console.log('✅ ContentCollectionsEngine instantiated', {
        cacheTTL: this.config.cacheTTL,
        maxItems: this.config.maxItemsPerCollection
      });
    }
    
    // =====================================================
    // INITIALIZATION & SETUP
    // =====================================================
    
    /**
     * Initialize engine with content context
     * @param {Object} content - Current content item with series_id/collection context
     * @param {Object} options - Additional initialization options
     */
    async initialize(content, options = {}) {
      if (!content) {
        console.warn('⚠️ initialize() called without content');
        return false;
      }
      
      // Detect collection identifier (supports multiple schema patterns)
      const collectionId = content.series_id || content.playlist_id || content.collection_id;
      
      if (!collectionId) {
        console.log('ℹ️ Content has no collection context, skipping collection engine');
        return false;
      }
      
      console.log('🎵 Loading collection context...', {
        collectionId,
        contentType: content.media_type,
        episodeNumber: content.episode_number
      });
      
      // Connect to integrations
      this._connectToIntegrations();
      
      // Load collection with context
      const success = await this.loadCollection(collectionId, {
        currentContentId: content.id,
        currentEpisodeNumber: content.episode_number,
        currentSortIndex: content.sort_index,
        mediaType: content.media_type,
        ...options
      });
      
      if (success) {
        // Update StateManager with collection context
        this._updateStateManager();
        
        // Emit initialization event
        this._emit('collection:initialized', {
          collection: this.currentCollection,
          itemCount: this.currentItems.length,
          currentContentId: content.id
        });
      }
      
      return success;
    }
    
    /**
     * Connect to StateManager and RecommendationEngine
     */
    _connectToIntegrations() {
      // StateManager connection
      if (window.stateManager || window.state?._manager) {
        this._stateManager = window.stateManager || window.state._manager;
        
        // Subscribe to collection state changes
        this._stateManager.subscribe('collection:context-changed', (data) => {
          if (data?.collectionId && data.collectionId !== this.currentCollection?.id) {
            console.log('🔄 Collection context changed externally, reloading...');
            this.loadCollection(data.collectionId);
          }
        });
        
        console.log('🔗 Connected to StateManager');
      }
      
      // RecommendationEngine connection
      if (window.RecommendationEngine) {
        this._recommendationEngine = new RecommendationEngine({
          supabase: this.config.supabase,
          userId: this._stateManager?.getState('user')?.id,
          limit: 6
        });
        console.log('🔗 Connected to RecommendationEngine');
      }
    }
    
    /**
     * Update StateManager with current collection context
     */
    _updateStateManager() {
      if (!this._stateManager || !this.currentCollection) return;
      
      this._stateManager.setCollectionContext(
        this.currentCollection.id,
        this.collectionMetadata?.currentEpisodeNumber,
        this.collectionMetadata?.currentSortIndex,
        {
          name: this.currentCollection.name,
          type: this.currentCollection.playlist_type,
          description: this.currentCollection.description,
          itemCount: this.currentItems.length
        }
      );
      
      // Update queue in StateManager
      if (this.currentItems.length > 0) {
        this._stateManager.setQueue(this.currentItems, {
          source: this._getCollectionSourceType(),
          playlistId: this.currentCollection.id,
          collectionId: this.currentCollection.series_id || this.currentCollection.id
        });
      }
    }
    
    // =====================================================
    // COLLECTION LOADING & CACHING
    // =====================================================
    
    /**
     * Load collection by ID with caching and context
     * @param {string|number} collectionId - Collection/playlist/series ID
     * @param {Object} context - Loading context (currentContentId, mediaType, etc.)
     */
    async loadCollection(collectionId, context = {}) {
      if (this.isLoading) {
        console.log('⏳ Collection load already in progress');
        return false;
      }
      
      const collectionIdStr = String(collectionId);
      this.isLoading = true;
      this.loadError = null;
      
      this._emit('collection:loading', { collectionId: collectionIdStr });
      
      try {
        // Check cache first
        const cached = this._getCachedCollection(collectionIdStr);
        if (cached && !context.forceRefresh) {
          console.log('📦 Serving collection from cache:', collectionIdStr);
          this._applyCachedCollection(cached, context);
          return true;
        }
        
        // Load from database
        const result = await this._fetchCollectionData(collectionIdStr, context);
        
        if (!result?.collection || !result?.items) {
          throw new Error('Failed to load collection data');
        }
        
        // Store in state
        this.currentCollection = result.collection;
        this.currentItems = result.items;
        this.collectionMetadata = {
          ...context,
          loadedAt: Date.now(),
          collectionType: this._detectCollectionType(result.collection, result.items)
        };
        this.lastLoadedAt = Date.now();
        
        // Cache the result
        this._cacheCollection(collectionIdStr, result, context);
        
        // Render UI
        this.renderCollection();
        
        // Initialize QueueManager with collection items
        this._initializeQueueManager(context);
        
        // Load recommendations if enabled
        if (this.config.enableRecommendations) {
          await this._loadCollectionRecommendations();
        }
        
        // Track collection view for analytics
        this._trackCollectionView();
        
        console.log('✅ Collection loaded:', {
          id: collectionIdStr,
          name: result.collection.name,
          type: this.collectionMetadata.collectionType,
          itemCount: result.items.length
        });
        
        this._emit('collection:loaded', {
          collection: this.currentCollection,
          itemCount: this.currentItems.length,
          type: this.collectionMetadata.collectionType
        });
        
        return true;
        
      } catch (error) {
        console.error('❌ Collection load failed:', error);
        this.loadError = error;
        
        this._emit('collection:error', {
          collectionId: collectionIdStr,
          error: error.message
        });
        
        return false;
        
      } finally {
        this.isLoading = false;
      }
    }
    
    /**
     * Fetch collection data from Supabase with Phase 3 schema
     */
    async _fetchCollectionData(collectionId, context = {}) {
      const { currentContentId, mediaType } = context;
      
      // Step 1: Load collection metadata from creator_playlists
      const { data: collection, error: collectionError } = await this.config.supabase
        .from('creator_playlists')
        .select(`
          id,
          name,
          description,
          playlist_type,
          genre,
          thumbnail_url,
          banner_url,
          status,
          user_id,
          created_at,
          updated_at,
          metadata,
          content_engagement_stats!inner (
            total_views,
            total_likes,
            total_valid_views
          ),
          user_profiles!user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('id', collectionId)
        .eq('status', 'published')
        .single();
      
      if (collectionError || !collection) {
        throw new Error(`Collection not found: ${collectionError?.message || 'Unknown error'}`);
      }
      
      // Step 2: Load items via playlist_contents junction table (Phase 3 schema)
      let itemsQuery = this.config.supabase
        .from('playlist_contents')
        .select(`
          playlist_id,
          content_id,
          sort_index,
          item_type,
          track_number,
          season_number,
          display_title_override,
          added_at,
          content:content_id (
            id,
            title,
            description,
            thumbnail_url,
            file_url,
            duration,
            media_type,
            content_format,
            genre,
            episode_number,
            series_id,
            user_id,
            created_at,
            status,
            content_engagement_stats!inner (
              total_views,
              total_likes,
              total_valid_views
            ),
            user_profiles!user_id (
              full_name,
              username,
              avatar_url
            )
          )
        `)
        .eq('playlist_id', collectionId)
        .eq('content.status', 'published')
        .order('sort_index', { ascending: true, nullsFirst: false })
        .limit(this.config.maxItemsPerCollection);
      
      // Optional: Filter by media type if specified
      if (mediaType) {
        itemsQuery = itemsQuery.eq('content.media_type', mediaType);
      }
      
      const { data: junctionItems, error: itemsError } = await itemsQuery;
      
      if (itemsError) {
        console.warn('⚠️ Items query had issues, falling back to direct Content query:', itemsError.message);
        // Fallback: Direct query (legacy support)
        return await this._fetchCollectionFallback(collectionId, collection, context);
      }
      
      // Step 3: Normalize items with playlist_relation metadata
      const normalizedItems = junctionItems
        .filter(item => item.content) // Filter out null content references
        .map((item, index) => this._normalizeCollectionItem(item, index, collection));
      
      return {
        collection: this._enrichCollectionMetadata(collection),
        items: normalizedItems
      };
    }
    
    /**
     * Fallback fetch using direct Content query (legacy schema support)
     */
    async _fetchCollectionFallback(collectionId, collection, context = {}) {
      const { data: items, error } = await this.config.supabase
        .from('Content')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          file_url,
          duration,
          media_type,
          content_format,
          genre,
          episode_number,
          series_id,
          user_id,
          created_at,
          status,
          content_engagement_stats!inner (
            total_views,
            total_likes
          ),
          user_profiles!user_id (
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('series_id', collectionId)
        .eq('status', 'published')
        .order('episode_number', { ascending: true, nullsFirst: false })
        .limit(this.config.maxItemsPerCollection);
      
      if (error) throw error;
      
      // Normalize with synthetic playlist_relation
      const normalizedItems = (items || []).map((item, index) => ({
        ...this._normalizeCollectionItem({ content: item, sort_index: index }, index, collection),
        playlist_relation: {
          sort_index: item.episode_number ?? index,
          item_type: item.media_type === 'audio' ? 'track' : 'episode',
          track_number: item.episode_number,
          season_number: item.season_number,
          title_override: null
        }
      }));
      
      return {
        collection: this._enrichCollectionMetadata(collection),
        items: normalizedItems
      };
    }
    
    /**
     * Normalize a collection item with playlist_relation metadata
     */
    _normalizeCollectionItem(junctionItem, index, collection) {
      const content = junctionItem.content;
      const relation = junctionItem.playlist_relation || {};
      
      return {
        // Core content fields
        id: content.id,
        content_id: content.id,
        title: relation.title_override || content.title || 'Untitled',
        description: content.description,
        thumbnail_url: content.thumbnail_url,
        file_url: content.file_url,
        duration: content.duration,
        media_type: content.media_type,
        content_format: content.content_format,
        genre: content.genre || collection.genre,
        
        // Collection positioning metadata
        sort_index: relation.sort_index ?? junctionItem.sort_index ?? index,
        item_type: relation.item_type ?? junctionItem.item_type ?? this._detectItemType(content),
        track_number: relation.track_number ?? junctionItem.track_number ?? content.episode_number,
        season_number: relation.season_number ?? junctionItem.season_number ?? content.season_number,
        display_title: relation.title_override,
        
        // Series/collection context
        series_id: content.series_id || collection.id,
        collection_id: collection.id,
        collection_name: collection.name,
        collection_type: collection.playlist_type,
        
        // Creator info
        creator_id: content.user_id,
        creator_name: content.user_profiles?.full_name || content.user_profiles?.username,
        creator_avatar: content.user_profiles?.avatar_url,
        
        // Metrics (from content_engagement_stats)
        views_count: content.content_engagement_stats?.total_views || 0,
        likes_count: content.content_engagement_stats?.total_likes || 0,
        valid_views_count: content.content_engagement_stats?.total_valid_views || 0,
        
        // Timestamps
        created_at: content.created_at,
        added_to_collection: junctionItem.added_at || content.created_at,
        
        // Phase 1D: Progress tracking
        progress: null, // Populated by _enrichWithProgress()
        
        // Internal flags
        _index: index,
        _collectionId: collection.id
      };
    }
    
    /**
     * Detect item type based on content properties
     */
    _detectItemType(content) {
      if (content.media_type === 'audio') return 'track';
      if (content.episode_number !== null && content.episode_number !== undefined) return 'episode';
      if (content.content_format === 'short') return 'short';
      if (content.content_format === 'live') return 'live';
      return 'video';
    }
    
    /**
     * Detect collection type from metadata and items
     */
    _detectCollectionType(collection, items) {
      const type = collection.playlist_type?.toLowerCase();
      
      if (type) {
        if (type === 'series' || type === 'show') return this.COLLECTION_TYPES.SERIES;
        if (type === 'album' || type === 'music') return this.COLLECTION_TYPES.ALBUM;
        if (type === 'season') return this.COLLECTION_TYPES.SEASON;
        if (type === 'compilation') return this.COLLECTION_TYPES.COMPILATION;
      }
      
      // Infer from items if type not explicit
      if (items?.length > 0) {
        const hasEpisodes = items.some(i => i.episode_number !== null);
        const hasTracks = items.some(i => i.media_type === 'audio');
        
        if (hasEpisodes && !hasTracks) return this.COLLECTION_TYPES.SERIES;
        if (hasTracks && !hasEpisodes) return this.COLLECTION_TYPES.ALBUM;
      }
      
      return this.COLLECTION_TYPES.PLAYLIST;
    }
    
    /**
     * Enrich collection metadata with computed fields
     */
    _enrichCollectionMetadata(collection) {
      return {
        ...collection,
        // Normalized metrics
        views_count: collection.content_engagement_stats?.total_views || 0,
        likes_count: collection.content_engagement_stats?.total_likes || 0,
        // Creator info
        creator: {
          id: collection.user_id,
          name: collection.user_profiles?.full_name || collection.user_profiles?.username,
          avatar: collection.user_profiles?.avatar_url
        },
        // Computed fields
        item_count: 0, // Set after items loaded
        total_duration: 0, // Computed from items
        collection_type: this._detectCollectionType(collection, [])
      };
    }
    
    // =====================================================
    // CACHE MANAGEMENT
    // =====================================================
    
    /**
     * Get cached collection if valid
     */
    _getCachedCollection(collectionId) {
      const cached = this._cache.get(collectionId);
      if (!cached) return null;
      
      // Check expiration
      if (Date.now() >= cached.expiresAt) {
        console.log('🗑️ Cache expired for collection:', collectionId);
        this._cache.delete(collectionId);
        return null;
      }
      
      return cached;
    }
    
    /**
     * Apply cached collection to state
     */
    _applyCachedCollection(cached, context) {
      this.currentCollection = cached.data.collection;
      this.currentItems = cached.data.items;
      this.collectionMetadata = {
        ...context,
        ...cached.metadata,
        fromCache: true
      };
      this.lastLoadedAt = cached.cachedAt;
      
      // Re-render with cached data
      this.renderCollection();
      this._initializeQueueManager(context);
    }
    
    /**
     * Cache collection data
     */
    _cacheCollection(collectionId, data, context) {
      const now = Date.now();
      
      this._cache.set(collectionId, {
        data,
        metadata: {
          ...context,
          cachedAt: now,
          itemCount: data.items?.length || 0
        },
        cachedAt: now,
        expiresAt: now + this.config.cacheTTL
      });
      
      // Prune old cache entries if over limit
      if (this._cache.size > 20) {
        const oldest = Array.from(this._cache.entries())
          .sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
        if (oldest) {
          this._cache.delete(oldest[0]);
          console.log('🧹 Pruned oldest cache entry');
        }
      }
    }
    
    /**
     * Clear cache for specific collection or all
     */
    clearCache(collectionId = null) {
      if (collectionId) {
        this._cache.delete(String(collectionId));
        console.log('🧹 Cache cleared for collection:', collectionId);
      } else {
        this._cache.clear();
        console.log('🧹 All collection cache cleared');
      }
    }
    
    // =====================================================
    // PROGRESS TRACKING (Phase 1D)
    // =====================================================
    
    /**
     * Enrich items with user progress data
     */
    async _enrichWithProgress(items, userId) {
      if (!userId || !this.config.enableProgressTracking || items.length === 0) {
        return items;
      }
      
      try {
        const contentIds = items.map(i => i.id).filter(Boolean);
        
        const { data: progress, error } = await this.config.supabase
          .from('watch_progress')
          .select('content_id, last_position, is_completed, updated_at')
          .eq('user_id', userId)
          .in('content_id', contentIds);
        
        if (error) throw error;
        
        // Create lookup map
        const progressMap = new Map((progress || []).map(p => [p.content_id, p]));
        
        // Merge progress into items
        return items.map(item => {
          const prog = progressMap.get(item.id);
          return {
            ...item,
            progress: prog ? {
              last_position: prog.last_position,
              is_completed: prog.is_completed,
              updated_at: prog.updated_at,
              percent: item.duration > 0 
                ? Math.min(100, Math.round((prog.last_position / item.duration) * 100))
                : 0
            } : null
          };
        });
        
      } catch (error) {
        console.warn('⚠️ Failed to load progress data:', error);
        return items;
      }
    }
    
    // =====================================================
    // RECOMMENDATIONS (Phase 1D)
    // =====================================================
    
    /**
     * Load smart recommendations for collection
     */
    async _loadCollectionRecommendations() {
      if (!this._recommendationEngine || !this.currentCollection) return;
      
      const collectionType = this.collectionMetadata?.collectionType;
      
      try {
        let recommendations = [];
        
        switch (collectionType) {
          case this.COLLECTION_TYPES.SERIES:
          case this.COLLECTION_TYPES.SEASON:
            // Next episodes in series
            recommendations = await this._recommendationEngine.getRecommendations(
              this._recommendationEngine.TYPES.NEXT_IN_COLLECTION,
              {
                collectionId: this.currentCollection.id,
                currentEpisode: this.collectionMetadata?.currentEpisodeNumber,
                limit: 4
              }
            );
            break;
            
          case this.COLLECTION_TYPES.ALBUM:
            // More from same artist/genre
            recommendations = await this._recommendationEngine.getRecommendations(
              this._recommendationEngine.TYPES.BECAUSE_YOU_WATCHED_COLLECTION,
              {
                excludeCollectionId: this.currentCollection.id,
                limit: 4
              }
            );
            break;
            
          default:
            // Popular in same genre
            recommendations = await this._recommendationEngine.getRecommendations(
              this._recommendationEngine.TYPES.POPULAR_IN_SERIES,
              {
                collectionId: this.currentCollection.id,
                limit: 4
              }
            );
        }
        
        if (recommendations?.length > 0) {
          this._emit('collection:recommendations-loaded', {
            recommendations,
            collectionType
          });
        }
        
      } catch (error) {
        console.warn('⚠️ Failed to load recommendations:', error);
      }
    }
    
    // =====================================================
    // QUEUE INTEGRATION
    // =====================================================
    
    /**
     * Initialize QueueManager with collection items
     */
    _initializeQueueManager(context = {}) {
      if (!window.QueueManager) {
        console.warn('⚠️ QueueManager not available');
        return;
      }
      
      const startIndex = this._findStartIndex(context);
      
      window.QueueManager.initialize(this.currentItems, {
        source: this._getCollectionSourceType(),
        sourceId: this.currentCollection.id,
        startIndex,
        context: {
          collectionName: this.currentCollection.name,
          collectionType: this.collectionMetadata?.collectionType
        },
        autoplay: this._stateManager?.getState('preferences.autoplay') ?? true,
        collectionId: this.currentCollection.series_id || this.currentCollection.id,
        playlistId: this.currentCollection.id
      });
      
      // Highlight current item in queue UI
      if (context.currentContentId) {
        setTimeout(() => {
          if (window.highlightQueueItem) {
            window.highlightQueueItem(context.currentContentId);
          }
        }, 100);
      }
    }
    
    /**
     * Find appropriate start index based on context
     */
    _findStartIndex(context) {
      const { currentContentId, currentEpisodeNumber, currentSortIndex } = context;
      
      // Priority 1: Explicit content ID
      if (currentContentId) {
        const idx = this.currentItems.findIndex(i => String(i.id) === String(currentContentId));
        if (idx >= 0) return idx;
      }
      
      // Priority 2: Episode/track number matching
      if (currentEpisodeNumber !== null && currentEpisodeNumber !== undefined) {
        const idx = this.currentItems.findIndex(i => 
          i.episode_number === currentEpisodeNumber || i.track_number === currentEpisodeNumber
        );
        if (idx >= 0) return idx;
      }
      
      // Priority 3: Sort index matching
      if (currentSortIndex !== null && currentSortIndex !== undefined) {
        const idx = this.currentItems.findIndex(i => i.sort_index === currentSortIndex);
        if (idx >= 0) return idx;
      }
      
      // Default: Start at beginning
      return 0;
    }
    
    /**
     * Get queue source type for analytics
     */
    _getCollectionSourceType() {
      const type = this.collectionMetadata?.collectionType;
      if (type === this.COLLECTION_TYPES.SERIES) return 'series';
      if (type === this.COLLECTION_TYPES.ALBUM) return 'album';
      if (type === this.COLLECTION_TYPES.SEASON) return 'season';
      return 'playlist';
    }
    
    // =====================================================
    // RENDERING
    // =====================================================
    
    /**
     * Render collection UI section
     */
    renderCollection() {
      if (!this.currentCollection || !this.currentItems.length) {
        this._hideCollectionSection();
        return;
      }
      
      // Lazy-load DOM references
      this._loadDomReferences();
      
      // Show section
      if (this._dom.section) {
        this._dom.section.classList.remove('hidden');
        this._dom.section.setAttribute('data-collection-type', this.collectionMetadata?.collectionType || 'playlist');
      }
      
      // Render header metadata
      this._renderCollectionHeader();
      
      // Render queue/items list
      this._renderQueue();
      
      // Render progress bar if applicable
      this._renderCollectionProgress();
      
      // Attach event listeners
      this._attachQueueEvents();
      
      console.log('🎨 Collection rendered:', {
        name: this.currentCollection.name,
        itemCount: this.currentItems.length,
        type: this.collectionMetadata?.collectionType
      });
    }
    
    /**
     * Lazy-load DOM references
     */
    _loadDomReferences() {
      if (Object.keys(this._dom).length > 0) return;
      
      this._dom = {
        section: document.getElementById('collectionPlaybackSection'),
        title: document.getElementById('collectionTitle'),
        subtitle: document.getElementById('collectionSubtitle'),
        type: document.getElementById('collectionType'),
        badge: document.getElementById('collectionBadge'),
        count: document.getElementById('collectionItemsCount'),
        duration: document.getElementById('collectionDuration'),
        creator: document.getElementById('collectionCreator'),
        thumbnail: document.getElementById('collectionThumbnail'),
        banner: document.getElementById('collectionBanner'),
        queue: document.getElementById('playlistQueue'),
        queueList: document.querySelector('.queue-list, .playlist-queue'),
        progressBar: document.getElementById('collectionProgressBar'),
        progressText: document.getElementById('collectionProgressText'),
        recommendations: document.getElementById('collectionRecommendations')
      };
    }
    
    /**
     * Hide collection section
     */
    _hideCollectionSection() {
      if (this._dom.section) {
        this._dom.section.classList.add('hidden');
      }
    }
    
    /**
     * Render collection header metadata
     */
    _renderCollectionHeader() {
      const c = this.currentCollection;
      const m = this.collectionMetadata;
      
      if (this._dom.title) {
        this._dom.title.textContent = c.name || 'Collection';
      }
      
      if (this._dom.subtitle && c.description) {
        this._dom.subtitle.textContent = c.description;
        this._dom.subtitle.classList.remove('hidden');
      } else if (this._dom.subtitle) {
        this._dom.subtitle.classList.add('hidden');
      }
      
      if (this._dom.type) {
        this._dom.type.textContent = this._formatCollectionType(m?.collectionType);
      }
      
      if (this._dom.badge) {
        this._dom.badge.textContent = (c.playlist_type || 'playlist').toUpperCase();
      }
      
      if (this._dom.count) {
        this._dom.count.textContent = `${this.currentItems.length} ${this._formatItemType(m?.collectionType)}s`;
      }
      
      if (this._dom.duration) {
        const totalDuration = this.currentItems.reduce((sum, i) => sum + (i.duration || 0), 0);
        this._dom.duration.textContent = this._formatDuration(totalDuration);
      }
      
      if (this._dom.creator && c.creator?.name) {
        this._dom.creator.textContent = `by ${c.creator.name}`;
      }
      
      if (this._dom.thumbnail && c.thumbnail_url) {
        this._dom.thumbnail.src = window.SupabaseHelper?.fixMediaUrl?.(c.thumbnail_url) || c.thumbnail_url;
        this._dom.thumbnail.alt = c.name;
      }
      
      if (this._dom.banner && c.banner_url) {
        this._dom.banner.style.backgroundImage = `url(${window.SupabaseHelper?.fixMediaUrl?.(c.banner_url) || c.banner_url})`;
        this._dom.banner.classList.remove('hidden');
      } else if (this._dom.banner) {
        this._dom.banner.classList.add('hidden');
      }
    }
    
    /**
     * Render queue/items list
     */
    _renderQueue() {
      if (!this._dom.queue && !this._dom.queueList) return;
      
      const target = this._dom.queueList || this._dom.queue;
      const collectionType = this.collectionMetadata?.collectionType;
      
      target.innerHTML = this.currentItems.map((item, index) => {
        const isActive = String(item.id) === String(this.collectionMetadata?.currentContentId);
        const progress = item.progress;
        const isCompleted = progress?.is_completed;
        const percent = progress?.percent || 0;
        
        return `
          <div 
            class="queue-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}"
            data-content-id="${item.id}"
            data-sort-index="${item.sort_index}"
            data-item-type="${item.item_type}"
          >
            <div class="queue-thumbnail">
              <img 
                src="${window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url || ''}" 
                alt="${item.title}"
                loading="lazy"
              >
              <div class="queue-index">
                ${item.track_number || item.episode_number || index + 1}
              </div>
              ${isActive ? '<div class="queue-now-playing-badge">Now Playing</div>' : ''}
              ${isCompleted ? '<div class="queue-completed-badge"><i class="fas fa-check"></i></div>' : ''}
              ${percent > 0 && percent < 100 ? `
                <div class="queue-progress-ring" style="--progress: ${percent}%">
                  <svg viewBox="0 0 36 36" class="progress-ring-circle">
                    <path class="progress-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="progress-ring-fill" stroke-dasharray="${percent}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                </div>
              ` : ''}
            </div>
            
            <div class="queue-content">
              <div class="queue-title">
                ${item.display_title || item.title || 'Untitled'}
                ${item.media_type === 'audio' ? '<i class="fas fa-music queue-media-icon"></i>' : ''}
                ${item.content_format === 'short' ? '<i class="fas fa-bolt queue-media-icon"></i>' : ''}
              </div>
              
              <div class="queue-meta">
                ${item.creator_name ? `<span class="queue-creator">${item.creator_name}</span>` : ''}
                ${item.duration ? `<span class="queue-duration">${this._formatDuration(item.duration)}</span>` : ''}
                ${item.views_count > 0 ? `<span class="queue-views">${this._formatNumber(item.views_count)} views</span>` : ''}
              </div>
              
              ${item.description ? `
                <div class="queue-description hidden-on-mobile">
                  ${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}
                </div>
              ` : ''}
            </div>
            
            <div class="queue-actions">
              <button class="queue-play-btn" title="Play">
                <i class="fas fa-play"></i>
              </button>
              <button class="queue-more-btn" title="More options">
                <i class="fas fa-ellipsis-h"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    /**
     * Render collection progress bar
     */
    _renderCollectionProgress() {
      if (!this._dom.progressBar || !this._stateManager) return;
      
      const userId = this._stateManager.getState('user')?.id;
      if (!userId) return;
      
      // Calculate collection progress
      const completedCount = this.currentItems.filter(i => 
        this._stateManager.isContentCompleted(i.id)
      ).length;
      
      const total = this.currentItems.length;
      const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      
      if (percent > 0) {
        this._dom.progressBar.style.width = `${percent}%`;
        this._dom.progressBar.parentElement?.classList.remove('hidden');
        
        if (this._dom.progressText) {
          this._dom.progressText.textContent = `${completedCount}/${total} completed`;
        }
      } else {
        this._dom.progressBar.parentElement?.classList.add('hidden');
      }
    }
    
    // =====================================================
    // EVENT HANDLING
    // =====================================================
    
    /**
     * Attach event listeners to queue items
     */
    _attachQueueEvents() {
      const queueItems = document.querySelectorAll('.queue-item');
      
      queueItems.forEach(item => {
        // Click to play
        item.addEventListener('click', (e) => {
          // Ignore clicks on action buttons
          if (e.target.closest('.queue-actions')) return;
          
          const contentId = item.dataset.contentId;
          if (contentId && window.QueueManager?.playById) {
            window.QueueManager.playById(contentId);
          }
        });
        
        // Play button
        const playBtn = item.querySelector('.queue-play-btn');
        if (playBtn) {
          playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const contentId = item.dataset.contentId;
            if (contentId && window.QueueManager?.playById) {
              window.QueueManager.playById(contentId);
            }
          });
        }
        
        // More options button
        const moreBtn = item.querySelector('.queue-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showItemOptions(item.dataset.contentId, item);
          });
        }
      });
    }
    
    /**
     * Show item options menu
     */
    _showItemOptions(contentId, itemEl) {
      // Emit event for external handler (e.g., context menu)
      this._emit('collection:item-options', {
        contentId,
        item: this.currentItems.find(i => String(i.id) === String(contentId)),
        element: itemEl
      });
    }
    
    // =====================================================
    // ANALYTICS & TRACKING
    // =====================================================
    
    /**
     * Track collection view for analytics
     */
    _trackCollectionView() {
      if (!this.currentCollection || !window.track) return;
      
      window.track.collectionView?.({
        collectionId: this.currentCollection.id,
        collectionName: this.currentCollection.name,
        collectionType: this.collectionMetadata?.collectionType,
        itemCount: this.currentItems.length,
        source: this.collectionMetadata?.source,
        timestamp: Date.now()
      });
    }
    
    // =====================================================
    // EVENT SYSTEM
    // =====================================================
    
    /**
     * Subscribe to collection events
     */
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      
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
      
      // Also emit to global event system
      if (window.dispatchEvent) {
        try {
          window.dispatchEvent(new CustomEvent(`collection:${event}`, {
            detail: { ...data, engine: this }
          }));
        } catch (e) {
          // Ignore
        }
      }
    }
    
    // =====================================================
    // UTILITIES
    // =====================================================
    
    /**
     * Format collection type for display
     */
    _formatCollectionType(type) {
      const map = {
        [this.COLLECTION_TYPES.SERIES]: 'Series',
        [this.COLLECTION_TYPES.ALBUM]: 'Album',
        [this.COLLECTION_TYPES.PLAYLIST]: 'Playlist',
        [this.COLLECTION_TYPES.SEASON]: 'Season',
        [this.COLLECTION_TYPES.COMPILATION]: 'Compilation'
      };
      return map[type] || (type?.charAt(0).toUpperCase() + type?.slice(1)) || 'Collection';
    }
    
    /**
     * Format item type for display
     */
    _formatItemType(collectionType) {
      if (collectionType === this.COLLECTION_TYPES.ALBUM) return 'track';
      if (collectionType === this.COLLECTION_TYPES.SERIES) return 'episode';
      return 'item';
    }
    
    /**
     * Format duration in seconds to MM:SS or HH:MM:SS
     */
    _formatDuration(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';
      
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Format number with K/M suffixes
     */
    _formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }
    
    // =====================================================
    // PUBLIC API
    // =====================================================
    
    /**
     * Get current collection data
     */
    getCollection() {
      return {
        collection: this.currentCollection,
        items: this.currentItems,
        metadata: this.collectionMetadata,
        isLoading: this.isLoading,
        error: this.loadError
      };
    }
    
    /**
     * Get current item by ID
     */
    getItemById(contentId) {
      return this.currentItems.find(i => String(i.id) === String(contentId)) || null;
    }
    
    /**
     * Get next item in collection
     */
    getNextItem(currentContentId) {
      const idx = this.currentItems.findIndex(i => String(i.id) === String(currentContentId));
      if (idx >= 0 && idx < this.currentItems.length - 1) {
        return this.currentItems[idx + 1];
      }
      return null;
    }
    
    /**
     * Get previous item in collection
     */
    getPreviousItem(currentContentId) {
      const idx = this.currentItems.findIndex(i => String(i.id) === String(currentContentId));
      if (idx > 0) {
        return this.currentItems[idx - 1];
      }
      return null;
    }
    
    /**
     * Check if item is completed
     */
    isItemCompleted(contentId, userId = null) {
      const targetUserId = userId || this._stateManager?.getState('user')?.id;
      if (!targetUserId) return false;
      
      return this._stateManager?.isContentCompleted(contentId) || false;
    }
    
    /**
     * Refresh collection data
     */
    async refresh(options = {}) {
      if (!this.currentCollection?.id) {
        console.warn('⚠️ Cannot refresh: no collection loaded');
        return false;
      }
      
      return await this.loadCollection(this.currentCollection.id, {
        ...options,
        forceRefresh: true
      });
    }
    
    /**
     * Destroy engine and cleanup
     */
    destroy() {
      console.log('🧹 ContentCollectionsEngine destroying...');
      
      // Clear event listeners
      this._listeners.clear();
      
      // Clear cache
      this._cache.clear();
      
      // Reset state
      this.currentCollection = null;
      this.currentItems = [];
      this.collectionMetadata = null;
      
      // Hide UI
      this._hideCollectionSection();
      
      console.log('✅ ContentCollectionsEngine destroyed');
    }
  }
  
  // =====================================================
  // GLOBAL EXPORT & INITIALIZATION
  // =====================================================
  
  // Create singleton instance
  const collectionsEngine = new ContentCollectionsEngine();
  
  // Export for global access
  window.ContentCollectionsEngine = collectionsEngine;
  window.ContentCollectionsEngineClass = ContentCollectionsEngine;
  
  // Auto-initialize if content data is available globally
  document.addEventListener('DOMContentLoaded', () => {
    // Check for global content object (set by content-detail.js)
    if (window.currentContent && window.currentContent.series_id) {
      // Delay to ensure dependencies are loaded
      setTimeout(() => {
        collectionsEngine.initialize(window.currentContent);
      }, 500);
    }
  });
  
  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentCollectionsEngine;
  }
  
  console.log('✅ ContentCollectionsEngine module loaded successfully (Phase 3 + Phase 1D Enhanced)');
  
})();
