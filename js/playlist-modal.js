// js/playlist-modal.js — Watch Later Modal & Playlist Management
// Bantu Stream Connect — Phase 2 Polish
// FIXED: Duplicate key constraint error handling with pre-check

(function() {
  'use strict';
  
  console.log('📋 Playlist Modal module loading...');
  
  function PlaylistModal(config) {
    if (!config || !config.supabase) {
      console.error('❌ PlaylistModal: Missing required config (supabase)');
      return;
    }
    
    this.supabase = config.supabase;
    this.userId = config.userId || null;
    this.contentId = config.contentId || null;
    this.modal = null;
    this.playlists = [];
    
    this.createModal();
    this.setupEventListeners();
    
    console.log('✅ Playlist Modal initialized');
  }
  
  PlaylistModal.prototype.createModal = function() {
    const self = this;
    
    this.modal = document.createElement('div');
    this.modal.id = 'playlist-modal';
    this.modal.className = 'playlist-modal';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.className = 'playlist-modal-content';
    content.style.cssText = `
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--card-border);
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Add to Playlist';
    title.style.cssText = `
      font-family: 'Orbitron', sans-serif;
      font-size: 20px;
      color: var(--soft-white);
      margin: 0;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'playlist-modal-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: var(--slate-grey);
      font-size: 20px;
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.addEventListener('click', () => self.close());
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const createNewSection = document.createElement('div');
    createNewSection.style.cssText = `
      margin-bottom: 20px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid var(--card-border);
    `;
    
    const createTitle = document.createElement('h3');
    createTitle.textContent = 'Create New Playlist';
    createTitle.style.cssText = `
      font-size: 14px;
      color: var(--warm-gold);
      margin-bottom: 10px;
    `;
    
    const createForm = document.createElement('div');
    createForm.style.cssText = `
      display: flex;
      gap: 10px;
    `;
    
    const input = document.createElement('input');
    input.id = 'new-playlist-name';
    input.type = 'text';
    input.placeholder = 'Playlist name...';
    input.style.cssText = `
      flex: 1;
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--soft-white);
      font-size: 14px;
      outline: none;
    `;
    
    const createBtn = document.createElement('button');
    createBtn.id = 'create-playlist-btn';
    createBtn.textContent = 'Create';
    createBtn.style.cssText = `
      padding: 10px 20px;
      background: linear-gradient(135deg, var(--bantu-blue), var(--warm-gold));
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    `;
    createBtn.addEventListener('click', () => self.createNewPlaylist());
    
    createForm.appendChild(input);
    createForm.appendChild(createBtn);
    createNewSection.appendChild(createTitle);
    createNewSection.appendChild(createForm);
    
    const existingSection = document.createElement('div');
    existingSection.id = 'existing-playlists-section';
    existingSection.style.cssText = `
      margin-bottom: 20px;
    `;
    
    const existingTitle = document.createElement('h3');
    existingTitle.textContent = 'Existing Playlists';
    existingTitle.style.cssText = `
      font-size: 14px;
      color: var(--slate-grey);
      margin-bottom: 10px;
    `;
    
    const playlistsContainer = document.createElement('div');
    playlistsContainer.id = 'playlists-container';
    playlistsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    
    existingSection.appendChild(existingTitle);
    existingSection.appendChild(playlistsContainer);
    
    const watchLaterSection = document.createElement('div');
    watchLaterSection.style.cssText = `
      padding: 15px;
      background: rgba(245, 158, 11, 0.1);
      border-radius: 12px;
      border: 1px solid var(--warm-gold);
    `;
    
    const watchLaterBtn = document.createElement('button');
    watchLaterBtn.id = 'quick-watch-later-btn';
    watchLaterBtn.innerHTML = '<i class="fas fa-clock"></i> Add to Watch Later';
    watchLaterBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid var(--warm-gold);
      border-radius: 8px;
      color: var(--warm-gold);
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    watchLaterBtn.addEventListener('click', () => self.quickAddToWatchLater());
    
    watchLaterSection.appendChild(watchLaterBtn);
    
    content.appendChild(header);
    content.appendChild(createNewSection);
    content.appendChild(existingSection);
    content.appendChild(watchLaterSection);
    this.modal.appendChild(content);
    document.body.appendChild(this.modal);
    
    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  };
  
  PlaylistModal.prototype.setupEventListeners = function() {
    // Enter key to create playlist
    const input = document.getElementById('new-playlist-name');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.createNewPlaylist();
        }
      });
    }
  };
  
  PlaylistModal.prototype.open = async function() {
    if (!this.userId) {
      showToast('Please sign in to use playlists', 'warning');
      return;
    }
    
    this.modal.style.display = 'flex';
    await this.loadPlaylists();
  };
  
  PlaylistModal.prototype.close = function() {
    this.modal.style.display = 'none';
  };
  
  PlaylistModal.prototype.loadPlaylists = async function() {
    const container = document.getElementById('playlists-container');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--slate-grey)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      this.playlists = data || [];
      
      if (this.playlists.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--slate-grey)">No playlists yet. Create one above!</div>';
        return;
      }
      
      // ✅ FIXED: Render playlists with proper click handlers and XSS protection
      container.innerHTML = this.playlists.map(playlist => {
        const isWatchLater = playlist.name === 'Watch Later';
        return `
          <div class="playlist-item" data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--card-border);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            <div style="display:flex;align-items:center;gap:10px">
              <i class="fas ${isWatchLater ? 'fa-clock' : 'fa-list'}" style="color:var(--warm-gold)"></i>
              <span style="color:var(--soft-white);font-size:14px">${this._escapeHtml(playlist.name)}</span>
            </div>
            <button class="add-to-playlist-btn" data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}" style="
              padding: 6px 12px;
              background: var(--bantu-blue);
              border: none;
              border-radius: 6px;
              color: white;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            ">Add</button>
          </div>
        `;
      }).join('');
      
      // ✅ FIXED: Add click handlers to buttons
      container.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const playlistId = btn.dataset.playlistId;
          const playlistName = btn.dataset.playlistName;
          this.addToPlaylist(playlistId, playlistName);
        });
      });
      
    } catch (error) {
      console.error('Error loading playlists:', error);
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--error-color)">Failed to load playlists</div>';
    }
  };
  
  PlaylistModal.prototype.createNewPlaylist = async function() {
    const input = document.getElementById('new-playlist-name');
    if (!input || !input.value.trim()) {
      showToast('Please enter a playlist name', 'warning');
      return;
    }
    
    const name = input.value.trim();
    
    try {
      const { data, error } = await this.supabase
        .from('playlists')
        .insert({
          user_id: this.userId,
          name: name,
          description: '',
          is_public: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      showToast('Playlist created!', 'success');
      input.value = '';
      await this.loadPlaylists();
      
    } catch (error) {
      console.error('Error creating playlist:', error);
      showToast('Failed to create playlist', 'error');
    }
  };
  
  // ✅ FIXED: Add helper method for HTML escaping to prevent XSS
  PlaylistModal.prototype._escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  // ✅ FIXED: Helper method to get next position in playlist
  PlaylistModal.prototype._getNextPosition = async function(playlistId) {
    try {
      const { data, error } = await this.supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      return data ? (data.position + 1) : 0;
    } catch (error) {
      console.warn('Error getting next position:', error);
      return 0;
    }
  };
  
  // ✅ FIXED: Check if item exists before adding (prevents 409 conflict)
  PlaylistModal.prototype.addToPlaylist = async function(playlistId, playlistName) {
    if (!this.contentId) {
      showToast('No content selected', 'error');
      return;
    }
    
    try {
      // ✅ STEP 1: Check if content already exists in this playlist
      const { data: existing, error: checkError } = await this.supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('content_id', this.contentId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // ✅ STEP 2: If exists, show message instead of error
      if (existing) {
        showToast(`Already in ${playlistName}`, 'info');
        this.close();
        return;
      }
      
      // ✅ STEP 3: Add item if not exists
      const { data, error } = await this.supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          content_id: this.contentId,
          position: await this._getNextPosition(playlistId)
        })
        .select()
        .single();
      
      if (error) throw error;
      
      showToast(`✅ Added to ${playlistName}`, 'success');
      this.close();
      
    } catch (error) {
      console.error('Error adding to playlist:', error);
      // ✅ STEP 4: Handle duplicate key error gracefully
      if (error.code === '23505') {
        showToast(`Already in ${playlistName}`, 'info');
      } else {
        showToast('Failed to add to playlist', 'error');
      }
      this.close();
    }
  };
  
  // ✅ FIXED: Quick add to Watch Later with duplicate check
  PlaylistModal.prototype.quickAddToWatchLater = async function() {
    if (!this.contentId) {
      showToast('No content selected', 'error');
      return;
    }
    
    try {
      // Find or create Watch Later playlist
      let { data: watchLater } = await this.supabase
        .from('playlists')
        .select('id')
        .eq('user_id', this.userId)
        .eq('name', 'Watch Later')
        .maybeSingle();
      
      if (!watchLater) {
        const { data: newPlaylist, error: createError } = await this.supabase
          .from('playlists')
          .insert({
            user_id: this.userId,
            name: 'Watch Later',
            description: 'Videos to watch later',
            is_public: false
          })
          .select('id')
          .single();
        
        if (createError) throw createError;
        watchLater = newPlaylist;
      }
      
      // ✅ Check if already exists
      const { data: existing, error: checkError } = await this.supabase
        .from('playlist_items')
        .select('id')
        .eq('playlist_id', watchLater.id)
        .eq('content_id', this.contentId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existing) {
        showToast('Already in Watch Later', 'info');
        this.close();
        return;
      }
      
      // Add to Watch Later
      const { error } = await this.supabase
        .from('playlist_items')
        .insert({
          playlist_id: watchLater.id,
          content_id: this.contentId,
          position: await this._getNextPosition(watchLater.id)
        });
      
      if (error) throw error;
      
      showToast('✅ Added to Watch Later', 'success');
      this.close();
      
    } catch (error) {
      console.error('Error adding to Watch Later:', error);
      if (error.code === '23505') {
        showToast('Already in Watch Later', 'info');
      } else {
        showToast('Failed to add to Watch Later', 'error');
      }
    }
  };
  
  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistModal;
  } else {
    window.PlaylistModal = PlaylistModal;
  }
  
  console.log('✅ Playlist Modal module loaded successfully');
})();
