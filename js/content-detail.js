// js/content-detail.js - FIXED FOR RLS POLICIES - WITH ACCURATE COUNT BYPASS - VIEWS RECORDED ON PLAY BUTTON CLICK (LIKE MOBILE APP)
// FIXED: Theme selector conflict resolved, navigation icons properly aligned
// PHASE 1 UPDATE: Watch Session Lifecycle Integration with syntax-safe WatchSession
// PHASE 2 UPDATE: Watch Later & Playlist System Integration
console.log('🎬 Content Detail Initializing with RLS-compliant fixes and view tracking on Play button click...');

// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let watchSession = null; // PHASE 1: Watch session instance
let playlistManager = null; // PHASE 2: Playlist manager instance
let isInitialized = false;
let currentUserId = null;

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
  initThemeSelector(); // FIXED: Theme selector now properly implemented
  initGlobalNavigation(); // FIXED: Navigation icons with proper event listeners
  
  // PHASE 1: Load Continue Watching section
  if (currentUserId) {
    await loadContinueWatching(currentUserId);
    setupContinueWatchingRefresh();
  }
  
  // PHASE 2: Initialize Playlist Manager after auth is ready
  if (window.PlaylistManager && currentUserId) {
    await initializePlaylistManager();
  }
  
  // Show app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  console.log('✅ Content Detail fully initialized with RLS-compliant fixes and PHASE 2 Watch Later');
});

// PHASE 1: Import WatchSession class
// Make sure watch-session.js is loaded before this script
if (!window.WatchSession) {
  console.warn('⚠️ WatchSession not loaded, will attempt to load dynamically');
  // Dynamic load as fallback
  const script = document.createElement('script');
  script.src = 'js/watch-session.js';
  document.head.appendChild(script);
}

// PHASE 2: Import PlaylistManager class
if (!window.PlaylistManager) {
  console.warn('⚠️ PlaylistManager not loaded, will attempt to load dynamically');
  // Dynamic load as fallback
  const script = document.createElement('script');
  script.src = 'js/playlist-manager.js';
  document.head.appendChild(script);
}

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

// ============================================
// PHASE 2: PLAYLIST MANAGER INITIALIZATION
// ============================================
async function initializePlaylistManager() {
  // Check if PlaylistManager class is available
  if (typeof window.PlaylistManager !== 'function') {
    console.warn('⚠️ PlaylistManager class not found — check script load order');
    return;
  }
  
  if (!currentUserId) {
    console.log('🔓 Guest user — playlist features disabled');
    return;
  }
  
  try {
    playlistManager = new window.PlaylistManager({
      supabase: window.supabaseClient,
      userId: currentUserId,
      watchLaterName: 'Watch Later',
      onPlaylistUpdated: function(data) {
        console.log('📋 Playlist updated:', data);
        // Update UI immediately
        updateWatchLaterButtonState();
      },
      onError: function(err) {
        console.error('❌ Playlist error:', err);
        showToast('Playlist error: ' + (err.error || err.message), 'error');
      }
    });
    
    // Initialize button state after manager is ready
    await updateWatchLaterButtonState();
    
    console.log('✅ PlaylistManager initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize PlaylistManager:', error);
    showToast('Watch Later unavailable', 'warning');
  }
}

// PHASE 2: Update Watch Later button state
async function updateWatchLaterButtonState() {
  const btn = document.getElementById('watchLaterBtn');
  if (!btn || !currentContent?.id || !playlistManager) {
    // Button might not exist yet — try again shortly
    if (!btn) {
      console.log('⏳ Watch Later button not in DOM yet, retrying...');
      setTimeout(updateWatchLaterButtonState, 500);
    }
    return;
  }
  
  try {
    const isInList = await playlistManager.isInWatchLater(currentContent.id);
    
    if (isInList) {
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-check"></i><span>Saved</span>';
      btn.title = 'Remove from Watch Later';
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
      btn.title = 'Add to Watch Later';
      btn.setAttribute('aria-pressed', 'false');
    }
    
  } catch (error) {
    console.error('❌ Failed to update Watch Later button:', error);
    // Default to unselected state on error
    btn.classList.remove('active');
    btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
  }
}

// PHASE 2: Handle Watch Later button click
async function handleWatchLaterToggle() {
  const btn = document.getElementById('watchLaterBtn');
  
  if (!currentContent?.id) {
    showToast('No content selected', 'error');
    return;
  }
  
  if (!currentUserId) {
    showToast('Sign in to save to Watch Later', 'warning');
    // Redirect to login with return URL
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `login.html?redirect=${redirect}`;
    return;
  }
  
  if (!playlistManager) {
    showToast('Playlist system loading...', 'info');
    return;
  }
  
  if (!btn) {
    console.error('❌ Watch Later button not found');
    return;
  }
  
  // Show loading state
  const originalHTML = btn.innerHTML;
  const originalDisabled = btn.disabled;
  
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;
  
  try {
    const result = await playlistManager.toggleWatchLater(currentContent.id);
    
    if (result.success) {
      if (result.action === 'added') {
        showToast('✅ Added to Watch Later', 'success');
      } else if (result.action === 'removed') {
        showToast('🗑️ Removed from Watch Later', 'info');
      }
      // State updated via onPlaylistUpdated callback
    } else {
      showToast('❌ ' + (result.error || 'Failed to update'), 'error');
      // Revert button state
      await updateWatchLaterButtonState();
    }
    
  } catch (error) {
    console.error('❌ Watch Later toggle failed:', error);
    showToast('Failed to update Watch Later', 'error');
    await updateWatchLaterButtonState();
    
  } finally {
    btn.disabled = originalDisabled;
    // Restore original HTML (will be updated by callback)
    setTimeout(() => updateWatchLaterButtonState(), 100);
  }
}

