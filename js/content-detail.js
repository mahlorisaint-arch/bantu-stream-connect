// js/content-detail.js - CORE MODULE (Features offloaded to content-detail-features.js)
// FIXED FOR RLS POLICIES - WITH ACCURATE COUNT BYPASS - VIEWS RECORDED ON PLAY BUTTON CLICK (LIKE MOBILE APP)
// FIXED: Theme selector conflict resolved, navigation icons properly aligned
// PHASE 1 UPDATE: Watch Session Lifecycle Integration with syntax-safe WatchSession
// PHASE 2 UPDATE: Watch Later & Playlist System Integration
// PHASE 3 UPDATE: Complete Recommendation Engine Integration
// PHASE 4 UPDATE: HLS Streaming & Quality Selector Integration - COMPLETE
// FIXED: Added video load confirmation events
// PHASE 1-3 POLISH: Keyboard Shortcuts, Playlist Modal, Loading States
// FIXED: Playlist duplicate key constraint error handling
// PHASE 4 ENHANCEMENTS: Quality badge, network speed indicator, HLS.js integration
// FIXED: Quality selector initialization and rendering issue
// 🎯 YOUTUBE-STYLE HERO INTEGRATION: Video player now BEFORE hero section for prominent display
// 🎯 PROFESSIONAL LAYOUT FIX: Recommendation rails moved below comments section with proper titles
// 🎯 FIXED: Duplicate Continue Watching sections consolidated into ONE section below comments
// 🎯 MOBILE-OPTIMIZED: Full-width video player on mobile, removed "Now Playing" header
// 🎯 REDESIGN: Removed close button, full-width player, compact settings menu
// 🎵 AUDIO SUPPORT: Added MP3, WAV, OGG playback with thumbnail as poster
// 🎨 CREATOR AVATAR FIX: Show actual creator profile picture from user_profiles
// 🔄 PLATFORM CONSISTENCY: Integrated home feed sidebar, header, navigation, and utilities
// ✅ FIXED: checkConnectionStatus now returns a Promise to prevent ".then is not a function" error
// ✅ FIXED: Added missing initThemeSelector function to prevent ReferenceError
// ✅ FIXED: Sidebar profile now shows logged-in user correctly
// ✅ FIXED: Header profile icon sizing matches home feed
// ✅ FIXED: Sidebar UI resize section button overlapping
// ✅ FIXED: Navigation menu button opens sidebar instead of redirecting to dashboard
// ✅ FIXED: Comments "sign in to comment" bug when already authenticated
// ✅ FIXED: LIKE BUTTON - Proper WHERE clauses for RLS compliance
// 🎯 MOBILE FIX: Navigation button properly centered, no overflow, no horizontal scrolling
// 🎯 MOBILE FIX: Header profile picture hidden on mobile phones
// 🎯 MOBILE FIX: RSA badge stays inside header, no overflow
// 🔧 CRITICAL FIX: Added session_id to view recording system (YouTube-style validation)
// 🔧 CRITICAL FIX: REMOVED creator_id from content_views operations (column doesn't exist)
// 🔧 CRITICAL FIX: ADDED profile_id to content_views inserts (required column)

console.log('🎬 Content Detail Core Initializing with RLS-compliant fixes...');

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
let viewValidationTimer = null; // 🔧 NEW: Timer for view validation

// ============================================
// 🔧 CRITICAL FIX: VIEW RECORDING SYSTEM WITH SESSION ID
// 🔧 FIXED: Removed creator_id - column doesn't exist in content_views
// 🔧 FIXED: Added profile_id - required column in content_views table
// ============================================

// Generate new session ID for each play
function generateNewSession() {
  const newSessionId = crypto.randomUUID();
  sessionStorage.setItem('bantu_view_session', newSessionId);
  console.log('🎬 Generated new session ID:', newSessionId);
  return newSessionId;
}

