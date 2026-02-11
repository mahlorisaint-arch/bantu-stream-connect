// js/content-detail.js - FIXED FOR RLS POLICIES
console.log('🎬 Content Detail Initializing with RLS-compliant fixes...');
// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let isInitialized = false;
let currentUserId = null;
let viewRecordedThisSession = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOM loaded, starting initialization...');
  
  // Initialize Supabase client
  if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(
      'https://ydnxqnbjoshvxteevemc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
    );
  }
  
  // Load helpers
  if (!window.SupabaseHelper) await import('./js/supabase-helper.js');
  if (!window.AuthHelper) await import('./js/auth-helper.js');
  
  // Wait for helpers
  await waitForHelpers();
  
  // Setup auth listeners
  setupAuthListeners();
  
  // Load content
  await loadContentFromURL();
  
  // Setup UI
  setupEventListeners();
  
  // Initialize video player
  initializeEnhancedVideoPlayer();
  
  // Initialize all modals/panels
  initAnalyticsModal();
  initSearchModal();
  initNotificationsPanel();
  initThemeSelector();
  initGlobalNavigation();
  
  // Show app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  console.log('✅ Content Detail fully initialized with RLS-compliant fixes');
});

async function waitForHelpers() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.SupabaseHelper?.isInitialized && window.AuthHelper?.isInitialized) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

// Authentication setup
function setupAuthListeners() {
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await window.AuthHelper.initialize();
      currentUserId = window.AuthHelper.getUserProfile()?.id || null;
      updateProfileUI();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      currentUserId = null;
      resetProfileUI();
      showToast('Signed out successfully', 'info');
    }
  });
  
  // Initial update
  if (window.AuthHelper?.isAuthenticated?.()) {
    currentUserId = window.AuthHelper.getUserProfile()?.id || null;
    updateProfileUI();
  } else {
    resetProfileUI();
  }
}

function updateProfileUI() {
  const profileBtn = document.getElementById('profile-btn');
  const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
  if (!profileBtn || !userProfilePlaceholder) return;
  
  if (window.AuthHelper?.isAuthenticated?.()) {
    const userProfile = window.AuthHelper.getUserProfile();
    const displayName = window.AuthHelper.getDisplayName();
    const avatarUrl = window.AuthHelper.getAvatarUrl();
    const initial = displayName.charAt(0).toUpperCase();
    
    if (avatarUrl) {
      userProfilePlaceholder.innerHTML = `
        <img src="${avatarUrl}" alt="${displayName}"
        class="profile-img"
        style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
      `;
    } else {
      userProfilePlaceholder.innerHTML = `
        <div class="profile-placeholder" style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1D4ED8, #F59E0B);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        ">${initial}</div>
      `;
    }
    
    profileBtn.onclick = () => {
      window.location.href = 'profile.html';
    };
  } else {
    userProfilePlaceholder.innerHTML = `
      <div class="profile-placeholder">
        <i class="fas fa-user"></i>
      </div>
    `;
    
    profileBtn.onclick = () => {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    };
  }
  
  // Enable/disable comment section based on auth state
  const commentInput = document.getElementById('commentInput');
  const sendCommentBtn = document.getElementById('sendCommentBtn');
  if (commentInput && sendCommentBtn) {
    if (window.AuthHelper?.isAuthenticated?.()) {
      commentInput.disabled = false;
      commentInput.placeholder = 'Write a comment...';
      sendCommentBtn.disabled = false;
      
      const userProfile = window.AuthHelper.getUserProfile();
      const displayName = window.AuthHelper.getDisplayName();
      const avatarUrl = window.AuthHelper.getAvatarUrl();
      const commentAvatar = document.getElementById('userCommentAvatar');
      
      if (commentAvatar) {
        if (avatarUrl) {
          commentAvatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
          commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">${displayName.charAt(0)}</div>`;
        }
      }
    } else {
      commentInput.disabled = true;
      commentInput.placeholder = 'Sign in to add a comment...';
      sendCommentBtn.disabled = true;
      
      const commentAvatar = document.getElementById('userCommentAvatar');
      if (commentAvatar) {
        commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
      }
    }
  }
}

