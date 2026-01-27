/**
 * Main entry point for Bantu Stream Connect
 */

// Performance monitoring
window.PerformanceMetrics.mark('app_start');

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Bantu Stream Connect Initializing...');
        
        // 1. Initialize Auth Manager
        await window.AuthManager.init();
        
        // 2. Load UI components
        await import('./ui-manager.js');
        
        // 3. Setup event listeners
        setupEventListeners();
        
        // 4. Load content
        await window.ContentManager.loadHomeFeed();
        
        // 5. Hide loading screen
        hideLoadingScreen();
        
        // Performance mark
        window.PerformanceMetrics.mark('app_ready');
        window.PerformanceMetrics.measure('app_start', 'app_ready', 'App Initialization');
        
        console.log('✅ App initialized successfully');
        
        // Send performance metrics
        if (window.AppConfig.features.analytics) {
            sendPerformanceMetrics();
        }
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showErrorScreen(error);
    }
});

// Setup global event listeners
function setupEventListeners() {
    // Handle offline/online events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Handle visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle beforeunload for cleanup
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Error handling
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);
}

// Utility functions
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (app) app.style.display = 'block';
            
            // Trigger entrance animations
            document.body.classList.add('loaded');
        }, 300);
    }
}

function showErrorScreen(error) {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `
            <div class="error-screen" style="text-align: center; padding: 50px;">
                <h2>Something went wrong</h2>
                <p>We're having trouble loading the app. Please try refreshing.</p>
                <button onclick="location.reload()" style="padding: 12px 24px; background: var(--bantu-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Refresh Page
                </button>
                <p style="margin-top: 20px; color: var(--slate-grey); font-size: 14px;">
                    Error: ${error.message}
                </p>
            </div>
        `;
        app.style.display = 'block';
    }
}

function handleOnline() {
    console.log('🌐 Back online');
    window.UIManager.showToast('You are back online', 'success');
}

function handleOffline() {
    console.log('📴 You are offline');
    window.UIManager.showToast('You are offline. Some features may be unavailable.', 'warning');
}

function handleVisibilityChange() {
    if (document.hidden) {
        console.log('App backgrounded');
    } else {
        console.log('App foregrounded');
    }
}

function handleBeforeUnload(event) {
    // Perform cleanup
    if (window.AuthManager) {
        window.AuthManager.logSecurityEvent('app_unload');
    }
    
    // Cancel the event for modern browsers
    event.preventDefault();
    // Chrome requires returnValue to be set
    event.returnValue = '';
}

function handleGlobalError(event) {
    console.error('Global error:', event.error);
    
    // Send error to backend for logging
    if (window.AppConfig.features.analytics) {
        sendErrorReport(event.error);
    }
}

function handlePromiseRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Send error to backend
    if (window.AppConfig.features.analytics) {
        sendErrorReport(event.reason);
    }
}

function sendPerformanceMetrics() {
    const metrics = {
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        lcp: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
        fid: performance.getEntriesByName('first-input-delay')[0]?.duration,
        cls: performance.getEntriesByName('layout-shift')[0]?.value,
        tti: window.PerformanceMetrics.marks['app_ready'] - window.PerformanceMetrics.marks['app_start']
    };
    
    navigator.sendBeacon('/api/analytics', JSON.stringify({
        type: 'performance',
        metrics,
        timestamp: Date.now()
    }));
}

function sendErrorReport(error) {
    const errorData = {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
    };
    
    navigator.sendBeacon('/api/errors', JSON.stringify(errorData));
}
