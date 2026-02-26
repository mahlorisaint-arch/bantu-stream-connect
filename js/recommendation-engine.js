// js/recommendation-engine.js — SQL-Based Recommendation Engine
// Bantu Stream Connect — Phase 3 Implementation
// No ML required — just smart, structured queries

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
      SIMILAR_GENRE: 'similar_genre'
    };
    
    // Config
    this.defaultLimit = config.limit || 12;
    this.minWatchThreshold = config.minWatchThreshold || 0.5; // 50% watched = signal
    this.cacheDuration = config.cacheDuration || 60000; // 1 minute cache
    
    // Cache
    this._cache = {};
    this._lastFetch = {};
    
    console.log('✅ RecommendationEngine initialized for user: ' + (this.userId || 'guest'));
  }

  // ============================================
  // PUBLIC API — Get Recommendations
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
      case this.TYPES.BECAUSE_YOU_WATCHED:
        results = await this._getBecauseYouWatched(options);
        break;
      case this.TYPES.MORE_FROM_CREATOR:
        results = await this._getMoreFromCreator(options);
        break;
      case this.TYPES.TRENDING_IN_INTERESTS:
        results = await this._getTrendingInInterests(options);
        break;
      case this.TYPES.CONTINUE_WATCHING:
        results = await this._getContinueWatching(options);
        break;
      case this.TYPES.SIMILAR_GENRE:
        results = await this._getSimilarGenre(options);
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
    // Fetch multiple recommendation rails in parallel
    const promises = railConfigs.map(config => 
      this.getRecommendations(config.type, config.options || {})
        .then(results => ({ type: config.type, results }))
        .catch(error => {
          console.error(`❌ Failed to load ${config.type}:`, error);
          return { type: config.type, results: [] };
        })
    );
    
    return Promise.all(promises);
  };

  // ============================================
  // PRIVATE — Recommendation Queries
  // ============================================

  RecommendationEngine.prototype._getBecauseYouWatched = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    try {
      // Step 1: Get user's top watched genres (weighted by completion)
      const {  watchedGenres, error: genresError } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: this.minWatchThreshold,
          p_limit: 5
        });
      
      if (genresError || !watchedGenres?.length) {
        // Fallback: simple genre match from recent watches
        return await this._getSimpleGenreMatch(excludeContentId, limit);
      }
      
      // Step 2: Fetch content matching those genres, excluding watched
      const genreList = watchedGenres.map(g => g.genre);
      
      const {  recommendations, error: recsError } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          views_count,
          likes_count,
          created_at,
          user_profiles!user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .in('genre', genreList)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .not('id', 'in', `(
          SELECT content_id FROM watch_progress 
          WHERE user_id = '${this.userId}' AND is_completed = true
        )`)
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (recsError) throw recsError;
      
      // Step 3: Enrich with real view counts and engagement score
      return await this._enrichRecommendations(recommendations || []);
      
    } catch (error) {
      console.error('❌ Because you watched failed:', error);
      return await this._getSimpleGenreMatch(excludeContentId, limit);
    }
  };

  RecommendationEngine.prototype._getSimpleGenreMatch = async function(excludeContentId, limit) {
    if (!this.userId) return [];
    
    // Get user's most recent watched genre
    const {  recentWatch } = await this.supabase
      .from('watch_progress')
      .select('content_id')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!recentWatch) return [];
    
    const {  content } = await this.supabase
      .from('Content')
      .select('genre')
      .eq('id', recentWatch.content_id)
      .single();
    
    if (!content?.genre) return [];
    
    const {  recommendations, error } = await this.supabase
      .from('Content')
      .select(`
        id, title, thumbnail_url, genre, duration, views_count,
        user_profiles!user_id (full_name, username, avatar_url)
      `)
      .eq('genre', content.genre)
      .eq('status', 'published')
      .neq('id', excludeContentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) return [];
    return await this._enrichRecommendations(recommendations || []);
  };

  RecommendationEngine.prototype._getMoreFromCreator = async function(options) {
    const creatorId = options.creatorId;
    const limit = options.limit || this.defaultLimit;
    const excludeContentId = options.excludeContentId || this.currentContentId;
    
    if (!creatorId) return [];
    
    try {
      const {  content, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          views_count,
          likes_count,
          created_at
        `)
        .eq('user_id', creatorId)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(content || []);
      
    } catch (error) {
      console.error('❌ More from creator failed:', error);
      return [];
    }
  };

  RecommendationEngine.prototype._getTrendingInInterests = async function(options) {
    if (!this.userId) return [];
    
    const limit = options.limit || this.defaultLimit;
    const timeWindow = options.timeWindow || '7 days'; // '24 hours', '7 days', '30 days'
    
    try {
      // Get user's interest genres
      const {  genres } = await this.supabase
        .rpc('get_user_top_genres', {
          p_user_id: this.userId,
          p_min_completion: 0.3, // Lower threshold for trending
          p_limit: 3
        });
      
      if (!genres?.length) return [];
      
      const genreList = genres.map(g => g.genre);
      
      // Get trending content in those genres (high engagement recently)
      const {  trending, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          views_count,
          likes_count,
          created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .in('genre', genreList)
        .eq('status', 'published')
        .gte('created_at', new Date(Date.now() - this._parseTimeWindow(timeWindow)).toISOString())
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
      const {  progress, error } = await this.supabase
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
      
      // Filter out null content (deleted) and format
      return (progress || [])
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
      const {  content, error } = await this.supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          views_count,
          likes_count,
          created_at,
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('genre', genre)
        .eq('status', 'published')
        .neq('id', excludeContentId)
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return await this._enrichRecommendations(content || []);
      
    } catch (error) {
      console.error('❌ Similar genre failed:', error);
      return [];
    }
  };

  // ============================================
  // HELPER METHODS
  // ============================================

  RecommendationEngine.prototype._enrichRecommendations = async function(items) {
    // Add real view counts and engagement score
    return Promise.all(items.map(async (item) => {
      // Get real view count from content_views
      const { count: realViews } = await this.supabase
        .from('content_views')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', item.id);
      
      // Calculate engagement score (likes / views)
      const views = realViews || item.views_count || 1;
      const engagement = item.likes_count ? (item.likes_count / views) : 0;
      
      return {
        ...item,
        real_views_count: realViews || 0,
        engagement_score: Math.round(engagement * 100) / 100,
        // Fix media URL
        thumbnail_url: window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url
      };
    }));
  };

  RecommendationEngine.prototype._getCacheKey = function(type, options) {
    return `${type}_${this.userId || 'guest'}_${JSON.stringify(options)}`;
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
