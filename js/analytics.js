// js/analytics.js — Complete Analytics Tracking with CSV Export Support

class Analytics {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getOrCreateUserId();
    this.pageStartTime = Date.now();
    this.eventQueue = [];
    this.flushInterval = null;
    
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
      // Send to your analytics endpoint (mock implementation)
      await this.sendToEndpoint(eventsToSend);
    } catch (error) {
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToSend);
      console.warn('Failed to send analytics, re-queued:', eventsToSend.length, 'events');
    }
  }
  
  flushQueueSync() {
    if (this.eventQueue.length === 0) return;
    
    // Use sendBeacon for reliable delivery on page unload
    const eventsToSend = JSON.stringify(this.eventQueue);
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', eventsToSend);
    } else {
      // Fallback to sync XHR (mock for now)
      console.log('Analytics events (sync):', eventsToSend.length, 'events');
    }
    
    this.eventQueue = [];
  }
  
  async sendToEndpoint(events) {
    // Mock implementation - in production, replace with your actual analytics endpoint
    const endpoint = '/api/analytics'; // Example endpoint
    
    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Analytics sent to endpoint:', events.length, 'events');
    
    // In a real implementation:
    // const response = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     events,
    //     session_id: this.sessionId,
    //     user_id: this.userId
    //   })
    // });
    
    // if (!response.ok) {
    //   throw new Error(`Analytics failed: ${response.status}`);
    // }
  }
  
  trackPerformance() {
    // Track Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
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
    
    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        lastActiveTime = Date.now();
      }, { passive: true });
    });
    
    // Track scroll depth
    document.addEventListener('scroll', () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > scrollDepth) {
        scrollDepth = Math.floor(scrollPercent);
        
        // Track at intervals
        if (scrollDepth % 25 === 0) {
          this.trackEvent('scroll_depth', {
            percent: scrollDepth
          });
        }
      }
    }, { passive: true });
    
    // Track time on page
    setInterval(() => {
      const timeOnPage = Math.floor((Date.now() - this.pageStartTime) / 1000);
      
      this.trackEvent('time_on_page', {
        seconds: timeOnPage,
        active_seconds: Math.floor((Date.now() - lastActiveTime) / 1000)
      });
    }, 60000); // Every minute
    
    // Track video engagement
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
  
  // Helper to track common user actions
  trackUserAction(action, properties = {}) {
    this.trackEvent(`user_action_${action}`, {
      ...properties,
      page: document.title,
      url: window.location.pathname
    });
  }
  
  // Clean up
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushQueueSync();
  }
}

// Create analytics instance
const analytics = new Analytics();

