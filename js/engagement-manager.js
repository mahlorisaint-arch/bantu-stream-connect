// js/engagement-manager.js
// CENTRALIZED YOUTUBE-STYLE ENGAGEMENT SYSTEM
// ============================================
// Version: 1.0.0 - Production Ready
// Purpose: Single source of truth for all engagement operations
// Tables: content_likes, favorites, watch_later, content_shares, content_events, content_views
// ============================================
// 🎯 RESPONSIBILITIES:
// - Load persistent engagement states (likes, favorites, watch later)
// - Toggle operations with optimistic UI support
// - Record shares with analytics events
// - Realtime metric subscriptions
// - Centralized error handling
// - Cache management for instant UI responses
// ============================================
// 🚨 INTEGRATION NOTES:
// - Works with existing tables: content_likes, favorites, watch_later
// - Foreign keys reference auth.users (user_id)
// - Content references "Content"(id) as bigint
// - No views_count column - uses content_views table correctly
// ============================================

console.log('🎯 EngagementManager initializing... (v1.0.0 - YouTube-style Engagement System)');

class EngagementManager {
    constructor(options = {}) {
        this.supabase = options.supabase || window.supabaseClient;
        this.userId = options.userId || null;
        this.cache = {
            liked: new Set(),
            favorited: new Set(),
            watchLater: new Set()
        };
        this.pendingOperations = new Map();
        this.realtimeSubscriptions = new Map();
        this._initialized = false;
        
        console.log('✅ EngagementManager instantiated');
    }

    /**
     * Initialize the EngagementManager with current user
     * @param {string} userId - Current user ID from auth
     */
    async initialize(userId) {
        if (!userId) {
            console.warn('⚠️ EngagementManager: No userId provided, engagement features limited');
            this.userId = null;
            this._initialized = true;
            return;
        }
        
        this.userId = userId;
        this._initialized = true;
        console.log('✅ EngagementManager initialized for user:', userId);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.userId;
    }

    /**
     * Get current user ID
     */
    getUserId() {
        return this.userId;
    }

    // =====================================================
    // 1. LOAD PERSISTENT STATES (For UI initialization)
    // =====================================================

    /**
     * Load ALL engagement states for a content item
     * @param {number|string} contentId - Content ID
     * @returns {Promise<{liked: boolean, favorited: boolean, watchLater: boolean}>}
     */
    async loadState(contentId, userId = null) {
        const uid = userId || this.userId;
        
        if (!uid) {
            console.log('⚠️ loadState: No user ID, returning false for all states');
            return { liked: false, favorited: false, watchLater: false };
        }

        if (!contentId) {
            console.error('❌ loadState: Missing contentId');
            return { liked: false, favorited: false, watchLater: false };
        }

        try {
            const [likeRes, favRes, wlRes] = await Promise.all([
                this.supabase
                    .from('content_likes')
                    .select('id')
                    .eq('content_id', contentId)
                    .eq('user_id', uid)
                    .maybeSingle(),
                this.supabase
                    .from('favorites')
                    .select('id')
                    .eq('content_id', contentId)
                    .eq('user_id', uid)
                    .maybeSingle(),
                this.supabase
                    .from('watch_later')
                    .select('id')
                    .eq('content_id', contentId)
                    .eq('user_id', uid)
                    .maybeSingle()
            ]);

            const states = {
                liked: !!likeRes.data,
                favorited: !!favRes.data,
                watchLater: !!wlRes.data
            };

            // Update cache
            if (states.liked) this.cache.liked.add(String(contentId));
            else this.cache.liked.delete(String(contentId));
            
            if (states.favorited) this.cache.favorited.add(String(contentId));
            else this.cache.favorited.delete(String(contentId));
            
            if (states.watchLater) this.cache.watchLater.add(String(contentId));
            else this.cache.watchLater.delete(String(contentId));

            console.log(`✅ loadState for content ${contentId}:`, states);
            return states;

        } catch (error) {
            console.error('❌ loadState failed:', error);
            return { liked: false, favorited: false, watchLater: false };
        }
    }

