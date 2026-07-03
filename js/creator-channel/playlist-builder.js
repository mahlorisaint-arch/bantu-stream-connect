// ============================================
// PLAYLIST-BUILDER - PLAYLIST CREATION & MANAGEMENT
// ============================================

// ===== USE EXISTING SUPABASE CLIENT =====
const supabase = window.supabaseClient || window.supabase;

// ===== PLAYLIST DATABASE OPERATIONS =====
async function savePlaylistV2(playlistData, playlistId = null) {
  const now = new Date().toISOString();
  const data = {
    creator_id: window.creatorId,
    name: playlistData.name,
    description: playlistData.description || '',
    playlist_type: playlistData.playlist_type || 'playlist',
    visibility: playlistData.visibility || 'public',
    is_featured: playlistData.is_featured || false,
    updated_at: now
  };
  
  if (playlistData.custom_thumbnail_url) {
    data.custom_thumbnail_url = playlistData.custom_thumbnail_url;
  }
  
  let result;
  if (playlistId) {
    result = await supabase
      .from('creator_playlists')
      .update(data)
      .eq('id', playlistId)
      .eq('creator_id', window.creatorId)
      .select()
      .single();
  } else {
    data.created_at = now;
    result = await supabase
      .from('creator_playlists')
      .insert([data])
      .select()
      .single();
  }
  
  if (result.error) throw result.error;
  return result.data;
}

async function deletePlaylistV2(playlistId) {
  await supabase
    .from('playlist_contents')
    .delete()
    .eq('playlist_id', playlistId);
    
  const { error } = await supabase
    .from('creator_playlists')
    .delete()
    .eq('id', playlistId)
    .eq('creator_id', window.creatorId);
    
  if (error) throw error;
  return true;
}

async function addItemToPlaylist(playlistId, contentId, sortIndex = null) {
  let maxSortIndex = 0;
  if (sortIndex === null) {
    const { data: existing } = await supabase
      .from('playlist_contents')
      .select('sort_index')
      .eq('playlist_id', playlistId)
      .order('sort_index', { ascending: false })
      .limit(1);
    maxSortIndex = (existing && existing[0]?.sort_index) || 0;
    sortIndex = maxSortIndex + 1;
  }
  
  const { error } = await supabase
    .from('playlist_contents')
    .insert({
      playlist_id: playlistId,
      content_id: parseInt(contentId),
      sort_index: sortIndex,
      created_at: new Date().toISOString()
    });
    
  if (error) throw error;
  return true;
}

async function removeItemFromPlaylist(playlistContentId) {
  const { error } = await supabase
    .from('playlist_contents')
    .delete()
    .eq('id', playlistContentId);
    
  if (error) throw error;
  return true;
}

async function updatePlaylistItemOrder(playlistId, orderedItemIds) {
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from('playlist_contents')
      .update({ sort_index: i + 1 })
      .eq('id', orderedItemIds[i])
      .eq('playlist_id', playlistId);
      
    if (error) {
      console.error('Error updating item order:', error);
      return false;
    }
  }
  return true;
}

// ===== PLAYLIST BUILDER SETUP =====
function initPlaylistBuilder() {
  const modal = document.getElementById('playlist-builder-modal');
  if (!modal) return;
  
  const newBtn = document.getElementById('new-playlist-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => openPlaylistBuilder());
  }
  
  const closeBtn = document.getElementById('close-pl-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  const saveBtn = document.getElementById('pl-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', savePlaylistV2Wrapper);
  }
  
  const deleteBtn = document.getElementById('pl-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deletePlaylistV2Wrapper);
  }
  
  setupPlaylistTabs();
}

