// js/content-detail.js - FIXED FOR RLS POLICIES - WITH ACCURATE COUNT BYPASS - VIEWS RECORDED ON PLAY BUTTON CLICK (LIKE MOBILE APP)
// FIXED: Theme selector conflict resolved, navigation icons properly aligned
// PHASE 1 UPDATE: Watch Session Lifecycle Integration with syntax-safe WatchSession
// PHASE 2 UPDATE: Watch Later & Playlist System Integration
// PHASE 3 UPDATE: Complete Recommendation Engine Integration
// PHASE 4 UPDATE: HLS Streaming & Quality Selector Integration
// FIXED: Added video load confirmation events
// PHASE 1-3 POLISH: Keyboard Shortcuts, Playlist Modal, Loading States

console.log('🎬 Content Detail Initializing with RLS-compliant fixes and view tracking on Play button click...');

// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let watchSession = null; // PHASE 1: Watch session instance
let playlistManager = null; // PHASE 2: Playlist manager instance
let recommendationEngine = null; // PHASE 3: Recommendation engine instance
let streamingManager = null; // PHASE 4: Streaming manager instance
let keyboardShortcuts = null; // PHASE 1 POLISH: Keyboard shortcuts
let playlistModal = null; // PHASE 2 POLISH: Playlist modal
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
  
  // Initialize streaming manager (PHASE 4)
  await initializeStreamingManager();
  
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
  
  // ============================================
  // PHASE 3: Initialize Recommendation Engine
  // ============================================
  if (currentContent?.id) {
    await initializeRecommendationEngine();
  }
  
  // ============================================
  // PHASE 1 POLISH: Initialize keyboard shortcuts after video player
  // ============================================
  setTimeout(() => {
    if (enhancedVideoPlayer?.video) {
      initializeKeyboardShortcuts();
    }
  }, 1000);
  
  // ============================================
  // PHASE 2 POLISH: Initialize playlist modal
  // ============================================
  if (currentUserId && currentContent?.id) {
    setTimeout(() => {
      initializePlaylistModal();
    }, 500);
  }
  
  // Show app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  console.log('✅ Content Detail fully initialized with RLS-compliant fixes and PHASE 4 Streaming');
});

// PHASE 1: Import WatchSession class
if (!window.WatchSession) {
  console.warn('⚠️ WatchSession not loaded, will attempt to load dynamically');
  const script = document.createElement('script');
  script.src = 'js/watch-session.js';
  document.head.appendChild(script);
}

// PHASE 2: Import PlaylistManager class
if (!window.PlaylistManager) {
  console.warn('⚠️ PlaylistManager not loaded, will attempt to load dynamically');
  const script = document.createElement('script');
  script.src = 'js/playlist-manager.js';
  document.head.appendChild(script);
}

// PHASE 3: Import RecommendationEngine class
if (!window.RecommendationEngine) {
  console.warn('⚠️ RecommendationEngine not loaded, will attempt to load dynamically');
  const script = document.createElement('script');
  script.src = 'js/recommendation-engine.js';
  document.head.appendChild(script);
}

// PHASE 4: Import StreamingManager class
if (!window.StreamingManager) {
  console.warn('⚠️ StreamingManager not loaded, will attempt to load dynamically');
  const script = document.createElement('script');
  script.src = 'js/streaming-manager.js';
  document.head.appendChild(script);
}

// ============================================
// PHASE 1 POLISH: Initialize Keyboard Shortcuts
// ============================================
function initializeKeyboardShortcuts() {
  if (!window.KeyboardShortcuts) {
    console.warn('⚠️ KeyboardShortcuts not loaded yet');
    return;
  }
  
  if (!enhancedVideoPlayer?.video) {
    console.warn('⚠️ Video player not ready for keyboard shortcuts');
    return;
  }
  
  try {
    keyboardShortcuts = new window.KeyboardShortcuts({
      videoElement: enhancedVideoPlayer.video,
      supabaseClient: window.supabaseClient,
      contentId: currentContent?.id
    });
    
    window.keyboardShortcuts = keyboardShortcuts;
    console.log('✅ Keyboard shortcuts initialized');
  } catch (error) {
    console.error('❌ Failed to initialize keyboard shortcuts:', error);
  }
}