    /**
     * Load multiple content states in batch
     * @param {Array<number|string>} contentIds - Array of content IDs
     * @returns {Promise<Map<string, {liked: boolean, favorited: boolean, watchLater: boolean}>>}
     */
    async loadBatchStates(contentIds, userId = null) {
        const uid = userId || this.userId;
        
        if (!uid || !contentIds || contentIds.length === 0) {
            return new Map();
        }

        try {
            const [likesRes, favsRes, wlRes] = await Promise.all([
                this.supabase
                    .from('content_likes')
                    .select('content_id')
                    .eq('user_id', uid)
                    .in('content_id', contentIds),
                this.supabase
                    .from('favorites')
                    .select('content_id')
                    .eq('user_id', uid)
                    .in('content_id', contentIds),
                this.supabase
                    .from('watch_later')
                    .select('content_id')
                    .eq('user_id', uid)
                    .in('content_id', contentIds)
            ]);

            const likedSet = new Set((likesRes.data || []).map(l => String(l.content_id)));
            const favSet = new Set((favsRes.data || []).map(f => String(f.content_id)));
            const wlSet = new Set((wlRes.data || []).map(w => String(w.content_id)));

            const results = new Map();
            contentIds.forEach(id => {
                const strId = String(id);
                results.set(strId, {
                    liked: likedSet.has(strId),
                    favorited: favSet.has(strId),
                    watchLater: wlSet.has(strId)
                });
            });

            return results;

        } catch (error) {
            console.error('❌ loadBatchStates failed:', error);
            return new Map();
        }
    }

    // =====================================================
    // 2. LIKE SYSTEM
    // =====================================================

    /**
     * Toggle like status for a content item
     * @param {number|string} contentId - Content ID
     * @param {string} userId - User ID (optional, uses instance userId)
     * @param {boolean} isCurrentlyLiked - Current state for optimistic updates
     * @returns {Promise<boolean>} - New state (true = liked, false = unliked)
     */
    async toggleLike(contentId, userId = null, isCurrentlyLiked = false) {
        const uid = userId || this.userId;
        
        if (!uid) {
            console.warn('⚠️ toggleLike: User not authenticated');
            throw new Error('User not authenticated');
        }

        if (!contentId) {
            throw new Error('Content ID required');
        }

        // Prevent duplicate pending operations
        const operationKey = `like_${contentId}`;
        if (this.pendingOperations.has(operationKey)) {
            console.log(`⏳ Like operation already pending for ${contentId}, returning cached result`);
            return isCurrentlyLiked;
        }

        this.pendingOperations.set(operationKey, true);
        const newState = !isCurrentlyLiked;

        try {
            if (newState) {
                // Add like
                const { error } = await this.supabase
                    .from('content_likes')
                    .insert({
                        user_id: uid,
                        content_id: contentId
                    });
                
                if (error) {
                    if (error.code === '23505') {
                        console.log(`ℹ️ Like already exists for content ${contentId}`);
                    } else {
                        throw error;
                    }
                }
                this.cache.liked.add(String(contentId));
                console.log(`✅ Like added for content ${contentId}`);
            } else {
                // Remove like
                const { error } = await this.supabase
                    .from('content_likes')
                    .delete()
                    .eq('user_id', uid)
                    .eq('content_id', contentId);
                
                if (error) throw error;
                this.cache.liked.delete(String(contentId));
                console.log(`✅ Like removed for content ${contentId}`);
            }

            // Increment/Decrement counter via RPC
            await this._updateEngagementCounter(contentId, 'likes', newState ? 1 : -1);

            return newState;

        } catch (error) {
            console.error('❌ toggleLike failed:', error);
            throw error;
        } finally {
            this.pendingOperations.delete(operationKey);
        }
    }

