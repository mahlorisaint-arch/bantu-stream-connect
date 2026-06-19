(function() {
// SUPABASE CONFIGURATION
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL STATE =====
window.currentUser = null;
window.notifications = [];
window.creatorId = null;
window.creatorProfile = null;
window.isConnected = false;
window.connectorCount = 0;
window.creatorContent = [];
window.playlists = [];
window.loadingText = null;
window.currentPlaylist = null;
window.playlistItems = [];
window.creatorLibrary = [];

// ===== HELPER FUNCTIONS =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {error:'fa-exclamation-triangle', success:'fa-check-circle', warning:'fa-exclamation-circle', info:'fa-info-circle'};
  toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatNumber(num) {
  if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num/1000).toFixed(1) + 'K';
  return num.toString();
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays/7)} week${Math.floor(diffDays/7)>1?'s':''} ago`;
    return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  } catch { return ''; }
}

function getInitials(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  return names.length >= 2 ? (names[0][0] + names[names.length-1][0]).toUpperCase() : name[0].toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return url;
  return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function showConfetti() {
  const colors = ['#F59E0B', '#1D4ED8', '#10B981', '#EC4899', '#8B5CF6'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3000);
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== PHASE 5: LOAD CONTENT WITH ENGAGEMENT STATS =====
async function loadContentWithEngagementStats(creatorId, limit = 50) {
  const { data, error } = await supabase
    .from('Content')
    .select(`
      id,
      title,
      description,
      thumbnail_url,
      file_url,
      duration,
      media_type,
      content_format,
      created_at,
      user_id,
      is_pinned,
      is_channel_trailer,
      status,
      live_views,
      favorites_count,
      comments_count,
      shares_count,
      user_profiles!user_id (
        id,
        full_name,
        username,
        avatar_url
      ),
      content_engagement_stats (
        total_views,
        total_likes,
        total_comments,
        total_valid_views
      )
    `)
    .eq('user_id', creatorId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error loading content with engagement stats:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    ...item,
    views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
    likes_count: item.content_engagement_stats?.total_likes || 0,
    comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
    favorites_count: item.favorites_count || 0,
    valid_views_count: item.content_engagement_stats?.total_valid_views || 0
  }));
}

// ===== PHASE 5: LOAD PLAYLISTS WITH JUNCTION TABLE (ENTERPRISE-SAFE TWO-QUERY APPROACH) =====
async function loadPlaylistsWithItems(creatorId) {
  console.log('🔄 Loading playlists using TWO-QUERY approach for maximum reliability...');
  
  // STEP 1: Load playlist metadata only (no embedded joins)
  let playlistsQuery = supabase
    .from('creator_playlists')
    .select('*')
    .eq('creator_id', creatorId);
    
  if (!window.currentUser || window.currentUser.id !== creatorId) {
    playlistsQuery = playlistsQuery.eq('visibility', 'public');
  }
  
  const { data: playlistsData, error: playlistsError } = await playlistsQuery.order('created_at', { ascending: false });
  
  if (playlistsError) {
    console.error('Error loading playlists metadata:', playlistsError);
    return [];
  }
  
  if (!playlistsData || playlistsData.length === 0) {
    return [];
  }
  
  // STEP 2: Get all playlist IDs
  const playlistIds = playlistsData.map(p => p.id);
  
  // STEP 3: Load playlist_contents rows (NO embedded Content join)
  const { data: playlistContentsRows, error: contentsError } = await supabase
    .from('playlist_contents')
    .select(`
      id,
      playlist_id,
      content_id,
      sort_index,
      item_type,
      track_number,
      disc_number,
      season_number,
      display_title_override
    `)
    .in('playlist_id', playlistIds)
    .order('sort_index', { ascending: true });
    
  if (contentsError) {
    console.error('Error loading playlist contents:', contentsError);
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  if (!playlistContentsRows || playlistContentsRows.length === 0) {
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  // STEP 4: Extract unique content IDs
  const contentIds = [...new Set(playlistContentsRows.map(row => row.content_id).filter(Boolean))];
  
  if (contentIds.length === 0) {
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  // STEP 5: Fetch content data separately (NO embedded joins)
  const { data: contentRows, error: contentError } = await supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      content_format,
      status,
      live_views,
      favorites_count,
      comments_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .in('id', contentIds)
    .eq('status', 'published');
    
  if (contentError) {
    console.error('Error loading content data:', contentError);
    return playlistsData.map(playlist => ({
      ...playlist,
      playlist_contents: [],
      item_count: 0
    }));
  }
  
  // STEP 6: Create content map WITH STRING KEY NORMALIZATION (FIXES ID TYPE MISMATCH)
  const contentMap = new Map();
  (contentRows || []).forEach(content => {
    contentMap.set(String(content.id), {
      ...content,
      views_count: content.content_engagement_stats?.total_views || content.live_views || 0,
      likes_count: content.content_engagement_stats?.total_likes || 0,
      favorites_count: content.favorites_count || 0
    });
  });
  
  // STEP 7: Group items by playlist_id and merge WITH STRING KEY LOOKUP
  const itemsByPlaylist = {};
  playlistContentsRows.forEach(row => {
    // 🔧 CRITICAL FIX: Use String() for both key operations
    const content = contentMap.get(String(row.content_id));
    if (!content) return;
    if (!itemsByPlaylist[row.playlist_id]) {
      itemsByPlaylist[row.playlist_id] = [];
    }
    itemsByPlaylist[row.playlist_id].push({
      ...row,
      Content: content
    });
  });
  
  // STEP 8: Sort items within each playlist by sort_index
  Object.keys(itemsByPlaylist).forEach(playlistId => {
    itemsByPlaylist[playlistId].sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
  });
  
  // STEP 9: Build final playlists array with normalized structure
  return playlistsData.map(playlist => ({
    ...playlist,
    playlist_contents: itemsByPlaylist[playlist.id] || [],
    item_count: itemsByPlaylist[playlist.id]?.length || 0
  }));
}

// ===== LOAD PLAYLIST ITEMS FOR A SPECIFIC PLAYLIST (TWO-QUERY APPROACH) =====
async function loadPlaylistItemsForBuilder(playlistId) {
  console.log('🔄 Loading playlist items using TWO-QUERY approach...');
  
  // STEP 1: Get playlist_contents rows
  const { data: items, error: itemsError } = await supabase
    .from('playlist_contents')
    .select(`
      id,
      playlist_id,
      content_id,
      sort_index,
      item_type,
      track_number,
      disc_number,
      season_number,
      display_title_override
    `)
    .eq('playlist_id', playlistId)
    .order('sort_index', { ascending: true });
    
  if (itemsError) {
    console.error('Error loading playlist contents:', itemsError);
    return [];
  }
  
  if (!items || items.length === 0) {
    return [];
  }
  
  // STEP 2: Extract content IDs
  const contentIds = items.map(item => item.content_id).filter(Boolean);
  if (contentIds.length === 0) return [];
  
  // STEP 3: Fetch content data separately
  const { data: contentRows, error: contentError } = await supabase
    .from('Content')
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      content_format,
      status,
      live_views,
      favorites_count,
      content_engagement_stats (
        total_views,
        total_likes
      )
    `)
    .in('id', contentIds)
    .eq('status', 'published');
    
  if (contentError) {
    console.error('Error loading content data:', contentError);
    return [];
  }
  
  // STEP 4: Create content map WITH STRING KEY NORMALIZATION
  const contentMap = new Map();
  (contentRows || []).forEach(content => {
    contentMap.set(String(content.id), {
      ...content,
      views_count: content.content_engagement_stats?.total_views || content.live_views || 0,
      likes_count: content.content_engagement_stats?.total_likes || 0,
      favorites_count: content.favorites_count || 0
    });
  });
  
  // STEP 5: Merge and normalize WITH STRING KEY LOOKUP
  return items.map(item => {
    // 🔧 CRITICAL FIX: Use String() for lookup
    const content = contentMap.get(String(item.content_id));
    if (!content) return null;
    return {
      ...item,
      Content: content
    };
  }).filter(Boolean);
}

// ===== ADD ITEM TO PLAYLIST USING JUNCTION TABLE =====
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

// ===== REMOVE ITEM FROM PLAYLIST =====
async function removeItemFromPlaylist(playlistContentId) {
  const { error } = await supabase
    .from('playlist_contents')
    .delete()
    .eq('id', playlistContentId);
    
  if (error) throw error;
  return true;
}

// ===== UPDATE PLAYLIST ITEM ORDER =====
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

// ===== SAVE PLAYLIST (CREATE OR UPDATE) =====
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

// ===== DELETE PLAYLIST =====
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

// ===== PHASE 1D: COLLECTIONS GRID (ENTERPRISE-SAFE TWO-QUERY APPROACH) =====
async function loadCollections() {
  console.log('🔄 Loading collections using TWO-QUERY approach...');
  
  // STEP 1: Load playlist metadata
  const { data: playlists, error: playlistsError } = await supabase
    .from("creator_playlists")
    .select("*")
    .eq("creator_id", window.creatorId)
    .order("created_at", { ascending: false });
    
  if (playlistsError || !playlists || playlists.length === 0) {
    return [];
  }
  
  // STEP 2: Load all playlist contents
  const playlistIds = playlists.map(p => p.id);
  const { data: contents, error: contentsError } = await supabase
    .from("playlist_contents")
    .select("*")
    .in("playlist_id", playlistIds)
    .order("sort_index", { ascending: true });
    
  if (contentsError || !contents || contents.length === 0) {
    return playlists.map(p => ({ ...p, playlist_contents: [], item_count: 0 }));
  }
  
  // STEP 3: Extract content IDs and load content data
  const contentIds = [...new Set(contents.map(c => c.content_id))];
  const { data: contentData, error: contentError } = await supabase
    .from("Content")
    .select(`
      id,
      title,
      thumbnail_url,
      duration,
      media_type,
      content_format,
      status,
      live_views,
      favorites_count,
      content_engagement_stats(total_views)
    `)
    .in("id", contentIds)
    .eq("status", "published");
    
  if (contentError) {
    return playlists.map(p => ({ ...p, playlist_contents: [], item_count: 0 }));
  }
  
  // STEP 4: Create content map WITH STRING KEY NORMALIZATION
  const contentMap = new Map();
  contentData.forEach(c => {
    contentMap.set(String(c.id), {
      ...c,
      views_count: c.content_engagement_stats?.total_views || c.live_views || 0,
      favorites_count: c.favorites_count || 0
    });
  });
  
  // STEP 5: Group by playlist WITH STRING KEY LOOKUP
  const contentsByPlaylist = {};
  contents.forEach(item => {
    // 🔧 CRITICAL FIX: Use String() for lookup
    const content = contentMap.get(String(item.content_id));
    if (!content) return;
    if (!contentsByPlaylist[item.playlist_id]) {
      contentsByPlaylist[item.playlist_id] = [];
    }
    contentsByPlaylist[item.playlist_id].push({
      ...content,
      sort_index: item.sort_index,
      playlist_content_id: item.id
    });
  });
  
  // STEP 6: Sort each playlist's contents
  Object.keys(contentsByPlaylist).forEach(pid => {
    contentsByPlaylist[pid].sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
  });
  
  // STEP 7: Build final collections
  return playlists.map(playlist => ({
    ...playlist,
    playlist_contents: contentsByPlaylist[playlist.id] || [],
    item_count: contentsByPlaylist[playlist.id]?.length || 0
  }));
}