// ============================================
// PHASE 2 POLISH: Initialize Playlist Modal
// ============================================
function initializePlaylistModal() {
  if (!window.PlaylistModal) {
    console.warn('⚠️ PlaylistModal not loaded yet');
    return;
  }
  
  if (!currentUserId || !currentContent?.id) {
    console.warn('⚠️ Cannot initialize playlist modal: missing user or content');
    return;
  }
  
  try {
    playlistModal = new window.PlaylistModal({
      supabase: window.supabaseClient,
      userId: currentUserId,
      contentId: currentContent.id
    });
    
    window.playlistModal = playlistModal;
    
    // Update Watch Later button to open modal
    const watchLaterBtn = document.getElementById('watchLaterBtn');
    if (watchLaterBtn) {
      // Clone to remove existing listeners
      const newBtn = watchLaterBtn.cloneNode(true);
      watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
      
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUserId) {
          showToast('Please sign in to use playlists', 'warning');
          const redirect = encodeURIComponent(window.location.href);
          window.location.href = `login.html?redirect=${redirect}`;
          return;
        }
        playlistModal.open();
      });
    }
    
    console.log('✅ Playlist modal initialized');
  } catch (error) {
    console.error('❌ Failed to initialize playlist modal:', error);
  }
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
        updateWatchLaterButtonState();
      },
      onError: function(err) {
        console.error('❌ Playlist error:', err);
        showToast('Playlist error: ' + (err.error || err.message), 'error');
      }
    });
    
    await updateWatchLaterButtonState();
    console.log('✅ PlaylistManager initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize PlaylistManager:', error);
    showToast('Watch Later unavailable', 'warning');
  }
}

// ============================================
// PHASE 3: RECOMMENDATION ENGINE INITIALIZATION
// ============================================
async function initializeRecommendationEngine() {
  if (!window.RecommendationEngine) {
    console.warn('⚠️ RecommendationEngine not loaded');
    return;
  }
  
  if (!currentContent?.id) {
    console.warn('⚠️ No content loaded for recommendations');
    return;
  }
  
  try {
    recommendationEngine = new window.RecommendationEngine({
      supabase: window.supabaseClient,
      userId: currentUserId,
      currentContentId: currentContent.id,
      limit: 8,
      minWatchThreshold: 0.5,
      cacheDuration: 60000
    });
    
    await loadRecommendationRails();
    console.log('✅ RecommendationEngine initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize RecommendationEngine:', error);
  }
}

// ============================================
// PHASE 4: STREAMING MANAGER INITIALIZATION
// ============================================
async function initializeStreamingManager() {
  if (!window.StreamingManager) {
    console.warn('⚠️ StreamingManager not loaded');
    return;
  }
  
  const videoElement = document.getElementById('inlineVideoPlayer');
  if (!videoElement) return;
  
  try {
    streamingManager = new window.StreamingManager({
      videoElement: videoElement,
      supabaseClient: window.supabaseClient,
      contentId: currentContent?.id,
      userId: currentUserId,
      onQualityChange: function(data) {
        console.log('📺 Quality changed:', data);
        showToast('Quality: ' + data.quality, 'info');
      },
      onDataSaverToggle: function(data) {
        console.log('💾 Data saver:', data.enabled ? 'ON' : 'OFF');
        showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
      },
      onError: function(err) {
        console.error('❌ Streaming error:', err);
      }
    });
    
    await streamingManager.initialize();
    
    setupQualitySelector();
    setupDataSaverToggle();
    
    console.log('✅ StreamingManager initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize StreamingManager:', error);
  }
}

// PHASE 4: Setup quality selector UI
function setupQualitySelector() {
  const qualityOptions = document.querySelectorAll('.quality-option');
  if (!qualityOptions.length) return;
  
  qualityOptions.forEach(btn => {
    btn.addEventListener('click', async function() {
      const quality = this.dataset.quality;
      
      qualityOptions.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      if (streamingManager) {
        await streamingManager.setQuality(quality);
      }
      
      const settingsMenu = document.querySelector('.settings-menu');
      if (settingsMenu) {
        settingsMenu.style.display = 'none';
      }
    });
  });
}

// PHASE 4: Setup data saver toggle
function setupDataSaverToggle() {
  const toggle = document.getElementById('dataSaverToggle');
  if (!toggle) return;
  
  if (streamingManager?.isDataSaverEnabled()) {
    toggle.checked = true;
  }
  
  toggle.addEventListener('change', async function() {
    if (streamingManager) {
      streamingManager.toggleDataSaver(this.checked);
    }
  });
}