// ============================================
// 🔧 FIXED: Record view in content_views table with session_id
// ✅ REMOVED: creator_id (column doesn't exist)
// ✅ ADDED: profile_id (required column)
// ============================================
async function recordContentView(contentId) {
  console.log('🚨 recordContentView CALLED with contentId:', contentId, 'type:', typeof contentId);
  
  try {
    let viewerId = null;
    let profileId = null;
    let userId = null;
    
    if (window.AuthHelper?.isAuthenticated?.()) {
      const userProfile = window.AuthHelper.getUserProfile();
      viewerId = userProfile?.id || null;
      profileId = userProfile?.id || null;
      userId = userProfile?.id || null;
      console.log('👤 User ID:', userId);
      console.log('👤 Profile ID:', profileId);
    } else {
      console.log('👤 Guest user');
    }

    // Generate or get session ID
    let sessionId = sessionStorage.getItem('bantu_view_session');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('bantu_view_session', sessionId);
      console.log('🔑 Generated new session ID:', sessionId);
    } else {
      console.log('🔑 Using existing session ID:', sessionId);
    }

    const contentIdNum = parseInt(contentId);
    if (isNaN(contentIdNum)) {
      console.error('❌ Invalid content ID:', contentId);
      return null;
    }
    
    const deviceType = /Mobile|Android|iP(hone|od)|IEMobile|Windows Phone|BlackBerry/i.test(navigator.userAgent)
      ? 'mobile'
      : 'desktop';
    
    // ✅ CORRECT INSERT - NO creator_id
    const insertData = {
      content_id: contentIdNum,
      viewer_id: viewerId,
      profile_id: profileId,
      user_id: userId,
      session_id: sessionId,
      view_duration: 0,
      counted_as_view: false,
      device_type: deviceType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Inserting view data:', insertData);

    const { data, error } = await window.supabaseClient
      .from('content_views')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Insert failed:', error.message);
      console.error('❌ Error code:', error.code);
      return null;
    }

    console.log('✅ VIEW CREATED SUCCESSFULLY!');
    console.log('✅ View ID:', data.id);
    console.log('✅ Session ID:', sessionId);
    
    return sessionId;
  } catch (error) {
    console.error('❌ Exception:', error.message);
    return null;
  }
}

