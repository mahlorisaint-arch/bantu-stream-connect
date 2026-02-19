// Enhanced Supabase client with caching and timeout handling
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
        this.requestTimeout = 15000; // 15 second timeout (increased from 8000ms)
    }
    
    async query(table, options = {}, retryCount = 0) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = 100,
            offset = 0,
            timeout = this.requestTimeout
        } = options;

        // Generate cache key (excluding volatile params)
        const cacheKey = this.generateCacheKey(table, { select, where, orderBy, order, limit, offset });
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log('✅ Serving from cache:', cacheKey);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        // Build query URL with CORRECT Supabase syntax
        let queryUrl = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

        // Add filters - FIXED: Properly handles different operators
        Object.keys(where).forEach(key => {
            const value = where[key];
            
            // Check if value already has an operator prefix (like "in.")
            if (typeof value === 'string' && (value.startsWith('in.') || value.startsWith('gte.') || value.startsWith('lte.'))) {
                // Use the operator as-is
                queryUrl += `&${key}=${encodeURIComponent(value)}`;
            } else {
                // Default to eq. operator
                queryUrl += `&${key}=eq.${encodeURIComponent(value)}`;
            }
        });

        // Add ordering
        if (orderBy) {
            queryUrl += `&order=${encodeURIComponent(orderBy)}.${order}`;
        }
        
        // Add limit and offset
        queryUrl += `&limit=${limit}&offset=${offset}`;

        try {
            // Set up abort controller for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(queryUrl, {
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle specific error cases
                if (response.status === 408) {
                    throw new Error(`Request timeout after ${timeout}ms. Server is overloaded.`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            // Store in cache
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            // Also store in localStorage for offline use
            try {
                localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.log('Could not cache in localStorage:', e);
            }
            
            return data;
        } catch (error) {
            console.error('Supabase query error:', error);

            // Retry on abort/timeout errors (max 2 retries)
            if ((error.name === 'AbortError' || error.message?.includes('timeout')) && retryCount < 2) {
                console.log(`⚠️ Retry ${retryCount + 1}/2 for query`);
                
                // Exponential backoff
                const backoffTime = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                
                // Simplify query on retry (remove complex filters)
                const simplifiedWhere = {};
                Object.keys(where).forEach(key => {
                    if (!where[key].toString().startsWith('in.') && key !== 'id') {
                        simplifiedWhere[key] = where[key];
                    }
                });
                
                if (Object.keys(simplifiedWhere).length > 0) {
                    return this.query(table, {
                        ...options,
                        where: simplifiedWhere,
                        timeout: timeout * 1.5 // Increase timeout for retry
                    }, retryCount + 1);
                }
            }

            // Fallback to localStorage cache
            try {
                const offlineCache = localStorage.getItem(`cache_${cacheKey}`);
                if (offlineCache) {
                    const parsed = JSON.parse(offlineCache);
                    if (Date.now() - parsed.timestamp < this.cacheTTL * 2) {
                        console.log('⚠️ Using offline cache fallback');
                        return parsed.data;
                    }
                }
            } catch (e) {
                console.log('Could not read localStorage cache:', e);
            }
            
            throw error;
        }
    }
    
    generateCacheKey(table, options) {
        // Create stable cache key by sorting object keys
        const whereStr = JSON.stringify(Object.keys(options.where || {}).sort().reduce((obj, key) => {
            obj[key] = options.where[key];
            return obj;
        }, {}));
        return `${table}_${options.select || '*'}_${whereStr}_${options.orderBy || ''}_${options.order || ''}_${options.limit || ''}_${options.offset || ''}`;
    }
    
    clearCache() {
        this.cache.clear();
    }
    
    async preloadContent() {
        // Preload trending content with timeout safety
        try {
            await this.query('Content', {
                select: '*',
                where: { status: 'published' },
                orderBy: 'views',
                order: 'desc',
                limit: 10,
                timeout: 5000 // Shorter timeout for preloading
            });
            console.log('✅ Preloaded trending content');
        } catch (error) {
            console.log('⚠️ Preloading failed, will load on demand:', error.message);
        }
    }
}

