// ============================================
// HOME FEED CORE MODULE - OPTIMIZED FOR SPEED
// ============================================
// This file contains all core systems for the Bantu platform home feed
// Includes: Enhanced Supabase Client, Cache Manager, Error Handler, 
// Performance Monitor, State Manager, and Supabase Auth
// ============================================

// ============================================
// OPTIMIZED CONTENT SUPABASE CLIENT
// ============================================
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
        this.requestTimeout = 15000; // 15 second timeout
        this.defaultLimit = 15; // Reduced from 100 for performance
    }
    
    async query(table, options = {}, retryCount = 0) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = this.defaultLimit,
            offset = 0,
            timeout = this.requestTimeout
        } = options;

        // Generate cache key
        const cacheKey = this.generateCacheKey(table, { select, where, orderBy, order, limit, offset });
        
        // Check memory cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log('✅ Serving from memory cache:', cacheKey);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        
        // Check localStorage cache
        const localStorageCache = this.getFromLocalStorage(cacheKey);
        if (localStorageCache) {
            console.log('✅ Serving from localStorage cache:', cacheKey);
            return localStorageCache;
        }

        // Build query URL with CORRECT Supabase syntax
        let queryUrl = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

        // Add filters - handles different operators
        Object.keys(where).forEach(key => {
            const value = where[key];
            
            if (typeof value === 'string' && (value.startsWith('in.') || value.startsWith('gte.') || value.startsWith('lte.'))) {
                queryUrl += `&${key}=${encodeURIComponent(value)}`;
            } else {
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
                if (response.status === 408) {
                    throw new Error(`Request timeout after ${timeout}ms. Server is overloaded.`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            // Store in memory cache
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            // Store in localStorage for offline/persistence
            this.saveToLocalStorage(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Supabase query error:', error);

            // Retry on abort/timeout errors (max 2 retries)
            if ((error.name === 'AbortError' || error.message?.includes('timeout')) && retryCount < 2) {
                console.log(`⚠️ Retry ${retryCount + 1}/2 for query`);
                
                // Exponential backoff
                const backoffTime = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                
                // Simplify query on retry
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
                        timeout: timeout * 1.5
                    }, retryCount + 1);
                }
            }

            // Fallback to localStorage cache on error
            const fallbackCache = this.getFromLocalStorage(cacheKey);
            if (fallbackCache) {
                console.log('⚠️ Using localStorage fallback cache');
                return fallbackCache;
            }
            
            throw error;
        }
    }
    
    generateCacheKey(table, options) {
        const whereStr = JSON.stringify(Object.keys(options.where || {}).sort().reduce((obj, key) => {
            obj[key] = options.where[key];
            return obj;
        }, {}));
        return `${table}_${options.select || '*'}_${whereStr}_${options.orderBy || ''}_${options.order || ''}_${options.limit || ''}_${options.offset || ''}`;
    }
    
    getFromLocalStorage(cacheKey) {
        try {
            const cached = localStorage.getItem(`bantu_cache_${cacheKey}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < this.cacheTTL) {
                    return parsed.data;
                }
                localStorage.removeItem(`bantu_cache_${cacheKey}`);
            }
        } catch (e) {
            console.log('Could not read from localStorage:', e);
        }
        return null;
    }
    
    saveToLocalStorage(cacheKey, data) {
        try {
            localStorage.setItem(`bantu_cache_${cacheKey}`, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.log('Could not save to localStorage:', e);
        }
    }
    
    clearCache() {
        this.cache.clear();
        // Clear localStorage cache as well
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('bantu_cache_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🗑️ Cache cleared');
    }
    
    async preloadContent() {
        try {
            await this.query('Content', {
                select: 'id,title,thumbnail_url,duration,user_id,language,created_at',
                where: { status: 'published' },
                orderBy: 'views_count',
                order: 'desc',
                limit: 10,
                timeout: 5000
            });
            console.log('✅ Preloaded trending content');
        } catch (error) {
            console.log('⚠️ Preloading failed, will load on demand:', error.message);
        }
    }
}

// ============================================
// OPTIMIZED CACHE MANAGER
// ============================================
class CacheManager {
    constructor() {
        this.cacheName = 'bantu-stream-connect-v5';
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.currentVersion = 'v5';
    }
    
    async init() {
        await this.setupServiceWorker();
        this.setupCacheMonitoring();
        this.precacheCriticalAssets();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await this.clearOldServiceWorkers();
                
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ ServiceWorker registered:', registration);
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New service worker installing...');
                    
                    newWorker.addEventListener('statechange', () => {
                        console.log('📱 Service worker state:', newWorker.state);
                        if (newWorker.state === 'activated') {
                            console.log('🔄 New service worker activated');
                        }
                    });
                });
                
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('🔄 Service worker controller changed');
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
                if (registration.active && registration.active.scriptURL.includes('sw.js')) {
                    console.log('📱 Found service worker registration:', registration.active.scriptURL);
                    
                    if (registration.scope.includes('bantustreamconnect')) {
                        const unregistered = await registration.unregister();
                        if (unregistered) {
                            console.log('🔄 Unregistered old service worker');
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
            '/css/home-feed-ui.css',
            '/css/home-feed-features.css',
            '/js/home-feed-core.js',
            '/js/home-feed-features.js',
            '/js/home-feed-ui.js',
            '/js/home-feed.js',
            '/js/rate-limiter.js',
            '/js/image-fix.js'
        ];
        
        if ('caches' in window) {
            try {
                const cache = await caches.open(this.cacheName);
                
                const validAssets = [];
                for (const url of criticalAssets) {
                    try {
                        const response = await fetch(url, { method: 'HEAD' });
                        if (response.ok) {
                            validAssets.push(url);
                        } else {
                            console.log(`Skipping non-existent: ${url}`);
                        }
                    } catch (e) {
                        console.log(`Skipping non-existent: ${url}`);
                    }
                }
                
                if (validAssets.length > 0) {
                    await cache.addAll(validAssets);
                    console.log('✅ Precached critical assets:', validAssets.length);
                }
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
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`Toast (${type}):`, message);
        }
    }
    
    handleVersionMismatch() {
        console.log('🔄 Version mismatch detected - clearing caches and reloading');
        
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key.startsWith('bantu-stream-connect')) {
                        caches.delete(key);
                    }
                });
            });
        }
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                });
            }).then(() => {
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    }
    
    get(key) {
        try {
            const cached = localStorage.getItem(`bantu_cache_${key}`);
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
    
    set(key, data, ttl = this.cacheTTL) {
        try {
            localStorage.setItem(`bantu_cache_${key}`, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error writing to cache:', error);
        }
    }
    
    clear() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('bantu_cache_')) {
                    localStorage.removeItem(key);
                }
            });
            console.log('🗑️ Cache cleared');
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }
}

// ============================================
// ERROR HANDLER
// ============================================
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
               error.message?.includes('network') ||
               error.message?.includes('connection') ||
               error.message?.includes('timeout');
    }
    
    showErrorModal(error) {
        const modal = document.getElementById('error-recovery-modal');
        if (!modal) return;
        
        const message = document.getElementById('error-recovery-message');
        if (message) {
            message.textContent = this.getUserFriendlyMessage(error);
        }
        
        modal.style.display = 'flex';
        
        const closeBtn = document.getElementById('close-error-modal');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        
        const retryBtn = document.getElementById('retry-recovery-btn');
        if (retryBtn) {
            retryBtn.onclick = () => {
                modal.style.display = 'none';
                window.location.reload();
            };
        }
    }
    
    getUserFriendlyMessage(error) {
        if (error.message?.includes('network') || error.message?.includes('connection')) {
            return 'We\'re having trouble connecting to the server. You can continue using cached content.';
        }
        if (error.message?.includes('timeout')) {
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

// ============================================
// PERFORMANCE MONITOR
// ============================================
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
            try {
                const fcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.fcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('fcp', this.metrics.fcp);
                        this.logMetric('FCP', this.metrics.fcp);
                    }
                });
                fcpObserver.observe({ entryTypes: ['paint'] });
            } catch (e) {}
            
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        this.metrics.lcp = entries[entries.length - 1].startTime;
                        this.updateMetricDisplay('lcp', this.metrics.lcp);
                        this.logMetric('LCP', this.metrics.lcp);
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {}
            
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            this.metrics.cls = clsValue;
                        }
                    }
                    this.updateMetricDisplay('cls', this.metrics.cls);
                    this.logMetric('CLS', this.metrics.cls);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {}
        }
        
        // Measure TTI (Time to Interactive)
        if ('PerformanceLongTaskTiming' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    if (entries.length > 0) {
                        console.warn(`⚠️ Long task detected: ${entries[0].duration}ms`);
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
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
    
    logMetric(name, value) {
        const formattedValue = name === 'CLS' ? value.toFixed(3) : `${(value / 1000).toFixed(2)}s`;
        console.log(`📊 Performance Metric - ${name}: ${formattedValue}`);
    }
    
    reportMetrics() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.checkPerformanceTargets();
            }, 1000);
        });
    }
    
    checkPerformanceTargets() {
        const warnings = [];
        if (this.metrics.fcp > 1500) warnings.push(`FCP ${this.metrics.fcp}ms > 1500ms`);
        if (this.metrics.lcp > 2500) warnings.push(`LCP ${this.metrics.lcp}ms > 2500ms`);
        if (this.metrics.cls > 0.1) warnings.push(`CLS ${this.metrics.cls} > 0.1`);
        
        if (warnings.length > 0) {
            console.warn('⚠️ Performance targets not met:', warnings.join(', '));
        } else {
            console.log('✅ All performance targets met!');
        }
    }
    
    getLoadTime() {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`📊 Page load time: ${loadTime}ms`);
        return loadTime;
    }
}

// ============================================
// STATE MANAGER
// ============================================
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
    
    getState() {
        return { ...this.state };
    }
    
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }
    
    notify() {
        this.subscribers.forEach(callback => callback(this.state));
    }
    
    clearState() {
        this.state = {
            content: [],
            filtered: [],
            loading: false,
            error: null,
            user: null,
            theme: 'dark',
            notifications: []
        };
        this.saveState();
        this.notify();
    }
}

// ============================================
// INITIALIZE GLOBAL INSTANCES
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Create optimized instances
const contentSupabase = new ContentSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const cacheManager = new CacheManager();
const errorHandler = new ErrorHandler();
const performanceMonitor = new PerformanceMonitor();
const stateManager = new StateManager();

// Create Supabase Auth client
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// GLOBAL EXPORTS
// ============================================
window.contentSupabase = contentSupabase;
window.cacheManager = cacheManager;
window.errorHandler = errorHandler;
window.performanceMonitor = performanceMonitor;
window.stateManager = stateManager;
window.supabaseAuth = supabaseAuth;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Export classes for backward compatibility
window.ContentSupabaseClient = ContentSupabaseClient;
window.CacheManager = CacheManager;
window.ErrorHandler = ErrorHandler;
window.PerformanceMonitor = PerformanceMonitor;
window.StateManager = StateManager;

console.log('✅ Home Feed Core exported to window');
console.log('📦 Cache Manager version:', cacheManager.currentVersion);
console.log('📊 Default query limit:', contentSupabase.defaultLimit);

// ============================================
// INITIALIZE CORE SYSTEMS
// ============================================
(async function initializeCore() {
    console.log('🚀 Initializing Core Systems...');
    
    const startTime = performance.now();
    
    // Initialize cache manager
    if (cacheManager && cacheManager.init) {
        await cacheManager.init();
        console.log('✅ Cache Manager initialized');
    }
    
    // Initialize performance monitoring
    if (performanceMonitor) {
        performanceMonitor.reportMetrics();
        console.log('✅ Performance Monitor initialized');
    }
    
    // Check authentication status
    if (supabaseAuth) {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (session?.user) {
                window.currentUser = session.user;
                console.log('✅ User authenticated:', session.user.email);
            } else {
                window.currentUser = null;
                console.log('ℹ️ User not authenticated');
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            window.currentUser = null;
        }
    }
    
    const initTime = performance.now() - startTime;
    console.log(`✅ Core Systems ready in ${initTime.toFixed(2)}ms`);
    
    // Dispatch event that core is ready
    window.dispatchEvent(new CustomEvent('coreReady', { 
        detail: { 
            cacheManager: !!window.cacheManager,
            supabaseAuth: !!window.supabaseAuth,
            currentUser: window.currentUser,
            initTime: initTime
        } 
    }));
})();

// ============================================
// HELPER: CLEAR ALL CACHES (for debugging)
// ============================================
window.clearAllCaches = function() {
    if (cacheManager) cacheManager.clear();
    if (contentSupabase) contentSupabase.clearCache();
    console.log('🗑️ All caches cleared');
    showToast('Caches cleared', 'success');
};

// ============================================
// HELPER: GET CACHE STATS
// ============================================
window.getCacheStats = function() {
    let cacheCount = 0;
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('bantu_cache_')) cacheCount++;
    });
    console.log(`📦 Cache stats: ${cacheCount} items in localStorage`);
    return { cacheCount };
};
