// js/playlist-manager.js - Bantu Stream Connect Playlist Manager
// COMPLETE FIXED VERSION WITH WATCH LATER AND PLAYLIST MODAL INTEGRATION
// FIXED: Duplicate key constraint error handling
// FIXED: Watch Later playlist creation and management
// FIXED: Playlist item add/remove with proper error handling
// ✅ CRITICAL FIX #1: Added isInWatchLater method with proper error handling
// ✅ CRITICAL FIX #2: Added getWatchLaterPlaylistId method with caching
// ✅ CRITICAL FIX #3: Added addToWatchLater and removeFromWatchLater methods
// ✅ CRITICAL FIX #4: Fixed playlist item insertion to handle duplicates gracefully
// 🔧 ALBUM FIX: Added getAlbumTracks method with multiple source detection
// 🔧 ALBUM FIX: Added getPlaylistTracks method for album/playlist track retrieval
// 🔧 PHASE 5 FIX: Updated to use content_engagement_stats for view/like counts

(function() {
  'use strict';
  
  console.log('📋 PlaylistManager module loading...');

  function PlaylistManager(config) {
    if (!config || !config.supabase) {
      console.error('❌ PlaylistManager: Missing required config (supabase)');
      return;
    }
    
    if (!config.userId) {
      console.warn('⚠️ PlaylistManager: No userId provided - playlist features limited');
    }

    this.supabase = config.supabase;
    this.userId = config.userId || null;
    this.watchLaterName = config.watchLaterName || 'Watch Later';
    
    // Cache for watch later playlist ID
    this._watchLaterPlaylistId = null;
    this._watchLaterCacheTime = null;
    this._cacheDuration = 30000; // 30 seconds cache
    
    // Cache for playlist tracks
    this._playlistTracksCache = new Map();
    this._cacheTimeout = null;
    this._playlistTracksCacheDuration = 60000; // 60 seconds for tracks cache
    
    // Callbacks
    this.onPlaylistUpdated = config.onPlaylistUpdated || null;
    this.onError = config.onError || null;
    
    console.log('✅ PlaylistManager initialized for user:', this.userId || 'guest');
  }

  // ============================================
  // PUBLIC API - CORE PLAYLIST OPERATIONS
  // ============================================

  PlaylistManager.prototype.getPlaylists = async function() {
    if (!this.userId) {
      console.warn('⚠️ Cannot get playlists: No user logged in');
      return [];
    }
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .select(`
          *,
          playlist_items(count)
        `)
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const playlists = (data || []).map(playlist => ({
        ...playlist,
        item_count: playlist.playlist_items?.[0]?.count || 0
      }));
      
      return playlists;
    } catch (error) {
      console.error('❌ Failed to get playlists:', error);
      this._handleError('get_playlists', error);
      return [];
    }
  };

  PlaylistManager.prototype.getPlaylist = async function(playlistId) {
    if (!playlistId) {
      console.warn('⚠️ Cannot get playlist: No playlist ID provided');
      return null;
    }
    
    try {
      const { data: playlist, error: playlistError } = await this.supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .maybeSingle();
      
      if (playlistError) throw playlistError;
      if (!playlist) return null;
      
      const { data: items, error: itemsError } = await this.supabase
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
            content_format,
            user_id,
            created_at,
            status,
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
      
      if (itemsError) throw itemsError;
      
      // Fetch engagement stats for each content item (Phase 5)
      const itemsWithStats = await Promise.all((items || []).map(async (item) => {
        if (!item.Content) return item;
        
        try {
          const { data: stats } = await this.supabase
            .from('content_engagement_stats')
            .select('total_views, total_likes, total_valid_views')
            .eq('content_id', item.content_id)
            .maybeSingle();
          
          return {
            ...item,
            Content: {
              ...item.Content,
              views_count: stats?.total_views || 0,
              likes_count: stats?.total_likes || 0,
              valid_views_count: stats?.total_valid_views || 0
            }
          };
        } catch (e) {
          return item;
        }
      }));
      
      // Cache the tracks for album/playlist display
      const tracks = (itemsWithStats || [])
        .filter(item => item.Content)
        .map(item => ({
          id: item.content_id,
          title: item.Content?.title || 'Untitled',
          description: item.Content?.description,
          thumbnail_url: item.Content?.thumbnail_url,
          file_url: item.Content?.file_url,
          duration: item.Content?.duration,
          media_type: item.Content?.media_type,
          artist: item.Content?.user_profiles?.full_name || item.Content?.user_profiles?.username,
          added_at: item.added_at,
          views_count: item.Content?.views_count || 0,
          likes_count: item.Content?.likes_count || 0
        }));
      
      this._cachePlaylistTracks(playlistId, tracks);
      
      return {
        ...playlist,
        items: itemsWithStats || [],
        tracks: tracks
      };
    } catch (error) {
      console.error('❌ Failed to get playlist:', error);
      this._handleError('get_playlist', error);
      return null;
    }
  };

  PlaylistManager.prototype.createPlaylist = async function(name, description = '', isPublic = false) {
    if (!this.userId) {
      this._handleError('create_playlist', new Error('User not logged in'));
      return null;
    }
    
    if (!name || name.trim() === '') {
      this._handleError('create_playlist', new Error('Playlist name is required'));
      return null;
    }
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .insert({
          user_id: this.userId,
          name: name.trim(),
          description: description.trim(),
          is_public: isPublic,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      console.log('✅ Playlist created:', data?.name);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ action: 'create', playlist: data });
      }
      
      return data;
    } catch (error) {
      console.error('❌ Failed to create playlist:', error);
      this._handleError('create_playlist', error);
      return null;
    }
  };

  PlaylistManager.prototype.updatePlaylist = async function(playlistId, updates) {
    if (!playlistId) {
      this._handleError('update_playlist', new Error('Playlist ID required'));
      return false;
    }
    
    try {
      const { error } = await this.supabase
        .from('playlists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', playlistId)
        .eq('user_id', this.userId);
      
      if (error) throw error;
      
      console.log('✅ Playlist updated:', playlistId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ action: 'update', playlistId });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to update playlist:', error);
      this._handleError('update_playlist', error);
      return false;
    }
  };

  PlaylistManager.prototype.deletePlaylist = async function(playlistId) {
    if (!playlistId) {
      this._handleError('delete_playlist', new Error('Playlist ID required'));
      return false;
    }
    
    try {
      const { error: itemsError } = await this.supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId);
      
      if (itemsError) throw itemsError;
      
      const { error } = await this.supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', this.userId);
      
      if (error) throw error;
      
      console.log('✅ Playlist deleted:', playlistId);
      
      if (this._watchLaterPlaylistId === playlistId) {
        this._watchLaterPlaylistId = null;
        this._watchLaterCacheTime = null;
      }
      
      this._playlistTracksCache.delete(playlistId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ action: 'delete', playlistId });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to delete playlist:', error);
      this._handleError('delete_playlist', error);
      return false;
    }
  };

  // ============================================
  // PUBLIC API - PLAYLIST ITEMS
  // ============================================

  PlaylistManager.prototype.addToPlaylist = async function(playlistId, contentId) {
    if (!playlistId || !contentId) {
      this._handleError('add_to_playlist', new Error('Playlist ID and Content ID required'));
      return false;
    }
    
    try {
      // ✅ CRITICAL FIX #4: Check if already exists to avoid duplicate key error
      const { data: existing, error: checkError } = await this.supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('content_id', contentId)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      if (existing) {
        console.log('ℹ️ Content already in playlist:', contentId);
        return true;
      }
      
      const { error } = await this.supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          content_id: contentId,
          added_at: new Date().toISOString()
        });
      
      // Handle duplicate key gracefully
      if (error && error.code === '23505') {
        console.log('ℹ️ Content already in playlist (duplicate key)');
        return true;
      }
      
      if (error) throw error;
      
      console.log('✅ Added to playlist:', contentId);
      
      await this.supabase
        .from('playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlistId);
      
      this._playlistTracksCache.delete(playlistId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ 
          action: 'add_item', 
          playlistId, 
          contentId,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to add to playlist:', error);
      this._handleError('add_to_playlist', error);
      return false;
    }
  };

  PlaylistManager.prototype.removeFromPlaylist = async function(playlistId, contentId) {
    if (!playlistId || !contentId) {
      this._handleError('remove_from_playlist', new Error('Playlist ID and Content ID required'));
      return false;
    }
    
    try {
      const { error } = await this.supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('content_id', contentId);
      
      if (error) throw error;
      
      console.log('✅ Removed from playlist:', contentId);
      
      await this.supabase
        .from('playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlistId);
      
      this._playlistTracksCache.delete(playlistId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ 
          action: 'remove_item', 
          playlistId, 
          contentId,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to remove from playlist:', error);
      this._handleError('remove_from_playlist', error);
      return false;
    }
  };

  PlaylistManager.prototype.isInPlaylist = async function(playlistId, contentId) {
    if (!playlistId || !contentId || !this.userId) return false;
    
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('content_id', contentId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      return !!data;
    } catch (error) {
      console.warn('⚠️ Failed to check playlist membership:', error);
      return false;
    }
  };

  PlaylistManager.prototype.getPlaylistsForContent = async function(contentId) {
    if (!contentId || !this.userId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select(`
          playlist_id,
          playlists!inner (
            id,
            name,
            is_public
          )
        `)
        .eq('content_id', contentId);
      
      if (error) throw error;
      
      return (data || []).map(item => item.playlists).filter(Boolean);
    } catch (error) {
      console.error('❌ Failed to get playlists for content:', error);
      return [];
    }
  };

  // ============================================
  // 🔧 ALBUM FIX: TRACK SOURCE DETECTION
  // ============================================

  PlaylistManager.prototype.getAlbumTracks = async function(playlistIdOrContent) {
    let tracks = [];
    
    if (typeof playlistIdOrContent === 'string' || typeof playlistIdOrContent === 'number') {
      const cacheKey = String(playlistIdOrContent);
      if (this._playlistTracksCache.has(cacheKey)) {
        const cached = this._playlistTracksCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this._playlistTracksCacheDuration) {
          console.log('📀 Using cached tracks for playlist:', cacheKey, cached.tracks?.length || 0);
          return cached.tracks || [];
        }
      }
      
      const playlist = await this.getPlaylist(playlistIdOrContent);
      if (playlist && playlist.tracks) {
        tracks = playlist.tracks;
      }
    }
    else if (playlistIdOrContent && typeof playlistIdOrContent === 'object') {
      const content = playlistIdOrContent;
      
      if (content.items && Array.isArray(content.items)) {
        tracks = content.items;
        console.log('📀 Tracks from content.items:', tracks.length);
      } else if (content.tracks && Array.isArray(content.tracks)) {
        tracks = content.tracks;
        console.log('📀 Tracks from content.tracks:', tracks.length);
      } else if (content._playlistItems && Array.isArray(content._playlistItems)) {
        tracks = content._playlistItems;
        console.log('📀 Tracks from content._playlistItems:', tracks.length);
      } else if (content.playlist_items && Array.isArray(content.playlist_items)) {
        tracks = content.playlist_items;
        console.log('📀 Tracks from content.playlist_items:', tracks.length);
      }
      
      if (tracks.length > 0 && tracks[0] && !tracks[0].title && tracks[0].Content) {
        tracks = tracks.map(item => ({
          id: item.content_id || item.Content?.id,
          title: item.Content?.title || 'Untitled',
          description: item.Content?.description,
          thumbnail_url: item.Content?.thumbnail_url,
          file_url: item.Content?.file_url,
          duration: item.Content?.duration,
          media_type: item.Content?.media_type,
          artist: item.Content?.user_profiles?.full_name || item.Content?.user_profiles?.username,
          added_at: item.added_at,
          views_count: item.Content?.views_count || 0,
          likes_count: item.Content?.likes_count || 0
        }));
      }
    }
    else if (window.currentPlaylistItems && window.currentPlaylistItems.length > 0) {
      tracks = window.currentPlaylistItems;
      console.log('📀 Tracks from window.currentPlaylistItems:', tracks.length);
    } else if (window.ContentCollectionsEngine && window.ContentCollectionsEngine.items) {
      tracks = window.ContentCollectionsEngine.items;
      console.log('📀 Tracks from ContentCollectionsEngine.items:', tracks.length);
    } else if (window.currentPlaylist && window.currentPlaylist.items) {
      tracks = window.currentPlaylist.items;
      console.log('📀 Tracks from window.currentPlaylist.items:', tracks.length);
    } else if (window.currentContent && window.currentContent._playlistItems) {
      tracks = window.currentContent._playlistItems;
      console.log('📀 Tracks from window.currentContent._playlistItems:', tracks.length);
    }
    
    if (!tracks || tracks.length === 0) {
      console.warn('⚠️ No tracks available in any source', {
        input: playlistIdOrContent,
        hasPlaylistId: typeof playlistIdOrContent === 'string' || typeof playlistIdOrContent === 'number',
        hasCurrentPlaylistItems: !!(window.currentPlaylistItems?.length),
        hasContentCollectionsEngine: !!(window.ContentCollectionsEngine?.items?.length),
        hasCurrentPlaylist: !!(window.currentPlaylist?.items?.length)
      });
    }
    
    return tracks || [];
  };

  PlaylistManager.prototype.getPlaylistTracks = async function(playlistId) {
    return await this.getAlbumTracks(playlistId);
  };

  PlaylistManager.prototype._cachePlaylistTracks = function(playlistId, tracks) {
    this._playlistTracksCache.set(String(playlistId), {
      tracks: tracks || [],
      timestamp: Date.now()
    });
    
    if (this._cacheTimeout) {
      clearTimeout(this._cacheTimeout);
    }
    this._cacheTimeout = setTimeout(() => {
      this._clearExpiredCache();
    }, this._playlistTracksCacheDuration * 2);
  };

  PlaylistManager.prototype._clearExpiredCache = function() {
    const now = Date.now();
    for (const [key, value] of this._playlistTracksCache.entries()) {
      if (value && now - value.timestamp > this._playlistTracksCacheDuration * 2) {
        this._playlistTracksCache.delete(key);
      }
    }
  };

  PlaylistManager.prototype.clearPlaylistTracksCache = function() {
    this._playlistTracksCache.clear();
    console.log('🗑️ Playlist tracks cache cleared');
  };

  // ============================================
  // ✅ CRITICAL FIX #2 & #3: WATCH LATER METHODS
  // ============================================

  PlaylistManager.prototype.getWatchLaterPlaylistId = async function() {
    if (!this.userId) {
      console.warn('⚠️ Cannot get Watch Later: No user logged in');
      return null;
    }
    
    const now = Date.now();
    if (this._watchLaterPlaylistId && this._watchLaterCacheTime && 
        (now - this._watchLaterCacheTime) < this._cacheDuration) {
      return this._watchLaterPlaylistId;
    }
    
    try {
      let { data: playlist, error } = await this.supabase
        .from('playlists')
        .select('id')
        .eq('user_id', this.userId)
        .eq('name', this.watchLaterName)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!playlist) {
        console.log('📋 Creating Watch Later playlist for user:', this.userId);
        
        const { data: newPlaylist, error: createError } = await this.supabase
          .from('playlists')
          .insert({
            user_id: this.userId,
            name: this.watchLaterName,
            description: 'Content saved to watch later',
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();
        
        if (createError) throw createError;
        
        playlist = newPlaylist;
        console.log('✅ Watch Later playlist created:', playlist?.id);
      }
      
      if (!playlist) {
        throw new Error('Failed to create or retrieve Watch Later playlist');
      }
      
      this._watchLaterPlaylistId = playlist.id;
      this._watchLaterCacheTime = now;
      
      return playlist.id;
    } catch (error) {
      console.error('❌ Failed to get Watch Later playlist:', error);
      this._handleError('get_watch_later', error);
      return null;
    }
  };

  PlaylistManager.prototype.addToWatchLater = async function(contentId) {
    if (!this.userId) {
      this._handleError('add_to_watch_later', new Error('User not logged in'));
      return false;
    }
    
    if (!contentId) {
      this._handleError('add_to_watch_later', new Error('Content ID required'));
      return false;
    }
    
    try {
      const watchLaterId = await this.getWatchLaterPlaylistId();
      if (!watchLaterId) {
        throw new Error('Could not get or create Watch Later playlist');
      }
      
      const success = await this.addToPlaylist(watchLaterId, contentId);
      
      if (success) {
        console.log('✅ Added to Watch Later:', contentId);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to add to Watch Later:', error);
      this._handleError('add_to_watch_later', error);
      return false;
    }
  };

  PlaylistManager.prototype.removeFromWatchLater = async function(contentId) {
    if (!this.userId || !contentId) return false;
    
    try {
      const watchLaterId = await this.getWatchLaterPlaylistId();
      if (!watchLaterId) return false;
      
      const success = await this.removeFromPlaylist(watchLaterId, contentId);
      
      if (success) {
        console.log('✅ Removed from Watch Later:', contentId);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to remove from Watch Later:', error);
      this._handleError('remove_from_watch_later', error);
      return false;
    }
  };

  PlaylistManager.prototype.isInWatchLater = async function(contentId) {
    if (!this.userId || !contentId) return false;
    
    try {
      const watchLaterId = await this.getWatchLaterPlaylistId();
      if (!watchLaterId) return false;
      
      return await this.isInPlaylist(watchLaterId, contentId);
    } catch (error) {
      console.warn('⚠️ Failed to check Watch Later status:', error);
      return false;
    }
  };

  PlaylistManager.prototype.getWatchLaterItems = async function() {
    if (!this.userId) return [];
    
    try {
      const watchLaterId = await this.getWatchLaterPlaylistId();
      if (!watchLaterId) return [];
      
      const playlist = await this.getPlaylist(watchLaterId);
      return playlist?.items || [];
    } catch (error) {
      console.error('❌ Failed to get Watch Later items:', error);
      return [];
    }
  };

  PlaylistManager.prototype.toggleWatchLater = async function(contentId) {
    if (!this.userId || !contentId) {
      return { added: false, removed: false, success: false };
    }
    
    const isPresent = await this.isInWatchLater(contentId);
    
    if (isPresent) {
      const removed = await this.removeFromWatchLater(contentId);
      return { added: false, removed: removed, success: removed, action: 'removed' };
    } else {
      const added = await this.addToWatchLater(contentId);
      return { added: added, removed: false, success: added, action: 'added' };
    }
  };

  // ============================================
  // PUBLIC API - UTILITY METHODS
  // ============================================

  PlaylistManager.prototype.clearWatchLaterCache = function() {
    this._watchLaterPlaylistId = null;
    this._watchLaterCacheTime = null;
    console.log('🗑️ Watch later cache cleared');
  };

  PlaylistManager.prototype.setUserId = function(userId) {
    this.userId = userId;
    this.clearWatchLaterCache();
    this.clearPlaylistTracksCache();
    console.log('👤 PlaylistManager user ID updated:', userId || 'guest');
    
    if (this.onPlaylistUpdated) {
      this.onPlaylistUpdated({ action: 'user_change', userId: userId });
    }
  };

  PlaylistManager.prototype.isAuthenticated = function() {
    return !!this.userId;
  };

  PlaylistManager.prototype.getPlaylistAsTracks = async function(playlistId) {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return [];
    
    return playlist.tracks || [];
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  PlaylistManager.prototype._handleError = function(context, error) {
    console.error('❌ PlaylistManager error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error?.message || error || 'Unknown error' });
    }
  };

  // ============================================
  // EXPORT
  // ============================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistManager;
  } else {
    window.PlaylistManager = PlaylistManager;
  }
  
  console.log('✅ PlaylistManager module loaded successfully (Phase 5 Compatible)');
})();
