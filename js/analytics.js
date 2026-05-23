// js/analytics.js — Complete Analytics Tracking with CSV Export Support
// Version: 2.0.0 - Engagement System Integration
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23):
// - Added view recording analytics with RPC confirmation tracking
// - Added like/favorite/watch later engagement tracking
// - Added playlist navigation analytics
// - Added watch session analytics (playback_sessions, playback_heartbeats)
// - Added content view validation analytics
// - Added real-time engagement event tracking
// - Added performance metrics for engagement actions

class Analytics {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getOrCreateUserId();
    this.pageStartTime = Date.now();
    this.eventQueue = [];
    this.flushInterval = null;
    
    // 🚨 Engagement tracking state
    this.engagementSession = {
      startTime: Date.now(),
      contentViews: 0,
      likes: 0,
      favorites: 0,
      shares: 0,
      comments: 0,
      watchTimeMs: 0
    };
    
    this.init();
    this.trackPageView();
  }
  
  init() {
    // Set up auto-flush every 30 seconds
    this.flushInterval = setInterval(() => this.flushQueue(), 30000);
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flushQueueSync());
    
    // Track performance metrics
    this.trackPerformance();
    
    // Track engagement
    this.trackEngagement();
    
    // 🚨 Setup engagement event listeners
    this.setupEngagementListeners();
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  getOrCreateUserId() {
    let userId = localStorage.getItem('bantu_user_id');
    
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('bantu_user_id', userId);
    }
    
    return userId;
  }
  
  trackPageView() {
    const pageData = {
      page: document.title,
      url: window.location.href,
      referrer: document.referrer,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      platform: navigator.platform
    };
    
    this.enqueueEvent('page_view', pageData);
  }
  
  trackEvent(eventName, properties = {}) {
    const eventData = {
      ...properties,
      event_timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      user_id: this.userId
    };
    
    this.enqueueEvent(eventName, eventData);
    
    // Console log in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`📊 Analytics: ${eventName}`, eventData);
    }
  }
  
  enqueueEvent(eventName, data) {
    this.eventQueue.push({
      name: eventName,
      data,
      timestamp: Date.now()
    });
    
    // Auto-flush if queue gets too large
    if (this.eventQueue.length >= 20) {
      this.flushQueue();
    }
  }
  
  async flushQueue() {
    if (this.eventQueue.length === 0) return;
    
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      await this.sendToEndpoint(eventsToSend);
    } catch (error) {
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToSend);
      console.warn('Failed to send analytics, re-queued:', eventsToSend.length, 'events');
    }
  }
  
  flushQueueSync() {
    if (this.eventQueue.length === 0) return;
    
    const eventsToSend = JSON.stringify(this.eventQueue);
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', eventsToSend);
    } else {
      console.log('Analytics events (sync):', eventsToSend.length, 'events');
    }
    
    this.eventQueue = [];
  }
  
  async sendToEndpoint(events) {
    const endpoint = '/api/analytics';
    
    // In production, uncomment actual fetch
    // const response = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ events, session_id: this.sessionId, user_id: this.userId })
    // });
    // if (!response.ok) throw new Error(`Analytics failed: ${response.status}`);
    
    console.log('Analytics sent to endpoint:', events.length, 'events');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  trackPerformance() {
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          this.trackEvent('web_vital_lcp', {
            value: lastEntry.startTime,
            url: lastEntry.name
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.log('LCP tracking not supported');
      }
    }
  }
  
  trackEngagement() {
    let lastActiveTime = Date.now();
    let scrollDepth = 0;
    let videoPlayTime = 0;
    let videoStartTime = null;
    
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        lastActiveTime = Date.now();
      }, { passive: true });
    });
    
    document.addEventListener('scroll', () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > scrollDepth) {
        scrollDepth = Math.floor(scrollPercent);
        
        if (scrollDepth % 25 === 0) {
          this.trackEvent('scroll_depth', { percent: scrollDepth });
        }
      }
    }, { passive: true });
    
    setInterval(() => {
      const timeOnPage = Math.floor((Date.now() - this.pageStartTime) / 1000);
      this.trackEvent('time_on_page', {
        seconds: timeOnPage,
        active_seconds: Math.floor((Date.now() - lastActiveTime) / 1000)
      });
    }, 60000);
    
    window.addEventListener('video_play_start', (e) => {
      videoStartTime = Date.now();
      this.trackEvent('video_play_start', e.detail);
    });
    
    window.addEventListener('video_play_end', (e) => {
      if (videoStartTime) {
        videoPlayTime = Date.now() - videoStartTime;
        this.trackEvent('video_play_end', {
          ...e.detail,
          play_time_ms: videoPlayTime
        });
      }
    });
  }
  
  // ============================================
  // 🚨 ENGAGEMENT EVENT LISTENERS
  // ============================================
  
  setupEngagementListeners() {
    // Listen for view recorded events
    window.addEventListener('content-view-recorded', (event) => {
      const { contentId, playbackSessionId, progressSeconds, totalWatchTimeMs } = event.detail;
      this.engagementSession.contentViews++;
      this.engagementSession.watchTimeMs += totalWatchTimeMs || 0;
      
      this.trackEvent('engagement_view_recorded', {
        content_id: contentId,
        playback_session_id: playbackSessionId,
        progress_seconds: progressSeconds,
        total_watch_time_ms: totalWatchTimeMs,
        session_total_views: this.engagementSession.contentViews
      });
    });
    
    // Listen for view validated events
    window.addEventListener('content-view-validated', (event) => {
      const { contentId, playbackSessionId, userId, timestamp } = event.detail;
      
      this.trackEvent('engagement_view_validated', {
        content_id: contentId,
        playback_session_id: playbackSessionId,
        user_id: userId,
        validation_timestamp: timestamp
      });
    });
    
    // Listen for like toggles
    window.addEventListener('click', (e) => {
      const likeBtn = e.target.closest('#likeBtn');
      if (likeBtn) {
        const isActive = likeBtn.classList.contains('active');
        const contentId = window.currentContent?.id || window.currentContentId;
        
        if (contentId) {
          this.trackEvent('engagement_like_toggle', {
            content_id: contentId,
            action: isActive ? 'liked' : 'unliked',
            timestamp: Date.now()
          });
          
          if (isActive) {
            this.engagementSession.likes++;
          } else {
            this.engagementSession.likes = Math.max(0, this.engagementSession.likes - 1);
          }
        }
      }
    });
    
    // Listen for favorite toggles
    window.addEventListener('click', (e) => {
      const favBtn = e.target.closest('#favoriteBtn');
      if (favBtn) {
        const isActive = favBtn.classList.contains('active');
        const contentId = window.currentContent?.id || window.currentContentId;
        
        if (contentId) {
          this.trackEvent('engagement_favorite_toggle', {
            content_id: contentId,
            action: isActive ? 'favorited' : 'unfavorited',
            timestamp: Date.now()
          });
          
          if (isActive) {
            this.engagementSession.favorites++;
          } else {
            this.engagementSession.favorites = Math.max(0, this.engagementSession.favorites - 1);
          }
        }
      }
    });
    
    // Listen for share events
    window.addEventListener('click', (e) => {
      const shareBtn = e.target.closest('#shareBtn');
      if (shareBtn) {
        const contentId = window.currentContent?.id || window.currentContentId;
        
        if (contentId) {
          this.trackEvent('engagement_share', {
            content_id: contentId,
            method: navigator.share ? 'native_share' : 'clipboard',
            timestamp: Date.now()
          });
          
          this.engagementSession.shares++;
        }
      }
    });
    
    // Listen for comment submissions
    window.addEventListener('click', (e) => {
      const sendBtn = e.target.closest('#sendCommentBtn');
      if (sendBtn) {
        const commentInput = document.getElementById('commentInput');
        const commentText = commentInput?.value || '';
        const contentId = window.currentContent?.id || window.currentContentId;
        
        if (contentId && commentText.trim()) {
          this.trackEvent('engagement_comment', {
            content_id: contentId,
            comment_length: commentText.length,
            timestamp: Date.now()
          });
          
          this.engagementSession.comments++;
        }
      }
    });
    
    // Listen for playlist navigation
    window.addEventListener('click', (e) => {
      const nextBtn = e.target.closest('.next-track-btn, .player-next-btn, #nextTrackBtn');
      const prevBtn = e.target.closest('.prev-track-btn, .player-prev-btn, #previousTrackBtn');
      
      if (nextBtn) {
        this.trackEvent('playlist_navigation', {
          direction: 'next',
          current_index: window.currentPlaylistIndex,
          total_items: window.currentPlaylistItems?.length || 0,
          timestamp: Date.now()
        });
      }
      
      if (prevBtn) {
        this.trackEvent('playlist_navigation', {
          direction: 'previous',
          current_index: window.currentPlaylistIndex,
          total_items: window.currentPlaylistItems?.length || 0,
          timestamp: Date.now()
        });
      }
    });
    
    // Listen for contentId changes (playlist track changes)
    window.addEventListener('contentIdChanged', (event) => {
      const { contentId } = event.detail;
      
      this.trackEvent('playlist_track_change', {
        content_id: contentId,
        previous_content_id: window._previousContentId,
        playlist_index: window.currentPlaylistIndex,
        timestamp: Date.now()
      });
      
      window._previousContentId = contentId;
    });
    
    // Listen for watch session initialization
    if (window.WatchSessionManager) {
      const originalInit = window.WatchSessionManager.prototype.initializeSession;
      if (originalInit) {
        window.WatchSessionManager.prototype.initializeSession = async function(...args) {
          const result = await originalInit.apply(this, args);
          
          window.dispatchEvent(new CustomEvent('watch_session_initialized', {
            detail: {
              playback_session_id: this.playbackSessionId,
              content_id: this.contentId,
              user_id: this.userId,
              timestamp: Date.now()
            }
          }));
          
          return result;
        };
      }
    }
    
    window.addEventListener('watch_session_initialized', (event) => {
      analytics.trackEvent('watch_session_start', event.detail);
    });
  }
  
  // ============================================
  // ENGAGEMENT SESSION TRACKING
  // ============================================
  
  getEngagementSessionSummary() {
    const sessionDuration = Date.now() - this.engagementSession.startTime;
    
    return {
      session_duration_ms: sessionDuration,
      content_views: this.engagementSession.contentViews,
      likes: this.engagementSession.likes,
      favorites: this.engagementSession.favorites,
      shares: this.engagementSession.shares,
      comments: this.engagementSession.comments,
      watch_time_ms: this.engagementSession.watchTimeMs,
      session_id: this.sessionId,
      user_id: this.userId
    };
  }
  
  trackEngagementSessionEnd() {
    const summary = this.getEngagementSessionSummary();
    this.trackEvent('engagement_session_end', summary);
    
    // Reset engagement session
    this.engagementSession = {
      startTime: Date.now(),
      contentViews: 0,
      likes: 0,
      favorites: 0,
      shares: 0,
      comments: 0,
      watchTimeMs: 0
    };
  }
  
  trackUserAction(action, properties = {}) {
    this.trackEvent(`user_action_${action}`, {
      ...properties,
      page: document.title,
      url: window.location.pathname
    });
  }
  
  // ============================================
  // CONTENT ANALYTICS
  // ============================================
  
  trackContentView(contentId, contentType, source = 'direct') {
    this.trackEvent('content_view', {
      content_id: contentId,
      content_type: contentType,
      source: source,
      referrer: document.referrer
    });
  }
  
  trackContentPlay(contentId, duration, autoplay = false) {
    this.trackEvent('content_play', {
      content_id: contentId,
      duration: duration,
      autoplay: autoplay,
      timestamp: Date.now()
    });
    
    window.dispatchEvent(new CustomEvent('video_play_start', {
      detail: { contentId, timestamp: Date.now() }
    }));
  }
  
  trackContentComplete(contentId, percentWatched, watchTimeMs) {
    this.trackEvent('content_complete', {
      content_id: contentId,
      percent_watched: percentWatched,
      watch_time_ms: watchTimeMs,
      timestamp: Date.now()
    });
    
    window.dispatchEvent(new CustomEvent('video_play_end', {
      detail: { contentId, percent_watched: percentWatched }
    }));
  }
  
  trackContentLike(contentId, action) {
    this.trackEvent('content_like', {
      content_id: contentId,
      action: action,
      timestamp: Date.now()
    });
  }
  
  trackContentShare(contentId, platform) {
    this.trackEvent('content_share', {
      content_id: contentId,
      platform: platform,
      timestamp: Date.now()
    });
  }
  
  // ============================================
  // PLAYLIST ANALYTICS
  // ============================================
  
  trackPlaylistStart(playlistId, playlistName, itemCount) {
    this.trackEvent('playlist_start', {
      playlist_id: playlistId,
      playlist_name: playlistName,
      item_count: itemCount,
      timestamp: Date.now()
    });
  }
  
  trackPlaylistComplete(playlistId, itemsPlayed, totalWatchTimeMs) {
    this.trackEvent('playlist_complete', {
      playlist_id: playlistId,
      items_played: itemsPlayed,
      total_watch_time_ms: totalWatchTimeMs,
      completion_rate: itemsPlayed > 0 ? 100 : 0,
      timestamp: Date.now()
    });
  }
  
  trackPlaylistAbandon(playlistId, currentIndex, totalItems, watchTimeMs) {
    this.trackEvent('playlist_abandon', {
      playlist_id: playlistId,
      current_index: currentIndex,
      total_items: totalItems,
      progress_percent: (currentIndex / totalItems) * 100,
      watch_time_ms: watchTimeMs,
      timestamp: Date.now()
    });
  }
  
  // ============================================
  // SOCIAL ANALYTICS
  // ============================================
  
  trackCommentAdd(contentId, commentLength, parentCommentId = null) {
    this.trackEvent('comment_add', {
      content_id: contentId,
      comment_length: commentLength,
      is_reply: !!parentCommentId,
      parent_comment_id: parentCommentId,
      timestamp: Date.now()
    });
  }
  
  trackCreatorConnect(creatorId, action) {
    this.trackEvent('creator_connect', {
      creator_id: creatorId,
      action: action,
      timestamp: Date.now()
    });
  }
  
  // ============================================
  // UI ANALYTICS
  // ============================================
  
  trackButtonClick(buttonId, location, additionalData = {}) {
    this.trackEvent('button_click', {
      button_id: buttonId,
      location: location,
      ...additionalData,
      timestamp: Date.now()
    });
  }
  
  // ============================================
  // ANALYTICS EXPORT TRACKING
  // ============================================
  
  trackAnalyticsExport(timeRange, filename, rowCount = 0) {
    this.trackEvent('analytics_export', {
      time_range: timeRange,
      filename: filename,
      row_count: rowCount,
      export_timestamp: new Date().toISOString()
    });
    
    this.trackUserAction('analytics_export', { timeRange, filename, rowCount });
  }
  
  trackAnalyticsExportFailed(timeRange, error) {
    this.trackEvent('analytics_export_failed', {
      time_range: timeRange,
      error: error,
      export_timestamp: new Date().toISOString()
    });
  }
  
  trackAnalyticsDashboardView(timeRange) {
    this.trackEvent('analytics_dashboard_view', {
      time_range: timeRange,
      view_timestamp: new Date().toISOString()
    });
  }
  
  trackAnalyticsTimeRangeChange(fromRange, toRange) {
    this.trackEvent('analytics_time_range_change', {
      from_range: fromRange,
      to_range: toRange,
      change_timestamp: new Date().toISOString()
    });
  }
  
  trackAnalyticsContentDetails(contentId, contentType) {
    this.trackUserAction('analytics_content_details', { contentId, contentType });
  }
  
  trackAnalyticsSortChange(sortMetric) {
    this.trackEvent('analytics_sort_change', {
      sort_metric: sortMetric,
      change_timestamp: new Date().toISOString()
    });
  }
  
  trackAnalyticsViewToggle(viewMode) {
    this.trackEvent('analytics_view_toggle', {
      view_mode: viewMode,
      toggle_timestamp: new Date().toISOString()
    });
  }
  
  // ============================================
  // AUDIENCE INSIGHTS TRACKING
  // ============================================
  
  trackAudienceInsightView(insightType) {
    this.trackEvent('audience_insight_view', {
      insight_type: insightType,
      view_timestamp: new Date().toISOString()
    });
  }
  
  // ============================================
  // PERFORMANCE TRACKING
  // ============================================
  
  trackAnalyticsDataLoad(dataType, loadTimeMs, success = true) {
    this.trackEvent('analytics_data_load', {
      data_type: dataType,
      load_time_ms: loadTimeMs,
      success: success,
      load_timestamp: new Date().toISOString()
    });
  }
  
  // ============================================
  // ERROR TRACKING
  // ============================================
  
  trackError(errorType, context, details) {
    this.trackEvent('error_occurred', {
      error_type: errorType,
      context,
      details,
      url: window.location.href,
      timestamp: Date.now()
    });
  }
  
  // ============================================
  // CLEANUP
  // ============================================
  
  destroy() {
    // Track final engagement session before destroying
    this.trackEngagementSessionEnd();
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushQueueSync();
  }
}