// ===== OPEN PLAYLIST BUILDER =====
async function openPlaylistBuilder(id = null) {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Creator only', 'warning');
    return;
  }
  
  const plIdInput = document.getElementById('pl-id');
  const plTitleInput = document.getElementById('pl-title');
  const plDescInput = document.getElementById('pl-desc');
  const plTypeSelect = document.getElementById('pl-type');
  const plVisSelect = document.getElementById('pl-vis');
  const plFeaturedCheck = document.getElementById('pl-featured');
  const plDeleteBtn = document.getElementById('pl-delete-btn');
  const plItemsPanel = document.getElementById('pl-items-panel');
  const plCountSpan = document.getElementById('pl-count');
  const plModalTitle = document.getElementById('pl-modal-title');
  
  if (plIdInput) plIdInput.value = '';
  if (plTitleInput) plTitleInput.value = '';
  if (plDescInput) plDescInput.value = '';
  if (plTypeSelect) plTypeSelect.value = 'playlist';
  if (plVisSelect) plVisSelect.value = 'public';
  if (plFeaturedCheck) plFeaturedCheck.checked = false;
  if (plDeleteBtn) plDeleteBtn.style.display = 'none';
  if (plItemsPanel) plItemsPanel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);">Loading...</div>`;
  if (plCountSpan) plCountSpan.textContent = '0';
  
  window._plItems = [];
  
  if (id) {
    if (plModalTitle) plModalTitle.textContent = 'Edit Playlist';
    if (plDeleteBtn) plDeleteBtn.style.display = 'block';
    
    const { data: pl, error } = await supabase
      .from('creator_playlists')
      .select('*')
      .eq('id', id)
      .eq('creator_id', window.creatorId)
      .maybeSingle();
      
    if (error || !pl) {
      showToast('Not found', 'error');
      return;
    }
    
    if (plIdInput) plIdInput.value = pl.id;
    if (plTitleInput) plTitleInput.value = pl.name || '';
    if (plDescInput) plDescInput.value = pl.description || '';
    if (plTypeSelect) plTypeSelect.value = pl.playlist_type || 'playlist';
    if (plVisSelect) plVisSelect.value = pl.visibility || 'public';
    if (plFeaturedCheck) plFeaturedCheck.checked = pl.is_featured || false;
    
    await loadPLItemsV2(pl.id);
  } else {
    if (plModalTitle) plModalTitle.textContent = 'Create Playlist';
    if (plItemsPanel) {
      plItemsPanel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-list" style="font-size:32px;margin-bottom:15px;opacity:0.5;"></i><p>Add videos from your library</p></div>`;
    }
  }
  
  await loadPLLibraryV2();
  
  const modal = document.getElementById('playlist-builder-modal');
  if (modal) modal.classList.add('active');
}

// ===== LOAD PLAYLIST ITEMS =====
async function loadPLItemsV2(plId) {
  const items = await loadPlaylistItemsForBuilder(plId);
  window._plItems = items;
  renderPLItemsV2();
}

// ===== RENDER PLAYLIST ITEMS =====
function renderPLItemsV2() {
  const panel = document.getElementById('pl-items-panel');
  const countSpan = document.getElementById('pl-count');
  
  if (!panel) return;
  if (countSpan) countSpan.textContent = window._plItems.length;
  
  if (!window._plItems.length) {
    panel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);">Add videos to your playlist</div>`;
    return;
  }
  
  panel.innerHTML = '';
  
  window._plItems.forEach((item, i) => {
    const c = item.Content;
    const tmplt = document.getElementById('pl-item-tmpl');
    if (!tmplt) return;
    
    const clone = tmplt.content.cloneNode(true);
    
    const thumb = clone.querySelector('.pl-thumb');
    if (thumb) {
      thumb.src = c?.thumbnail_url ? fixMediaUrl(c.thumbnail_url) : 'https://via.placeholder.com/80x45/111/444';
    }
    
    const title = clone.querySelector('.pl-title');
    if (title) title.textContent = c?.title || 'Untitled';
    
    const meta = clone.querySelector('.pl-meta');
    if (meta) {
      meta.innerHTML = `<span><i class="fas fa-eye"></i>${formatNumber(c?.views_count||0)}</span><span>${formatDuration(c?.duration)}</span>`;
    }
    
    const el = clone.querySelector('.pl-item');
    if (el) {
      el.dataset.id = item.id;
      el.dataset.pos = i + 1;
    }
    
    const removeBtn = clone.querySelector('.pl-remove');
    if (removeBtn) {
      removeBtn.onclick = () => removePLItemV2(item.id);
    }
    
    if (el && panel) {
      setupPLDragDropV2(el, panel);
      panel.appendChild(el);
    }
  });
}