// PHASE 2: Setup Watch Later button event listener
function setupWatchLaterButton() {
  const watchLaterBtn = document.getElementById('watchLaterBtn');
  
  if (!watchLaterBtn) {
    console.warn('⚠️ Watch Later button not found in DOM — check HTML');
    // Retry once after short delay (in case DOM isn't fully ready)
    setTimeout(setupWatchLaterButton, 300);
    return;
  }
  
  // Remove any existing listeners by cloning
  const newBtn = watchLaterBtn.cloneNode(true);
  watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
  
  // Add click handler
  newBtn.addEventListener('click', handleWatchLaterToggle);
  
  // Add accessibility attributes
  newBtn.setAttribute('role', 'button');
  newBtn.setAttribute('aria-label', 'Add to Watch Later');
  newBtn.setAttribute('aria-pressed', 'false');
  
  console.log('✅ Watch Later button event listener attached');
}

// Authentication setup
function setupAuthListeners() {
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await window.AuthHelper.initialize();
      currentUserId = window.AuthHelper.getUserProfile()?.id || null;
      updateProfileUI();
      showToast('Welcome back!', 'success');
      
      // PHASE 1: Reload continue watching on sign in
      if (currentUserId) {
        await loadContinueWatching(currentUserId);
      }
      
      // PHASE 2: Initialize playlist manager on sign in
      if (window.PlaylistManager && !playlistManager) {
        await initializePlaylistManager();
      }
    } else if (event === 'SIGNED_OUT') {
      currentUserId = null;
      playlistManager = null; // PHASE 2: Clear playlist manager
      resetProfileUI();
      showToast('Signed out successfully', 'info');
      
      // PHASE 1: Hide continue watching on sign out
      document.getElementById('continueWatchingSection').style.display = 'none';
      
      // Clean up watch session if active
      if (watchSession) {
        watchSession.stop();
        watchSession = null;
      }
      
      // PHASE 2: Reset Watch Later button
      const watchLaterBtn = document.getElementById('watchLaterBtn');
      if (watchLaterBtn) {
        watchLaterBtn.classList.remove('active');
        watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
      }
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
// FIXED: Load content with ACCURATE counts from source tables (bypass broken triggers)
// This matches mobile app's _loadContentDetails method exactly
// ============================================
async function loadContentFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id') || '68';
  
  try {
    // 1. Load content metadata FIRST
    const { data: contentData, error: contentError } = await window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .eq('id', contentId)
      .single();
    
    if (contentError) throw contentError;
    
    // 2. COUNT VIEWS BY QUERYING content_views TABLE (bypass broken trigger)
    const { count: viewsCount, error: viewsError } = await window.supabaseClient
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId);
    
    // 3. COUNT LIKES BY QUERYING content_likes TABLE (CRITICAL FIX - matches mobile app)
    const { count: likesCount, error: likesError } = await window.supabaseClient
      .from('content_likes')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId);
    
    // PHASE 1: Get watch progress if user is authenticated
    let watchProgress = null;
    if (currentUserId) {
      const { data: progressData } = await window.supabaseClient
        .from('watch_progress')
        .select('last_position, is_completed')
        .eq('user_id', currentUserId)
        .eq('content_id', contentId)
        .maybeSingle();
      
      watchProgress = progressData;
    }
    
    // Process data with ACCURATE counts from source tables
    currentContent = {
      id: contentData.id,
      title: contentData.title || 'Untitled',
      description: contentData.description || '',
      thumbnail_url: contentData.thumbnail_url,
      file_url: contentData.file_url,
      media_type: contentData.media_type || 'video',
      genre: contentData.genre || 'General',
      created_at: contentData.created_at,
      duration: contentData.duration || contentData.duration_seconds || 3600,
      language: contentData.language || 'English',
      views_count: viewsCount || 0,   // ✅ ACCURATE COUNT FROM SOURCE
      likes_count: likesCount || 0,   // ✅ ACCURATE COUNT FROM SOURCE (FIXES MULTIPLE USERS)
      favorites_count: contentData.favorites_count || 0,
      comments_count: contentData.comments_count || 0,
      creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
      creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
      creator_id: contentData.user_profiles?.id || contentData.user_id,
      user_id: contentData.user_id,
      // PHASE 1: Add watch progress
      watch_progress: watchProgress?.last_position || 0,
      is_completed: watchProgress?.is_completed || false
    };
    
    console.log('📥 Content loaded with ACCURATE counts:', {
      views: currentContent.views_count,
      likes: currentContent.likes_count, // Now shows 2 when 2 users like it
      watch_progress: currentContent.watch_progress
    });
    
    // Update UI
    updateContentUI(currentContent);
    
    // PHASE 1: Add resume button if there's progress
    if (currentContent.watch_progress > 10 && !currentContent.is_completed) {
      addResumeButton(currentContent.watch_progress);
    }
    
    // Initialize user-specific states
    if (currentUserId) {
      await initializeLikeButton(contentId, currentUserId);
      await initializeFavoriteButton(contentId, currentUserId);
    }
    
    // PHASE 2: Initialize Watch Later button state after content is loaded
    if (playlistManager) {
      await updateWatchLaterButtonState();
    }
    
    // Load comments & related content
    await loadComments(contentId);
    await loadRelatedContent(contentId);
    
  } catch (error) {
    console.error('❌ Content load failed:', error);
    showToast('Content not available. Please try again.', 'error');
    document.getElementById('contentTitle').textContent = 'Content Unavailable';
  }
}

// PHASE 1: Add resume button to hero actions
function addResumeButton(progressSeconds) {
  const heroActions = document.querySelector('.hero-actions');
  if (!heroActions) return;
  
  // Check if resume button already exists
  if (document.getElementById('resumeBtn')) return;
  
  const resumeBtn = document.createElement('button');
  resumeBtn.id = 'resumeBtn';
  resumeBtn.className = 'btn btn-primary resume-btn';
  resumeBtn.innerHTML = `
    <i class="fas fa-play"></i>
    <span>Resume (${formatDuration(progressSeconds)})</span>
  `;
  
  resumeBtn.addEventListener('click', handlePlay);
  
  // Insert before the play button
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    heroActions.insertBefore(resumeBtn, playBtn);
    // Optionally hide the regular play button
    playBtn.style.display = 'none';
  } else {
    heroActions.prepend(resumeBtn);
  }
}

