/**
 * Streak Banner Module
 * Slim inline element (not a card/rail) showing the user's real watch
 * streak, backed by the user_streaks table + touch_watch_streak() RPC
 * (see supabase/migrations/20260726_user_streaks.sql). The RPC is called
 * from js/supabase-helper.js's recordContentView(), the platform's real
 * "user actually watched enough of this" signal - this module only reads
 * and displays whatever that produced, it never writes.
 */
const StreakBannerModule = (function() {
    'use strict';

    let container = null;
    let currentUser = null;

    async function init() {
        console.log('🔥 Streak Banner Module initializing...');

        container = document.getElementById('streak-banner');
        if (!container) {
            console.warn('Streak banner element not found');
            return;
        }

        await getCurrentUser();

        if (!currentUser) {
            container.style.display = 'none';
            return;
        }

        await render();
        console.log('✅ Streak Banner Module initialized');
    }

    async function getCurrentUser() {
        try {
            if (!window.supabaseAuth) {
                currentUser = null;
                return;
            }
            const { data: { session } } = await window.supabaseAuth.auth.getSession();
            currentUser = session?.user || null;
        } catch (err) {
            console.error('Error getting current user for streak banner:', err);
            currentUser = null;
        }
    }

    async function render() {
        try {
            const { data, error } = await window.supabaseAuth
                .from('user_streaks')
                .select('current_streak_days, last_activity_date')
                .eq('user_id', currentUser.id)
                .eq('streak_type', 'watch')
                .maybeSingle();

            if (error) throw error;

            // No row at all = never watched anything real yet. Hide
            // entirely rather than show a hollow "Day 0" placeholder.
            if (!data) {
                container.style.display = 'none';
                return;
            }

            const days = data.current_streak_days || 0;
            let message;
            if (days <= 1) {
                // First watch today, no real streak earned yet - showing
                // "Day 1" here would read as a hollow milestone.
                message = 'You watched today — come back tomorrow to start a streak.';
            } else {
                message = `Day ${days} — watch today to keep your streak going.`;
            }

            container.innerHTML = `
                <i class="fas fa-fire"></i>
                <span>${message}</span>
            `;
            container.style.display = 'flex';
        } catch (err) {
            console.error('Error loading streak banner:', err);
            container.style.display = 'none';
        }
    }

    return { init };
})();

window.StreakBannerModule = StreakBannerModule;