// ===== DRAG AND DROP SETUP =====
function setupPLDragDropV2(el, container) {
  if (!el || !container) return;
  
  el.setAttribute('draggable', 'true');
  
  el.addEventListener('dragstart', e => {
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id || '');
  });
  
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    savePLOrderV2();
  });
  
  if (container && !container.hasDragOverListener) {
    container.hasDragOverListener = true;
    container.addEventListener('dragover', e => {
      e.preventDefault();
      const draggable = document.querySelector('.pl-item.dragging');
      if (!draggable) return;
      
      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggable);
      } else {
        container.insertBefore(draggable, afterElement);
      }
    });
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.pl-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function savePLOrderV2() {
  const plId = document.getElementById('pl-id')?.value;
  if (!plId) return;
  
  const items = document.querySelectorAll('.pl-item');
  const orderedItemIds = [];
  
  for (let i = 0; i < items.length; i++) {
    orderedItemIds.push(items[i].dataset.id);
  }
  
  await updatePlaylistItemOrder(plId, orderedItemIds);
}

// ===== LOAD LIBRARY =====
async function loadPLLibraryV2(filter = 'all', search = '') {
  let query = supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      genre,
      live_views,
      favorites_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .eq('user_id', window.creatorId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (filter !== 'all') {
    if (filter === 'short') {
      query = query.eq('media_type', 'short');
    } else {
      query = query.or('media_type.eq.video,media_type.is.null');
    }
  }
  
  if (search) query = query.ilike('title', `%${search}%`);
  
  const { data } = await query;
  
  window._plLib = (data || []).map(item => ({
    ...item,
    views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
    likes_count: item.content_engagement_stats?.total_likes || 0,
    favorites_count: item.favorites_count || 0
  }));
  
  renderPLLibV2(filter, search);
}

// ===== RENDER LIBRARY =====
function renderPLLibV2(filter, search) {
  const grid = document.getElementById('pl-lib-grid');
  if (!grid) return;
  
  const added = new Set(window._plItems.map(i => i.content_id));
  const lib = window._plLib.filter(c => !added.has(c.id));
  
  const searchInput = document.getElementById('pl-lib-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(window._libTimer);
      window._libTimer = setTimeout(() => loadPLLibraryV2(filter, e.target.value), 300);
    };
  }
  
  const filters = document.querySelectorAll('.pl-filter');
  filters.forEach(b => {
    b.onclick = () => {
      filters.forEach(x => {
        x.classList.remove('active');
        x.style.color = 'var(--slate-grey)';
        x.style.borderBottomColor = 'transparent';
      });
      b.classList.add('active');
      b.style.color = 'var(--soft-white)';
      b.style.borderBottomColor = 'var(--warm-gold)';
      
      const searchVal = document.getElementById('pl-lib-search')?.value || '';
      loadPLLibraryV2(b.dataset.f, searchVal);
    };
  });
  
  grid.innerHTML = lib.map(c => {
    const tmplt = document.getElementById('pl-lib-tmpl');
    if (!tmplt) return '';
    
    const clone = tmplt.content.cloneNode(true);
    
    const thumb = clone.querySelector('.lb-thumb');
    if (thumb) {
      thumb.src = c.thumbnail_url ? fixMediaUrl(c.thumbnail_url) : 'https://via.placeholder.com/160x90/111/444';
    }
    
    const title = clone.querySelector('.lb-title');
    if (title) title.textContent = c.title;
    
    const views = clone.querySelector('.lb-views');
    if (views) views.textContent = `${formatNumber(c.views_count||0)} views`;
    
    const addBtn = clone.querySelector('.lb-add');
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        addPLItemV2(c.id);
      };
    }
    
    const card = clone.querySelector('.pl-lib-card');
    return card ? card.outerHTML : '';
  }).join('');
}

