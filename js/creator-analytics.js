// js/creator-analytics.js — Creator Analytics Dashboard
// Bantu Stream Connect — Phase 4 Implementation

(function() {
  'use strict';
  
  console.log('📊 CreatorAnalytics module loading...');

  function CreatorAnalytics(config) {
    if (!config || !config.supabase) {
      console.error('❌ CreatorAnalytics: Missing required config (supabase)');
      return;
    }

    this.supabase = config.supabaseClient || window.supabaseClient;
    this.userId = config.userId || null;
    this.contentId = config.contentId || null;
    
    // Cache
    this._cache = {};
    this._cacheDuration = 30000; // 30 seconds
    this._lastFetch = {};
    
    // Callbacks
    this.onDataLoaded = config.onDataLoaded || null;
    this.onError = config.onError || null;
    
    console.log('✅ CreatorAnalytics initialized for user: ' + (this.userId || 'guest'));
  }

  // ============================================
  // PUBLIC API
  // ============================================

  CreatorAnalytics.prototype.getDashboardData = async function(timeRange = '30days') {
    if (!this.userId) {
      return { error: 'User not authenticated' };
    }
    
    const key = 'dashboard_' + timeRange;
    
    if (this._isCacheValid(key)) {
      return this._cache[key];
    }
    
    try {
      // Fetch content analytics
      const { data: analytics, error } = await this.supabase
        .from('content_analytics')
        .select('*')
        .eq('creator_id', this.userId)
        .order('last_updated', { ascending: false });
      
      if (error) throw error;
      
      // Fetch daily analytics for charts
      const dateFrom = this._getDateFromRange(timeRange);
      const { data: dailyData } = await this.supabase
        .from('daily_analytics')
        .select('*')
        .in('content_id', analytics.map(a => a.content_id))
        .gte('date', dateFrom)
        .order('date', { ascending: true });
      
      // Aggregate data
      const aggregated = this._aggregateAnalytics(analytics, dailyData);
      
      // Cache and return
      this._cache[key] = aggregated;
      this._lastFetch[key] = Date.now();
      
      if (this.onDataLoaded) {
        this.onDataLoaded(aggregated);
      }
      
      return aggregated;
      
    } catch (error) {
      console.error('❌ Dashboard data failed:', error);
      this._handleError('getDashboardData', error);
      return { error: error.message };
    }
  };

  CreatorAnalytics.prototype.getContentAnalytics = async function(contentId) {
    if (!contentId) {
      return { error: 'Content ID required' };
    }
    
    const key = 'content_' + contentId;
    
    if (this._isCacheValid(key)) {
      return this._cache[key];
    }
    
    try {
      // Get content analytics
      const { data: analytics, error: analyticsError } = await this.supabase
        .rpc('calculate_content_watch_time', { p_content_id: contentId });
      
      if (analyticsError) throw analyticsError;
      
      // Get content details
      const { data: content } = await this.supabase
        .from('Content')
        .select('id, title, thumbnail_url, duration, created_at, views_count, likes_count')
        .eq('id', contentId)
        .single();
      
      // Get daily analytics for retention chart
      const { data: dailyData } = await this.supabase
        .from('daily_analytics')
        .select('date, views, watch_time_seconds')
        .eq('content_id', contentId)
        .order('date', { ascending: true })
        .limit(30);
      
      const result = {
        content: content,
        analytics: analytics?.[0] || {},
        dailyData: dailyData || [],
        retentionCurve: this._calculateRetentionCurve(dailyData, content?.duration)
      };
      
      this._cache[key] = result;
      this._lastFetch[key] = Date.now();
      
      return result;
      
    } catch (error) {
      console.error('❌ Content analytics failed:', error);
      this._handleError('getContentAnalytics', error);
      return { error: error.message };
    }
  };

  CreatorAnalytics.prototype.getWatchTimeByDate = async function(timeRange = '30days') {
    if (!this.userId) return [];
    
    const dateFrom = this._getDateFromRange(timeRange);
    
    try {
      const { data, error } = await this.supabase
        .from('daily_analytics')
        .select('date, SUM(watch_time_seconds) as total_watch_time')
        .in('content_id', `(
          SELECT id FROM "Content" WHERE user_id = '${this.userId}'
        )`)
        .gte('date', dateFrom)
        .group('date')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('❌ Watch time by date failed:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype.getTopContent = async function(limit = 10, timeRange = '30days') {
    if (!this.userId) return [];
    
    const dateFrom = this._getDateFromRange(timeRange);
    
    try {
      const { data, error } = await this.supabase
        .from('daily_analytics')
        .select(`
          content_id,
          SUM(views) as total_views,
          SUM(watch_time_seconds) as total_watch_time,
          Content (
            id, title, thumbnail_url, duration, created_at
          )
        `)
        .in('content_id', `(
          SELECT id FROM "Content" WHERE user_id = '${this.userId}'
        )`)
        .gte('date', dateFrom)
        .group('content_id')
        .order('total_views', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('❌ Top content failed:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype.refreshAnalytics = async function(contentId) {
    if (!contentId) return false;
    
    try {
      await this.supabase.rpc('update_content_analytics', { p_content_id: contentId });
      
      // Clear cache
      delete this._cache['content_' + contentId];
      
      console.log('✅ Analytics refreshed for content:', contentId);
      return true;
      
    } catch (error) {
      console.error('❌ Refresh analytics failed:', error);
      return false;
    }
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  CreatorAnalytics.prototype._aggregateAnalytics = function(analytics, dailyData) {
    const total = {
      totalViews: 0,
      totalWatchTime: 0,
      avgWatchTime: 0,
      totalContent: analytics?.length || 0,
      totalUniqueViewers: 0,
      avgCompletionRate: 0
    };
    
    if (analytics?.length > 0) {
      total.totalViews = analytics.reduce((sum, a) => sum + (a.total_views || 0), 0);
      total.totalWatchTime = analytics.reduce((sum, a) => sum + (a.total_watch_time_seconds || 0), 0);
      total.avgWatchTime = total.totalWatchTime / (total.totalViews || 1);
      total.totalUniqueViewers = analytics.reduce((sum, a) => sum + (a.unique_viewers || 0), 0);
      total.avgCompletionRate = analytics.reduce((sum, a) => sum + (a.avg_completion_rate || 0), 0) / analytics.length;
    }
    
    // Format for charts
    const chartData = this._prepareChartData(dailyData);
    
    return {
      summary: total,
      analytics: analytics || [],
      chartData: chartData,
      timeRange: this._getTimeRangeLabel()
    };
  };

  CreatorAnalytics.prototype._prepareChartData = function(dailyData) {
    const labels = [];
    const views = [];
    const watchTime = [];
    
    dailyData?.forEach(item => {
      labels.push(new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      views.push(item.views || 0);
      watchTime.push(Math.round((item.watch_time_seconds || 0) / 60)); // Convert to minutes
    });
    
    return { labels, views, watchTime };
  };

  CreatorAnalytics.prototype._calculateRetentionCurve = function(dailyData, duration) {
    // Simplified retention calculation
    // In production, this would use detailed second-by-second data
    const curve = [];
    const intervals = 10; // 10 points from 0% to 100%
    
    for (let i = 0; i <= intervals; i++) {
      const percentage = (i / intervals) * 100;
      // Simulate retention drop-off (replace with actual data)
      const retention = Math.max(0, 100 - (percentage * 0.8));
      curve.push({ percentage, retention: Math.round(retention) });
    }
    
    return curve;
  };

  CreatorAnalytics.prototype._getDateFromRange = function(timeRange) {
    const now = new Date();
    switch(timeRange) {
      case '7days':
        return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      case '30days':
        return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      case '90days':
        return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      default:
        return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  };

  CreatorAnalytics.prototype._getTimeRangeLabel = function() {
    return 'Last 30 days';
  };

  CreatorAnalytics.prototype._isCacheValid = function(key) {
    const lastFetch = this._lastFetch[key];
    if (!lastFetch) return false;
    return Date.now() - lastFetch < this._cacheDuration;
  };

  CreatorAnalytics.prototype._handleError = function(context, error) {
    console.error('❌ CreatorAnalytics error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatorAnalytics;
  } else {
    window.CreatorAnalytics = CreatorAnalytics;
  }
  
  console.log('✅ CreatorAnalytics module loaded successfully');
})();
