// js/creator-analytics.js — Creator Analytics Module
// Bantu Stream Connect — Phase 5 Implementation
// ✅ FIXED: Added watch time, avg duration, completion rate calculations
// ✅ FIXED: SQL query syntax error in _getContentList

(function() {
  'use strict';
  
  console.log('📊 CreatorAnalytics module loading...');

  function CreatorAnalytics(config) {
    // ✅ More flexible config check
    if (!config) {
      console.error('❌ CreatorAnalytics: Missing config object');
      return;
    }
    
    // Try multiple possible supabase client locations
    this.supabase = config.supabase || 
                    config.supabaseClient || 
                    window.supabaseClient || 
                    (typeof supabase !== 'undefined' ? supabase.createClient(
                      'https://ydnxqnbjoshvxteevemc.supabase.co',
                      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
                    ) : null);
    
    if (!this.supabase) {
      console.error('❌ CreatorAnalytics: Could not initialize Supabase client');
      return;
    }

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
      console.log('📦 Serving analytics from cache:', timeRange);
      return this._cache[key];
    }
    
    try {
      // Try materialized view first (fast)
      let analyticsData = await this._getFromMaterializedView();
      
      // If view fails, calculate from source tables (enhanced with watch time)
      if (!analyticsData) {
        analyticsData = await this._calculateFromSource(timeRange);
      }
      
      // Get content list
      const content = await this._getContentList(timeRange);
      
      // Build dashboard data
      const result = {
        summary: analyticsData,
        content: content,
        timeRange: this._getTimeRangeLabel(timeRange)
      };
      
      // Cache and return
      this._cache[key] = result;
      this._lastFetch[key] = Date.now();
      
      if (this.onDataLoaded) {
        this.onDataLoaded(result);
      }
      
      return result;
      
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
      // Get content details
      const { data: content, error: contentError } = await this.supabase
        .from('Content')
        .select('*, user_profiles!user_id(full_name, username)')
        .eq('id', contentId)
        .single();
      
      if (contentError) throw contentError;
      
      // Get view analytics
      const views = await this._getContentViews(contentId);
      
      // Get engagement metrics
      const engagement = await this._getContentEngagement(contentId);
      
      // Get retention data
      const retention = await this._getContentRetention(contentId, content.duration);
      
      const result = {
        content: content,
        analytics: {
          totalViews: views.total,
          uniqueViewers: views.unique,
          totalWatchTime: views.totalWatchTime,
          avgWatchTime: views.avgWatchTime,
          avgCompletionRate: views.avgCompletionRate,
          likes: engagement.likes,
          comments: engagement.comments,
          shares: engagement.shares,
          favorites: engagement.favorites
        },
        retention: retention,
        viewsByDay: views.byDay
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
        .from('content_views')
        .select('view_duration, created_at')
        .in('content_id', `(
          SELECT id FROM "Content" WHERE user_id = '${this.userId}'
        )`)
        .gte('created_at', dateFrom);
      
      if (error) throw error;
      
      // Group by date
      const grouped = {};
      (data || []).forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = 0;
        }
        grouped[date] += item.view_duration || 0;
      });
      
      return Object.entries(grouped).map(([date, seconds]) => ({
        date,
        watchTime: seconds,
        watchTimeHours: Math.round(seconds / 3600 * 100) / 100
      }));
      
    } catch (error) {
      console.error('❌ Watch time by date failed:', error);
      return [];
    }
  };

  // ============================================
  // ✅ FIXED: Get top content using proper query
  // ============================================
  CreatorAnalytics.prototype.getTopContent = async function(limit = 10, timeRange = '30days') {
    if (!this.userId) return [];
    
    try {
      // Use the fixed _getContentList method
      const content = await this._getContentList(timeRange);
      
      // Return top N items
      return content.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Get top content failed:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype.exportAnalytics = async function(format = 'csv', timeRange = '30days') {
    if (!this.userId) {
      return { error: 'User not authenticated' };
    }
    
    try {
      const dashboardData = await this.getDashboardData(timeRange);
      const topContent = await this.getTopContent(50, timeRange);
      
      if (format === 'csv') {
        return this._generateCSV(dashboardData, topContent);
      }
      
      return { data: { dashboardData, topContent }, format };
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      this._handleError('exportAnalytics', error);
      return { error: error.message };
    }
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  CreatorAnalytics.prototype._getFromMaterializedView = async function() {
    try {
      const { data, error } = await this.supabase
        .from('creator_analytics_summary')
        .select('*')
        .eq('creator_id', this.userId)
        .maybeSingle();
      
      if (error || !data) {
        console.warn('⚠️ Materialized view unavailable');
        return null;
      }
      
      return {
        totalUploads: data.total_uploads || 0,
        totalViews: data.total_views || 0,
        totalEarnings: data.total_earnings || 0,
        totalConnectors: data.total_connectors || 0,
        engagementPercentage: data.engagement_percentage || 0,
        isEligibleForMonetization: data.is_eligible_for_monetization || false
      };
      
    } catch (error) {
      console.warn('⚠️ View query error:', error);
      return null;
    }
  };

  // ✅ ENHANCED: Calculate watch time, avg duration, completion rate from source tables
  CreatorAnalytics.prototype._calculateFromSource = async function(timeRange) {
    const dateFrom = this._getDateFromRange(timeRange);
    
    try {
      // Get all creator's published content
      const { data: contentData, error: contentError } = await this.supabase
        .from('Content')
        .select('id, title, duration')
        .eq('user_id', this.userId)
        .eq('status', 'published');
      
      if (contentError || !contentData?.length) {
        return this._getEmptyAnalytics();
      }
      
      const contentIds = contentData.map(c => c.id);
      
      // ============================================
      // ✅ CALCULATE WATCH TIME FROM content_views
      // ============================================
      const { data: viewsData } = await this.supabase
        .from('content_views')
        .select('view_duration, viewer_id, content_id')
        .in('content_id', contentIds)
        .gte('created_at', dateFrom);
      
      const totalViews = viewsData?.length || 0;
      const totalWatchTime = viewsData?.reduce((sum, v) => sum + (v.view_duration || 0), 0) || 0;
      const avgWatchTime = totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0;
      
      // Unique viewers
      const uniqueViewers = viewsData 
        ? [...new Set(viewsData.map(v => v.viewer_id).filter(Boolean))].length 
        : 0;
      
      // ============================================
      // ✅ CALCULATE COMPLETION RATE FROM watch_progress
      // ============================================
      const { data: progressData } = await this.supabase
        .from('watch_progress')
        .select('last_position, content_id')
        .in('content_id', contentIds)
        .gte('updated_at', dateFrom);
      
      // Calculate completion rate: (last_position / content_duration) * 100
      let totalCompletion = 0;
      let completionCount = 0;
      
      if (progressData?.length) {
        for (const progress of progressData) {
          const content = contentData.find(c => c.id === progress.content_id);
          if (content?.duration > 0) {
            const completion = Math.min(100, (progress.last_position / content.duration) * 100);
            totalCompletion += completion;
            completionCount++;
          }
        }
      }
      
      const avgCompletionRate = completionCount > 0 
        ? Math.round(totalCompletion / completionCount) 
        : 0;
      
      // ============================================
      // ✅ CALCULATE EARNINGS & CONNECTORS
      // ============================================
      const totalEarnings = totalViews * 0.01; // R0.01 per view
      
      const { count: connectorsCount } = await this.supabase
        .from('connectors')
        .select('*', { count: 'exact', head: true })
        .eq('connected_id', this.userId)
        .eq('connection_type', 'creator');
      
      // ============================================
      // ✅ RETURN COMPLETE ANALYTICS OBJECT
      // ============================================
      return {
        totalUploads: contentData.length,
        totalViews: totalViews,
        totalWatchTime: totalWatchTime,        // ✅ NEW: Total watch time in seconds
        avgWatchTime: avgWatchTime,            // ✅ NEW: Average watch time in seconds
        uniqueViewers: uniqueViewers,          // ✅ NEW: Unique viewer count
        avgCompletionRate: avgCompletionRate,  // ✅ NEW: Average completion percentage
        totalEarnings: totalEarnings,
        totalConnectors: connectorsCount || 0,
        engagementPercentage: contentData.length > 0 
          ? Math.round((totalViews / contentData.length) * 100) 
          : 0,
        isEligibleForMonetization: contentData.length >= 10 && totalViews >= 1000
      };
      
    } catch (error) {
      console.error('❌ Calculate from source failed:', error);
      return this._getEmptyAnalytics();
    }
  };

  // ============================================
  // ✅ FIXED: Get content list with proper Supabase query
  // ============================================
  CreatorAnalytics.prototype._getContentList = async function(timeRange) {
    const dateFrom = this._getDateFromRange(timeRange);
    
    try {
      // Step 1: Get creator's published content IDs first
      const { data: contentData, error: contentError } = await this.supabase
        .from('Content')
        .select('id, title, thumbnail_url, duration, created_at, views_count')
        .eq('user_id', this.userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (contentError) {
        console.warn('⚠️ Could not fetch content list:', contentError);
        return [];
      }
      
      if (!contentData || contentData.length === 0) {
        return [];
      }
      
      // Step 2: Extract content IDs as an array
      const contentIds = contentData.map(c => c.id);
      
      // Step 3: Fetch view analytics for these specific content IDs
      const { data: viewsData, error: viewsError } = await this.supabase
        .from('content_views')
        .select('content_id, view_duration, viewer_id, created_at')
        .in('content_id', contentIds)  // ✅ Pass array, not SQL string
        .gte('created_at', dateFrom);
      
      if (viewsError) {
        console.warn('⚠️ Could not fetch views:', viewsError);
        // Return content without view enrichment if views query fails
        return contentData.map(item => ({
          ...item,
          analytics: {
            totalViews: item.views_count || 0,
            totalWatchTime: 0,
            avgWatchTime: 0,
            avgCompletionRate: 0
          }
        }));
      }
      
      // Step 4: Aggregate view data by content_id
      const viewsByContent = {};
      (viewsData || []).forEach(view => {
        if (!viewsByContent[view.content_id]) {
          viewsByContent[view.content_id] = {
            totalViews: 0,
            totalWatchTime: 0,
            viewerIds: new Set()
          };
        }
        viewsByContent[view.content_id].totalViews++;
        viewsByContent[view.content_id].totalWatchTime += view.view_duration || 0;
        if (view.viewer_id) {
          viewsByContent[view.content_id].viewerIds.add(view.viewer_id);
        }
      });
      
      // Step 5: Enrich content with analytics
      const enrichedContent = contentData.map(item => {
        const views = viewsByContent[item.id] || { totalViews: 0, totalWatchTime: 0, viewerIds: new Set() };
        const avgWatchTime = views.totalViews > 0 
          ? Math.round(views.totalWatchTime / views.totalViews) 
          : 0;
        const avgCompletionRate = item.duration > 0 
          ? Math.round((avgWatchTime / item.duration) * 100) 
          : 0;
        
        return {
          ...item,
          analytics: {
            totalViews: views.totalViews,
            uniqueViewers: views.viewerIds.size,
            totalWatchTime: views.totalWatchTime,
            avgWatchTime: avgWatchTime,
            avgCompletionRate: Math.min(100, avgCompletionRate) // Cap at 100%
          }
        };
      });
      
      // Step 6: Sort by views (descending) and return
      return enrichedContent.sort((a, b) => b.analytics.totalViews - a.analytics.totalViews);
      
    } catch (error) {
      console.error('❌ Get content list failed:', error);
      return [];
    }
  };

  CreatorAnalytics.prototype._getContentViews = async function(contentId) {
    try {
      const { data, error } = await this.supabase
        .from('content_views')
        .select('view_duration, viewer_id')
        .eq('content_id', contentId);
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const unique = [...new Set(data?.map(d => d.viewer_id).filter(Boolean))].length;
      const totalWatchTime = data?.reduce((sum, d) => sum + (d.view_duration || 0), 0) || 0;
      const avgWatchTime = total > 0 ? Math.round(totalWatchTime / total) : 0;
      
      // Get content duration for completion rate
      const { data: contentData } = await this.supabase
        .from('Content')
        .select('duration')
        .eq('id', contentId)
        .single();
      
      // Get watch progress for completion rate
      let avgCompletionRate = 0;
      if (contentData?.duration > 0) {
        const { data: progressData } = await this.supabase
          .from('watch_progress')
          .select('last_position')
          .eq('content_id', contentId);
        
        if (progressData?.length) {
          const totalCompletion = progressData.reduce((sum, p) => {
            return sum + Math.min(100, (p.last_position / contentData.duration) * 100);
          }, 0);
          avgCompletionRate = Math.round(totalCompletion / progressData.length);
        }
      }
      
      return {
        total,
        unique,
        totalWatchTime,
        avgWatchTime,
        avgCompletionRate
      };
    } catch (error) {
      console.error('❌ Get content views failed:', error);
      return { total: 0, unique: 0, totalWatchTime: 0, avgWatchTime: 0, avgCompletionRate: 0 };
    }
  };

  CreatorAnalytics.prototype._getContentEngagement = async function(contentId) {
    try {
      const [likes, comments, shares, favorites] = await Promise.all([
        this.supabase.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
        this.supabase.from('comments').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
        this.supabase.from('content_shares').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
        this.supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('content_id', contentId)
      ]);
      
      return {
        likes: likes.count || 0,
        comments: comments.count || 0,
        shares: shares.count || 0,
        favorites: favorites.count || 0
      };
    } catch (error) {
      console.error('❌ Get engagement failed:', error);
      return { likes: 0, comments: 0, shares: 0, favorites: 0 };
    }
  };

  // ✅ ENHANCED: Get retention data from watch_progress
  CreatorAnalytics.prototype._getContentRetention = async function(contentId, duration) {
    try {
      if (!duration || duration <= 0) {
        return { retentionCurve: [], dropOffPoints: [] };
      }
      
      // Get all watch progress for this content
      const { data: progressData } = await this.supabase
        .from('watch_progress')
        .select('last_position')
        .eq('content_id', contentId);
      
      if (!progressData?.length) {
        return { retentionCurve: [], dropOffPoints: [] };
      }
      
      // Create retention curve at 10% intervals
      const intervals = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const retention = intervals.map(percent => {
        const threshold = (percent / 100) * duration;
        const viewersBeyond = progressData.filter(p => p.last_position >= threshold).length;
        return Math.round((viewersBeyond / progressData.length) * 100);
      });
      
      // Calculate drop-off points (where retention drops significantly)
      const dropOffPoints = [];
      for (let i = 1; i < retention.length; i++) {
        if (retention[i-1] - retention[i] > 15) {
          dropOffPoints.push(intervals[i]);
        }
      }
      
      return {
        retentionCurve: retention,
        dropOffPoints
      };
    } catch (error) {
      console.error('❌ Get retention failed:', error);
      return { retentionCurve: [], dropOffPoints: [] };
    }
  };

  CreatorAnalytics.prototype._getDateFromRange = function(timeRange) {
    const now = new Date();
    switch(timeRange) {
      case '7days': return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30days': return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90days': return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  CreatorAnalytics.prototype._getTimeRangeLabel = function(timeRange) {
    const labels = {
      '7days': 'Last 7 Days',
      '30days': 'Last 30 Days',
      '90days': 'Last 90 Days'
    };
    return labels[timeRange] || 'Last 30 Days';
  };

  CreatorAnalytics.prototype._getEmptyAnalytics = function() {
    return {
      totalUploads: 0,
      totalViews: 0,
      totalWatchTime: 0,
      avgWatchTime: 0,
      uniqueViewers: 0,
      avgCompletionRate: 0,
      totalEarnings: 0,
      totalConnectors: 0,
      engagementPercentage: 0,
      isEligibleForMonetization: false
    };
  };

  // ✅ ENHANCED: Generate CSV with all metrics
  CreatorAnalytics.prototype._generateCSV = function(dashboardData, topContent) {
    const csvRows = [];
    const summary = dashboardData?.summary || {};
    
    // Add summary section
    csvRows.push('Analytics Summary');
    csvRows.push(`Total Views,${summary.totalViews || 0}`);
    csvRows.push(`Total Watch Time (hrs),${Math.round((summary.totalWatchTime || 0) / 3600 * 100) / 100}`);
    csvRows.push(`Average Watch Time (min),${Math.round((summary.avgWatchTime || 0) / 60 * 10) / 10}`);
    csvRows.push(`Unique Viewers,${summary.uniqueViewers || 0}`);
    csvRows.push(`Average Completion Rate,${summary.avgCompletionRate || 0}%`);
    csvRows.push(`Total Earnings,R${(summary.totalEarnings || 0).toFixed(2)}`);
    csvRows.push(`Total Connectors,${summary.totalConnectors || 0}`);
    csvRows.push('');
    
    // Add content section headers
    csvRows.push('Content Performance');
    csvRows.push('Content ID,Title,Views,Watch Time (hrs),Avg Duration (min),Completion Rate,Engagement');
    
    // Add content rows
    (topContent || []).forEach(item => {
      csvRows.push([
        item.content_id,
        `"${(item.Content?.title || 'Untitled').replace(/"/g, '""')}"`,
        item.totalViews || 0,
        ((item.totalWatchTime || 0) / 3600).toFixed(2),
        ((item.avgWatchTime || 0) / 60).toFixed(1),
        `${item.avgCompletionRate || 0}%`,
        item.uniqueViewers || 0
      ].join(','));
    });
    
    return csvRows.join('\n');
  };

  CreatorAnalytics.prototype._isCacheValid = function(key) {
    const lastFetch = this._lastFetch[key];
    if (!lastFetch) return false;
    return Date.now() - lastFetch < this._cacheDuration;
  };

  CreatorAnalytics.prototype._handleError = function(context, error) {
    console.error(`❌ CreatorAnalytics error [${context}]:`, error);
    if (this.onError) {
      this.onError({ context, error: error.message || error });
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