    /**
     * Check if user has liked a content item
     * @param {number|string} contentId - Content ID
     * @returns {Promise<boolean>}
     */
    async isLiked(contentId, userId = null) {
        const uid = userId || this.userId;
        
        if (!uid || !contentId) return false;
        
        // Check cache first
        if (this.cache.liked.has(String(contentId))) return true;
        
        try {
            const { data, error } = await this.supabase
                .from('content_likes')
                .select('id')
                .eq('user_id', uid)
                .eq('content_id', contentId)
                .maybeSingle();
            
            if (error) throw error;
            
            const liked = !!data;
            if (liked) this.cache.liked.add(String(contentId));
            return liked;
            
        } catch (error) {
            console.error('❌ isLiked check failed:', error);
            return false;
        }
    }

    // =====================================================
    // 3. FAVORITE SYSTEM
    // =====================================================

    /**
     * Toggle favorite status for a content item
     * @param {number|string} contentId - Content ID
     * @param {string} userId - User ID (optional)
     * @param {boolean} isCurrentlyFavorited - Current state
     * @returns {Promise<boolean>} - New state
     */
    async toggleFavorite(contentId, userId = null, isCurrentlyFavorited = false) {
        const uid = userId || this.userId;
        
        if (!uid) {
            throw new Error('User not authenticated');
        }

        if (!contentId) {
            throw new Error('Content ID required');
        }

        const operationKey = `fav_${contentId}`;
        if (this.pendingOperations.has(operationKey)) {
            console.log(`⏳ Favorite operation pending for ${contentId}`);
            return isCurrentlyFavorited;
        }

        this.pendingOperations.set(operationKey, true);
        const newState = !isCurrentlyFavorited;

        try {
            if (newState) {
                const { error } = await this.supabase
                    .from('favorites')
                    .insert({
                        user_id: uid,
                        content_id: contentId
                    });
                
                if (error && error.code !== '23505') throw error;
                this.cache.favorited.add(String(contentId));
                console.log(`✅ Favorite added for content ${contentId}`);
            } else {
                const { error } = await this.supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', uid)
                    .eq('content_id', contentId);
                
                if (error) throw error;
                this.cache.favorited.delete(String(contentId));
                console.log(`✅ Favorite removed for content ${contentId}`);
            }

            await this._updateEngagementCounter(contentId, 'favorites', newState ? 1 : -1);
            return newState;

        } catch (error) {
            console.error('❌ toggleFavorite failed:', error);
            throw error;
        } finally {
            this.pendingOperations.delete(operationKey);
        }
    }

    /**
     * Check if user has favorited a content item
     * @param {number|string} contentId - Content ID
     * @returns {Promise<boolean>}
     */
    async isFavorited(contentId, userId = null) {
        const uid = userId || this.userId;
        
        if (!uid || !contentId) return false;
        
        if (this.cache.favorited.has(String(contentId))) return true;
        
        try {
            const { data, error } = await this.supabase
                .from('favorites')
                .select('id')
                .eq('user_id', uid)
                .eq('content_id', contentId)
                .maybeSingle();
            
            if (error) throw error;
            
            const favorited = !!data;
            if (favorited) this.cache.favorited.add(String(contentId));
            return favorited;
            
        } catch (error) {
            console.error('❌ isFavorited check failed:', error);
            return false;
        }
    }

    // =====================================================
    // 4. WATCH LATER SYSTEM
    // =====================================================

