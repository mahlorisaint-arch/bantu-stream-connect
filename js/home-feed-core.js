// Enhanced Supabase client with caching
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
    }
    
    async query(table, options = {}) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = 100,
            offset = 0
        } = options;
        
        // Generate cache key
        const cacheKey = this.generateCacheKey(table, options);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log('✅ Serving from cache:', cacheKey);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        
        // Build query URL
        let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;
        
        // Add filters - simplified to prevent very long URLs
        Object.keys(where).forEach((key, index) => {
            if (index < 5) { // Limit number of filters to prevent long URLs
                const value = where[key];
                if (typeof value === 'string' && value.includes('in.')) {
                    // Handle IN queries specially
                    queryUrl += `&${key}=${encodeURIComponent(value)}`;
                } else {
                    queryUrl += `&${key}=eq.${encodeURIComponent(value)}`;
                }
            }
        });
        
        // Add ordering
        if (orderBy) {
            queryUrl += `&order=${orderBy}.${order}`;
        }
        
        // Add limit and offset
        queryUrl += `&limit=${Math.min(limit, 100)}&offset=${offset}`;
        
        try {
            // Use AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
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
            
            // Try to get from localStorage cache
            try {
                const offlineCache = localStorage.getItem(`cache_${cacheKey}`);
                if (offlineCache) {
                    const parsed = JSON.parse(offlineCache);
                    if (Date.now() - parsed.timestamp < this.cacheTTL * 2) {
                        console.log('⚠️ Using offline cache:', cacheKey);
                        return parsed.data;
                    }
                }
            } catch (e) {
                console.log('Could not read from localStorage cache:', e);
            }
            
            // Return empty array instead of throwing for better UX
            if (error.name === 'AbortError') {
                console.log('Query timeout, returning empty results');
                return [];
            }
            
            throw error;
        }
    }
    
    generateCacheKey(table, options) {
        return `${table}_${JSON.stringify(options)}`;
    }
    
    clearCache() {
        this.cache.clear();
    }
    
    async preloadContent() {
        // Preload trending content
        try {
            await this.query('Content', {
                select: '*',
                where: { status: 'published' },
                orderBy: 'views',
                order: 'desc',
                limit: 10
            });
            console.log('✅ Preloaded trending content');
        } catch (error) {
            console.log('⚠️ Preloading failed, will load on demand');
        }
    }
}

// Cache Manager
class CacheManager {
    constructor() {
        this.cacheName = 'bantu-stream-connect-v2';
        this.cacheTTL = 60 * 60 * 1000; // 1 hour
    }
    
    async init() {
        await this.setupServiceWorker();
        this.setupCacheMonitoring();
        this.precacheCriticalAssets();
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    }
    
    setupCacheMonitoring() {
        window.addEventListener('online', () => {
            this.updateCacheStatus('online');
            this.showToast('Back online', 'success');
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
            '/js/home-feed-core.js',
            '/js/home-feed-features.js',
            '/js/home-feed-ui.js',
            '/js/home-feed-utils.js',
            '/js/home-feed.js'
        ];
        
        if ('caches' in window) {
            try {
                const cache = await caches.open(this.cacheName);
                await cache.addAll(criticalAssets);
            } catch (error) {
                console.log('Precaching failed:', error);
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
               error.message.includes('connection');
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
                        this.metrics.cls += entry.value;
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

console.log('✅ Home Feed Core initialized');
