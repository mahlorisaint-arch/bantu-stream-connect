// ============================================
// CHANNEL-DATA - DATA LOADING FUNCTIONS
// ============================================

// ===== GET URL PARAMETER =====
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// ===== LOAD CREATOR DATA =====
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

// ===== LOAD CONTENT WITH ENGAGEMENT STATS =====
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

// ===== LOAD PLAYLISTS WITH JUNCTION TABLE (TWO-QUERY APPROACH) =====
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
  
  // STEP 6: Create content map WITH STRING KEY NORMALIZATION
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
    const content = contentMap.get(String(item.content_id));
    if (!content) return null;
    return {
      ...item,
      Content: content
    };
  }).filter(Boolean);
}

// ===== LOAD COLLECTIONS (PHASE 1D) =====
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

// ===== LOAD BANNER FROM PROFILE =====
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
    const cleanUrl = url.replace(/^["']|["']$/g, '');
    banner.style.backgroundImage = `linear-gradient(rgba(10, 14, 18, 0.85), rgba(15, 23, 42, 0.95)), url('${cleanUrl}')`;
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = 'center';
  }
}

// ===== CHECK AND SHOW ALL SECTIONS =====
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

// Make functions globally available
window.getUrlParam = getUrlParam;
window.loadCreatorData = loadCreatorData;
window.loadContentWithEngagementStats = loadContentWithEngagementStats;
window.loadPlaylistsWithItems = loadPlaylistsWithItems;
window.loadPlaylistItemsForBuilder = loadPlaylistItemsForBuilder;
window.loadCollections = loadCollections;
window.loadBannerFromProfile = loadBannerFromProfile;
window.setBannerImage = setBannerImage;
window.checkAndShowAllSections = checkAndShowAllSections;