    /**
     * Toggle watch later status for a content item
     * @param {number|string} contentId - Content ID
     * @param {string} userId - User ID (optional)
     * @param {boolean} isCurrentlySaved - Current state
     * @returns {Promise<boolean>} - New state
     */
    async toggleWatchLater(contentId, userId = null, isCurrentlySaved = false) {
        const uid = userId || this.userId;
        
        if (!uid) {
            throw new Error('User not authenticated');
        }

        if (!contentId) {
            throw new Error('Content ID required');
        }

        const operationKey = `wl_${contentId}`;
        if (this.pendingOperations.has(operationKey)) {
            console.log(`⏳ Watch Later operation pending for ${contentId}`);
            return isCurrentlySaved;
        }

        this.pendingOperations.set(operationKey, true);
        const newState = !isCurrentlySaved;

        try {
            if (newState) {
                const { error } = await this.supabase
                    .from('watch_later')
                    .insert({
                        user_id: uid,
                        content_id: contentId
                    });
                
                if (error && error.code !== '23505') throw error;
                this.cache.watchLater.add(String(contentId));
                console.log(`✅ Watch Later added for content ${contentId}`);
            } else {
                const { error } = await this.supabase
                    .from('watch_later')
                    .delete()
                    .eq('user_id', uid)
                    .eq('content_id', contentId);
                
                if (error) throw error;
                this.cache.watchLater.delete(String(contentId));
                console.log(`✅ Watch Later removed for content ${contentId}`);
            }

            return newState;

        } catch (error) {
            console.error('❌ toggleWatchLater failed:', error);
            throw error;
        } finally {
            this.pendingOperations.delete(operationKey);
        }
    }

    /**
     * Check if user has saved content to watch later
     * @param {number|string} contentId - Content ID
     * @returns {Promise<boolean>}
     */
    async isInWatchLater(contentId, userId = null) {
        const uid = userId || this.userId;
        
        if (!uid || !contentId) return false;
        
        if (this.cache.watchLater.has(String(contentId))) return true;
        
        try {
            const { data, error } = await this.supabase
                .from('watch_later')
                .select('id')
                .eq('user_id', uid)
                .eq('content_id', contentId)
                .maybeSingle();
            
            if (error) throw error;
            
            const inWatchLater = !!data;
            if (inWatchLater) this.cache.watchLater.add(String(contentId));
            return inWatchLater;
            
        } catch (error) {
            console.error('❌ isInWatchLater check failed:', error);
            return false;
        }
    }

    /**
     * Get user's entire watch later list
     * @param {string} userId - User ID (optional)
     * @param {number} limit - Max items to return
     * @returns {Promise<Array>}
     */
    async getWatchLaterList(userId = null, limit = 50) {
        const uid = userId || this.userId;
        
        if (!uid) {
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('watch_later')
                .select(`
                    id,
                    content_id,
                    created_at,
                    Content (
                        id,
                        title,
                        thumbnail_url,
                        duration,
                        media_type
                    )
                `)
                .eq('user_id', uid)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('❌ getWatchLaterList failed:', error);
            return [];
        }
    }

    // =====================================================
    // 5. SHARE SYSTEM WITH PERSISTENCE
    // =====================================================

    /**
     * Record a share event with analytics
     * @param {number|string} contentId - Content ID
     * @param {string} userId - User ID (optional)
     * @param {string} platform - Share platform (native, clipboard, etc.)
     * @returns {Promise<boolean>}
     */
    async recordShare(contentId, userId = null, platform = 'native') {
        const uid = userId || this.userId;
        
        if (!contentId) {
            console.error('❌ recordShare: Missing contentId');
            return false;
        }

        try {
            // Insert into content_shares (if user is authenticated)
            if (uid) {
                const { error: shareError } = await this.supabase
                    .from('content_shares')
                    .insert({
                        content_id: contentId,
                        user_id: uid,
                        platform: platform,
                        shared_at: new Date().toISOString()
                    });
                
                if (shareError) {
                    console.warn('⚠️ Share insert warning:', shareError.message);
                }
            }

            // Always record event for analytics (even for guests, use null user_id)
            const { error: eventError } = await this.supabase
                .from('content_events')
                .insert({
                    content_id: contentId,
                    user_id: uid || null,
                    event_type: 'share',
                    event_metadata: { platform },
                    created_at: new Date().toISOString()
                });

            if (eventError) {
                console.warn('⚠️ Event insert warning:', eventError.message);
            }

            // Update share counter
            await this._updateEngagementCounter(contentId, 'shares', 1);

            console.log(`✅ Share recorded for content ${contentId}`);
            return true;

        } catch (error) {
            console.error('❌ recordShare failed:', error);
            return false;
        }
    }

