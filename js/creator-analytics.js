// js/creator-analytics.js — Complete Creator Analytics Class with CSV Export
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Correctly queries your actual Content, content_views, and watch_progress tables

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
      if (!config) {
        console.error('❌ CreatorAnalytics: Missing config object');
        return;
      }
      
      // Support both constructor patterns
      let supabaseClient, userId, options = {};
      if (arguments.length === 2 && arguments[0] && arguments[1]) {
        supabaseClient = arguments[0];
        userId = arguments[1];
        console.log('📊 Using legacy constructor pattern');
      } else {
        supabaseClient = config.supabase || config.supabaseClient;
        userId = config.userId || config.creatorId;
        options = config;
      }
      
      // Initialize Supabase client
      this.supabase = supabaseClient ||
        window.supabaseClient ||
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
      
      // Cache
      this.cache = new Map();
      this.cacheTTL = options.cacheTTL || 5 * 60 * 1000;
      
      // Callbacks
      this.onDataLoaded = options.onDataLoaded || null;
      this.onError = options.onError || null;
      
      // Fetch queue
      this._fetchQueue = new Map();
      this._isFetching = false;
      
      console.log('✅ CreatorAnalytics initialized for user: ' + (this.userId || 'guest'));
    }
    
    // ============================================
    // ✅ GET FULL DASHBOARD DATA
    // ============================================
    async getDashboardData(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');
      
      const cacheKey = `dashboard_${timeRange}`;
      const cached = this._getCache(cacheKey);
      if (cached) return cached;
      
      return this._queueRequest('dashboard_' + timeRange, async () => {
        try {
          console.log('📊 Fetching dashboard data for range:', timeRange);
          
          // Get summary from materialized view
          const summary = await this._getFromMaterializedView();
          
          // Get content list with REAL analytics from content_views
          let content = [];
          try {
            content = await this.getContentList(timeRange, 'views', 50);
          } catch (e) {
            console.warn('⚠️ Could not fetch content list:', e.message);
            content = [];
          }
          
          const result = {
            summary,
            content,
            timeRange,
            timestamp: new Date().toISOString()
          };
          
          this._setCache(cacheKey, result);
          
          if (this.onDataLoaded) {
            this.onDataLoaded(result);
          }
          
          return result;
        } catch (error) {
          console.error('❌ Error fetching dashboard data:', error);
          if (this.onError) this.onError(error);
          return {
            summary: this._getEmptySummary(),
            content: [],
            timeRange,
            error: error.message
          };
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
          
          // Enrich with watch time data from content_views
          const enrichedData = await this._enrichSummaryWithWatchTime(data);
          return enrichedData;
        }
        
        return null;
      } catch (error) {
        console.warn('⚠️ Materialized view not available:', error);
        return await this._calculateSummary();
      }
    }
    
    // ============================================
    // ✅ ENRICH SUMMARY WITH WATCH TIME
    // ============================================
    async _enrichSummaryWithWatchTime(summary) {
      try {
        const dateFilter = this._getDateFilter('30days');
        
        // Get all content IDs for this user
        const { data: content, error: contentError } = await this.supabase
          .from('Content')
          .select('id, duration')
          .eq('user_id', this.userId);
        
        if (contentError || !content || content.length === 0) {
          return {
            ...summary,
            total_watch_time: 0,
            avg_completion_rate: 0
          };
        }
        
        const contentIds = content.map(c => c.id);
        
        // Get watch time from content_views table
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('view_duration, content_id')
          .in('content_id', contentIds)
          .gte('viewed_at', dateFilter);
        
        if (viewsError) throw viewsError;
        
        const totalWatchTime = views?.reduce((sum, v) => sum + (v.view_duration || 0), 0) || 0;
        
        // Calculate average completion rate from watch_progress
        const { data: progress } = await this.supabase
          .from('watch_progress')
          .select('last_position, content_id')
          .in('content_id', contentIds)
          .eq('user_id', this.userId);
        
        let avgCompletionRate = 0;
        if (progress && progress.length > 0 && content.length > 0) {
          const contentDurationMap = {};
          content.forEach(c => {
            contentDurationMap[c.id] = c.duration || 0;
          });
          
          const totalCompletion = progress.reduce((sum, p) => {
            const duration = contentDurationMap[p.content_id] || 0;
            if (duration > 0) {
              return sum + Math.min(100, (p.last_position / duration) * 100);
            }
            return sum;
          }, 0);
          
          avgCompletionRate = totalCompletion / progress.length;
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
    // ✅ CALCULATE SUMMARY (Fallback)
    // ============================================
    async _calculateSummary() {
      const dateFilter = this._getDateFilter('30days');
      
      // Get all content for this creator
      const { data: content, error: contentError } = await this.supabase
        .from('Content')
        .select('id, duration, views_count, likes_count, comments_count')
        .eq('user_id', this.userId);
      
      if (contentError || !content || content.length === 0) {
        return this._getEmptySummary();
      }
      
      const contentIds = content.map(c => c.id);
      
      // Get views from content_views
      const { data: viewsData } = await this.supabase
        .from('content_views')
        .select('content_id, viewer_id, view_duration')
        .in('content_id', contentIds)
        .gte('viewed_at', dateFilter);
      
      const totalViews = viewsData?.length || 0;
      const uniqueViewers = new Set(viewsData?.map(v => v.viewer_id) || []).size;
      const totalWatchTime = viewsData?.reduce((sum, v) => sum + (v.view_duration || 0), 0) || 0;
      
      // Calculate totals from Content table
      const totalLikes = content.reduce((sum, c) => sum + (c.likes_count || 0), 0);
      const totalComments = content.reduce((sum, c) => sum + (c.comments_count || 0), 0);
      
      // Get connectors
      const { count: connectorsCount } = await this.supabase
        .from('connectors')
        .select('*', { count: 'exact', head: true })
        .eq('connected_id', this.userId)
        .eq('connection_type', 'creator');
      
      // Calculate engagement
      const engagementPercentage = totalViews > 0
        ? ((totalLikes + totalComments) / totalViews) * 100
        : 0;
      
      // Calculate completion rate
      let avgCompletionRate = 0;
      if (viewsData && viewsData.length > 0 && content.length > 0) {
        const viewsByContent = {};
        viewsData.forEach(view => {
          if (!viewsByContent[view.content_id]) {
            viewsByContent[view.content_id] = { totalWatchTime: 0, viewCount: 0 };
          }
          viewsByContent[view.content_id].totalWatchTime += view.view_duration || 0;
          viewsByContent[view.content_id].viewCount++;
        });
        
        let totalCompletion = 0;
        let validContentCount = 0;
        content.forEach(item => {
          const contentViews = viewsByContent[item.id];
          if (contentViews && item.duration > 0) {
            const avgWatchTimePerView = contentViews.totalWatchTime / contentViews.viewCount;
            const completionRate = (avgWatchTimePerView / item.duration) * 100;
            totalCompletion += Math.min(100, completionRate);
            validContentCount++;
          }
        });
        avgCompletionRate = validContentCount > 0 ? totalCompletion / validContentCount : 0;
      }
      
      return {
        creator_id: this.userId,
        total_uploads: content.length,
        total_views: totalViews,
        total_watch_time: totalWatchTime,
        unique_viewers: uniqueViewers,
        total_likes: totalLikes,
        total_comments: totalComments,
        total_connectors: connectorsCount || 0,
        total_earnings: 0,
        engagement_percentage: Math.round(engagementPercentage * 100) / 100,
        avg_completion_rate: Math.round(avgCompletionRate * 100) / 100,
        is_eligible_for_monetization: content.length >= 10 && totalViews >= 1000,
        calculated_at: new Date().toISOString()
      };
    }
    
    // ============================================
    // ✅ GET CONTENT LIST WITH ANALYTICS
    // ============================================
    async getContentList(timeRange = '30days', sortBy = 'views', limit = 10) {
      if (!this.userId) throw new Error('User not authenticated');
      
      const cacheKey = `content_${timeRange}_${sortBy}_${limit}`;
      const cached = this._getCache(cacheKey);
      if (cached) return cached;
      
      return this._queueRequest('content_' + timeRange + '_' + sortBy, async () => {
        try {
          console.log('📊 Fetching content list for user:', this.userId);
          const dateFilter = this._getDateFilter(timeRange);
          
          // Get all content for this creator - Using user_id
          const { data: content, error: contentError } = await this.supabase
            .from('Content')
            .select('id, title, created_at, duration, thumbnail_url, views_count, likes_count, comments_count, user_id')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: false });
          
          if (contentError) {
            console.error('❌ Content fetch error:', contentError);
            throw contentError;
          }
          
          console.log(`📊 Found ${content?.length || 0} content items for user`);
          
          if (!content || content.length === 0) {
            console.log('📊 No content found for this creator');
            return [];
          }
          
          const contentIds = content.map(c => c.id);
          console.log('📊 Content IDs:', contentIds);
          
          // Get view analytics from content_views for the time period
          const { data: views, error: viewsError } = await this.supabase
            .from('content_views')
            .select('content_id, viewer_id, view_duration')
            .in('content_id', contentIds)
            .gte('viewed_at', dateFilter);
          
          if (viewsError) {
            console.warn('⚠️ Error fetching views:', viewsError);
            return content.map(item => ({
              ...item,
              analytics: {
                totalViews: item.views_count || 0,
                uniqueViewers: 0,
                totalWatchTime: 0,
                avgWatchTime: 0,
                avgCompletionRate: 0,
                totalLikes: item.likes_count || 0,
                totalComments: item.comments_count || 0,
                engagementRate: 0
              }
            }));
          }
          
          console.log(`📊 Found ${views?.length || 0} view records for time range`);
          
          // Group views by content
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
            viewsByContent[view.content_id].totalWatchTime += view.view_duration || 0;
          });
          
          // Get completion rates from watch_progress
          const { data: progress } = await this.supabase
            .from('watch_progress')
            .select('content_id, last_position')
            .in('content_id', contentIds)
            .eq('user_id', this.userId);
          
          const progressByContent = {};
          if (progress) {
            progress.forEach(p => {
              if (!progressByContent[p.content_id]) {
                progressByContent[p.content_id] = { totalPosition: 0, count: 0 };
              }
              progressByContent[p.content_id].totalPosition += p.last_position || 0;
              progressByContent[p.content_id].count++;
            });
          }
          
          // Calculate analytics for each content item
          const contentWithAnalytics = content.map(item => {
            const viewsData = viewsByContent[item.id] || {
              totalViews: 0,
              uniqueViewers: new Set(),
              totalWatchTime: 0
            };
            
            const avgWatchTime = viewsData.totalViews > 0
              ? viewsData.totalWatchTime / viewsData.totalViews
              : 0;
            
            // Calculate completion rate
            let avgCompletionRate = 0;
            if (item.duration && item.duration > 0) {
              const progressData = progressByContent[item.id];
              if (progressData && progressData.count > 0) {
                const avgPosition = progressData.totalPosition / progressData.count;
                avgCompletionRate = (avgPosition / item.duration) * 100;
              } else if (avgWatchTime > 0) {
                avgCompletionRate = (avgWatchTime / item.duration) * 100;
              }
            }
            
            // Calculate engagement rate
            const totalEngagements = (item.likes_count || 0) + (item.comments_count || 0);
            const engagementRate = viewsData.totalViews > 0
              ? (totalEngagements / viewsData.totalViews) * 100
              : 0;
            
            return {
              ...item,
              analytics: {
                totalViews: viewsData.totalViews || item.views_count || 0,
                uniqueViewers: viewsData.uniqueViewers.size,
                totalWatchTime: Math.round(viewsData.totalWatchTime),
                avgWatchTime: Math.round(avgWatchTime * 100) / 100,
                avgCompletionRate: Math.min(100, Math.round(avgCompletionRate * 100) / 100),
                totalLikes: item.likes_count || 0,
                totalComments: item.comments_count || 0,
                engagementRate: Math.round(engagementRate * 100) / 100
              }
            };
          });
          
          // Sort based on criteria
          const sorted = this._sortContent(contentWithAnalytics, sortBy);
          const result = sorted.slice(0, limit);
          
          console.log(`📊 Returning ${result.length} content items with analytics`);
          if (result.length > 0) {
            console.log('📊 First item sample:', {
              id: result[0].id,
              title: result[0].title,
              views: result[0].analytics?.totalViews,
              watchTime: result[0].analytics?.totalWatchTime,
              avgDuration: result[0].analytics?.avgWatchTime,
              completionRate: result[0].analytics?.avgCompletionRate,
              engagementRate: result[0].analytics?.engagementRate
            });
          }
          
          this._setCache(cacheKey, result);
          return result;
          
        } catch (error) {
          console.error('❌ Error fetching content list:', error);
          return [];
        }
      });
    }
    
    // ============================================
    // ✅ HELPER: Sort content by metric
    // ============================================
    _sortContent(content, sortBy) {
      return [...content].sort((a, b) => {
        const aAnalytics = a.analytics || {};
        const bAnalytics = b.analytics || {};
        switch (sortBy) {
          case 'views':
            return (bAnalytics.totalViews || 0) - (aAnalytics.totalViews || 0);
          case 'watchTime':
            return (bAnalytics.totalWatchTime || 0) - (aAnalytics.totalWatchTime || 0);
          case 'completion':
            return (bAnalytics.avgCompletionRate || 0) - (aAnalytics.avgCompletionRate || 0);
          case 'engagement':
            return (bAnalytics.engagementRate || 0) - (aAnalytics.engagementRate || 0);
          default:
            return (bAnalytics.totalViews || 0) - (aAnalytics.totalViews || 0);
        }
      });
    }
    
    // ============================================
    // ✅ HELPER: Get date filter
    // ============================================
    _getDateFilter(timeRange) {
      const now = new Date();
      let days = 30;
      switch (timeRange) {
        case '7days': days = 7; break;
        case '30days': days = 30; break;
        case '90days': days = 90; break;
        default: days = 30;
      }
      const date = new Date(now);
      date.setDate(date.getDate() - days);
      date.setHours(0, 0, 0, 0);
      console.log(`📊 Date filter for ${timeRange}: ${date.toISOString()}`);
      return date.toISOString();
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
        total_connectors: 0,
        total_earnings: 0,
        engagement_percentage: 0,
        avg_completion_rate: 0,
        is_eligible_for_monetization: false,
        calculated_at: new Date().toISOString()
      };
    }
    
    // ============================================
    // ✅ HELPER: Cache management
    // ============================================
    _getCache(key) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
      return null;
    }
    
    _setCache(key, data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }
    
    // ============================================
    // ✅ FETCH QUEUE SYSTEM
    // ============================================
    _queueRequest(key, fn) {
      if (this._fetchQueue.has(key)) {
        console.log(`⏳ Waiting for existing ${key} request...`);
        return this._fetchQueue.get(key);
      }
      
      const promise = fn().finally(() => {
        this._fetchQueue.delete(key);
      });
      
      this._fetchQueue.set(key, promise);
      return promise;
    }
    
    // ============================================
    // ✅ CLEAR CACHE
    // ============================================
    clearCache() {
      this.cache.clear();
      this._fetchQueue.clear();
      console.log('🧹 Analytics cache cleared');
    }
    
    // ============================================
    // ✅ EXPORT TO CSV
    // ============================================
    async exportToCSV(timeRange = '30days', includeContent = true) {
      if (!this.userId) throw new Error('User not authenticated');
      
      try {
        console.log('📊 Exporting analytics for time range:', timeRange);
        
        const summary = await this._getFromMaterializedView() || await this._calculateSummary();
        const content = includeContent ? await this.getContentList(timeRange, 'views', 100) : [];
        
        const rows = [];
        
        // Header
        rows.push(['Bantu Stream Connect - Analytics Export']);
        rows.push(['Generated:', new Date().toISOString()]);
        rows.push(['Time Range:', this._getTimeRangeLabel(timeRange)]);
        rows.push(['Creator ID:', this.userId]);
        rows.push([]);
        
        // Summary Metrics
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
        rows.push(['Engagement Rate (%)', summary?.engagement_percentage || 0]);
        rows.push(['Total Connectors', summary?.total_connectors || 0]);
        rows.push(['Monetization Eligible', summary?.is_eligible_for_monetization ? 'Yes' : 'No']);
        rows.push([]);
        
        // Content Performance
        if (includeContent && content.length > 0) {
          rows.push(['=== CONTENT PERFORMANCE ===']);
          rows.push([
            'Content ID',
            'Title',
            'Published Date',
            'Duration (seconds)',
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
              `"${(item.title || 'Untitled').replace(/"/g, '""')}"`,
              item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
              item.duration || 0,
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
          rows.push([]);
        }
        
        // Convert to CSV
        const csv = rows.map(row => {
          return row.map(field => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',');
        }).join('\r\n');
        
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `bantu-analytics-${timeRange}-${dateStr}.csv`;
        
        console.log('✅ CSV export generated:', filename);
        return { csv, filename };
        
      } catch (error) {
        console.error('❌ CSV export failed:', error);
        throw error;
      }
    }
    
    _getTimeRangeLabel(timeRange) {
      switch (timeRange) {
        case '7days': return 'Last 7 Days';
        case '30days': return 'Last 30 Days';
        case '90days': return 'Last 90 Days';
        default: return 'Last 30 Days';
      }
    }
  }
  
  // Make available globally
  window.CreatorAnalytics = CreatorAnalytics;
  window._creatorAnalyticsLoading = false;
  
  console.log('✅ CreatorAnalytics module loaded successfully');
})();