// ============================================
// PHASE 3 POLISH: Load all recommendation rails with loading states
// ============================================
async function loadRecommendationRails() {
  if (!recommendationEngine) return;
  
  const railConfigs = [
    {
      type: recommendationEngine.TYPES.CONTINUE_WATCHING,
      containerId: 'continueWatchingRail',
      title: 'Continue Watching',
      options: { limit: 6 }
    },
    {
      type: recommendationEngine.TYPES.BECAUSE_YOU_WATCHED,
      containerId: 'becauseYouWatchedRail',
      title: 'Because You Watched',
      options: { limit: 8 }
    },
    {
      type: recommendationEngine.TYPES.MORE_FROM_CREATOR,
      containerId: 'moreFromCreatorRail',
      title: 'More From This Creator',
      options: { 
        creatorId: currentContent?.user_id,
        excludeContentId: currentContent?.id,
        limit: 6 
      }
    }
  ];
  
  // Show skeleton loaders for each rail
  railConfigs.forEach(config => {
    showRailSkeleton(config.containerId);
  });
  
  const results = await recommendationEngine.getMultipleRails(railConfigs);
  
  results.forEach(({ type, results: items }) => {
    const config = railConfigs.find(r => r.type === type);
    if (config && items?.length > 0) {
      renderRecommendationRail(config.containerId, config.title, items);
    } else if (config) {
      showRailEmpty(config.containerId, config.title);
    }
  });
}