// 🚨 FIXED: Get collection item count using playlist_contents length
function getCollectionItemCount(collection) {
  return collection.playlist_contents?.length || 0;
}

// 🚨 FIXED: Get collection thumbnail with proper fallback chain
function getCollectionThumbnail(collection) {
  if (collection.custom_thumbnail_url) {
    return fixMediaUrl(collection.custom_thumbnail_url);
  }
  const firstItem = collection.playlist_contents?.[0];
  if (firstItem?.Content?.thumbnail_url) {
    return fixMediaUrl(firstItem.Content.thumbnail_url);
  }
  return "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=225&fit=crop";
}

async function renderCollectionsGrid() {
  const collections = await loadCollections();
  const grid = document.getElementById("collectionsGrid");
  if (!grid) return;
  
  if (!collections || collections.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
        <i class="fas fa-layer-group" style="font-size:48px;opacity:0.3;margin-bottom:20px;"></i>
        <h3>No Collections Yet</h3>
        <p style="color:var(--slate-grey);">Create your first playlist, album, or series</p>
        ${window.currentUser && window.currentUser.id === window.creatorId ?
          '<button id="createFirstCollectionBtn" class="primary-btn" style="margin-top:20px;"><i class="fas fa-plus"></i> Create Collection</button>' :
          ''}
      </div>
    `;
    const createBtn = document.getElementById('createFirstCollectionBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => openPlaylistBuilder());
    }
    return;
  }
  
  grid.innerHTML = collections.map(collection => {
    const thumbnail = getCollectionThumbnail(collection);
    const itemCount = getCollectionItemCount(collection);
    const typeLabel = collection.playlist_type || 'playlist';
    const typeIcon = getTypeIcon(typeLabel);
    
    return `
      <div class="collection-card" data-collection-id="${collection.id}" data-collection-type="${typeLabel}">
        <div class="collection-thumb-wrapper">
          <img class="collection-thumb" src="${thumbnail}" alt="${escapeHtml(collection.name)}" loading="lazy">
          <div class="collection-overlay">
            <i class="fas fa-play"></i>
          </div>
          <div class="collection-type-badge ${typeLabel}">
            <i class="fas ${typeIcon}"></i> ${typeLabel}
          </div>
          <div class="collection-count-badge">
            <i class="fas fa-list"></i> ${itemCount}
          </div>
        </div>
        <div class="collection-body">
          <div class="collection-title" title="${escapeHtml(collection.name)}">${truncateText(escapeHtml(collection.name), 40)}</div>
          <div class="collection-meta">
            <span><i class="fas ${typeIcon}"></i> ${typeLabel.toUpperCase()}</span>
            <span><i class="fas fa-video"></i> ${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
          </div>
          ${collection.description ? `<div class="collection-desc">${truncateText(escapeHtml(collection.description), 60)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  grid.querySelectorAll('.collection-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const collectionId = card.dataset.collectionId;
      const collectionType = card.dataset.collectionType;
      if (collectionId) {
        // 🚨 FIXED: Navigate with playlist_id parameter
        window.location.href = `content-detail.html?playlist_id=${collectionId}&type=${collectionType}`;
      }
    });
  });
}

function getTypeIcon(type) {
  switch(type) {
    case 'album': return 'fa-compact-disc';
    case 'podcast': return 'fa-podcast';
    case 'series': return 'fa-tv';
    default: return 'fa-list';
  }
}

// ===== FIX MOBILE HORIZONTAL SCROLL FUNCTION =====
function fixMobileHorizontalScroll() {
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  
  const checkOverflow = () => {
    const maxWidth = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > maxWidth) {
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > maxWidth + 5) {
          el.style.maxWidth = '100%';
          el.style.overflow = 'hidden';
        }
      });
    }
  };
  
  checkOverflow();
  window.addEventListener('resize', checkOverflow);
}

// ===== THEME SYSTEM FUNCTIONS =====
function initThemeSystem() {
  console.log('🎨 Initializing theme system...');
  const sidebarThemeToggle = document.getElementById('sidebar-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  
  if (!sidebarThemeToggle || !themeSelector) {
    console.warn('Theme elements not found');
    return;
  }
  
  const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
  applyTheme(savedTheme);
  
  const newToggle = sidebarThemeToggle.cloneNode(true);
  sidebarThemeToggle.parentNode.replaceChild(newToggle, sidebarThemeToggle);
  
  newToggle.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎨 Theme button clicked - toggling selector');
    themeSelector.classList.toggle('active');
  });
  
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    const newOption = option.cloneNode(true);
    option.parentNode.replaceChild(newOption, option);
    
    newOption.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const theme = this.dataset.theme;
      console.log('🎨 Theme selected:', theme);
      applyTheme(theme);
      themeSelector.classList.remove('active');
    });
  });
  
  document.addEventListener('click', function(e) {
    if (themeSelector.classList.contains('active') &&
        !themeSelector.contains(e.target) &&
        e.target !== newToggle &&
        !newToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
  
  console.log('✅ Theme system initialized');
}

function applyTheme(theme) {
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    theme = 'dark';
  }
  
  console.log('🎨 Applying theme:', theme);
  
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  document.body.classList.add(`theme-${theme}`);
  
  document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  document.documentElement.classList.add(`theme-${theme}`);
  
  const root = document.documentElement;
  
  if (theme === 'light') {
    root.style.setProperty('--deep-black', '#F8FAFC');
    root.style.setProperty('--deep-navy', '#E2E8F0');
    root.style.setProperty('--soft-white', '#0F172A');
    root.style.setProperty('--slate-grey', '#475569');
    root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.85)');
    root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--bantu-blue', '#1D4ED8');
    root.style.setProperty('--warm-gold', '#F59E0B');
  } else if (theme === 'high-contrast') {
    root.style.setProperty('--deep-black', '#000000');
    root.style.setProperty('--deep-navy', '#050505');
    root.style.setProperty('--soft-white', '#FFFFFF');
    root.style.setProperty('--slate-grey', '#CCCCCC');
    root.style.setProperty('--bantu-blue', '#FFD700');
    root.style.setProperty('--warm-gold', '#00FFFF');
    root.style.setProperty('--card-bg', '#0A0A0A');
    root.style.setProperty('--card-border', '#FFFFFF');
  } else {
    root.style.setProperty('--deep-black', '#0A0E12');
    root.style.setProperty('--deep-navy', '#0F172A');
    root.style.setProperty('--soft-white', '#F8FAFC');
    root.style.setProperty('--slate-grey', '#94A3B8');
    root.style.setProperty('--bantu-blue', '#1D4ED8');
    root.style.setProperty('--warm-gold', '#F59E0B');
    root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
    root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
  }
  
  localStorage.setItem('bantu_theme', theme);
  
  document.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === theme) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  
  if (typeof showToast === 'function') {
    showToast(`Theme changed to ${theme}`, 'success');
  }
  
  console.log(`✅ Theme applied: ${theme}`);
}

// ===== UI SCALE CONTROLS =====
class UIScaleController {
  constructor() {
    this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
    this.minScale = 0.8;
    this.maxScale = 1.4;
    this.step = 0.1;
  }
  
  init() {
    this.applyScale();
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('scaleChanged', (e) => {
      this.updateScaleDisplay(e.detail.scale);
    });
  }
  
  applyScale() {
    document.documentElement.style.setProperty('--ui-scale', this.scale);
    localStorage.setItem('bantu_ui_scale', this.scale.toString());
    document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: this.scale } }));
  }
  
  increase() {
    if (this.scale < this.maxScale) {
      this.scale = Math.min(this.maxScale, this.scale + this.step);
      this.applyScale();
    }
  }
  
  decrease() {
    if (this.scale > this.minScale) {
      this.scale = Math.max(this.minScale, this.scale - this.step);
      this.applyScale();
    }
  }
  
  reset() {
    this.scale = 1;
    this.applyScale();
  }
  
  getScale() { return this.scale; }
  
  updateScaleDisplay(scale) {
    const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
    displays.forEach(el => {
      if (el) el.textContent = Math.round(scale * 100) + '%';
    });
  }
}

function setupScaleControls() {
  const decreaseBtn = document.getElementById('sidebar-scale-decrease');
  const increaseBtn = document.getElementById('sidebar-scale-increase');
  const resetBtn = document.getElementById('sidebar-scale-reset');
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.decrease();
    });
  }
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.increase();
    });
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (window.uiScaleController) window.uiScaleController.reset();
    });
  }
}

// ===== ANALYTICS FUNCTIONS (UPDATED FOR PHASE 5) =====
function initAnalyticsModal() {
  const modal = document.getElementById('analytics-modal');
  if (!modal) return;
  
  const analyticsBtn = document.getElementById('analytics-btn');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => {
      modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const closeBtn = document.getElementById('close-analytics');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

async function loadChannelAnalytics() {
  if (!window.currentUser || !window.creatorContent) return;
  
  const totalViews = window.creatorContent.reduce((s,c) => s + (c.views_count || 0), 0);
  const totalLikes = window.creatorContent.reduce((s,c) => s + (c.likes_count || 0), 0);
  const engagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) + '%' : '0%';
  
  const viewsEl = document.getElementById('analytics-views');
  const connectorsEl = document.getElementById('analytics-connectors');
  const engagementEl = document.getElementById('analytics-engagement');
  const watchTimeEl = document.getElementById('analytics-watch-time');
  
  if (viewsEl) viewsEl.textContent = formatNumber(totalViews);
  if (connectorsEl) connectorsEl.textContent = formatNumber(window.connectorCount || 0);
  if (engagementEl) engagementEl.textContent = engagement;
  if (watchTimeEl) watchTimeEl.textContent = Math.floor(totalViews * 0.65 / 60) + 'm';
  
  const ctx = document.getElementById('channel-engagement-chart');
  if (!ctx) return;
  
  if (window._analyticsChart) window._analyticsChart.destroy();
  
  window._analyticsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Views',
          data: [65, 80, 50, 90, 110, 75, 120],
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Connects',
          data: [12, 19, 15, 25, 22, 30, 35],
          borderColor: '#1D4ED8',
          backgroundColor: 'rgba(29,78,216,0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'var(--soft-white)'
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        }
      }
    }
  });
}

// ===== PLAYLIST BUILDER FUNCTIONS (UPDATED FOR PHASE 5) =====
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

async function loadPLItemsV2(plId) {
  const items = await loadPlaylistItemsForBuilder(plId);
  window._plItems = items;
  renderPLItemsV2();
}

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

// ===== SIDEBAR SETUP =====
function setupSidebar() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;
  
  const openSidebar = () => {
    sidebarMenu.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  
  const closeSidebar = () => {
    sidebarMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  menuToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSidebar();
  });
  
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) closeSidebar();
  });
}

// ===== NAVIGATION BUTTONS =====
function setupNavigationButtons() {
  const navHome = document.getElementById('nav-home-btn');
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
  
  const navHistory = document.getElementById('nav-history-btn');
  if (navHistory) {
    navHistory.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const navCreate = document.getElementById('nav-create-btn');
  if (navCreate) {
    navCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to create content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  const navMenu = document.getElementById('nav-menu-btn');
  if (navMenu) {
    navMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sidebarMenu = document.getElementById('sidebar-menu');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebarMenu && sidebarOverlay) {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }
}

// ===== PROFILE UPDATE =====
async function updateProfileUI() {
  const placeholder = document.getElementById('userProfilePlaceholder');
  const nameEl = document.getElementById('current-profile-name');
  const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
  const sidebarName = document.getElementById('sidebar-profile-name');
  const sidebarEmail = document.getElementById('sidebar-profile-email');
  
  if (!placeholder || !nameEl) return;
  
  placeholder.innerHTML = '';
  
  if (window.currentUser) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, username, avatar_url')
        .eq('id', window.currentUser.id)
        .maybeSingle();
        
      const displayName = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
      
      nameEl.textContent = displayName;
      if (sidebarName) sidebarName.textContent = displayName;
      if (sidebarEmail) sidebarEmail.textContent = window.currentUser.email || 'user@example.com';
      
      if (profile?.avatar_url) {
        const avatarUrl = fixMediaUrl(profile.avatar_url);
        const img = document.createElement('img');
        img.className = 'profile-img';
        img.src = avatarUrl;
        img.alt = displayName;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
        
        img.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'profile-placeholder';
          fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
          fallback.textContent = getInitials(displayName);
          placeholder.innerHTML = '';
          placeholder.appendChild(fallback);
          if (sidebarAvatar) {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback.cloneNode(true));
          }
        };
        
        placeholder.appendChild(img);
        
        if (sidebarAvatar) {
          const sidebarImg = img.cloneNode(true);
          sidebarImg.onload = () => {
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(sidebarImg);
          };
          sidebarImg.onerror = () => {
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
            fallback.textContent = getInitials(displayName);
            sidebarAvatar.innerHTML = '';
            sidebarAvatar.appendChild(fallback);
          };
        }
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
        fallback.textContent = getInitials(displayName);
        placeholder.appendChild(fallback);
        if (sidebarAvatar) {
          const sidebarFallback = fallback.cloneNode(true);
          sidebarAvatar.innerHTML = '';
          sidebarAvatar.appendChild(sidebarFallback);
        }
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    }
  } else {
    nameEl.textContent = 'Guest';
    if (sidebarName) sidebarName.textContent = 'Guest';
    if (sidebarEmail) sidebarEmail.textContent = 'Sign in to continue';
    placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
    if (sidebarAvatar) sidebarAvatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
  }
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
  try {
    if (!window.currentUser) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    
    window.notifications = data || [];
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

function updateNotificationBadge(count) {
  const mainBadge = document.getElementById('notification-count');
  const sidebarBadge = document.getElementById('sidebar-notification-count');
  
  [mainBadge, sidebarBadge].forEach(badge => {
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

// ===== AUTH CHECK =====
async function checkAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    window.currentUser = data?.session?.user || null;
    
    if (window.currentUser) {
      console.log('✅ User authenticated:', window.currentUser.email);
      await loadUserProfile();
    }
    
    return window.currentUser;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

async function loadUserProfile() {
  try {
    if (!window.currentUser) return;
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle();
      
    if (error) throw error;
    
    updateProfileUI();
    await loadNotifications();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// ===== BANNER FUNCTIONS (UPDATED WITH EDGE FUNCTION + CLOUDFLARE R2) =====

/**
 * Handles banner upload using Supabase Edge Function → Cloudflare R2
 * Validates file type and size (max 20MB), shows progress, updates database
 */
async function handleBannerUpload(file) {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    showToast('Please upload a valid image (JPEG, PNG, or WEBP)', 'error');
    return false;
  }
  
  // Validate file size (20MB max)
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    showToast('Image must be less than 20MB', 'error');
    return false;
  }
  
  // Show progress indicator
  const progressContainer = document.getElementById('banner-upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');
  
  if (progressContainer) progressContainer.style.display = 'block';
  if (progressText) progressText.textContent = 'Requesting upload URL...';
  
  try {
    // Step 1: Get presigned upload URL from edge function
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('get-upload-url', {
      body: { 
        mediaType: 'banner', 
        fileName: file.name 
      }
    });
    
    if (uploadError) throw new Error(uploadError.message);
    if (!uploadData?.uploadUrl) throw new Error('No upload URL received');
    
    // Step 2: Upload to Cloudflare R2
    if (progressText) progressText.textContent = 'Uploading to CDN...';
    
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadData.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && progressFill) {
        const percent = (e.loaded / e.total) * 100;
        progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = `Uploading: ${Math.round(percent)}%`;
      }
    };
    
    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
    
    // Step 3: Save URL to database (channel_banner_url)
    if (progressText) progressText.textContent = 'Updating profile...';
    
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({ channel_banner_url: uploadData.fileUrl })
      .eq('id', window.creatorId);
      
    if (dbError) throw dbError;
    
    // Step 4: Update UI
    setBannerImage(uploadData.fileUrl);
    showToast('Banner updated successfully! 🎉', 'success');
    
    // Update local state
    if (window.creatorProfile) {
      window.creatorProfile.channel_banner_url = uploadData.fileUrl;
    }
    
    // Hide progress
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
      }, 1000);
    }
    
    return true;
    
  } catch (error) {
    console.error('Banner upload error:', error);
    showToast('Failed to upload banner: ' + error.message, 'error');
    if (progressContainer) progressContainer.style.display = 'none';
    return false;
  }
}

/**
 * Fallback upload method using Supabase Storage (if edge function fails)
 */
async function uploadBannerFallback(file) {
  try {
    const fileName = `banners/${window.creatorId}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('channel-banners').upload(fileName, file);
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('channel-banners').getPublicUrl(fileName);
    await supabase
      .from('user_profiles')
      .update({ channel_banner_url: publicUrl })
      .eq('id', window.creatorId);
      
    setBannerImage(publicUrl);
    showToast('Banner uploaded (using fallback storage)', 'success');
    return true;
  } catch (error) {
    console.error('Fallback upload error:', error);
    return false;
  }
}

async function loadBannerFromProfile() {
  if (!window.creatorProfile) return;
  const bannerUrl = window.creatorProfile.channel_banner_url || window.creatorProfile.banner_url;
  if (bannerUrl) setBannerImage(bannerUrl);
  else setBannerImage('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1500&h=400&fit=crop');
}

function setBannerImage(url) {
  if (!url) return;
  const banner = document.getElementById('channel-banner');
  window.bannerUrl = url;
  if (banner) {
    // Clean URL for background image
    const cleanUrl = url.replace(/^["']|["']$/g, '');
    banner.style.backgroundImage = `linear-gradient(rgba(10, 14, 18, 0.85), rgba(15, 23, 42, 0.95)), url('${cleanUrl}')`;
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = 'center';
  }
}

function showBannerUploadModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can change the banner', 'warning');
    return;
  }
  
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.add('active');
  
  const previewImg = document.getElementById('banner-preview-img');
  const placeholder = document.getElementById('banner-preview-placeholder');
  const urlInput = document.getElementById('banner-url-input');
  const progressContainer = document.getElementById('banner-upload-progress');
  
  if (previewImg) previewImg.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  if (urlInput) urlInput.value = '';
  if (progressContainer) progressContainer.style.display = 'none';
}

function hideBannerUploadModal() {
  const modal = document.getElementById('banner-upload-modal');
  if (modal) modal.classList.remove('active');
}

// ===== EDIT ABOUT MODAL =====
function showEditAboutModal() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  const quoteInput = document.getElementById('edit-quote');
  const missionInput = document.getElementById('edit-mission');
  const locationInput = document.getElementById('edit-location');
  const websiteInput = document.getElementById('edit-website');
  const scheduleInput = document.getElementById('edit-schedule');
  const tagsInput = document.getElementById('edit-tags');
  const socialInput = document.getElementById('edit-social');
  const modal = document.getElementById('edit-about-modal');
  
  if (quoteInput) quoteInput.value = window.creatorProfile.quote || '';
  if (missionInput) missionInput.value = window.creatorProfile.mission || '';
  if (locationInput) locationInput.value = window.creatorProfile.location || '';
  if (websiteInput) websiteInput.value = window.creatorProfile.website_url || '';
  if (scheduleInput) scheduleInput.value = window.creatorProfile.upload_schedule || '';
  if (tagsInput) tagsInput.value = window.creatorProfile.interests || '';
  if (socialInput) socialInput.value = window.creatorProfile.social_links ? JSON.stringify(window.creatorProfile.social_links, null, 2) : '';
  
  if (modal) modal.classList.add('active');
}

function hideEditAboutModal() {
  const modal = document.getElementById('edit-about-modal');
  if (modal) modal.classList.remove('active');
}

async function saveAboutSection() {
  if (!window.currentUser || window.currentUser.id !== window.creatorId) {
    showToast('Only the channel owner can edit this section', 'warning');
    return;
  }
  
  try {
    const updates = { updated_at: new Date().toISOString() };
    
    const fields = [
      { id: 'edit-quote', key: 'quote' },
      { id: 'edit-mission', key: 'mission' },
      { id: 'edit-location', key: 'location' },
      { id: 'edit-website', key: 'website_url' },
      { id: 'edit-schedule', key: 'upload_schedule' },
      { id: 'edit-tags', key: 'interests' }
    ];
    
    fields.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value.trim();
        if (val) updates[key] = val;
      }
    });
    
    const socialInput = document.getElementById('edit-social');
    if (socialInput) {
      const socialValue = socialInput.value.trim();
      if (socialValue) {
        try {
          updates.social_links = JSON.parse(socialValue);
        } catch (e) {
          showToast('Invalid JSON for social links', 'warning');
          return;
        }
      }
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', window.creatorId)
      .select()
      .single();
      
    if (error) throw error;
    
    if (data) window.creatorProfile = { ...window.creatorProfile, ...data };
    
    updateIdentityCard();
    hideEditAboutModal();
    showToast('About section updated successfully! ✨', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed: ' + (error.message || error.hint || 'Unknown'), 'error');
  }
}