// ============================================
// CHECK IF USER HAS LIKED (using content_likes table)
// ============================================
async function checkUserLike(contentId, userId) {
  if (!userId) return false;
  
  try {
    const { data, error } = await window.supabaseClient
      .from('content_likes')
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
  
  // Update stats - ALWAYS use ACCURATE counts from source tables
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

// ============================================
// FIXED: Load related content with REAL view counts from source table
// This matches mobile app's _loadRelatedContent method exactly
// ============================================
async function loadRelatedContent(contentId) {
  try {
    // Fetch related content items
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select('id, title, thumbnail_url, user_id, genre, duration, media_type, status')
      .neq('id', contentId)
      .eq('status', 'published')
      .limit(6);
    
    if (error) throw error;
    
    // ✅ CRITICAL: Get REAL view counts for each item (like mobile app)
    const relatedWithViews = await Promise.all(
      (data || []).map(async (item) => {
        const { count: realViews } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        return { ...item, real_views_count: realViews || 0 };
      })
    );
    
    renderRelatedContent(relatedWithViews);
  } catch (error) {
    console.error('Error loading related content:', error);
    renderRelatedContent([]);
  }
}

// ============================================
// FIXED: Render related content with REAL view counts
// ============================================
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
    // ✅ USE REAL VIEW COUNT (not broken column)
    const viewsCount = item.real_views_count !== undefined ? item.real_views_count : 0;
    
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
          <span>${formatNumber(viewsCount)} views</span> <!-- ✅ REAL COUNT -->
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
    
    enhancedVideoPlayer.on('play', () => {
      console.log('▶️ Video playing...');
      
      if (window.stateManager) {
        window.stateManager.setState('session.playing', true);
      }
      
      // PHASE 1: Initialize watch session on play
      initializeWatchSessionOnPlay();
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

// PHASE 1: Initialize watch session when video plays
function initializeWatchSessionOnPlay() {
  if (!currentContent || !currentUserId || !enhancedVideoPlayer?.video) {
    console.log('⏭️ Cannot initialize watch session: missing content, user, or video');
    return;
  }
  
  // Clean up any existing session
  if (watchSession) {
    watchSession.stop();
    watchSession = null;
  }
  
  try {
    // Make sure WatchSession class is available
    if (typeof window.WatchSession === 'undefined') {
      console.warn('WatchSession not available, cannot track progress');
      return;
    }
    
    console.log('🎬 Initializing WatchSession for content:', currentContent.id);
    
    watchSession = new window.WatchSession({
      contentId: currentContent.id,
      userId: currentUserId,
      supabase: window.supabaseClient,
      videoElement: enhancedVideoPlayer.video,
      syncInterval: 10000,        // Sync every 10 seconds
      viewThreshold: 20,          // Count view after 20s watched
      completionThreshold: 0.9,   // Mark complete at 90%
      
      // Callbacks
      onProgressSync: function(data) {
        console.log('📊 Progress synced:', data);
        // Could update UI if needed
      },
      onViewCounted: function(data) {
        console.log('👁️ View counted:', data);
        // Refresh view count in UI
        refreshCountsFromSource();
      },
      onComplete: function(data) {
        console.log('🏆 Content completed:', data);
        showToast('✅ You finished this video!', 'success');
        
        // Remove resume button if it exists
        var resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) {
          resumeBtn.remove();
          // Show play button again
          var playBtn = document.getElementById('playBtn');
          if (playBtn) playBtn.style.display = 'flex';
        }
      },
      onError: function(error) {
        console.error('❌ Watch session error:', error.context, error.error);
      }
    });
    
    // Store reference for cleanup
    window._watchSession = watchSession;
    
    // Start after a short delay to ensure video is ready
    setTimeout(function() {
      if (watchSession && enhancedVideoPlayer && enhancedVideoPlayer.video) {
        watchSession.start(enhancedVideoPlayer.video);
        console.log('✅ Watch session started successfully');
      }
    }, 500);
    
  } catch (error) {
    console.error('❌ Failed to initialize watch session:', error);
  }
}

// ============================================
// FIXED: Record view in content_views table
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
// CRITICAL: Refresh counts by counting rows in source tables (bypass broken triggers)
// ============================================
async function refreshCountsFromSource() {
  if (!currentContent) return;
  
  try {
    // Re-count views from content_views table
    const { count: newViews } = await window.supabaseClient
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', currentContent.id);
    
    // Re-count likes from content_likes table
    const { count: newLikes } = await window.supabaseClient
      .from('content_likes')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', currentContent.id);
    
    // Update local state
    currentContent.views_count = newViews || 0;
    currentContent.likes_count = newLikes || 0;
    
    // Update UI
    safeSetText('viewsCount', formatNumber(newViews) + ' views');
    safeSetText('viewsCountFull', formatNumber(newViews));
    safeSetText('likesCount', formatNumber(newLikes));
    
    console.log('✅ Counts refreshed from source tables:', {
      views: newViews,
      likes: newLikes
    });
    
  } catch (error) {
    console.error('❌ Failed to refresh counts from source:', error);
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
// FIXED: Record view when Play button is clicked (like mobile app)
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
  
  // ✅ CRITICAL FIX: Record view IMMEDIATELY when Play button is clicked
  if (!hasViewedContentRecently(currentContent.id)) {
    // Optimistic UI update
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
    const newViews = currentViews + 1;
    
    if (viewsEl && viewsFullEl) {
      viewsEl.textContent = `${formatNumber(newViews)} views`;
      viewsFullEl.textContent = formatNumber(newViews);
    }
    
    // Record view in database
    recordContentView(currentContent.id)
      .then(async function(success) {
        if (success) {
          markContentAsViewed(currentContent.id);
          
          // ✅ REFRESH counts from source tables to ensure accuracy
          await refreshCountsFromSource();
          
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
      .catch(function(error) {
        console.error('View recording error:', error);
        // Revert UI on error
        if (viewsEl && viewsFullEl) {
          viewsEl.textContent = `${formatNumber(currentViews)} views`;
          viewsFullEl.textContent = formatNumber(currentViews);
        }
      });
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
  
  // PHASE 1: Clean up any existing watch session
  if (watchSession) {
    watchSession.stop();
    watchSession = null;
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
      enhancedVideoPlayer.play().catch(function(err) {
        console.error('🔴 Play failed:', err);
        showToast('Click play button in video player', 'info');
      });
    } else {
      console.log('▶️ Using native player...');
      videoElement.play().catch(function(err) {
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
      
      // PHASE 1: Stop watch session
      if (watchSession) {
        watchSession.stop();
        watchSession = null;
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
  
  // Fullscreen button handlers
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fullPlayerBtn = document.getElementById('fullPlayerBtn');

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (enhancedVideoPlayer) {
        enhancedVideoPlayer.toggleFullscreen();
      }
    });
  }

  if (fullPlayerBtn) {
    fullPlayerBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (enhancedVideoPlayer) {
        enhancedVideoPlayer.toggleFullscreen();
      }
    });
  }
  
  // ============================================
  // LIKE BUTTON - RLS-COMPLIANT (bypass broken triggers)
  // ============================================
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.addEventListener('click', async function() {
      if (!currentContent) return;
      
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
        // Optimistic UI update
        likeBtn.classList.toggle('active', !isLiked);
        likeBtn.innerHTML = !isLiked 
          ? '<i class="fas fa-heart"></i><span>Liked</span>' 
          : '<i class="far fa-heart"></i><span>Like</span>';
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(newLikes);
        }
        
        // Update database using content_likes table
        if (!isLiked) {
          // Add like
          const { error } = await window.supabaseClient
            .from('content_likes')
            .insert({
              user_id: userProfile.id,
              content_id: currentContent.id
            });
          
          if (error) throw error;
        } else {
          // Remove like
          const { error } = await window.supabaseClient
            .from('content_likes')
            .delete()
            .eq('user_id', userProfile.id)
            .eq('content_id', currentContent.id);
          
          if (error) throw error;
        }
        
        // ✅ CRITICAL: Refresh counts from SOURCE tables after like operation
        await refreshCountsFromSource();
        
        showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');
        
        if (window.track?.contentLike) {
          window.track.contentLike(currentContent.id, !isLiked);
        }
        
      } catch (error) {
        console.error('Like operation failed:', error);
        
        // Revert UI on error
        likeBtn.classList.toggle('active', isLiked);
        likeBtn.innerHTML = isLiked 
          ? '<i class="fas fa-heart"></i><span>Liked</span>' 
          : '<i class="far fa-heart"></i><span>Like</span>';
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(currentLikes);
        }
        
        showToast('Failed: ' + error.message, 'error');
      }
    });
  }
  
  // ============================================
  // FAVORITE BUTTON
  // ============================================
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async function() {
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
        
        // Refresh counts
        await refreshCountsFromSource();
        
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
  
  // ============================================
  // PHASE 2: WATCH LATER BUTTON
  // ============================================
  setupWatchLaterButton();
  
  // Refresh comments
  const refreshBtn = document.getElementById('refreshCommentsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async function() {
      if (currentContent) {
        showToast('Refreshing comments...', 'info');
        await loadComments(currentContent.id);
        showToast('Comments refreshed!', 'success');
      }
    });
  }
  
  // ============================================
  // COMMENT SUBMISSION HANDLER
  // ============================================
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
        await refreshCountsFromSource();
        
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
  
  // Back to top
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 300) {
        backToTopBtn.style.display = 'flex';
      } else {
        backToTopBtn.style.display = 'none';
      }
    });
  }
  
  // PIP button
  const pipBtn = document.getElementById('pipBtn');
  if (pipBtn) {
    pipBtn.addEventListener('click', function() {
      const video = document.getElementById('inlineVideoPlayer');
      if (video.requestPictureInPicture && document.pictureInPictureElement !== video) {
        video.requestPictureInPicture();
      }
    });
  }
  
  // ============================================
  // FIXED: SHARE BUTTON WITH BRAND IDENTITY (NO DNA, JUST RSA)
  // ============================================
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async function() {
      if (!currentContent) return;
      
      const shareText = `📺 ${currentContent.title}\n\n${currentContent.description || 'Check out this amazing content!'}\n\n👉 Watch on Bantu Stream Connect\nNO DNA, JUST RSA\n\n`;
      const shareUrl = window.location.href;
      
      try {
        if (navigator.share && navigator.canShare({ text: shareText, url: shareUrl })) {
          // ✅ NATIVE SHARE (mobile)
          await navigator.share({
            title: 'Bantu Stream Connect',
            text: shareText,
            url: shareUrl
          });
        } else {
          // ✅ FALLBACK: Copy to clipboard with brand message
          await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
          showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
          
          // Track share analytics
          if (window.track?.contentShare) {
            window.track.contentShare(currentContent.id, 'clipboard');
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          showToast('Failed to share. Try copying link manually.', 'error');
        }
      }
    });
  }
  
  // Setup connect buttons
  setupConnectButtons();
  
  console.log('✅ Event listeners setup complete');
}

