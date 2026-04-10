// ============================================
// PERFORMANCE LOADER - Fixed version
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
        
        // Define critical tasks - check if functions exist before calling
        const criticalTasks = [];
        
        if (typeof loadContinueWatchingSection === 'function') {
            criticalTasks.push(this.loadWithTimeout(() => loadContinueWatchingSection(), 3000));
        } else {
            console.warn('⚠️ loadContinueWatchingSection not defined yet, waiting...');
            // Wait for it to be defined (from home-feed-features.js)
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (typeof loadContinueWatchingSection === 'function') {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                setTimeout(resolve, 2000); // Fallback after 2 seconds
            });
            if (typeof loadContinueWatchingSection === 'function') {
                criticalTasks.push(this.loadWithTimeout(() => loadContinueWatchingSection(), 3000));
            }
        }
        
        if (typeof loadForYouSection === 'function') {
            criticalTasks.push(this.loadWithTimeout(() => loadForYouSection(), 3000));
        }
        
        // Also load user data in parallel
        if (window.currentUser) {
            if (typeof loadUserProfiles === 'function') {
                criticalTasks.push(this.loadWithTimeout(() => loadUserProfiles(), 2000));
            }
            if (typeof updateHeaderProfile === 'function') {
                criticalTasks.push(this.loadWithTimeout(() => updateHeaderProfile(), 2000));
            }
        }
        
        if (criticalTasks.length > 0) {
            await Promise.all(criticalTasks);
        }
        console.log('✅ Critical data loaded');
    }

    lazyLoadNonCritical() {
        // Use requestIdleCallback or setTimeout to load remaining sections
        const nonCriticalSections = [
            { name: 'Cinematic Hero', fn: () => typeof loadCinematicHero === 'function' ? loadCinematicHero() : Promise.resolve(), delay: 100 },
            { name: 'Following', fn: () => typeof loadFollowingSection === 'function' ? loadFollowingSection() : Promise.resolve(), delay: 200 },
            { name: 'Shorts', fn: () => typeof loadShortsSection === 'function' ? loadShortsSection() : Promise.resolve(), delay: 300 },
            { name: 'Community Favorites', fn: () => typeof loadCommunityFavoritesSection === 'function' ? loadCommunityFavoritesSection() : Promise.resolve(), delay: 400 },
            { name: 'Live Streams', fn: () => typeof loadLiveStreamsSection === 'function' ? loadLiveStreamsSection() : Promise.resolve(), delay: 500 },
            { name: 'Featured Creators', fn: () => typeof loadFeaturedCreatorsSection === 'function' ? loadFeaturedCreatorsSection() : Promise.resolve(), delay: 600 },
            { name: 'Events', fn: () => typeof loadEventsSection === 'function' ? loadEventsSection() : Promise.resolve(), delay: 700 },
            { name: 'Community Stats', fn: () => typeof loadCommunityStats === 'function' ? loadCommunityStats() : Promise.resolve(), delay: 800 }
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

// Initialize ONLY if not already initialized by home-feed-features.js
if (!window.performanceLoader) {
    window.performanceLoader = new PerformanceLoader();
    
    // Wait for DOM and dependencies
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Small delay to ensure home-feed-features.js has loaded
            setTimeout(() => {
                window.performanceLoader.init();
            }, 100);
        });
    } else {
        setTimeout(() => {
            window.performanceLoader.init();
        }, 100);
    }
}