// ============================================
// 🔧 FIXED: Start view validation timer (YouTube-style 20-second threshold)
// ✅ REMOVED: creator_id from update
// ============================================
function startViewValidationTimer(sessionId, contentId) {
  // Clear existing timer
  if (viewValidationTimer) {
    clearTimeout(viewValidationTimer);
  }
  
  console.log('⏱ Starting 20-second validation timer for session:', sessionId);
  
  // ✅ Wait 20 seconds before counting as valid view
  viewValidationTimer = setTimeout(async () => {
    console.log('⏱ Validating view after 20 seconds:', { sessionId, contentId });
    
    try {
      const currentTime = enhancedVideoPlayer?.video?.currentTime || 0;
      console.log('📊 Current video time at validation:', currentTime);
      
      // ✅ CORRECT: Update only fields that exist in content_views
      const { data, error } = await window.supabaseClient
        .from('content_views')
        .update({
          counted_as_view: true,
          view_duration: Math.floor(currentTime),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('content_id', parseInt(contentId))
        .eq('counted_as_view', false)
        .select();
      
      if (error) {
        console.error('❌ Failed to validate view:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('✅ View validated and counted after 20 seconds!');
        console.log('✅ Updated record:', data[0]);
        
        // ✅ Refresh counts after validation
        await refreshCountsFromSource();
        
        // ✅ Show subtle notification
        if (data[0].counted_as_view) {
          console.log('📊 View counted for content:', contentId);
        }
      } else {
        console.warn('⚠️ No matching session found for validation or already counted');
        
        // Try to find any record with this session_id to debug
        const { data: findData, error: findError } = await window.supabaseClient
          .from('content_views')
          .select('*')
          .eq('session_id', sessionId);
        
        if (findError) {
          console.error('❌ Could not find session:', findError);
        } else {
          console.log('🔍 Found records with session_id:', findData);
        }
      }
    } catch (error) {
      console.error('❌ View validation error:', error);
    }
  }, 20000); // 20 seconds threshold
}

// TEMPORARILY DISABLE the recent view check for testing
function hasViewedContentRecently(contentId) {
  console.log('🔍 hasViewedContentRecently called - returning FALSE for testing');
  return false;
}

// ============================================
// ✅ FIX: Reliable comment input state update
// ============================================
async function updateCommentInputState() {
  const commentInput = document.getElementById('commentInput');
  const sendCommentBtn = document.getElementById('sendCommentBtn');
  const commentAvatar = document.getElementById('userCommentAvatar');
  
  if (!commentInput || !sendCommentBtn) return;
  
  // More reliable auth check with fallbacks
  let isAuthenticated = false;
  let userProfile = null;
  
  if (window.AuthHelper?.isAuthenticated?.()) {
    isAuthenticated = true;
    userProfile = window.AuthHelper.getUserProfile?.();
  } else if (window.currentUser?.id) {
    isAuthenticated = true;
    userProfile = window.currentUser;
  } else {
    try {
      const { data } = await window.supabaseClient?.auth?.getSession?.();
      isAuthenticated = !!data?.session;
      if (isAuthenticated && window.AuthHelper?.getUserProfile) {
        userProfile = window.AuthHelper.getUserProfile();
      }
    } catch (e) {
      console.warn('Auth check fallback:', e);
    }
  }
  
  if (isAuthenticated && userProfile) {
    // Enable comment input
    commentInput.disabled = false;
    commentInput.placeholder = 'Write a comment...';
    sendCommentBtn.disabled = false;
    
    // Update avatar
    const displayName = userProfile?.full_name || userProfile?.username || userProfile?.email?.split('@')[0] || 'User';
    const avatarUrl = userProfile?.avatar_url || window.AuthHelper?.getAvatarUrl?.();
    
    if (commentAvatar) {
      if (avatarUrl && avatarUrl !== 'null') {
        const fixedUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
        commentAvatar.innerHTML = `<img src="${fixedUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        const initial = displayName.charAt(0).toUpperCase();
        commentAvatar.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">${initial}</div>`;
      }
    }
  } else {
    // Disable for guests
    commentInput.disabled = true;
    commentInput.placeholder = 'Sign in to add a comment...';
    sendCommentBtn.disabled = true;
    if (commentAvatar) {
      commentAvatar.innerHTML = '<i class="fas fa-user"></i>';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOM loaded, starting core initialization...');
  
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
  
  // Setup UI event listeners
  setupEventListeners();
  
  // Initialize video player
  initializeEnhancedVideoPlayer();
  
  // Initialize streaming manager (PHASE 4)
  await initializeStreamingManager();
  
  // ✅ FIX: Update comment input state after a brief delay to ensure auth is ready
  setTimeout(updateCommentInputState, 1500);
  
  // Also update when auth state changes
  if (window.supabaseClient?.auth) {
    window.supabaseClient.auth.onAuthStateChange(async () => {
      setTimeout(updateCommentInputState, 300);
    });
  }
  
  // PHASE 1: Load Continue Watching section (SINGLE SECTION - now below comments)
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
  
  // Show app with fallback timeout
  setTimeout(() => {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (loading && app) {
      loading.style.display = 'none';
      app.style.display = 'block';
    }
  }, 3000); // Fallback after 3 seconds
  
  // Hide loading and show app
  const loading = document.getElementById('loading');
  const app = document.getElementById('app');
  if (loading && app) {
    loading.style.display = 'none';
    app.style.display = 'block';
  }
  
  console.log('✅ Content Detail Core fully initialized with RLS-compliant fixes, PHASE 4 Streaming');
});

// FINAL SAFETY: Ensure loading screen hides even if errors occur
setTimeout(() => {
  const loading = document.getElementById('loading');
  const app = document.getElementById('app');
  if (loading && app && loading.style.display !== 'none') {
    console.warn('⚠️ Forcing app display after timeout');
    loading.style.display = 'none';
    app.style.display = 'block';
  }
}, 5000); // 5 second fallback

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
// 🔧 NEW: Generate session ID for view tracking
// ============================================
function generateNewSession() {
  const newSessionId = crypto.randomUUID();
  sessionStorage.setItem('bantu_view_session', newSessionId);
  return newSessionId;
}

// ============================================
// PHASE 1 UPDATED: Initialize watch session with session ID and profile ID
// ============================================
function initializeWatchSessionOnPlay() {
  if (!currentContent || !currentUserId || !enhancedVideoPlayer?.video) {
    console.log('🚫 Cannot initialize watch session: missing content, user, or video');
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
    
    // ✅ Get or create session ID
    let sessionId = sessionStorage.getItem('bantu_view_session');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('bantu_view_session', sessionId);
    }
    
    console.log('🎬 Initializing WatchSession with session:', sessionId);
    
    watchSession = new window.WatchSession({
      contentId: currentContent.id,
      userId: currentUserId,
      supabase: window.supabaseClient,
      videoElement: enhancedVideoPlayer.video,
      sessionId: sessionId, // ✅ Pass session ID
      syncInterval: 10000,
      viewThreshold: 20,
      completionThreshold: 0.9,
      onProgressSync: function(data) {
        console.log('📊 Progress synced:', data);
      },
      onViewCounted: function(data) {
        console.log('👍 View counted:', data);
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
        console.log('✅ Watch session started with session ID:', sessionId);
      }
    }, 500);
  } catch (error) {
    console.error('❌ Failed to initialize watch session:', error);
  }
}

// ============================================
// 🔧 FIXED: Record view when Play button is clicked with YouTube-style validation
// ✅ ADDED: profile_id to insert
// ============================================
function handlePlay() {
  console.log('🎬 handlePlay CALLED - Starting view recording...');
  
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
  
  // ✅ GENERATE NEW SESSION FOR THIS PLAY
  const sessionId = generateNewSession();
  console.log('🎬 New viewing session:', sessionId);
  
  // ✅ UPDATE UI OPTIMISTICALLY
  const viewsEl = document.getElementById('viewsCount');
  const viewsFullEl = document.getElementById('viewsCountFull');
  const currentViews = parseInt(viewsEl?.textContent.replace(/\D/g, '') || '0') || 0;
  const newViews = currentViews + 1;
  
  if (viewsEl && viewsFullEl) {
    viewsEl.textContent = `${formatNumber(newViews)} views`;
    viewsFullEl.textContent = formatNumber(newViews);
  }
  
  // ✅ RECORD VIEW (ALWAYS, NO CONDITION)
  const contentIdNum = parseInt(currentContent.id);
  console.log('📝 Calling recordContentView with ID:', contentIdNum);
  
  recordContentView(contentIdNum)
    .then(async function(returnedSessionId) {
      if (returnedSessionId) {
        console.log('✅ View recorded successfully! Session:', returnedSessionId);
        markContentAsViewed(currentContent.id);
        await refreshCountsFromSource();
        startViewValidationTimer(returnedSessionId, contentIdNum);
        
        if (window.track?.contentView) {
          window.track.contentView(currentContent.id, 'video');
        }
      } else {
        console.error('❌ Failed to record view - rolling back UI');
        if (viewsEl && viewsFullEl) {
          viewsEl.textContent = `${formatNumber(currentViews)} views`;
          viewsFullEl.textContent = formatNumber(currentViews);
        }
      }
    })
    .catch(function(error) {
      console.error('❌ View recording promise rejected:', error);
      if (viewsEl && viewsFullEl) {
        viewsEl.textContent = `${formatNumber(currentViews)} views`;
        viewsFullEl.textContent = formatNumber(currentViews);
      }
    });
  
  // Continue with video playback setup
  player.style.display = 'block';
  
  const placeholder = document.getElementById('videoPlaceholder');
  if (placeholder) placeholder.style.display = 'none';
  
  const heroPoster = document.getElementById('heroPoster');
  if (heroPoster) heroPoster.style.opacity = '0.3';
  
  const closeFromHero = document.getElementById('closePlayerFromHero');
  if (closeFromHero) closeFromHero.style.display = 'flex';
  
  videoElement.muted = false;
  videoElement.defaultMuted = false;
  videoElement.volume = 1.0;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Video source setup (keep your existing working code)
  let fileUrl = currentContent.file_url;
  console.log('📥 Raw file_url from database:', fileUrl);
  
  if (fileUrl && !fileUrl.startsWith('http')) {
    if (fileUrl.startsWith('/')) fileUrl = fileUrl.substring(1);
    fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${fileUrl}`;
  }
  
  if (!fileUrl || fileUrl === 'null' || fileUrl === 'undefined' || fileUrl === '') {
    if (currentContent.thumbnail_url && !currentContent.thumbnail_url.startsWith('http')) {
      const cleanPath = currentContent.thumbnail_url.startsWith('/') ? currentContent.thumbnail_url.substring(1) : currentContent.thumbnail_url;
      fileUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content-media/${cleanPath}`;
    }
  }
  
  console.log('🎵 Final file URL:', fileUrl);
  
  const isAudioFile = fileUrl && (fileUrl.includes('.mp3') || fileUrl.includes('.wav') || fileUrl.includes('.ogg') || fileUrl.includes('.aac') || fileUrl.includes('.m4a'));
  const isVideoFile = fileUrl && (fileUrl.includes('.mp4') || fileUrl.includes('.webm') || fileUrl.includes('.mov'));
  
  if (!fileUrl || (!isAudioFile && !isVideoFile)) {
    console.error('❌ Invalid file format:', fileUrl);
    showToast('Invalid file format', 'error');
    return;
  }
  
  if (isAudioFile && currentContent.thumbnail_url) {
    const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(currentContent.thumbnail_url) || currentContent.thumbnail_url;
    videoElement.setAttribute('poster', imgUrl);
  } else {
    videoElement.removeAttribute('poster');
  }
  
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.setAttribute('data-media-type', isAudioFile ? 'audio' : 'video');
  }
  
  if (enhancedVideoPlayer) {
    try { enhancedVideoPlayer.destroy(); } catch(e) {}
    enhancedVideoPlayer = null;
  }
  
  if (watchSession) {
    watchSession.stop();
    watchSession = null;
  }
  
  while (videoElement.firstChild) videoElement.removeChild(videoElement.firstChild);
  videoElement.removeAttribute('src');
  videoElement.src = '';
  
  const source = document.createElement('source');
  source.src = fileUrl;
  
  if (isAudioFile) {
    if (fileUrl.endsWith('.mp3')) source.type = 'audio/mpeg';
    else if (fileUrl.endsWith('.wav')) source.type = 'audio/wav';
    else if (fileUrl.endsWith('.ogg')) source.type = 'audio/ogg';
    else source.type = 'audio/mpeg';
  } else {
    if (fileUrl.endsWith('.mp4')) source.type = 'video/mp4';
    else if (fileUrl.endsWith('.webm')) source.type = 'video/webm';
    else source.type = 'video/mp4';
  }
  
  videoElement.appendChild(source);
  videoElement.load();
  
  initializeEnhancedVideoPlayer();
  
  setTimeout(() => {
    if (streamingManager) {
      streamingManager.destroy();
      streamingManager = null;
    }
    initializeStreamingManager();
  }, 100);
  
  setTimeout(() => {
    if (enhancedVideoPlayer) {
      enhancedVideoPlayer.play().catch(err => console.error('Play failed:', err));
    } else {
      videoElement.play().catch(err => console.error('Autoplay failed:', err));
    }
  }, 500);
  
  setTimeout(() => {
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ============================================
// 🔧 NEW: Debug function to check session data
// ============================================
async function debugSessionData() {
  const sessionId = sessionStorage.getItem('bantu_view_session');
  console.log('Current session ID:', sessionId);
  
  if (!sessionId) {
    console.log('No active session');
    return;
  }
  
  const { data, error } = await window.supabaseClient
    .from('content_views')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Debug error:', error);
    return;
  }
  
  console.table(data);
  return data;
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
        updateQualityIndicator(data.quality);
        showToast('Quality: ' + data.quality, 'info');
        // Refresh quality selector UI
        setupQualitySelector();
      },
      onDataSaverToggle: function(data) {
        console.log('💾 Data saver:', data.enabled ? 'ON' : 'OFF');
        updateQualityIndicator(streamingManager.getCurrentQuality());
        showToast('Data Saver: ' + (data.enabled ? 'ON' : 'OFF'), 'info');
      },
      onError: function(err) {
        console.error('❌ Streaming error:', err);
      }
    });
    
    await streamingManager.initialize();
    
    // Set up periodic network speed updates
    setInterval(() => {
      if (streamingManager) {
        const speed = streamingManager.getNetworkSpeed();
        if (speed) {
          updateNetworkSpeedIndicator(speed / 1000000);
        }
      }
    }, 5000);
    
    // ✅ CRITICAL: Setup quality selector AFTER streaming manager is ready
    setupQualitySelector();
    setupDataSaverToggle();
    
    // Initialize quality indicator with current quality
    setTimeout(() => {
      if (streamingManager) {
        updateQualityIndicator(streamingManager.getCurrentQuality());
      }
    }, 1000);
    
    console.log('✅ StreamingManager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize StreamingManager:', error);
  }
}

