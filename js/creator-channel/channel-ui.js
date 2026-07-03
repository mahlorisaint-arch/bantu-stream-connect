// ============================================
// CHANNEL-UI - UI RENDERING FUNCTIONS
// ============================================

// ===== USE EXISTING SUPABASE CLIENT =====
const supabase = window.supabaseClient || window.supabase;

// ===== UPDATE CREATOR UI =====
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

// ===== UPDATE IDENTITY CARD =====
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

// ===== UPDATE CONNECT BUTTON =====
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

// ===== UPDATE CONTENT UI =====
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

// ===== CREATE CONTENT CARD =====
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

// ===== UPDATE PLAYLISTS UI =====
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
      const firstItem = playlist.playlist_contents?.[0];
      let thumb = playlist.custom_thumbnail_url ? fixMediaUrl(playlist.custom_thumbnail_url) : (firstItem?.Content?.thumbnail_url ? fixMediaUrl(firstItem.Content.thumbnail_url) : 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=200&fit=crop');
      
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

// ===== UPDATE POPULAR UI =====
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

// ===== UPDATE ACTIVITY FEED =====
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

// ===== UPDATE FAN HIGHLIGHTS =====
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

// ===== UPDATE ACHIEVEMENTS UI =====
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

// ===== UPDATE TRAILER UI =====
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

// ===== UPDATE PINNED UI =====
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

// Make functions globally available
window.updateCreatorUI = updateCreatorUI;
window.updateIdentityCard = updateIdentityCard;
window.updateConnectButton = updateConnectButton;
window.updateContentUI = updateContentUI;
window.createContentCard = createContentCard;
window.updatePlaylistsUI = updatePlaylistsUI;
window.updatePopularUI = updatePopularUI;
window.updateActivityFeed = updateActivityFeed;
window.updateFanHighlights = updateFanHighlights;
window.updateAchievementsUI = updateAchievementsUI;
window.updateTrailerUI = updateTrailerUI;
window.updatePinnedUI = updatePinnedUI;
