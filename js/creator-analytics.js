// js/creator-analytics.js — Complete Creator Analytics Class with CSV Export
// Bantu Stream Connect — Phase 5B Implementation
// ✅ FIXED: Proper constructor initialization, field mapping, and error handling

(function() {
  'use strict';
  
  console.log('📊 CreatorAnalytics module loading...');

  class CreatorAnalytics {
    constructor(config) {
      // Handle both object config and legacy parameters
      if (!config) {
        console.error('❌ CreatorAnalytics: Missing config object');
        return;
      }
      
      // Support both constructor patterns:
      // new CreatorAnalytics(config) OR new CreatorAnalytics(supabaseClient, userId)
      let supabaseClient, userId, options = {};
      
      if (arguments.length === 2 && arguments[0] && arguments[1]) {
        // Legacy: CreatorAnalytics(supabaseClient, userId)
        supabaseClient = arguments[0];
        userId = arguments[1];
        console.log('📊 Using legacy constructor pattern');
      } else {
        // New: CreatorAnalytics(config)
        supabaseClient = config.supabase || config.supabaseClient;
        userId = config.userId || config.creatorId;
        options = config;
      }
      
      // Try multiple possible supabase client locations
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
      this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
      
      // Callbacks
      this.onDataLoaded = options.onDataLoaded || null;
      this.onError = options.onError || null;
      
      console.log('✅ CreatorAnalytics initialized for user: ' + (this.userId || 'guest'));
    }

    // ============================================
    // ✅ INITIALIZATION & AUTHENTICATION
    // ============================================
    static async init(supabaseClient) {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError || !user) {
          console.log('⚠️ No authenticated user found');
          return null;
        }

        // Verify creator status
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error('❌ Could not verify creator status:', profileError);
          return null;
        }

        if (profile.role !== 'creator' && profile.role !== 'admin') {
          console.log('⚠️ User is not a creator');
          return null;
        }

        console.log('✅ CreatorAnalytics initialized for user:', user.id);
        return new CreatorAnalytics(supabaseClient, user.id);

      } catch (error) {
        console.error('❌ Failed to initialize CreatorAnalytics:', error);
        return null;
      }
    }

    // ============================================
    // ✅ DASHBOARD SUMMARY FROM MATERIALIZED VIEW
    // ============================================
    async getDashboardSummary(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');

      const cacheKey = `summary_${timeRange}`;
      const cached = this._getCache(cacheKey);
      if (cached) return cached;

      try {
        // First try materialized view (fastest)
        let summary = await this._getFromMaterializedView();

        // If materialized view not ready, calculate on the fly
        if (!summary) {
          summary = await this._calculateSummary(timeRange);
        }

        // Add monetization status
        summary.is_eligible_for_monetization = await this._checkMonetizationEligibility();

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
    }

    // ============================================
    // ✅ GET FULL DASHBOARD DATA (Summary + Content)
    // ============================================
    async getDashboardData(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');
      
      try {
        console.log('📊 Fetching dashboard data for range:', timeRange);
        
        // Get summary
        const summary = await this.getDashboardSummary(timeRange);
        
        // Get content list with analytics
        const content = await this.getContentList(timeRange, 'views', 50);
        
        const result = {
          summary,
          content,
          timeRange,
          timestamp: new Date().toISOString()
        };
        
        // Trigger callback
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
        return data || null;

      } catch (error) {
        console.warn('⚠️ Materialized view not available, falling back to calculation:', error);
        return null;
      }
    }

    // ============================================
    // ✅ CALCULATE SUMMARY ON THE FLY
    // ============================================
    async _calculateSummary(timeRange) {
      const dateFilter = this._getDateFilter(timeRange);

      // Get all content for this creator
      const { data: content, error: contentError } = await this.supabase
        .from('content')
        .select('id, duration')
        .eq('creator_id', this.userId);

      if (contentError) throw contentError;

      const contentIds = content.map(c => c.id);
      if (contentIds.length === 0) {
        return this._getEmptySummary();
      }

      // Get total views and unique viewers
      const { data: viewsData, error: viewsError } = await this.supabase
        .from('content_views')
        .select('content_id, viewer_id, watch_time, viewed_at')
        .in('content_id', contentIds)
        .gte('viewed_at', dateFilter);

      if (viewsError) throw viewsError;

      // Calculate metrics
      const totalViews = viewsData.length;
      const uniqueViewers = new Set(viewsData.map(v => v.viewer_id)).size;
      const totalWatchTime = viewsData.reduce((sum, v) => sum + (v.watch_time || 0), 0);
      
      // Get total connectors (unique users who engaged)
      const { count: connectorsCount, error: connectorsError } = await this.supabase
        .from('content_views')
        .select('viewer_id', { count: 'exact', head: true })
        .in('content_id', contentIds)
        .gte('viewed_at', dateFilter)
        .eq('is_connector', true);

      if (connectorsError) throw connectorsError;

      // Get total earnings
      const { data: earnings, error: earningsError } = await this.supabase
        .from('creator_earnings')
        .select('amount')
        .eq('creator_id', this.userId)
        .gte('created_at', dateFilter);

      if (earningsError) throw earningsError;

      const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Calculate engagement percentage
      const engagementPercentage = totalViews > 0 
        ? ((connectorsCount || 0) / totalViews) * 100 
        : 0;

      // Calculate average completion rate
      let avgCompletionRate = 0;
      if (totalViews > 0 && content.length > 0) {
        const totalPossibleWatchTime = content.reduce((sum, c) => sum + (c.duration || 0), 0) * totalViews;
        avgCompletionRate = totalPossibleWatchTime > 0 
          ? (totalWatchTime / totalPossibleWatchTime) * 100 
          : 0;
      }

      return {
        creator_id: this.userId,
        total_uploads: content.length,
        total_views: totalViews,
        total_watch_time: totalWatchTime,
        unique_viewers: uniqueViewers,
        total_connectors: connectorsCount || 0,
        avg_completion_rate: Math.round(avgCompletionRate * 100) / 100,
        total_earnings: totalEarnings,
        engagement_percentage: Math.round(engagementPercentage * 100) / 100,
        calculated_at: new Date().toISOString()
      };
    }

    // ============================================
    // ✅ CHECK MONETIZATION ELIGIBILITY
    // ============================================
    async _checkMonetizationEligibility() {
      try {
        const { data, error } = await this.supabase
          .rpc('check_monetization_eligibility', {
            p_creator_id: this.userId
          });

        if (error) throw error;
        return data || false;

      } catch (error) {
        console.warn('⚠️ Could not check monetization eligibility:', error);
        return false;
      }
    }

    // ============================================
    // ✅ GET CONTENT LIST WITH ANALYTICS
    // ============================================
    async getContentList(timeRange = '30days', sortBy = 'views', limit = 10) {
      if (!this.userId) throw new Error('User not authenticated');

      const cacheKey = `content_${timeRange}_${sortBy}_${limit}`;
      const cached = this._getCache(cacheKey);
      if (cached) return cached;

      try {
        const dateFilter = this._getDateFilter(timeRange);

        // Get all content
        const { data: content, error: contentError } = await this.supabase
          .from('content')
          .select('id, title, created_at, duration, thumbnail_url, views_count')
          .eq('creator_id', this.userId)
          .order('created_at', { ascending: false });

        if (contentError) throw contentError;

        if (content.length === 0) {
          return [];
        }

        const contentIds = content.map(c => c.id);

        // Get view analytics for this period
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('content_id, viewer_id, watch_time')
          .in('content_id', contentIds)
          .gte('viewed_at', dateFilter);

        if (viewsError) throw viewsError;

        // Group views by content
        const viewsByContent = {};
        views.forEach(view => {
          if (!viewsByContent[view.content_id]) {
            viewsByContent[view.content_id] = {
              totalViews: 0,
              uniqueViewers: new Set(),
              totalWatchTime: 0,
              avgWatchTime: 0
            };
          }
          viewsByContent[view.content_id].totalViews++;
          viewsByContent[view.content_id].uniqueViewers.add(view.viewer_id);
          viewsByContent[view.content_id].totalWatchTime += view.watch_time || 0;
        });

        // Calculate averages and completion rates
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

          return {
            ...item,
            analytics: {
              totalViews: analytics.totalViews,
              uniqueViewers: analytics.uniqueViewers.size,
              totalWatchTime: analytics.totalWatchTime,
              avgWatchTime: Math.round(avgWatchTime * 100) / 100,
              avgCompletionRate: Math.round(avgCompletionRate * 100) / 100
            }
          };
        });

        // Sort based on criteria
        const sorted = this._sortContent(contentWithAnalytics, sortBy);
        
        // Apply limit
        const result = sorted.slice(0, limit);
        
        this._setCache(cacheKey, result);
        return result;

      } catch (error) {
        console.error('❌ Error fetching content list:', error);
        return [];
      }
    }

    // ============================================
    // ✅ GET WATCH TIME BY DATE
    // ============================================
    async getWatchTimeByDate(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');

      const cacheKey = `watchtime_${timeRange}`;
      const cached = this._getCache(cacheKey);
      if (cached) return cached;

      try {
        const dateFilter = this._getDateFilter(timeRange);

        // Get user's content IDs
        const { data: content, error: contentError } = await this.supabase
          .from('content')
          .select('id')
          .eq('creator_id', this.userId);

        if (contentError) throw contentError;

        if (content.length === 0) {
          return [];
        }

        const contentIds = content.map(c => c.id);

        // Get daily watch time
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('viewed_at, watch_time')
          .in('content_id', contentIds)
          .gte('viewed_at', dateFilter)
          .order('viewed_at');

        if (viewsError) throw viewsError;

        // Group by date
        const dailyData = {};
        views.forEach(view => {
          const date = new Date(view.viewed_at).toISOString().split('T')[0];
          if (!dailyData[date]) {
            dailyData[date] = {
              date,
              views: 0,
              watchTime: 0
            };
          }
          dailyData[date].views++;
          dailyData[date].watchTime += view.watch_time || 0;
        });

        // Convert to array and fill missing dates
        const result = this._fillMissingDates(
          Object.values(dailyData),
          dateFilter,
          new Date().toISOString().split('T')[0]
        );

        this._setCache(cacheKey, result);
        return result;

      } catch (error) {
        console.error('❌ Error fetching watch time by date:', error);
        return [];
      }
    }

    // ============================================
    // ✅ GET TOP CONTENT
    // ============================================
    async getTopContent(timeRange = '30days', metric = 'views', limit = 5) {
      const content = await this.getContentList(timeRange, metric, limit);
      return content;
    }

    // ============================================
    // ✅ GET CONTENT ENGAGEMENT (Helper for export)
    // ============================================
    async _getContentEngagement(contentId) {
      try {
        const [likes, comments, shares] = await Promise.all([
          this.supabase.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
          this.supabase.from('comments').select('*', { count: 'exact', head: true }).eq('content_id', contentId),
          this.supabase.from('content_shares').select('*', { count: 'exact', head: true }).eq('content_id', contentId)
        ]);
        
        return {
          likes: likes.count || 0,
          comments: comments.count || 0,
          shares: shares.count || 0
        };
      } catch (error) {
        console.warn('⚠️ Could not fetch engagement:', error);
        return { likes: 0, comments: 0, shares: 0 };
      }
    }

    // ============================================
    // ✅ EXPORT ANALYTICS TO CSV
    // ============================================
    async exportToCSV(timeRange = '30days', includeContent = true) {
      if (!this.userId) {
        throw new Error('User not authenticated');
      }
      
      try {
        console.log('📊 Exporting analytics for time range:', timeRange);
        
        // Fetch dashboard summary
        const summary = await this._getFromMaterializedView() || await this._calculateSummary(timeRange);
        
        // Fetch content list with analytics
        const content = includeContent ? await this.getContentList(timeRange, 'views', 100) : [];
        
        // Build CSV rows
        const rows = [];
        
        // Header: Report Metadata
        rows.push(['Bantu Stream Connect - Analytics Export']);
        rows.push(['Generated:', new Date().toISOString()]);
        rows.push(['Time Range:', this._getTimeRangeLabel(timeRange)]);
        rows.push(['Creator ID:', this.userId]);
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
        rows.push(['Total Earnings (ZAR)', summary?.total_earnings?.toFixed(2) || '0.00']);
        rows.push(['Total Connectors', summary?.total_connectors || 0]);
        rows.push(['Engagement Percentage (%)', summary?.engagement_percentage?.toFixed(2) || '0.00']);
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
            'Views',
            'Unique Viewers',
            'Total Watch Time (seconds)',
            'Avg. Watch Time (seconds)',
            'Avg. Completion Rate (%)',
            'Likes',
            'Comments',
            'Shares',
            'Earnings (ZAR)'
          ]);
          
          // Enrich content with engagement data
          for (const item of content) {
            const analytics = item.analytics || {};
            const engagement = await this._getContentEngagement(item.id);
            
            const earnings = (analytics.totalViews || 0) * 0.01; // R0.01 per view
            
            rows.push([
              item.id,
              `"${(item.title || 'Untitled').replace(/"/g, '""')}"`, // Escape quotes for CSV
              item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '',
              item.duration || 0,
              analytics.totalViews || 0,
              analytics.uniqueViewers || 0,
              analytics.totalWatchTime || 0,
              analytics.avgWatchTime || 0,
              analytics.avgCompletionRate || 0,
              engagement.likes || 0,
              engagement.comments || 0,
              engagement.shares || 0,
              earnings.toFixed(2)
            ]);
          }
          rows.push([]); // Empty row
        }
        
        // Section: Daily Breakdown (optional)
        rows.push(['=== DAILY VIEW BREAKDOWN ===']);
        rows.push(['Date', 'Views', 'Watch Time (seconds)', 'Watch Time (hours)']);
        
        const dailyData = await this.getWatchTimeByDate(timeRange);
        dailyData.forEach(day => {
          rows.push([
            day.date,
            day.views || 0,
            day.watchTime || 0,
            day.watchTimeHours || 0
          ]);
        });
        
        // Convert rows to CSV string
        const csv = this._convertToCSV(rows);
        
        // Generate filename
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `bantu-analytics-${timeRange}-${dateStr}.csv`;
        
        console.log('✅ CSV export generated:', filename);
        
        return { csv, filename };
        
      } catch (error) {
        console.error('❌ CSV export failed:', error);
        throw error;
      }
    }

    // ============================================
    // ✅ CONVERT ROWS TO CSV STRING (RFC 4180)
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
      }).join('\r\n'); // RFC 4180 uses CRLF line endings
    }

    // ============================================
    // ✅ GET AUDIENCE LOCATIONS
    // ============================================
    async getAudienceLocations(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');

      try {
        const dateFilter = this._getDateFilter(timeRange);

        // Get user's content IDs
        const { data: content, error: contentError } = await this.supabase
          .from('content')
          .select('id')
          .eq('creator_id', this.userId);

        if (contentError) throw contentError;

        if (content.length === 0) {
          return [];
        }

        const contentIds = content.map(c => c.id);

        // Get viewer locations from profiles
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('viewer_id')
          .in('content_id', contentIds)
          .gte('viewed_at', dateFilter);

        if (viewsError) throw viewsError;

        const viewerIds = [...new Set(views.map(v => v.viewer_id))];

        if (viewerIds.length === 0) {
          return [];
        }

        // Get profiles with location data
        const { data: profiles, error: profilesError } = await this.supabase
          .from('profiles')
          .select('country, city')
          .in('id', viewerIds);

        if (profilesError) throw profilesError;

        // Count by country
        const countryCount = {};
        profiles.forEach(p => {
          const country = p.country || 'Unknown';
          countryCount[country] = (countryCount[country] || 0) + 1;
        });

        // Convert to array and calculate percentages
        const total = profiles.length;
        const result = Object.entries(countryCount)
          .map(([country, count]) => ({
            country,
            count,
            percentage: Math.round((count / total) * 100)
          }))
          .sort((a, b) => b.count - a.count);

        return result;

      } catch (error) {
        console.error('❌ Error fetching audience locations:', error);
        return [];
      }
    }

    // ============================================
    // ✅ GET DEVICE BREAKDOWN
    // ============================================
    async getDeviceBreakdown(timeRange = '30days') {
      if (!this.userId) throw new Error('User not authenticated');

      try {
        const dateFilter = this._getDateFilter(timeRange);

        // Get user's content IDs
        const { data: content, error: contentError } = await this.supabase
          .from('content')
          .select('id')
          .eq('creator_id', this.userId);

        if (contentError) throw contentError;

        if (content.length === 0) {
          return [];
        }

        const contentIds = content.map(c => c.id);

        // Get views with device info
        const { data: views, error: viewsError } = await this.supabase
          .from('content_views')
          .select('device_type')
          .in('content_id', contentIds)
          .gte('viewed_at', dateFilter);

        if (viewsError) throw viewsError;

        // Count by device type
        const deviceCount = {};
        views.forEach(v => {
          const device = v.device_type || 'desktop';
          deviceCount[device] = (deviceCount[device] || 0) + 1;
        });

        // Convert to array and calculate percentages
        const total = views.length;
        const result = Object.entries(deviceCount)
          .map(([device, count]) => ({
            device,
            count,
            percentage: Math.round((count / total) * 100)
          }))
          .sort((a, b) => b.count - a.count);

        return result;

      } catch (error) {
        console.error('❌ Error fetching device breakdown:', error);
        return [];
      }
    }

    // ============================================
    // ✅ HELPER: Get date filter based on time range
    // ============================================
    _getDateFilter(timeRange) {
      const now = new Date();
      let days = 30; // default

      switch (timeRange) {
        case '7days':
          days = 7;
          break;
        case '30days':
          days = 30;
          break;
        case '90days':
          days = 90;
          break;
        default:
          days = 30;
      }

      const date = new Date(now.setDate(now.getDate() - days));
      return date.toISOString();
    }

    // ============================================
    // ✅ HELPER: Get time range label
    // ============================================
    _getTimeRangeLabel(timeRange) {
      switch (timeRange) {
        case '7days':
          return 'Last 7 Days';
        case '30days':
          return 'Last 30 Days';
        case '90days':
          return 'Last 90 Days';
        default:
          return 'Last 30 Days';
      }
    }

    // ============================================
    // ✅ HELPER: Fill missing dates in time series
    // ============================================
    _fillMissingDates(data, startDateStr, endDateStr) {
      const result = [];
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      // Create a map of existing data
      const dataMap = {};
      data.forEach(item => {
        dataMap[item.date] = item;
      });

      // Iterate through each day
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (dataMap[dateStr]) {
          // Use existing data
          result.push({
            ...dataMap[dateStr],
            watchTimeHours: Math.round((dataMap[dateStr].watchTime / 3600) * 100) / 100
          });
        } else {
          // Add empty entry
          result.push({
            date: dateStr,
            views: 0,
            watchTime: 0,
            watchTimeHours: 0
          });
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return result;
    }

    // ============================================
    // ✅ HELPER: Sort content by metric
    // ============================================
    _sortContent(content, sortBy) {
      return [...content].sort((a, b) => {
        switch (sortBy) {
          case 'views':
            return (b.analytics?.totalViews || 0) - (a.analytics?.totalViews || 0);
          case 'watchTime':
            return (b.analytics?.totalWatchTime || 0) - (a.analytics?.totalWatchTime || 0);
          case 'completion':
            return (b.analytics?.avgCompletionRate || 0) - (a.analytics?.avgCompletionRate || 0);
          case 'engagement':
            // For now, sort by views as proxy for engagement
            return (b.analytics?.totalViews || 0) - (a.analytics?.totalViews || 0);
          default:
            return (b.analytics?.totalViews || 0) - (a.analytics?.totalViews || 0);
        }
      });
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
        total_connectors: 0,
        avg_completion_rate: 0,
        total_earnings: 0,
        engagement_percentage: 0,
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
    // ✅ CLEAR CACHE
    // ============================================
    clearCache() {
      this.cache.clear();
      console.log('🧹 Analytics cache cleared');
    }
  }

  // Make available globally
  window.CreatorAnalytics = CreatorAnalytics;
  
  console.log('✅ CreatorAnalytics module loaded successfully');
  
})();
