// ============================================
// CONNECTION-SEARCH - CONNECT, SEARCH, SHARE
// ============================================

// ===== HANDLE LOGIN REQUIRED =====
function handleLoginRequired() {
  showToast('Please log in to connect', 'info');
  window.location.href = `login.html?redirect=creator-channel.html?id=${window.creatorId}`;
}

// ===== HANDLE CONNECT =====
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

// ===== HANDLE DISCONNECT =====
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

// ===== HANDLE RECOMMENDED CONNECT =====
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

// ===== HANDLE SHARE =====
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

// ===== SHOW CONNECTORS MODAL =====
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

// ===== SEARCH FUNCTIONALITY =====
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

// ===== RENDER SEARCH RESULTS =====
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

// Make functions globally available
window.handleLoginRequired = handleLoginRequired;
window.handleConnect = handleConnect;
window.handleDisconnect = handleDisconnect;
window.handleRecommendedConnect = handleRecommendedConnect;
window.handleShare = handleShare;
window.showConnectorsModal = showConnectorsModal;
window.searchContent = searchContent;
window.renderSearchResults = renderSearchResults;
