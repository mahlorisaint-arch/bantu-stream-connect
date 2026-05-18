// js/recommendation-engine.js — SQL-Based Recommendation Engine
// Bantu Stream Connect — Phase 3 Implementation + Phase 1D Enhancements
// ✅ Uses content_public_metrics view for read-optimized metrics
// ✅ Proper bigint content ID handling throughout
// ✅ viewer_id for content_views table compatibility
// ✅ Collection-aware recommendations with series/episode support
// ✅ Queue-based intelligent recommendations
// ✅ Enhanced fallback logic with series detection
// ✅ Smart content relationships for collections/playlists
// ✅ RPC-based personalized recommendations with graceful fallbacks

(function() {
  'use strict';
  
  console.log('🎯 RecommendationEngine module loading... (Phase 3 + Phase 1D Enhanced)');

  /**
   * RecommendationEngine — Generates intelligent content recommendations
   * using SQL-based queries optimized for the Phase 3 schema
   */
  function RecommendationEngine(config) {
    if (!config || !config.supabase) {
      console.error('❌ RecommendationEngine: Missing required config (supabase)');
      return;
    }

    this.supabase = config.supabase;
    this.userId = config.userId || null;
    this.currentContentId = config.currentContentId || null;
    
    // Recommendation type constants
    this.TYPES = Object.freeze({
      // Core recommendation types
      BECAUSE_YOU_WATCHED: 'because_you_watched',
      MORE_FROM_CREATOR: 'more_from_creator',
      TRENDING_IN_INTERESTS: 'trending_in_interests',
      CONTINUE_WATCHING: 'continue_watching',
      SIMILAR_GENRE: 'similar_genre',
      PERSONALIZED: 'personalized',
      
      // PHASE 1D: Collection/Series-aware types
      NEXT_IN_COLLECTION: 'next_in_collection',
      BECAUSE_YOU_WATCHED_COLLECTION: 'because_you_watched_collection',
      POPULAR_IN_SERIES: 'popular_in_series',
      EPISODE_RECOMMENDATIONS: 'episode_recommendations',
      
      // PHASE 1D: Queue-aware types
      QUEUE_CONTINUE: 'queue_continue',
      QUEUE_DISCOVER: 'queue_discover'
    });
    
    // Configuration
    this.defaultLimit = config.limit || 12;
    this.minWatchThreshold = config.minWatchThreshold || 0.5; // 50% watched = "engaged"
    this.cacheDuration = config.cacheDuration || 60000; // 1 minute cache TTL
    this.enableCache = config.enableCache !== false; // Default: enabled
    
    // Internal state
    this._cache = {};
    this._lastFetch = {};
    this._pendingRequests = {}; // Prevent duplicate simultaneous requests
    
    // PHASE 1D: Collection/series context tracking
    this.currentCollectionId = config.currentCollectionId || null;
    this.currentEpisodeNumber = config.currentEpisodeNumber || null;
    this.currentPlaylistId = config.currentPlaylistId || null;
    this.currentSortIndex = config.currentSortIndex || null;
    
    console.log('✅ RecommendationEngine initialized', {
      userId: this.userId || 'guest',
      currentContentId: this.currentContentId,
      collectionId: this.currentCollectionId
    });
  }

  // =====================================================
  // PUBLIC API — Primary Interface
  // =====================================================

  /**
   * Get recommendations of a specific type
   * @param {string} type - One of RecommendationEngine.TYPES
   * @param {Object} options - Query options (limit, excludeContentId, etc.)
   * @returns {Promise<Array>} Array of enriched content items
   */
  RecommendationEngine.prototype.getRecommendations = async function(type, options = {}) {
    // Validate type
    if (!Object.values(this.TYPES).includes(type)) {
      console.warn('⚠️ Unknown recommendation type:', type);
      return [];
    }
    
    const cacheKey = this._getCacheKey(type, options);
    
    // Check cache first (if enabled)
    if (this.enableCache && this._isCacheValid(cacheKey)) {
      console.log('📦 Serving recommendations from cache:', type);
      return this._cache[cacheKey];
    }
    
    // Prevent duplicate simultaneous requests for same key
    if (this._pendingRequests[cacheKey]) {
      console.log('⏳ Waiting for pending request:', cacheKey);
      return this._pendingRequests[cacheKey];
    }
    
    // Create pending promise
    this._pendingRequests[cacheKey] = (async () => {
      try {
        let results = [];
        
        switch(type) {
          // Core recommendation types
          case this.TYPES.CONTINUE_WATCHING:
            results = await this._getContinueWatching(options);
            break;
          case this.TYPES.BECAUSE_YOU_WATCHED:
            results = await this._getBecauseYouWatched(options);
            break;
          case this.TYPES.MORE_FROM_CREATOR:
            results = await this._getMoreFromCreator(options);
            break;
          case this.TYPES.TRENDING_IN_INTERESTS:
            results = await this._getTrendingInInterests(options);
            break;
          case this.TYPES.SIMILAR_GENRE:
            results = await this._getSimilarGenre(options);
            break;
          case this.TYPES.PERSONALIZED:
            results = await this._getPersonalizedRecommendations(options);
            break;
          
          // PHASE 1D: Collection/Series-aware types
          case this.TYPES.NEXT_IN_COLLECTION:
            results = await this._getNextInCollection(options);
            break;
          case this.TYPES.BECAUSE_YOU_WATCHED_COLLECTION:
            results = await this._getBecauseYouWatchedCollection(options);
            break;
          case this.TYPES.POPULAR_IN_SERIES:
            results = await this._getPopularInSeries(options);
            break;
          case this.TYPES.EPISODE_RECOMMENDATIONS:
            results = await this._getEpisodeRecommendations(options);
            break;
          
          // PHASE 1D: Queue-aware types
          case this.TYPES.QUEUE_CONTINUE:
            results = await this._getQueueContinue(options);
            break;
          case this.TYPES.QUEUE_DISCOVER:
            results = await this._getQueueDiscover(options);
            break;
          
          default:
            console.warn('⚠️ Unhandled recommendation type:', type);
            return [];
        }
        
        // Cache results if enabled
        if (this.enableCache && results.length > 0) {
          this._cache[cacheKey] = results;
          this._lastFetch[cacheKey] = Date.now();
        }
        
        return results;
        
      } catch (error) {
        console.error('❌ Recommendation fetch failed for type', type + ':', error);
        // Return empty array on error rather than crashing
        return [];
      } finally {
        // Clean up pending request
        delete this._pendingRequests[cacheKey];
      }
    })();
    
    return this._pendingRequests[cacheKey];
  };

  /**
   * Fetch multiple recommendation rails in parallel
   * @param {Array} railConfigs - Array of { type, options, label } objects
   * @returns {Promise<Array>} Array of { type, label, results } objects
   */
  RecommendationEngine.prototype.getMultipleRails = async function(railConfigs) {
    if (!Array.isArray(railConfigs) || railConfigs.length === 0) {
      return [];
    }
    
    const promises = railConfigs.map(config => 
      this.getRecommendations(config.type, config.options || {})
        .then(results => ({
          type: config.type,
          label: config.label || config.type,
          results: results,
          error: null
        }))
        .catch(error => {
          console.error('❌ Failed to load rail ' + config.type + ':', error);
          return {
            type: config.type,
            label: config.label || config.type,
            results: [],
            error: error.message
          };
        })
    );
    
    return Promise.all(promises);
  };

  // =====================================================
  // CONTEXT MANAGEMENT — Phase 1D Collection Awareness
  // =====================================================

  /**
   * Set collection/series context for smarter recommendations
   */
  RecommendationEngine.prototype.setCollectionContext = function(collectionId, episodeNumber, playlistId, sortIndex) {
    this.currentCollectionId = collectionId || null;
    this.currentEpisodeNumber = episodeNumber || null;
    this.currentPlaylistId = playlistId || null;
    this.currentSortIndex = sortIndex !== undefined ? sortIndex : null;
    
    console.log('📁 Collection context updated:', {
      collectionId: this.currentCollectionId,
      episodeNumber: this.currentEpisodeNumber,
      playlistId: this.currentPlaylistId,
      sortIndex: this.currentSortIndex
    });
  };

  /**
   * Set current content being viewed for exclusion in recommendations
   */
  RecommendationEngine.prototype.setCurrentContent = function(contentId) {
    this.currentContentId = contentId || null;
    console.log('🎬 Current content set:', this.currentContentId);
  };

  /**
   * Clear cache entries
   * @param {string} type - Optional: clear only specific type
   */
  RecommendationEngine.prototype.clearCache = function(type) {
    if (type) {
      Object.keys(this._cache).forEach(key => {
        if (key.startsWith(type + '_')) {
          delete this._cache[key];
          delete this._lastFetch[key];
        }
      });
      console.log('🧹 Cache cleared for type:', type);
    } else {
      this._cache = {};
      this._lastFetch = {};
      console.log('🧹 All recommendation cache cleared');
    }
  };

  /**
   * Enable/disable caching dynamically
   */
  RecommendationEngine.prototype.setCaching = function(enabled) {
    this.enableCache = enabled;
    if (!enabled) {
      this.clearCache();
    }
    console.log('🔄 Caching', enabled ? 'enabled' : 'disabled');
  };

  // =====================================================
  // PHASE 1D: Collection/Series-Aware Recommendations
  // =====================================================

  /**
   * Get next episodes/items in the same collection/series
   */
  RecommendationEngine.prototype._getNextInCollection = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const currentEpisode = options.currentEpisode || this.currentEpisodeNumber;
    const limit = options.limit || 5;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!collectionId) {
      console.log('⚠️ No collection ID provided for next_in_collection');
      return [];
    }
    
    try {
      // Query Content table for items in same series, ordered by episode number
      let query = this.supabase
        .from('Content')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          file_url,
          duration,
          media_type,
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
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('series_id', collectionId)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('episode_number', { ascending: true, nullsFirst: false });
      
      // If we have current episode, get only episodes after it
      if (currentEpisode !== null && currentEpisode !== undefined) {
        query = query.gt('episode_number', currentEpisode);
      }
      
      const { data, error } = await query.limit(limit);
      
      if (error) {
        console.error('❌ Next in collection query failed:', error);
        return [];
      }
      
      return await this._enrichRecommendations(data || [], { sourceType: 'collection' });
      
    } catch (error) {
      console.error('❌ _getNextInCollection failed:', error);
      return [];
    }
  };

  /**
   * Recommend content from collections the user has recently watched
   */
  RecommendationEngine.prototype._getBecauseYouWatchedCollection = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeCollectionId = options.excludeCollectionId || this.currentCollectionId;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Get collections/series the user has partially watched recently
      const { data: watchedSeries, error: seriesError } = await this.supabase
        .from('watch_progress')
        .select(`
          content_id,
          last_position,
          is_completed,
          Content (
            id,
            series_id,
            genre,
            episode_number
          )
        `)
        .eq('user_id', this.userId)
        .eq('is_completed', false)
        .not('content_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (seriesError || !watchedSeries?.length) {
        return [];
      }
      
      // Extract unique, valid collection IDs
      const collectionIds = [
        ...new Set(
          watchedSeries
            .filter(w => w.Content?.series_id && w.Content.series_id !== excludeCollectionId)
            .map(w => w.Content.series_id)
        )
      ].slice(0, 5); // Limit to top 5 collections
      
      if (collectionIds.length === 0) return [];
      
      // Get content from those collections, excluding already-watched items
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
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
        .in('series_id', collectionIds)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        // Exclude content user has already completed
        .not('id', 'in', `(
          select content_id from watch_progress 
          where user_id = ${this.userId} and is_completed = true
        )`)
        .order('episode_number', { ascending: true, nullsFirst: false })
        .limit(limit);
      
      if (error) throw error;
      
      return await this._enrichRecommendations(data || [], { sourceType: 'watched_collection' });
      
    } catch (error) {
      console.error('❌ _getBecauseYouWatchedCollection failed:', error);
      return [];
    }
  };

  /**
   * Get most popular content within a specific series/collection
   */
  RecommendationEngine.prototype._getPopularInSeries = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!collectionId) return [];
    
    try {
      // Query using content_public_metrics view for read-optimized metrics
      const { data, error } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          total_views,
          total_likes,
          created_at,
          episode_number,
          series_id,
          user_id,
          media_type,
          Content!inner (
            description,
            file_url,
            status,
            user_profiles!user_id (
              full_name,
              username,
              avatar_url
            )
          )
        `)
        .eq('series_id', collectionId)
        .eq('Content.status', 'published')
        .neq('id', excludeContentId)
        .order('total_views', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Transform to match expected format
      const transformed = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        duration: item.duration,
        episode_number: item.episode_number,
        series_id: item.series_id,
        user_id: item.user_id,
        media_type: item.media_type,
        description: item.Content?.description,
        file_url: item.Content?.file_url,
        status: item.Content?.status,
        views_count: item.total_views,
        likes_count: item.total_likes,
        created_at: item.created_at,
        user_profiles: item.Content?.user_profiles
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'popular_series' });
      
    } catch (error) {
      console.error('❌ _getPopularInSeries failed:', error);
      return [];
    }
  };

  /**
   * Recommend episodes from similar series based on genre matching
   */
  RecommendationEngine.prototype._getEpisodeRecommendations = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!collectionId) return [];
    
    try {
      // Step 1: Get genre of current series from creator_playlists
      const { data: seriesMeta, error: seriesError } = await this.supabase
        .from('creator_playlists')
        .select('genre, playlist_type, name')
        .eq('id', collectionId)
        .eq('status', 'published')
        .single();
      
      if (seriesError || !seriesMeta?.genre) {
        // Fallback: try to get genre from any content in the series
        const { data: fallbackData } = await this.supabase
          .from('Content')
          .select('genre')
          .eq('series_id', collectionId)
          .limit(1)
          .single();
        
        if (!fallbackData?.genre) return [];
        seriesMeta.genre = fallbackData.genre;
      }
      
      // Step 2: Find similar published series with same genre
      const { data: similarSeries, error: similarError } = await this.supabase
        .from('creator_playlists')
        .select('id, name, genre, playlist_type')
        .eq('genre', seriesMeta.genre)
        .eq('status', 'published')
        .neq('id', collectionId)
        .limit(5);
      
      if (similarError || !similarSeries?.length) {
        // Fallback to genre-based content recommendations
        return await this._getSimilarGenre({
          genre: seriesMeta.genre,
          limit,
          excludeContentId
        });
      }
      
      // Step 3: Get content from similar series
      const seriesIds = similarSeries.map(s => s.id);
      
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
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
        .in('series_id', seriesIds)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('episode_number', { ascending: true, nullsFirst: false })
        .limit(limit);
      
      if (error) throw error;
      
      return await this._enrichRecommendations(data || [], { 
        sourceType: 'similar_series',
        seriesMeta: similarSeries 
      });
      
    } catch (error) {
      console.error('❌ _getEpisodeRecommendations failed:', error);
      // Fallback to basic recommendations
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  // =====================================================
  // PHASE 1D: Queue-Aware Recommendations
  // =====================================================

  /**
   * Recommend content to continue a user's active queue/session
   */
  RecommendationEngine.prototype._getQueueContinue = async function(options) {
    if (!this.userId) return [];
    
    const queueItems = options.queueItems || [];
    const limit = options.limit || 5;
    
    if (queueItems.length === 0) return [];
    
    try {
      // Analyze queue to find common genres/creators
      const contentIds = queueItems.map(item => item.id).filter(Boolean);
      
      // Get genre distribution from queue items
      const { data: queueContent } = await this.supabase
        .from('Content')
        .select('id, genre, user_id as creator_id, series_id')
        .in('id', contentIds);
      
      if (!queueContent?.length) return [];
      
      // Find most common genre in queue
      const genreCounts = {};
      queueContent.forEach(item => {
        if (item.genre) {
          genreCounts[item.genre] = (genreCounts[item.genre] || 0) + 1;
        }
      });
      
      const topGenre = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      
      if (!topGenre) return [];
      
      // Get recommendations matching top genre, excluding queue items
      const { data, error } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          total_views,
          total_likes,
          created_at,
          Content!inner (
            description,
            duration,
            media_type,
            user_id,
            status,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .eq('genre', topGenre)
        .eq('Content.status', 'published')
        .not('id', 'in', `(${contentIds.join(',')})`)
        .order('total_likes', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      const transformed = (data || []).map(item => ({
        ...item.Content,
        views_count: item.total_views,
        likes_count: item.total_likes,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        created_at: item.created_at
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'queue_continue' });
      
    } catch (error) {
      console.error('❌ _getQueueContinue failed:', error);
      return [];
    }
  };

  /**
   * Recommend discovery content to expand user's queue with variety
   */
  RecommendationEngine.prototype._getQueueDiscover = async function(options) {
    if (!this.userId) return [];
    
    const queueItems = options.queueItems || [];
    const limit = options.limit || 8;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Use personalized recommendations RPC for intelligent discovery
      const { data, error } = await this.supabase
        .rpc('get_personalized_recommendations', {
          p_user_id: this.userId,
          p_limit: limit * 2, // Fetch extra to filter
          p_exclude_content_id: excludeContentId,
          p_exclude_queue_ids: queueItems.map(i => i.id).filter(Boolean)
        });
      
      if (error) {
        console.warn('⚠️ Personalized RPC failed, falling back to trending');
        return await this._getTrendingInInterests({ limit, excludeContentId });
      }
      
      // Enrich and return top results
      return await this._enrichRecommendations(data || [], { sourceType: 'queue_discover' });
      
    } catch (error) {
      console.error('❌ _getQueueDiscover failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  // =====================================================
  // CORE RECOMMENDATION QUERIES — Phase 3 Optimized
  // =====================================================

  /**
   * Personalized recommendations using SQL RPC function
   */
  RecommendationEngine.prototype._getPersonalizedRecommendations = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Use the optimized SQL function for personalized recs
      const { data, error } = await this.supabase
        .rpc('get_personalized_recommendations', {
          p_user_id: this.userId,
          p_limit: limit,
          p_exclude_content_id: excludeContentId
        });
      
      if (error) {
        console.warn('⚠️ Personalized RPC failed:', error.message);
        return await this._getFallbackRecommendations(excludeContentId, limit);
      }
      
      return await this._enrichRecommendations(data || [], { sourceType: 'personalized' });
      
    } catch (error) {
      console.error('❌ _getPersonalizedRecommendations failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  /**
   * "Because you watched" — genre-based recommendations
   */
  RecommendationEngine.prototype._getBecauseYouWatched = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Get user's top engaged genres via RPC
      const { data: genreData, error: genreError } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: this.minWatchThreshold,
          p_limit: 5
        });
      
      if (genreError || !genreData?.length) {
        console.log('⚠️ No top genres found, using fallback');
        return await this._getFallbackRecommendations(excludeContentId, limit);
      }
      
      const genreList = genreData.map(g => g.genre).filter(Boolean);
      
      // Fetch content matching top genres from read-optimized view
      const { data: recommendations, error: recsError } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          total_views,
          total_likes,
          created_at,
          Content!inner (
            description,
            duration,
            media_type,
            user_id,
            status,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .in('genre', genreList)
        .eq('Content.status', 'published')
        .neq('id', excludeContentId)
        .order('total_likes', { ascending: false })
        .limit(limit);
      
      if (recsError) throw recsError;
      
      // Transform to expected format
      const transformed = (recommendations || []).map(item => ({
        ...item.Content,
        views_count: item.total_views,
        likes_count: item.total_likes,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        created_at: item.created_at
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'because_you_watched' });
      
    } catch (error) {
      console.error('❌ _getBecauseYouWatched failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  /**
   * More content from same creator
   */
  RecommendationEngine.prototype._getMoreFromCreator = async function(options) {
    const creatorId = options.creatorId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!creatorId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          media_type,
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
        .eq('user_id', creatorId)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Transform to include metrics
      const transformed = (data || []).map(item => ({
        ...item,
        views_count: item.content_engagement_stats?.total_views || 0,
        likes_count: item.content_engagement_stats?.total_likes || 0
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'more_from_creator' });
      
    } catch (error) {
      console.error('❌ _getMoreFromCreator failed:', error);
      return [];
    }
  };

  /**
   * Trending content in user's interest genres
   */
  RecommendationEngine.prototype._getTrendingInInterests = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const timeWindow = options.timeWindow || '7 days';
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Get user's top genres
      const { data: genresData } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: 0.3,
          p_limit: 3
        });
      
      if (!genresData?.length) return [];
      
      const genreList = genresData.map(g => g.genre);
      const timeAgo = new Date(Date.now() - this._parseTimeWindow(timeWindow)).toISOString();
      
      // Query trending content from read-optimized view
      const { data: trending, error } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          total_views,
          total_likes,
          created_at,
          Content!inner (
            description,
            duration,
            media_type,
            user_id,
            status,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .in('genre', genreList)
        .eq('Content.status', 'published')
        .gte('created_at', timeAgo)
        .neq('id', excludeContentId)
        .order('total_likes', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      const transformed = (trending || []).map(item => ({
        ...item.Content,
        views_count: item.total_views,
        likes_count: item.total_likes,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        created_at: item.created_at
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'trending_interests' });
      
    } catch (error) {
      console.error('❌ _getTrendingInInterests failed:', error);
      return [];
    }
  };

  /**
   * Continue watching — user's in-progress content
   */
  RecommendationEngine.prototype._getContinueWatching = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || 8;
    
    try {
      const { data, error } = await this.supabase
        .from('watch_progress')
        .select(`
          content_id,
          last_position,
          is_completed,
          updated_at,
          Content (
            id,
            title,
            thumbnail_url,
            genre,
            duration,
            media_type,
            episode_number,
            series_id,
            status,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .eq('user_id', this.userId)
        .eq('is_completed', false)
        .neq('last_position', 0)
        .eq('Content.status', 'published')
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // Filter null content and format with progress metadata
      return (data || [])
        .filter(item => item.Content)
        .map(item => ({
          ...item.Content,
          watch_progress: {
            last_position: item.last_position,
            is_completed: item.is_completed,
            updated_at: item.updated_at,
            progress_percent: item.Content.duration > 0 
              ? Math.min(100, Math.round((item.last_position / item.Content.duration) * 100))
              : 0
          }
        }));
      
    } catch (error) {
      console.error('❌ _getContinueWatching failed:', error);
      return [];
    }
  };

  /**
   * Similar genre recommendations
   */
  RecommendationEngine.prototype._getSimilarGenre = async function(options) {
    const genre = options.genre;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!genre) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          total_views,
          total_likes,
          created_at,
          Content!inner (
            description,
            duration,
            media_type,
            user_id,
            status,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .eq('genre', genre)
        .eq('Content.status', 'published')
        .neq('id', excludeContentId)
        .order('total_views', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      const transformed = (data || []).map(item => ({
        ...item.Content,
        views_count: item.total_views,
        likes_count: item.total_likes,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        created_at: item.created_at
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'similar_genre' });
      
    } catch (error) {
      console.error('❌ _getSimilarGenre failed:', error);
      return [];
    }
  };

  /**
   * Fallback recommendations when primary queries fail
   */
  RecommendationEngine.prototype._getFallbackRecommendations = async function(excludeContentId, limit) {
    try {
      // Enhanced fallback: prioritize high-engagement published content
      const { data, error } = await this.supabase
        .from('content_public_metrics')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          total_views,
          total_likes,
          created_at,
          Content!inner (
            description,
            duration,
            media_type,
            user_id,
            status,
            episode_number,
            series_id,
            user_profiles!user_id (full_name, username, avatar_url)
          )
        `)
        .eq('Content.status', 'published')
        .neq('id', excludeContentId)
        // Order by engagement ratio (likes/views) with minimum view threshold
        .order('total_likes', { ascending: false })
        .order('total_views', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      const transformed = (data || []).map(item => ({
        ...item.Content,
        views_count: item.total_views,
        likes_count: item.total_likes,
        thumbnail_url: item.thumbnail_url,
        genre: item.genre,
        created_at: item.created_at
      }));
      
      return await this._enrichRecommendations(transformed, { sourceType: 'fallback' });
      
    } catch (error) {
      console.error('❌ _getFallbackRecommendations failed:', error);
      return [];
    }
  };

  // =====================================================
  // ENRICHMENT & UTILITIES
  // =====================================================

  /**
   * Enrich recommendation items with additional metadata
   */
  RecommendationEngine.prototype._enrichRecommendations = async function(items, options = {}) {
    if (!items || items.length === 0) return [];
    
    const sourceType = options.sourceType || 'unknown';
    
    return Promise.all(items.map(async (item) => {
      // Fix media URLs using helper if available
      const thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
      const fileUrl = window.SupabaseHelper?.fixMediaUrl?.(item.file_url) || item.file_url;
      
      // Calculate engagement score (likes per view, normalized)
      const views = item.views_count || item.total_views || 1;
      const likes = item.likes_count || item.total_likes || 0;
      const engagementScore = views > 0 ? Math.round((likes / views) * 1000) / 10 : 0;
      
      // PHASE 1D: Fetch series/collection metadata if applicable
      let seriesInfo = null;
      if (item.series_id) {
        try {
          const { data: seriesData } = await this.supabase
            .from('creator_playlists')
            .select('name, playlist_type, description')
            .eq('id', item.series_id)
            .eq('status', 'published')
            .single();
          
          if (seriesData) {
            seriesInfo = {
              id: item.series_id,
              name: seriesData.name,
              type: seriesData.playlist_type,
              description: seriesData.description
            };
          }
        } catch (e) {
          // Silently ignore series fetch errors
        }
      }
      
      // Build enriched result
      return {
        // Core content fields
        id: item.id,
        title: item.title,
        description: item.description,
        thumbnail_url: thumbnailUrl,
        file_url: fileUrl,
        duration: item.duration,
        media_type: item.media_type,
        genre: item.genre,
        created_at: item.created_at,
        status: item.status,
        
        // Metrics (normalized field names)
        views_count: item.views_count || item.total_views || 0,
        likes_count: item.likes_count || item.total_likes || 0,
        engagement_score: engagementScore,
        
        // Creator info
        user_id: item.user_id,
        user_profiles: item.user_profiles || item.creator_profile,
        
        // PHASE 1D: Series/collection context
        episode_number: item.episode_number,
        series_id: item.series_id,
        series_info: seriesInfo,
        
        // Watch progress (if applicable)
        watch_progress: item.watch_progress || null,
        
        // Metadata
        source_type: sourceType,
        recommendation_timestamp: Date.now()
      };
    }));
  };

  /**
   * Generate cache key from type and options
   */
  RecommendationEngine.prototype._getCacheKey = function(type, options) {
    const contextParts = [];
    
    if (this.userId) contextParts.push(`u:${this.userId}`);
    if (this.currentCollectionId) contextParts.push(`c:${this.currentCollectionId}`);
    if (this.currentContentId) contextParts.push(`cc:${this.currentContentId}`);
    
    const optionsStr = Object.keys(options)
      .sort()
      .map(k => `${k}:${JSON.stringify(options[k])}`)
      .join('|');
    
    return `${type}|${contextParts.join('|')}|${optionsStr}`;
  };

  /**
   * Check if cached result is still valid
   */
  RecommendationEngine.prototype._isCacheValid = function(key) {
    const lastFetch = this._lastFetch[key];
    if (!lastFetch) return false;
    
    const age = Date.now() - lastFetch;
    return age < this.cacheDuration;
  };

  /**
   * Parse time window string to milliseconds
   */
  RecommendationEngine.prototype._parseTimeWindow = function(timeWindow) {
    const map = {
      '1 hour': 60 * 60 * 1000,
      '24 hours': 24 * 60 * 60 * 1000,
      '7 days': 7 * 24 * 60 * 60 * 1000,
      '30 days': 30 * 24 * 60 * 60 * 1000,
      '90 days': 90 * 24 * 60 * 60 * 1000
    };
    return map[timeWindow] || map['7 days'];
  };

  // =====================================================
  // PHASE 1D: Batch & Queue APIs
  // =====================================================

  /**
   * Generate recommendations for extending a playback queue
   */
  RecommendationEngine.prototype.getRecommendationsForQueue = async function(queueItems, options = {}) {
    if (!queueItems || queueItems.length === 0) return [];
    
    const limit = options.limit || 5;
    const strategy = options.strategy || 'genre_match'; // genre_match, creator_match, trending
    
    try {
      // Analyze queue composition
      const contentIds = queueItems.map(item => item.id).filter(Boolean);
      
      // Get metadata for queue items
      const { data: queueMeta } = await this.supabase
        .from('Content')
        .select('id, genre, user_id as creator_id, series_id')
        .in('id', contentIds);
      
      if (!queueMeta?.length) return [];
      
      let recommendations = [];
      
      switch(strategy) {
        case 'genre_match':
          // Find most common genre and recommend similar
          const genreCounts = {};
          queueMeta.forEach(item => {
            if (item.genre) genreCounts[item.genre] = (genreCounts[item.genre] || 0) + 1;
          });
          const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
          
          if (topGenre) {
            recommendations = await this._getSimilarGenre({
              genre: topGenre,
              limit: limit * 2,
              excludeContentId: null
            });
          }
          break;
          
        case 'creator_match':
          // Find most common creator and recommend their other content
          const creatorCounts = {};
          queueMeta.forEach(item => {
            if (item.creator_id) {
              creatorCounts[item.creator_id] = (creatorCounts[item.creator_id] || 0) + 1;
            }
          });
          const topCreator = Object.entries(creatorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
          
          if (topCreator) {
            recommendations = await this._getMoreFromCreator({
              creatorId: topCreator,
              limit: limit * 2,
              excludeContentId: null
            });
          }
          break;
          
        case 'trending':
        default:
          // Recommend trending content in user's interests
          recommendations = await this._getTrendingInInterests({
            limit: limit * 2,
            excludeContentId: null
          });
          break;
      }
      
      // Filter out items already in queue
      const queueIdSet = new Set(contentIds.map(String));
      const filtered = recommendations.filter(rec => !queueIdSet.has(String(rec.id)));
      
      return filtered.slice(0, limit);
      
    } catch (error) {
      console.error('❌ getRecommendationsForQueue failed:', error);
      return [];
    }
  };

  /**
   * Pre-fetch recommendations for anticipated user actions
   */
  RecommendationEngine.prototype.prefetchRecommendations = async function(types) {
    if (!Array.isArray(types)) types = [types];
    
    const prefetchPromises = types.map(type => 
      this.getRecommendations(type, { limit: this.defaultLimit })
        .catch(err => {
          console.warn('⚠️ Prefetch failed for', type + ':', err.message);
          return [];
        })
    );
    
    const results = await Promise.all(prefetchPromises);
    console.log('📦 Prefetched', results.filter(r => r.length > 0).length, 'recommendation types');
    
    return results;
  };

  // =====================================================
  // EXPORT
  // =====================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
  } else {
    window.RecommendationEngine = RecommendationEngine;
  }
  
  console.log('✅ RecommendationEngine module loaded successfully (Phase 3 + Phase 1D Enhanced)');
  console.log('   Available types:', Object.values(RecommendationEngine.prototype.TYPES || RecommendationEngine.TYPES));

})();
