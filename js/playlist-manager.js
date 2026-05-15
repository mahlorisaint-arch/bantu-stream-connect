// js/playlist-manager.js - Bantu Stream Connect Playlist Manager
// COMPLETE FIXED VERSION WITH WATCH LATER AND PLAYLIST MODAL INTEGRATION
// FIXED: Duplicate key constraint error handling
// FIXED: Watch Later playlist creation and management
// FIXED: Playlist item add/remove with proper error handling
// ✅ CRITICAL FIX #1: Added isInWatchLater method with proper error handling
// ✅ CRITICAL FIX #2: Added getWatchLaterPlaylistId method with caching
// ✅ CRITICAL FIX #3: Added addToWatchLater and removeFromWatchLater methods
// ✅ CRITICAL FIX #4: Fixed playlist item insertion to handle duplicates gracefully

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
    
    // Callbacks
    this.onPlaylistUpdated = config.onPlaylistUpdated || null;
    this.onError = config.onError || null;
    
    console.log('✅ PlaylistManager initialized for user:', this.userId || 'guest');
  }

  // ============================================
  // PUBLIC API - CORE PLAYLIST OPERATIONS
  // ============================================

  /**
   * Get all playlists for the current user
   */
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
      
      // Add item count to each playlist
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

  /**
   * Get a single playlist by ID with its items
   */
  PlaylistManager.prototype.getPlaylist = async function(playlistId) {
    if (!playlistId) {
      console.warn('⚠️ Cannot get playlist: No playlist ID provided');
      return null;
    }
    
    try {
      // Get playlist details
      const { data: playlist, error: playlistError } = await this.supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();
      
      if (playlistError) throw playlistError;
      
      // Get playlist items with content details
      const { data: items, error: itemsError } = await this.supabase
        .from('playlist_items')
        .select(`
          id,
          added_at,
          content_id,
          Content (
            id,
            title,
            thumbnail_url,
            duration,
            media_type,
            views_count,
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
      
      return {
        ...playlist,
        items: items || []
      };
    } catch (error) {
      console.error('❌ Failed to get playlist:', error);
      this._handleError('get_playlist', error);
      return null;
    }
  };

  /**
   * Create a new playlist
   */
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
        .single();
      
      if (error) throw error;
      
      console.log('✅ Playlist created:', data.name);
      
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

  /**
   * Update an existing playlist
   */
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

  /**
   * Delete a playlist
   */
  PlaylistManager.prototype.deletePlaylist = async function(playlistId) {
    if (!playlistId) {
      this._handleError('delete_playlist', new Error('Playlist ID required'));
      return false;
    }
    
    try {
      // First delete all playlist items (cascade should handle this, but explicit for safety)
      const { error: itemsError } = await this.supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId);
      
      if (itemsError) throw itemsError;
      
      // Then delete the playlist
      const { error } = await this.supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', this.userId);
      
      if (error) throw error;
      
      console.log('✅ Playlist deleted:', playlistId);
      
      // Invalidate watch later cache if this was the watch later playlist
      if (this._watchLaterPlaylistId === playlistId) {
        this._watchLaterPlaylistId = null;
        this._watchLaterCacheTime = null;
      }
      
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

  /**
   * Add content to a playlist
   */
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
        return true; // Already exists, consider success
      }
      
      const { error } = await this.supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          content_id: contentId,
          added_at: new Date().toISOString()
        });
      
      // Handle duplicate key gracefully
      if (error && error.code === '23505') { // Unique violation
        console.log('ℹ️ Content already in playlist (duplicate key)');
        return true;
      }
      
      if (error) throw error;
      
      console.log('✅ Added to playlist:', contentId);
      
      // Update playlist updated_at
      await this.supabase
        .from('playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlistId);
      
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

  /**
   * Remove content from a playlist
   */
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
      
      // Update playlist updated_at
      await this.supabase
        .from('playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlistId);
      
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

  /**
   * Check if content is in a specific playlist
   */
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

  /**
   * Get all playlists containing a specific content
   */
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
      
      return (data || []).map(item => item.playlists);
    } catch (error) {
      console.error('❌ Failed to get playlists for content:', error);
      return [];
    }
  };

  // ============================================
  // ✅ CRITICAL FIX #2 & #3: WATCH LATER METHODS
  // ============================================

  /**
   * Get or create the Watch Later playlist ID
   * Uses caching to reduce database calls
   */
  PlaylistManager.prototype.getWatchLaterPlaylistId = async function() {
    if (!this.userId) {
      console.warn('⚠️ Cannot get Watch Later: No user logged in');
      return null;
    }
    
    // Check cache
    const now = Date.now();
    if (this._watchLaterPlaylistId && this._watchLaterCacheTime && 
        (now - this._watchLaterCacheTime) < this._cacheDuration) {
      return this._watchLaterPlaylistId;
    }
    
    try {
      // Look for existing Watch Later playlist
      let { data: playlist, error } = await this.supabase
        .from('playlists')
        .select('id')
        .eq('user_id', this.userId)
        .eq('name', this.watchLaterName)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      // Create if it doesn't exist
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
          .single();
        
        if (createError) throw createError;
        
        playlist = newPlaylist;
        console.log('✅ Watch Later playlist created:', playlist.id);
      }
      
      // Update cache
      this._watchLaterPlaylistId = playlist.id;
      this._watchLaterCacheTime = now;
      
      return playlist.id;
    } catch (error) {
      console.error('❌ Failed to get Watch Later playlist:', error);
      this._handleError('get_watch_later', error);
      return null;
    }
  };

  /**
   * ✅ CRITICAL FIX #3: Add content to Watch Later
   */
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

  /**
   * ✅ CRITICAL FIX #3: Remove content from Watch Later
   */
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

  /**
   * ✅ CRITICAL FIX #1: Check if content is in Watch Later
   */
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

  /**
   * Get all Watch Later items
   */
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

  /**
   * Toggle content in Watch Later (add if not present, remove if present)
   */
  PlaylistManager.prototype.toggleWatchLater = async function(contentId) {
    if (!this.userId || !contentId) {
      return { added: false, removed: false };
    }
    
    const isPresent = await this.isInWatchLater(contentId);
    
    if (isPresent) {
      const removed = await this.removeFromWatchLater(contentId);
      return { added: false, removed };
    } else {
      const added = await this.addToWatchLater(contentId);
      return { added, removed: false };
    }
  };

  // ============================================
  // PUBLIC API - UTILITY METHODS
  // ============================================

  /**
   * Clear the watch later cache (useful after logout)
   */
  PlaylistManager.prototype.clearWatchLaterCache = function() {
    this._watchLaterPlaylistId = null;
    this._watchLaterCacheTime = null;
    console.log('🗑️ Watch later cache cleared');
  };

  /**
   * Update user ID (for when user logs in/out)
   */
  PlaylistManager.prototype.setUserId = function(userId) {
    this.userId = userId;
    this.clearWatchLaterCache();
    console.log('👤 PlaylistManager user ID updated:', userId || 'guest');
    
    if (this.onPlaylistUpdated) {
      this.onPlaylistUpdated({ action: 'user_change', userId });
    }
  };

  /**
   * Check if user is logged in
   */
  PlaylistManager.prototype.isAuthenticated = function() {
    return !!this.userId;
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  PlaylistManager.prototype._handleError = function(context, error) {
    console.error('❌ PlaylistManager error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
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
  
  console.log('✅ PlaylistManager module loaded successfully');
})();