// ====================================================
// SINGLE-TABLE FIX: CONNECT BUTTONS WITH CONNECTORS TABLE
// ====================================================
function setupConnectButtons() {
    // Helper to check connection status using connectors table
    function checkConnectionStatus(creatorId) {
        if (!window.AuthHelper?.isAuthenticated() || !creatorId) return false;
        
        var userProfile = window.AuthHelper.getUserProfile();
        if (!userProfile?.id) return false;
        
        return window.supabaseClient
            .from('connectors')
            .select('id')
            .eq('connector_id', userProfile.id)
            .eq('connected_id', creatorId)
            .single()
            .then(function(result) {
                return !result.error && result.data !== null;
            })
            .catch(function() {
                return false;
            });
    }
    
    // PLAYER CONNECT BUTTON
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn && currentContent?.creator_id) {
        // Check initial connection status
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                var shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            var userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }
            
            var isConnected = connectBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    // Disconnect - remove from connectors table
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    
                    if (error) throw error;
                    
                    connectBtn.classList.remove('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    // Connect - add to connectors table
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    
                    if (error) throw error;
                    
                    connectBtn.classList.add('connected');
                    connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                    
                    // Track analytics
                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }
    
    // CREATOR SECTION CONNECT BUTTON
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectCreatorBtn && currentContent?.creator_id) {
        // Check initial connection status
        checkConnectionStatus(currentContent.creator_id).then(function(isConnected) {
            if (isConnected) {
                connectCreatorBtn.classList.add('connected');
                connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
            }
        });
        
        connectCreatorBtn.addEventListener('click', async function() {
            if (!window.AuthHelper?.isAuthenticated?.()) {
                var shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
                if (shouldLogin) {
                    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }
                return;
            }
            
            var userProfile = window.AuthHelper.getUserProfile();
            if (!userProfile?.id) {
                showToast('User profile not found', 'error');
                return;
            }
            
            var isConnected = connectCreatorBtn.classList.contains('connected');
            
            try {
                if (isConnected) {
                    // Disconnect
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .delete()
                        .eq('connector_id', userProfile.id)
                        .eq('connected_id', currentContent.creator_id);
                    
                    if (error) throw error;
                    
                    connectCreatorBtn.classList.remove('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
                    showToast('Disconnected', 'info');
                } else {
                    // Connect
                    var { error } = await window.supabaseClient
                        .from('connectors')
                        .insert({
                            connector_id: userProfile.id,
                            connected_id: currentContent.creator_id,
                            connection_type: 'creator'
                        });
                    
                    if (error) throw error;
                    
                    connectCreatorBtn.classList.add('connected');
                    connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
                    showToast('Connected successfully!', 'success');
                    
                    if (window.track?.userConnect) {
                        window.track.userConnect(currentContent.creator_id);
                    }
                }
            } catch (error) {
                console.error('Connection update failed:', error);
                showToast('Failed to update connection', 'error');
            }
        });
    }
}