// ============================================
// 🎯 FIXED: Load all recommendation rails with proper titles
// ✅ REMOVED Continue Watching rail (now using Phase 1 section below comments)
// ============================================
async function loadRecommendationRails() {
  if (!recommendationEngine) return;
  
  // ✅ REMOVED: Continue Watching rail (we use the Phase 1 section instead)
  const railConfigs = [
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
  
  // Show skeleton loaders for each rail with proper titles
  railConfigs.forEach(config => {
    showRailSkeleton(config.containerId, config.title);
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

// ============================================
// 🎯 FIXED: Show skeleton loader for rail with proper title
// ============================================
function showRailSkeleton(containerId, title = 'Loading...') {
  const section = document.getElementById(containerId);
  if (!section) return;
  
  section.style.display = 'block';
  
  if (!section.querySelector('.section-header')) {
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">${title}</h2>
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

// ============================================
// 🎯 Show empty state for rail
// ============================================
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

// ============================================
// 🎯 Render a single recommendation rail
// ============================================
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
      console.log('🔄 Watch Later button not in DOM yet, retrying...');
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

// PHASE 2: Handle Watch Later button click - UPDATED to use modal
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
  
  // ✅ FIXED: Open playlist modal for selection if available
  if (window.playlistModal) {
    window.playlistModal.contentId = currentContent.id;
    window.playlistModal.open();
    return;
  }
  
  // Fallback to direct Watch Later add
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
      } else if (result.action === 'already_exists') {
        showToast('Already in Watch Later', 'info');
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

// PHASE 2: Setup Watch Later button event listener - UPDATED to use modal
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
      
      // Update home feed UI components
      await updateSidebarProfile();
      await updateHeaderProfile();
      updateProfileSwitcher();
      
      // ✅ Update comment input state after sign in
      setTimeout(updateCommentInputState, 300);
      
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
      
      // Reset home feed UI components
      resetSidebarProfile();
      resetHeaderProfile();
      
      // ✅ Update comment input state after sign out
      setTimeout(updateCommentInputState, 300);
    }
  });
  
  if (window.AuthHelper?.isAuthenticated?.()) {
    currentUserId = window.AuthHelper.getUserProfile()?.id || null;
    updateProfileUI();
  } else {
    resetProfileUI();
  }
  
  // ✅ Initial comment input state update
  setTimeout(updateCommentInputState, 500);
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
  
  // ✅ Apply mobile header styles after updating profile UI
  applyMobileHeaderStyles();
  
  // ✅ Update comment input state directly (no duplicate check)
  updateCommentInputState();
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
  
  // ✅ Apply mobile header styles after reset
  applyMobileHeaderStyles();
  
  // ✅ Update comment input state for guest
  updateCommentInputState();
}

// Reset sidebar profile for guest state
function resetSidebarProfile() {
  const avatar = document.getElementById('sidebar-profile-avatar');
  const name = document.getElementById('sidebar-profile-name');
  const email = document.getElementById('sidebar-profile-email');
  
  if (name) name.textContent = 'Guest';
  if (email) email.textContent = 'Sign in to continue';
  if (avatar) avatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
}

// Reset header profile for guest state
function resetHeaderProfile() {
  const profilePlaceholder = document.getElementById('userProfilePlaceholder');
  const currentProfileName = document.getElementById('current-profile-name');
  
  if (profilePlaceholder) {
    profilePlaceholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
  }
  if (currentProfileName) {
    currentProfileName.textContent = 'Guest';
  }
  
  // ✅ Apply mobile header styles after reset
  applyMobileHeaderStyles();
}

// ============================================
// FIXED: Load content with ACCURATE counts from source tables
// ✅ CRITICAL: Include user_profiles with avatar_url
// ============================================
async function loadContentFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id') || '68';
  
  try {
    // ✅ CRITICAL: Ensure user_profiles includes avatar_url
    const { data: contentData, error: contentError } = await window.supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          full_name,
          username,
          avatar_url
        )
      `)
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
      // ✅ CRITICAL: Include full user_profiles object with avatar_url
      user_profiles: contentData.user_profiles,
      watch_progress: watchProgress?.last_position || 0,
      is_completed: watchProgress?.is_completed || false,
      // PHASE 4: Streaming data
      quality_profiles: streamingData?.quality_profiles || [],
      hls_manifest_url: streamingData?.hls_manifest_url || null,
      data_saver_url: streamingData?.data_saver_url || null
    };
    
    console.log('📥 Content loaded with ACCURATE counts and creator data:', {
      views: currentContent.views_count,
      likes: currentContent.likes_count,
      creator: currentContent.creator,
      creator_id: currentContent.creator_id,
      has_avatar: !!currentContent.user_profiles?.avatar_url,
      avatar_url: currentContent.user_profiles?.avatar_url,
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

// ============================================
// 🎯 FIXED: Update Content UI with Creator Avatar
// ============================================
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
  
  // ============================================
  // ✅ CRITICAL FIX: SET CREATOR AVATAR
  // ============================================
  const creatorAvatar = document.getElementById('creatorAvatar');
  if (creatorAvatar && content.user_profiles) {
    const avatarUrl = content.user_profiles.avatar_url;
    const displayName = content.user_profiles.full_name || content.user_profiles.username || 'Creator';
    const initial = displayName.charAt(0).toUpperCase();
    
    if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
      const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl) || avatarUrl;
      creatorAvatar.innerHTML = `
        <img src="${fixedAvatarUrl}"
             alt="${escapeHtml(displayName)}"
             style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
      `;
      console.log('✅ Creator avatar set from URL:', fixedAvatarUrl);
    } else {
      creatorAvatar.innerHTML = `
        <div style="
          width:100%;
          height:100%;
          border-radius:50%;
          background:linear-gradient(135deg, #1D4ED8, #F59E0B);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-weight:bold;
          font-size:1.5rem;
        ">${initial}</div>
      `;
      console.log('✅ Creator avatar fallback to initials:', initial);
    }
  } else {
    console.warn('⚠️ Creator avatar element or user_profiles not found:', {
      hasCreatorAvatar: !!document.getElementById('creatorAvatar'),
      hasUserProfiles: !!content.user_profiles
    });
  }
  
  // ============================================
  // ✅ CRITICAL FIX: MAKE CREATOR SECTION CLICKABLE
  // ============================================
  const creatorSection = document.querySelector('.creator-section');
  const creatorInfo = document.querySelector('.creator-info');
  if (creatorSection && content.creator_id) {
    creatorSection.style.cursor = 'pointer';
    if (creatorInfo) {
      const newCreatorInfo = creatorInfo.cloneNode(true);
      creatorInfo.parentNode.replaceChild(newCreatorInfo, creatorInfo);
      newCreatorInfo.addEventListener('click', function(e) {
        if (e.target.closest('.connect-btn')) return;
        window.location.href = `creator-channel.html?id=${content.creator_id}&name=${encodeURIComponent(content.creator_display_name)}`;
      });
    }
  }
  
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
}

// ✅ FIXED: loadComments - REMOVED creator_id from update
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
    
    // ✅ FIXED: Update comments_count - NO creator_id condition
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
// 🎯 CLOSE PLAYER FUNCTION (UPDATED)
// ============================================
function closeVideoPlayer() {
  const player = document.getElementById('inlinePlayer');
  const video = document.getElementById('inlineVideoPlayer');
  
  if (player) {
    player.style.display = 'none';
  }
  
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
  
  if (viewValidationTimer) {
    clearTimeout(viewValidationTimer);
    viewValidationTimer = null;
  }
  
  const placeholder = document.getElementById('videoPlaceholder');
  if (placeholder) {
    placeholder.style.display = 'flex';
  }
  
  const heroPoster = document.getElementById('heroPoster');
  if (heroPoster) {
    heroPoster.style.opacity = '1';
  }
  
  const closeFromHero = document.getElementById('closePlayerFromHero');
  if (closeFromHero) {
    closeFromHero.style.display = 'none';
  }
  
  const hero = document.querySelector('.content-hero');
  if (hero) {
    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
  
  const closeFromHero = document.getElementById('closePlayerFromHero');
  if (closeFromHero) {
    closeFromHero.addEventListener('click', function() {
      closeVideoPlayer();
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
  // LIKE BUTTON - RLS-COMPLIANT, TRIGGER-INDEPENDENT ✅
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
          const { error: insertError } = await window.supabaseClient
            .from('content_likes')
            .insert({ 
              user_id: userProfile.id, 
              content_id: currentContent.id 
            });
          if (insertError) throw insertError;
        } else {
          const { error: deleteError } = await window.supabaseClient
            .from('content_likes')
            .delete()
            .eq('user_id', userProfile.id)
            .eq('content_id', currentContent.id);
          if (deleteError) throw deleteError;
        }
        
        const { count, error: countError } = await window.supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', currentContent.id);
        
        if (countError) throw countError;
        
        if (likesCountEl) {
          likesCountEl.textContent = formatNumber(count || 0);
        }
        
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
      
      const shareText = `📺 ${currentContent.title}
${currentContent.description || 'Check out this amazing content!'}
👉 Watch on Bantu Stream Connect
NO DNA, JUST RSA
`;
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
// ✅ FIXED: Always returns a Promise to prevent ".then is not a function" error
// ====================================================
function setupConnectButtons() {
  function checkConnectionStatus(creatorId) {
    return new Promise(async (resolve) => {
      if (!window.AuthHelper?.isAuthenticated() || !creatorId) {
        resolve(false);
        return;
      }
      
      const userProfile = window.AuthHelper.getUserProfile();
      if (!userProfile?.id) {
        resolve(false);
        return;
      }
      
      try {
        const { data, error } = await window.supabaseClient
          .from('connectors')
          .select('id')
          .eq('connector_id', userProfile.id)
          .eq('connected_id', creatorId)
          .single();
        
        resolve(!error && data !== null);
      } catch (err) {
        console.warn('Connection check error:', err);
        resolve(false);
      }
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
        const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
        if (shouldLogin) {
          window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }
        return;
      }
      
      const userProfile = window.AuthHelper.getUserProfile();
      if (!userProfile?.id) {
        showToast('User profile not found', 'error');
        return;
      }
      
      const isConnected = connectBtn.classList.contains('connected');
      
      try {
        if (isConnected) {
          const { error } = await window.supabaseClient
            .from('connectors')
            .delete()
            .eq('connector_id', userProfile.id)
            .eq('connected_id', currentContent.creator_id);
          if (error) throw error;
          
          connectBtn.classList.remove('connected');
          connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
          showToast('Disconnected', 'info');
        } else {
          const { error } = await window.supabaseClient
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
        const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
        if (shouldLogin) {
          window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        }
        return;
      }
      
      const userProfile = window.AuthHelper.getUserProfile();
      if (!userProfile?.id) {
        showToast('User profile not found', 'error');
        return;
      }
      
      const isConnected = connectCreatorBtn.classList.contains('connected');
      
      try {
        if (isConnected) {
          const { error } = await window.supabaseClient
            .from('connectors')
            .delete()
            .eq('connector_id', userProfile.id)
            .eq('connected_id', currentContent.creator_id);
          if (error) throw error;
          
          connectCreatorBtn.classList.remove('connected');
          connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
          showToast('Disconnected', 'info');
        } else {
          const { error } = await window.supabaseClient
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

// 🔧 PHASE 1: Page unload handler - clean up watch session and validation timer
window.addEventListener('beforeunload', function() {
  if (viewValidationTimer) {
    clearTimeout(viewValidationTimer);
  }
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

// Export key functions that need to be accessible globally
window.hasViewedContentRecently = hasViewedContentRecently;
window.markContentAsViewed = markContentAsViewed;
window.recordContentView = recordContentView;
window.refreshCountsFromSource = refreshCountsFromSource;
window.clearViewCache = clearViewCache;
window.closeVideoPlayer = closeVideoPlayer;
window.debugSessionData = debugSessionData;
window.updateCommentInputState = updateCommentInputState;

console.log('✅ Content detail core script loaded with PHASE 4 STREAMING MANAGER integration, PHASE 1-3 POLISH, 🎵 AUDIO SUPPORT, 🎨 CREATOR AVATAR FIX, 🔧 VIEW VALIDATION WITH SESSION_ID');