// ===== DATA LOADING FUNCTIONS (UPDATED FOR PHASE 5) =====
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

async function loadCreatorData() {
  try {
    window.creatorId = getUrlParam('id');
    if (!window.creatorId) {
      showToast('Creator ID not found', 'error');
      window.location.href = 'content-library.html';
      return;
    }
    
    const viewAllLink = document.getElementById('view-all-playlists');
    if (viewAllLink) {
      viewAllLink.href = `playlists.html?creatorId=${window.creatorId}`;
    }
    
    window.loadingText = document.getElementById('loading-text');
    if (window.loadingText) window.loadingText.textContent = 'Loading creator profile...';
    
    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', window.creatorId)
      .maybeSingle();
      
    if (profileError || !profile) {
      showToast('Creator not found', 'error');
      window.location.href = 'content-library.html';
      return;
    }
    
    window.creatorProfile = profile;
    await loadBannerFromProfile();
    
    if (window.loadingText) window.loadingText.textContent = 'Loading creator content...';
    
    // Load content with engagement stats (PHASE 5)
    window.creatorContent = await loadContentWithEngagementStats(window.creatorId, 50);
    
    // Load connector count
    const { count: connectorCount, error: countError } = await supabase
      .from('connectors')
      .select('*', { count: 'exact', head: true })
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (countError) throw countError;
    window.connectorCount = connectorCount || 0;
    
    // Check if current user is connected
    if (window.currentUser) {
      const { data: connections } = await supabase
        .from('connectors')
        .select('*')
        .eq('connector_id', window.currentUser.id)
        .eq('connected_id', window.creatorId)
        .eq('connection_type', 'creator')
        .limit(1);
      window.isConnected = connections && connections.length > 0;
    } else {
      window.isConnected = false;
    }
    
    if (window.loadingText) window.loadingText.textContent = 'Loading playlists...';
    
    // Load playlists with items using PHASE 5 junction table (TWO-QUERY APPROACH)
    window.playlists = await loadPlaylistsWithItems(window.creatorId);
    
    // Load badges
    const { data: badges } = await supabase.from('user_badges').select('*').eq('user_id', window.creatorId);
    window.achievements = badges || [];
    
    console.log('✅ Creator data loaded (PHASE 5 with TWO-QUERY approach):', {
      profile: window.creatorProfile,
      contentCount: window.creatorContent.length,
      connectorCount: window.connectorCount,
      isConnected: window.isConnected,
      playlists: window.playlists.length
    });
    
    // Update all UI
    updateCreatorUI();
    updateIdentityCard();
    updateContentUI(window.creatorContent);
    updatePlaylistsUI();
    
    // Render collections grid with streaming architecture
    await renderCollectionsGrid();
    
    checkAndShowAllSections();
    
    // Hide loading screen
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loading) loading.style.display = 'none';
    if (app) app.style.display = 'block';
    
  } catch (error) {
    console.error('❌ Error loading creator channel:', error);
    showToast('Failed to load creator channel', 'error');
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 2000);
  }
}

