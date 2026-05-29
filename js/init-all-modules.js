// js/init-all-modules.js - Master initializer for all modules
(function() {
    'use strict';
    
    console.log('🚀 Master Initializer: Starting module initialization...');
    
    // Wait for DOM and auth to be ready
    async function initializeAllModules() {
        // Wait for auth to be available
        let attempts = 0;
        while (!window.supabaseAuth && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.supabaseAuth) {
            console.error('❌ Supabase auth not available after waiting');
            return;
        }
        
        // Initialize modules in order
        const modules = [
            { name: 'Hero Content', init: () => window.HeroContentModule?.init?.() },
            { name: 'Continue Watching', init: () => window.ContinueWatchingModule?.init?.() },
            { name: 'Creator of the Week', init: () => window.CreatorOfTheWeekModule?.init?.() },
            { name: 'Community Favorites', init: () => window.CommunityFavoritesModule?.init?.() },
            { name: 'For You', init: () => window.ForYouModule?.init?.() },
            { name: 'Latest Gems', init: () => window.LatestGemsModule?.init?.() },
            { name: 'Live Now', init: () => window.LiveNowModule?.init?.() },
            { name: 'Trending Now', init: () => window.TrendingNowModule?.init?.() },
            { name: 'Upcoming Events', init: () => window.UpcomingEventsModule?.init?.() },
            { name: 'Wavelets', init: () => window.WaveletsModule?.init?.() },
            { name: 'Bantu Ink', init: () => window.BantuInkModule?.init?.() },
            { name: 'Africa Rising', init: () => window.AfricaRisingModule?.init?.() },
            { name: 'Midnight Sessions', init: () => window.MidnightSessionsModule?.init?.() },
            { name: 'Music', init: () => window.MusicModule?.init?.() },
            { name: 'Podcasts', init: () => window.PodcastsModule?.init?.() },
            { name: 'Series', init: () => window.SeriesModule?.init?.() }
        ];
        
        for (const module of modules) {
            try {
                if (module.init) {
                    await module.init();
                    console.log(`✅ ${module.name} initialized`);
                } else {
                    console.log(`⚠️ ${module.name} module not found`);
                }
            } catch (err) {
                console.error(`❌ Error initializing ${module.name}:`, err);
            }
        }
        
        // Dispatch event that all modules are initialized
        document.dispatchEvent(new CustomEvent('allModulesInitialized'));
        console.log('🎉 All modules initialization complete');
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAllModules);
    } else {
        initializeAllModules();
    }
})();