// ===================================================================
// MODAL & PANEL SYSTEMS (Analytics, Search, Notifications, Theme)
// ===================================================================

// ======================
// ANALYTICS MODAL
// ======================
function initAnalyticsModal() {
  const analyticsBtn = document.getElementById('analytics-btn');
  const analyticsModal = document.getElementById('analytics-modal');
  const closeAnalytics = document.getElementById('close-analytics');
  
  if (!analyticsBtn || !analyticsModal) return;
  
  analyticsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    analyticsModal.classList.add('active');
    loadContentAnalytics();
  });
  
  if (closeAnalytics) {
    closeAnalytics.addEventListener('click', function() {
      analyticsModal.classList.remove('active');
    });
  }
  
  analyticsModal.addEventListener('click', function(e) {
    if (e.target === analyticsModal) {
      analyticsModal.classList.remove('active');
    }
  });
}

async function loadContentAnalytics() {
  if (!currentContent) return;
  
  try {
    // Get view stats
    const { data: viewsData } = await window.supabaseClient
      .from('content_views')
      .select('id, viewed_at')
      .eq('content_id', currentContent.id)
      .order('viewed_at', { ascending: false })
      .limit(100);
    
    // Get comment stats
    const { data: commentsData } = await window.supabaseClient
      .from('comments')
      .select('id, created_at')
      .eq('content_id', currentContent.id);
    
    // Calculate metrics
    const totalViews = viewsData?.length || 0;
    const totalComments = commentsData?.length || 0;
    
    // Update UI
    document.getElementById('content-total-views').textContent = formatNumber(totalViews);
    document.getElementById('total-comments').textContent = formatNumber(totalComments);
    
    // Simulate engagement metrics (would come from analytics system)
    document.getElementById('avg-watch-time').textContent = '4m 23s';
    document.getElementById('engagement-rate').textContent = '68%';
    
    // Set trends (simulated)
    document.getElementById('views-trend').textContent = '+12%';
    document.getElementById('comments-trend').textContent = '+8%';
    document.getElementById('watch-time-trend').textContent = '+5%';
    document.getElementById('engagement-trend').textContent = '+3%';
    
    // Initialize chart if Chart.js is available
    if (typeof Chart !== 'undefined') {
      initEngagementChart();
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

function initEngagementChart() {
  const ctx = document.getElementById('content-engagement-chart');
  if (!ctx) return;
  
  // Destroy existing chart if exists
  if (window.contentEngagementChart) {
    window.contentEngagementChart.destroy();
  }
  
  window.contentEngagementChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Views',
        data: [65, 59, 80, 81, 56, 55, 40],
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true
      }, {
        label: 'Comments',
        data: [28, 48, 40, 19, 86, 27, 90],
        borderColor: '#1D4ED8',
        backgroundColor: 'rgba(29, 78, 216, 0.1)',
        tension: 0.4,
        fill: true
      }]
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
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: 'var(--slate-grey)' }
        }
      }
    }
  });
}

// ======================
// SEARCH MODAL
// ======================
function initSearchModal() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  
  if (!searchBtn || !searchModal) return;
  
  searchBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    searchModal.classList.add('active');
    setTimeout(function() {
      if (searchInput) searchInput.focus();
    }, 300);
  });
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', function() {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    });
  }
  
  searchModal.addEventListener('click', function(e) {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    }
  });
  
  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async function(e) {
      var query = e.target.value.trim();
      var category = document.getElementById('category-filter')?.value;
      var sortBy = document.getElementById('sort-filter')?.value;
      
      if (query.length < 2) {
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Start typing to search...</div>';
        return;
      }
      
      document.getElementById('search-results-grid').innerHTML = 
          '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
      
      try {
        var results = await searchContent(query, category, sortBy);
        renderSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Error searching. Please try again.</div>';
      }
    }, 300));
  }
  
  // Filter change handlers
  var categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', triggerSearch);
  }
  
  var sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', triggerSearch);
  }
}