function checkAndShowAllSections() {
  if (window.creatorContent && window.creatorContent.length > 0) {
    const mostPopular = [...window.creatorContent].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 4);
    if (mostPopular.length > 0) {
      const popularSection = document.getElementById('popular-section');
      if (popularSection) popularSection.style.display = 'block';
      updatePopularUI(mostPopular);
    }
  }
  
  const activitySection = document.getElementById('activity-section');
  if (activitySection) activitySection.style.display = 'block';
  updateActivityFeed();
  
  const fanSection = document.getElementById('fan-section');
  if (fanSection) fanSection.style.display = 'block';
  updateFanHighlights();
  
  const achievementsSection = document.getElementById('achievements-section');
  if (achievementsSection) achievementsSection.style.display = 'block';
  updateAchievementsUI();
  
  if (window.creatorProfile && window.creatorProfile.upload_schedule) {
    const scheduleSection = document.getElementById('schedule-section');
    const scheduleText = document.getElementById('schedule-text');
    if (scheduleSection) scheduleSection.style.display = 'block';
    if (scheduleText) scheduleText.textContent = window.creatorProfile.upload_schedule;
  }
  
  const recommendedSection = document.getElementById('recommended-section');
  if (recommendedSection) recommendedSection.style.display = 'block';
  loadRecommendedCreators();
  
  const supportSection = document.getElementById('support-section');
  if (supportSection) supportSection.style.display = 'block';
  
  const trailer = window.creatorContent.find(c => c.is_channel_trailer === true);
  if (trailer) {
    const trailerSection = document.getElementById('trailer-section');
    if (trailerSection) trailerSection.style.display = 'block';
    updateTrailerUI(trailer);
  }
  
  const pinned = window.creatorContent.find(c => c.is_pinned === true);
  if (pinned) {
    const pinnedSection = document.getElementById('pinned-section');
    if (pinnedSection) pinnedSection.style.display = 'block';
    updatePinnedUI(pinned);
  }
}

function updateTrailerUI(content) {
  const titleEl = document.getElementById('trailer-title');
  const descEl = document.getElementById('trailer-description');
  const viewsEl = document.getElementById('trailer-views');
  const videoEl = document.getElementById('trailer-video');
  
  if (titleEl) titleEl.textContent = content.title || 'Channel Trailer';
  if (descEl) descEl.textContent = truncateText(content.description || 'Welcome to my channel!', 150);
  if (viewsEl) viewsEl.textContent = formatNumber(content.views_count || 0);
  if (videoEl && content.thumbnail_url) {
    const img = videoEl.querySelector('img');
    if (img) img.src = fixMediaUrl(content.thumbnail_url);
    videoEl.onclick = () => {
      window.location.href = `content-detail.html?id=${content.id}`;
    };
  }
}

function updatePinnedUI(content) {
  const thumbnail = document.getElementById('pinned-thumbnail');
  const title = document.getElementById('pinned-title');
  const description = document.getElementById('pinned-description');
  const views = document.getElementById('pinned-views');
  const likes = document.getElementById('pinned-likes');
  const time = document.getElementById('pinned-time');
  const watchBtn = document.getElementById('pinned-watch-btn');
  
  if (thumbnail) {
    thumbnail.src = content.thumbnail_url ? fixMediaUrl(content.thumbnail_url) : 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&h=300&fit=crop';
  }
  if (title) title.textContent = content.title || 'Featured Content';
  if (description) description.textContent = truncateText(content.description || 'Check out this featured content', 120);
  if (views) views.textContent = formatNumber(content.views_count || 0);
  if (likes) likes.textContent = formatNumber(content.likes_count || 0);
  if (time) time.textContent = formatDate(content.created_at);
  if (watchBtn) {
    watchBtn.onclick = () => {
      window.location.href = `content-detail.html?id=${content.id}`;
    };
  }
}

