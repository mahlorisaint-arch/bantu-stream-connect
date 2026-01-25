class ErrorBoundary {
  constructor(appName = 'BantuStream') {
    this.appName = appName;
    this.maxErrors = 5;
    this.errorCount = 0;
    this.errorResetTime = 30000; // 30 seconds
    
    this.setupGlobalHandlers();
    this.setupUnhandledRejection();
    this.setupNetworkErrorHandling();
  }
  
  setupGlobalHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError(event.error || event.message, 'global');
      event.preventDefault();
    }, true);
    
    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'promise');
      event.preventDefault();
    });
  }
  
  setupUnhandledRejection() {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      this.logError({
        type: 'UNHANDLED_REJECTION',
        message: error?.message || 'Unknown promise rejection',
        stack: error?.stack,
        timestamp: new Date().toISOString()
      });
      
      // Prevent browser's default error logging
      event.preventDefault();
    });
  }
  
  setupNetworkErrorHandling() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        // Log network errors
        console.error('Network Error:', error);
        throw error;
      }
    };
  }
  
  handleError(error, context) {
    // Check if we should show error to user
    if (this.shouldShowError()) {
      this.showUserFriendlyError(error, context);
    }
    
    // Log to analytics/console
    this.logError({
      type: 'ERROR',
      context,
      message: error.message || String(error),
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Send to error tracking service (if configured)
    this.sendToErrorTracking(error);
  }
  
  shouldShowError() {
    this.errorCount++;
    
    // Reset error count after timeout
    setTimeout(() => {
      this.errorCount = Math.max(0, this.errorCount - 1);
    }, this.errorResetTime);
    
    // Don't show errors if we're in a flood situation
    return this.errorCount <= this.maxErrors;
  }
  
  showUserFriendlyError(error, context) {
    const message = this.getUserFriendlyMessage(error, context);
    
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <span>${security.safeText(message)}</span>
    `;
    
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
  
  getUserFriendlyMessage(error, context) {
    const messages = {
      'network': 'Connection issue. Please check your internet.',
      'video': 'Video failed to load. Try refreshing.',
      'comments': 'Unable to load comments.',
      'default': 'Something went wrong. Please try again.'
    };
    
    if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
      return messages.network;
    }
    
    if (context === 'video' || error.message?.includes('video')) {
      return messages.video;
    }
    
    return messages.default;
  }
  
  logError(errorData) {
    // Console in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.error('🔴 Application Error:', errorData);
    }
    
    // Send to analytics
    if (window.analytics) {
      window.analytics.trackEvent('error_occurred', {
        error_type: errorData.type,
        context: errorData.context,
        message: errorData.message,
        url: errorData.url
      });
    }
    
    // Store in localStorage for debugging
    this.storeErrorLog(errorData);
  }
  
  storeErrorLog(errorData) {
    try {
      const logs = JSON.parse(localStorage.getItem(`${this.appName}_error_logs`) || '[]');
      logs.unshift({
        ...errorData,
        id: Date.now()
      });
      
      // Keep only last 20 errors
      localStorage.setItem(`${this.appName}_error_logs`, JSON.stringify(logs.slice(0, 20)));
    } catch (e) {
      // Silently fail for localStorage errors
    }
  }
  
  sendToErrorTracking(error) {
    // Implement integration with Sentry/LogRocket/Rollbar here
    // Example: window.Sentry?.captureException(error);
  }
  
  // Safe function wrapper for critical operations
  safeExecute(fn, context, fallback = null) {
    try {
      return fn();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }
  
  // Async safe wrapper
  async safeAsyncExecute(asyncFn, context, fallback = null) {
    try {
      return await asyncFn();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }
}

// Create and export instance
const errorHandler = new ErrorBoundary('BantuStream');

// Utility functions for common operations
const safe = {
  // DOM operations
  setText: (element, text) => {
    if (element && text !== undefined) {
      element.textContent = security.safeText(text);
    }
  },
  
  setHTML: (element, html) => {
    if (element) {
      element.innerHTML = errorHandler.safeExecute(
        () => security.sanitizeHTML(html),
        'dom-sanitization',
        ''
      );
    }
  },
  
  // Event listener with error handling
  addEventListener: (element, event, handler) => {
    if (element && handler) {
      element.addEventListener(event, (e) => {
        errorHandler.safeExecute(() => handler(e), `event-${event}`);
      });
    }
  },
  
  // Fetch with error handling
  fetch: async (url, options) => {
    return errorHandler.safeAsyncExecute(
      async () => {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      },
      'network-fetch',
      null
    );
  }
};

// Export
window.errorHandler = errorHandler;
window.safe = safe;
