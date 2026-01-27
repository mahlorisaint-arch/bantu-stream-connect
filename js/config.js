/**
 * Bantu Stream Connect Configuration
 * IMPORTANT: Sensitive data moved to backend API
 */

// Environment detection
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';

// API Configuration
const Config = {
    // Backend API endpoints (no Supabase keys exposed!)
    endpoints: {
        content: isProduction ? 
            '/api/proxy.php' : 
            'http://localhost:3000/api/content',
        
        auth: isProduction ?
            '/api/auth.php' :
            'http://localhost:3000/api/auth',
        
        analytics: '/api/analytics.php'
    },
    
    // Feature flags
    features: {
        offlineMode: true,
        lazyLoading: true,
        serviceWorker: true,
        analytics: false, // Disabled for Phase 1
        personalizedFeed: false // Disabled for Phase 1
    },
    
    // Content settings
    content: {
        itemsPerPage: 20,
        thumbnailQuality: 'medium',
        cacheTTL: 3600, // 1 hour
        maxImageSize: 1048576 // 1MB
    },
    
    // Performance settings
    performance: {
        debounceDelay: 300,
        intersectionThreshold: 0.1,
        maxConcurrentRequests: 3,
        requestTimeout: 10000 // 10 seconds
    },
    
    // Accessibility settings
    accessibility: {
        skipLinks: true,
        focusTrapping: true,
        highContrastMode: false,
        reducedMotion: false
    }
};

// Export configuration
window.AppConfig = Object.freeze(Config);

// Initialize performance monitoring
window.PerformanceMetrics = {
    startTime: performance.now(),
    marks: {},
    
    mark(name) {
        this.marks[name] = performance.now();
        console.log(`⚡ Performance mark: ${name}`);
    },
    
    measure(from, to, name) {
        if (this.marks[from] && this.marks[to]) {
            const duration = this.marks[to] - this.marks[from];
            console.log(`📊 ${name}: ${duration.toFixed(2)}ms`);
            
            // Send to analytics if enabled
            if (Config.features.analytics) {
                this.sendMetric(name, duration);
            }
        }
    },
    
    sendMetric(name, value) {
        // Send to backend analytics
        navigator.sendBeacon(Config.endpoints.analytics, JSON.stringify({
            metric: name,
            value: value,
            timestamp: Date.now(),
            url: window.location.pathname
        }));
    }
};
