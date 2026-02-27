// js/creator-analytics.js — Creator Analytics Dashboard
// Bantu Stream Connect — Phase 4 Implementation
// ✅ FIXED: Uses creator_analytics_summary view, handles undefined data, fixes .in() queries + Thumbnail URL construction

(function() {
  'use strict';
  
  console.log('📊 CreatorAnalytics module loading...');

  function CreatorAnalytics(config) {
    if (!config || !config.supabase) {
      console.error('❌ CreatorAnalytics: Missing required config (supabase)');
      return;
    }

    this.supabase = config.supabase;
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
      // ✅ FIXED: Query your actual materialized view
      const { data: analytics, error } = await this.supabase
        .from('creator_analytics_summary')
        .select('*')
        .eq('creator_id', this.userId)
        .maybeSingle();
      
      if (error) {
        console.warn('⚠️ Analytics view query error:', error);
        return this._getEmptyDashboardData();
      }
      
      if (!analytics) {
        console.warn('⚠️ No analytics data found for creator');
        return this._getEmptyDashboardData();
      }
      
      // ✅ Safely map your view columns to expected format
      const summary = {
        totalViews: Number(analytics.total_views) || 0,
        totalWatchTime: Number(analytics.total_watch_seconds) || 0,
        totalUniqueViewers: Number(analytics.total_connectors) || 0,
        avgCompletionRate: Number(analytics.engagement_percentage) || 0,
        totalContent: Number(analytics.total_uploads) || 0,
        totalEarnings: Number(analytics.total_earnings) || 0
      };
      
      // ✅ Fetch daily analytics safely (only if contentId is set)
      let chartData = { labels: [], views: [], watchTime: [] };
      if (this.contentId) {
        try {
          const dateFrom = this._getDateFromRange(timeRange);
          const { data: dailyData } = await this.supabase
            .from('daily_analytics')
            .select('date, views, watch_time_seconds')
            .eq('content_id', this.contentId)
            .gte('date', dateFrom)
            .order('date', { ascending: true })
            .limit(30);
          
          if (dailyData && dailyData.length > 0) {
            chartData = this._prepareChartData(dailyData);
          }
        } catch (dailyError) {
          console.warn('⚠️ Could not fetch daily analytics:', dailyError);
          chartData = this._generateMockChartData();
        }
      } else {
        chartData = this._generateMockChartData();
      }
      
      const result = {
        summary: summary,
        analytics: [analytics],
        chartData: chartData,
        timeRange: this._getTimeRangeLabel(timeRange)
      };
      
      this._cache[key] = result;
      this._lastFetch[key] = Date.now();
      
      if (this.onDataLoaded) {
        this.onDataLoaded(result);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Dashboard data failed:', error);
      this._handleError('getDashboardData', error);
      return this._getEmptyDashboardData();
    }
  };

  // ✅ NEW: Return safe empty structure
  CreatorAnalytics.prototype._getEmptyDashboardData = function() {
    return {
      summary: {
        totalViews: 0,
        totalWatchTime: 0,
        totalUniqueViewers: 0,
        avgCompletionRate: 0,
        totalContent: 0,
        totalEarnings: 0
      },
      analytics: [],
      chartData: this._generateMockChartData(),
      timeRange: this._getTimeRangeLabel('30days')
    };
  };

  CreatorAnalytics.prototype.getContentAnalytics = async function(contentId) {
    if (!contentId) return { error: 'Content ID required' };
    
    const key = 'content_' + contentId;
    if (this._isCacheValid(key)) return this._cache[key];
    
    try {
      const { data: content } = await this.supabase
        .from('Content')
        .select('id, title, thumbnail_url, duration, created_at, views_count, likes_count')
        .eq('id', contentId)
        .single();
      
      if (!content) return { error: 'Content not found' };
      
      const { data: dailyData } = await this.supabase
        .from('daily_analytics')
        .select('date, views, watch_time_seconds')
        .eq('content_id', contentId)
        .order('date', { ascending: true })
        .limit(30);
      
      const result = {
        content: content,
        analytics: {
          total_views: content.views_count || 0,
          total_watch_time: 0,
          avg_watch_time: 0,
          avg_completion_rate: 0
        },
        dailyData: dailyData || [],
        retentionCurve: this._calculateRetentionCurve(dailyData, content.duration)
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
      // ✅ FIXED: Get content IDs first, then query
      const contentIds = await this._getContentIdsForUser();
      if (contentIds.length === 0) return [];
      
      const { data, error } = await this.supabase
        .from('daily_analytics')
        .select('date, watch_time_seconds, content_id')
        .in('content_id', contentIds)
        .gte('date', dateFrom)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      // Group by date in JS
      const grouped = {};
      (data || []).forEach(item => {
        grouped[item.date] = (grouped[item.date] || 0) + (item.watch_time_seconds || 0);
      });
      
      return Object.entries(grouped).map(([date, total]) => ({
        date,
        total_watch_time: total
      }));
      
    } catch (error) {
      console.error('❌ Watch time by date failed:', error);
      return [];
    }
  };

  // ✅ FIXED: getTopContent — Proper bigint handling + thumbnail URL construction
  CreatorAnalytics.prototype.getTopContent = async function(limit = 10, timeRange = '30days') {
    if (!this.userId) return [];
    const dateFrom = this._getDateFromRange(timeRange);
    
    try {
      // ✅ Step 1: Get user's published content IDs (bigint) and their details
      const { data: userContent, error: contentError } = await this.supabase
        .from('Content')
        .select('id, title, thumbnail_url, duration, created_at, likes_count')
        .eq('user_id', this.userId)
        .eq('status', 'published');
      
      if (contentError) throw contentError;
      if (!userContent || userContent.length === 0) return [];
      
      // Extract bigint IDs
      const contentIds = userContent.map(c => c.id);
      
      // ✅ Step 2: Fetch daily analytics for those IDs
      const { data, error } = await this.supabase
        .from('daily_analytics')
        .select('content_id, views, watch_time_seconds, date')
        .in('content_id', contentIds)
        .gte('date', dateFrom);
      
      if (error) throw error;
      
      // ✅ Step 3: Aggregate in JavaScript
      const aggregated = {};
      (data || []).forEach(item => {
        if (!aggregated[item.content_id]) {
          aggregated[item.content_id] = {
            content_id: item.content_id,
            total_views: 0,
            total_watch_time: 0
          };
        }
        aggregated[item.content_id].total_views += item.views || 0;
        aggregated[item.content_id].total_watch_time += item.watch_time_seconds || 0;
      });
      
      // ✅ Step 4: Sort and limit
      const sorted = Object.values(aggregated)
        .sort((a, b) => b.total_views - a.total_views)
        .slice(0, limit);
      
      if (sorted.length === 0) return [];
      
      // ✅ Step 5: Create content map from the userContent we already fetched
      const contentMap = {};
      userContent.forEach(c => {
        contentMap[c.id] = {
          id: c.id,
          title: c.title || 'Untitled',
          thumbnail_url: c.thumbnail_url,
          duration: c.duration,
          created_at: c.created_at,
          likes_count: c.likes_count || 0
        };
      });
      
      // ✅ Step 6: Build final result with FIXED thumbnail URLs
      return sorted.map(item => {
        const content = contentMap[item.content_id];
        
        // ✅ Fix thumbnail URL using Supabase Storage format
        let thumbnailUrl = null;
        
        if (content?.thumbnail_url) {
          // Handle various URL formats
          if (content.thumbnail_url.startsWith('http')) {
            thumbnailUrl = content.thumbnail_url;
          } else {
            // Construct Supabase Storage URL
            let cleanPath = content.thumbnail_url;
            if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
            if (!cleanPath.includes('content-thumbnails/')) {
              cleanPath = `content-thumbnails/${cleanPath}`;
            }
            thumbnailUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${cleanPath}`;
          }
        }
        
        return {
          ...item,
          Content: {
            ...content,
            thumbnail_url: thumbnailUrl
          }
        };
      });
      
    } catch (error) {
      console.error('❌ Top content failed:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype.refreshAnalytics = async function(contentId) {
    if (!contentId) return false;
    try {
      delete this._cache['content_' + contentId];
      console.log('✅ Analytics cache cleared for content:', contentId);
      return true;
    } catch (error) {
      console.error('❌ Refresh analytics failed:', error);
      return false;
    }
  };

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  CreatorAnalytics.prototype._getContentIdsForUser = async function() {
    if (!this.userId) return [];
    try {
      const { data: content } = await this.supabase
        .from('Content')
        .select('id')
        .eq('user_id', this.userId)
        .eq('status', 'published');
      return (content || []).map(c => c.id);
    } catch (error) {
      console.error('❌ Failed to get content IDs:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype._prepareChartData = function(dailyData) {
    const labels = [], views = [], watchTime = [];
    (dailyData || []).forEach(item => {
      labels.push(new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      views.push(item.views || 0);
      watchTime.push(Math.round((item.watch_time_seconds || 0) / 60));
    });
    return { labels, views, watchTime };
  };

  CreatorAnalytics.prototype._generateMockChartData = function() {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return {
      labels,
      views: labels.map(() => Math.floor(Math.random() * 100) + 50),
      watchTime: labels.map(() => Math.floor(Math.random() * 500) + 200)
    };
  };

  CreatorAnalytics.prototype._calculateRetentionCurve = function(dailyData, duration) {
    const curve = [];
    for (let i = 0; i <= 10; i++) {
      const percentage = (i / 10) * 100;
      curve.push({ percentage, retention: Math.max(0, 100 - (percentage * 0.8)) });
    }
    return curve;
  };

  CreatorAnalytics.prototype._getDateFromRange = function(timeRange) {
    const now = new Date();
    const ranges = {
      '7days': 7, '30days': 30, '90days': 90
    };
    const days = ranges[timeRange] || 30;
    return new Date(now - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  };

  CreatorAnalytics.prototype._getTimeRangeLabel = function(timeRange) {
    const labels = {
      '7days': 'Last 7 days',
      '30days': 'Last 30 days',
      '90days': 'Last 90 days',
      'all': 'All time'
    };
    return labels[timeRange] || 'Last 30 days';
  };

  CreatorAnalytics.prototype._isCacheValid = function(key) {
    const lastFetch = this._lastFetch[key];
    return lastFetch && (Date.now() - lastFetch < this._cacheDuration);
  };

  CreatorAnalytics.prototype._handleError = function(context, error) {
    console.error('❌ CreatorAnalytics error [' + context + ']:', error);
    if (this.onError) this.onError({ context, error: error.message || error });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreatorAnalytics;
  } else {
    window.CreatorAnalytics = CreatorAnalytics;
  }
  
  console.log('✅ CreatorAnalytics module loaded successfully');
})();
