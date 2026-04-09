// ============================================
// PERFORMANCE LOADER - YouTube-style progressive loading
// ============================================

class PerformanceLoader {
    constructor() {
        this.loadingScreen = document.getElementById('loading');
        this.app = document.getElementById('app');
        this.loadStartTime = performance.now();
    }

    async init() {
        console.log('🚀 Performance Loader starting...');
        
        // Phase 1: Show skeleton UI IMMEDIATELY (0-100ms)
        this.showSkeletonUI();
        
        // Phase 2: Load critical data in PARALLEL (100-500ms)
        await this.loadCriticalData();
        
        // Phase 3: Lazy load non-critical sections (after render)
        this.lazyLoadNonCritical();
        
        // Phase 4: Hide loading screen and show content
        this.showContent();
    }

    showSkeletonUI() {
        // Hide loading screen, show skeleton immediately
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
        if (this.app) {
            this.app.style.display = 'block';
        }
        
        // Inject skeleton cards if grid is empty
        const grids = ['continue-watching-grid', 'for-you-grid', 'trending-grid', 'new-content-grid'];
        grids.forEach(gridId => {
            const grid = document.getElementById(gridId);
            if (grid && grid.children.length === 0) {
                grid.innerHTML = Array(4).fill().map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-thumbnail"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-creator"></div>
                        <div class="skeleton-stats"></div>
                    </div>
                `).join('');
            }
        });
    }

    async loadCriticalData() {
        // Load ONLY the first 2 sections in parallel
        console.log('📡 Loading critical data in parallel...');
        
        const criticalTasks = [
            this.loadWithTimeout(() => loadContinueWatchingSection(), 3000),
            this.loadWithTimeout(() => loadForYouSection(), 3000)
        ];
        
        // Also load user data in parallel
        if (window.currentUser) {
            criticalTasks.push(this.loadWithTimeout(() => loadUserProfiles(), 2000));
            criticalTasks.push(this.loadWithTimeout(() => updateHeaderProfile(), 2000));
        }
        
        await Promise.all(criticalTasks);
        console.log('✅ Critical data loaded');
    }

    lazyLoadNonCritical() {
        // Use requestIdleCallback or setTimeout to load remaining sections
        const nonCriticalSections = [
            { name: 'Trending', fn: () => loadTrendingSection(), delay: 100 },
            { name: 'New Content', fn: () => loadNewContentSection(), delay: 200 },
            { name: 'Community Favorites', fn: () => loadCommunityFavoritesSection(), delay: 300 },
            { name: 'Live Streams', fn: () => loadLiveStreamsSection(), delay: 400 },
            { name: 'Featured Creators', fn: () => loadFeaturedCreatorsSection(), delay: 500 },
            { name: 'Events', fn: () => loadEventsSection(), delay: 600 },
            { name: 'Community Stats', fn: () => loadCommunityStats(), delay: 700 }
        ];
        
        // Use requestIdleCallback if available
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                nonCriticalSections.forEach(section => {
                    setTimeout(() => {
                        section.fn().catch(console.warn);
                        console.log(`🔄 Lazy loading: ${section.name}`);
                    }, section.delay);
                });
            }, { timeout: 2000 });
        } else {
            // Fallback to setTimeout
            nonCriticalSections.forEach(section => {
                setTimeout(() => {
                    section.fn().catch(console.warn);
                }, section.delay);
            });
        }
    }

    async loadWithTimeout(fn, timeoutMs = 5000) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            )
        ]).catch(err => {
            console.warn('⏱️ Function timed out:', err);
            return null;
        });
    }

    showContent() {
        // Animate cards in with stagger
        const cards = document.querySelectorAll('.content-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 + (index * 20));
        });
        
        const loadTime = performance.now() - this.loadStartTime;
        console.log(`🎉 Page ready in ${loadTime.toFixed(0)}ms`);
        
        // Report to analytics
        if (window.gtag) {
            window.gtag('event', 'performance', {
                'event_category': 'page_load',
                'event_label': 'home_feed',
                'value': Math.round(loadTime)
            });
        }
    }
}

// Override initializeHomeFeed with performance loader
window.performanceLoader = new PerformanceLoader();

// Replace the old initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.performanceLoader.init();
    });
} else {
    window.performanceLoader.init();
}