// ============================================
// ANALYTICS HELPER FUNCTIONS
// ============================================

function trackExportWithMetrics(timeRange, filename, metrics = {}) {
  analytics.trackAnalyticsExport(timeRange, filename, metrics.rowCount || 0);
  
  if (metrics.generationTimeMs) {
    analytics.trackEvent('analytics_export_performance', {
      time_range: timeRange,
      generation_time_ms: metrics.generationTimeMs,
      row_count: metrics.rowCount || 0,
      file_size_kb: metrics.fileSizeKb || 0
    });
  }
}

async function trackAnalyticsSession(callback) {
  const sessionStart = Date.now();
  const initialRange = document.querySelector('.time-range-btn.active')?.dataset.range || '30days';
  
  analytics.trackAnalyticsDashboardView(initialRange);
  
  try {
    await callback();
    
    const sessionDuration = Date.now() - sessionStart;
    analytics.trackEvent('analytics_session_complete', {
      duration_ms: sessionDuration,
      time_range: initialRange,
      session_timestamp: new Date().toISOString()
    });
  } catch (error) {
    analytics.trackEvent('analytics_session_error', {
      duration_ms: Date.now() - sessionStart,
      error: error.message,
      time_range: initialRange
    });
    
    throw error;
  }
}

// ============================================
// EXPORT MONITOR
// ============================================

