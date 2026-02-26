// js/playlist-manager.js — Production Playlist & Watch Later Manager
// Bantu Stream Connect — Phase 2 Implementation
// FIXED: Using 'name' column instead of 'title' to match database schema

(function() {
  'use strict';
  
  console.log('📋 PlaylistManager module loading...');

  function PlaylistManager(config) {
    if (!config || !config.supabase) {
      console.error('❌ PlaylistManager: Missing required config (supabase)');
      return;
    }

    this.supabase = config.supabase;
    this.userId = config.userId || null;
    this.watchLaterName = config.watchLaterName || 'Watch Later'; // CHANGED: from watchLaterTitle
    
    // Callbacks
    this.onPlaylistUpdated = config.onPlaylistUpdated || null;
    this.onError = config.onError || null;
    
    // Cache
    this._watchLaterPlaylistId = null;
    this._watchLaterItems = [];
    this._lastFetch = 0;
    this._cacheDuration = 30000; // 30 seconds
    
    console.log('✅ PlaylistManager initialized for user: ' + (this.userId || 'guest'));
  }

  // ============================================
  // PUBLIC API — WATCH LATER
  // ============================================

  PlaylistManager.prototype.isInWatchLater = async function(contentId) {
    if (!this.userId) return false;
    
    await this._ensureWatchLaterPlaylist();
    
    if (!this._watchLaterPlaylistId) return false;
    
    // Check cache first
    if (Date.now() - this._lastFetch < this._cacheDuration) {
      return this._watchLaterItems.some(item => item.content_id === contentId);
    }
    
    // Fetch from DB
    return this._checkItemInPlaylist(this._watchLaterPlaylistId, contentId);
  };

  PlaylistManager.prototype.addToWatchLater = async function(contentId) {
    if (!this.userId) {
      this._handleError('addToWatchLater', 'User not authenticated');
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      await this._ensureWatchLaterPlaylist();
      
      if (!this._watchLaterPlaylistId) {
        throw new Error('Could not create Watch Later playlist');
      }
      
      // Check if already exists
      const exists = await this._checkItemInPlaylist(
        this._watchLaterPlaylistId, 
        contentId
      );
      
      if (exists) {
        return { success: true, action: 'already_exists' };
      }
      
      // Add item
      const { data, error } = await this.supabase
        .from('playlist_items')
        .insert({
          playlist_id: this._watchLaterPlaylistId,
          content_id: contentId,
          position: await this._getNextPosition(this._watchLaterPlaylistId)
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update cache
      this._watchLaterItems.push(data);
      this._lastFetch = Date.now();
      
      console.log('✅ Added to Watch Later:', contentId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ 
          playlistId: this._watchLaterPlaylistId, 
          action: 'added', 
          item: data 
        });
      }
      
      return { success: true, action: 'added', item: data };
      
    } catch (error) {
      console.error('❌ Add to Watch Later failed:', error);
      this._handleError('addToWatchLater', error);
      return { success: false, error: error.message };
    }
  };

  PlaylistManager.prototype.removeFromWatchLater = async function(contentId) {
    if (!this.userId || !this._watchLaterPlaylistId) {
      return { success: false, error: 'Not authenticated or no playlist' };
    }
    
    try {
      const { error } = await this.supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', this._watchLaterPlaylistId)
        .eq('content_id', contentId);
      
      if (error) throw error;
      
      // Update cache
      this._watchLaterItems = this._watchLaterItems.filter(
        item => item.content_id !== contentId
      );
      this._lastFetch = Date.now();
      
      console.log('✅ Removed from Watch Later:', contentId);
      
      if (this.onPlaylistUpdated) {
        this.onPlaylistUpdated({ 
          playlistId: this._watchLaterPlaylistId, 
          action: 'removed', 
          contentId: contentId 
        });
      }
      
      return { success: true, action: 'removed' };
      
    } catch (error) {
      console.error('❌ Remove from Watch Later failed:', error);
      this._handleError('removeFromWatchLater', error);
      return { success: false, error: error.message };
    }
  };

  PlaylistManager.prototype.toggleWatchLater = async function(contentId) {
    const isInList = await this.isInWatchLater(contentId);
    
    if (isInList) {
      return await this.removeFromWatchLater(contentId);
    } else {
      return await this.addToWatchLater(contentId);
    }
  };

  PlaylistManager.prototype.getWatchLaterItems = async function(limit = 20) {
    if (!this.userId) return [];
    
    await this._ensureWatchLaterPlaylist();
    
    if (!this._watchLaterPlaylistId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select(`
          *,
          Content (
            id,
            title,
            thumbnail_url,
            genre,
            duration,
            user_profiles!user_id (
              full_name,
              username,
              avatar_url
            )
          )
        `)
        .eq('playlist_id', this._watchLaterPlaylistId)
        .order('position', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      
      // Update cache
      this._watchLaterItems = data || [];
      this._lastFetch = Date.now();
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Fetch Watch Later failed:', error);
      this._handleError('getWatchLaterItems', error);
      return [];
    }
  };

  // ============================================
  // PUBLIC API — GENERAL PLAYLISTS
  // ============================================

  PlaylistManager.prototype.createPlaylist = async function(name, description = '', isPublic = false) {
    if (!this.userId) {
      this._handleError('createPlaylist', 'User not authenticated');
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .insert({
          user_id: this.userId,
          name: name.trim(), // CHANGED: from 'title' to 'name'
          description: description.trim(),
          is_public: isPublic
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Playlist created:', data.id);
      return { success: true, playlist: data };
      
    } catch (error) {
      console.error('❌ Create playlist failed:', error);
      this._handleError('createPlaylist', error);
      return { success: false, error: error.message };
    }
  };

  PlaylistManager.prototype.getUserPlaylists = async function() {
    if (!this.userId) return [];
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .select('*')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Fetch playlists failed:', error);
      this._handleError('getUserPlaylists', error);
      return [];
    }
  };

  PlaylistManager.prototype.getPlaylistItems = async function(playlistId, limit = 50) {
    if (!this.userId) return [];
    
    try {
      // Verify playlist belongs to user
      const { data: playlist, error: playlistError } = await this.supabase
        .from('playlists')
        .select('user_id')
        .eq('id', playlistId)
        .single();
      
      if (playlistError || playlist?.user_id !== this.userId) {
        throw new Error('Playlist not found or access denied');
      }
      
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select(`
          *,
          Content (
            id,
            title,
            thumbnail_url,
            genre,
            duration
          )
        `)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Fetch playlist items failed:', error);
      this._handleError('getPlaylistItems', error);
      return [];
    }
  };

  PlaylistManager.prototype.removeFromPlaylist = async function(playlistId, contentId) {
    if (!this.userId) {
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      const { error } = await this.supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('content_id', contentId);
      
      if (error) throw error;
      
      console.log('✅ Removed from playlist:', contentId);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Remove from playlist failed:', error);
      this._handleError('removeFromPlaylist', error);
      return { success: false, error: error.message };
    }
  };

  PlaylistManager.prototype.deletePlaylist = async function(playlistId) {
    if (!this.userId) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Prevent deleting Watch Later
    if (playlistId === this._watchLaterPlaylistId) {
      return { success: false, error: 'Cannot delete Watch Later playlist' };
    }
    
    try {
      const { error } = await this.supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', this.userId);
      
      if (error) throw error;
      
      console.log('✅ Playlist deleted:', playlistId);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Delete playlist failed:', error);
      this._handleError('deletePlaylist', error);
      return { success: false, error: error.message };
    }
  };

  // ============================================
  // PRIVATE METHODS
  // ============================================

  PlaylistManager.prototype._ensureWatchLaterPlaylist = async function() {
    if (!this.userId) return;
    
    // Return cached ID if available
    if (this._watchLaterPlaylistId) {
      return this._watchLaterPlaylistId;
    }
    
    try {
      // Try to fetch existing Watch Later playlist
      const { data, error } = await this.supabase
        .from('playlists')
        .select('id')
        .eq('user_id', this.userId)
        .eq('name', this.watchLaterName) // CHANGED: from 'title' to 'name'
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        this._watchLaterPlaylistId = data.id;
        return data.id;
      }
      
      // Create if doesn't exist
      const { data: newPlaylist, error: createError } = await this.supabase
        .from('playlists')
        .insert({
          user_id: this.userId,
          name: this.watchLaterName, // CHANGED: from 'title' to 'name'
          description: 'Videos to watch later',
          is_public: false
        })
        .select('id')
        .single();
      
      if (createError) throw createError;
      
      this._watchLaterPlaylistId = newPlaylist.id;
      return newPlaylist.id;
      
    } catch (error) {
      console.error('❌ Ensure Watch Later playlist failed:', error);
      this._handleError('_ensureWatchLaterPlaylist', error);
      return null;
    }
  };

  PlaylistManager.prototype._checkItemInPlaylist = async function(playlistId, contentId) {
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('content_id', contentId)
        .maybeSingle();
      
      if (error) throw error;
      
      return !!data;
      
    } catch (error) {
      console.error('❌ Check item in playlist failed:', error);
      return false;
    }
  };

  PlaylistManager.prototype._getNextPosition = async function(playlistId) {
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      return data ? data.position + 1 : 0;
      
    } catch (error) {
      console.error('❌ Get next position failed:', error);
      return 0;
    }
  };

  PlaylistManager.prototype._handleError = function(context, error) {
    console.error('❌ PlaylistManager error [' + context + ']:', error);
    if (this.onError) {
      this.onError({ context: context, error: error.message || error });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistManager;
  } else {
    window.PlaylistManager = PlaylistManager;
  }
  
  console.log('✅ PlaylistManager module loaded successfully with name column fix');
})();
