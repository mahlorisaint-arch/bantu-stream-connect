// js/supabase-helper.js - Bantu Stream Connect Supabase Helper
// COMPLETE FIXED VERSION WITH VIEW RECORDING DELEGATION AND ALBUM SUPPORT
// ✅ FIXED: View recording delegated to unified system (watch-session.js)
// ✅ FIXED: Content queries with proper error handling
// ✅ FIXED: Media URL construction with bucket detection
// 🔧 ALBUM FIX: Added getAlbumTracks method for playlist/album content
// 🔧 ALBUM FIX: Added getPlaylistItems method for retrieving playlist contents
// 🔧 VIEWS FIX: Removed duplicate view recording (now handled by watch-session.js)
// 🚨 ENGAGEMENT SYSTEM FIXES (2026-05-23):
// - FIX #1: Centralized engagement API layer (recordContentView, toggleLike, toggleFavorite, toggleWatchLater)
// - FIX #2: Load counts from canonical tables (content_views, content_likes, comments, content_shares)
// - FIX #3: No 409 conflicts - proper existence checks before insert/delete
// - FIX #4: Race condition protection with request token pattern
// - FIX #5: Optimistic UI updates via callbacks
// 🎯 R2 FOLDER ROUTING FIX (2026-06-20):
// - Updated fixMediaUrl to route thumbnails to content-thumbnails/ folder
// - Added assetContext parameter for explicit folder routing
// - Improved path cleaning for legacy Supabase artifacts

console.log('📡 Supabase Helper Initializing with Video URL fixes and Engagement API...');

// Add this at the TOP of the file to prevent multiple initializations
if (window._supabaseHelperInitialized) {
  console.log('⚠️ Supabase Helper already initialized, skipping duplicate');
  // If already initialized, just return the existing instance
  if (!window.SupabaseHelper && window._supabaseHelperInstance) {
    window.SupabaseHelper = window._supabaseHelperInstance;
  }
  // Exit the IIFE that will wrap this code
  throw new Error('Supabase Helper already initialized');
}
window._supabaseHelperInitialized = true;

