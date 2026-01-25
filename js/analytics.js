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
    if (process.env.NODE_ENV === 'development') {
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
      // Send to your analytics endpoint
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
      // Fallback to sync XHR
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/analytics', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(eventsToSend);
    }
    
    this.eventQueue = [];
  }
  
  async sendToEndpoint(events) {
    // Replace with your actual analytics endpoint
    const endpoint = '/api/analytics'; // Example endpoint
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        session_id: this.sessionId,
        user_id: this.userId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Analytics failed: ${response.status}`);
    }
  }
  
  trackPerformance() {
    // Track Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.trackEvent('web_vital_lcp', {
          value: lastEntry.startTime,
          url: lastEntry.name
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach(entry => {
          this.trackEvent('web_vital_fid', {
            value: entry.processingStart - entry.startTime,
            url: entry.name
          });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      
      // Cumulative Layout Shift
      let clsValue = 0;
      let clsEntries = [];
      
      const clsObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        });
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      
      // Report CLS on visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.trackEvent('web_vital_cls', {
            value: clsValue,
            entries_count: clsEntries.length
          });
        }
      });
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

// Make available globally
window.analytics = analytics;
window.track = track;

// Auto-initialize analytics
document.addEventListener('DOMContentLoaded', () => {
  // Already initialized in constructor
});
