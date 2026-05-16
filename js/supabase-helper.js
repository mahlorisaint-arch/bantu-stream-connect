// js/supabase-helper.js - Bantu Stream Connect Supabase Helper
// COMPLETE FIXED VERSION WITH VIEW RECORDING DELEGATION AND ALBUM SUPPORT
// ✅ FIXED: View recording delegated to unified system (watch-session.js)
// ✅ FIXED: Content queries with proper error handling
// ✅ FIXED: Media URL construction with bucket detection
// 🔧 ALBUM FIX: Added getAlbumTracks method for playlist/album content
// 🔧 ALBUM FIX: Added getPlaylistItems method for retrieving playlist contents
// 🔧 VIEWS FIX: Removed duplicate view recording (now handled by watch-session.js)

console.log('📡 Supabase Helper Initializing with Video URL fixes...');

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
    // CRITICAL FIX: Fix media URL function with bucket detection
    // ============================================
    fixMediaUrl: function(url) {
        if (!url) return null;
        
        // If already full URL, return as-is (but check for invalid supabase URLs)
        if (url.startsWith('http')) {
            // Fix malformed URLs that have double protocol
            if (url.includes('http://http://') || url.includes('https://https://')) {
                url = url.replace(/https?:\/\/https?:\/\//, 'https://');
                url = url.replace(/http:\/\/http:\/\//, 'http://');
            }
            // Fix URLs that are missing the storage bucket path
            if (url.includes('supabase.co') && !url.includes('/storage/v1/object/public/')) {
                console.log('⚠️ Malformed Supabase URL detected, reconstructing:', url);
                return this.reconstructMediaUrl(url);
            }
            console.log('✅ Already a full URL');
            return url;
        }
        
        // Remove leading slash if present
        let cleanUrl = url;
        if (cleanUrl.startsWith('/')) {
            cleanUrl = cleanUrl.substring(1);
        }
        
        // Determine bucket based on path and content type
        let bucket = 'content-media'; // default bucket
        
        if (cleanUrl.includes('thumbnails') || 
            cleanUrl.includes('thumbnail') ||
            cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            bucket = 'content-thumbnails';
        } else if (cleanUrl.includes('profile-pictures') || 
                   cleanUrl.includes('avatar') ||
                   cleanUrl.includes('profile')) {
            bucket = 'profile-pictures';
        } else if (cleanUrl.includes('video') || 
                   cleanUrl.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
            bucket = 'content-media';
        }
        
        // Construct full Supabase URL
        const fullUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${bucket}/${cleanUrl}`;
        console.log('🔗 Constructed full URL:', fullUrl);
        
        return fullUrl;
    },
    
    // Reconstruct a malformed Supabase URL
    reconstructMediaUrl: function(url) {
        try {
            // Extract the path after the domain
            const match = url.match(/supabase\.co\/(.+)$/);
            if (match && match[1]) {
                const path = match[1];
                // Determine bucket from path
                let bucket = 'content-media';
                if (path.includes('thumbnails')) bucket = 'content-thumbnails';
                if (path.includes('profile')) bucket = 'profile-pictures';
                
                // Clean the path
                let cleanPath = path.replace(/^\/+/, '');
                // Remove any duplicate bucket references
                cleanPath = cleanPath.replace(/^(content-media|content-thumbnails|profile-pictures)\//, '');
                
                return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${bucket}/${cleanPath}`;
            }
        } catch (e) {
            console.warn('Failed to reconstruct URL:', e);
        }
        return url;
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
            
            // Fix thumbnail URL
            const thumbnailUrl = this.fixMediaUrl(data.thumbnail_url || data.thumbnail);
            const fileUrl = this.fixMediaUrl(data.file_url || data.media_url);
            
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
                views_count: data.views_count || data.views || 0,
                likes_count: data.likes_count || data.likes || 0,
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
                        views_count,
                        likes_count,
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
                    thumbnail_url: this.fixMediaUrl(content?.thumbnail_url),
                    file_url: this.fixMediaUrl(content?.file_url),
                    duration: content?.duration || 0,
                    media_type: content?.media_type || 'video',
                    views_count: content?.views_count || 0,
                    likes_count: content?.likes_count || 0,
                    added_at: item.added_at,
                    artist: content?.user_profiles?.full_name || content?.user_profiles?.username || 'Unknown Artist',
                    playlist_item_id: item.id
                };
            }).filter(track => track.id); // Filter out invalid tracks
            
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
                            media_type,
                            views_count
                        )
                    `)
                    .eq('album_id', contentId)
                    .order('track_number', { ascending: true });
                
                if (!error && data && data.length > 0) {
                    return data.map(item => ({
                        id: item.content_id,
                        title: item.Content?.title || 'Untitled',
                        thumbnail_url: this.fixMediaUrl(item.Content?.thumbnail_url),
                        file_url: this.fixMediaUrl(item.Content?.file_url),
                        duration: item.Content?.duration || 0,
                        media_type: item.Content?.media_type || 'video',
                        views_count: item.Content?.views_count || 0,
                        track_number: item.track_number
                    }));
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
                    avatar_url: this.fixMediaUrl(data.avatar_url)
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
                .select('id, title, thumbnail_url, views_count, duration, media_type')
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
            
            return data.map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                thumbnail_url: this.fixMediaUrl(item.thumbnail_url),
                views_count: item.views_count || 0,
                duration: item.duration,
                media_type: item.media_type
            }));
            
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
            
            return data;
        } catch (error) {
            console.error('Exception in addComment:', error);
            return null;
        }
    },
    
    // ============================================
    // 🔧 VIEWS FIX: Record view - NOW DELEGATED TO UNIFIED SYSTEM
    // This method now delegates to the unified view recording system
    // to prevent duplicate recordings
    // ============================================
    recordView: async function(contentId, userId) {
        // ✅ GUARD: Delegate to unified view system if available
        if (window.videoPlayerFeatures && typeof window.videoPlayerFeatures.recordView === 'function') {
            console.log('📊 Delegating view recording to unified system');
            const sessionId = sessionStorage.getItem('bantu_view_session');
            if (sessionId) {
                return await window.videoPlayerFeatures.recordView(contentId, sessionId);
            }
        }
        
        // ✅ GUARD: Skip if unified view system is active (prevents duplicate recording)
        if (window._usingUnifiedViewSystem) {
            console.log('⚠️ Using unified view system, skipping duplicate record in supabase-helper');
            return false;
        }
        
        // Fallback: Direct recording (should not be used if unified system is active)
        if (!this.isInitialized) return false;
        
        // Check if already recorded this session
        const sessionKey = `${contentId}_${sessionStorage.getItem('bantu_view_session') || 'default'}`;
        if (this._viewRecordedForSession.has(sessionKey)) {
            console.log('👁️ View already recorded in this session (supabase-helper cache)');
            return true;
        }
        
        try {
            const { error } = await this.client
                .from('content_views')
                .insert({
                    content_id: contentId,
                    viewer_id: userId || null,
                    device_type: this.getDeviceType(),
                    viewed_at: new Date().toISOString(),
                    counted_as_view: true
                });
            
            if (error) {
                console.error('Error recording view:', error);
                return false;
            }
            
            // Mark as recorded this session
            this._viewRecordedForSession.add(sessionKey);
            
            // Also try to increment content views count
            try {
                await this.client.rpc('increment_content_views', {
                    content_id_input: contentId
                });
                console.log('✅ Content views count incremented via RPC');
            } catch (rpcError) {
                console.warn('Could not increment content views count:', rpcError);
            }
            
            return true;
        } catch (error) {
            console.error('Exception in recordView:', error);
            return false;
        }
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

console.log('✅ Supabase Helper fully loaded and ready with album support and view delegation');