function updatePopularUI(popularContent) {
  const grid = document.getElementById('popular-grid');
  if (!grid) return;
  
  grid.innerHTML = popularContent.map((item, index) => `
    <div class="popular-item" data-content-id="${item.id}">
      <div class="popular-rank">#${index + 1}</div>
      <div class="popular-info">
        <div class="popular-title">${truncateText(escapeHtml(item.title), 30)}</div>
        <div class="popular-stats"><span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span><span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span></div>
      </div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.popular-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

function updateActivityFeed() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  
  const activities = [];
  
  const recentUploads = [...window.creatorContent].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  recentUploads.forEach(u => {
    activities.push({ icon: 'fa-video', text: `Uploaded "${truncateText(u.title, 30)}"`, time: u.created_at });
  });
  
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  activities.push({ icon: 'fa-users', text: `Gained ${window.connectorCount} connectors`, time: weekAgo });
  
  feed.innerHTML = activities.slice(0, 5).map(activity => `
    <div class="activity-item">
      <div class="activity-icon"><i class="fas ${activity.icon}"></i></div>
      <div class="activity-content">
        <div class="activity-text"><strong>${activity.text}</strong></div>
        <div class="activity-time"><i class="fas fa-clock"></i> ${formatDate(activity.time)}</div>
      </div>
    </div>
  `).join('');
}

function updateFanHighlights() {
  const fanGrid = document.getElementById('fan-grid');
  if (!fanGrid) return;
  
  const contentIds = window.creatorContent.map(c => c.id);
  if (contentIds.length === 0) {
    fanGrid.innerHTML = '<p style="color:var(--slate-grey);">No fan comments yet</p>';
    return;
  }
  
  supabase.from('comments')
    .select('*, user_profiles!user_id(full_name, username, avatar_url)')
    .in('content_id', contentIds)
    .order('created_at', { ascending: false })
    .limit(4)
    .then(({ data }) => {
      if (data && data.length > 0) {
        fanGrid.innerHTML = data.map(comment => {
          const avatarUrl = comment.user_profiles?.avatar_url ? fixMediaUrl(comment.user_profiles.avatar_url) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop';
          const name = comment.user_profiles?.full_name || comment.user_profiles?.username || comment.author_name || 'Fan';
          
          return `
            <div class="fan-card">
              <div class="fan-header">
                <div class="fan-avatar"><img src="${avatarUrl}" alt="${name}"></div>
                <div class="fan-info"><h4>${escapeHtml(name)}</h4><div class="fan-badge"><i class="fas fa-crown"></i> Top Fan</div></div>
              </div>
              <div class="fan-comment">"${truncateText(escapeHtml(comment.comment_text), 100)}"</div>
              <div class="fan-stats"><span><i class="fas fa-heart"></i> ${comment.likes_count || 0}</span><span><i class="fas fa-clock"></i> ${formatDate(comment.created_at)}</span></div>
            </div>
          `;
        }).join('');
      } else {
        fanGrid.innerHTML = '<p style="color:var(--slate-grey);grid-column:1/-1;text-align:center;">Be the first to comment!</p>';
      }
    });
}

function updateAchievementsUI() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  
  const achievements = [
    { name: 'First Upload', icon: 'fa-check-circle', completed: window.creatorContent.length >= 1 },
    { name: '100 Connectors', icon: 'fa-users', completed: window.connectorCount >= 100 },
    { name: '10K Views', icon: 'fa-eye', completed: window.creatorContent.reduce((sum, c) => sum + (c.views_count || 0), 0) >= 10000 },
    { name: '50 Videos', icon: 'fa-video', completed: window.creatorContent.length >= 50 }
  ];
  
  if (window.achievements) {
    window.achievements.forEach(badge => {
      achievements.push({ name: badge.badge_name, icon: 'fa-trophy', completed: true, date: badge.awarded_at });
    });
  }
  
  grid.innerHTML = achievements.slice(0, 8).map(achievement => `
    <div class="achievement-card ${achievement.completed ? 'completed' : 'in-progress'}">
      <div class="achievement-icon"><i class="fas ${achievement.icon}"></i></div>
      <div class="achievement-name">${escapeHtml(achievement.name)}</div>
      ${achievement.date ? `<div class="achievement-date">${formatDate(achievement.date)}</div>` : ''}
    </div>
  `).join('');
}

async function loadRecommendedCreators() {
  const grid = document.getElementById('recommended-grid');
  if (!grid) return;
  
  try {
    const { data: connectors, error: connError } = await supabase
      .from('connectors')
      .select('connector_id')
      .eq('connected_id', window.creatorId)
      .limit(10);
      
    if (connError) throw connError;
    
    let recommended = [];
    
    if (connectors && connectors.length > 0) {
      const connectorIds = connectors.map(c => c.connector_id);
      const { data: profiles, error: profError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, bio')
        .in('id', connectorIds)
        .eq('role', 'creator')
        .neq('id', window.creatorId)
        .limit(4);
        
      if (profError) throw profError;
      recommended = profiles || [];
    }
    
    if (recommended.length === 0) {
      const { data: randomCreators, error: randError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, bio')
        .eq('role', 'creator')
        .neq('id', window.creatorId)
        .limit(4);
        
      if (randError) throw randError;
      recommended = randomCreators || [];
    }
    
    if (recommended.length > 0) {
      const connectionChecks = await Promise.all(recommended.map(async (creator) => {
        if (!window.currentUser) return { id: creator.id, isConnected: false };
        const { data: conn } = await supabase
          .from('connectors')
          .select('id')
          .eq('connector_id', window.currentUser.id)
          .eq('connected_id', creator.id)
          .eq('connection_type', 'creator')
          .maybeSingle();
        return { id: creator.id, isConnected: !!conn };
      }));
      
      const connectionMap = Object.fromEntries(connectionChecks.map(c => [c.id, c.isConnected]));
      
      grid.innerHTML = recommended.map(creator => {
        const avatarUrl = creator.avatar_url ? fixMediaUrl(creator.avatar_url) : null;
        const initials = getInitials(creator.full_name || creator.username);
        const isConnected = connectionMap[creator.id] || false;
        
        return `
          <div class="recommended-creator" data-creator-id="${creator.id}">
            <div class="recommended-avatar">
              ${avatarUrl ? 
                `<img src="${avatarUrl}" alt="${escapeHtml(creator.full_name || creator.username)}" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:24px;\\'>${initials}</div>'">` : 
                `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:24px;">${initials}</div>`
              }
            </div>
            <div class="recommended-name" title="${escapeHtml(creator.full_name || creator.username)}">${escapeHtml(creator.full_name || creator.username)}</div>
            <div class="recommended-username" title="@${escapeHtml(creator.username)}">@${escapeHtml(creator.username || 'creator')}</div>
            <button class="recommended-follow-btn ${isConnected ? 'connected' : ''}" data-target-id="${creator.id}">${isConnected ? 'Connected' : 'Connect'}</button>
          </div>
        `;
      }).join('');
      
      grid.querySelectorAll('.recommended-follow-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetId = btn.dataset.targetId;
          await handleRecommendedConnect(targetId, btn);
        });
      });
      
      grid.querySelectorAll('.recommended-creator').forEach(card => {
        card.addEventListener('click', (e) => {
          if (!e.target.classList.contains('recommended-follow-btn')) {
            const creatorId = card.dataset.creatorId;
            if (creatorId) window.location.href = `creator-channel.html?id=${creatorId}`;
          }
        });
      });
      
      const recommendedSection = document.getElementById('recommended-section');
      if (recommendedSection) recommendedSection.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading recommended creators:', error);
    grid.innerHTML = '<p style="color:var(--slate-grey);grid-column:1/-1;text-align:center;">More creators coming soon!</p>';
  }
}

async function handleRecommendedConnect(targetCreatorId, button) {
  if (!window.currentUser) {
    showToast('Please log in to connect', 'info');
    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    return;
  }
  
  if (window.currentUser.id === targetCreatorId) {
    showToast('You cannot connect to your own channel', 'info');
    return;
  }
  
  try {
    const { data: existing } = await supabase
      .from('connectors')
      .select('id')
      .eq('connector_id', window.currentUser.id)
      .eq('connected_id', targetCreatorId)
      .eq('connection_type', 'creator')
      .maybeSingle();
      
    if (existing) {
      const { error } = await supabase
        .from('connectors')
        .delete()
        .eq('connector_id', window.currentUser.id)
        .eq('connected_id', targetCreatorId)
        .eq('connection_type', 'creator');
        
      if (error) throw error;
      
      button.textContent = 'Connect';
      button.classList.remove('connected');
      showToast('Disconnected', 'info');
    } else {
      const { error } = await supabase
        .from('connectors')
        .insert({
          connector_id: window.currentUser.id,
          connected_id: targetCreatorId,
          connection_type: 'creator',
          created_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      button.textContent = 'Connected';
      button.classList.add('connected');
      showConfetti();
      showToast('Connected successfully! ✨', 'success');
    }
  } catch (error) {
    console.error('Error toggling connection:', error);
    showToast('Failed to update connection', 'error');
  }
}

// ===== UI UPDATE FUNCTIONS =====
function updateCreatorUI() {
  if (!window.creatorProfile) return;
  
  const nameEl = document.getElementById('creator-name');
  const usernameEl = document.getElementById('creator-username');
  const bioEl = document.getElementById('creator-bio');
  const bannerTitle = document.getElementById('banner-title');
  const editBtn = document.getElementById('edit-identity-btn');
  const bannerEditBtn = document.getElementById('banner-edit-btn');
  const avatarContainer = document.getElementById('creator-avatar-container');
  const founderBadge = document.getElementById('founder-badge');
  const videosCount = document.getElementById('videos-count');
  const connectorsCount = document.getElementById('connectors-count');
  const viewsCount = document.getElementById('views-count');
  const engagementCount = document.getElementById('engagement-count');
  
  if (nameEl) nameEl.textContent = window.creatorProfile.full_name || window.creatorProfile.username || 'Creator';
  if (usernameEl) usernameEl.textContent = `@${window.creatorProfile.username || 'creator'}`;
  if (bioEl) bioEl.textContent = window.creatorProfile.bio || 'Passionate content creator sharing authentic African stories.';
  if (bannerTitle) bannerTitle.textContent = `${window.creatorProfile.full_name || window.creatorProfile.username}'s Channel`;
  
  if (window.currentUser && window.currentUser.id === window.creatorId) {
    if (editBtn) editBtn.style.display = 'flex';
    if (bannerEditBtn) bannerEditBtn.style.display = 'flex';
  } else {
    if (editBtn) editBtn.style.display = 'none';
    if (bannerEditBtn) bannerEditBtn.style.display = 'none';
  }
  
  const avatarUrl = window.creatorProfile.avatar_url ? fixMediaUrl(window.creatorProfile.avatar_url) : null;
  const displayName = window.creatorProfile.full_name || window.creatorProfile.username || 'Creator';
  const initials = getInitials(displayName);
  
  if (avatarContainer) {
    avatarContainer.innerHTML = avatarUrl ?
      `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">` :
      `<div class="creator-initials">${initials}</div>`;
  }
  
  if (founderBadge) founderBadge.style.display = window.creatorProfile.is_founder ? 'block' : 'none';
  if (videosCount) videosCount.textContent = window.creatorContent.length;
  if (connectorsCount) connectorsCount.textContent = formatNumber(window.connectorCount);
  
  const totalViews = window.creatorContent.reduce((sum, item) => sum + (item.views_count || 0), 0);
  if (viewsCount) viewsCount.textContent = formatNumber(totalViews);
  
  const totalLikes = window.creatorContent.reduce((sum, item) => sum + (item.likes_count || 0), 0);
  const engagement = totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;
  if (engagementCount) engagementCount.textContent = engagement + '%';
  
  updateConnectButton();
}

function updateIdentityCard() {
  if (!window.creatorProfile) return;
  
  const quoteEl = document.getElementById('creator-quote');
  const missionEl = document.getElementById('creator-mission');
  const locationEl = document.getElementById('creator-location');
  const joinedEl = document.getElementById('creator-joined');
  const websiteLink = document.getElementById('creator-website');
  const scheduleEl = document.getElementById('creator-schedule');
  const tagsContainer = document.getElementById('creator-tags');
  
  if (quoteEl) quoteEl.textContent = window.creatorProfile.quote || '"Creating authentic African stories for the world"';
  if (missionEl) missionEl.textContent = window.creatorProfile.mission || 'Passionate about sharing African culture, technology, and innovation.';
  if (locationEl) locationEl.textContent = window.creatorProfile.location || 'Johannesburg, South Africa';
  
  if (window.creatorProfile.created_at && joinedEl) {
    const joinDate = new Date(window.creatorProfile.created_at);
    joinedEl.textContent = `Joined ${joinDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
  }
  
  if (websiteLink) {
    if (window.creatorProfile.website_url) {
      websiteLink.href = window.creatorProfile.website_url;
      let displayUrl = window.creatorProfile.website_url.replace(/^https?:\/\//, '');
      if (displayUrl.length > 40) {
        displayUrl = displayUrl.substring(0, 37) + '...';
      }
      websiteLink.textContent = displayUrl;
      websiteLink.style.display = 'inline-block';
      websiteLink.style.maxWidth = '100%';
      websiteLink.style.overflow = 'hidden';
      websiteLink.style.textOverflow = 'ellipsis';
      websiteLink.style.whiteSpace = 'nowrap';
    } else {
      websiteLink.style.display = 'none';
    }
  }
  
  if (scheduleEl && window.creatorProfile.upload_schedule) {
    scheduleEl.textContent = window.creatorProfile.upload_schedule;
  }
  
  if (tagsContainer && window.creatorProfile.interests) {
    const tags = window.creatorProfile.interests.split(',').map(t => t.trim()).filter(t => t);
    tagsContainer.innerHTML = tags.map(tag => `<span class="identity-tag">${escapeHtml(tag)}</span>`).join('');
  }
}

// 🚨 FIXED: Update playlists UI with proper item counts using playlist_contents.length
function updatePlaylistsUI() {
  const playlistSection = document.getElementById('playlists-section');
  const playlistGrid = document.getElementById('playlists-grid');
  const emptyState = document.getElementById('playlists-empty');
  
  if (!playlistSection || !playlistGrid || !emptyState) return;
  
  playlistSection.style.display = 'block';
  
  if (!window.playlists || window.playlists.length === 0) {
    playlistGrid.style.display = 'none';
    emptyState.style.display = 'block';
    
    if (window.currentUser && window.currentUser.id === window.creatorId) {
      emptyState.innerHTML = `<div class="empty-icon"><i class="fas fa-list"></i></div><h3>No playlists yet</h3><p>You haven't created any playlists. Click "New Playlist" to get started!</p>`;
    } else {
      emptyState.innerHTML = `<div class="empty-icon"><i class="fas fa-list"></i></div><h3>No playlists yet</h3><p>This creator hasn't created any playlists yet.</p>`;
    }
  } else {
    playlistGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    const sorted = [...window.playlists].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    playlistGrid.innerHTML = sorted.map(playlist => {
      // 🚨 FIXED: Use playlist_contents for thumbnail and item count
      const firstItem = playlist.playlist_contents?.[0];
      let thumb = playlist.custom_thumbnail_url ? fixMediaUrl(playlist.custom_thumbnail_url) : (firstItem?.Content?.thumbnail_url ? fixMediaUrl(firstItem.Content.thumbnail_url) : 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=200&fit=crop');
      
      // 🚨 FIXED: Use playlist_contents.length instead of Content.length
      const itemCount = playlist.playlist_contents?.length || 0;
      const typeBadge = playlist.playlist_type && playlist.playlist_type !== 'playlist' ? `<span class="playlist-type-badge ${playlist.playlist_type}">${playlist.playlist_type}</span>` : '';
      const isOwner = window.currentUser && window.currentUser.id === window.creatorId;
      
      return `
        <div class="playlist-card ${playlist.is_featured ? 'featured' : ''}" data-playlist-id="${playlist.id}" ${isOwner ? 'style="cursor:pointer;"' : ''}>
          <div class="playlist-thumbnail">
            <img src="${thumb}" alt="${escapeHtml(playlist.name)}" loading="lazy">
            <div class="playlist-overlay"><i class="fas fa-play" style="font-size:30px;color:white;"></i></div>
            <div class="playlist-count"><i class="fas fa-video"></i> ${itemCount}</div>
            ${typeBadge ? `<div style="position:absolute;top:10px;left:10px;">${typeBadge}</div>` : ''}
          </div>
          <div class="playlist-info">
            <div class="playlist-name" title="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</div>
            <div class="playlist-meta"><span>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>${playlist.total_duration ? `<span>• ${formatDuration(playlist.total_duration)}</span>` : ''}</div>
          </div>
        </div>
      `;
    }).join('');
    
    playlistGrid.querySelectorAll('.playlist-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const playlistId = card.dataset.playlistId;
        if (!playlistId) return;
        
        if (window.currentUser && window.currentUser.id === window.creatorId) {
          e.preventDefault();
          openPlaylistBuilder(playlistId);
        } else {
          // 🚨 FIXED: Navigate with playlist_id parameter
          window.location.href = `content-detail.html?playlist_id=${playlistId}&type=${playlist.playlist_type || 'playlist'}`;
        }
      });
    });
  }
  
  const header = playlistSection.querySelector('.section-header');
  const existingBtn = document.getElementById('new-playlist-btn');
  if (existingBtn) existingBtn.remove();
  
  if (window.currentUser && window.currentUser.id === window.creatorId) {
    const newBtn = document.createElement('button');
    newBtn.id = 'new-playlist-btn';
    newBtn.innerHTML = '<i class="fas fa-plus"></i> New Playlist';
    newBtn.style.cssText = 'background:var(--warm-gold);color:var(--deep-black);border:none;padding:8px 16px;border-radius:30px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap;';
    newBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPlaylistBuilder();
    };
    if (header) header.appendChild(newBtn);
  }
}