function debounce(func, wait) {
  var timeout;
  return function executedFunction() {
    var args = arguments;
    var later = function() {
      clearTimeout(timeout);
      func.apply(null, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function triggerSearch() {
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    var event = new Event('input');
    searchInput.dispatchEvent(event);
  }
}

// ============================================
// FIXED: Search content with REAL view counts from source table
// ============================================
async function searchContent(query, category, sortBy) {
  try {
    var orderBy = 'created_at';
    var order = 'desc';
    
    if (sortBy === 'popular') {
      orderBy = 'views_count';
    } else if (sortBy === 'trending') {
      orderBy = 'likes_count';
    }
    
    var queryBuilder = window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .ilike('title', `%${query}%`)
      .eq('status', 'published')
      .order(orderBy, { ascending: order === 'asc' })
      .limit(20);
    
    if (category) {
      queryBuilder = queryBuilder.eq('genre', category);
    }
    
    var { data, error } = await queryBuilder;
    
    if (error) throw error;
    
    // ✅ ENRICH SEARCH RESULTS WITH REAL VIEW COUNTS (like mobile app)
    var enrichedResults = await Promise.all(
      (data || []).map(async function(item) {
        var { count: realViews } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        return Object.assign({}, item, { real_views_count: realViews || 0 });
      })
    );
    
    return enrichedResults || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// ============================================
// FIXED: Render search results with REAL view counts
// ============================================
function renderSearchResults(results) {
  var grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(function(item) {
    var creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
    // ✅ USE REAL VIEW COUNT
    var viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
    
    return `
      <div class="content-card" data-content-id="${item.id}">
        <div class="card-thumbnail">
          <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
               alt="${item.title}" 
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          <div class="thumbnail-overlay"></div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(item.title, 45)}</h3>
          <div class="related-meta">
            <i class="fas fa-eye"></i>
            <span>${formatNumber(viewsCount)} views</span> <!-- ✅ REAL COUNT -->
          </div>
          <button class="creator-btn" data-creator-id="${item.user_id}" data-creator-name="${creator}">
            <i class="fas fa-user"></i>
            ${truncateText(creator, 15)}
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  grid.querySelectorAll('.content-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.creator-btn')) return;
      var id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
  
  grid.querySelectorAll('.creator-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = btn.dataset.creatorId;
      var name = btn.dataset.creatorName;
      if (id) window.location.href = `creator-channel.html?id=${id}&name=${encodeURIComponent(name)}`;
    });
  });
}

// ======================
// NOTIFICATIONS PANEL
// ======================
function initNotificationsPanel() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const navNotificationsBtn = document.getElementById('nav-notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  // Both notification buttons should open the panel
  if (notificationsBtn) {
    notificationsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationsPanel.classList.add('active');
      loadUserNotifications();
      markAllNotificationsAsRead();
    });
  }
  
  if (navNotificationsBtn) {
    navNotificationsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationsPanel.classList.add('active');
      loadUserNotifications();
      markAllNotificationsAsRead();
    });
  }
  
  if (closeNotifications) {
    closeNotifications.addEventListener('click', function() {
      notificationsPanel.classList.remove('active');
    });
  }
  
  // Close when clicking outside
  document.addEventListener('click', function(e) {
    if (notificationsPanel.classList.contains('active') && 
        !notificationsPanel.contains(e.target) && 
        !notificationsBtn.contains(e.target) && 
        (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
      notificationsPanel.classList.remove('active');
    }
  });
  
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async function() {
      await markAllNotificationsAsRead();
      await loadUserNotifications();
    });
  }
  
  // Load notifications on page load if user is authenticated
  if (window.AuthHelper?.isAuthenticated()) {
    loadUserNotifications();
    updateNotificationBadge();
  }
  
  // Listen for auth changes
  document.addEventListener('authReady', loadUserNotifications);
}

async function loadUserNotifications() {
  var notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  try {
    // Check authentication
    if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>Sign in to see notifications</p>
        </div>
      `;
      updateNotificationBadge(0);
      return;
    }
    
    var userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-exclamation-triangle"></i>
          <p>User profile not found</p>
        </div>
      `;
      return;
    }
    
    // Fetch notifications from Supabase
    var { data, error } = await window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;
      updateNotificationBadge(0);
      return;
    }
    
    // Render notifications
    notificationsList.innerHTML = data.map(function(notification) {
      return `
        <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
          <div class="notification-icon">
            <i class="${getNotificationIcon(notification.type)}"></i>
          </div>
          <div class="notification-content">
            <h4>${escapeHtml(notification.title)}</h4>
            <p>${escapeHtml(notification.message)}</p>
            <span class="notification-time">${formatNotificationTime(notification.created_at)}</span>
          </div>
          ${!notification.is_read ? '<div class="notification-dot"></div>' : ''}
        </div>
      `;
    }).join('');
    
    // Add click handlers
    notificationsList.querySelectorAll('.notification-item').forEach(function(item) {
      item.addEventListener('click', async function() {
        var id = item.dataset.id;
        await markNotificationAsRead(id);
        
        // Handle navigation based on notification type
        var notification = data.find(function(n) { return n.id === id; });
        if (notification?.content_id) {
          window.location.href = `content-detail.html?id=${notification.content_id}`;
        }
        notificationsPanel.classList.remove('active');
      });
    });
    
    // Update badge count
    var unreadCount = data.filter(function(n) { return !n.is_read; }).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading notifications</p>
      </div>
    `;
  }
}

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

async function markNotificationAsRead(notificationId) {
  try {
    var { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    
    // Update UI immediately
    var item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.classList.add('read');
      var dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    }
    
    // Update badge
    await loadUserNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  try {
    if (!window.AuthHelper?.isAuthenticated()) return;
    
    var userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) return;
    
    var { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userProfile.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    // Update UI
    document.querySelectorAll('.notification-item.unread').forEach(function(item) {
      item.classList.remove('unread');
      item.classList.add('read');
      var dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    });
    
    updateNotificationBadge(0);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

function updateNotificationBadge(count) {
  // If count not provided, calculate from DOM
  if (count === undefined || count === null) {
    count = document.querySelectorAll('.notification-item.unread').length;
  }
  
  var mainBadge = document.getElementById('notification-count');
  var navBadge = document.getElementById('nav-notification-count');
  
  if (mainBadge) {
    mainBadge.textContent = count > 99 ? '99+' : count;
    mainBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  if (navBadge) {
    navBadge.textContent = count > 99 ? '99+' : count;
    navBadge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function formatNotificationTime(timestamp) {
  var now = new Date();
  var diffMs = now - new Date(timestamp);
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

// ======================
// FIXED: THEME SELECTOR - COMPLETE OVERHAUL - No conflict with ThemeSystem
// ======================
function initThemeSelector() {
  console.log('🎨 Initializing theme selector...');
  
  const themeToggle = document.getElementById('nav-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  var themeOptions = document.querySelectorAll('.theme-option');
  
  if (!themeToggle) {
    console.warn('Theme toggle button not found');
    return;
  }
  
  if (!themeSelector) {
    console.warn('Theme selector panel not found');
    return;
  }
  
  console.log('✅ Theme selector elements found');
  
  // Remove any existing listeners by cloning and replacing
  var newThemeToggle = themeToggle.cloneNode(true);
  themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
  
  // Toggle theme selector on click
  newThemeToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('🎨 Theme toggle clicked');
    themeSelector.classList.toggle('active');
  });
  
  // Close when clicking outside
  document.addEventListener('click', function(e) {
    if (themeSelector.classList.contains('active') && 
        !themeSelector.contains(e.target) && 
        !newThemeToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
  
  // Set up theme options
  if (themeOptions.length > 0) {
    themeOptions.forEach(function(option) {
      // Remove existing listeners
      var newOption = option.cloneNode(true);
      option.parentNode.replaceChild(newOption, option);
      
      newOption.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var theme = newOption.dataset.theme;
        console.log('🎨 Theme selected:', theme);
        applyTheme(theme);
        themeSelector.classList.remove('active');
      });
    });
  } else {
    console.warn('No theme options found');
  }
  
  // Initialize theme
  initCurrentTheme();
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// ============================================
// FIXED: applyTheme - Complete rewrite with forced repaint
// ============================================
function applyTheme(theme) {
  console.log('🎨 Applying theme:', theme);
  
  // Validate theme
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    console.warn('Invalid theme:', theme, 'defaulting to dark');
    theme = 'dark';
  }
  
  // CRITICAL FIX: Remove ALL theme classes first
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  
  // Add the new theme class
  document.body.classList.add('theme-' + theme);
  
  // Save to localStorage
  localStorage.setItem('theme', theme);
  
  // Update active state on theme options
  document.querySelectorAll('.theme-option').forEach(function(option) {
    var isActive = option.dataset.theme === theme;
    if (isActive) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  
  // FORCE REPAINT - Multiple techniques for cross-browser compatibility
  document.body.style.display = 'none';
  document.body.offsetHeight; // Force reflow
  document.body.style.display = '';
  
  // Also force repaint on theme selector if active
  var themeSelector = document.getElementById('theme-selector');
  if (themeSelector) {
    themeSelector.style.display = 'none';
    themeSelector.offsetHeight;
    themeSelector.style.display = '';
  }
  
  // Update CSS custom properties if needed
  updateThemeCSSVariables(theme);
  
  showToast('Theme changed to ' + theme, 'success');
  console.log('✅ Theme applied successfully:', theme);
}

// ============================================
// NEW: Update CSS variables based on theme
// ============================================
function updateThemeCSSVariables(theme) {
  var root = document.documentElement;
  
  // Ensure theme CSS variables are applied
  if (theme === 'light') {
    root.style.setProperty('--deep-black', '#F8FAFC');
    root.style.setProperty('--deep-navy', '#FFFFFF');
    root.style.setProperty('--soft-white', '#0F172A');
    root.style.setProperty('--slate-grey', '#64748B');
    root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
    root.style.setProperty('--card-border', 'rgba(100, 116, 139, 0.2)');
  } else if (theme === 'high-contrast') {
    root.style.setProperty('--deep-black', '#000000');
    root.style.setProperty('--deep-navy', '#111827');
    root.style.setProperty('--soft-white', '#FFFFFF');
    root.style.setProperty('--slate-grey', '#E5E7EB');
    root.style.setProperty('--card-bg', 'rgba(17, 24, 39, 0.95)');
    root.style.setProperty('--card-border', '#FFFFFF');
  } else {
    // Dark theme (default)
    root.style.setProperty('--deep-black', '#0A0E12');
    root.style.setProperty('--deep-navy', '#0F172A');
    root.style.setProperty('--soft-white', '#F8FAFC');
    root.style.setProperty('--slate-grey', '#94A3B8');
    root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
    root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
  }
}

// ============================================
// FIXED: initCurrentTheme - Load and apply saved theme
// ============================================
function initCurrentTheme() {
  console.log('🎨 Initializing current theme...');
  
  // Get saved theme from localStorage
  var savedTheme = localStorage.getItem('theme');
  
  // Check for system preference if no saved theme
  if (!savedTheme) {
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    savedTheme = prefersDark ? 'dark' : 'light';
    console.log('🎨 Using system theme preference:', savedTheme);
  }
  
  // Validate theme
  if (savedTheme !== 'dark' && savedTheme !== 'light' && savedTheme !== 'high-contrast') {
    console.warn('Invalid saved theme:', savedTheme, 'defaulting to dark');
    savedTheme = 'dark';
  }
  
  // Apply the theme
  applyTheme(savedTheme);
  
  // Set active indicator on theme options
  setTimeout(function() {
    document.querySelectorAll('.theme-option').forEach(function(option) {
      if (option.dataset.theme === savedTheme) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }, 100);
  
  console.log('✅ Current theme initialized:', savedTheme);
}

// ======================
// GLOBAL NAVIGATION - FIXED: Clean event listeners and centered icons
// ======================
function initGlobalNavigation() {
  // Home button - redirect to home-feed
  var homeBtn = document.querySelector('.nav-icon:nth-child(1)');
  if (homeBtn) {
    // Remove existing listeners
    var newHomeBtn = homeBtn.cloneNode(true);
    homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
    
    newHomeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = 'https://bantustreamconnect.com/';
    });
  }
  
  // Theme toggle is already handled in initThemeSelector
  // Don't add duplicate listeners here
  
  // Create Content button
  var createBtn = document.querySelector('.nav-icon:nth-child(3)');
  if (createBtn) {
    var newCreateBtn = createBtn.cloneNode(true);
    createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
    
    newCreateBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = 'login.html?redirect=creator-upload.html';
      }
    });
  }
  
  // Creator Dashboard button
  var dashboardBtn = document.querySelector('.nav-icon:nth-child(4)');
  if (dashboardBtn) {
    var newDashboardBtn = dashboardBtn.cloneNode(true);
    dashboardBtn.parentNode.replaceChild(newDashboardBtn, dashboardBtn);
    
    newDashboardBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-dashboard.html';
      } else {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = 'login.html?redirect=creator-dashboard.html';
      }
    });
  }
  
  // Notifications button is handled in initNotificationsPanel
}

// ============================================
// PHASE 1: CONTINUE WATCHING — LOAD & RENDER
// ============================================

async function loadContinueWatching(userId, limit) {
  if (limit === undefined) limit = 8;
  
  var section = document.getElementById('continueWatchingSection');
  if (!section) return;
  
  if (!userId || !window.supabaseClient) {
    section.style.display = 'none';
    return;
  }
  
  try {
    var { data, error } = await window.supabaseClient
      .from('watch_progress')
      .select(`
        content_id,
        last_position,
        is_completed,
        updated_at,
        Content (
          id,
          title,
          thumbnail_url,
          genre,
          duration,
          status,
          user_profiles!user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .neq('last_position', 0)
      .eq('Content.status', 'published')
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    renderContinueWatching(data);
    section.style.display = 'block';
    
  } catch (error) {
    console.error('❌ Failed to load continue watching:', error);
    section.style.display = 'none';
  }
}

function renderContinueWatching(items) {
  var container = document.getElementById('continueGrid');
  if (!container) return;
  
  container.innerHTML = items.map(function(item) {
    var content = item.Content;
    if (!content) return ''; // Skip if content was deleted
    
    var progress = content.duration > 0 
      ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
      : 0;
    
    var timeWatched = formatDuration(item.last_position);
    var totalTime = formatDuration(content.duration);
    
    // Fix media URLs
    var thumbnailUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url) 
      || content.thumbnail_url 
      || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    var creatorName = content.user_profiles?.full_name 
      || content.user_profiles?.username 
      || 'Creator';
    
    return `
      <a href="content-detail.html?id=${content.id}" class="content-card continue-card" data-content-id="${content.id}">
        <div class="card-thumbnail">
          <img src="${thumbnailUrl}" 
               alt="${escapeHtml(content.title)}"
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          
          <div class="progress-bar-overlay">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          
          <div class="resume-badge">
            <i class="fas fa-play"></i> Resume
          </div>
        </div>
        
        <div class="card-content">
          <h3 class="card-title">${truncateText(content.title, 45)}</h3>
          
          <div class="related-meta">
            <span>${timeWatched} / ${totalTime}</span>
          </div>
          
          <div class="creator-chip">
            <i class="fas fa-user"></i>
            ${truncateText(creatorName, 20)}
          </div>
        </div>
      </a>
    `;
  }).join('');
  
  // Add click tracking (optional)
  container.querySelectorAll('.continue-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (window.track?.continueWatchingClick) {
        var contentId = card.dataset.contentId;
        window.track.continueWatchingClick(contentId);
      }
    });
  });
}

// PHASE 1: Refresh button handler
function setupContinueWatchingRefresh() {
  var refreshBtn = document.getElementById('refreshContinueBtn');
  if (!refreshBtn) return;
  
  refreshBtn.addEventListener('click', async function() {
    if (!currentUserId) return;
    
    showToast('Refreshing...', 'info');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
      await loadContinueWatching(currentUserId);
      showToast('Updated!', 'success');
    } catch (error) {
      console.error('Refresh failed:', error);
      showToast('Refresh failed', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fas fa-redo"></i>';
    }
  });
}

// Utility functions
function safeSetText(id, text) {
  var el = document.getElementById(id);
  if (el) {
    el.textContent = text || '';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return '-';
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || isNaN(seconds)) {
    return '0m 0s';
  }
  
  seconds = Math.floor(seconds);
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;
  
  if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  } else if (minutes > 0) {
    return minutes + 'm ' + secs + 's';
  } else {
    return secs + 's';
  }
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatCommentTime(timestamp) {
  if (!timestamp) return 'Just now';
  try {
    var date = new Date(timestamp);
    var now = new Date();
    var diffMs = now - date;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + ' hour' + (diffHours !== 1 ? 's' : '') + ' ago';
    if (diffDays < 7) return diffDays + ' day' + (diffDays !== 1 ? 's' : '') + ' ago';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Recently';
  }
}

function showToast(message, type) {
  if (type === undefined) type = 'info';
  
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icons = {
    error: 'fas fa-exclamation-triangle',
    success: 'fas fa-check-circle',
    warning: 'fas fa-exclamation-circle',
    info: 'fas fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="${icons[type] || 'fas fa-info-circle'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(function() {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// Export key functions for VideoPlayerFeatures
window.hasViewedContentRecently = hasViewedContentRecently;
window.markContentAsViewed = markContentAsViewed;
window.recordContentView = recordContentView;
window.refreshCountsFromSource = refreshCountsFromSource;
window.clearViewCache = clearViewCache;

// PHASE 1: Page unload handler - clean up watch session
window.addEventListener('beforeunload', function() {
  if (watchSession) {
    watchSession.stop();
  }
  if (window._watchSession) {
    window._watchSession.stop();
  }
});

console.log('✅ Content detail script loaded with PHASE 1 WATCH SESSION integration - Views recorded on Play button click (matches mobile app)');