// Cache Manager
class CacheManager {
    constructor() {
        this.cacheName = 'bantu-stream-connect-v4'; // Incremented version to force fresh cache
        this.cacheTTL = 60 * 60 * 1000; // 1 hour
        this.currentVersion = 'v4'; // Updated to match cache name
    }
    
    async init() {
        await this.setupServiceWorker();
        this.setupCacheMonitoring();
        this.precacheCriticalAssets();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // First, clear any old service workers (version mismatch)
                await this.clearOldServiceWorkers();
                
                // Register the current service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ ServiceWorker registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New service worker installing...');
                    
                    newWorker.addEventListener('statechange', () => {
                        console.log('📱 Service worker state:', newWorker.state);
                        
                        // If new worker is activated, reload to ensure fresh content
                        if (newWorker.state === 'activated') {
                            console.log('🔄 New service worker activated - reloading for fresh content');
                            window.location.reload();
                        }
                    });
                });
                
                // Listen for controller change (new SW activated)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('🔄 Service worker controller changed - new version activated');
                });
                
            } catch (error) {
                console.log('❌ ServiceWorker registration failed:', error);
            }
        }
    }
    
    async clearOldServiceWorkers() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            
            for (const registration of registrations) {
                // Check if this is an old version
                // We consider any service worker with 'v3' in the URL as old (since we're on v4)
                if (registration.active && registration.active.scriptURL.includes('sw.js')) {
                    console.log('📱 Found service worker registration:', registration.active.scriptURL);
                    
                    // Check if this is likely an old version (you can customize this logic)
                    // For example, if the registration scope includes 'bantustreamconnect' but version mismatches
                    if (registration.scope.includes('bantustreamconnect')) {
                        // Unregister old service workers on version mismatch
                        // This ensures we're always running the latest version
                        const unregistered = await registration.unregister();
                        if (unregistered) {
                            console.log('🔄 Unregistered old service worker');
                            
                            // Clear all caches associated with this registration
                            await this.clearOldCaches();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error clearing old service workers:', error);
        }
    }
    
    async clearOldCaches() {
        if (!('caches' in window)) return;
        
        try {
            const cacheNames = await caches.keys();
            const oldCacheNames = cacheNames.filter(name => 
                name !== this.cacheName && name.startsWith('bantu-stream-connect')
            );
            
            await Promise.all(
                oldCacheNames.map(name => {
                    console.log('🗑️ Deleting old cache:', name);
                    return caches.delete(name);
                })
            );
            
            if (oldCacheNames.length > 0) {
                console.log('✅ Cleared old caches:', oldCacheNames);
            }
        } catch (error) {
            console.error('Error clearing old caches:', error);
        }
    }
    
    setupCacheMonitoring() {
        window.addEventListener('online', () => {
            this.updateCacheStatus('online');
            this.showToast('Back online', 'success');
            
            // When coming back online, check for service worker updates
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.update();
                });
            }
        });
        
        window.addEventListener('offline', () => {
            this.updateCacheStatus('offline');
            this.showToast('You are offline. Using cached content.', 'warning');
        });
    }
    
    updateCacheStatus(status) {
        const statusElement = document.getElementById('cache-status-text');
        if (statusElement) {
            statusElement.textContent = `Cache: ${status}`;
        }
    }
    
    async precacheCriticalAssets() {
        const criticalAssets = [
            '/',
            '/index.html',
            '/css/home-feed.css',
            '/css/home-feed-themes.css',
            '/css/home-feed-components.css',
            '/css/home-feed-utilities.css',
            '/css/home-feed-features.css',
            '/js/home-feed-core.js',
            '/js/home-feed-features.js',
            '/js/home-feed-ui.js',
            '/js/home-feed-utils.js',
            '/js/home-feed.js'
        ];
        
        if ('caches' in window) {
            try {
                const cache = await caches.open(this.cacheName);
                
                // Filter out non-existent URLs before caching
                const validAssets = [];
                for (const url of criticalAssets) {
                    try {
                        // Use HEAD request to check if asset exists
                        const response = await fetch(url, { method: 'HEAD' });
                        if (response.ok) {
                            validAssets.push(url);
                        } else {
                            console.log(`Skipping non-existent: ${url}`);
                        }
                    } catch (e) {
                        console.log(`Skipping non-existent: ${url} (error: ${e.message})`);
                    }
                }
                
                // Cache only valid assets
                await cache.addAll(validAssets);
                console.log('✅ Precached critical assets:', validAssets.length);
            } catch (error) {
                console.log('⚠️ Precaching failed:', error);
            }
        }
    }
    
    async cacheContent(content) {
        try {
            localStorage.setItem('cached_content', JSON.stringify(content));
            localStorage.setItem('cached_content_timestamp', Date.now().toString());
        } catch (error) {
            console.error('Failed to cache content:', error);
        }
    }
    
    getCachedContent() {
        try {
            const cached = localStorage.getItem('cached_content');
            const timestamp = localStorage.getItem('cached_content_timestamp');
            
            if (cached && timestamp) {
                const age = Date.now() - parseInt(timestamp);
                if (age < this.cacheTTL) {
                    return JSON.parse(cached);
                }
            }
        } catch (error) {
            console.error('Failed to get cached content:', error);
        }
        return null;
    }
    
    showToast(message, type) {
        // Implementation in utils
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`Toast (${type}):`, message);
        }
    }
    
    // New method to handle version mismatches
    handleVersionMismatch() {
        console.log('🔄 Version mismatch detected - clearing caches and reloading');
        
        // Clear all caches
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key.startsWith('bantu-stream-connect')) {
                        caches.delete(key);
                    }
                });
            });
        }
        
        // Clear service worker registrations
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                });
            }).then(() => {
                // Reload the page after cleaning up
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    }
    
    // Safe get method for external use
    get(key) {
        try {
            const cached = localStorage.getItem(`cache_${key}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < this.cacheTTL) {
                    return parsed.data;
                }
            }
        } catch (error) {
            console.error('Error reading from cache:', error);
        }
        return null;
    }
    
    // Safe set method for external use
    set(key, data, ttl = this.cacheTTL) {
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error writing to cache:', error);
        }
    }
    
    // Clear cache method
    clear() {
        try {
            // Clear only our cache keys
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('cache_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }
}

// Error Handler
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.setupErrorHandling();
    }
    
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error || event);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason);
        });
        
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                return await originalFetch(...args);
            } catch (error) {
                this.handleError(error);
                throw error;
            }
        };
    }
    
    handleError(error) {
        const errorData = {
            type: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            url: window.location.href
        };
        
        this.errors.push(errorData);
        this.logError(errorData);
        
        if (this.isCriticalError(error)) {
            this.showErrorModal(error);
        }
    }
    
    isCriticalError(error) {
        const criticalErrors = ['NetworkError', 'TypeError', 'SyntaxError', 'ReferenceError'];
        return criticalErrors.includes(error.name) || 
               error.message.includes('network') ||
               error.message.includes('connection') ||
               error.message.includes('timeout');
    }
    
    showErrorModal(error) {
        const modal = document.getElementById('error-recovery-modal');
        if (!modal) return;
        
        const message = document.getElementById('error-recovery-message');
        if (message) {
            message.textContent = this.getUserFriendlyMessage(error);
        }
        
        modal.style.display = 'flex';
    }
    
    getUserFriendlyMessage(error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
            return 'We\'re having trouble connecting to the server. You can continue using cached content.';
        }
        if (error.message.includes('timeout')) {
            return 'The request is taking too long. Please check your connection and try again.';
        }
        return 'Something went wrong. Please try again.';
    }
    
    logError(error) {
        console.error('❌ Error:', error);
        const stored = JSON.parse(localStorage.getItem('error_log') || '[]');
        stored.push(error);
        if (stored.length > 50) stored.shift();
        localStorage.setItem('error_log', JSON.stringify(stored));
    }
}

// Performance Monitor
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fcp: 0,
            lcp: 0,
            cls: 0,
            fid: 0
        };
        this.setupObservers();
    }
    
    setupObservers() {
        if ('PerformanceObserver' in window) {
            // FCP Observer
            try {
                const fcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.fcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('fcp', this.metrics.fcp);
                    }
                });
                fcpObserver.observe({ entryTypes: ['paint'] });
            } catch (e) {}
            
            // LCP Observer
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.lcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('lcp', this.metrics.lcp);
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {}
            
            // CLS Observer
            try {
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            this.metrics.cls += entry.value;
                        }
                    }
                    this.updateMetricDisplay('cls', this.metrics.cls);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {}
        }
    }
    
    updateMetricDisplay(metric, value) {
        const element = document.getElementById(`${metric}-metric`);
        if (element) {
            if (metric === 'cls') {
                element.textContent = value.toFixed(3);
            } else {
                element.textContent = `${(value / 1000).toFixed(2)}s`;
            }
        }
    }
    
    reportMetrics() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.checkPerformanceTargets();
            }, 1000);
        });
    }
    
    checkPerformanceTargets() {
        // FCP < 1.5s, LCP < 2.5s, CLS < 0.1
        if (this.metrics.fcp > 1500) {
            console.warn(`⚠️ FCP ${this.metrics.fcp}ms exceeds target 1500ms`);
        }
        if (this.metrics.lcp > 2500) {
            console.warn(`⚠️ LCP ${this.metrics.lcp}ms exceeds target 2500ms`);
        }
        if (this.metrics.cls > 0.1) {
            console.warn(`⚠️ CLS ${this.metrics.cls} exceeds target 0.1`);
        }
    }
}

// State Manager
class StateManager {
    constructor() {
        this.state = {
            content: [],
            filtered: [],
            loading: false,
            error: null,
            user: null,
            theme: 'dark',
            notifications: []
        };
        this.subscribers = [];
        this.loadState();
    }
    
    loadState() {
        const saved = localStorage.getItem('app_state');
        if (saved) {
            try {
                this.state = { ...this.state, ...JSON.parse(saved) };
            } catch (e) {
                console.log('Failed to load state:', e);
            }
        }
    }
    
    saveState() {
        try {
            localStorage.setItem('app_state', JSON.stringify(this.state));
        } catch (e) {
            console.log('Failed to save state:', e);
        }
    }
    
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.saveState();
        this.notify();
    }
    
    subscribe(callback) {
        this.subscribers.push(callback);
    }
    
    notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }
}

// Initialize global instances
const contentSupabase = new ContentSupabaseClient(
    'https://ydnxqnbjoshvxteevemc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
);

const cacheManager = new CacheManager();
const errorHandler = new ErrorHandler();
const performanceMonitor = new PerformanceMonitor();
const stateManager = new StateManager();

// Supabase Auth configuration
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// GLOBAL EXPORTS (MUST BE LAST)
// ============================================

// Export instances to window for other scripts
window.contentSupabase = contentSupabase;
window.cacheManager = cacheManager;  // ← THIS IS THE KEY FIX
window.errorHandler = errorHandler;
window.performanceMonitor = performanceMonitor;
window.stateManager = stateManager;
window.supabaseAuth = supabaseAuth;

// Export Supabase config for reuse
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Also export individual methods for backward compatibility
window.CacheManager = CacheManager;
window.ContentSupabaseClient = ContentSupabaseClient;
window.ErrorHandler = ErrorHandler;
window.PerformanceMonitor = PerformanceMonitor;
window.StateManager = StateManager;

console.log('✅ Home Feed Core exported to window');
console.log('📦 Cache Manager version:', cacheManager.currentVersion);
console.log('🔧 Service Worker cleanup enabled');