function resetProfileUI() {
  const profileBtn = document.getElementById('profile-btn');
  const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
  if (!profileBtn || !userProfilePlaceholder) return;
  
  userProfilePlaceholder.innerHTML = `
    <div class="profile-placeholder">
      <i class="fas fa-user"></i>
    </div>
  `;
  
  profileBtn.onclick = () => {
    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
  };
}

// ============================================
// FIXED: Load content with FRESH counts from database
// ============================================
async function loadContentFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id') || '68';
  
  try {
    // FETCH FRESH DATA FROM DATABASE (NO CACHING)
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .eq('id', contentId)
      .single();
    
    if (error) throw error;
    
    // Process data
    currentContent = {
      id: data.id,
      title: data.title || 'Untitled',
      description: data.description || '',
      thumbnail_url: data.thumbnail_url,
      file_url: data.file_url,
      media_type: data.media_type || 'video',
      genre: data.genre || 'General',
      created_at: data.created_at,
      duration: data.duration || data.duration_seconds || 3600,
      language: data.language || 'English',
      views_count: data.views_count || 0,  // FRESH from DB
      likes_count: data.likes_count || 0,   // FRESH from DB
      favorites_count: data.favorites_count || 0,
      comments_count: data.comments_count || 0,
      creator: data.user_profiles?.full_name || data.user_profiles?.username || 'Creator',
      creator_display_name: data.user_profiles?.full_name || data.user_profiles?.username || 'Creator',
      creator_id: data.user_profiles?.id || data.user_id,
      user_id: data.user_id
    };
    
    console.log('📥 Content loaded with FRESH counts:', {
      views: currentContent.views_count,
      likes: currentContent.likes_count
    });
    
    // Update UI
    updateContentUI(currentContent);
    
    // Initialize user-specific button states
    if (currentUserId) {
      await initializeLikeButton(contentId, currentUserId);
      await initializeFavoriteButton(contentId, currentUserId);
    }
    
    // Load comments
    await loadComments(contentId);
    
    // Load related content
    await loadRelatedContent(contentId);
    
  } catch (error) {
    console.error('❌ Content load failed:', error);
    showToast('Content not available. Please try again.', 'error');
    document.getElementById('contentTitle').textContent = 'Content Unavailable';
  }
}