// ===== ADD/REMOVE ITEMS =====
async function addPLItemV2(contentId) {
  const plId = document.getElementById('pl-id')?.value;
  if (!plId) {
    showToast('Save playlist first', 'warning');
    return;
  }
  
  try {
    await addItemToPlaylist(plId, contentId);
    await loadPLItemsV2(plId);
    loadPLLibraryV2();
    showToast('Added!', 'success');
  } catch (error) {
    console.error('Error adding item:', error);
    showToast('Failed to add item', 'error');
  }
}

async function removePLItemV2(playlistContentId) {
  await removeItemFromPlaylist(playlistContentId);
  const plId = document.getElementById('pl-id')?.value;
  if (plId) {
    await loadPLItemsV2(plId);
    loadPLLibraryV2();
  }
}

// ===== PLAYLIST TABS =====
function setupPlaylistTabs() {
  const tabs = document.querySelectorAll('.pl-tab');
  tabs.forEach(t => {
    t.onclick = () => {
      tabs.forEach(x => {
        x.classList.remove('active');
        x.style.color = 'var(--slate-grey)';
        x.style.borderBottomColor = 'transparent';
      });
      t.classList.add('active');
      t.style.color = 'var(--soft-white)';
      t.style.borderBottomColor = 'var(--warm-gold)';
      
      const itemsPanel = document.getElementById('pl-items-panel');
      const libraryPanel = document.getElementById('pl-library-panel');
      
      if (itemsPanel) itemsPanel.style.display = t.dataset.tab === 'items' ? 'block' : 'none';
      if (libraryPanel) libraryPanel.style.display = t.dataset.tab === 'library' ? 'block' : 'none';
    };
  });
}

// ===== SAVE PLAYLIST WRAPPER =====
async function savePlaylistV2Wrapper() {
  const title = document.getElementById('pl-title')?.value.trim();
  if (!title) {
    showToast('Title required', 'warning');
    return;
  }
  
  const id = document.getElementById('pl-id')?.value;
  
  const playlistData = {
    name: title,
    description: document.getElementById('pl-desc')?.value || '',
    playlist_type: document.getElementById('pl-type')?.value || 'playlist',
    visibility: document.getElementById('pl-vis')?.value || 'public',
    is_featured: document.getElementById('pl-featured')?.checked || false
  };
  
  try {
    await savePlaylistV2(playlistData, id);
    await loadCreatorData();
    await renderCollectionsGrid();
    
    const modal = document.getElementById('playlist-builder-modal');
    if (modal) modal.classList.remove('active');
    
    showToast(id ? 'Updated!' : 'Created!', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save playlist', 'error');
  }
}

// ===== DELETE PLAYLIST WRAPPER =====
async function deletePlaylistV2Wrapper() {
  const id = document.getElementById('pl-id')?.value;
  if (!id || !confirm('Delete playlist?')) return;
  
  try {
    await deletePlaylistV2(id);
    await loadCreatorData();
    await renderCollectionsGrid();
    
    const modal = document.getElementById('playlist-builder-modal');
    if (modal) modal.classList.remove('active');
    
    showToast('Deleted', 'info');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete playlist', 'error');
  }
}

// Make functions globally available
window.initPlaylistBuilder = initPlaylistBuilder;
window.openPlaylistBuilder = openPlaylistBuilder;
window.loadPLItemsV2 = loadPLItemsV2;
window.renderPLItemsV2 = renderPLItemsV2;
window.setupPLDragDropV2 = setupPLDragDropV2;
window.savePLOrderV2 = savePLOrderV2;
window.loadPLLibraryV2 = loadPLLibraryV2;
window.renderPLLibV2 = renderPLLibV2;
window.addPLItemV2 = addPLItemV2;
window.removePLItemV2 = removePLItemV2;
window.savePlaylistV2Wrapper = savePlaylistV2Wrapper;
window.deletePlaylistV2Wrapper = deletePlaylistV2Wrapper;
window.setupPlaylistTabs = setupPlaylistTabs;
window.savePlaylistV2 = savePlaylistV2;
window.deletePlaylistV2 = deletePlaylistV2;
window.addItemToPlaylist = addItemToPlaylist;
window.removeItemFromPlaylist = removeItemFromPlaylist;
window.updatePlaylistItemOrder = updatePlaylistItemOrder;