function createContentCard(item) {
  const thumbnailUrl = item.thumbnail_url ? fixMediaUrl(item.thumbnail_url) : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
  const displayName = item.user_profiles?.full_name || item.user_profiles?.username || 'User';
  const initials = getInitials(displayName);
  
  const avatarHtml = item.user_profiles?.avatar_url ?
    `<img src="${fixMediaUrl(item.user_profiles.avatar_url)}" alt="${escapeHtml(displayName)}" style="width:100%;height:100%;object-fit:cover;">` :
    `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${initials}</div>`;
    
  const isNew = (new Date() - new Date(item.created_at)) < 7*24*60*60*1000;
  
  return `
    <a href="content-detail.html?id=${item.id}" class="content-card">
      <div class="card-thumbnail">
        <img src="${thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy">
        <div class="thumbnail-overlay"></div>
        <div class="card-badges">${item.is_pinned ? '<div class="badge-pinned card-badge"><i class="fas fa-thumbtack"></i> PINNED</div>' : ''}${isNew ? '<div class="badge-new card-badge"><i class="fas fa-gem"></i> NEW</div>' : ''}</div>
        <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
        ${item.duration ? `<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.8);color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${formatDuration(item.duration)}</div>` : ''}
      </div>
      <div class="card-content">
        <h3 class="card-title" title="${escapeHtml(item.title)}">${truncateText(escapeHtml(item.title), 50)}</h3>
        <div class="creator-info-small"><div class="creator-avatar-small">${avatarHtml}</div><div class="creator-name-small">@${escapeHtml(item.user_profiles?.username || 'Creator')}</div></div>
        <div class="card-meta">
          <span><i class="fas fa-eye" style="color:var(--warm-gold);"></i>${formatNumber(item.views_count || 0)}</span>
          <span><i class="fas fa-heart" style="color:#ef4444;"></i>${formatNumber(item.likes_count || 0)}</span>
          <span><i class="fas fa-comment" style="color:var(--bantu-blue);"></i>${formatNumber(item.comments_count || 0)}</span>
          <span><i class="fas fa-share" style="color:var(--success-color);"></i>${formatNumber(item.shares_count || 0)}</span>
        </div>
      </div>
    </a>
  `;
}

function updateContentUI(content) {
  const grid = document.getElementById('content-grid');
  const noContent = document.getElementById('no-content');
  const countEl = document.getElementById('content-count');
  
  if (!grid || !noContent) return;
  
  if (countEl) countEl.textContent = `${content.length} item${content.length !== 1 ? 's' : ''}`;
  
  if (content.length === 0) {
    grid.style.display = 'none';
    noContent.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  noContent.style.display = 'none';
  
  const sorted = [...content].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  grid.innerHTML = sorted.map(item => createContentCard(item)).join('');
}

function updateConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (!btn) return;
  
  if (!window.currentUser) {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log in to Connect';
    btn.classList.remove('connected-btn');
    btn.classList.add('connect-btn');
    btn.onclick = handleLoginRequired;
    return;
  }
  
  if (window.currentUser.id === window.creatorId) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-user"></i> This is your channel';
    return;
  }
  
  if (window.isConnected) {
    btn.innerHTML = '<i class="fas fa-link"></i> Connected';
    btn.classList.remove('connect-btn');
    btn.classList.add('connected-btn');
    btn.onclick = handleDisconnect;
  } else {
    btn.innerHTML = '<i class="fas fa-link"></i> Connect';
    btn.classList.remove('connected-btn');
    btn.classList.add('connect-btn');
    btn.onclick = handleConnect;
  }
}

