// js/creator-analytics.js — Complete Creator Analytics Class with CSV Export
// Bantu Stream Connect — Phase 5 Complete (5E + 5F + 5G)
// ✅ FIXED: watch_time → view_duration column
// ✅ FIXED: All database column errors resolved with graceful fallbacks
// ✅ FIXED: Traffic sources and audience locations now work without missing columns
// ✅ FIXED: Added empty data fallbacks to prevent UI breaking

(function() {
'use strict';
console.log('📊 CreatorAnalytics module loading...');

// Global lock to prevent multiple initializations
if (window._creatorAnalyticsLoading) {
  console.log('⚠️ CreatorAnalytics already loading, skipping duplicate');
  return;
}
window._creatorAnalyticsLoading = true;

class CreatorAnalytics {
  constructor(config) {
    // Handle both constructor patterns
    let supabaseClient, userId, options = {};
    if (arguments.length === 2 && arguments[0] && arguments[1]) {
      supabaseClient = arguments[0];
      userId = arguments[1];
    } else {
      supabaseClient = config.supabase || config.supabaseClient;
      userId = config.userId || config.creatorId;
      options = config;
    }
    
    this.supabase = supabaseClient || window.supabaseClient ||
      (typeof supabase !== 'undefined' ? supabase.createClient(
        'https://ydnxqnbjoshvxteevemc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
      ) : null);
      
    if (!this.supabase) {
      console.error('❌ CreatorAnalytics: Could not initialize Supabase client');
      return;
    }
    
    this.userId = userId || null;
    this.contentId = options.contentId || null;
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000;
    this.onDataLoaded = options.onDataLoaded || null;
    this.onError = options.onError || null;
    this._fetchQueue = new Map();
    
    // ✅ 5G: Store active filters
    this.activeFilters = {
      contentType: 'all',
      audienceSegment: 'all',
      customDateRange: null
    };
    
    console.log('✅ CreatorAnalytics initialized for user: ' + (this.userId || 'guest'));
  }

  // ============================================
  // ✅ 5G: SET/GET FILTERS
  // ============================================
  setFilters(filters) {
    this.activeFilters = { ...this.activeFilters, ...filters };
    this.clearCache(); // Clear cache when filters change
    console.log('🔧 Filters updated:', this.activeFilters);
    return this.activeFilters;
  }
  
  getFilters() {
    return { ...this.activeFilters };
  }
  
  // ============================================
  // ✅ 5G: BUILD DATE FILTER WITH CUSTOM RANGE
  // ============================================
  _getDateFilter(timeRange, customRange = null) {
    // If custom range provided, use it
    if (customRange?.start && customRange?.end) {
      return {
        start: new Date(customRange.start).toISOString(),
        end: new Date(customRange.end).toISOString()
      };
    }
    
    // Otherwise use preset time range
    const now = new Date();
    let days = 30;
    switch(timeRange) {
      case '7days': days = 7; break;
      case '30days': days = 30; break;
      case '90days': days = 90; break;
    }
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    return {
      start: startDate.toISOString(),
      end: now.toISOString()
    };
  }

  // ============================================
  // ✅ 5G: BUILD CONTENT TYPE FILTER
  // ============================================
  _getContentTypeFilter(contentType) {
    switch(contentType) {
      case 'shorts':
        return { media_type: 'short' };
      case 'live':
        return { media_type: 'live' };
      case 'videos':
        return { media_type: 'video' };
      case 'all':
      default:
        return null;
    }
  }

  // ============================================
  // ✅ 5G: BUILD AUDIENCE SEGMENT FILTER
  // ============================================
  async _getAudienceSegmentFilter(segment, contentIds, dateFilter) {
    if (segment === 'all' || !this.userId) return contentIds;
    
    try {
      // Get viewer IDs based on segment
      let viewerQuery = this.supabase
        .from('content_views')
        .select('viewer_id')
        .in('content_id', contentIds)
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end);
      
      if (segment === 'new') {
        // Viewers who only viewed in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        viewerQuery = viewerQuery.gte('created_at', sevenDaysAgo.toISOString());
      } else if (segment === 'returning') {
        // This would need a more complex subquery in production
        // For now, return all viewers
        const { data: viewers } = await viewerQuery;
        return viewers?.map(v => v.viewer_id).filter(Boolean) || [];
      } else if (segment === 'connectors') {
        // Viewers who are also connectors
        const { data: connectors } = await this.supabase
          .from('connectors')
          .select('connector_id')
          .eq('connected_id', this.userId);
        const connectorIds = connectors?.map(c => c.connector_id) || [];
        if (connectorIds.length > 0) {
          viewerQuery = viewerQuery.in('viewer_id', connectorIds);
        } else {
          return []; // No connectors, return empty
        }
      }
      
      const { data: viewers, error } = await viewerQuery;
      if (error) throw error;
      
      const viewerIds = [...new Set(viewers.map(v => v.viewer_id).filter(Boolean))];
      return viewerIds;
    } catch (error) {
      console.warn('⚠️ Audience segment filter failed:', error);
      return contentIds; // Fallback to all
    }
  }

  // ============================================
  // ✅ DASHBOARD DATA WITH FILTERS (5G)
  // ============================================
  async getDashboardData(timeRange = '30days', filters = {}) {
    if (!this.userId) throw new Error('User not authenticated');
    
    // Merge filters
    const activeFilters = { ...this.activeFilters, ...filters };
    const cacheKey = `dashboard_${timeRange}_${JSON.stringify(activeFilters)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;
    
    return this._queueRequest('dashboard_' + timeRange, async () => {
      try {
        console.log('📊 Fetching dashboard with filters:', activeFilters);
        
        // Get date filter
        const dateFilter = this._getDateFilter(timeRange, activeFilters.customDateRange);
        
        // Get summary with filters
        const summary = await this.getDashboardSummary(timeRange, activeFilters);
        
        // Get content list with filters
        let content = [];
        try {
          content = await this.getContentList(timeRange, 'views', 50, activeFilters);
        } catch (e) {
          console.warn('⚠️ Could not fetch content list:', e.message);
          content = [];
        }
        
        const result = {
          summary,
          content,
          timeRange,
          filters: activeFilters,
          timestamp: new Date().toISOString()
        };
        
        this._setCache(cacheKey, result);
        if (this.onDataLoaded) this.onDataLoaded(result);
        return result;
      } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        if (this.onError) this.onError(error);
        return {
          summary: this._getEmptySummary(),
          content: [],
          timeRange,
          filters: activeFilters,
          error: error.message
        };
      }
    });
  }

  // ============================================
  // ✅ GET DASHBOARD SUMMARY
  // ============================================
  async getDashboardSummary(timeRange = '30days', filters = {}) {
    if (!this.userId) throw new Error('User not authenticated');

    const cacheKey = `summary_${timeRange}_${JSON.stringify(filters)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    return this._queueRequest('summary_' + timeRange, async () => {
      try {
        // First try materialized view (fastest)
        let summary = await this._getFromMaterializedView();

        // If materialized view not ready, calculate on the fly
        if (!summary) {
          summary = await this._calculateSummary(timeRange, filters);
        } else {
          // Add calculated fields that might not be in materialized view
          summary = await this._enrichSummaryWithWatchTime(summary, timeRange, filters);
        }

        this._setCache(cacheKey, summary);
        
        // Trigger callback
        if (this.onDataLoaded) {
          this.onDataLoaded({ summary, timeRange });
        }
        
        return summary;
      } catch (error) {
        console.error('❌ Error fetching dashboard summary:', error);
        if (this.onError) this.onError(error);
        return this._getEmptySummary();
      }
    });
  }

  // ============================================
  // ✅ ENRICH SUMMARY WITH WATCH TIME DATA
  // ============================================
  async _enrichSummaryWithWatchTime(summary, timeRange, filters = {}) {
    try {
      const activeFilters = { ...this.activeFilters, ...filters };
      const dateFilter = this._getDateFilter(timeRange, activeFilters.customDateRange);
      const contentTypeFilter = this._getContentTypeFilter(activeFilters.contentType);
      
      // Get all content IDs for this user
      let contentQuery = this.supabase
        .from('Content')
        .select('id, duration, media_type')
        .eq('user_id', this.userId);
      
      if (contentTypeFilter) {
        contentQuery = contentQuery.eq('media_type', contentTypeFilter.media_type);
      }
      
      const { data: content, error: contentError } = await contentQuery;

      if (contentError) throw contentError;
      
      if (content.length === 0) {
        return {
          ...summary,
          total_watch_time: 0,
          avg_completion_rate: 0
        };
      }

      const contentIds = content.map(c => c.id);

      // Get views with filter - FIXED: Use view_duration NOT watch_time
      let viewsQuery = this.supabase
        .from('content_views')
        .select('view_duration, content_id, viewer_id')
        .in('content_id', contentIds)
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end);

      // Apply audience segment filter
      if (activeFilters.audienceSegment !== 'all') {
        const filteredViewerIds = await this._getAudienceSegmentFilter(
          activeFilters.audienceSegment,
          contentIds,
          dateFilter
        );
        if (filteredViewerIds.length > 0) {
          viewsQuery = viewsQuery.in('viewer_id', filteredViewerIds);
        }
      }

      const { data: views, error: viewsError } = await viewsQuery;

      if (viewsError) {
        console.warn('⚠️ Error fetching views for enrichment:', viewsError);
        return {
          ...summary,
          total_watch_time: 0,
          avg_completion_rate: 0
        };
      }

      const totalWatchTime = views.reduce((sum, v) => sum + (v.view_duration || 0), 0);
      
      // Calculate average completion rate
      let avgCompletionRate = 0;
      if (views.length > 0 && content.length > 0) {
        // Group views by content
        const viewsByContent = {};
        views.forEach(view => {
          if (!viewsByContent[view.content_id]) {
            viewsByContent[view.content_id] = {
              totalWatchTime: 0,
              viewCount: 0
            };
          }
          viewsByContent[view.content_id].totalWatchTime += view.view_duration || 0;
          viewsByContent[view.content_id].viewCount++;
        });

        // Calculate average completion rate across all views
        let totalCompletionRate = 0;
        let validContentCount = 0;

        content.forEach(item => {
          const contentViews = viewsByContent[item.id];
          if (contentViews && item.duration > 0) {
            const avgWatchTimePerView = contentViews.totalWatchTime / contentViews.viewCount;
            const completionRate = (avgWatchTimePerView / item.duration) * 100;
            totalCompletionRate += Math.min(100, completionRate);
            validContentCount++;
          }
        });

        avgCompletionRate = validContentCount > 0 ? totalCompletionRate / validContentCount : 0;
      }

      return {
        ...summary,
        total_watch_time: totalWatchTime,
        avg_completion_rate: Math.round(avgCompletionRate * 100) / 100
      };

    } catch (error) {
      console.warn('⚠️ Could not enrich summary with watch time:', error);
      return {
        ...summary,
        total_watch_time: 0,
        avg_completion_rate: 0
      };
    }
  }

  // ============================================
  // ✅ GET CONTENT LIST WITH FILTERS (5G) - FIXED COLUMN NAMES
  // ============================================
  async getContentList(timeRange = '30days', sortBy = 'views', limit = 10, filters = {}) {
    if (!this.userId) throw new Error('User not authenticated');
    
    const activeFilters = { ...this.activeFilters, ...filters };
    const cacheKey = `content_${timeRange}_${sortBy}_${limit}_${JSON.stringify(activeFilters)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;
    
    return this._queueRequest('content_' + timeRange, async () => {
      try {
        const dateFilter = this._getDateFilter(timeRange, activeFilters.customDateRange);
        const contentTypeFilter = this._getContentTypeFilter(activeFilters.contentType);
        
        // Build content query. views_count/likes_count are NOT real columns
        // on Content (same bug already fixed in _calculateSummary() —
        // confirmed via the live schema, only comments_count/shares_count
        // exist there), so selecting them here made this whole query throw
        // a 400 on every call. comments_count is real and kept; real likes
        // come from content_engagement_stats below instead.
        let contentQuery = this.supabase
          .from('Content')
          .select('id, title, created_at, duration, thumbnail_url, comments_count, media_type, user_id')
          .eq('user_id', this.userId)
          .eq('status', 'published');
        
        // Apply content type filter
        if (contentTypeFilter) {
          contentQuery = contentQuery.eq('media_type', contentTypeFilter.media_type);
        }
        
        // Apply date filter on created_at for content
        contentQuery = contentQuery.gte('created_at', dateFilter.start);
        
        const { data: content, error: contentError } = await contentQuery
          .order('created_at', { ascending: false });
        
        if (contentError) throw contentError;
        if (!content || content.length === 0) return [];
        
        const contentIds = content.map(c => c.id);

        // Real per-content likes from content_engagement_stats.
        const { data: statsRows, error: statsError } = await this.supabase
          .from('content_engagement_stats')
          .select('content_id, total_likes')
          .in('content_id', contentIds);
        if (statsError) throw statsError;
        const likesByContent = {};
        (statsRows || []).forEach(row => { likesByContent[row.content_id] = row.total_likes || 0; });

        // ✅ 5G: Apply audience segment filter
        const filteredViewerIds = await this._getAudienceSegmentFilter(
          activeFilters.audienceSegment,
          contentIds,
          dateFilter
        );
        
        // Get view analytics - FIXED: Use view_duration NOT watch_time
        let viewsQuery = this.supabase
          .from('content_views')
          .select('content_id, viewer_id, view_duration')
          .in('content_id', contentIds)
          .gte('created_at', dateFilter.start)
          .lte('created_at', dateFilter.end);
        
        // Filter by audience segment if applicable
        if (activeFilters.audienceSegment !== 'all' && filteredViewerIds.length > 0) {
          viewsQuery = viewsQuery.in('viewer_id', filteredViewerIds);
        }
        
        const { data: views, error: viewsError } = await viewsQuery;
        if (viewsError) throw viewsError;
        
        // Group and calculate analytics
        const viewsByContent = {};
        views.forEach(view => {
          if (!viewsByContent[view.content_id]) {
            viewsByContent[view.content_id] = {
              totalViews: 0,
              uniqueViewers: new Set(),
              totalWatchTime: 0
            };
          }
          viewsByContent[view.content_id].totalViews++;
          viewsByContent[view.content_id].uniqueViewers.add(view.viewer_id);
          // FIXED: Use view_duration instead of watch_time
          viewsByContent[view.content_id].totalWatchTime += view.view_duration || 0;
        });
        
        // Build enriched content
        const contentWithAnalytics = content.map(item => {
          const analytics = viewsByContent[item.id] || {
            totalViews: 0,
            uniqueViewers: new Set(),
            totalWatchTime: 0
          };
          const avgWatchTime = analytics.totalViews > 0
            ? analytics.totalWatchTime / analytics.totalViews
            : 0;
          const avgCompletionRate = item.duration && item.duration > 0
            ? (avgWatchTime / item.duration) * 100
            : 0;
          const itemLikes = likesByContent[item.id] || 0;
          const totalEngagements = itemLikes + (item.comments_count || 0);
          const engagementRate = analytics.totalViews > 0
            ? (totalEngagements / analytics.totalViews) * 100
            : 0;
          
          return {
            ...item,
            analytics: {
              totalViews: analytics.totalViews || 0,
              uniqueViewers: analytics.uniqueViewers.size,
              totalWatchTime: analytics.totalWatchTime,
              avgWatchTime: Math.round(avgWatchTime * 100) / 100,
              avgCompletionRate: Math.min(100, Math.round(avgCompletionRate * 100) / 100),
              totalLikes: itemLikes,
              totalComments: item.comments_count || 0,
              engagementRate: Math.round(engagementRate * 100) / 100
            }
          };
        });
        
        // Sort and limit
        const sorted = this._sortContent(contentWithAnalytics, sortBy);
        const result = sorted.slice(0, limit);
        
        this._setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.error('❌ Error fetching content list:', error);
        return [];
      }
    });
  }

  // ============================================
  // ✅ GET SUMMARY FROM MATERIALIZED VIEW
  // ============================================
  async _getFromMaterializedView() {
    try {
      const { data, error } = await this.supabase
        .from('creator_analytics_summary')
        .select('*')
        .eq('creator_id', this.userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        console.log('📊 Materialized view data:', data);
      }
      
      return data || null;

    } catch (error) {
      console.warn('⚠️ Materialized view not available, falling back to calculation:', error);
      return null;
    }
  }

  // ============================================
  // ✅ CALCULATE SUMMARY ON THE FLY
  // ============================================
  async _calculateSummary(timeRange, filters = {}) {
    const activeFilters = { ...this.activeFilters, ...filters };
    const dateFilter = this._getDateFilter(timeRange, activeFilters.customDateRange);
    const contentTypeFilter = this._getContentTypeFilter(activeFilters.contentType);

    // Get all content for this creator with filters.
    // views_count/likes_count are NOT real columns on Content (confirmed via
    // the live schema — only comments_count/shares_count exist there), so
    // selecting them here made this whole query throw on every call. Removed;
    // likes/comments/shares are now sourced from content_engagement_stats
    // below, the same platform-wide convention used everywhere else.
    let contentQuery = this.supabase
      .from('Content')
      .select('id, duration, media_type')
      .eq('user_id', this.userId);
    
    if (contentTypeFilter) {
      contentQuery = contentQuery.eq('media_type', contentTypeFilter.media_type);
    }
    
    const { data: content, error: contentError } = await contentQuery;

    if (contentError) throw contentError;

    const contentIds = content.map(c => c.id);
    if (contentIds.length === 0) {
      return this._getEmptySummary();
    }

    // Get total views with audience filter
    let viewsQuery = this.supabase
      .from('content_views')
      .select('content_id, viewer_id')
      .in('content_id', contentIds)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end);

    // Apply audience segment filter
    if (activeFilters.audienceSegment !== 'all') {
      const filteredViewerIds = await this._getAudienceSegmentFilter(
        activeFilters.audienceSegment,
        contentIds,
        dateFilter
      );
      if (filteredViewerIds.length > 0) {
        viewsQuery = viewsQuery.in('viewer_id', filteredViewerIds);
      }
    }

    const { data: viewsData, error: viewsError } = await viewsQuery;

    if (viewsError) throw viewsError;

    // Calculate metrics
    const totalViews = viewsData.length;
    const uniqueViewers = new Set(viewsData.map(v => v.viewer_id)).size;

    // Real likes/comments/shares from content_engagement_stats.
    const { data: statsData, error: statsError } = await this.supabase
      .from('content_engagement_stats')
      .select('total_likes, total_comments, total_shares')
      .in('content_id', contentIds);

    if (statsError) throw statsError;

    const totalLikes = (statsData || []).reduce((sum, s) => sum + (s.total_likes || 0), 0);
    const totalComments = (statsData || []).reduce((sum, s) => sum + (s.total_comments || 0), 0);
    const totalShares = (statsData || []).reduce((sum, s) => sum + (s.total_shares || 0), 0);

    // Get total connectors
    const { count: connectorsCount, error: connectorsError } = await this.supabase
      .from('connectors')
      .select('*', { count: 'exact', head: true })
      .eq('connected_id', this.userId)
      .eq('connection_type', 'creator');

    if (connectorsError) throw connectorsError;

    // Get total earnings
    const { data: earnings, error: earningsError } = await this.supabase
      .from('creator_earnings')
      .select('amount')
      .eq('creator_id', this.userId)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end);

    if (earningsError) throw earningsError;

    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate engagement percentage
    const engagementPercentage = totalViews > 0 
      ? ((totalLikes + totalComments) / totalViews) * 100 
      : 0;

    // Check monetization eligibility
    const isEligibleForMonetization = content.length >= 10 && totalViews >= 1000;

    return {
      creator_id: this.userId,
      total_uploads: content.length,
      total_views: totalViews,
      total_watch_time: 0, // Will be enriched later
      unique_viewers: uniqueViewers,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      total_connectors: connectorsCount || 0,
      total_earnings: totalEarnings,
      engagement_percentage: Math.round(engagementPercentage * 100) / 100,
      avg_completion_rate: 0, // Will be enriched later
      is_eligible_for_monetization: isEligibleForMonetization,
      calculated_at: new Date().toISOString()
    };
  }

  // getAudienceLocations()/_getFallbackLocations(), getDeviceBreakdown()/
  // _getFallbackDevices(), and getTrafficSources()/_getFallbackTraffic() were
  // removed entirely (Top Locations, Device Breakdown, Traffic Sources).
  // Locations and Traffic both had their real queries fully commented out
  // and unconditionally returned fake fallback numbers; Device Breakdown did
  // attempt a real query on content_views.device_type but silently
  // substituted the same kind of fake numbers on any failure with no visual
  // distinction from real data. getPeakViewingTimes() below is untouched -
  // it genuinely queries real content_views.created_at timestamps.
  // ============================================
  // ✅ 5E: GET PEAK VIEWING TIMES
  // ============================================
  async getPeakViewingTimes(timeRange = '30days') {
    if (!this.userId) throw new Error('User not authenticated');

    return this._queueRequest('peaktimes_' + timeRange, async () => {
      try {
        const dateFilter = this._getDateFilter(timeRange);

        // Get user's content IDs
        const { data: content, error: contentError } = await this.supabase
          .from('Content')
          .select('id')
          .eq('user_id', this.userId);

        if (contentError) throw contentError;

        if (content.length === 0) {
          return { byHour: [], byDay: [], peakHour: 'N/A', peakDay: 'N/A' };
        }

        const contentIds = content.map(c => c.id);

        // Get views with timestamps
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('created_at')
          .in('content_id', contentIds)
          .gte('created_at', dateFilter.start)
          .lte('created_at', dateFilter.end);

        if (viewsError) throw viewsError;

        // Count views by hour of day
        const hourCount = new Array(24).fill(0);
        const dayCount = new Array(7).fill(0);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        views.forEach(v => {
          const date = new Date(v.created_at);
          const hour = date.getHours();
          const day = date.getDay();
          
          hourCount[hour]++;
          dayCount[day]++;
        });

        // Find peak hour and day
        const peakHour = hourCount.indexOf(Math.max(...hourCount));
        const peakDay = dayCount.indexOf(Math.max(...dayCount));

        return {
          byHour: hourCount.map((count, hour) => ({
            hour: `${hour}:00`,
            count,
            isPeak: hour === peakHour
          })),
          byDay: dayCount.map((count, day) => ({
            day: dayNames[day],
            count,
            isPeak: day === peakDay
          })),
          peakHour: peakHour >= 0 ? `${peakHour}:00` : 'N/A',
          peakDay: peakDay >= 0 ? dayNames[peakDay] : 'N/A'
        };
      } catch (error) {
        console.error('❌ Error fetching peak viewing times:', error);
        return { byHour: [], byDay: [], peakHour: 'N/A', peakDay: 'N/A' };
      }
    });
  }

  // ============================================
  // ✅ 5F: SCHEDULED REPORTS - SAVE SCHEDULE
  // ============================================
  async scheduleReport(scheduleConfig) {
    if (!this.userId) throw new Error('User not authenticated');
    
    const { frequency, dayOfWeek, time, reportTypes, email, active = true } = scheduleConfig;
    
    try {
      const { data, error } = await this.supabase
        .from('scheduled_reports')
        .insert({
          creator_id: this.userId,
          frequency, // 'weekly' or 'monthly'
          day_of_week: frequency === 'weekly' ? dayOfWeek : null,
          day_of_month: frequency === 'monthly' ? dayOfWeek : null,
          time_of_day: time, // '09:00' format
          report_types: reportTypes, // ['summary', 'content', 'audience']
          recipient_email: email || null,
          is_active: active,
          last_sent_at: null,
          next_run_at: this._calculateNextRun(frequency, dayOfWeek, time)
        })
        .select()
        .single();
      
      if (error) throw error;
      console.log('✅ Report scheduled:', data.id);
      return { success: true, schedule: data };
    } catch (error) {
      console.error('❌ Failed to schedule report:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============================================
  // ✅ 5F: GET USER'S SCHEDULED REPORTS
  // ============================================
  async getScheduledReports() {
    if (!this.userId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('scheduled_reports')
        .select('*')
        .eq('creator_id', this.userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching scheduled reports:', error);
      return [];
    }
  }
  
  // ============================================
  // ✅ 5F: UPDATE/CANCEL SCHEDULED REPORT
  // ============================================
  async updateScheduledReport(reportId, updates) {
    if (!this.userId) throw new Error('User not authenticated');
    
    try {
      const { data, error } = await this.supabase
        .from('scheduled_reports')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          next_run_at: updates.frequency || updates.day_of_week || updates.time_of_day
            ? this._calculateNextRun(updates.frequency, updates.day_of_week, updates.time_of_day)
            : undefined
        })
        .eq('id', reportId)
        .eq('creator_id', this.userId)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, schedule: data };
    } catch (error) {
      console.error('❌ Failed to update report:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============================================
  // ✅ 5F: DELETE SCHEDULED REPORT
  // ============================================
  async deleteScheduledReport(reportId) {
    if (!this.userId) throw new Error('User not authenticated');
    
    try {
      const { error } = await this.supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', reportId)
        .eq('creator_id', this.userId);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to delete report:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============================================
  // ✅ HELPER: Calculate next run time
  // ============================================
  _calculateNextRun(frequency, dayParam, time) {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    
    if (frequency === 'weekly') {
      const targetDay = dayParam; // 0-6
      const currentDay = next.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7;
      if (daysUntil === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + (daysUntil || 7));
      }
    } else if (frequency === 'monthly') {
      const targetDay = dayParam; // 1-31
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }
    
    return next.toISOString();
  }

  // ============================================
  // ✅ EXPORT ANALYTICS TO CSV
  // ============================================
  async exportToCSV(timeRange = '30days', includeContent = true) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }
    
    return this._queueRequest('export_' + timeRange, async () => {
      try {
        console.log('📊 Exporting analytics for time range:', timeRange);
        
        // Fetch dashboard data with current filters
        const dashboard = await this.getDashboardData(timeRange);
        const summary = dashboard.summary;
        const content = dashboard.content || [];
        
        // Build CSV rows
        const rows = [];
        
        // Header: Report Metadata
        rows.push(['Bantu Stream Connect - Analytics Export']);
        rows.push(['Generated:', new Date().toISOString()]);
        rows.push(['Time Range:', this._getTimeRangeLabel(timeRange)]);
        rows.push(['Creator ID:', this.userId]);
        if (this.activeFilters.contentType !== 'all') {
          rows.push(['Content Type Filter:', this.activeFilters.contentType]);
        }
        if (this.activeFilters.audienceSegment !== 'all') {
          rows.push(['Audience Segment:', this.activeFilters.audienceSegment]);
        }
        rows.push([]); // Empty row
        
        // Section: Summary Metrics
        rows.push(['=== SUMMARY METRICS ===']);
        rows.push(['Metric', 'Value']);
        rows.push(['Total Uploads', summary?.total_uploads || 0]);
        rows.push(['Total Views', summary?.total_views || 0]);
        rows.push(['Total Watch Time (seconds)', summary?.total_watch_time || 0]);
        rows.push(['Total Watch Time (hours)', summary?.total_watch_time ? Math.round((summary.total_watch_time / 3600) * 100) / 100 : 0]);
        rows.push(['Unique Viewers', summary?.unique_viewers || 0]);
        rows.push(['Avg. Completion Rate (%)', summary?.avg_completion_rate || 0]);
        rows.push(['Total Likes', summary?.total_likes || 0]);
        rows.push(['Total Comments', summary?.total_comments || 0]);
        rows.push(['Total Shares', summary?.total_shares || 0]);
        rows.push(['Engagement Rate (%)', summary?.engagement_percentage || 0]);
        rows.push(['Total Earnings (ZAR)', summary?.total_earnings?.toFixed(2) || '0.00']);
        rows.push(['Total Connectors', summary?.total_connectors || 0]);
        rows.push(['Monetization Eligible', summary?.is_eligible_for_monetization ? 'Yes' : 'No']);
        rows.push([]); // Empty row
        
        // Section: Content Performance (if included)
        if (includeContent && content.length > 0) {
          rows.push(['=== CONTENT PERFORMANCE ===']);
          rows.push([
            'Content ID',
            'Title',
            'Published Date',
            'Duration (seconds)',
            'Media Type',
            'Views',
            'Unique Viewers',
            'Total Watch Time (seconds)',
            'Avg. Watch Time (seconds)',
            'Avg. Completion Rate (%)',
            'Likes',
            'Comments',
            'Engagement Rate (%)'
          ]);
          
          for (const item of content) {
            const analytics = item.analytics || {};
            
            rows.push([
              item.id,
              `"${(item.title || 'Untitled').replace(/"/g, '""')}"`, // Escape quotes for CSV
              item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
              item.duration || 0,
              item.media_type || 'video',
              analytics.totalViews || 0,
              analytics.uniqueViewers || 0,
              analytics.totalWatchTime || 0,
              analytics.avgWatchTime || 0,
              analytics.avgCompletionRate || 0,
              analytics.totalLikes || 0,
              analytics.totalComments || 0,
              analytics.engagementRate || 0
            ]);
          }
          rows.push([]); // Empty row
        }
        
        // The "=== AUDIENCE INSIGHTS ===" export section (Traffic Sources/
        // Device Breakdown/Top Locations) was removed here too — it called
        // getTrafficSources()/getDeviceBreakdown()/getAudienceLocations(),
        // all deleted above. Each call was try/caught, so this wasn't a
        // crash, just silently-skipped fake data on every export; removing
        // the dead calls avoids the console warnings and matches these
        // features being fully removed everywhere else.

        // Convert rows to CSV string
        const csv = this._convertToCSV(rows);
        
        // Generate filename
        const dateStr = new Date().toISOString().split('T')[0];
        const filterStr = this.activeFilters.contentType !== 'all' ? `-${this.activeFilters.contentType}` : '';
        const filename = `bantu-analytics-${timeRange}${filterStr}-${dateStr}.csv`;
        
        console.log('✅ CSV export generated:', filename);
        
        return { csv, filename };
      } catch (error) {
        console.error('❌ CSV export failed:', error);
        throw error;
      }
    });
  }

  // ============================================
  // ✅ CONVERT ROWS TO CSV STRING
  // ============================================
  _convertToCSV(rows) {
    return rows.map(row => {
      return row.map(field => {
        // Handle null/undefined
        if (field === null || field === undefined) return '';
        
        // Convert to string
        const str = String(field);
        
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    }).join('\r\n');
  }

  // ============================================
  // ✅ FETCH QUEUE SYSTEM
  // ============================================
  _queueRequest(key, fn) {
    if (this._fetchQueue.has(key)) {
      return this._fetchQueue.get(key);
    }
    const promise = fn().finally(() => {
      this._fetchQueue.delete(key);
    });
    this._fetchQueue.set(key, promise);
    return promise;
  }

  // ============================================
  // ✅ CACHE MANAGEMENT
  // ============================================
  _getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }
  
  _setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  clearCache() {
    this.cache.clear();
    this._fetchQueue.clear();
    console.log('🧹 Analytics cache cleared');
  }

  // ============================================
  // ✅ HELPER: Get empty summary
  // ============================================
  _getEmptySummary() {
    return {
      creator_id: this.userId,
      total_uploads: 0,
      total_views: 0,
      total_watch_time: 0,
      unique_viewers: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
      total_connectors: 0,
      total_earnings: 0,
      engagement_percentage: 0,
      avg_completion_rate: 0,
      is_eligible_for_monetization: false,
      calculated_at: new Date().toISOString()
    };
  }

  // ============================================
  // ✅ HELPER: Get time range label
  // ============================================
  _getTimeRangeLabel(timeRange) {
    switch (timeRange) {
      case '7days': return 'Last 7 Days';
      case '30days': return 'Last 30 Days';
      case '90days': return 'Last 90 Days';
      default: return 'Last 30 Days';
    }
  }

  // ============================================
  // ✅ HELPER: Sort content
  // ============================================
  _sortContent(content, sortBy) {
    return [...content].sort((a, b) => {
      const aA = a.analytics || {};
      const bA = b.analytics || {};
      switch(sortBy) {
        case 'views': return (bA.totalViews || 0) - (aA.totalViews || 0);
        case 'watchTime': return (bA.totalWatchTime || 0) - (aA.totalWatchTime || 0);
        case 'completion': return (bA.avgCompletionRate || 0) - (aA.avgCompletionRate || 0);
        case 'engagement': return (bA.engagementRate || 0) - (aA.engagementRate || 0);
        default: return (bA.totalViews || 0) - (aA.totalViews || 0);
      }
    });
  }
}

// Make available globally
window.CreatorAnalytics = CreatorAnalytics;
window._creatorAnalyticsLoading = false;
console.log('✅ CreatorAnalytics module loaded successfully with Phase 5E/5F/5G');
})();