    // =====================================================
    // 6. REALTIME METRICS SUBSCRIPTION
    // =====================================================

    /**
     * Subscribe to realtime engagement metric updates
     * @param {number|string} contentId - Content ID
     * @param {Function} callback - Callback function receiving updated metrics
     * @returns {Object} Subscription object with unsubscribe method
     */
    subscribeToMetrics(contentId, callback) {
        if (!contentId || typeof callback !== 'function') {
            console.error('❌ subscribeToMetrics: Invalid parameters');
            return { unsubscribe: () => {} };
        }

        const channelName = `engagement-metrics:${contentId}`;
        
        // Clean up existing subscription
        if (this.realtimeSubscriptions.has(channelName)) {
            this.realtimeSubscriptions.get(channelName).unsubscribe();
        }

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'content_engagement_stats',
                    filter: `content_id=eq.${contentId}`
                },
                (payload) => {
                    console.log(`📊 Realtime metrics update for ${contentId}:`, payload.new);
                    callback(payload.new);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Subscribed to metrics for content ${contentId}`);
                }
            });

        this.realtimeSubscriptions.set(channelName, channel);

        return {
            unsubscribe: () => {
                if (this.realtimeSubscriptions.has(channelName)) {
                    this.supabase.removeChannel(channel);
                    this.realtimeSubscriptions.delete(channelName);
                    console.log(`🔌 Unsubscribed from metrics for content ${contentId}`);
                }
            }
        };
    }

    /**
     * Subscribe to realtime comment updates
     * @param {number|string} contentId - Content ID
     * @param {Function} callback - Callback function
     * @returns {Object} Subscription object
     */
    subscribeToComments(contentId, callback) {
        if (!contentId || typeof callback !== 'function') {
            return { unsubscribe: () => {} };
        }

        const channelName = `comments:${contentId}`;
        
        if (this.realtimeSubscriptions.has(channelName)) {
            this.realtimeSubscriptions.get(channelName).unsubscribe();
        }

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `content_id=eq.${contentId}`
                },
                (payload) => {
                    console.log(`💬 New comment for ${contentId}:`, payload.new);
                    callback(payload.new);
                }
            )
            .subscribe();

        this.realtimeSubscriptions.set(channelName, channel);

        return {
            unsubscribe: () => {
                if (this.realtimeSubscriptions.has(channelName)) {
                    this.supabase.removeChannel(channel);
                    this.realtimeSubscriptions.delete(channelName);
                }
            }
        };
    }

    // =====================================================
    // 7. COUNTER MANAGEMENT
    // =====================================================

    /**
     * Update engagement counters via RPC or direct update
     * @param {number|string} contentId - Content ID
     * @param {string} counterType - 'likes', 'favorites', 'shares', 'comments'
     * @param {number} delta - Change amount (+1 or -1)
     * @private
     */
    async _updateEngagementCounter(contentId, counterType, delta) {
        if (!contentId || !counterType) return;

        try {
            // Try RPC first
            let rpcFunction = null;
            switch (counterType) {
                case 'likes':
                    rpcFunction = 'increment_engagement_stats_likes';
                    break;
                case 'favorites':
                    rpcFunction = 'increment_content_favorites';
                    break;
                case 'shares':
                    rpcFunction = 'increment_content_shares';
                    break;
                case 'comments':
                    rpcFunction = 'increment_content_comments';
                    break;
                default:
                    return;
            }

            const { error: rpcError } = await this.supabase.rpc(rpcFunction, {
                target_content_id: contentId,
                increment_value: delta
            });

            if (rpcError) {
                // Fallback: direct update to Content table
                const updateField = `${counterType}_count`;
                const { data: current } = await this.supabase
                    .from('Content')
                    .select(updateField)
                    .eq('id', contentId)
                    .single();
                
                if (current) {
                    const newValue = (current[updateField] || 0) + delta;
                    await this.supabase
                        .from('Content')
                        .update({ [updateField]: Math.max(0, newValue) })
                        .eq('id', contentId);
                }
            }
        } catch (error) {
            console.warn(`⚠️ Failed to update ${counterType} counter:`, error.message);
        }
    }

    // =====================================================
    // 8. BATCH OPERATIONS & CLEANUP
    // =====================================================

    /**
     * Clear all caches (useful on logout)
     */
    clearCache() {
        this.cache.liked.clear();
        this.cache.favorited.clear();
        this.cache.watchLater.clear();
        this.pendingOperations.clear();
        console.log('✅ EngagementManager cache cleared');
    }

    /**
     * Unsubscribe from all realtime channels
     */
    unsubscribeAll() {
        this.realtimeSubscriptions.forEach((channel, name) => {
            this.supabase.removeChannel(channel);
            console.log(`🔌 Unsubscribed from ${name}`);
        });
        this.realtimeSubscriptions.clear();
        console.log('✅ All realtime subscriptions cleared');
    }

    /**
     * Reset user session (call on logout)
     */
    reset() {
        this.clearCache();
        this.unsubscribeAll();
        this.userId = null;
        this._initialized = false;
        console.log('✅ EngagementManager reset');
    }

    /**
     * Get current cache status (for debugging)
     */
    getCacheStatus() {
        return {
            likedCount: this.cache.liked.size,
            favoritedCount: this.cache.favorited.size,
            watchLaterCount: this.cache.watchLater.size,
            pendingOperations: this.pendingOperations.size,
            realtimeSubscriptions: this.realtimeSubscriptions.size,
            userId: this.userId,
            initialized: this._initialized
        };
    }
}

// =====================================================
// SINGLETON INSTANCE & GLOBAL EXPORT
// =====================================================

let instance = null;

/**
 * Get the global EngagementManager instance
 * @param {Object} options - Configuration options (only used on first call)
 * @returns {EngagementManager}
 */
function getEngagementManager(options = {}) {
    if (!instance) {
        instance = new EngagementManager(options);
    }
    return instance;
}

/**
 * Initialize the global EngagementManager with user
 * @param {string} userId - Current user ID
 */
async function initEngagementManager(userId) {
    const manager = getEngagementManager();
    await manager.initialize(userId);
    return manager;
}

/**
 * Reset the global EngagementManager (on logout)
 */
function resetEngagementManager() {
    if (instance) {
        instance.reset();
        instance = null;
    }
}

// Export to window
window.EngagementManager = EngagementManager;
window.getEngagementManager = getEngagementManager;
window.initEngagementManager = initEngagementManager;
window.resetEngagementManager = resetEngagementManager;

// Auto-initialize when AuthHelper is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for AuthHelper
    const waitForAuth = () => {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (window.AuthHelper && window.AuthHelper.isInitialized) {
                    clearInterval(check);
                    resolve();
                }
            }, 50);
            setTimeout(() => {
                clearInterval(check);
                resolve();
            }, 2000);
        });
    };
    
    await waitForAuth();
    
    if (window.AuthHelper && window.AuthHelper.isAuthenticated()) {
        const userProfile = window.AuthHelper.getUserProfile();
        if (userProfile?.id) {
            await initEngagementManager(userProfile.id);
            console.log('🎯 EngagementManager auto-initialized for user:', userProfile.id);
        }
    } else {
        await initEngagementManager(null);
        console.log('🎯 EngagementManager initialized in guest mode');
    }
});

// Listen for auth changes
if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            await initEngagementManager(session.user.id);
        } else if (event === 'SIGNED_OUT') {
            resetEngagementManager();
            await initEngagementManager(null);
        }
    });
}

console.log('✅ EngagementManager module loaded successfully');
console.log('   Features:');
console.log('   - Persistent like/favorite/watch-later states');
console.log('   - Optimistic UI support with cache');
console.log('   - Share recording with analytics');
console.log('   - Realtime metric subscriptions');
console.log('   - Batch operations for multiple contents');
console.log('   - Auto-initialization with AuthHelper');
console.log('   🚀 Ready for production deployment');