function handleLoginRequired() {
  showToast('Please log in to connect', 'info');
  window.location.href = `login.html?redirect=creator-channel.html?id=${window.creatorId}`;
}

async function handleConnect() {
  if (!window.currentUser) {
    handleLoginRequired();
    return;
  }
  
  if (window.currentUser.id === window.creatorId) {
    showToast('You cannot connect to your own channel', 'info');
    return;
  }
  
  try {
    const { error } = await supabase.from('connectors').insert({
      connector_id: window.currentUser.id,
      connected_id: window.creatorId,
      connection_type: 'creator',
      created_at: new Date().toISOString()
    });
    
    if (error) throw error;
    
    window.isConnected = true;
    window.connectorCount++;
    updateConnectButton();
    
    const connectorsCount = document.getElementById('connectors-count');
    if (connectorsCount) connectorsCount.textContent = formatNumber(window.connectorCount);
    
    showConfetti();
    showToast(`Connected with ${window.creatorProfile.full_name || window.creatorProfile.username}!`, 'success');
  } catch (error) {
    console.error('Error connecting:', error);
    showToast('Failed to connect', 'error');
  }
}

async function handleDisconnect() {
  try {
    const { error } = await supabase.from('connectors').delete()
      .eq('connector_id', window.currentUser.id)
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (error) throw error;
    
    window.isConnected = false;
    window.connectorCount = Math.max(0, window.connectorCount - 1);
    updateConnectButton();
    
    const connectorsCount = document.getElementById('connectors-count');
    if (connectorsCount) connectorsCount.textContent = formatNumber(window.connectorCount);
    
    showToast('Disconnected', 'info');
  } catch (error) {
    console.error('Error disconnecting:', error);
    showToast('Failed to disconnect', 'error');
  }
}

function handleShare() {
  if (!window.creatorProfile) return;
  const name = window.creatorProfile.full_name || window.creatorProfile.username || 'this creator';
  const text = `Check out ${name}'s channel on Bantu Stream Connect!`;
  const url = window.location.href;
  
  if (navigator.share) {
    navigator.share({ title: `${name}'s Channel`, text, url });
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => showToast('Link copied!', 'success'));
  }
}

async function showConnectorsModal() {
  try {
    const { data: connectors, error } = await supabase
      .from('connectors')
      .select(`connector_id, user_profiles!inner(id, full_name, username, avatar_url)`)
      .eq('connected_id', window.creatorId)
      .eq('connection_type', 'creator');
      
    if (error) throw error;
    
    const title = document.getElementById('modal-title');
    const list = document.getElementById('connectors-list');
    const profiles = connectors.map(c => c.user_profiles);
    
    if (title) title.textContent = `Connectors (${profiles.length})`;
    
    if (list) {
      if (profiles.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No connectors yet</div>';
      } else {
        list.innerHTML = profiles.map(p => {
          const avatarUrl = p.avatar_url ? fixMediaUrl(p.avatar_url) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop';
          return `
            <div style="display:flex;align-items:center;gap:15px;padding:15px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--warm-gold);"><img src="${avatarUrl}" alt="${p.full_name || p.username}" style="width:100%;height:100%;object-fit:cover;"></div>
              <div><div style="font-weight:600;color:var(--soft-white);">${escapeHtml(p.full_name || p.username)}</div><div style="font-size:14px;color:var(--slate-grey);">@${escapeHtml(p.username || 'user')}</div></div>
            </div>
          `;
        }).join('');
      }
    }
    
    const modal = document.getElementById('connectors-modal');
    if (modal) modal.classList.add('active');
  } catch (error) {
    console.error('Error loading connectors:', error);
    showToast('Failed to load connectors', 'error');
  }
}

// ===== SETUP ALL EVENT LISTENERS =====
function setupEventListeners() {
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
      const { data } = await supabase.auth.getSession();
      data?.session ? window.location.href = 'profile.html' : window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    });
  }
  
  const currentProfileBtn = document.getElementById('current-profile-btn');
  if (currentProfileBtn) {
    currentProfileBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown) dropdown.classList.toggle('active');
    });
  }
  
  const manageProfilesBtn = document.getElementById('manage-profiles-btn');
  if (manageProfilesBtn) {
    manageProfilesBtn.addEventListener('click', () => {
      window.location.href = 'manage-profiles.html';
    });
  }
  
  document.addEventListener('click', (e) => {
    const profileBtnEl = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const currentProfileBtnEl = document.getElementById('current-profile-btn');
    
    if (profileDropdown && profileBtnEl && currentProfileBtnEl) {
      if (!profileBtnEl.contains(e.target) && !profileDropdown.contains(e.target) && !currentProfileBtnEl.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    }
  });
  
  const bannerEditBtn = document.getElementById('banner-edit-btn');
  if (bannerEditBtn) bannerEditBtn.addEventListener('click', showBannerUploadModal);
  
  // ===== UPDATED BANNER FILE UPLOAD HANDLER (USES EDGE FUNCTION) =====
  const bannerFileUpload = document.getElementById('banner-file-upload');
  const bannerFileInput = document.getElementById('banner-file-input');
  if (bannerFileUpload && bannerFileInput) {
    bannerFileUpload.addEventListener('click', () => { 
      bannerFileInput.click(); 
    });
    
    bannerFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewImg = document.getElementById('banner-preview-img');
        const placeholder = document.getElementById('banner-preview-placeholder');
        if (previewImg && placeholder) {
          previewImg.src = event.target.result;
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
      
      // Upload via edge function
      await handleBannerUpload(file);
      
      // Reset input
      e.target.value = '';
    });
  }
  
  // ===== UPDATED BANNER URL APPLY HANDLER (WITH VALIDATION) =====
  const bannerUrlApply = document.getElementById('banner-url-apply');
  if (bannerUrlApply) {
    bannerUrlApply.addEventListener('click', async () => {
      const url = document.getElementById('banner-url-input')?.value.trim();
      if (!url) {
        showToast('Please enter a URL', 'warning');
        return;
      }
      
      // Validate URL is an image
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          showToast('URL must point to an image', 'error');
          return;
        }
        
        // Check file size from Content-Length header
        const contentLength = parseInt(response.headers.get('content-length'));
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (contentLength > maxSize) {
          showToast('Image must be less than 20MB', 'error');
          return;
        }
      } catch (error) {
        showToast('Could not validate image URL', 'error');
        return;
      }
      
      // Show preview
      const previewImg = document.getElementById('banner-preview-img');
      const placeholder = document.getElementById('banner-preview-placeholder');
      if (previewImg && placeholder) {
        previewImg.src = url;
        previewImg.onload = () => {
          previewImg.style.display = 'block';
          placeholder.style.display = 'none';
        };
        previewImg.onerror = () => {
          showToast('Failed to load image from URL', 'error');
        };
      }
    });
  }
  
  // ===== UPDATED BANNER SAVE HANDLER =====
  const bannerSave = document.getElementById('banner-save');
  if (bannerSave) {
    bannerSave.addEventListener('click', async () => {
      const previewImg = document.getElementById('banner-preview-img');
      if (previewImg && previewImg.style.display === 'block' && previewImg.src) {
        // If it's a data URL, need to upload via edge function
        if (previewImg.src.startsWith('data:image')) {
          const response = await fetch(previewImg.src);
          const blob = await response.blob();
          const file = new File([blob], 'banner.jpg', { type: blob.type });
          await handleBannerUpload(file);
        } else {
          // It's a URL, save directly to database
          try {
            const { error: dbError } = await supabase
              .from('user_profiles')
              .update({ channel_banner_url: previewImg.src })
              .eq('id', window.creatorId);
              
            if (dbError) throw dbError;
            
            setBannerImage(previewImg.src);
            showToast('Banner updated successfully! 🎉', 'success');
            hideBannerUploadModal();
          } catch (error) {
            console.error('Error saving banner:', error);
            showToast('Failed to save banner', 'error');
          }
        }
      } else {
        showToast('Please select or enter an image first', 'warning');
      }
    });
  }
  
  const bannerCancel = document.getElementById('banner-cancel');
  if (bannerCancel) bannerCancel.addEventListener('click', hideBannerUploadModal);
  
  const editIdentityBtn = document.getElementById('edit-identity-btn');
  if (editIdentityBtn) editIdentityBtn.addEventListener('click', showEditAboutModal);
  
  const cancelAboutBtn = document.getElementById('cancel-about-btn');
  if (cancelAboutBtn) cancelAboutBtn.addEventListener('click', hideEditAboutModal);
  
  const saveAboutBtn = document.getElementById('save-about-btn');
  if (saveAboutBtn) saveAboutBtn.addEventListener('click', saveAboutSection);
  
  const searchBtn = document.getElementById('search-btn');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchModal = document.getElementById('search-modal');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.add('active');
      setTimeout(() => document.getElementById('search-input')?.focus(), 300);
    });
  }
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      if (searchModal) searchModal.classList.remove('active');
      const searchInputEl = document.getElementById('search-input');
      const searchResultsGrid = document.getElementById('search-results-grid');
      if (searchInputEl) searchInputEl.value = '';
      if (searchResultsGrid) searchResultsGrid.innerHTML = '';
    });
  }
  
  if (searchModal) {
    searchModal.addEventListener('click', e => {
      if (e.target === searchModal) {
        searchModal.classList.remove('active');
        const searchInputEl = document.getElementById('search-input');
        const searchResultsGrid = document.getElementById('search-results-grid');
        if (searchInputEl) searchInputEl.value = '';
        if (searchResultsGrid) searchResultsGrid.innerHTML = '';
      }
    });
  }
  
  const searchInputElement = document.getElementById('search-input');
  if (searchInputElement) {
    let timeout;
    searchInputElement.addEventListener('input', e => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          const resultsGrid = document.getElementById('search-results-grid');
          if (resultsGrid) resultsGrid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">Start typing to search...</div>';
          return;
        }
        
        const resultsGrid = document.getElementById('search-results-grid');
        if (resultsGrid) {
          resultsGrid.innerHTML = `<div style="text-align:center;padding:40px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-radius:50%;border-top-color:var(--warm-gold);animation:spin 1s linear infinite;margin:0 auto 15px;"></div><div style="color:var(--slate-grey);">Searching...</div></div>`;
        }
        
        const categoryFilter = document.getElementById('category-filter')?.value;
        const sortFilter = document.getElementById('sort-filter')?.value;
        const results = await searchContent(query, categoryFilter, sortFilter);
        renderSearchResults(results);
      }, 300);
    });
  }
  
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      if (searchInputElement && searchInputElement.value.trim().length >= 2) {
        searchInputElement.dispatchEvent(new Event('input'));
      }
    });
  }
  
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) shareBtn.addEventListener('click', handleShare);
  
  const supportBtn = document.getElementById('support-btn');
  if (supportBtn) supportBtn.addEventListener('click', () => { showToast('Support feature coming soon!', 'info'); });
  
  const tipBtn = document.getElementById('tip-btn');
  if (tipBtn) tipBtn.addEventListener('click', () => { showToast('Tips feature coming soon!', 'info'); });
  
  const membershipBtn = document.getElementById('membership-btn');
  if (membershipBtn) membershipBtn.addEventListener('click', () => { showToast('Memberships feature coming soon!', 'info'); });
  
  const connectorsStatCard = document.getElementById('connectors-stat-card');
  if (connectorsStatCard) connectorsStatCard.addEventListener('click', showConnectorsModal);
  
  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('connectors-modal');
      if (modal) modal.classList.remove('active');
    });
  }
  
  const connectorsModal = document.getElementById('connectors-modal');
  if (connectorsModal) {
    connectorsModal.addEventListener('click', e => {
      if (e.target === connectorsModal) connectorsModal.classList.remove('active');
    });
  }
  
  const notificationsBtn = document.getElementById('notifications-btn');
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const closeNotifications = document.getElementById('close-notifications');
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.remove('active');
    });
  }
  
  const notificationsPanel = document.getElementById('notifications-panel');
  if (notificationsPanel) {
    notificationsPanel.addEventListener('click', e => {
      if (e.target === notificationsPanel) notificationsPanel.classList.remove('active');
    });
  }
  
  const markAllRead = document.getElementById('mark-all-read');
  if (markAllRead) {
    markAllRead.addEventListener('click', async () => {
      if (!window.currentUser) return;
      try {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', window.currentUser.id).eq('is_read', false);
        if (error) throw error;
        window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
        renderNotifications();
        updateNotificationBadge(0);
        showToast('All notifications marked as read', 'success');
      } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
      }
    });
  }
  
  // Theme & scale - already initialized
  initAnalyticsModal();
  initPlaylistBuilder();
  
  // Sidebar nav items
  const sidebarCreate = document.getElementById('sidebar-create');
  if (sidebarCreate) {
    sidebarCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      } else {
        window.location.href = 'creator-upload.html';
      }
    });
  }
  
  const sidebarDashboard = document.getElementById('sidebar-dashboard');
  if (sidebarDashboard) {
    sidebarDashboard.addEventListener('click', async (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = `login.html?redirect=creator-dashboard.html`;
      } else {
        window.location.href = 'creator-dashboard.html';
      }
    });
  }
  
  const sidebarWatchHistory = document.getElementById('sidebar-watch-history');
  if (sidebarWatchHistory) {
    sidebarWatchHistory.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const sidebarAnalytics = document.getElementById('sidebar-analytics');
  if (sidebarAnalytics) {
    sidebarAnalytics.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const modal = document.getElementById('analytics-modal');
      if (modal) modal.classList.add('active');
      loadChannelAnalytics();
    });
  }
  
  const sidebarNotifications = document.getElementById('sidebar-notifications');
  if (sidebarNotifications) {
    sidebarNotifications.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      const panel = document.getElementById('notifications-panel');
      if (panel) panel.classList.add('active');
      renderNotifications();
    });
  }
  
  const sidebarBadges = document.getElementById('sidebar-badges');
  if (sidebarBadges) {
    sidebarBadges.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Badges coming soon!', 'info');
    });
  }
  
  const sidebarWatchParty = document.getElementById('sidebar-watch-party');
  if (sidebarWatchParty) {
    sidebarWatchParty.addEventListener('click', (e) => {
      e.preventDefault();
      const closeBtn = document.getElementById('sidebar-close');
      if (closeBtn) closeBtn.click();
      showToast('Watch Party coming soon!', 'info');
    });
  }
  
  const voiceSearchBtn = document.getElementById('voice-search-btn');
  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', () => {
      showToast('Voice search coming soon!', 'info');
    });
  }
}