// Export tracking functions for easy use
const track = {
  // Content interactions
  contentView: (contentId, contentType) => {
    analytics.trackUserAction('content_view', { contentId, contentType });
  },
  
  contentPlay: (contentId, duration) => {
    analytics.trackUserAction('content_play', { contentId, duration });
    
    // Dispatch event for video tracking
    window.dispatchEvent(new CustomEvent('video_play_start', {
      detail: { contentId, timestamp: Date.now() }
    }));
  },
  
  contentComplete: (contentId, percentWatched) => {
    analytics.trackUserAction('content_complete', { contentId, percentWatched });
    
    window.dispatchEvent(new CustomEvent('video_play_end', {
      detail: { contentId, percent_watched: percentWatched }
    }));
  },
  
  contentLike: (contentId, action) => {
    analytics.trackUserAction('content_like', { contentId, action });
  },
  
  contentShare: (contentId, platform) => {
    analytics.trackUserAction('content_share', { contentId, platform });
  },
  
  // Social interactions
  commentAdd: (contentId, commentLength) => {
    analytics.trackUserAction('comment_add', { contentId, commentLength });
  },
  
  creatorConnect: (creatorId, action) => {
    analytics.trackUserAction('creator_connect', { creatorId, action });
  },
  
  // UI interactions
  buttonClick: (buttonId, location) => {
    analytics.trackUserAction('button_click', { buttonId, location });
  },
  
  // ============================================
  // ✅ ✅ NEW: ANALYTICS EXPORT TRACKING
  // ============================================
  /**
   * Track when user exports analytics data
   * @param {string} timeRange - The time range exported (7days, 30days, 90days)
   * @param {string} filename - The generated filename
   * @param {number} rowCount - Number of rows in export
   */
  analyticsExport: (timeRange, filename, rowCount = 0) => {
    analytics.trackEvent('analytics_export', {
      time_range: timeRange,
      filename: filename,
      row_count: rowCount,
      export_timestamp: new Date().toISOString()
    });
    
    // Also track as user action
    analytics.trackUserAction('analytics_export', { 
      timeRange, 
      filename,
      rowCount 
    });
  },
  
  /**
   * Track export failures
   * @param {string} timeRange - The time range attempted
   * @param {string} error - Error message
   */
  analyticsExportFailed: (timeRange, error) => {
    analytics.trackEvent('analytics_export_failed', {
      time_range: timeRange,
      error: error,
      export_timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Track when user views analytics dashboard
   * @param {string} timeRange - Current selected time range
   */
  analyticsDashboardView: (timeRange) => {
    analytics.trackEvent('analytics_dashboard_view', {
      time_range: timeRange,
      view_timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Track time range changes on analytics dashboard
   * @param {string} fromRange - Previous time range
   * @param {string} toRange - New time range
   */
  analyticsTimeRangeChange: (fromRange, toRange) => {
    analytics.trackEvent('analytics_time_range_change', {
      from_range: fromRange,
      to_range: toRange,
      change_timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Track when user clicks on content details from analytics
   * @param {string} contentId - ID of the content
   * @param {string} contentType - Type of content
   */
  analyticsContentDetails: (contentId, contentType) => {
    analytics.trackUserAction('analytics_content_details', { 
      contentId, 
      contentType 
    });
  },
  
  /**
   * Track when user changes sort metric in analytics
   * @param {string} sortMetric - The metric being sorted by
   */
  analyticsSortChange: (sortMetric) => {
    analytics.trackEvent('analytics_sort_change', {
      sort_metric: sortMetric,
      change_timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Track when user toggles table view
   * @param {string} viewMode - 'grid' or 'list'
   */
  analyticsViewToggle: (viewMode) => {
    analytics.trackEvent('analytics_view_toggle', {
      view_mode: viewMode,
      toggle_timestamp: new Date().toISOString()
    });
  },
  
  // ============================================
  // ✅ ✅ NEW: AUDIENCE INSIGHTS TRACKING
  // ============================================
  /**
   * Track when user views audience insights
   * @param {string} insightType - Type of insight (locations, devices, etc.)
   */
  audienceInsightView: (insightType) => {
    analytics.trackEvent('audience_insight_view', {
      insight_type: insightType,
      view_timestamp: new Date().toISOString()
    });
  },
  
  // ============================================
  // ✅ ✅ NEW: PERFORMANCE TRACKING
  // ============================================
  /**
   * Track analytics data load performance
   * @param {string} dataType - Type of data loaded
   * @param {number} loadTimeMs - Load time in milliseconds
   * @param {boolean} success - Whether load was successful
   */
  analyticsDataLoad: (dataType, loadTimeMs, success = true) => {
    analytics.trackEvent('analytics_data_load', {
      data_type: dataType,
      load_time_ms: loadTimeMs,
      success: success,
      load_timestamp: new Date().toISOString()
    });
  },
  
  // Errors
  error: (errorType, context, details) => {
    analytics.trackEvent('error_occurred', {
      error_type: errorType,
      context,
      details,
      url: window.location.href
    });
  }
};

// ============================================
// ✅ ✅ NEW: ANALYTICS HELPER FUNCTIONS
// ============================================

/**
 * Track export completion with performance metrics
 * @param {string} timeRange - Time range exported
 * @param {string} filename - Generated filename
 * @param {Object} metrics - Performance metrics
 */
function trackExportWithMetrics(timeRange, filename, metrics = {}) {
  track.analyticsExport(timeRange, filename, metrics.rowCount || 0);
  
  // Track performance if available
  if (metrics.generationTimeMs) {
    analytics.trackEvent('analytics_export_performance', {
      time_range: timeRange,
      generation_time_ms: metrics.generationTimeMs,
      row_count: metrics.rowCount || 0,
      file_size_kb: metrics.fileSizeKb || 0
    });
  }
}

/**
 * Track analytics dashboard session
 * @param {Function} callback - Function to execute while tracking
 */
async function trackAnalyticsSession(callback) {
  const sessionStart = Date.now();
  const initialRange = document.querySelector('.time-range-btn.active')?.dataset.range || '30days';
  
  // Track session start
  track.analyticsDashboardView(initialRange);
  
  try {
    await callback();
    
    // Track session duration
    const sessionDuration = Date.now() - sessionStart;
    analytics.trackEvent('analytics_session_complete', {
      duration_ms: sessionDuration,
      time_range: initialRange,
      session_timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Track session error
    analytics.trackEvent('analytics_session_error', {
      duration_ms: Date.now() - sessionStart,
      error: error.message,
      time_range: initialRange
    });
    
    throw error;
  }
}

// ============================================
// ✅ ✅ NEW: AUTO-TRACK ANALYTICS PAGE INTERACTIONS
// ============================================

// Auto-track when analytics page loads
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on analytics page
  if (window.location.pathname.includes('creator-analytics')) {
    // Track initial page view with analytics specific data
    analytics.trackEvent('analytics_page_load', {
      page_title: document.title,
      url: window.location.href,
      load_timestamp: new Date().toISOString()
    });
    
    // Set up mutation observer to track time range changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.classList.contains('time-range-btn') && 
            mutation.target.classList.contains('active')) {
          // Time range changed, but we'll track through the button click handler
          // This is just a backup
        }
      });
    });
    
    // Observe time range buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });
  }
});

// Track time range changes via click handlers
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('time-range-btn')) {
    const newRange = e.target.dataset.range;
    const activeBtn = document.querySelector('.time-range-btn.active');
    const oldRange = activeBtn?.dataset.range || 'unknown';
    
    if (oldRange !== newRange) {
      track.analyticsTimeRangeChange(oldRange, newRange);
    }
  }
  
  // Track export button clicks
  if (e.target.id === 'export-csv-btn' || e.target.closest('#export-csv-btn')) {
    // Export tracking is handled in the button's click handler
    // This is just a backup
    analytics.trackEvent('analytics_export_button_click', {
      click_timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// ✅ ✅ NEW: EXPORT PERFORMANCE MONITORING
// ============================================

/**
 * Monitor export performance
 * @returns {Object} Performance monitoring functions
 */
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
    track.analyticsExportFailed(timeRange, error);
    
    analytics.trackEvent('analytics_export_error', {
      time_range: timeRange,
      error_stage: stage,
      error_message: error.message || error,
      error_timestamp: new Date().toISOString()
    });
  }
};

// Make available globally
window.analytics = analytics;
window.track = track;
window.trackExportWithMetrics = trackExportWithMetrics;
window.trackAnalyticsSession = trackAnalyticsSession;
window.exportMonitor = exportMonitor;

// Auto-initialize analytics
document.addEventListener('DOMContentLoaded', () => {
  // Already initialized in constructor
});
