/**
 * Bantu Stream Connect - Trending Screen Logic
 * ✅ FIXED: Uses window.supabaseClient (no duplicate declaration)
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔥 Trending Screen Initializing...');

  // ✅ USE GLOBAL CLIENT (don't redeclare supabase)
  const supabaseClient = window.supabaseClient;
  
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized!');
    return;
  }

  // DOM Elements
  const loadingScreen = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');
  const app = document.getElementById('app');
  const authModal = document.getElementById('auth-modal');
  const filterContainer = document.getElementById('filter-container');
  const trendingSections = document.getElementById('trending-sections');
  const searchBtn = document.getElementById('search-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const notificationsBtn = document.getElementById('notifications-btn');
  const profileBtn = document.getElementById('profile-btn');
  const exploreAllBtn = document.getElementById('explore-all-btn');
  const authLoginBtn = document.getElementById('auth-login-btn');
  const authCancelBtn = document.getElementById('auth-cancel-btn');

  // State variables
  let currentUser = null;
  let allContentData = [];
  let featuredTrend = [];
  let liveStreams = [];
  let communityGems = [];
  let trendingHashtags = [];
  let selectedFilter = 'All';
  let notifications = [];

  const filters = [
    'All', 'Music', 'Film & Series', 'Podcasts',
    'Gaming', 'Comedy', 'Live', 'Top 24 Hrs', 'Rising Creators'
  ];

  // SHOW/HIDE LOADING
  function setLoading(loading, text = '') {
    if (text && loadingText) loadingText.textContent = text;
    if (loading) {
      if (loadingScreen) loadingScreen.style.display = 'flex';
      if (app) app.style.display = 'none';
    } else {
      setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
      }, 500);
    }
  }

  // SHOW TOAST MESSAGE
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    const container = document.getElementById('toast-container');
    if (container) {
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  // FORMAT NUMBERS
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // GET INITIALS FROM EMAIL
  function getInitials(email) {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
  }

  // GET INITIALS FROM FULL NAME
  function getInitialsFromName(fullName) {
    if (!fullName) return 'U';
    const names = fullName.split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return fullName.charAt(0).toUpperCase();
  }

  // LOAD PROFILE PICTURE
  async function loadUserProfilePicture(user) {
    try {
      if (!user || !profileBtn) return;
      const placeholder = document.getElementById('userProfilePlaceholder');
      if (!placeholder) return;

      while (placeholder.firstChild) {
        placeholder.removeChild(placeholder.firstChild);
      }

      const userInitials = getInitials(user.email);

      const profileResponse = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const profile = profileResponse.data;
      const profileError = profileResponse.error;

      if (profileError || !profile) {
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px';
        fallback.textContent = userInitials;
        placeholder.appendChild(fallback);
        return;
      }

      const displayName = profile.full_name || profile.username || user.email || 'User';
      const initial = getInitials(displayName);

      if (profile.avatar_url) {
        let avatarUrl = profile.avatar_url;
        try {
          if (!avatarUrl.startsWith('http')) {
            if (avatarUrl.startsWith('avatars/')) {
              avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${avatarUrl}`;
            } else {
              avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
            }
          }

          const img = document.createElement('img');
          img.className = 'profile-img';
          img.alt = displayName;
          img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
          img.src = avatarUrl;

          img.onerror = () => {
            const fallbackInitials = profile.full_name ? getInitialsFromName(profile.full_name) : userInitials;
            const fallback = document.createElement('div');
            fallback.className = 'profile-placeholder';
            fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px';
            fallback.textContent = fallbackInitials;
            placeholder.innerHTML = '';
            placeholder.appendChild(fallback);
          };

          placeholder.appendChild(img);
        } catch (e) {
          const fallback = document.createElement('div');
          fallback.className = 'profile-placeholder';
          fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px';
          fallback.textContent = initial;
          placeholder.appendChild(fallback);
        }
      } else {
        const nameInitials = profile.full_name ? getInitialsFromName(profile.full_name) : userInitials;
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px';
        fallback.textContent = nameInitials;
        placeholder.appendChild(fallback);
      }
    } catch (error) {
      console.error('Error loading user profile picture:', error);
      const placeholder = document.getElementById('userProfilePlaceholder');
      if (placeholder) {
        const userInitials = getInitials(user.email);
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:20px';
        fallback.textContent = userInitials;
        placeholder.innerHTML = '';
        placeholder.appendChild(fallback);
      }
    }
  }

  // CHECK AUTHENTICATION
  async function checkAuthentication() {
    try {
      setLoading(true, 'Checking authentication...');
      const sessionResponse = await supabaseClient.auth.getSession();
      const session = sessionResponse.data?.session;
      const error = sessionResponse.error;

      if (error || !session?.user) {
        console.log('⚠️ User not authenticated');
        showToast('Please sign in to access trending content', 'error');
        if (authModal) authModal.classList.add('active');
        setLoading(false);
        return false;
      }

      currentUser = session.user;
      console.log('✅ User authenticated:', currentUser.email);

      await loadUserProfilePicture(currentUser);
      await loadNotifications();
      return true;
    } catch (error) {
      console.error('❌ Authentication error:', error);
      setLoading(false);
      return false;
    }
  }

  // LOAD NOTIFICATIONS
  async function loadNotifications() {
    try {
      if (!currentUser) {
        updateNotificationBadge(0);
        return;
      }

      const notificationsResponse = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const data = notificationsResponse.data;
      const error = notificationsResponse.error;

      if (error) throw error;

      notifications = data || [];
      const unreadCount = notifications.filter(n => !n.is_read).length;
      updateNotificationBadge(unreadCount);
      renderNotifications();
    } catch (error) {
      console.error('Error loading notifications:', error);
      updateNotificationBadge(0);
    }
  }

  // UPDATE NOTIFICATION BADGE
  function updateNotificationBadge(count = null) {
    if (count === null) {
      count = notifications.filter(n => !n.is_read).length;
    }
    const badge = document.getElementById('notification-count');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  // RENDER NOTIFICATIONS
  function renderNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    if (!currentUser) {
      notificationsList.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--slate-grey)"><i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5"></i><p>Sign in to see notifications</p></div>`;
      return;
    }

    if (!notifications || notifications.length === 0) {
      notificationsList.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--slate-grey)"><i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3"></i><p>No notifications yet</p></div>`;
      return;
    }

    notificationsList.innerHTML = notifications.map(notification => `
      <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
        <div class="notification-icon"><i class="${getNotificationIcon(notification.type)}" style="color:white"></i></div>
        <div class="notification-content">
          <h4>${escapeHtml(notification.title)}</h4>
          <p>${escapeHtml(notification.message)}</p>
          <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
        </div>
        ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
      </div>
    `).join('');

    notificationsList.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await markNotificationAsRead(id);
        if (item.dataset.contentId) {
          window.location.href = `content-detail.html?id=${item.dataset.contentId}`;
        }
        document.getElementById('notifications-panel').classList.remove('active');
      });
    });
  }

  // GET NOTIFICATION ICON
  function getNotificationIcon(type) {
    switch(type) {
      case 'like': return 'fas fa-heart';
      case 'comment': return 'fas fa-comment';
      case 'follow': return 'fas fa-user-plus';
      case 'view_milestone': return 'fas fa-trophy';
      case 'system': return 'fas fa-bell';
      default: return 'fas fa-bell';
    }
  }

  // FORMAT NOTIFICATION TIME
  function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // ESCAPE HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // MARK NOTIFICATION AS READ
  async function markNotificationAsRead(notificationId) {
    try {
      const { error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;

      const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
      if (item) {
        item.classList.remove('unread');
        item.classList.add('read');
        const dot = item.querySelector('.notification-dot');
        if (dot) dot.remove();
      }
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // MARK ALL NOTIFICATIONS AS READ
  async function markAllNotificationsAsRead() {
    try {
      if (!currentUser) return;
      const { error } = await supabaseClient
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
      if (error) throw error;

      document.querySelectorAll('.notification-item.unread').forEach(item => {
        item.classList.remove('unread');
        item.classList.add('read');
        const dot = item.querySelector('.notification-dot');
        if (dot) dot.remove();
      });
      updateNotificationBadge(0);
      showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      showToast('Failed to mark notifications as read', 'error');
    }
  }

  // FETCH CONTENT
  async function fetchContent() {
    try {
      console.log('🔄 Fetching trending content from Supabase...');
      setLoading(true, 'Loading trending content...');

      let contentData = [];
      try {
        const contentResponse = await supabaseClient
          .from('Content')
          .select('*, user_profiles!user_id(*)')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(100);
        if (contentResponse.error) throw contentResponse.error;
        contentData = contentResponse.data;
        console.log('✅ Fetched from Content table:', contentData.length, 'items');
      } catch (error) {
        console.log('⚠️ Content table failed, trying content table (lowercase)...');
        try {
          const contentResponse = await supabaseClient
            .from('content')
            .select('*, user_profiles!user_id(*)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(100);
          if (contentResponse.error) throw contentResponse.error;
          contentData = contentResponse.data;
          console.log('✅ Fetched from content table:', contentData.length, 'items');
        } catch (error2) {
          console.error('❌ Both table names failed:', error2);
          showToast('Failed to load content. Please refresh.', 'error');
          return [];
        }
      }

      const enrichedContent = await Promise.all(
        (contentData || []).map(async (item) => {
          const viewsResponse = await supabaseClient
            .from('content_views')
            .select('*', { count: 'exact', head: true })
            .eq('content_id', item.id);
          const viewsCount = viewsResponse.count || 0;
          return {
            ...item,
            real_views: viewsCount,
            is_live: item.is_live || false,
            viewer_count: item.viewer_count || viewsCount,
            is_new: isContentNew(item.created_at)
          };
        })
      );

      console.log('✅ Processed content:', enrichedContent.length, 'items');
      return enrichedContent;
    } catch (error) {
      console.error('❌ Error fetching content:', error);
      showToast('Failed to load trending content. Please refresh.', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }

  // CHECK IF CONTENT IS NEW
  function isContentNew(createdAt) {
    if (!createdAt) return false;
    try {
      const createdDate = new Date(createdAt);
      const daysAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo < 7;
    } catch {
      return false;
    }
  }

  // PROCESS TRENDING SECTIONS
  function processTrendingSections(contentData) {
    allContentData = contentData;
    featuredTrend = [...contentData].sort((a, b) => (b.real_views || b.views_count || 0) - (a.real_views || a.views_count || 0)).slice(0, 1);
    liveStreams = contentData.filter(item => item.is_live).slice(0, 10);
    communityGems = [...contentData].sort((a, b) => {
      const aScore = (a.real_views || a.views_count || 0) + ((a.likes_count || a.likes || 0) * 2) + ((a.comments_count || 0) * 3);
      const bScore = (b.real_views || b.views_count || 0) + ((b.likes_count || b.likes || 0) * 2) + ((b.comments_count || 0) * 3);
      return bScore - aScore;
    }).slice(0, 20);
    trendingHashtags = ['#OwnYourStage', '#BantuFuture', '#1MinComedy', '#SofaTalks', '#JoburgVibes', '#AfricanTalent', '#StreamConnect', '#RisingStars'];
    console.log('✅ Processed sections:', { featured: featuredTrend.length, live: liveStreams.length, gems: communityGems.length, hashtags: trendingHashtags.length });
  }

  // RENDER FILTER CHIPS
  function renderFilterChips() {
    if (!filterContainer) return;
    filterContainer.innerHTML = filters.map(filter => `
      <button class="filter-chip ${filter === selectedFilter ? 'active' : ''}" data-filter="${filter}">${filter.toUpperCase()}</button>
    `).join('');
    document.querySelectorAll('.filter-chip').forEach(button => {
      button.addEventListener('click', () => onFilterSelected(button.dataset.filter));
    });
  }

  // RENDER TRENDING SECTIONS
  function renderTrendingSections() {
    if (!trendingSections) return;
    trendingSections.innerHTML = `
      ${featuredTrend.length > 0 ? `
        <section class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-rocket section-icon"></i>THE PULSE</h2>
            <button class="see-all-btn" onclick="viewAllTrending()">SEE ALL</button>
          </div>
          ${renderFeaturedTrend()}
        </section>
      ` : ''}
      ${liveStreams.length > 0 ? `
        <section class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-tv section-icon"></i>LIVE STREAMS</h2>
            <button class="see-all-btn" onclick="viewAllLiveStreams()">SEE ALL</button>
          </div>
          <div class="content-horizontal-scroll">${renderLiveStreams()}</div>
        </section>
      ` : ''}
      ${trendingHashtags.length > 0 ? `
        <section class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-fire section-icon"></i>TRENDING TOPICS</h2>
          </div>
          <div class="hashtags-container">${renderTrendingHashtags()}</div>
        </section>
      ` : ''}
      ${communityGems.length > 0 ? `
        <section class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-gem section-icon"></i>COMMUNITY GEMS</h2>
          </div>
          <div class="community-grid">${renderCommunityGems()}</div>
        </section>
      ` : ''}
    `;
    setupContentCardListeners();
  }

  // RENDER FEATURED TREND
  function renderFeaturedTrend() {
    if (featuredTrend.length === 0) return '';
    const content = featuredTrend[0];
    const thumbnailUrl = content.thumbnail_url ?
      `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${content.thumbnail_url.replace(/^\/+/, '')}` :
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&h=675&fit=crop';
    return `
      <div class="featured-trend-card" data-content-id="${content.id}">
        <div class="featured-bg" style="background-image: url('${thumbnailUrl}')"></div>
        <div class="featured-overlay">
          ${content.is_live ? '<div class="live-badge">LIVE NOW</div>' : ''}
          <h2 class="featured-title">${escapeHtml(content.title)}</h2>
          <div class="featured-creator">@${escapeHtml(content.user_profiles?.username || content.creator || 'Creator')}</div>
          <div class="featured-stats">
            <span><i class="fas fa-eye"></i> ${formatNumber(content.real_views || content.views_count || 0)} views</span>
            <span><i class="fas fa-heart"></i> ${formatNumber(content.likes_count || content.likes || 0)} likes</span>
            <span><i class="fas fa-comment"></i> ${formatNumber(content.comments_count || 0)} comments</span>
          </div>
          <button class="watch-now-btn" onclick="playContent('${content.id}')">${content.is_live ? 'WATCH LIVE' : 'WATCH NOW'}</button>
        </div>
      </div>
    `;
  }

  // RENDER LIVE STREAMS
  function renderLiveStreams() {
    return liveStreams.map(content => {
      const thumbnailUrl = content.thumbnail_url ?
        `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${content.thumbnail_url.replace(/^\/+/, '')}` :
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
      const isUpcoming = content.scheduled_time && new Date(content.scheduled_time) > new Date();
      const creatorName = content.user_profiles?.username || content.creator || 'Creator';
      return `
        <div class="content-card" data-content-id="${content.id}">
          <div class="card-thumbnail">
            <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
            <div class="thumbnail-overlay"></div>
            <div class="card-badges">
              ${isUpcoming ? '<div class="badge upcoming">UPCOMING</div>' : '<div class="badge live">LIVE</div>'}
              <div class="badge viewers"><i class="fas fa-eye"></i> ${formatNumber(content.viewer_count || content.real_views || content.views_count || 0)}</div>
            </div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${escapeHtml(content.title)}</h3>
            <div class="card-creator">@${escapeHtml(creatorName)}</div>
            <div class="card-stats">
              <span><i class="fas fa-heart"></i> ${formatNumber(content.likes_count || content.likes || 0)}</span>
              <span><i class="fas fa-comment"></i> ${formatNumber(content.comments_count || 0)}</span>
            </div>
            ${isUpcoming ? `<button class="reminder-btn" onclick="setReminder('${content.id}')"><i class="fas fa-bell"></i> REMIND ME</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // RENDER TRENDING HASHTAGS
  function renderTrendingHashtags() {
    return trendingHashtags.map(hashtag => `<div class="hashtag" data-hashtag="${hashtag}">${hashtag}</div>`).join('');
  }

  // RENDER COMMUNITY GEMS
  function renderCommunityGems() {
    return communityGems.map(content => {
      const thumbnailUrl = content.thumbnail_url ?
        `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${content.thumbnail_url.replace(/^\/+/, '')}` :
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
      const creatorName = content.user_profiles?.username || content.creator || 'Creator';
      return `
        <div class="gem-card" data-content-id="${content.id}">
          <div class="gem-thumbnail">
            <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
          </div>
          <div class="gem-content">
            <h3 class="card-title">${escapeHtml(content.title)}</h3>
            <div class="card-creator">@${escapeHtml(creatorName)}</div>
            <div class="card-stats">
              <span><i class="fas fa-eye"></i> ${formatNumber(content.real_views || content.views_count || 0)}</span>
              <span><i class="fas fa-heart"></i> ${formatNumber(content.likes_count || content.likes || 0)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // SETUP CONTENT CARD LISTENERS
  function setupContentCardListeners() {
    document.querySelectorAll('[data-content-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const contentId = card.dataset.contentId;
        playContent(contentId);
      });
    });
    document.querySelectorAll('[data-hashtag]').forEach(hashtag => {
      hashtag.addEventListener('click', () => {
        const tag = hashtag.dataset.hashtag;
        window.location.href = `content-library.html?search=${encodeURIComponent(tag)}`;
      });
    });
  }

  // FILTER SELECTION HANDLER
  function onFilterSelected(filter) {
    selectedFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === filter);
    });
    if (filter !== 'All') {
      const genreMap = {
        'Music': 'Music',
        'Film & Series': 'Films',
        'Podcasts': 'Podcasts',
        'Gaming': 'Gaming',
        'Comedy': 'Comedy',
        'Live': 'Live',
        'Top 24 Hrs': 'Recent',
        'Rising Creators': 'Rising'
      };
      const genre = genreMap[filter] || filter;
      window.location.href = `content-library.html?genre=${encodeURIComponent(genre)}`;
    }
  }

  // PLAY CONTENT FUNCTION
  async function playContent(contentId) {
    try {
      let viewerId = null;
      if (currentUser) viewerId = currentUser.id;
      const { error } = await supabaseClient
        .from('content_views')
        .insert({
          content_id: contentId,
          viewer_id: viewerId,
          view_duration: 0,
          device_type: /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          created_at: new Date().toISOString()
        });
      if (error) console.error('❌ View recording failed:', error);
      else console.log('✅ View recorded successfully');
    } catch (error) {
      console.error('❌ View recording error:', error);
    }
    window.location.href = `content-detail.html?id=${contentId}`;
  }

  // SET REMINDER FUNCTION
  function setReminder(contentId) {
    const content = liveStreams.find(item => item.id == contentId);
    if (content) showToast(`Reminder set for "${content.title}"`, 'success');
  }

  // VIEW ALL TRENDING
  window.viewAllTrending = function() {
    window.location.href = 'content-library.html?sort=trending';
  };

  // VIEW ALL LIVE STREAMS
  window.viewAllLiveStreams = function() {
    window.location.href = 'content-library.html?genre=Live';
  };

  // REFRESH CONTENT
  async function refreshContent() {
    setLoading(true, 'Refreshing trending content...');
    await loadContent();
    showToast('Trending content refreshed!', 'success');
    setLoading(false);
  }

  // LOAD ALL CONTENT AND RENDER
  async function loadContent() {
    try {
      setLoading(true, 'Loading trending content...');
      const contentData = await fetchContent();
      processTrendingSections(contentData);
      renderFilterChips();
      renderTrendingSections();
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading content:', error);
      showToast('Failed to load trending content', 'error');
      setLoading(false);
    }
  }

  // SETUP EVENT LISTENERS
  function setupEventListeners() {
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        document.getElementById('search-modal').classList.add('active');
        setTimeout(() => document.getElementById('search-input')?.focus(), 300);
      });
    }
    document.getElementById('close-search-btn')?.addEventListener('click', () => {
      document.getElementById('search-modal').classList.remove('active');
      document.getElementById('search-input').value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    });
    document.getElementById('search-modal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('search-modal')) {
        document.getElementById('search-modal').classList.remove('active');
        document.getElementById('search-input').value = '';
        document.getElementById('search-results-grid').innerHTML = '';
      }
    });
    if (refreshBtn) refreshBtn.addEventListener('click', refreshContent);
    if (notificationsBtn) {
      notificationsBtn.addEventListener('click', () => {
        document.getElementById('notifications-panel').classList.add('active');
        renderNotifications();
      });
    }
    document.getElementById('close-notifications')?.addEventListener('click', () => {
      document.getElementById('notifications-panel').classList.remove('active');
    });
    document.getElementById('mark-all-read')?.addEventListener('click', markAllNotificationsAsRead);
    if (profileBtn) {
      profileBtn.addEventListener('click', async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) window.location.href = 'profile.html';
        else window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
      });
    }
    if (exploreAllBtn) {
      exploreAllBtn.addEventListener('click', () => {
        window.location.href = 'content-library.html?sort=trending';
      });
    }
    if (authLoginBtn) {
      authLoginBtn.addEventListener('click', () => {
        localStorage.setItem('redirectAfterLogin', 'trending_screen.html');
        window.location.href = 'login.html?redirect=trending_screen.html';
      });
    }
    if (authCancelBtn) {
      authCancelBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
        window.history.back();
      });
    }
  }

  // INITIALIZE TRENDING SCREEN
  async function initializeTrendingScreen() {
    console.log('🔥 Initializing Trending Screen...');
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setupEventListeners();
    await loadContent();
    console.log('✅ Trending Screen initialized successfully');
  }

  // Start initialization
  initializeTrendingScreen();

  // Auth state change listener
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      loadUserProfilePicture(currentUser);
      loadNotifications();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      const placeholder = document.getElementById('userProfilePlaceholder');
      if (placeholder) {
        placeholder.innerHTML = `<div class="profile-placeholder"><i class="fas fa-user"></i></div>`;
      }
      updateNotificationBadge(0);
      notifications = [];
      renderNotifications();
      showToast('Signed out successfully', 'info');
      if (authModal) authModal.classList.add('active');
    }
  });
});