// ============================================
// CHECK IF USER HAS LIKED (using user_likes table)
// ============================================
async function checkUserLike(contentId, userId) {
  if (!userId) return false;
  
  try {
    const { data, error } = await window.supabaseClient
      .from('user_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (error?.code === 'PGRST116') return false; // No rows found
    if (error) {
      console.warn('Like check failed (using optimistic state):', error.message);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Like check error:', error);
    return false;
  }
}

// ============================================
// INITIALIZE LIKE BUTTON STATE
// ============================================
async function initializeLikeButton(contentId, userId) {
  const likeBtn = document.getElementById('likeBtn');
  if (!likeBtn) return;
  
  // Reset state
  likeBtn.classList.remove('active');
  likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
  
  if (!userId) return; // Not logged in
  
  // Check if user has liked this content
  const isLiked = await checkUserLike(contentId, userId);
  if (isLiked) {
    likeBtn.classList.add('active');
    likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
  }
}

// ============================================
// CHECK IF USER HAS FAVORITED
// ============================================
async function checkUserFavorite(contentId, userId) {
  if (!userId) return false;
  
  try {
    const { data, error } = await window.supabaseClient
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (error?.code === 'PGRST116') return false;
    if (error) {
      console.warn('Favorite check failed:', error.message);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Favorite check error:', error);
    return false;
  }
}

// ============================================
// INITIALIZE FAVORITE BUTTON STATE
// ============================================
async function initializeFavoriteButton(contentId, userId) {
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (!favoriteBtn) return;
  
  // Reset state
  favoriteBtn.classList.remove('active');
  favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
  
  if (!userId) return; // Not logged in
  
  // Check if user has favorited this content
  const isFavorited = await checkUserFavorite(contentId, userId);
  if (isFavorited) {
    favoriteBtn.classList.add('active');
    favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
  }
}

// Update UI with content
function updateContentUI(content) {
  if (!content) return;
  
  // Update title
  safeSetText('contentTitle', content.title);
  safeSetText('creatorName', content.creator);
  safeSetText('creatorDisplayName', content.creator_display_name);
  
  // Update stats - ALWAYS use FRESH counts from database
  safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
  safeSetText('viewsCountFull', formatNumber(content.views_count));
  safeSetText('likesCount', formatNumber(content.likes_count));
  safeSetText('favoritesCount', formatNumber(content.favorites_count));
  safeSetText('commentsCount', `(${formatNumber(content.comments_count)})`);
  
  // Update duration
  const duration = formatDuration(content.duration || 3600);
  safeSetText('durationText', duration);
  safeSetText('contentDurationFull', duration);
  
  // Update date
  safeSetText('uploadDate', formatDate(content.created_at));
  
  // Update genre and language
  safeSetText('contentGenre', content.genre || 'General');
  
  // Update descriptions
  safeSetText('contentDescriptionShort', truncateText(content.description, 150));
  safeSetText('contentDescriptionFull', content.description);
  
  // Update poster image
  const posterPlaceholder = document.getElementById('posterPlaceholder');
  if (posterPlaceholder && content.thumbnail_url) {
    const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) || content.thumbnail_url;
    posterPlaceholder.innerHTML = `
      <img src="${imgUrl}" alt="${content.title}"
      style="width:100%; height:100%; object-fit:cover; border-radius: 12px;"
      onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop'">
      <div class="play-overlay">
        <div class="play-icon-large">
          <i class="fas fa-play"></i>
        </div>
      </div>
    `;
  }
  
  // Update player title
  const playerTitle = document.getElementById('playerTitle');
  if (playerTitle) {
    playerTitle.textContent = `Now Playing: ${content.title}`;
  }
}

// Load comments
async function loadComments(contentId) {
  try {
    console.log('💬 Loading comments for content:', contentId);
    
    const { data: comments, error } = await window.supabaseClient
      .from('comments')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ Loaded ${comments.length} comments`);
    renderComments(comments || []);
    
    // Update comment count in UI
    const countEl = document.getElementById('commentsCount');
    if (countEl) {
      countEl.textContent = `(${comments.length})`;
    }
    
    // Update Content table comments_count
    if (currentContent) {
      const { error: updateError } = await window.supabaseClient
        .from('Content')
        .update({ comments_count: comments.length })
        .eq('id', currentContent.id);
      
      if (updateError) {
        console.warn('Failed to update comments_count:', updateError);
      }
    }
  } catch (error) {
    console.error('❌ Comments load failed:', error);
    showToast('Failed to load comments', 'error');
    renderComments([]);
  }
}

// Render comments
function renderComments(comments) {
  const container = document.getElementById('commentsList');
  const noComments = document.getElementById('noComments');
  const countEl = document.getElementById('commentsCount');
  
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!comments || comments.length === 0) {
    if (noComments) noComments.style.display = 'flex';
    if (countEl) countEl.textContent = '(0)';
    return;
  }
  
  if (noComments) noComments.style.display = 'none';
  if (countEl) countEl.textContent = `(${comments.length})`;
  
  const fragment = document.createDocumentFragment();
  comments.forEach(comment => {
    const commentEl = createCommentElement(comment);
    fragment.appendChild(commentEl);
  });
  
  container.appendChild(fragment);
}

function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'comment-item';
  
  let authorName = comment.author_name || 'User';
  let avatarUrl = comment.author_avatar || null;
  const time = formatCommentTime(comment.created_at);
  const commentText = comment.comment_text || '';
  const initial = authorName.charAt(0).toUpperCase();
  
  div.innerHTML = `
    <div class="comment-header">
      <div class="comment-avatar-sm">
        ${avatarUrl ?
          `<img src="${avatarUrl}" alt="${authorName}"
          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(29, 78, 216, 0.2);">` :
          `<div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1D4ED8, #F59E0B);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 2px solid rgba(29, 78, 216, 0.2);
          ">
          ${initial}
          </div>`
        }
      </div>
      <div class="comment-user">
        <strong>${escapeHtml(authorName)}</strong>
        <div class="comment-time">${time}</div>
      </div>
    </div>
    <div class="comment-content">
      ${escapeHtml(commentText)}
    </div>
  `;
  
  return div;
}

// Load related content
async function loadRelatedContent(contentId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select('id, title, thumbnail_url, views_count')
      .neq('id', contentId)
      .limit(6);
    
    if (error) throw error;
    renderRelatedContent(data || []);
  } catch (error) {
    console.error('Error loading related content:', error);
    renderRelatedContent([]);
  }
}

function renderRelatedContent(items) {
  const container = document.getElementById('relatedGrid');
  if (!container) return;
  
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="related-placeholder card">
        <i class="fas fa-video-slash"></i>
        <p>No related content found</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  items.forEach(item => {
    const card = document.createElement('a');
    card.className = 'content-card';
    card.href = `content-detail.html?id=${item.id}`;
    card.onclick = function(e) {
      e.preventDefault();
      window.location.href = `content-detail.html?id=${item.id}`;
    };
    
    const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(item.thumbnail_url) || item.thumbnail_url;
    const title = item.title || 'Untitled';
    
    card.innerHTML = `
      <div class="card-thumbnail">
        <img src="${imgUrl}" alt="${title}"
        onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
        <div class="thumbnail-overlay"></div>
      </div>
      <div class="card-content">
        <h3 class="card-title">${truncateText(title, 50)}</h3>
        <div class="related-meta">
          <i class="fas fa-eye"></i>
          <span>${formatNumber(item.views_count || 0)} views</span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// ====================================================
// VIDEO PLAYER INITIALIZATION
// ====================================================
function initializeEnhancedVideoPlayer() {
  const videoElement = document.getElementById('inlineVideoPlayer');
  const videoContainer = document.querySelector('.video-container');
  
  if (!videoElement || !videoContainer) {
    console.warn('⚠️ Video elements not found');
    return;
  }
  
  try {
    const preferences = window.state ? window.state.getPreferences() : {
      autoplay: false,
      playbackSpeed: 1.0,
      quality: 'auto'
    };
    
    console.log('🎬 Creating EnhancedVideoPlayer with content:', currentContent?.id);
    
    enhancedVideoPlayer = new EnhancedVideoPlayer({
      autoplay: preferences.autoplay,
      defaultSpeed: preferences.playbackSpeed,
      defaultQuality: preferences.quality,
      defaultVolume: window.stateManager ? window.stateManager.getState('session.volume') : 1.0,
      muted: window.stateManager ? window.stateManager.getState('session.muted') : false,
      contentId: currentContent?.id || null,
      supabaseClient: window.supabaseClient,
      userId: currentUserId
    });
    
    enhancedVideoPlayer.attach(videoElement, videoContainer);
    
    // Reset session tracking
    viewRecordedThisSession = false;
    
    enhancedVideoPlayer.on('play', () => {
      console.log('▶️ Video playing, recording view...');
      
      if (window.stateManager) {
        window.stateManager.setState('session.playing', true);
      }
      
      // Record view ONLY ONCE per session
      if (currentContent && !viewRecordedThisSession) {
        viewRecordedThisSession = true;
        
        // Skip if already viewed recently
        if (hasViewedContentRecently(currentContent.id)) {
          console.log('📊 View already recorded recently');
          return;
        }
        
        // OPTIMISTIC UI UPDATE
        const viewsEl = document.getElementById('viewsCount');
        const viewsFullEl = document.getElementById('viewsCountFull');
        const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
        const newViews = currentViews + 1;
        
        if (viewsEl && viewsFullEl) {
          viewsEl.textContent = `${formatNumber(newViews)} views`;
          viewsFullEl.textContent = formatNumber(newViews);
        }
        
        // Record view
        recordContentView(currentContent.id)
          .then(async (success) => {
            if (success) {
              markContentAsViewed(currentContent.id);
              
              // REFRESH to get accurate count from database
              await refreshContentCounts();
              
              if (window.track?.contentView) {
                window.track.contentView(currentContent.id, 'video');
              }
            } else {
              // Revert UI on failure
              if (viewsEl && viewsFullEl) {
                viewsEl.textContent = `${formatNumber(currentViews)} views`;
                viewsFullEl.textContent = formatNumber(currentViews);
              }
            }
          })
          .catch((error) => {
            console.error('View recording error:', error);
            // Revert UI on error
            if (viewsEl && viewsFullEl) {
              viewsEl.textContent = `${formatNumber(currentViews)} views`;
              viewsFullEl.textContent = formatNumber(currentViews);
            }
          });
      }
    });
    
    enhancedVideoPlayer.on('pause', () => {
      if (window.stateManager) {
        window.stateManager.setState('session.playing', false);
      }
    });
    
    enhancedVideoPlayer.on('volumechange', (volume) => {
      if (window.stateManager) {
        window.stateManager.setState('session.volume', volume);
      }
    });
    
    enhancedVideoPlayer.on('error', (error) => {
      console.error('🔴 Video player error:', error);
      showToast('Playback error occurred', 'error');
    });
    
    console.log('✅ Enhanced video player initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize enhanced video player:', error);
    showToast('Video player failed to load. Using basic player.', 'warning');
    videoElement.controls = true;
  }
}

// ============================================
// RECORD VIEW - WORKS WITH RLS POLICIES
// ============================================
async function recordContentView(contentId) {
  try {
    // Get viewer ID (only if authenticated)
    let viewerId = null;
    if (window.AuthHelper?.isAuthenticated?.()) {
      const userProfile = window.AuthHelper.getUserProfile();
      viewerId = userProfile?.id || null;
    }
    
    // INSERT into content_views table
    const { data, error } = await window.supabaseClient
      .from('content_views')
      .insert({
        content_id: contentId,
        viewer_id: viewerId,
        view_duration: 0,
        device_type: /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)
          ? 'mobile'
          : 'desktop',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ View recording failed:', error);
      return false;
    }
    
    console.log('✅ View recorded in content_views:', data);
    return true;
    
  } catch (error) {
    console.error('❌ View recording error:', error);
    return false;
  }
}

// ============================================
// REFRESH CONTENT COUNTS FROM DATABASE
// ============================================
async function refreshContentCounts() {
  if (!currentContent) return;
  
  try {
    // FETCH FRESH counts from database
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select('views_count, likes_count, favorites_count, comments_count')
      .eq('id', currentContent.id)
      .single();
    
    if (error) {
      console.error('❌ Failed to refresh content counts:', error);
      return;
    }
    
    // Update local state
    currentContent.views_count = data.views_count;
    currentContent.likes_count = data.likes_count;
    currentContent.favorites_count = data.favorites_count;
    currentContent.comments_count = data.comments_count;
    
    // Update UI with FRESH counts
    safeSetText('viewsCount', formatNumber(data.views_count) + ' views');
    safeSetText('viewsCountFull', formatNumber(data.views_count));
    safeSetText('likesCount', formatNumber(data.likes_count));
    safeSetText('favoritesCount', formatNumber(data.favorites_count));
    safeSetText('commentsCount', `(${formatNumber(data.comments_count)})`);
    
    console.log('✅ Content counts refreshed from DB:', {
      views: data.views_count,
      likes: data.likes_count
    });
    
  } catch (error) {
    console.error('❌ Failed to refresh content counts:', error);
  }
}

// ============================================
// CLIENT-SIDE VIEW DEDUPLICATION
// ============================================
function hasViewedContentRecently(contentId) {
  try {
    const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
    const viewTime = viewedContent[contentId];
    if (!viewTime) return false;
    const hoursSinceView = (Date.now() - viewTime) / (1000 * 60 * 60);
    return hoursSinceView < 24;
  } catch (error) {
    console.error('Error checking view history:', error);
    return false;
  }
}

function markContentAsViewed(contentId) {
  try {
    const viewedContent = JSON.parse(localStorage.getItem('bantu_viewed_content') || '{}');
    viewedContent[contentId] = Date.now();
    
    // Clean up old entries (older than 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    Object.keys(viewedContent).forEach(id => {
      if (viewedContent[id] < sevenDaysAgo) {
        delete viewedContent[id];
      }
    });
    
    localStorage.setItem('bantu_viewed_content', JSON.stringify(viewedContent));
    return true;
  } catch (error) {
    console.error('Error marking content as viewed:', error);
    return false;
  }
}

// ============================================
// CLEAR VIEW CACHE (FOR TESTING)
// ============================================
function clearViewCache() {
  localStorage.removeItem('bantu_viewed_content');
  console.log('🧹 View cache cleared');
  showToast('View cache cleared!', 'success');
}

// ============================================
// HANDLE PLAY BUTTON
// ============================================
function handlePlay() {
  if (!currentContent) {
    showToast('No content to play', 'error');
    return;
  }
  
  const player = document.getElementById('inlinePlayer');
  const videoElement = document.getElementById('inlineVideoPlayer');
  
  if (!player || !videoElement) {
    showToast('Video player not available', 'error');
    return;
  }
  
  // Get video URL
  let videoUrl = currentContent.file_url;
  console.log('📥 Raw file_url from database:', videoUrl);
  
  // Construct proper Supabase URL if needed
  if (videoUrl && !videoUrl.startsWith('http')) {
    if (videoUrl.startsWith('/')) {
      videoUrl = videoUrl.substring(1);
    }
    videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${videoUrl}`;
  }
  
  // Fallback to thumbnail if needed
  if (!videoUrl || videoUrl === 'null' || videoUrl === 'undefined' || videoUrl === '') {
    if (currentContent.thumbnail_url && !currentContent.thumbnail_url.startsWith('http')) {
      const cleanPath = currentContent.thumbnail_url.startsWith('/')
        ? currentContent.thumbnail_url.substring(1)
        : currentContent.thumbnail_url;
      videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
    }
  }
  
  console.log('🎥 Final video URL:', videoUrl);
  
  // Validate URL format
  if (!videoUrl || (!videoUrl.includes('.mp4') && !videoUrl.includes('.webm') && !videoUrl.includes('.mov'))) {
    console.error('❌ Invalid video URL or format:', videoUrl);
    showToast('Invalid video format or URL', 'error');
    return;
  }
  
  // Show player
  player.style.display = 'block';
  
  // Hide placeholder
  const placeholder = document.getElementById('videoPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
  
  // Destroy existing player FIRST
  if (enhancedVideoPlayer) {
    try {
      console.log('🗑️ Destroying existing player...');
      enhancedVideoPlayer.destroy();
    } catch (e) {
      console.warn('Error destroying old player:', e);
    }
    enhancedVideoPlayer = null;
  }
  
  // Clear and set video source
  console.log('🔧 Setting video source...');
  
  while (videoElement.firstChild) {
    videoElement.removeChild(videoElement.firstChild);
  }
  
  videoElement.removeAttribute('src');
  videoElement.src = '';
  
  const source = document.createElement('source');
  source.src = videoUrl;
  
  // Set MIME type
  if (videoUrl.endsWith('.mp4')) {
    source.type = 'video/mp4';
  } else if (videoUrl.endsWith('.webm')) {
    source.type = 'video/webm';
  } else if (videoUrl.endsWith('.mov')) {
    source.type = 'video/quicktime';
  } else {
    source.type = 'video/mp4';
  }
  
  videoElement.appendChild(source);
  videoElement.load();
  
  console.log('✅ Video source set successfully');
  
  // Initialize player AFTER source is set
  console.log('🎬 Initializing EnhancedVideoPlayer...');
  initializeEnhancedVideoPlayer();
  
  // Try to play after delay
  setTimeout(() => {
    if (enhancedVideoPlayer) {
      console.log('▶️ Attempting to play...');
      enhancedVideoPlayer.play().catch(err => {
        console.error('🔴 Play failed:', err);
        showToast('Click play button in video player', 'info');
      });
    } else {
      console.log('▶️ Using native player...');
      videoElement.play().catch(err => {
        console.error('🔴 Autoplay failed:', err);
        showToast('Click play button in video player', 'info');
      });
    }
  }, 500);
  
  // Scroll to player
  setTimeout(() => {
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// Setup event listeners
function setupEventListeners() {
  console.log('🔧 Setting up event listeners...');
  
  // Play button
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }
  
  // Poster click
  const poster = document.getElementById('heroPoster');
  if (poster) {
    poster.addEventListener('click', handlePlay);
  }
  
  // Close player
  const closePlayer = document.getElementById('closePlayerBtn');
  if (closePlayer) {
    closePlayer.addEventListener('click', function() {
      const player = document.getElementById('inlinePlayer');
      const video = document.getElementById('inlineVideoPlayer');
      
      if (player) player.style.display = 'none';
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      
      if (enhancedVideoPlayer) {
        if (enhancedVideoPlayer.video) {
          enhancedVideoPlayer.video.pause();
          enhancedVideoPlayer.video.currentTime = 0;
        }
        enhancedVideoPlayer.destroy();
        enhancedVideoPlayer = null;
      }
    });
  }
  
  // ============================================
  // LIKE BUTTON - RLS-COMPLIANT
  // ============================================
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      if (!currentContent) return;
      
      // Check authentication FIRST
      if (!window.AuthHelper?.isAuthenticated?.()) {
        showToast('Sign in to like content', 'warning');
        return;
      }
      
      const userProfile = window.AuthHelper.getUserProfile();
      if (!userProfile?.id) {
        showToast('User profile not found', 'error');
        return;
      }
      
      const isLiked = likeBtn.classList.contains('active');
      const likesCountEl = document.getElementById('likesCount');
      const currentLikes = parseInt(likesCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
      const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
      
      try {
        // OPTIMISTIC UI UPDATE
        likeBtn.classList.toggle('active', !isLiked);
        likeBtn.innerHTML = !isLiked
          ? '<i class="fas fa-heart"></i><span>Liked</span>'
          : '<i class="far fa-heart"></i><span>Like</span>';
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(newLikes);
        }
        
        // Update database using user_likes table (RLS-compliant)
        if (!isLiked) {
          // Add like
          const { error } = await window.supabaseClient
            .from('user_likes')
            .insert({
              user_id: userProfile.id,
              content_id: currentContent.id
            });
          
          if (error) throw error;
        } else {
          // Remove like
          const { error } = await window.supabaseClient
            .from('user_likes')
            .delete()
            .eq('user_id', userProfile.id)
            .eq('content_id', currentContent.id);
          
          if (error) throw error;
        }
        
        // UPDATE Content.likes_count MANUALLY (bypass trigger issues)
        const { error: updateError } = await window.supabaseClient
          .from('Content')
          .update({ likes_count: newLikes })
          .eq('id', currentContent.id);
        
        if (updateError) {
          console.warn('Likes count update failed:', updateError);
        }
        
        // Update local state
        currentContent.likes_count = newLikes;
        
        showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');
        
        // Track analytics
        if (window.track?.contentLike) {
          window.track.contentLike(currentContent.id, !isLiked);
        }
        
        // REFRESH to confirm
        await refreshContentCounts();
        
      } catch (error) {
        console.error('Like update failed:', error);
        
        // REVERT UI ON ERROR
        likeBtn.classList.toggle('active', isLiked);
        likeBtn.innerHTML = isLiked
          ? '<i class="fas fa-heart"></i><span>Liked</span>'
          : '<i class="far fa-heart"></i><span>Like</span>';
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(currentLikes);
        }
        
        showToast('Failed to update like: ' + error.message, 'error');
      }
    });
  }
  
  // ============================================
  // FAVORITE BUTTON
  // ============================================
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async () => {
      if (!currentContent) return;
      
      if (!window.AuthHelper?.isAuthenticated?.()) {
        showToast('Sign in to favorite content', 'warning');
        return;
      }
      
      const userProfile = window.AuthHelper.getUserProfile();
      if (!userProfile?.id) {
        showToast('User profile not found', 'error');
        return;
      }
      
      const isFavorited = favoriteBtn.classList.contains('active');
      const favCountEl = document.getElementById('favoritesCount');
      const currentFavorites = parseInt(favCountEl?.textContent.replace(/\D/g, '') || '0') || 0;
      const newFavorites = isFavorited ? currentFavorites - 1 : currentFavorites + 1;
      
      try {
        // OPTIMISTIC UI UPDATE
        favoriteBtn.classList.toggle('active', !isFavorited);
        favoriteBtn.innerHTML = !isFavorited
          ? '<i class="fas fa-star"></i><span>Favorited</span>'
          : '<i class="far fa-star"></i><span>Favorite</span>';
        
        if (favCountEl) {
          favCountEl.textContent = formatNumber(newFavorites);
        }
        
        // Update database
        if (!isFavorited) {
          const { error } = await window.supabaseClient
            .from('favorites')
            .insert({
              user_id: userProfile.id,
              content_id: currentContent.id
            });
          
          if (error) throw error;
        } else {
          const { error } = await window.supabaseClient
            .from('favorites')
            .delete()
            .eq('user_id', userProfile.id)
            .eq('content_id', currentContent.id);
          
          if (error) throw error;
        }
        
        // UPDATE Content.favorites_count
        const { error: updateError } = await window.supabaseClient
          .from('Content')
          .update({ favorites_count: newFavorites })
          .eq('id', currentContent.id);
        
        if (updateError) {
          console.warn('Favorites count update failed:', updateError);
        }
        
        currentContent.favorites_count = newFavorites;
        
        showToast(!isFavorited ? 'Added to favorites!' : 'Removed from favorites', !isFavorited ? 'success' : 'info');
        
        // REFRESH to confirm
        await refreshContentCounts();
        
      } catch (error) {
        console.error('Favorite update failed:', error);
        
        // REVERT UI ON ERROR
        favoriteBtn.classList.toggle('active', isFavorited);
        favoriteBtn.innerHTML = isFavorited
          ? '<i class="fas fa-star"></i><span>Favorited</span>'
          : '<i class="far fa-star"></i><span>Favorite</span>';
        
        if (favCountEl) {
          favCountEl.textContent = formatNumber(currentFavorites);
        }
        
        showToast('Failed to update favorite', 'error');
      }
    });
  }
  
  // Comment submission handler
  const sendBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('commentInput');
  
  if (sendBtn && commentInput) {
    sendBtn.addEventListener('click', async function() {
      const text = commentInput.value.trim();
      if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
      }
      
      if (!window.AuthHelper?.isAuthenticated?.()) {
        showToast('You need to sign in to comment', 'warning');
        return;
      }
      
      if (!currentContent) return;
      
      // Show loading state
      const originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      sendBtn.disabled = true;
      
      try {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        const avatarUrl = window.AuthHelper.getAvatarUrl();
        
        if (!userProfile?.id) {
          throw new Error('User profile not found');
        }
        
        // Insert comment
        const { data: newComment, error: insertError } = await window.supabaseClient
          .from('comments')
          .insert({
            content_id: currentContent.id,
            user_id: userProfile.id,
            author_name: displayName,
            comment_text: text,
            author_avatar: avatarUrl || null,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Comment insert error:', insertError);
          throw insertError;
        }
        
        console.log('✅ Comment inserted:', newComment);
        
        // Refresh comments and counts
        await loadComments(currentContent.id);
        await refreshContentCounts();
        
        // Clear input
        commentInput.value = '';
        showToast('Comment added!', 'success');
        
        // Track analytics
        if (window.track?.contentComment) {
          window.track.contentComment(currentContent.id);
        }
      } catch (error) {
        console.error('❌ Comment submission failed:', error);
        showToast(error.message || 'Failed to add comment', 'error');
      } finally {
        sendBtn.innerHTML = originalHTML;
        sendBtn.disabled = false;
      }
    });
    
    // Enter key support
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }
  
  console.log('✅ Event listeners setup complete');
}

// Export functions
window.clearViewCache = clearViewCache;
window.refreshContentCounts = refreshContentCounts;

console.log('✅ Content detail script loaded with RLS-compliant fixes');
