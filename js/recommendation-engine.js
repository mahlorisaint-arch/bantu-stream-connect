// js/recommendation-engine.js — SQL-Based Recommendation Engine
// Bantu Stream Connect — Phase 3 Implementation
// Uses your actual schema: bigint content IDs, viewer_id for content_views

(function() {
  'use strict';
  
  console.log('🎯 RecommendationEngine module loading...');

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
      PERSONALIZED: 'personalized'
    };
    
    // Config
    this.defaultLimit = config.limit || 12;
    this.minWatchThreshold = config.minWatchThreshold || 0.5;
    this.cacheDuration = config.cacheDuration || 60000; // 1 minute
    
    // Cache
    this._cache = {};
    this._lastFetch = {};
    
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
            id, title, thumbnail_url, genre, duration, status,
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
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at,
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
      const { data, error } = await this.supabase
        .from('Content')
        .select(`
          id, title, thumbnail_url, genre, duration, views_count, likes_count, created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('created_at', { ascending: false })
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
      
      return {
        ...item,
        real_views_count: realViews || 0,
        engagement_score: Math.round(engagement * 100) / 100,
        thumbnail_url: window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url
      };
    }));
  };

  RecommendationEngine.prototype._getCacheKey = function(type, options) {
    return type + '_' + (this.userId || 'guest') + '_' + JSON.stringify(options);
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

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
  } else {
    window.RecommendationEngine = RecommendationEngine;
  }
  
  console.log('✅ RecommendationEngine module loaded successfully');
})();