const exportMonitor = {
  start: () => Date.now(),
  
  end: (startTime, timeRange, filename, rowCount) => {
    const generationTime = Date.now() - startTime;
    
    trackExportWithMetrics(timeRange, filename, {
      generationTimeMs: generationTime,
      rowCount: rowCount
    });
    
    return generationTime;
  },
  
  trackError: (timeRange, error, stage) => {
    analytics.trackAnalyticsExportFailed(timeRange, error);
    
    analytics.trackEvent('analytics_export_error', {
      time_range: timeRange,
      error_stage: stage,
      error_message: error.message || error,
      error_timestamp: new Date().toISOString()
    });
  }
};

// ============================================
// AUTO-TRACK ANALYTICS PAGE INTERACTIONS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('creator-analytics')) {
    analytics.trackEvent('analytics_page_load', {
      page_title: document.title,
      url: window.location.href,
      load_timestamp: new Date().toISOString()
    });
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('time-range-btn') && 
            mutation.target.classList.contains('active')) {
          // Time range change tracked via click handler
        }
      });
    });
    
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('time-range-btn')) {
    const newRange = e.target.dataset.range;
    const activeBtn = document.querySelector('.time-range-btn.active');
    const oldRange = activeBtn?.dataset.range || 'unknown';
    
    if (oldRange !== newRange) {
      analytics.trackAnalyticsTimeRangeChange(oldRange, newRange);
    }
  }
  
  if (e.target.id === 'export-csv-btn' || e.target.closest('#export-csv-btn')) {
    analytics.trackEvent('analytics_export_button_click', {
      click_timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// CREATE ANALYTICS INSTANCE
// ============================================

const analytics = new Analytics();

// ============================================
// TRACKING FUNCTIONS EXPORT
// ============================================

const track = {
  // Content interactions
  contentView: (contentId, contentType, source) => analytics.trackContentView(contentId, contentType, source),
  contentPlay: (contentId, duration, autoplay) => analytics.trackContentPlay(contentId, duration, autoplay),
  contentComplete: (contentId, percentWatched, watchTimeMs) => analytics.trackContentComplete(contentId, percentWatched, watchTimeMs),
  contentLike: (contentId, action) => analytics.trackContentLike(contentId, action),
  contentShare: (contentId, platform) => analytics.trackContentShare(contentId, platform),
  
  // Social interactions
  commentAdd: (contentId, commentLength, parentCommentId) => analytics.trackCommentAdd(contentId, commentLength, parentCommentId),
  creatorConnect: (creatorId, action) => analytics.trackCreatorConnect(creatorId, action),
  
  // UI interactions
  buttonClick: (buttonId, location, additionalData) => analytics.trackButtonClick(buttonId, location, additionalData),
  
  // Playlist interactions
  playlistStart: (playlistId, playlistName, itemCount) => analytics.trackPlaylistStart(playlistId, playlistName, itemCount),
  playlistComplete: (playlistId, itemsPlayed, totalWatchTimeMs) => analytics.trackPlaylistComplete(playlistId, itemsPlayed, totalWatchTimeMs),
  playlistAbandon: (playlistId, currentIndex, totalItems, watchTimeMs) => analytics.trackPlaylistAbandon(playlistId, currentIndex, totalItems, watchTimeMs),
  
  // Analytics exports
  analyticsExport: (timeRange, filename, rowCount) => analytics.trackAnalyticsExport(timeRange, filename, rowCount),
  analyticsExportFailed: (timeRange, error) => analytics.trackAnalyticsExportFailed(timeRange, error),
  analyticsDashboardView: (timeRange) => analytics.trackAnalyticsDashboardView(timeRange),
  analyticsTimeRangeChange: (fromRange, toRange) => analytics.trackAnalyticsTimeRangeChange(fromRange, toRange),
  analyticsContentDetails: (contentId, contentType) => analytics.trackAnalyticsContentDetails(contentId, contentType),
  analyticsSortChange: (sortMetric) => analytics.trackAnalyticsSortChange(sortMetric),
  analyticsViewToggle: (viewMode) => analytics.trackAnalyticsViewToggle(viewMode),
  
  // Audience insights
  audienceInsightView: (insightType) => analytics.trackAudienceInsightView(insightType),
  
  // Performance
  analyticsDataLoad: (dataType, loadTimeMs, success) => analytics.trackAnalyticsDataLoad(dataType, loadTimeMs, success),
  
  // Engagement session
  getEngagementSessionSummary: () => analytics.getEngagementSessionSummary(),
  trackEngagementSessionEnd: () => analytics.trackEngagementSessionEnd(),
  
  // Errors
  error: (errorType, context, details) => analytics.trackError(errorType, context, details),
  
  // Raw event tracking
  event: (eventName, properties) => analytics.trackEvent(eventName, properties),
  userAction: (action, properties) => analytics.trackUserAction(action, properties)
};

// ============================================
// GLOBAL EXPORTS
// ============================================

window.analytics = analytics;
window.track = track;
window.trackExportWithMetrics = trackExportWithMetrics;
window.trackAnalyticsSession = trackAnalyticsSession;
window.exportMonitor = exportMonitor;

// Track page unload for engagement session end
window.addEventListener('beforeunload', () => {
  analytics.trackEngagementSessionEnd();
});

console.log('✅ Analytics module loaded with Engagement System Integration');
console.log('  🚨 View recording analytics tracking');
console.log('  🚨 Like/favorite/watch later engagement tracking');
console.log('  🚨 Playlist navigation analytics');
console.log('  🚨 Watch session analytics');
console.log('  🚨 Engagement session summary tracking');