async function searchContent(query, category = '', sortBy = 'newest') {
  try {
    let qb = supabase.from('Content')
      .select(`
        *,
        user_profiles!user_id(*),
        live_views,
        favorites_count,
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments
        )
      `)
      .ilike('title', `%${query}%`)
      .eq('status', 'published');
      
    if (category) qb = qb.eq('genre', category);
    
    const { data, error } = await qb.limit(50);
    if (error) throw error;
    
    const enriched = (data || []).map(item => ({
      ...item,
      views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
      likes_count: item.content_engagement_stats?.total_likes || 0,
      comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
      favorites_count: item.favorites_count || 0
    }));
    
    if (sortBy === 'popular') enriched.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    else if (sortBy === 'trending') enriched.sort((a, b) => ((b.views_count || 0) + ((b.likes_count || 0) * 2)) - ((a.views_count || 0) + ((a.likes_count || 0) * 2)));
    else enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return enriched;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const thumbnailUrl = item.thumbnail_url ? fixMediaUrl(item.thumbnail_url) : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    return `<div class="content-card" data-content-id="${item.id}"><div class="card-thumbnail"><img src="${thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy"><div class="thumbnail-overlay"></div><div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div></div><div class="card-content"><h3 class="card-title">${truncateText(escapeHtml(item.title), 45)}</h3><div class="card-meta"><span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span><span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span></div></div></div>`;
  }).join('');
  
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  
  if (!window.currentUser) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i><p>Sign in to see notifications</p></div>`;
    return;
  }
  
  if (!window.notifications || window.notifications.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3;"></i><p>No notifications yet</p></div>`;
    return;
  }
  
  list.innerHTML = window.notifications.map(n => {
    const icon = getNotificationIcon(n.type);
    const readClass = n.is_read ? 'opacity:0.7;' : 'background:rgba(245,158,11,0.1);';
    const unreadDot = !n.is_read ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--warm-gold);margin-top:5px;"></div>' : '';
    
    return `<div style="padding:15px;border-bottom:1px solid var(--card-border);${readClass}"><div style="display:flex;gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="${icon}" style="font-size:18px;"></i></div><div style="flex:1;"><div style="font-weight:600;margin-bottom:5px;color:var(--soft-white);">${escapeHtml(n.title)}</div><div style="font-size:14px;color:var(--slate-grey);margin-bottom:8px;">${escapeHtml(n.message)}</div><div style="font-size:12px;color:var(--warm-gold);">${formatNotificationTime(n.created_at)}</div></div>${unreadDot}</div></div>`;
  }).join('');
}

function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    default: return 'fas fa-bell';
  }
}

function formatNotificationTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs/60000);
  const diffHours = Math.floor(diffMs/3600000);
  const diffDays = Math.floor(diffMs/86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ===== INITIALIZE CREATOR CHANNEL =====
async function initializeCreatorChannel() {
  try {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loading) loading.style.display = 'flex';
    if (app) app.style.display = 'none';
    
    window.loadingText = document.getElementById('loading-text');
    
    // Initialize theme system
    initThemeSystem();
    
    // Initialize UI Scale
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
    setupScaleControls();
    
    // Fix horizontal scroll on mobile
    fixMobileHorizontalScroll();
    
    setupSidebar();
    setupNavigationButtons();
    
    await checkAuth();
    await loadCreatorData();
    setupEventListeners();
    
    setTimeout(() => {
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 500);
    
    console.log('✅ Creator channel initialized with PHASE 5 database migration!');
    console.log('   🚀 Using content_engagement_stats for metrics');
    console.log('   🚀 Using playlist_contents junction table for playlists');
    console.log('   🚀 Using status = "published" for content filtering');
    console.log('   🚀 Using sort_index for ordering');
    console.log('   🚨 FIXED: Removed fragile Content:content_id!inner syntax');
    console.log('   🚨 FIXED: Enterprise-safe TWO-QUERY approach bypasses PostgREST embedding');
    console.log('   🚨 FIXED: Proper item count using playlist_contents.length');
    console.log('   🚨 FIXED: Proper thumbnail extraction with fallback chain');
    console.log('   🚨 FIXED: Playlist click navigation with playlist_id parameter');
    console.log('   🚨 FIXED: Album track extraction with proper sorting and mapping');
    console.log('   🚨 FIXED: Replaced views_count/likes_count with live_views/favorites_count');
    console.log('   🔧 CRITICAL: String() type normalization for ID lookups in all merge functions');
    console.log('   🎨 BANNER UPLOAD: Using Edge Function → Cloudflare R2 with 20MB limit');
    
  } catch (error) {
    console.error('❌ Error initializing:', error);
    showToast('Failed to initialize', 'error');
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 1000);
  }
}

// ===== AUTH STATE CHANGE =====
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    window.currentUser = session.user;
    loadUserProfile();
    showToast('Welcome back!', 'success');
  } else if (event === 'SIGNED_OUT') {
    window.currentUser = null;
    updateProfileUI();
    updateNotificationBadge(0);
    window.notifications = [];
    showToast('Signed out', 'info');
  }
});

// Start the application
initializeCreatorChannel();
})();
