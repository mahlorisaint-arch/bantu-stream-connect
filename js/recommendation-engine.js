// js/recommendation-engine.js — SQL-Based Recommendation Engine
// Bantu Stream Connect — Phase 3 Implementation
// Uses your actual schema: bigint content IDs, viewer_id for content_views
// 🚀 PHASE 1D ENHANCEMENTS:
// ✅ Collection-aware recommendations
// ✅ Queue-based recommendations
// ✅ Episode-based recommendations for series
// ✅ Enhanced fallback logic with series detection
// ✅ Smart content relationships for collections

(function() {
  'use strict';
  
  console.log('🎯 RecommendationEngine module loading... (Phase 1D Enhanced)');

  function RecommendationEngine(config) {
    if (!config || !config.supabase) {
      console.error('❌ RecommendationEngine: Missing required config (supabase)');
      return;
    }

    this.supabase = config.supabase;
    this.userId = config.userId || null;
    this.currentContentId = config.currentContentId || null;
    
    // Recommendation types
    this.TYPES = {
      BECAUSE_YOU_WATCHED: 'because_you_watched',
      MORE_FROM_CREATOR: 'more_from_creator',
      TRENDING_IN_INTERESTS: 'trending_in_interests',
      CONTINUE_WATCHING: 'continue_watching',
      SIMILAR_GENRE: 'similar_genre',
      PERSONALIZED: 'personalized',
      // PHASE 1D: New recommendation types
      NEXT_IN_COLLECTION: 'next_in_collection',
      BECAUSE_YOU_WATCHED_COLLECTION: 'because_you_watched_collection',
      POPULAR_IN_SERIES: 'popular_in_series',
      EPISODE_RECOMMENDATIONS: 'episode_recommendations'
    };
    
    // Config
    this.defaultLimit = config.limit || 12;
    this.minWatchThreshold = config.minWatchThreshold || 0.5;
    this.cacheDuration = config.cacheDuration || 60000; // 1 minute
    
    // Cache
    this._cache = {};
    this._lastFetch = {};
    
    // PHASE 1D: Collection tracking
    this.currentCollectionId = config.currentCollectionId || null;
    this.currentEpisodeNumber = config.currentEpisodeNumber || null;
    
    console.log('✅ RecommendationEngine initialized for user: ' + (this.userId || 'guest'));
  }

  // ============================================
  // PUBLIC API
  // ============================================

  RecommendationEngine.prototype.getRecommendations = async function(type, options = {}) {
    const key = this._getCacheKey(type, options);
    
    // Check cache first
    if (this._isCacheValid(key)) {
      console.log('📦 Serving recommendations from cache:', type);
      return this._cache[key];
    }
    
    let results = [];
    
    switch(type) {
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
      // PHASE 1D: New recommendation types
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
      default:
        console.warn('⚠️ Unknown recommendation type:', type);
        return [];
    }
    
    // Cache results
    this._cache[key] = results;
    this._lastFetch[key] = Date.now();
    
    return results;
  };

  RecommendationEngine.prototype.getMultipleRails = async function(railConfigs) {
    const promises = railConfigs.map(config => 
      this.getRecommendations(config.type, config.options || {})
        .then(results => ({ type: config.type, results }))
        .catch(error => {
          console.error('❌ Failed to load ' + config.type + ':', error);
          return { type: config.type, results: [] };
        })
    );
    
    return Promise.all(promises);
  };

  // PHASE 1D: Set current collection context
  RecommendationEngine.prototype.setCollectionContext = function(collectionId, episodeNumber) {
    this.currentCollectionId = collectionId;
    this.currentEpisodeNumber = episodeNumber;
    console.log('📁 Collection context set:', collectionId, 'Episode:', episodeNumber);
  };

  // PHASE 1D: Clear cache for a specific type
  RecommendationEngine.prototype.clearCache = function(type) {
    if (type) {
      Object.keys(this._cache).forEach(key => {
        if (key.startsWith(type)) {
          delete this._cache[key];
          delete this._lastFetch[key];
        }
      });
      console.log('🧹 Cache cleared for type:', type);
    } else {
      this._cache = {};
      this._lastFetch = {};
      console.log('🧹 All cache cleared');
    }
  };

  // ============================================
  // PHASE 1D: Collection-Aware Recommendations
  // ============================================

  RecommendationEngine.prototype._getNextInCollection = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const currentEpisode = options.currentEpisode || this.currentEpisodeNumber;
    const limit = options.limit || 5;
    
    if (!collectionId) return [];
    
    try {
      // Get the next episodes in the collection
      let query = this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('series_id', collectionId)
        .eq('status', 'published')
        .order('episode_number', { ascending: true });
      
      // If we have current episode, get episodes after it
      if (currentEpisode) {
        query = query.gt('episode_number', currentEpisode);
      }
      
      const { data, error } = await query.limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Next in collection failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getBecauseYouWatchedCollection = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeCollectionId = options.excludeCollectionId || this.currentCollectionId;
    
    try {
      // Get collections the user has watched recently
      const { data: watchedCollections, error: collectionsError } = await this.supabase
        .from('watch_progress')
        .select(`
          content_id,
          Content!inner (
            series_id,
            genre
          )
        `)
        .eq('user_id', this.userId)
        .eq('is_completed', false)
        .not('content_id', 'is', null);
      
      if (collectionsError || !watchedCollections?.length) {
        return [];
      }
      
      // Extract unique collection IDs
      const collectionIds = [...new Set(
        watchedCollections
          .filter(w => w.Content?.series_id)
          .map(w => w.Content.series_id)
      )].filter(id => id !== excludeCollectionId);
      
      if (collectionIds.length === 0) return [];
      
      // Get content from those collections
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('series_id', collectionIds.slice(0, 5))
        .eq('status', 'published')
        .order('episode_number', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Because you watched collection failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getPopularInSeries = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const limit = options.limit || this.defaultLimit;
    
    if (!collectionId) return [];
    
    try {
      // Get the most popular content in this series by views
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('series_id', collectionId)
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Popular in series failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getEpisodeRecommendations = async function(options) {
    const collectionId = options.collectionId || this.currentCollectionId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!collectionId) return [];
    
    try {
      // Get the genre of the current series
      const { data: seriesData } = await this.supabase
        .from('creator_playlists')
        .select('genre, playlist_type')
        .eq('id', collectionId)
        .single();
      
      // Find similar series by genre
      const { data: similarSeries, error: seriesError } = await this.supabase
        .from('creator_playlists')
        .select('id, name, genre')
        .eq('status', 'published')
        .neq('id', collectionId)
        .limit(5);
      
      if (seriesError || !similarSeries?.length) return [];
      
      // Get content from similar series
      const seriesIds = similarSeries.slice(0, 3).map(s => s.id);
      
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('series_id', seriesIds)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('episode_number', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Episode recommendations failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  // ============================================
  // PRIVATE — Recommendation Queries
  // ============================================

  RecommendationEngine.prototype._getPersonalizedRecommendations = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Use the SQL function we created
      const { data, error } = await this.supabase
        .rpc('get_personalized_recommendations', {
          p_user_id: this.userId,
          p_limit: limit,
          p_exclude_content_id: excludeContentId
        });
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Personalized recommendations failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  RecommendationEngine.prototype._getBecauseYouWatched = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Get user's top watched genres
      const { data: genresData, error: genresError } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: 0.5,
          p_limit: 5
        });
      
      if (genresError || !genresData?.length) {
        return await this._getFallbackRecommendations(excludeContentId, limit);
      }
      
      const genreList = genresData.map(g => g.genre);
      
      // Fetch content matching those genres
      const { data: recommendations, error: recsError } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('genre', genreList)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (recsError) throw recsError;
      return await this._enrichRecommendations(recommendations || []);
      
    } catch (error) {
      console.error('❌ Because you watched failed:', error);
      return await this._getFallbackRecommendations(excludeContentId, limit);
    }
  };

  RecommendationEngine.prototype._getMoreFromCreator = async function(options) {
    const creatorId = options.creatorId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!creatorId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('user_id', creatorId)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ More from creator failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getTrendingInInterests = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const timeWindow = options.timeWindow || '7 days';
    
    try {
      const { data: genresData } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: 0.3,
          p_limit: 3
        });
      
      if (!genresData?.length) return [];
      
      const genreList = genresData.map(g => g.genre);
      const timeAgo = new Date(Date.now() - this._parseTimeWindow(timeWindow)).toISOString();
      
      const { data: trending, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('genre', genreList)
        .eq('status', 'published')
        .gte('created_at', timeAgo)
        .order('likes_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(trending || []);
      
    } catch (error) {
      console.error('❌ Trending in interests failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getContinueWatching = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || 8;
    
    try {
      const { data, error } = await this.supabase
        .from('watch_progress')
        .select(`
          content_id, last_position, is_completed, updated_at,
          Content (
            id, title, thumbnail_url, genre, duration, status, episode_number, series_id,
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
      
      // Filter out null content and format
      return (data || [])
        .filter(item => item.Content)
        .map(item => ({
          ...item.Content,
          watch_progress: {
            last_position: item.last_position,
            updated_at: item.updated_at
          }
        }));
      
    } catch (error) {
      console.error('❌ Continue watching failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getSimilarGenre = async function(options) {
    const genre = options.genre;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!genre) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('genre', genre)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Similar genre failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getFallbackRecommendations = async function(excludeContentId, limit) {
    try {
      // PHASE 1D: Enhanced fallback - prioritize content with higher engagement
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at, episode_number, series_id,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('likes_count', { ascending: false })
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(data || []);
      
    } catch (error) {
      console.error('❌ Fallback recommendations failed:', error);
      return [];
    }
  };

  // ============================================
  // HELPER METHODS
  // ============================================

  RecommendationEngine.prototype._enrichRecommendations = async function(items) {
    return Promise.all(items.map(async (item) => {
      // Get real view count from content_views (uses viewer_id)
      const { count: realViews } = await this.supabase
        .from('content_views')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', item.id);
      
      // Calculate engagement score
      const views = realViews || item.views_count || 1;
      const engagement = item.likes_count ? (item.likes_count / views) : 0;
      
      // PHASE 1D: Get series info if available
      let seriesInfo = null;
      if (item.series_id) {
        const { data: seriesData } = await this.supabase
          .from('creator_playlists')
          .select('name, playlist_type')
          .eq('id', item.series_id)
          .single();
        seriesInfo = seriesData;
      }
      
      return {
        ...item,
        real_views_count: realViews || 0,
        engagement_score: Math.round(engagement * 100) / 100,
        thumbnail_url: window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url,
        series_name: seriesInfo?.name || null,
        series_type: seriesInfo?.playlist_type || null
      };
    }));
  };

  RecommendationEngine.prototype._getCacheKey = function(type, options) {
    const collectionPart = this.currentCollectionId ? `_col_${this.currentCollectionId}` : '';
    return type + '_' + (this.userId || 'guest') + collectionPart + '_' + JSON.stringify(options);
  };

  RecommendationEngine.prototype._isCacheValid = function(key) {
    const lastFetch = this._lastFetch[key];
    if (!lastFetch) return false;
    return Date.now() - lastFetch < this.cacheDuration;
  };

  RecommendationEngine.prototype._parseTimeWindow = function(timeWindow) {
    const map = {
      '24 hours': 24 * 60 * 60 * 1000,
      '7 days': 7 * 24 * 60 * 60 * 1000,
      '30 days': 30 * 24 * 60 * 60 * 1000
    };
    return map[timeWindow] || map['7 days'];
  };

  // ============================================
  // PHASE 1D: Batch Recommendation API
  // ============================================

  RecommendationEngine.prototype.getRecommendationsForQueue = async function(queueItems, limit = 5) {
    if (!queueItems || queueItems.length === 0) return [];
    
    // Get the last watched item's genre and creator
    const lastItem = queueItems[queueItems.length - 1];
    const firstItem = queueItems[0];
    
    try {
      // Get genre from last watched item
      const { data: lastContent } = await this.supabase
        .from('Content')
        .select('genre, user_id')
        .eq('id', lastItem.id)
        .single();
      
      // Get recommendations based on the last item's genre
      const recommendations = await this._getSimilarGenre({
        genre: lastContent?.genre,
        limit: limit,
        excludeContentId: lastItem.id
      });
      
      // Filter out items already in queue
      const queueIds = new Set(queueItems.map(item => String(item.id)));
      const filtered = recommendations.filter(rec => !queueIds.has(String(rec.id)));
      
      return filtered.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Queue recommendations failed:', error);
      return [];
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
  } else {
    window.RecommendationEngine = RecommendationEngine;
  }
  
  console.log('✅ RecommendationEngine module loaded successfully (Phase 1D Enhanced)');
})();