// Simple Supabase helper object
const SupabaseHelper = {
    isInitialized: false,
    client: null,
    _viewRecordedForSession: new Set(), // Track recorded views this session
    _engagementLoadToken: null, // 🚨 Race condition protection token
    
    // Initialize helper
    initialize: function() {
        try {
            // Check if we have supabaseClient from the HTML
            if (typeof window.supabaseClient !== 'undefined') {
                this.client = window.supabaseClient;
                this.isInitialized = true;
                console.log('✅ Supabase Helper Initialized with global client');
                return true;
            }
            
            // Try to create client directly if not available
            const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
            
            if (typeof supabase !== 'undefined') {
                this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                this.isInitialized = true;
                console.log('✅ Supabase Helper Initialized with direct client');
                return true;
            }
            
            console.warn('⚠️ Supabase client not available - running in offline mode');
            return false;
        } catch (error) {
            console.error('❌ Supabase Helper Initialization error:', error);
            return false;
        }
    },
    
    // ============================================
    // CRITICAL FIX: Media URL function with R2 folder routing
    // ============================================
    /**
     * Maps database string tokens straight to the designated
     * folder layout inside the Cloudflare R2 bucket.
     * @param {string} url - The URL or path to fix
     * @param {string} assetContext - The context of the asset ('media', 'thumbnail', 'banner', 'avatar')
     * @returns {string} - The fixed URL
     */
    fixMediaUrl: function(url, assetContext = 'media') {
        if (!url) return null;
        
        // 🚨 1. BASE64 URIs PASS-THROUGH
        if (url.startsWith('data:image')) {
            console.log('🖼️ Base64 data URI processed natively.');
            return url;
        }
        
        // 🔗 2. ABSOLUTE WEB LINKS PASS-THROUGH
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 🧹 3. STRIP LEGACY SUPABASE PATH ARTIFACTS
        let cleanPath = url.replace(/^\/+/, '');
        cleanPath = cleanPath.replace(/^storage\/v1\/object\/public\//, '');
        cleanPath = cleanPath.replace(/^content-media\//, '');
        cleanPath = cleanPath.replace(/^content-thumbnails\//, '');
        cleanPath = cleanPath.replace(/^channel-banners\//, '');
        cleanPath = cleanPath.replace(/^profile-pictures\//, '');
        cleanPath = cleanPath.replace(/^public\//, '');
        
        // If the path is still empty, return null
        if (!cleanPath || cleanPath.length === 0) {
            console.warn('⚠️ Empty path after cleaning, returning null');
            return null;
        }
        
        const r2Domain = 'https://assets.bantustreamconnect.com';
        
        // 🎯 4. EXPLICIT FOLDER ROUTING ENGINE
        // If context or content tags imply it is a banner or profile image
        if (assetContext === 'banner' || cleanPath.includes('banner') || cleanPath.includes('channel-banner')) {
            return `${r2Domain}/channel-banners/${cleanPath}`;
        }
        if (assetContext === 'avatar' || cleanPath.includes('avatar') || cleanPath.includes('profile')) {
            return `${r2Domain}/profile-pictures/${cleanPath}`;
        }
        
        // Handle precise separation between thumbnails and video media files
        if (assetContext === 'thumbnail' || cleanPath.includes('thumb') || cleanPath.includes('poster') || cleanPath.includes('thumbnail')) {
            return `${r2Domain}/content-thumbnails/${cleanPath}`;
        }
        
        // Default fallback destination for videos and primary audio files
        return `${r2Domain}/content-media/${cleanPath}`;
    },
    
    // ============================================
    // 🚨 FIX #1: CENTRALIZED ENGAGEMENT API LAYER
    // ============================================
    
    /**
     * Record content view using RPC - CENTRALIZED
     * This is the SOURCE OF TRUTH for view counting
     * @param {number|string} contentId - The content ID
     * @param {string|null} userId - The user ID (can be null)
     * @param {string} sessionId - The session ID
     * @param {string} deviceType - Device type (mobile/desktop/tablet)
     * @returns {Promise<{success: boolean, views: number}>}
     */
    recordContentView: async function(contentId, userId, sessionId, deviceType = 'web') {
        if (!contentId) {
            console.error('❌ Cannot record view: missing contentId');
            return { success: false, views: 0 };
        }
        
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase not initialized, cannot record view');
            return { success: false, views: 0 };
        }
        
        try {
            const finalDeviceType = deviceType || this.getDeviceType();
            const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Use RPC for atomic view recording
            const { data, error } = await this.client.rpc('record_content_view', {
                p_content_id: parseInt(contentId),
                p_user_id: userId || null,
                p_session_id: finalSessionId,
                p_device_type: finalDeviceType
            });
            
            if (error) {
                console.error('❌ RPC view recording failed:', error);
                // Fallback to direct insert
                return await this._recordViewFallback(contentId, userId, finalSessionId, finalDeviceType);
            }
            
            console.log(`✅ View recorded via RPC for content ${contentId}, total views: ${data?.views || 0}`);
            
            // Mark as recorded this session
            const sessionKey = `${contentId}_${finalSessionId}`;
            this._viewRecordedForSession.add(sessionKey);
            
            return { success: true, views: data?.views || 0 };
            
        } catch (error) {
            console.error('❌ Exception in recordContentView:', error);
            return { success: false, views: 0 };
        }
    },
    
    /**
     * Fallback view recording if RPC fails
     */
    _recordViewFallback: async function(contentId, userId, sessionId, deviceType) {
        try {
            // Check for existing view in this session to prevent duplicates
            const { data: existing, error: checkError } = await this.client
                .from('content_views')
                .select('id')
                .eq('content_id', parseInt(contentId))
                .eq('session_id', sessionId)
                .maybeSingle();
            
            if (checkError) {
                console.warn('Check for existing view failed:', checkError);
            }
            
            if (existing) {
                console.log('⏭️ View already recorded for this session, skipping');
                return { success: true, views: null };
            }
            
            const { error: insertError } = await this.client
                .from('content_views')
                .insert({
                    content_id: parseInt(contentId),
                    user_id: userId || null,
                    session_id: sessionId,
                    counted_as_view: true,
                    view_duration: 30,
                    device_type: deviceType,
                    viewed_at: new Date().toISOString()
                });
            
            if (insertError) throw insertError;
            
            // Get updated count
            const { count, error: countError } = await this.client
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', parseInt(contentId))
                .eq('counted_as_view', true);
            
            console.log(`✅ View recorded via fallback for content ${contentId}`);
            
            // Mark as recorded this session
            const sessionKey = `${contentId}_${sessionId}`;
            this._viewRecordedForSession.add(sessionKey);
            
            return { success: true, views: count || 0 };
            
        } catch (error) {
            console.error('❌ Fallback view recording failed:', error);
            return { success: false, views: 0 };
        }
    },
    
    /**
     * 🚨 FIX #2 & #4: Load LIVE counts from canonical tables with race protection
     * @param {number|string} contentId - The content ID
     * @returns {Promise<{views: number, likes: number, comments: number, shares: number}>}
     */
    loadLiveEngagementCounts: async function(contentId) {
        if (!contentId || !this.isInitialized) {
            return { views: 0, likes: 0, comments: 0, shares: 0 };
        }
        
        // 🚨 Race condition protection - generate unique token
        const token = crypto.randomUUID();
        this._engagementLoadToken = token;
        
        try {
            const [viewsResult, likesResult, commentsResult, sharesResult] = await Promise.all([
                this.client.from('content_views').select('*', { count: 'exact', head: true }).eq('content_id', parseInt(contentId)).eq('counted_as_view', true),
                this.client.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', parseInt(contentId)),
                this.client.from('comments').select('*', { count: 'exact', head: true }).eq('content_id', parseInt(contentId)),
                this.client.from('content_shares').select('*', { count: 'exact', head: true }).eq('content_id', parseInt(contentId))
            ]);
            
            // Check if this response is still valid
            if (this._engagementLoadToken !== token) {
                console.log('⚠️ Engagement counts load aborted - stale request (race condition)');
                return { views: 0, likes: 0, comments: 0, shares: 0 };
            }
            
            return {
                views: viewsResult.count || 0,
                likes: likesResult.count || 0,
                comments: commentsResult.count || 0,
                shares: sharesResult.count || 0
            };
        } catch (error) {
            console.error('❌ Failed to load live engagement counts:', error);
            return { views: 0, likes: 0, comments: 0, shares: 0 };
        }
    },
    
    /**
     * 🚨 FIX #3: Toggle like with NO 409 CONFLICTS
     * @param {number|string} contentId - The content ID
     * @param {string} userId - The user ID
     * @param {boolean} isCurrentlyLiked - Current like state
     * @returns {Promise<boolean>} New like state
     */
    toggleLike: async function(contentId, userId, isCurrentlyLiked) {
        if (!userId || !this.isInitialized) {
            console.warn('⚠️ Cannot toggle like: missing userId or supabase not initialized');
            return isCurrentlyLiked;
        }
        
        try {
            if (isCurrentlyLiked) {
                // DELETE - safe operation
                const { error } = await this.client
                    .from('content_likes')
                    .delete()
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId));
                
                if (error) throw error;
                console.log(`✅ Like removed from content ${contentId}`);
                return false;
            } else {
                // Check existence FIRST to prevent 409 conflict
                const { data: existing } = await this.client
                    .from('content_likes')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId))
                    .maybeSingle();
                
                if (existing) {
                    console.log('⚠️ Like already exists, toggling off instead');
                    const { error } = await this.client
                        .from('content_likes')
                        .delete()
                        .eq('id', existing.id);
                    if (error) throw error;
                    return false;
                }
                
                const { error } = await this.client
                    .from('content_likes')
                    .insert({ user_id: userId, content_id: parseInt(contentId) });
                
                if (error) throw error;
                console.log(`✅ Like added to content ${contentId}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Like toggle failed:', error);
            return isCurrentlyLiked;
        }
    },
    
    /**
     * 🚨 FIX #3: Toggle favorite with NO 409 CONFLICTS
     * @param {number|string} contentId - The content ID
     * @param {string} userId - The user ID
     * @param {boolean} isCurrentlyFavorited - Current favorite state
     * @returns {Promise<boolean>} New favorite state
     */
    toggleFavorite: async function(contentId, userId, isCurrentlyFavorited) {
        if (!userId || !this.isInitialized) {
            console.warn('⚠️ Cannot toggle favorite: missing userId or supabase not initialized');
            return isCurrentlyFavorited;
        }
        
        try {
            if (isCurrentlyFavorited) {
                const { error } = await this.client
                    .from('favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId));
                
                if (error) throw error;
                console.log(`✅ Favorite removed from content ${contentId}`);
                return false;
            } else {
                // Check existence FIRST to prevent 409 conflict
                const { data: existing } = await this.client
                    .from('favorites')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId))
                    .maybeSingle();
                
                if (existing) {
                    console.log('⚠️ Favorite already exists, toggling off instead');
                    const { error } = await this.client
                        .from('favorites')
                        .delete()
                        .eq('id', existing.id);
                    if (error) throw error;
                    return false;
                }
                
                const { error } = await this.client
                    .from('favorites')
                    .insert({ user_id: userId, content_id: parseInt(contentId) });
                
                if (error) throw error;
                console.log(`✅ Favorite added to content ${contentId}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Favorite toggle failed:', error);
            return isCurrentlyFavorited;
        }
    },
    
    /**
     * 🚨 FIX #3: Toggle watch later with NO 409 CONFLICTS
     * @param {number|string} contentId - The content ID
     * @param {string} userId - The user ID
     * @param {boolean} isCurrentlySaved - Current watch later state
     * @returns {Promise<boolean>} New watch later state
     */
    toggleWatchLater: async function(contentId, userId, isCurrentlySaved) {
        if (!userId || !this.isInitialized) {
            console.warn('⚠️ Cannot toggle watch later: missing userId or supabase not initialized');
            return isCurrentlySaved;
        }
        
        try {
            if (isCurrentlySaved) {
                const { error } = await this.client
                    .from('watch_later')
                    .delete()
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId));
                
                if (error) throw error;
                console.log(`✅ Watch Later removed from content ${contentId}`);
                return false;
            } else {
                // Check existence FIRST to prevent 409 conflict
                const { data: existing } = await this.client
                    .from('watch_later')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('content_id', parseInt(contentId))
                    .maybeSingle();
                
                if (existing) {
                    console.log('⚠️ Watch Later already exists, toggling off instead');
                    const { error } = await this.client
                        .from('watch_later')
                        .delete()
                        .eq('id', existing.id);
                    if (error) throw error;
                    return false;
                }
                
                const { error } = await this.client
                    .from('watch_later')
                    .insert({ user_id: userId, content_id: parseInt(contentId) });
                
                if (error) throw error;
                console.log(`✅ Watch Later added to content ${contentId}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Watch Later toggle failed:', error);
            return isCurrentlySaved;
        }
    },
    
    /**
     * 🚨 Share content with persistence to content_shares and content_events
     * @param {number|string} contentId - The content ID
     * @param {string} userId - The user ID (can be null)
     * @returns {Promise<boolean>} Success status
     */
    shareContent: async function(contentId, userId) {
        if (!contentId || !this.isInitialized) {
            console.warn('⚠️ Cannot share content: missing contentId or supabase not initialized');
            return false;
        }
        
        try {
            // Record share in content_shares
            if (userId) {
                const { error: shareError } = await this.client
                    .from('content_shares')
                    .insert({
                        content_id: parseInt(contentId),
                        user_id: userId,
                        shared_at: new Date().toISOString()
                    });
                
                if (shareError) throw shareError;
                
                // Record event for analytics
                const { error: eventError } = await this.client
                    .from('content_events')
                    .insert({
                        content_id: parseInt(contentId),
                        user_id: userId,
                        event_type: 'share',
                        created_at: new Date().toISOString()
                    });
                
                if (eventError) {
                    console.warn('Failed to record share event:', eventError);
                }
                
                console.log(`✅ Share recorded for content ${contentId}`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Share recording failed:', error);
            return false;
        }
    },
    
    /**
     * 🚨 Load ALL engagement states for a user and content
     * @param {number|string} contentId - The content ID
     * @param {string} userId - The user ID
     * @returns {Promise<{liked: boolean, favorited: boolean, watchLater: boolean}>}
     */
    loadEngagementStates: async function(contentId, userId) {
        if (!userId || !contentId || !this.isInitialized) {
            return { liked: false, favorited: false, watchLater: false };
        }
        
        // 🚨 Race condition protection
        const token = crypto.randomUUID();
        this._engagementLoadToken = token;
        
        try {
            const [likeRes, favRes, wlRes] = await Promise.all([
                this.client.from('content_likes').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle(),
                this.client.from('favorites').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle(),
                this.client.from('watch_later').select('id').eq('content_id', parseInt(contentId)).eq('user_id', userId).maybeSingle()
            ]);
            
            // Check if this response is still valid
            if (this._engagementLoadToken !== token) {
                console.log('⚠️ Engagement states load aborted - stale request');
                return { liked: false, favorited: false, watchLater: false };
            }
            
            return {
                liked: !!likeRes.data,
                favorited: !!favRes.data,
                watchLater: !!wlRes.data
            };
        } catch (error) {
            console.error('❌ Failed to load engagement states:', error);
            return { liked: false, favorited: false, watchLater: false };
        }
    },
    
    // ============================================
    // CONTENT QUERIES
    // ============================================
    
    // Get content by ID - FIXED QUERY
    getContentById: async function(contentId) {
        if (!this.isInitialized || !this.client) {
            console.warn('⚠️ Supabase not initialized, using fallback');
            return this.getSampleContent(contentId);
        }
        
        try {
            console.log('🔄 Fetching content with ID:', contentId);
            
            // First try: Simple query without complex joins
            let { data, error } = await this.client
                .from('Content')
                .select('*')
                .eq('id', contentId)
                .single();
            
            if (error) {
                console.log('Simple query failed, trying lowercase table...');
                // Second try: Try with different case (content vs Content)
                ({ data, error } = await this.client
                    .from('content')
                    .select('*')
                    .eq('id', contentId)
                    .single());
                    
                if (error) {
                    console.error('Error with lowercase query:', error);
                    return this.getSampleContent(contentId);
                }
            }
            
            if (!data) {
                console.warn('No content found for ID:', contentId);
                return this.getSampleContent(contentId);
            }
            
            console.log('✅ Content fetched successfully:', data.title);
            
            // Try to get creator info separately
            let creatorInfo = await this.getCreatorInfo(data.creator_id || data.user_id);
            
            // 🚨 Get live engagement counts from canonical tables
            const liveCounts = await this.loadLiveEngagementCounts(contentId);
            
            // Fix thumbnail URL with 'thumbnail' context
            const thumbnailUrl = this.fixMediaUrl(data.thumbnail_url || data.thumbnail, 'thumbnail');
            const fileUrl = this.fixMediaUrl(data.file_url || data.media_url, 'media');
            
            return {
                id: data.id,
                title: data.title || 'Untitled',
                description: data.description || 'No description available',
                thumbnail_url: thumbnailUrl,
                file_url: fileUrl,
                media_type: data.media_type || 'video',
                genre: data.genre || data.category || 'General',
                created_at: data.created_at || data.upload_date,
                duration: Number(data.duration) || Number(data.duration_seconds) || 3600,
                language: data.language || 'English',
                views_count: liveCounts.views,
                likes_count: liveCounts.likes,
                comments_count: liveCounts.comments,
                shares_count: liveCounts.shares,
                creator: creatorInfo.name || 'Content Creator',
                creator_display_name: creatorInfo.name || 'Content Creator',
                creator_id: data.creator_id || data.user_id,
                // Additional fields for album/playlist support
                is_album: data.is_album || false,
                playlist_id: data.playlist_id,
                track_count: data.track_count || 0
            };
            
        } catch (error) {
            console.error('❌ Exception in getContentById:', error);
            return this.getSampleContent(contentId);
        }
    },
    
    // ============================================
    // 🔧 ALBUM FIX: Get playlist/album items
    // ============================================
    
    /**
     * Get tracks for a playlist/album
     * @param {string|number} playlistId - The playlist ID
     * @returns {Promise<Array>} Array of tracks
     */
    getPlaylistItems: async function(playlistId) {
        if (!this.isInitialized || !this.client || !playlistId) {
            console.warn('⚠️ Cannot get playlist items: missing requirements');
            return [];
        }
        
        try {
            console.log('🎵 Fetching playlist items for ID:', playlistId);
            
            // Get playlist items with content details
            const { data, error } = await this.client
                .from('playlist_items')
                .select(`
                    id,
                    added_at,
                    content_id,
                    Content (
                        id,
                        title,
                        description,
                        thumbnail_url,
                        file_url,
                        duration,
                        media_type,
                        created_at,
                        user_profiles!user_id (
                            id,
                            full_name,
                            username,
                            avatar_url
                        )
                    )
                `)
                .eq('playlist_id', playlistId)
                .order('added_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching playlist items:', error);
                return [];
            }
            
            // Transform into track format
            const tracks = (data || []).map(item => {
                const content = item.Content;
                return {
                    id: content?.id,
                    title: content?.title || 'Untitled',
                    description: content?.description || '',
                    thumbnail_url: this.fixMediaUrl(content?.thumbnail_url, 'thumbnail'),
                    file_url: this.fixMediaUrl(content?.file_url, 'media'),
                    duration: content?.duration || 0,
                    media_type: content?.media_type || 'video',
                    created_at: content?.created_at,
                    added_at: item.added_at,
                    artist: content?.user_profiles?.full_name || content?.user_profiles?.username || 'Unknown Artist',
                    playlist_item_id: item.id
                };
            }).filter(track => track.id); // Filter out invalid tracks
            
            // 🚨 Get live counts for each track
            for (const track of tracks) {
                const liveCounts = await this.loadLiveEngagementCounts(track.id);
                track.views_count = liveCounts.views;
                track.likes_count = liveCounts.likes;
                track.comments_count = liveCounts.comments;
            }
            
            console.log(`✅ Retrieved ${tracks.length} tracks for playlist ${playlistId}`);
            return tracks;
            
        } catch (error) {
            console.error('❌ Exception in getPlaylistItems:', error);
            return [];
        }
    },
    
    /**
     * Get album tracks from content that is an album
     * @param {string|number} contentId - The content ID (album)
     * @returns {Promise<Array>} Array of tracks
     */
    getAlbumTracks: async function(contentId) {
        if (!this.isInitialized || !this.client || !contentId) {
            return [];
        }
        
        try {
            // First check if content has a playlist_id
            const content = await this.getContentById(contentId);
            
            if (content && content.playlist_id) {
                // This content is part of a playlist
                return await this.getPlaylistItems(content.playlist_id);
            }
            
            // Check if content itself is a playlist/album
            if (content && content.is_album) {
                // Try to get tracks via album_tracks table
                const { data, error } = await this.client
                    .from('album_tracks')
                    .select(`
                        id,
                        track_number,
                        content_id,
                        Content (
                            id,
                            title,
                            description,
                            thumbnail_url,
                            file_url,
                            duration,
                            media_type
                        )
                    `)
                    .eq('album_id', contentId)
                    .order('track_number', { ascending: true });
                
                if (!error && data && data.length > 0) {
                    const tracks = data.map(item => ({
                        id: item.content_id,
                        title: item.Content?.title || 'Untitled',
                        thumbnail_url: this.fixMediaUrl(item.Content?.thumbnail_url, 'thumbnail'),
                        file_url: this.fixMediaUrl(item.Content?.file_url, 'media'),
                        duration: item.Content?.duration || 0,
                        media_type: item.Content?.media_type || 'video',
                        track_number: item.track_number
                    }));
                    
                    // Get live counts for each track
                    for (const track of tracks) {
                        const liveCounts = await this.loadLiveEngagementCounts(track.id);
                        track.views_count = liveCounts.views;
                        track.likes_count = liveCounts.likes;
                    }
                    
                    return tracks;
                }
            }
            
            return [];
            
        } catch (error) {
            console.error('❌ Exception in getAlbumTracks:', error);
            return [];
        }
    },
    
    /**
     * Get playlist by ID with all items
     * @param {string|number} playlistId - The playlist ID
     * @returns {Promise<Object|null>} Playlist object with items
     */
    getPlaylist: async function(playlistId) {
        if (!this.isInitialized || !this.client || !playlistId) {
            return null;
        }
        
        try {
            // Get playlist details
            const { data: playlist, error: playlistError } = await this.client
                .from('playlists')
                .select('*')
                .eq('id', playlistId)
                .single();
            
            if (playlistError) {
                console.error('Error fetching playlist:', playlistError);
                return null;
            }
            
            // Get playlist items
            const items = await this.getPlaylistItems(playlistId);
            
            return {
                ...playlist,
                items: items,
                track_count: items.length
            };
            
        } catch (error) {
            console.error('❌ Exception in getPlaylist:', error);
            return null;
        }
    },
    
    // Get creator info
    getCreatorInfo: async function(creatorId) {
        if (!this.isInitialized || !creatorId) {
            return { name: 'Content Creator' };
        }
        
        try {
            // Try user_profiles table
            let { data, error } = await this.client
                .from('user_profiles')
                .select('full_name, username, avatar_url')
                .eq('id', creatorId)
                .single();
                
            if (error || !data) {
                // Try creators table
                ({ data, error } = await this.client
                    .from('creators')
                    .select('username, email, avatar_url')
                    .eq('id', creatorId)
                    .single());
            }
            
            if (data) {
                return {
                    name: data.full_name || data.username || data.email?.split('@')[0] || 'Creator',
                    avatar_url: this.fixMediaUrl(data.avatar_url, 'avatar')
                };
            }
        } catch (error) {
            console.log('⚠️ Could not fetch creator info:', error);
        }
        
        return { name: 'Content Creator' };
    },
    
    // Sample content fallback - UPDATED WITH PROPER DURATION
    getSampleContent: function(contentId) {
        console.log('📋 Using sample content for ID:', contentId);
        
        const sampleContent = {
            id: contentId || '68',
            title: 'African Music Festival Highlights',
            description: 'Highlights from the biggest African music festival featuring top artists from across the continent. Experience the vibrant culture, amazing performances, and unforgettable moments.',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            media_type: 'video',
            genre: 'Music',
            created_at: '2025-01-15T10:30:00Z',
            creator: 'Music Africa',
            creator_display_name: 'Music Africa',
            duration: 3600,
            language: 'English',
            views_count: 12500,
            likes_count: 890,
            comments_count: 45,
            shares_count: 23,
            creator_id: 'creator123',
            is_album: false,
            playlist_id: null
        };
        
        return sampleContent;
    },
    
    // Get related content
    getRelatedContent: async function(currentContentId, currentGenre, creatorId, limit = 6) {
        if (!this.isInitialized) {
            return this.getSampleRelated();
        }
        
        try {
            let query = this.client
                .from('Content')
                .select('id, title, thumbnail_url, duration, media_type')
                .neq('id', currentContentId)
                .limit(limit);
            
            if (currentGenre && currentGenre !== 'General') {
                query = query.eq('genre', currentGenre);
            } else if (creatorId) {
                query = query.eq('creator_id', creatorId);
            }
            
            const { data, error } = await query;
            
            if (error || !data) {
                console.error('Error fetching related:', error);
                return this.getSampleRelated();
            }
            
            // Get live counts for each related item
            const itemsWithCounts = await Promise.all(data.map(async (item) => {
                const liveCounts = await this.loadLiveEngagementCounts(item.id);
                return {
                    id: item.id,
                    title: item.title || 'Untitled',
                    thumbnail_url: this.fixMediaUrl(item.thumbnail_url, 'thumbnail'),
                    views_count: liveCounts.views,
                    duration: item.duration,
                    media_type: item.media_type
                };
            }));
            
            return itemsWithCounts;
            
        } catch (error) {
            console.error('Exception in getRelatedContent:', error);
            return this.getSampleRelated();
        }
    },
    
    // Sample related content
    getSampleRelated: function() {
        return [
            {
                id: '2',
                title: 'Tech Innovation in Africa',
                thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
                views_count: 8900,
                duration: 1800,
                media_type: 'video'
            },
            {
                id: '3',
                title: 'Traditional Dance Performance',
                thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
                views_count: 15600,
                duration: 2400,
                media_type: 'video'
            },
            {
                id: '4',
                title: 'African Wildlife Documentary',
                thumbnail_url: 'https://images.unsplash.com/photo-1550358864-518f202c02ba?w=400&h=225&fit=crop',
                views_count: 12000,
                duration: 5400,
                media_type: 'video'
            },
            {
                id: '5',
                title: 'Modern African Architecture',
                thumbnail_url: 'https://images.unsplash.com/photo-1542293787938-c9e299b880cc?w=400&h=225&fit=crop',
                views_count: 7600,
                duration: 1200,
                media_type: 'video'
            }
        ];
    },
    
    // Get comments
    getComments: async function(contentId) {
        if (!this.isInitialized) {
            return [];
        }
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .select('*')
                .eq('content_id', contentId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching comments:', error);
                return [];
            }
            
            return data || [];
        } catch (error) {
            console.error('Exception in getComments:', error);
            return [];
        }
    },
    
    // Add comment
    addComment: async function(contentId, commentText, userId, authorName) {
        if (!this.isInitialized) return null;
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .insert({
                    content_id: contentId,
                    user_id: userId,
                    author_name: authorName || 'User',
                    comment_text: commentText,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error adding comment:', error);
                return null;
            }
            
            // Update comment count in content_engagement_stats
            try {
                await this.client.rpc('increment_content_comments', {
                    content_id_input: contentId
                });
            } catch (rpcError) {
                console.warn('Could not increment comment count:', rpcError);
            }
            
            return data;
        } catch (error) {
            console.error('Exception in addComment:', error);
            return null;
        }
    },
    
    // ============================================
    // 🔧 VIEWS FIX: Record view - DELEGATED TO CENTRALIZED API
    // This method now delegates to recordContentView for consistency
    // ============================================
    recordView: async function(contentId, userId, sessionId) {
        const sessionIdToUse = sessionId || sessionStorage.getItem('bantu_view_session') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Delegate to centralized recordContentView
        const result = await this.recordContentView(contentId, userId, sessionIdToUse, this.getDeviceType());
        return result.success;
    },
    
    // Get current user
    getCurrentUser: async function() {
        if (!this.isInitialized) {
            console.log('⚠️ Supabase not initialized, returning null user');
            return null;
        }
        
        try {
            const { data, error } = await this.client.auth.getUser();
            if (error) {
                console.log('⚠️ No authenticated user:', error.message);
                return null;
            }
            return data.user;
        } catch (error) {
            console.error('Exception in getCurrentUser:', error);
            return null;
        }
    },
    
    // Check if user is authenticated
    isAuthenticated: async function() {
        const user = await this.getCurrentUser();
        return !!user;
    },
    
    // Helper function
    getDeviceType: function() {
        const userAgent = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) return 'mobile';
        if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
        return 'desktop';
    },
    
    // Clear view recording session cache
    clearViewRecordingCache: function() {
        this._viewRecordedForSession.clear();
        console.log('🗑️ View recording cache cleared');
    },
    
    // Clear engagement load token (for race condition reset)
    clearEngagementToken: function() {
        this._engagementLoadToken = null;
        console.log('🗑️ Engagement token cleared');
    }
};

// Initialize immediately (don't wait for DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - initializing helper...');
    SupabaseHelper.initialize();
});

// Also try to initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        SupabaseHelper.initialize();
    });
} else {
    // DOM already loaded, initialize now
    SupabaseHelper.initialize();
}

// Store instance for later reference
window._supabaseHelperInstance = SupabaseHelper;

// Make available globally
window.SupabaseHelper = SupabaseHelper;

console.log('✅ Supabase Helper fully loaded with Engagement API:');
console.log('  ✅ recordContentView() - RPC view recording');
console.log('  ✅ loadLiveEngagementCounts() - Canonical table counts');
console.log('  ✅ toggleLike/toggleFavorite/toggleWatchLater() - No 409 conflicts');
console.log('  ✅ loadEngagementStates() - Race protection');
console.log('  ✅ shareContent() - Share persistence');
console.log('  ✅ getContentById() - Live counts from canonical tables');
console.log('  🎯 R2 folder routing: thumbnails → /content-thumbnails/');