// PHASE 3 POLISH: Show skeleton loader for rail
function showRailSkeleton(containerId) {
  const section = document.getElementById(containerId);
  if (!section) return;
  
  section.style.display = 'block';
  
  if (!section.querySelector('.section-header')) {
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Loading...</h2>
      </div>
      <div class="content-grid" id="${containerId}-grid">
        ${Array(6).fill().map(() => `
          <div class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-creator"></div>
            <div class="skeleton-stats"></div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// PHASE 3 POLISH: Show empty state for rail
function showRailEmpty(containerId, title) {
  const section = document.getElementById(containerId);
  if (!section) return;
  
  section.style.display = 'block';
  
  const grid = section.querySelector('.content-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
      <div class="empty-icon">
        <i class="fas fa-magic" style="font-size: 48px; color: var(--slate-grey); opacity: 0.5;"></i>
      </div>
      <h3 style="color: var(--soft-white); margin: 15px 0 10px;">No ${title}</h3>
      <p style="color: var(--slate-grey); font-size: 14px;">
        ${title === 'Continue Watching' ? 'Start watching content to pick up where you left off' : 
          title === 'Because You Watched' ? 'Watch more content to get personalized recommendations' :
          'Check back later for more content'}
      </p>
      ${title === 'Because You Watched' ? `
        <button class="btn btn-secondary" onclick="document.getElementById('relatedGrid').scrollIntoView({behavior:'smooth'})" style="margin-top: 15px;">
          Browse Related Content
        </button>
      ` : ''}
    </div>
  `;
}

// PHASE 3: Render a single recommendation rail
function renderRecommendationRail(containerId, title, items) {
  const section = document.getElementById(containerId);
  if (!section) return;
  
  if (!section.querySelector('.section-header')) {
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">${title}</h2>
      </div>
      <div class="content-grid" id="${containerId}-grid"></div>
    `;
  }
  
  const grid = section.querySelector('.content-grid');
  if (!grid) return;
  
  grid.innerHTML = items.map(item => {
    const progress = item.watch_progress ? 
      Math.min(100, Math.round((item.watch_progress.last_position / (item.duration || 3600)) * 100)) 
      : null;
    
    const viewsCount = item.real_views_count !== undefined ? item.real_views_count : (item.views_count || 0);
    
    return `
      <a href="content-detail.html?id=${item.id}" class="content-card recommendation-card">
        <div class="card-thumbnail">
          <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}" 
               alt="${item.title}"
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          ${progress ? `
            <div class="progress-bar-overlay">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
            <div class="resume-badge">
              <i class="fas fa-play"></i> Resume
            </div>
          ` : ''}
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(item.title, 45)}</h3>
          <div class="related-meta">
            <i class="fas fa-eye"></i>
            <span>${formatNumber(viewsCount)} views</span>
          </div>
          ${item.user_profiles?.full_name ? `
            <div class="creator-chip">
              <i class="fas fa-user"></i>
              ${truncateText(item.user_profiles.full_name, 15)}
            </div>
          ` : ''}
        </div>
      </a>
    `;
  }).join('');
  
  section.style.display = 'block';
}

// PHASE 2: Update Watch Later button state
async function updateWatchLaterButtonState() {
  const btn = document.getElementById('watchLaterBtn');
  if (!btn || !currentContent?.id || !playlistManager) {
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
    btn.classList.remove('active');
    btn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
  }
}

// PHASE 2: Handle Watch Later button click (legacy, replaced by modal)
async function handleWatchLaterToggle() {
  const btn = document.getElementById('watchLaterBtn');
  
  if (!currentContent?.id) {
    showToast('No content selected', 'error');
    return;
  }
  
  if (!currentUserId) {
    showToast('Sign in to save to Watch Later', 'warning');
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
    } else {
      showToast('❌ ' + (result.error || 'Failed to update'), 'error');
      await updateWatchLaterButtonState();
    }
    
  } catch (error) {
    console.error('❌ Watch Later toggle failed:', error);
    showToast('Failed to update Watch Later', 'error');
    await updateWatchLaterButtonState();
    
  } finally {
    btn.disabled = originalDisabled;
    setTimeout(() => updateWatchLaterButtonState(), 100);
  }
}

// PHASE 2: Setup Watch Later button event listener (legacy, kept for fallback)
function setupWatchLaterButton() {
  const watchLaterBtn = document.getElementById('watchLaterBtn');
  
  if (!watchLaterBtn) {
    console.warn('⚠️ Watch Later button not found in DOM — check HTML');
    setTimeout(setupWatchLaterButton, 300);
    return;
  }
  
  const newBtn = watchLaterBtn.cloneNode(true);
  watchLaterBtn.parentNode.replaceChild(newBtn, watchLaterBtn);
  
  newBtn.addEventListener('click', handleWatchLaterToggle);
  
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
      
      if (currentUserId) {
        await loadContinueWatching(currentUserId);
      }
      
      if (window.PlaylistManager && !playlistManager) {
        await initializePlaylistManager();
      }
      
      if (recommendationEngine) {
        recommendationEngine.userId = currentUserId;
        await loadRecommendationRails();
      }
      
      if (streamingManager) {
        streamingManager.userId = currentUserId;
      }
      
      // Re-initialize playlist modal if needed
      if (currentContent?.id && !playlistModal) {
        setTimeout(initializePlaylistModal, 500);
      }
    } else if (event === 'SIGNED_OUT') {
      currentUserId = null;
      playlistManager = null;
      playlistModal = null;
      resetProfileUI();
      showToast('Signed out successfully', 'info');
      
      const continueSection = document.getElementById('continueWatchingSection');
      if (continueSection) continueSection.style.display = 'none';
      
      if (watchSession) {
        watchSession.stop();
        watchSession = null;
      }
      
      const watchLaterBtn = document.getElementById('watchLaterBtn');
      if (watchLaterBtn) {
        watchLaterBtn.classList.remove('active');
        watchLaterBtn.innerHTML = '<i class="far fa-clock"></i><span>Watch Later</span>';
      }
      
      if (recommendationEngine) {
        recommendationEngine.userId = null;
        await loadRecommendationRails();
      }
      
      if (streamingManager) {
        streamingManager.userId = null;
      }
    }
  });
  
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
// FIXED: Load content with ACCURATE counts from source tables
// ============================================
async function loadContentFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id') || '68';
  
  try {
    const { data: contentData, error: contentError } = await window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .eq('id', contentId)
      .single();
    
    if (contentError) throw contentError;
    
    const { count: viewsCount, error: viewsError } = await window.supabaseClient
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId);
    
    const { count: likesCount, error: likesError } = await window.supabaseClient
      .from('content_likes')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId);
    
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
    
    // Get quality profiles and HLS manifest URL (PHASE 4)
    const { data: streamingData } = await window.supabaseClient
      .from('Content')
      .select('quality_profiles, hls_manifest_url, data_saver_url')
      .eq('id', contentId)
      .single();
    
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
      views_count: viewsCount || 0,
      likes_count: likesCount || 0,
      favorites_count: contentData.favorites_count || 0,
      comments_count: contentData.comments_count || 0,
      creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
      creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
      creator_id: contentData.user_profiles?.id || contentData.user_id,
      user_id: contentData.user_id,
      user_profiles: contentData.user_profiles,
      watch_progress: watchProgress?.last_position || 0,
      is_completed: watchProgress?.is_completed || false,
      // PHASE 4: Streaming data
      quality_profiles: streamingData?.quality_profiles || [],
      hls_manifest_url: streamingData?.hls_manifest_url || null,
      data_saver_url: streamingData?.data_saver_url || null
    };
    
    console.log('📥 Content loaded with ACCURATE counts:', {
      views: currentContent.views_count,
      likes: currentContent.likes_count,
      watch_progress: currentContent.watch_progress,
      hls_available: !!currentContent.hls_manifest_url
    });
    
    updateContentUI(currentContent);
    
    if (currentContent.watch_progress > 10 && !currentContent.is_completed) {
      addResumeButton(currentContent.watch_progress);
    }
    
    if (currentUserId) {
      await initializeLikeButton(contentId, currentUserId);
      await initializeFavoriteButton(contentId, currentUserId);
    }
    
    if (playlistManager) {
      await updateWatchLaterButtonState();
    }
    
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
  
  if (document.getElementById('resumeBtn')) return;
  
  const resumeBtn = document.createElement('button');
  resumeBtn.id = 'resumeBtn';
  resumeBtn.className = 'btn btn-primary resume-btn';
  resumeBtn.innerHTML = `
    <i class="fas fa-play"></i>
    <span>Resume (${formatDuration(progressSeconds)})</span>
  `;
  
  resumeBtn.addEventListener('click', handlePlay);
  
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    heroActions.insertBefore(resumeBtn, playBtn);
    playBtn.style.display = 'none';
  } else {
    heroActions.prepend(resumeBtn);
  }
}

async function checkUserLike(contentId, userId) {
  if (!userId) return false;
  
  try {
    const { data, error } = await window.supabaseClient
      .from('content_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (error?.code === 'PGRST116') return false;
    if (error) {
      console.warn('Like check failed:', error.message);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Like check error:', error);
    return false;
  }
}

async function initializeLikeButton(contentId, userId) {
  const likeBtn = document.getElementById('likeBtn');
  if (!likeBtn) return;
  
  likeBtn.classList.remove('active');
  likeBtn.innerHTML = '<i class="far fa-heart"></i><span>Like</span>';
  
  if (!userId) return;
  
  const isLiked = await checkUserLike(contentId, userId);
  if (isLiked) {
    likeBtn.classList.add('active');
    likeBtn.innerHTML = '<i class="fas fa-heart"></i><span>Liked</span>';
  }
}

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

async function initializeFavoriteButton(contentId, userId) {
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (!favoriteBtn) return;
  
  favoriteBtn.classList.remove('active');
  favoriteBtn.innerHTML = '<i class="far fa-star"></i><span>Favorite</span>';
  
  if (!userId) return;
  
  const isFavorited = await checkUserFavorite(contentId, userId);
  if (isFavorited) {
    favoriteBtn.classList.add('active');
    favoriteBtn.innerHTML = '<i class="fas fa-star"></i><span>Favorited</span>';
  }
}

function updateContentUI(content) {
  if (!content) return;
  
  safeSetText('contentTitle', content.title);
  safeSetText('creatorName', content.creator);
  safeSetText('creatorDisplayName', content.creator_display_name);
  
  safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
  safeSetText('viewsCountFull', formatNumber(content.views_count));
  safeSetText('likesCount', formatNumber(content.likes_count));
  safeSetText('favoritesCount', formatNumber(content.favorites_count));
  safeSetText('commentsCount', `(${formatNumber(content.comments_count)})`);
  
  const duration = formatDuration(content.duration || 3600);
  safeSetText('durationText', duration);
  safeSetText('contentDurationFull', duration);
  
  safeSetText('uploadDate', formatDate(content.created_at));
  
  safeSetText('contentGenre', content.genre || 'General');
  
  safeSetText('contentDescriptionShort', truncateText(content.description, 150));
  safeSetText('contentDescriptionFull', content.description);
  
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
  
  const playerTitle = document.getElementById('playerTitle');
  if (playerTitle) {
    playerTitle.textContent = `Now Playing: ${content.title}`;
  }
}

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
    
    const countEl = document.getElementById('commentsCount');
    if (countEl) {
      countEl.textContent = `(${comments.length})`;
    }
    
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
// ============================================
async function loadRelatedContent(contentId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select('id, title, thumbnail_url, user_id, genre, duration, media_type, status, user_profiles!user_id(full_name, username)')
      .neq('id', contentId)
      .eq('status', 'published')
      .limit(6);
    
    if (error) throw error;
    
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
          <span>${formatNumber(viewsCount)} views</span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// ====================================================
// VIDEO PLAYER INITIALIZATION - WITH LOAD CONFIRMATION
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
    
    // ✅ FIXED: Add video load confirmation events
    enhancedVideoPlayer.on('loadeddata', () => {
      console.log('✅ Video metadata loaded, ready to play');
      // Hide any loading indicators
      const placeholder = document.getElementById('videoPlaceholder');
      if (placeholder) placeholder.style.display = 'none';
    });
    
    enhancedVideoPlayer.on('canplay', () => {
      console.log('✅ Video can start playing');
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
  
  if (watchSession) {
    watchSession.stop();
    watchSession = null;
  }
  
  try {
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
      syncInterval: 10000,
      viewThreshold: 20,
      completionThreshold: 0.9,
      
      onProgressSync: function(data) {
        console.log('📊 Progress synced:', data);
      },
      onViewCounted: function(data) {
        console.log('👁️ View counted:', data);
        refreshCountsFromSource();
      },
      onComplete: function(data) {
        console.log('🏆 Content completed:', data);
        showToast('✅ You finished this video!', 'success');
        
        var resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) {
          resumeBtn.remove();
          var playBtn = document.getElementById('playBtn');
          if (playBtn) playBtn.style.display = 'flex';
        }
      },
      onError: function(error) {
        console.error('❌ Watch session error:', error.context, error.error);
      }
    });
    
    window._watchSession = watchSession;
    
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
    let viewerId = null;
    if (window.AuthHelper?.isAuthenticated?.()) {
      const userProfile = window.AuthHelper.getUserProfile();
      viewerId = userProfile?.id || null;
    }
    
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
// CRITICAL: Refresh counts by counting rows in source tables
// ============================================
async function refreshCountsFromSource() {
  if (!currentContent) return;
  
  try {
    const { count: newViews } = await window.supabaseClient
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', currentContent.id);
    
    const { count: newLikes } = await window.supabaseClient
      .from('content_likes')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', currentContent.id);
    
    currentContent.views_count = newViews || 0;
    currentContent.likes_count = newLikes || 0;
    
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
  
  if (!hasViewedContentRecently(currentContent.id)) {
    const viewsEl = document.getElementById('viewsCount');
    const viewsFullEl = document.getElementById('viewsCountFull');
    const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
    const newViews = currentViews + 1;
    
    if (viewsEl && viewsFullEl) {
      viewsEl.textContent = `${formatNumber(newViews)} views`;
      viewsFullEl.textContent = formatNumber(newViews);
    }
    
    recordContentView(currentContent.id)
      .then(async function(success) {
        if (success) {
          markContentAsViewed(currentContent.id);
          await refreshCountsFromSource();
          
          if (window.track?.contentView) {
            window.track.contentView(currentContent.id, 'video');
          }
        } else {
          if (viewsEl && viewsFullEl) {
            viewsEl.textContent = `${formatNumber(currentViews)} views`;
            viewsFullEl.textContent = formatNumber(currentViews);
          }
        }
      })
      .catch(function(error) {
        console.error('View recording error:', error);
        if (viewsEl && viewsFullEl) {
          viewsEl.textContent = `${formatNumber(currentViews)} views`;
          viewsFullEl.textContent = formatNumber(currentViews);
        }
      });
  }
  
  let videoUrl = currentContent.file_url;
  console.log('📥 Raw file_url from database:', videoUrl);
  
  if (videoUrl && !videoUrl.startsWith('http')) {
    if (videoUrl.startsWith('/')) {
      videoUrl = videoUrl.substring(1);
    }
    videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${videoUrl}`;
  }
  
  if (!videoUrl || videoUrl === 'null' || videoUrl === 'undefined' || videoUrl === '') {
    if (currentContent.thumbnail_url && !currentContent.thumbnail_url.startsWith('http')) {
      const cleanPath = currentContent.thumbnail_url.startsWith('/')
        ? currentContent.thumbnail_url.substring(1)
        : currentContent.thumbnail_url;
      videoUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
    }
  }
  
  console.log('🎥 Final video URL:', videoUrl);
  
  if (!videoUrl || (!videoUrl.includes('.mp4') && !videoUrl.includes('.webm') && !videoUrl.includes('.mov'))) {
    console.error('❌ Invalid video URL or format:', videoUrl);
    showToast('Invalid video format or URL', 'error');
    return;
  }
  
  player.style.display = 'block';
  
  const placeholder = document.getElementById('videoPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
  
  if (enhancedVideoPlayer) {
    try {
      console.log('🗑️ Destroying existing player...');
      enhancedVideoPlayer.destroy();
    } catch (e) {
      console.warn('Error destroying old player:', e);
    }
    enhancedVideoPlayer = null;
  }
  
  if (watchSession) {
    watchSession.stop();
    watchSession = null;
  }
  
  console.log('🔧 Setting video source...');
  
  while (videoElement.firstChild) {
    videoElement.removeChild(videoElement.firstChild);
  }
  
  videoElement.removeAttribute('src');
  videoElement.src = '';
  
  const source = document.createElement('source');
  source.src = videoUrl;
  
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
  
  console.log('🎬 Initializing EnhancedVideoPlayer...');
  initializeEnhancedVideoPlayer();
  
  // PHASE 4: Reinitialize streaming manager with new content
  setTimeout(() => {
    if (streamingManager) {
      streamingManager.destroy();
      streamingManager = null;
    }
    initializeStreamingManager();
  }, 100);
  
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
  
  setTimeout(() => {
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// Setup event listeners
function setupEventListeners() {
  console.log('🔧 Setting up event listeners...');
  
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', handlePlay);
  }
  
  const poster = document.getElementById('heroPoster');
  if (poster) {
    poster.addEventListener('click', handlePlay);
  }
  
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
      
      if (streamingManager) {
        streamingManager.destroy();
        streamingManager = null;
      }
    });
  }
  
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
  // LIKE BUTTON - RLS-COMPLIANT
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
        likeBtn.classList.toggle('active', !isLiked);
        likeBtn.innerHTML = !isLiked 
          ? '<i class="fas fa-heart"></i><span>Liked</span>' 
          : '<i class="far fa-heart"></i><span>Like</span>';
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(newLikes);
        }
        
        if (!isLiked) {
          const { error } = await window.supabaseClient
            .from('content_likes')
            .insert({
              user_id: userProfile.id,
              content_id: currentContent.id
            });
          
          if (error) throw error;
        } else {
          const { error } = await window.supabaseClient
            .from('content_likes')
            .delete()
            .eq('user_id', userProfile.id)
            .eq('content_id', currentContent.id);
          
          if (error) throw error;
        }
        
        await refreshCountsFromSource();
        
        showToast(!isLiked ? 'Liked!' : 'Like removed', !isLiked ? 'success' : 'info');
        
        if (window.track?.contentLike) {
          window.track.contentLike(currentContent.id, !isLiked);
        }
        
      } catch (error) {
        console.error('Like operation failed:', error);
        
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
        favoriteBtn.classList.toggle('active', !isFavorited);
        favoriteBtn.innerHTML = !isFavorited
          ? '<i class="fas fa-star"></i><span>Favorited</span>'
          : '<i class="far fa-star"></i><span>Favorite</span>';
        
        if (favCountEl) {
          favCountEl.textContent = formatNumber(newFavorites);
        }
        
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
        
        const { error: updateError } = await window.supabaseClient
          .from('Content')
          .update({ favorites_count: newFavorites })
          .eq('id', currentContent.id);
        
        if (updateError) {
          console.warn('Favorites count update failed:', updateError);
        }
        
        currentContent.favorites_count = newFavorites;
        
        showToast(!isFavorited ? 'Added to favorites!' : 'Removed from favorites', !isFavorited ? 'success' : 'info');
        
        await refreshCountsFromSource();
        
      } catch (error) {
        console.error('Favorite update failed:', error);
        
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
  // PHASE 2: WATCH LATER BUTTON (uses modal now)
  // ============================================
  // The Watch Later button is now handled in initializePlaylistModal
  // This is a fallback in case modal isn't initialized yet
  setupWatchLaterButton();
  
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
        
        await loadComments(currentContent.id);
        await refreshCountsFromSource();
        
        commentInput.value = '';
        showToast('Comment added!', 'success');
        
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
    
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey && !commentInput.disabled) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }
  
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
  // FIXED: SHARE BUTTON WITH BRAND IDENTITY
  // ============================================
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async function() {
      if (!currentContent) return;
      
      const shareText = `📺 ${currentContent.title}\n\n${currentContent.description || 'Check out this amazing content!'}\n\n👉 Watch on Bantu Stream Connect\nNO DNA, JUST RSA\n\n`;
      const shareUrl = window.location.href;
      
      try {
        if (navigator.share && navigator.canShare({ text: shareText, url: shareUrl })) {
          await navigator.share({
            title: 'Bantu Stream Connect',
            text: shareText,
            url: shareUrl
          });
        } else {
          await navigator.clipboard.writeText(`${shareText}${shareUrl}`);
          showToast('✨ Link copied! Share with "NO DNA, JUST RSA" ✨', 'success');
          
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
  
  setupConnectButtons();
  
  console.log('✅ Event listeners setup complete');
}

// ====================================================
// SINGLE-TABLE FIX: CONNECT BUTTONS WITH CONNECTORS TABLE
// ====================================================
function setupConnectButtons() {
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
    
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn && currentContent?.creator_id) {
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
    
    const connectCreatorBtn = document.getElementById('connectCreatorBtn');
    if (connectCreatorBtn && currentContent?.creator_id) {
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
// MODAL & PANEL SYSTEMS
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
    const { data: viewsData } = await window.supabaseClient
      .from('content_views')
      .select('id, viewed_at')
      .eq('content_id', currentContent.id)
      .order('viewed_at', { ascending: false })
      .limit(100);
    
    const { data: commentsData } = await window.supabaseClient
      .from('comments')
      .select('id, created_at')
      .eq('content_id', currentContent.id);
    
    const totalViews = viewsData?.length || 0;
    const totalComments = commentsData?.length || 0;
    
    document.getElementById('content-total-views').textContent = formatNumber(totalViews);
    document.getElementById('total-comments').textContent = formatNumber(totalComments);
    
    document.getElementById('avg-watch-time').textContent = '4m 23s';
    document.getElementById('engagement-rate').textContent = '68%';
    
    document.getElementById('views-trend').textContent = '+12%';
    document.getElementById('comments-trend').textContent = '+8%';
    document.getElementById('watch-time-trend').textContent = '+5%';
    document.getElementById('engagement-trend').textContent = '+3%';
    
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
            <span>${formatNumber(viewsCount)} views</span>
          </div>
          <button class="creator-btn" data-creator-id="${item.user_id}" data-creator-name="${creator}">
            <i class="fas fa-user"></i>
            ${truncateText(creator, 15)}
          </button>
        </div>
      </div>
    `;
  }).join('');
  
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
  
  if (window.AuthHelper?.isAuthenticated()) {
    loadUserNotifications();
    updateNotificationBadge();
  }
  
  document.addEventListener('authReady', loadUserNotifications);
}

async function loadUserNotifications() {
  var notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  try {
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
    
    notificationsList.querySelectorAll('.notification-item').forEach(function(item) {
      item.addEventListener('click', async function() {
        var id = item.dataset.id;
        await markNotificationAsRead(id);
        
        var notification = data.find(function(n) { return n.id === id; });
        if (notification?.content_id) {
          window.location.href = `content-detail.html?id=${notification.content_id}`;
        }
        notificationsPanel.classList.remove('active');
      });
    });
    
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
    
    var item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.classList.add('read');
      var dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    }
    
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
// FIXED: THEME SELECTOR - COMPLETE OVERHAUL
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
  
  var newThemeToggle = themeToggle.cloneNode(true);
  themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
  
  newThemeToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('🎨 Theme toggle clicked');
    themeSelector.classList.toggle('active');
  });
  
  document.addEventListener('click', function(e) {
    if (themeSelector.classList.contains('active') && 
        !themeSelector.contains(e.target) && 
        !newThemeToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
  
  if (themeOptions.length > 0) {
    themeOptions.forEach(function(option) {
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
  
  initCurrentTheme();
  
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
  
  if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
    console.warn('Invalid theme:', theme, 'defaulting to dark');
    theme = 'dark';
  }
  
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
  
  document.body.classList.add('theme-' + theme);
  
  localStorage.setItem('theme', theme);
  
  document.querySelectorAll('.theme-option').forEach(function(option) {
    var isActive = option.dataset.theme === theme;
    if (isActive) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
  
  document.body.style.display = 'none';
  document.body.offsetHeight;
  document.body.style.display = '';
  
  var themeSelector = document.getElementById('theme-selector');
  if (themeSelector) {
    themeSelector.style.display = 'none';
    themeSelector.offsetHeight;
    themeSelector.style.display = '';
  }
  
  updateThemeCSSVariables(theme);
  
  showToast('Theme changed to ' + theme, 'success');
  console.log('✅ Theme applied successfully:', theme);
}

// ============================================
// NEW: Update CSS variables based on theme
// ============================================
function updateThemeCSSVariables(theme) {
  var root = document.documentElement;
  
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
  
  var savedTheme = localStorage.getItem('theme');
  
  if (!savedTheme) {
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    savedTheme = prefersDark ? 'dark' : 'light';
    console.log('🎨 Using system theme preference:', savedTheme);
  }
  
  if (savedTheme !== 'dark' && savedTheme !== 'light' && savedTheme !== 'high-contrast') {
    console.warn('Invalid saved theme:', savedTheme, 'defaulting to dark');
    savedTheme = 'dark';
  }
  
  applyTheme(savedTheme);
  
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
  var homeBtn = document.querySelector('.nav-icon:nth-child(1)');
  if (homeBtn) {
    var newHomeBtn = homeBtn.cloneNode(true);
    homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
    
    newHomeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = 'https://bantustreamconnect.com/';
    });
  }
  
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
    if (!content) return '';
    
    var progress = content.duration > 0 
      ? Math.min(100, Math.round((item.last_position / content.duration) * 100))
      : 0;
    
    var timeWatched = formatDuration(item.last_position);
    var totalTime = formatDuration(content.duration);
    
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
  
  container.querySelectorAll('.continue-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (window.track?.continueWatchingClick) {
        var contentId = card.dataset.contentId;
        window.track.continueWatchingClick(contentId);
      }
    });
  });
}

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

// Export key functions
window.hasViewedContentRecently = hasViewedContentRecently;
window.markContentAsViewed = markContentAsViewed;
window.recordContentView = recordContentView;
window.refreshCountsFromSource = refreshCountsFromSource;
window.clearViewCache = clearViewCache;
window.streamingManager = streamingManager;
window.keyboardShortcuts = keyboardShortcuts;
window.playlistModal = playlistModal;

// PHASE 1: Page unload handler - clean up watch session
window.addEventListener('beforeunload', function() {
  if (watchSession) {
    watchSession.stop();
  }
  if (window._watchSession) {
    window._watchSession.stop();
  }
  if (streamingManager) {
    streamingManager.destroy();
  }
});

console.log('✅ Content detail script loaded with PHASE 4 STREAMING MANAGER integration and PHASE 1-3 POLISH');
