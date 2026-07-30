// ============================================
// SHORTS DETAIL JAVASCRIPT - BANTU STREAM CONNECT
// UPDATED: Cloudflare Stream/R2 support
// UPDATED: View recording with RPC
// UPDATED: Proper video URL handling
// ============================================

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Self-contained dark-theme placeholder thumbnails (plain SVG data URIs) -
// used only when a content item has no thumbnail_url, instead of a
// third-party stock-image service (via.placeholder.com): no external
// runtime dependency, no network round-trip, and it actually matches the
// platform's dark background instead of a generic gray box.
const PLACEHOLDER_THUMB_SQUARE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23151b21'/%3E%3C/svg%3E";
const PLACEHOLDER_THUMB_TALL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='700'%3E%3Crect width='400' height='700' fill='%23151b21'/%3E%3C/svg%3E";

// Global state
let supabaseClient = null;
let currentUser = null;
let shortsData = [];
let currentShort = null;
let currentVideo = null;
// Starts muted - every browser blocks unmuted autoplay without a user
// gesture first (confirmed: every video was hitting "Autoplay prevented"
// and just sitting paused, which is why nothing ever played long enough to
// cross the view-recording threshold). Muted autoplay is allowed
// everywhere and is the standard TikTok/Reels/Shorts convention anyway -
// the mute button lets the user opt into sound.
let isMuted = true;
let isPlaying = true;
let userConnections = new Set();
let hiddenShortIds = new Set(); // session-only "Not Interested" hides, not persisted server-side
let moreMenuOpen = false;
let lastTapTime = 0;
let connectionFailed = false;
let swiperInstance = null;
let initTimeout = null;
let authCheckComplete = false;
let hasRecordedView = false; // Track if view has been recorded for current video
let viewThresholdReached = false;
let playbackSessionId = null;
let feedMode = 'foryou'; // 'foryou' | 'following'
let eventListenersInitialized = false;

// Loading progress tracking
let loadingProgress = 0;
const loadingSteps = [
  { name: 'Initializing...', progress: 10 },
  { name: 'Checking connection...', progress: 25 },
  { name: 'Loading shorts...', progress: 50 },
  { name: 'Almost ready...', progress: 75 },
  { name: 'Starting player...', progress: 90 }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎬 DOMContentLoaded - Starting initialization');
  updateLoadingProgress('Initializing...', 10);
  
  // Set timeout for initialization
  initTimeout = setTimeout(() => {
    if (!authCheckComplete) {
      console.warn('⚠️ Initialization timeout - showing fallback');
      connectionFailed = true;
      hideLoadingScreen(true, 'Connection timeout. Showing offline content.');
    }
  }, 8000);
  
  initSupabase();
});

// Update loading progress
function updateLoadingProgress(text, progress) {
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('loading-progress-bar');
  
  if (loadingText) loadingText.textContent = text;
  if (progressBar) progressBar.style.width = progress + '%';
  loadingProgress = progress;
}

// Initialize Supabase
function initSupabase() {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: localStorage
      },
      global: {
        headers: { 'apikey': SUPABASE_ANON_KEY }
      }
    });
    console.log('✅ Supabase client initialized');
    
    updateLoadingProgress('Checking connection...', 25);
    
    // Test connection with timeout
    testConnection();
    
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    connectionFailed = true;
    useFallbackData();
  }
}

// Test Supabase connection
async function testConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const { error } = await supabaseClient
      .from('Content')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('❌ Connection test failed:', error);
      connectionFailed = true;
      useFallbackData();
    } else {
      console.log('✅ Connection test passed');
      connectionFailed = false;
      checkAuth();
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    connectionFailed = true;
    useFallbackData();
  }
}

// Check authentication
async function checkAuth() {
  updateLoadingProgress('Checking authentication...', 35);
  
  try {
    const authPromise = supabaseClient.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 3000)
    );
    
    const result = await Promise.race([authPromise, timeoutPromise]);
    const session = result?.data?.session;
    
    currentUser = session?.user || null;
    console.log('✅ Auth state:', currentUser ? 'signed in' : 'guest');
    
    authCheckComplete = true;
    clearTimeout(initTimeout);
    
    if (currentUser) {
      updateLoadingProgress('Loading profile...', 45);
      await loadUserProfilePicture(currentUser);
      await loadUserNotifications();
      await fetchUserConnections();
    }
    
    // Load shorts
    loadShorts();
    
  } catch (error) {
    console.warn('⚠️ Auth check failed, continuing as guest:', error);
    currentUser = null;
    authCheckComplete = true;
    clearTimeout(initTimeout);
    loadShorts();
  }
}

// ============================================
// 🚨 CRITICAL: Get Playable Media URL for Shorts
// Supports Cloudflare Stream, Cloudflare R2, and legacy
// ============================================
function getPlayableMediaUrl(content) {
  if (!content) return '';
  
  // 🎬 Cloudflare Stream Video - Return HLS manifest URL
  if (content.streaming_provider === 'cloudflare_stream' && content.provider_video_id) {
    const videoId = content.provider_video_id;
    return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
  }
  
  // 🎵 Cloudflare R2 Audio - Return file_url (but shorts should be video)
  if (content.streaming_provider === 'cloudflare_r2' && content.file_url) {
    return fixMediaUrl(content.file_url);
  }
  
  // 🔄 Legacy fallback: file_url
  if (content.file_url) {
    return fixMediaUrl(content.file_url);
  }
  
  return '';
}

// ============================================
// Reads ?id= from the URL - the target of a search result click
// (renderSearchResults) or a share link (updateShareLink generates
// shorts-detail.html?id=X). Previously nothing on this page ever read it,
// so clicking a search result or opening a shared link just landed on the
// generic feed instead of the thing the user actually chose - which is
// exactly why search looked completely broken end to end.
function getRequestedShortId() {
  return new URLSearchParams(window.location.search).get('id');
}

async function fetchRequestedShort(id) {
  try {
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments,
          total_shares
        )
      `)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching requested short:', error);
    return null;
  }
}

// Load shorts from Supabase
// ============================================
async function loadShorts() {
  updateLoadingProgress('Loading shorts...', 50);

  try {
    const requestedId = getRequestedShortId();
    const requestedShort = requestedId ? await fetchRequestedShort(requestedId) : null;

    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments,
          total_shares
        )
      `)
      .eq('status', 'published')
      .in('media_type', ['video', 'audio', 'short'])
      .lte('duration', 60)
      .neq('id', requestedShort?.id || 0)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (data && data.length > 0) {
      // Requested short (search result / share link) plays first, ahead of
      // the general feed - not buried wherever it happens to fall in
      // created_at order, or missing entirely if it doesn't match.
      shortsData = requestedShort ? [requestedShort, ...data] : data;

      if (currentUser) {
        const { data: blocks } = await supabaseClient
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', currentUser.id);
        const blockedIds = new Set((blocks || []).map(b => b.blocked_id));
        if (blockedIds.size > 0) {
          shortsData = shortsData.filter(s => !blockedIds.has(s.user_id));
        }
      }

      console.log(`✅ Loaded ${shortsData.length} shorts`);
      
      // Cache the data
      try {
        localStorage.setItem('shorts_cache', JSON.stringify({
          data: shortsData,
          timestamp: Date.now()
        }));
      } catch (e) {}
      
      updateLoadingProgress('Loading interactions...', 75);
      await loadShortMetrics(shortsData);
      await applyUserEngagementState(shortsData);
      computeTrending(shortsData);

      updateLoadingProgress('Rendering...', 90);
      renderShorts();
      
      setTimeout(() => {
        initSwiper();
        hideLoadingScreen();
      }, 500);
      
    } else {
      console.log('No shorts found, using fallback');
      useFallbackData();
    }
    
  } catch (error) {
    console.error('❌ Error loading shorts:', error);
    useFallbackData();
  }
}

// Real engagement counts + creator verification for a batch of shorts, used
// for both the initial load and loadMoreShorts - one shared function
// instead of two near-identical copies that could drift.
//
// views/likes/comments/shares now come from the content_engagement_stats
// embed added to the Content select above - the exact same source of truth
// content-detail.js uses (fetchContentProfileDetails/loadLiveEngagementCounts),
// instead of a separate per-short content_likes count query and the raw
// (often stale) Content.views_count/comments_count columns. Save count
// switched from saved_shorts to watch_later, matching content-detail's own
// bookmark-icon "Save" button (#watchLaterBtn), which is watch_later, not a
// shorts-only table.
async function loadShortMetrics(shorts) {
  if (!shorts || !shorts.length) return;

  const contentIds = shorts.map(s => s.id);
  // is_verified/is_creator_verified live on the real "creators" table
  // (keyed by the same id as auth.users/user_profiles), not on
  // user_profiles itself - confirmed against the live schema.
  const creatorIds = [...new Set(shorts.map(s => s.user_profiles?.id).filter(Boolean))];

  const [saveCounts, creatorVerification] = await Promise.all([
    Promise.all(contentIds.map(async (id) => {
      try {
        const { count } = await supabaseClient
          .from('watch_later')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', id);
        return { id, count: count || 0 };
      } catch (e) {
        return { id, count: 0 };
      }
    })),
    (async () => {
      if (!creatorIds.length) return [];
      try {
        const { data, error } = await supabaseClient
          .from('creators')
          .select('id, is_verified, is_creator_verified')
          .in('id', creatorIds);
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    })()
  ]);

  const verificationByCreatorId = {};
  creatorVerification.forEach(row => { verificationByCreatorId[row.id] = row; });

  saveCounts.forEach(({ id, count }) => {
    const short = shorts.find(s => s.id === id);
    if (short) short.real_saves_count = count;
  });

  shorts.forEach(short => {
    const stats = short.content_engagement_stats;
    short.views_count = stats?.total_views || 0;
    short.real_likes_count = stats?.total_likes || 0;
    short.comments_count = stats?.total_comments || 0;
    short.real_shares_count = stats?.total_shares || 0;

    const verification = verificationByCreatorId[short.user_profiles?.id];
    if (verification && short.user_profiles) {
      short.user_profiles.is_verified = verification.is_verified;
      short.user_profiles.is_creator_verified = verification.is_creator_verified;
    }
  });
}

// Bulk-fetch which of the currently loaded shorts the signed-in user has
// already liked/saved, baked directly into the initial slide markup
// (buildSlideHTML) instead of being checked asynchronously per-slide after
// render. The old per-active-slide check (updateLikeButton/updateSaveButton,
// fired from Swiper's slideChange) never ran for the very first slide
// (slideChange doesn't fire on init), which is exactly why a like a user
// had already made didn't always show as liked - this fixes that by making
// the state part of the data the card is built from, the same way
// content-detail.js's loadAllEngagementStates() bulk-loads
// liked/favorited/watchLater state up front rather than checking on demand.
async function applyUserEngagementState(shorts) {
  if (!shorts || !shorts.length || !currentUser) {
    shorts?.forEach(s => { s.is_liked = false; s.is_saved = false; });
    return;
  }

  const contentIds = shorts.map(s => s.id);

  const [likedRows, savedRows] = await Promise.all([
    (async () => {
      try {
        const { data, error } = await supabaseClient
          .from('content_likes')
          .select('content_id')
          .eq('user_id', currentUser.id)
          .in('content_id', contentIds);
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    })(),
    (async () => {
      try {
        const { data, error } = await supabaseClient
          .from('watch_later')
          .select('content_id')
          .eq('user_id', currentUser.id)
          .in('content_id', contentIds);
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    })()
  ]);

  const likedIds = new Set(likedRows.map(r => r.content_id));
  const savedIds = new Set(savedRows.map(r => r.content_id));

  shorts.forEach(short => {
    short.is_liked = likedIds.has(short.id);
    short.is_saved = savedIds.has(short.id);
  });
}

// Marks the top ~30% of the currently loaded batch by real views_count as
// "trending" - a real relative signal computed from real fetched data, not a
// fixed label shown on every card (matches the .trending-badge only
// appearing for genuinely high-performing content on the home feed's
// Trending Now rail).
function computeTrending(shorts) {
  if (!shorts || shorts.length < 4) {
    shorts?.forEach(s => { s.is_trending = false; });
    return;
  }
  const sortedViews = shorts.map(s => s.views_count || 0).sort((a, b) => a - b);
  const thresholdIndex = Math.floor(sortedViews.length * 0.7);
  const threshold = sortedViews[thresholdIndex];
  shorts.forEach(short => {
    short.is_trending = (short.views_count || 0) >= threshold && threshold > 0;
  });
}

// Extracts real #hashtags already present in the caption text (never
// fabricates extra ones) and wraps them in a styled span. Escapes first so
// this is safe against caption text containing HTML-significant characters.
function renderCaptionWithHashtags(text) {
  const escaped = escapeHtml(text || '');
  return escaped.replace(/#\w+/g, match => `<span class="hashtag">${match}</span>`);
}

// ============================================
// FOR YOU / FOLLOWING TABS
// ============================================
function initFeedTabs() {
  const tabs = document.querySelectorAll('.feed-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.feed;
      if (mode === feedMode) return;

      feedMode = mode;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      pauseAllVideos();

      if (mode === 'foryou') {
        loadShorts();
      } else {
        fetchFollowingShorts();
      }
    });
  });
}

// Following feed - genuinely filtered to creators the current user follows
// (userConnections, populated in fetchUserConnections() during checkAuth()),
// not a copy of For You. Honest empty states instead of silently showing
// nothing or falling back to unrelated content.
async function fetchFollowingShorts() {
  if (!currentUser) {
    renderFeedEmptyState('Sign in to follow creators and see their shorts here.', true);
    return;
  }

  if (userConnections.size === 0) {
    renderFeedEmptyState('Follow creators to see their shorts here.', false);
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments,
          total_shares
        )
      `)
      .in('user_id', Array.from(userConnections))
      .eq('status', 'published')
      .in('media_type', ['video', 'audio', 'short'])
      .lte('duration', 60)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (data && data.length > 0) {
      shortsData = data;
      await loadShortMetrics(shortsData);
      await applyUserEngagementState(shortsData);
      computeTrending(shortsData);
      renderShorts();
      initSwiper();
    } else {
      renderFeedEmptyState('No shorts yet from creators you follow.', false);
    }
  } catch (error) {
    console.error('Error loading Following feed:', error);
    showToast('Failed to load Following feed', 'error');
  }
}

function renderFeedEmptyState(message, showSignIn) {
  const wrapper = document.getElementById('shorts-wrapper');
  if (!wrapper) return;

  if (swiperInstance) {
    swiperInstance.destroy(true, false);
    swiperInstance = null;
  }

  wrapper.innerHTML = `
    <div class="swiper-slide">
      <div class="feed-empty-state">
        <i class="fas fa-user-friends"></i>
        <p>${escapeHtml(message)}</p>
        ${showSignIn ? `<button class="fallback-btn" onclick="window.location.href='login.html?redirect=${encodeURIComponent(window.location.pathname)}'">Sign In</button>` : ''}
      </div>
    </div>
  `;

  const segments = document.getElementById('shorts-progress-segments');
  if (segments) segments.innerHTML = '';
}

// Use fallback/cached data
function useFallbackData() {
  console.log('📦 Using fallback data');
  
  // Try cache first
  try {
    const cached = localStorage.getItem('shorts_cache');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 24 hours
        shortsData = data;
        console.log('✅ Using cached shorts');
        renderShorts();
        setTimeout(() => {
          initSwiper();
          hideLoadingScreen();
          showToast('Showing cached content', 'info');
        }, 500);
        return;
      }
    }
  } catch (e) {}
  
  // Use test data
  shortsData = [
    {
      id: 'test-1',
      title: 'Welcome to Bantu Shorts',
      description: 'Discover amazing short-form content from creators across Africa. Swipe up to see more!',
      file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=700&fit=crop',
      duration: 596,
      views_count: 1250,
      likes_count: 89,
      comments_count: 12,
      real_likes_count: 89,
      created_at: new Date().toISOString(),
      genre: 'Original Audio',
      user_profiles: {
        id: 'test-creator',
        username: 'bantuteam',
        full_name: 'Bantu Team',
        avatar_url: null
      }
    },
    {
      id: 'test-2',
      title: 'Creator Tips',
      description: 'Learn how to grow your audience on Bantu Stream Connect with these pro tips! 🚀',
      file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81?w=400&h=700&fit=crop',
      duration: 653,
      views_count: 3420,
      likes_count: 234,
      comments_count: 45,
      real_likes_count: 234,
      created_at: new Date().toISOString(),
      genre: 'Education',
      user_profiles: {
        id: 'test-creator2',
        username: 'creatorschool',
        full_name: 'Creator School',
        avatar_url: null
      }
    }
  ];
  
  renderShorts();
  setTimeout(() => {
    initSwiper();
    hideLoadingScreen();
    showToast('Showing demo content', 'info');
  }, 500);
}

// Render shorts to DOM
// Shared markup builder - both the initial batch render and loadMoreShorts()
// used to carry two independently-hand-written copies of this markup
// (renderShorts()'s inline template vs createShortSlide()), which is exactly
// the kind of hidden-duplicate drift risk this platform has been bitten by
// before. One function now, used by both.
function buildSlideHTML(short, index) {
  const creator = short.user_profiles || {};
  const videoUrl = getPlayableMediaUrl(short);
  const isCloudflareStream = short.streaming_provider === 'cloudflare_stream';
  const thumbnailUrl = short.thumbnail_url ? fixMediaUrl(short.thumbnail_url) : '';
  const creatorName = creator.full_name || creator.username || 'Creator';
  const initials = getInitials(creatorName);
  const isConnected = currentUser && userConnections.has(creator.id);
  const isVerified = !!(creator.is_verified || creator.is_creator_verified);
  const videoType = isCloudflareStream ? 'application/vnd.apple.mpegurl' : 'video/mp4';

  const avatarHtml = creator.avatar_url
    ? `<img src="${fixMediaUrl(creator.avatar_url)}" alt="${escapeHtml(creatorName)}" loading="lazy">`
    : `<span>${initials}</span>`;

  return `
    <div class="swiper-slide" data-short-id="${short.id}" data-index="${index}">
      <div class="short-video-wrapper">
        <video
          class="short-video"
          src="${videoUrl}"
          poster="${thumbnailUrl}"
          loop
          muted
          playsinline
          preload="metadata"
          data-short-id="${short.id}"
          data-provider="${short.streaming_provider || 'legacy'}"
          ${isCloudflareStream ? `type="${videoType}"` : ''}
        ></video>
        <div class="video-overlay"></div>

        ${short.is_trending ? `<div class="trending-badge-short"><i class="fas fa-bolt"></i> Trending</div>` : ''}

        <button class="control-btn mute-btn-float" title="Unmute">
          <i class="fas fa-volume-mute"></i>
        </button>

        <!-- Actions (Right Side) - liked/saved state is baked in here from
             applyUserEngagementState() (bulk-loaded before render), not
             checked asynchronously per-slide after the fact. -->
        <div class="shorts-actions">
          <button class="action-btn like-btn ${short.is_liked ? 'liked' : ''}" data-action="like" data-short-id="${short.id}" title="Like">
            <i class="${short.is_liked ? 'fas' : 'far'} fa-heart"></i>
            <span class="action-count">${formatNumber(short.real_likes_count || 0)}</span>
          </button>

          <button class="action-btn comment-btn" data-action="comment" data-short-id="${short.id}" title="Comments">
            <i class="far fa-comment"></i>
            <span class="action-count">${formatNumber(short.comments_count || 0)}</span>
          </button>

          <button class="action-btn share-btn" data-action="share" data-short-id="${short.id}" title="Share">
            <i class="fas fa-paper-plane"></i>
            <span class="action-count">${formatNumber(short.real_shares_count || 0)}</span>
          </button>

          <button class="action-btn save-btn ${short.is_saved ? 'saved' : ''}" data-action="save" data-short-id="${short.id}" title="Save">
            <i class="${short.is_saved ? 'fas' : 'far'} fa-bookmark"></i>
            <span class="action-count">${formatNumber(short.real_saves_count || 0)}</span>
          </button>

          <button class="control-btn more-btn" data-short-id="${short.id}" title="More options">
            <i class="fas fa-ellipsis-h"></i>
          </button>

          <div class="sound-disc" data-creator-id="${creator.id}" title="${escapeHtml(creatorName)}">
            ${avatarHtml}
          </div>
        </div>

        <!-- Creator Info & Caption -->
        <div class="shorts-info">
          <div class="creator-info" data-creator-id="${creator.id}" data-creator-name="${escapeHtml(creatorName)}">
            <div class="creator-avatar">
              ${avatarHtml}
            </div>
            <div class="creator-details">
              <div class="creator-name">
                ${escapeHtml(creatorName)}
                ${isVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified"></i>' : ''}
              </div>
              <div class="creator-username">@${escapeHtml(creator.username || 'creator')}</div>
            </div>
            <button class="connect-btn ${isConnected ? 'connected' : ''}" data-creator-id="${creator.id}">
              <i class="fas fa-user-friends"></i>
              <span>${isConnected ? 'Connected' : 'Connect'}</span>
            </button>
          </div>

          <div class="shorts-caption" id="caption-${short.id}">
            ${renderCaptionWithHashtags(short.description || short.title || 'No description')}
          </div>
          ${(short.description?.length > 100 || short.title?.length > 100) ? `
            <button class="caption-toggle" data-caption-id="caption-${short.id}">
              more
            </button>
          ` : ''}

          <div class="sound-pill">
            <i class="fas fa-music"></i>
            <span>Original Sound &middot; ${escapeHtml(creatorName)}</span>
          </div>

          <div class="shorts-meta">
            <span><i class="fas fa-eye"></i> ${formatNumber(short.views_count || 0)}</span>
          </div>
        </div>

        <!-- Video Controls -->
        <div class="video-controls">
          <div class="progress-container">
            <div class="progress-buffer"></div>
            <div class="progress-bar"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderShorts() {
  const wrapper = document.getElementById('shorts-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = shortsData.map((short, index) => buildSlideHTML(short, index)).join('');
}

// ============================================
// SEGMENTED PROGRESS BAR (Instagram Stories-style)
// One segment per short currently loaded in shortsData. The active
// segment's fill is driven by real video playback (handleTimeUpdate above),
// not a fixed timer - segments before it are fully filled (already
// watched), after it are empty (upcoming).
// ============================================
function renderProgressSegments() {
  const container = document.getElementById('shorts-progress-segments');
  if (!container || !shortsData.length) return;

  container.innerHTML = shortsData.map(() => `
    <div class="progress-segment"><div class="progress-segment-fill"></div></div>
  `).join('');

  updateProgressSegmentsActive();
}

// Called when loadMoreShorts() appends additional shorts to an already
// rendered queue, so existing segments (and their watched state) aren't
// rebuilt from scratch.
function appendProgressSegments(count) {
  const container = document.getElementById('shorts-progress-segments');
  if (!container) return;

  for (let i = 0; i < count; i++) {
    container.insertAdjacentHTML('beforeend', `
      <div class="progress-segment"><div class="progress-segment-fill"></div></div>
    `);
  }
}

function updateProgressSegmentsActive() {
  const container = document.getElementById('shorts-progress-segments');
  const activeSlide = document.querySelector('.swiper-slide-active');
  if (!container || !activeSlide) return;

  const activeIndex = parseInt(activeSlide.dataset.index, 10) || 0;
  const segments = container.querySelectorAll('.progress-segment');

  segments.forEach((segment, i) => {
    const fill = segment.querySelector('.progress-segment-fill');
    segment.classList.remove('active', 'watched');
    if (i < activeIndex) {
      segment.classList.add('watched');
      if (fill) fill.style.width = '100%';
    } else if (i === activeIndex) {
      segment.classList.add('active');
      if (fill) fill.style.width = '0%';
    } else {
      if (fill) fill.style.width = '0%';
    }
  });
}

// Initialize Swiper - safe to call again (e.g. on For You/Following tab
// switch): destroys any previous instance first instead of stacking a
// second Swiper on the same element.
function initSwiper() {
  if (typeof Swiper === 'undefined') {
    console.error('Swiper not loaded');
    setTimeout(initSwiper, 100);
    return;
  }

  if (swiperInstance) {
    swiperInstance.destroy(true, false);
    swiperInstance = null;
  }

  swiperInstance = new Swiper('.shorts-swiper', {
    direction: 'vertical',
    loop: false,
    speed: 300,
    mousewheel: true,
    keyboard: {
      enabled: true,
      onlyInViewport: false
    },
    on: {
      init: function() {
        console.log('✅ Swiper initialized');
        renderProgressSegments();
        setTimeout(() => playCurrentShort(), 300);
      },
      slideChange: function() {
        pauseAllVideos();
        hasRecordedView = false;
        viewThresholdReached = false;
        playbackSessionId = null;
        setTimeout(() => playCurrentShort(), 100);
        updateProgressSegmentsActive();
        closeMoreMenu();
      },
      reachEnd: function() {
        if (feedMode === 'foryou') loadMoreShorts();
      }
    }
  });

  if (!eventListenersInitialized) {
    setupEventListeners();
    initFeedTabs();
    // Search/notifications buttons live outside the swiper and never get
    // recreated on tab switch - only wire them up once.
    initSearchModal();
    initNotificationsPanel();
    eventListenersInitialized = true;
  }
}

// ============================================
// SEARCH FUNCTIONS
// Ported from js/shared-components.js - the same search engine
// content-detail.html and trending_screen.html use (creators + content
// split results, filter pills, recent-search history, trending
// suggestions) - instead of shorts-detail running its own separate,
// weaker implementation. Result clicks route to shorts-detail.html for
// short-form results (duration <= 60s) and content-detail.html for
// long-form ones, since this page can only play shorts.
// ============================================
let searchDebounceTimer = null;
let searchHistory = JSON.parse(localStorage.getItem('bantu_search_history')) || [];
let activeSearchFilters = { category: '', sort: 'newest' };

function initSearchModal() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  const closeBtn = document.getElementById('close-search-btn');
  const searchTriggerBtn = document.getElementById('search-btn');

  if (!modal || !input) return;

  if (searchTriggerBtn) searchTriggerBtn.addEventListener('click', () => openSearchModal(modal, input));
  if (closeBtn) closeBtn.addEventListener('click', () => closeSearchModal(modal));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSearchModal(modal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeSearchModal(modal);
  });

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);
    if (query.length === 0) { renderSearchZeroState(); return; }
    searchDebounceTimer = setTimeout(() => performAdvancedSearch(query), 350);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length === 0) renderSearchZeroState();
  });

  setupSearchFilterPills(input);
}

function openSearchModal(modal, input) {
  modal.classList.add('active');
  setTimeout(() => input.focus(), 50);
  if (input.value.trim().length === 0) renderSearchZeroState();
}

function closeSearchModal(modal) {
  modal.classList.remove('active');
}

function setupSearchFilterPills(inputElement) {
  document.querySelectorAll('.search-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.dataset.filterGroup;
      const value = pill.dataset.filterValue;

      document.querySelectorAll(`.search-filter-pill[data-filter-group="${group}"]`)
        .forEach(sibling => sibling.classList.remove('active'));
      pill.classList.add('active');
      activeSearchFilters[group] = value;

      const currentQuery = inputElement.value.trim();
      if (currentQuery.length >= 2) performAdvancedSearch(currentQuery);
    });
  });
}

function renderSearchZeroState() {
  const resultsGrid = document.getElementById('search-results-grid');
  if (!resultsGrid) return;

  resultsGrid.innerHTML = `
    <div class="search-zero-state-container">
      <div class="search-history-section">
        <div class="section-header-row">
          <h4>Recent Searches</h4>
          ${searchHistory.length > 0 ? `<button class="clear-history-btn" id="clear-search-history-btn">Clear All</button>` : ''}
        </div>
        <div class="history-pills-container">
          ${searchHistory.length === 0 ?
            `<p class="neutral-placeholder-text">Your recent searches will show up here.</p>` :
            searchHistory.map(term => `
              <span class="history-pill" data-term="${escapeHtml(term)}">
                <i class="fas fa-history"></i> <span class="term-text">${escapeHtml(term)}</span>
              </span>
            `).join('')
          }
        </div>
      </div>
      <div class="search-trending-section">
        <h4>Trending Now</h4>
        <div id="trending-search-placeholder" class="trending-mini-grid">
          <div class="loading-spinner-small"></div>
        </div>
      </div>
    </div>
  `;

  resultsGrid.querySelector('#clear-search-history-btn')?.addEventListener('click', clearSearchHistory);
  resultsGrid.querySelectorAll('.history-pill').forEach(pill => {
    pill.addEventListener('click', () => triggerFastSearch(pill.dataset.term));
  });

  loadTrendingSearchItems();
}

async function loadTrendingSearchItems() {
  const placeholder = document.getElementById('trending-search-placeholder');
  if (!placeholder) return;

  try {
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        id,
        title,
        thumbnail_url,
        genre,
        content_engagement_stats!inner(total_views)
      `)
      .eq('status', 'published')
      .order('total_views', { referencedTable: 'content_engagement_stats', ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      placeholder.innerHTML = '<p class="neutral-placeholder-text">Checking live stream waves...</p>';
      return;
    }

    placeholder.innerHTML = data.map(item => `
      <div class="trending-mini-card" data-content-id="${item.id}">
        <img src="${fixMediaUrl(item.thumbnail_url) || PLACEHOLDER_THUMB_SQUARE}" alt="" onerror="this.src='${PLACEHOLDER_THUMB_SQUARE}'">
        <div class="mini-card-details">
          <h5>${escapeHtml(item.title)}</h5>
          <span>${formatNumber(item.content_engagement_stats?.total_views || 0)} views · ${escapeHtml(item.genre || 'Vibe')}</span>
        </div>
      </div>
    `).join('');

    placeholder.querySelectorAll('.trending-mini-card').forEach(card => {
      card.addEventListener('click', () => goToSearchResult(card.dataset.contentId));
    });

  } catch (err) {
    console.error('Failed to load search recommendations:', err.message);
    placeholder.innerHTML = '<p class="neutral-placeholder-text">Failed to fetch recommendations.</p>';
  }
}

async function performAdvancedSearch(query) {
  const resultsGrid = document.getElementById('search-results-grid');
  if (!resultsGrid) return;

  if (query.length < 2) {
    resultsGrid.innerHTML = `<div class="search-status-message"><p>Keep typing to search...</p></div>`;
    return;
  }

  resultsGrid.innerHTML = `
    <div class="search-loading-container">
      <div class="loading-spinner-small"></div>
      <p>Searching Bantu Stream...</p>
    </div>
  `;

  try {
    let creatorQuery = supabaseClient
      .from('user_profiles')
      .select('id, full_name, username, avatar_url, role')
      .eq('role', 'creator')
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(4);

    let contentQuery = supabaseClient
      .from('Content')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        duration,
        genre,
        media_type,
        created_at,
        user_id,
        user_profiles!inner(full_name, username, avatar_url),
        content_engagement_stats(total_views)
      `)
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,genre.ilike.%${query}%`);

    if (activeSearchFilters.category) contentQuery = contentQuery.eq('genre', activeSearchFilters.category);

    if (activeSearchFilters.sort === 'popular') {
      contentQuery = contentQuery.order('total_views', { referencedTable: 'content_engagement_stats', ascending: false });
    } else {
      contentQuery = contentQuery.order('created_at', { ascending: false });
    }

    contentQuery = contentQuery.limit(24);

    const [creatorsRes, contentRes] = await Promise.all([creatorQuery, contentQuery]);
    if (contentRes.error) throw contentRes.error;

    const localizedResults = (contentRes.data || []).map(row => ({
      ...row,
      total_views: row.content_engagement_stats?.total_views || 0
    }));

    saveSearchHistoryTerm(query);
    renderSplitSearchResults(creatorsRes.data || [], localizedResults, query);

  } catch (error) {
    console.error('Search error:', error);
    resultsGrid.innerHTML = `
      <div class="search-error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Something interrupted the search. Please try again.</p>
        <button id="search-retry-btn">Retry</button>
      </div>
    `;
    resultsGrid.querySelector('#search-retry-btn')?.addEventListener('click', () => performAdvancedSearch(query));
  }
}

function renderSplitSearchResults(creators, drops, query) {
  const resultsGrid = document.getElementById('search-results-grid');
  if (!resultsGrid) return;

  if (creators.length === 0 && drops.length === 0) {
    resultsGrid.innerHTML = `
      <div class="search-empty-state">
        <p>No results matching "<strong>${escapeHtml(query)}</strong>" found.</p>
        <span>Check your spelling or try different keywords.</span>
      </div>
    `;
    return;
  }

  const shorts = drops.filter(d => (d.duration || 0) <= 60 || d.media_type === 'short');
  const longForm = drops.filter(d => !((d.duration || 0) <= 60 || d.media_type === 'short'));

  resultsGrid.innerHTML = `
    <div class="split-search-matrix-wrapper">
      ${creators.length > 0 ? `
        <div class="split-section creators-split-track">
          <h4>Matching Creators</h4>
          <div class="creators-flex-row">
            ${creators.map(creator => `
              <div class="creator-mini-profile-card" data-creator-id="${creator.id}" data-creator-name="${escapeHtml(creator.full_name || creator.username || 'Creator')}">
                <img src="${creator.avatar_url || 'images/default-avatar.png'}" alt="">
                <div class="creator-meta">
                  <h6>${escapeHtml(creator.full_name || '')}</h6>
                  <span>@${escapeHtml(creator.username || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${shorts.length > 0 ? `
        <div class="split-section audio-split-track">
          <h4>Shorts</h4>
          <div class="premium-search-grid-layout">
            ${shorts.map(drop => generateSearchCardHtml(drop, false)).join('')}
          </div>
        </div>
      ` : ''}

      ${longForm.length > 0 ? `
        <div class="split-section drops-split-track">
          <h4>Videos &amp; Audio</h4>
          <div class="premium-search-grid-layout">
            ${longForm.map(drop => generateSearchCardHtml(drop, true)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  resultsGrid.querySelectorAll('.creator-mini-profile-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `creator-channel.html?id=${card.dataset.creatorId}&name=${encodeURIComponent(card.dataset.creatorName)}`;
    });
  });
  resultsGrid.querySelectorAll('.premium-search-card').forEach(card => {
    card.addEventListener('click', () => goToSearchResult(card.dataset.contentId, card.dataset.isLongForm === 'true'));
  });
}

function generateSearchCardHtml(drop, isLongForm) {
  const durationStr = drop.duration ? formatTime(drop.duration) : '';
  const creatorName = drop.user_profiles ? (drop.user_profiles.full_name || drop.user_profiles.username) : 'Creator';
  const viewCount = drop.total_views || 0;

  return `
    <div class="premium-search-card" data-content-id="${drop.id}" data-is-long-form="${isLongForm}">
      <div class="thumbnail-wrapper-frame">
        <img src="${fixMediaUrl(drop.thumbnail_url) || PLACEHOLDER_THUMB_TALL}" alt="" onerror="this.src='${PLACEHOLDER_THUMB_TALL}'">
        ${durationStr ? `<span class="premium-duration-badge">${durationStr}</span>` : ''}
      </div>
      <div class="premium-card-payload">
        <h5>${escapeHtml(drop.title)}</h5>
        <p class="premium-card-author-row">By <span>${escapeHtml(creatorName)}</span></p>
        <div class="premium-card-footer-metrics">
          <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)} views</span>
          <span class="genre-tag-node">${escapeHtml(drop.genre || 'Stream')}</span>
        </div>
      </div>
    </div>
  `;
}

function goToSearchResult(contentId, isLongForm = false) {
  if (!contentId) return;
  document.getElementById('search-modal')?.classList.remove('active');
  window.location.href = isLongForm ? `content-detail.html?id=${contentId}` : `shorts-detail.html?id=${contentId}`;
}

function saveSearchHistoryTerm(term) {
  if (!searchHistory.includes(term)) {
    searchHistory.unshift(term);
    if (searchHistory.length > 6) searchHistory.pop();
    localStorage.setItem('bantu_search_history', JSON.stringify(searchHistory));
  }
}

function triggerFastSearch(term) {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.value = term;
  performAdvancedSearch(term);
}

function clearSearchHistory() {
  searchHistory = [];
  localStorage.removeItem('bantu_search_history');
  renderSearchZeroState();
}

// ============================================
// NOTIFICATIONS FUNCTIONS
// ============================================
function initNotificationsPanel() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  notificationsBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    notificationsPanel.classList.add('active');
    if (currentUser) {
      await loadUserNotifications();
      setTimeout(() => markAllNotificationsAsRead(), 1000);
    } else {
      document.getElementById('notifications-list').innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>Sign in to see notifications</p>
        </div>`;
      updateNotificationBadge(0);
    }
  });
  
  closeNotifications?.addEventListener('click', () => {
    notificationsPanel.classList.remove('active');
  });
  
  markAllReadBtn?.addEventListener('click', () => {
    if (currentUser) {
      markAllNotificationsAsRead();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (notificationsPanel.classList.contains('active') &&
        !notificationsPanel.contains(e.target) &&
        !notificationsBtn.contains(e.target)) {
      notificationsPanel.classList.remove('active');
    }
  });
}

async function loadUserNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  if (!currentUser) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>Sign in to see notifications</p>
      </div>`;
    updateNotificationBadge(0);
    return;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      notificationsList.innerHTML = `
        <div class="empty-notifications">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>`;
      updateNotificationBadge(0);
      return;
    }
    
    notificationsList.innerHTML = data.map(notification => `
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
    `).join('');
    
    notificationsList.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await markNotificationAsRead(id);
        const notification = data.find(n => n.id === id);
        if (notification?.content_id) {
          notificationsPanel.classList.remove('active');
          window.location.href = `shorts-detail.html?id=${notification.content_id}`;
        }
      });
    });
    
    const unreadCount = data.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error loading notifications</p>
      </div>`;
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
  if (!currentUser) return;
  
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
    
    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    updateNotificationBadge(unreadCount);
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

async function markAllNotificationsAsRead() {
  if (!currentUser) return;
  
  try {
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
  }
}

function updateNotificationBadge(count = null) {
  if (count === null) {
    count = document.querySelectorAll('.notification-item.unread').length;
  }
  const badge = document.getElementById('notification-count');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function formatNotificationTime(timestamp) {
  const now = new Date();
  const diffMs = now - new Date(timestamp);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================
// 🚨 VIEW RECORDING FUNCTIONS (UPDATED)
// ============================================

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return 'shorts_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
}

/**
 * Get current user ID
 */
function getCurrentUserId() {
  if (currentUser?.id) return currentUser.id;
  if (window.currentUserId) return window.currentUserId;
  if (localStorage.getItem('userId')) return localStorage.getItem('userId');
  if (window.AuthHelper?.getCurrentUser) {
    const user = window.AuthHelper.getCurrentUser();
    if (user?.id) return user.id;
  }
  return null;
}

/**
 * Get device type
 */
function getDeviceType() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

/**
 * Record a view by inserting directly into content_views.
 *
 * This used to try an RPC (record_content_view) first. Verified against the
 * live database that this RPC name is overloaded - a legacy 2-argument
 * version (content_uuid, session_uuid) still exists alongside the current
 * 4-argument one this app actually calls, writes to a different, no-longer-
 * used table (unified_views), and returns a different JSON shape
 * ({views_count} instead of {views}). PostgREST cannot reliably resolve a
 * call to an overloaded function name, so this RPC call was silently never
 * completing - confirmed via 24h API logs: zero POST requests to
 * /rest/v1/rpc/record_content_view or /rest/v1/content_views ever appear,
 * despite playback sessions (a separate insert, unaffected by this)
 * succeeding repeatedly. On top of that, the fallback insert this used to
 * fall back to also had its own bug (sent a "viewed_at" field - verified
 * against the live schema, that column doesn't exist; it's "created_at").
 * Both bugs are fixed here by going straight to a corrected direct insert,
 * which a live DB trigger (sync_stats_on_view) turns into a
 * content_engagement_stats.total_views increment - the same column
 * short.views_count is read from on page load.
 */
async function recordView(contentId, watchDuration = 3) {
  if (hasRecordedView) return;
  if (!contentId) return;

  const contentIdNum = parseInt(contentId, 10);
  if (isNaN(contentIdNum)) {
    console.error('❌ Invalid content_id:', contentId);
    return;
  }

  const userId = getCurrentUserId();
  const sessionId = generateSessionId();
  const deviceType = getDeviceType();

  console.log('📝 Recording view for shorts content:', contentId);

  try {
    // De-dupe: skip if this session already has a recorded view for this
    // content (mirrors the old fallback's own dedup check).
    const { data: existing } = await supabaseClient
      .from('content_views')
      .select('id')
      .eq('content_id', contentIdNum)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      console.log('⏭️ View already recorded for this session, skipping');
      return;
    }

    const { error: insertError } = await supabaseClient
      .from('content_views')
      .insert({
        content_id: contentIdNum,
        user_id: userId || null,
        session_id: sessionId,
        counted_as_view: true,
        view_duration: Math.floor(watchDuration),
        device_type: deviceType
      });

    if (insertError) throw insertError;

    const { count, error: countError } = await supabaseClient
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentIdNum)
      .eq('counted_as_view', true);

    if (!countError && count !== null) {
      const short = shortsData.find(s => s.id == contentId);
      if (short) short.views_count = count;

      const views = formatNumber(count);
      const viewsElement = document.querySelector(`.swiper-slide-active .shorts-meta span:last-child`);
      if (viewsElement) {
        viewsElement.innerHTML = `<i class="fas fa-eye"></i> ${views}`;
      }
    }

    console.log(`✅ View recorded for shorts ${contentId}`);
  } catch (error) {
    console.error('❌ View recording failed:', error);
  }
}

// ============================================
// VIDEO CONTROL FUNCTIONS
// ============================================
function pauseAllVideos() {
  document.querySelectorAll('.short-video').forEach(video => {
    video.pause();
  });
}

function playCurrentShort() {
  const activeSlide = document.querySelector('.swiper-slide-active');
  if (!activeSlide) return;
  
  const video = activeSlide.querySelector('.short-video');
  if (!video) return;
  
  currentVideo = video;
  const shortId = activeSlide.dataset.shortId;
  currentShort = shortsData.find(s => s.id == shortId) || null;
  
  if (currentShort) {
    updateShareLink();
    hasRecordedView = false;
    viewThresholdReached = false;
    playbackSessionId = null;
    
    // Initialize playback session for view tracking
    initializePlaybackSession(currentShort);
    
    if (document.getElementById('comments-modal').classList.contains('active')) {
      loadComments(currentShort.id);
    }
  }
  
  video.currentTime = 0;
  video.muted = isMuted;

  // Try to play with user interaction fallback
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.log('Autoplay prevented:', error);
      showPlayPauseOverlay('play');
    });
  }
  
  setupVideoListeners(video);
  updateMuteButton();
}

function setupVideoListeners(video) {
  // Remove existing listeners to avoid duplicates
  video.removeEventListener('timeupdate', handleTimeUpdate);
  video.removeEventListener('progress', handleProgress);
  video.removeEventListener('ended', handleEnded);
  video.removeEventListener('error', handleVideoError);
  
  // Add fresh listeners
  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('progress', handleProgress);
  video.addEventListener('ended', handleEnded);
  video.addEventListener('error', handleVideoError);
}

function handleTimeUpdate(e) {
  const video = e.target;
  const shortId = video.dataset.shortId;
  const progressBar = document.querySelector(`.swiper-slide-active .progress-bar`);
  if (progressBar && video.duration) {
    const progress = (video.currentTime / video.duration) * 100;
    progressBar.style.width = `${progress}%`;
  }

  // Drive the top segmented progress bar's active segment from the real
  // video playback position - not a fixed timer, matches the actual video.
  if (video.duration) {
    const activeFill = document.querySelector('.progress-segment.active .progress-segment-fill');
    if (activeFill) {
      activeFill.style.width = `${(video.currentTime / video.duration) * 100}%`;
    }
  }

  // Record view after a threshold that actually fits short-form content:
  // a flat 3s (content-detail.js's long-form threshold) can be most of an
  // 7-9s short, so it's 3s or half the video's own duration, whichever is
  // reached first.
  const viewThreshold = video.duration ? Math.min(3, video.duration * 0.5) : 3;
  if (!hasRecordedView && video.currentTime >= viewThreshold) {
    hasRecordedView = true;
    recordView(shortId, Math.floor(video.currentTime));
  }
}

function handleProgress(e) {
  const video = e.target;
  if (video.buffered.length > 0) {
    const bufferBar = document.querySelector(`.swiper-slide-active .progress-buffer`);
    if (bufferBar && video.duration) {
      const buffered = (video.buffered.end(0) / video.duration) * 100;
      bufferBar.style.width = `${buffered}%`;
    }
  }
}

function handleEnded(e) {
  if (swiperInstance) {
    swiperInstance.slideNext();
  } else {
    e.target.currentTime = 0;
    e.target.play().catch(() => {});
  }
}

function handleVideoError(e) {
  console.error('Video error:', e);
  const video = e.target;
  // Try to fallback to thumbnail if video fails
  const slide = video.closest('.swiper-slide');
  if (slide) {
    const shortId = slide.dataset.shortId;
    const short = shortsData.find(s => s.id == shortId);
    if (short?.thumbnail_url) {
      video.style.backgroundImage = `url(${fixMediaUrl(short.thumbnail_url)})`;
      video.style.backgroundSize = 'cover';
      video.style.backgroundPosition = 'center';
    }
  }
  showToast('Failed to load video', 'error');
}

function updateMuteButton() {
  const muteBtn = document.querySelector('.swiper-slide-active .mute-btn-float');
  if (muteBtn) {
    muteBtn.innerHTML = isMuted 
      ? '<i class="fas fa-volume-mute"></i>' 
      : '<i class="fas fa-volume-up"></i>';
  }
}

function toggleMute() {
  if (!currentVideo) return;
  
  isMuted = !isMuted;
  currentVideo.muted = isMuted;
  updateMuteButton();
  showToast(isMuted ? 'Muted' : 'Unmuted', 'info');
}

function togglePlayPause() {
  if (!currentVideo) return;
  
  if (currentVideo.paused) {
    currentVideo.play().catch(() => {});
    isPlaying = true;
    showPlayPauseOverlay('play');
  } else {
    currentVideo.pause();
    isPlaying = false;
    showPlayPauseOverlay('pause');
  }
}

function showPlayPauseOverlay(action) {
  const overlay = document.getElementById('play-pause-overlay');
  const icon = document.getElementById('play-pause-icon');
  
  icon.className = action === 'play' ? 'fas fa-play' : 'fas fa-pause';
  overlay.classList.add('active');
  
  setTimeout(() => {
    overlay.classList.remove('active');
  }, 300);
}

function seekVideo(container, event) {
  if (!currentVideo || !currentVideo.duration) return;
  
  const rect = container.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const time = percent * currentVideo.duration;
  
  currentVideo.currentTime = Math.max(0, Math.min(time, currentVideo.duration));
}

/**
 * Initialize playback session for shorts
 */
function initializePlaybackSession(content) {
  if (!content || !supabaseClient) return;
  
  if (!playbackSessionId) {
    playbackSessionId = 'shorts_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  const userId = getCurrentUserId();
  
  // Try to create playback session record - payload matches the real
  // playback_sessions schema (it has no media_type column; that field
  // was never valid here, pre-dating this redesign).
  supabaseClient
    .from('playback_sessions')
    .insert({
      playback_session_id: playbackSessionId,
      content_id: parseInt(content.id, 10),
      user_id: userId || null,
      session_id: generateSessionId(),
      platform: 'Web',
      device_type: getDeviceType(),
      started_at: new Date().toISOString()
    })
    .then(({ error }) => {
      if (error) {
        console.warn('⚠️ Playback session creation failed:', error.message);
      } else {
        console.log('🎬 Playback session initialized for shorts:', playbackSessionId);
      }
    });
}

// ============================================
// SUPABASE FUNCTIONS
// ============================================

// ✅ 1️⃣ LOAD COMMENTS
async function loadComments(contentId) {
  const list = document.getElementById('comments-list');
  list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-grey)"><i class="fas fa-spinner fa-spin"></i> Loading comments...</div>';
  
  try {
    const { data: comments, error } = await supabaseClient
      .from('comments')
      .select(`
        id,
        comment_text,
        created_at,
        author_name,
        author_avatar,
        user_id,
        comment_likes(count)
      `)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (!comments || comments.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--slate-grey)">
          <i class="far fa-comment-dots" style="font-size:2rem;margin-bottom:1rem;opacity:0.5"></i>
          <p>No comments yet</p>
          <p style="font-size:0.875rem">Be the first to comment!</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = comments.map(comment => {
      const likeCount = comment.comment_likes?.[0]?.count || 0;
      
      return `
        <div class="comment-item" data-comment-id="${comment.id}">
          <div class="comment-avatar">
            ${comment.author_avatar 
              ? `<img src="${fixMediaUrl(comment.author_avatar)}" alt="${escapeHtml(comment.author_name)}" loading="lazy">` 
              : `<span>${getInitials(comment.author_name || 'User')}</span>`
            }
          </div>
          <div class="comment-content">
            <div class="comment-header">
              <span class="comment-username">${escapeHtml(comment.author_name || 'User')}</span>
              <span class="comment-time">${getTimeAgo(comment.created_at)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
            <div class="comment-actions">
              <button class="comment-action like-comment-btn" data-comment-id="${comment.id}">
                <i class="far fa-heart"></i> ${formatNumber(likeCount)}
              </button>
              <button class="comment-action report-comment-btn" data-comment-id="${comment.id}">
                <i class="fas fa-flag"></i> Report
              </button>
              ${currentUser && comment.user_id === currentUser.id ? `
                <button class="comment-action delete-comment-btn" data-comment-id="${comment.id}">
                  <i class="fas fa-trash"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach comment action listeners
    attachCommentActionListeners();
    
  } catch (error) {
    console.error('Error loading comments:', error);
    list.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--error-color)">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;margin-bottom:1rem"></i>
        <p>Failed to load comments</p>
        <button onclick="loadComments('${contentId}')" style="background:var(--warm-gold);color:var(--deep-black);border:none;padding:0.5rem 1rem;border-radius:0.5rem;margin-top:1rem;cursor:pointer">
          Retry
        </button>
      </div>
    `;
  }
}

// ✅ 2️⃣ POST COMMENT
async function postComment() {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  
  if (!text || !currentShort || !currentUser) {
    showToast('Please sign in to comment', 'info');
    return;
  }
  
  try {
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('full_name, avatar_url')
      .eq('id', currentUser.id)
      .single();
    
    if (profileError) throw profileError;
    
    const { error } = await supabaseClient
      .from('comments')
      .insert({
        content_id: currentShort.id,
        user_id: currentUser.id,
        author_name: profile?.full_name || currentUser.email?.split('@')[0] || 'User',
        author_avatar: profile?.avatar_url || null,
        comment_text: text
      });
    
    if (error) throw error;
    
    input.value = '';
    document.getElementById('post-comment-btn').disabled = true;
    
    const commentBtn = document.querySelector(`.swiper-slide-active .comment-btn .action-count`);
    if (commentBtn) {
      const currentCount = parseInt(commentBtn.textContent) || 0;
      commentBtn.textContent = formatNumber(currentCount + 1);
    }
    
    await loadComments(currentShort.id);
    showToast('Comment posted!', 'success');
    
  } catch (error) {
    console.error('Error posting comment:', error);
    showToast('Failed to post comment', 'error');
  }
}

// ✅ 3️⃣ LIKE COMMENT
async function likeComment(commentId, btn) {
  if (!currentUser) {
    showToast('Sign in to like comments', 'info');
    return;
  }
  
  const liked = btn.classList.contains('liked');
  const countSpan = btn.querySelector('span') || btn;
  const currentCount = parseInt(countSpan.textContent.replace(/[^0-9]/g, '')) || 0;
  
  if (liked) {
    btn.classList.remove('liked');
    btn.querySelector('i').className = 'far fa-heart';
    countSpan.textContent = formatNumber(currentCount - 1);
  } else {
    btn.classList.add('liked');
    btn.querySelector('i').className = 'fas fa-heart';
    countSpan.textContent = formatNumber(currentCount + 1);
  }
  
  try {
    if (liked) {
      await supabaseClient
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);
    } else {
      await supabaseClient
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: currentUser.id
        });
    }
  } catch (error) {
    if (liked) {
      btn.classList.add('liked');
      btn.querySelector('i').className = 'fas fa-heart';
      countSpan.textContent = formatNumber(currentCount);
    } else {
      btn.classList.remove('liked');
      btn.querySelector('i').className = 'far fa-heart';
      countSpan.textContent = formatNumber(currentCount);
    }
    console.error('Comment like error:', error);
    showToast('Failed to update like', 'error');
  }
}

// ✅ 4️⃣ REPORT COMMENT
async function reportComment(commentId) {
  if (!currentUser) {
    showToast('Sign in to report comments', 'info');
    return;
  }
  
  const reason = prompt('Please provide a reason for reporting this comment:');
  if (!reason) return;
  
  try {
    const { error } = await supabaseClient
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        user_id: currentUser.id,
        reason: reason
      });
    
    if (error) throw error;
    
    showToast('Report submitted. Thank you for helping keep our community safe!', 'success');
  } catch (error) {
    console.error('Error reporting comment:', error);
    showToast('Failed to submit report', 'error');
  }
}

// ✅ 5️⃣ DELETE COMMENT
async function deleteComment(commentId) {
  if (!currentUser) return;
  
  if (!confirm('Delete this comment?')) return;
  
  try {
    const { error } = await supabaseClient
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    const commentEl = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
    if (commentEl) commentEl.remove();
    
    const commentBtn = document.querySelector(`.swiper-slide-active .comment-btn .action-count`);
    if (commentBtn) {
      const currentCount = parseInt(commentBtn.textContent) || 0;
      commentBtn.textContent = formatNumber(Math.max(0, currentCount - 1));
    }
    
    showToast('Comment deleted', 'info');
  } catch (error) {
    console.error('Error deleting comment:', error);
    showToast('Failed to delete comment', 'error');
  }
}

function attachCommentActionListeners() {
  document.querySelectorAll('.like-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      likeComment(commentId, btn);
    });
  });
  
  document.querySelectorAll('.report-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      reportComment(commentId);
    });
  });
  
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      deleteComment(commentId);
    });
  });
}

// ============================================
// ACTION HANDLERS
// ============================================
// Same check-existing-row-before-insert pattern as content-detail.js's
// toggleLike() ("Toggle like with no 409 conflicts") - avoids a duplicate-
// key error if the optimistic UI state and the real DB state have drifted
// (e.g. liked on another tab/device).
async function handleLike(shortId, btn) {
  if (!currentUser) {
    showToast('Sign in to like shorts', 'info');
    return;
  }

  const liked = btn.classList.contains('liked');
  const countEl = btn.querySelector('.action-count');
  let currentCount = parseInt(countEl.textContent.replace(/[^0-9]/g, '')) || 0;
  const contentId = parseInt(shortId, 10);

  if (liked) {
    btn.classList.remove('liked');
    btn.querySelector('i').className = 'far fa-heart';
    countEl.textContent = formatNumber(currentCount - 1);
  } else {
    btn.classList.add('liked');
    btn.querySelector('i').className = 'fas fa-heart';
    countEl.textContent = formatNumber(currentCount + 1);
  }

  try {
    if (liked) {
      const { error } = await supabaseClient
        .from('content_likes')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('content_id', contentId);
      if (error) throw error;
    } else {
      const { data: existing } = await supabaseClient
        .from('content_likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('content_id', contentId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabaseClient
          .from('content_likes')
          .insert({ user_id: currentUser.id, content_id: contentId });
        if (error) throw error;
      }
      showDoubleTapIndicator();
    }
  } catch (error) {
    if (liked) {
      btn.classList.add('liked');
      btn.querySelector('i').className = 'fas fa-heart';
    } else {
      btn.classList.remove('liked');
      btn.querySelector('i').className = 'far fa-heart';
    }
    countEl.textContent = formatNumber(currentCount);
    console.error('Like error:', error);
    showToast('Failed to update like', 'error');
  }
}

// "Save" uses watch_later - the same real table content-detail.html's own
// bookmark-icon Save button (#watchLaterBtn) writes to, not a shorts-only
// table, so a short saved here shows up in the same Watch Later list
// everywhere else on the platform.
async function handleSave(shortId, btn) {
  if (!currentUser) {
    showToast('Sign in to save shorts', 'info');
    return;
  }

  const saved = btn.classList.contains('saved');
  const contentId = parseInt(shortId, 10);
  const countEl = btn.querySelector('.action-count');
  const currentCount = parseInt(countEl.textContent.replace(/[^0-9]/g, '')) || 0;

  if (saved) {
    btn.classList.remove('saved');
    btn.querySelector('i').className = 'far fa-bookmark';
    countEl.textContent = formatNumber(currentCount - 1);
  } else {
    btn.classList.add('saved');
    btn.querySelector('i').className = 'fas fa-bookmark';
    countEl.textContent = formatNumber(currentCount + 1);
  }

  try {
    if (saved) {
      const { error } = await supabaseClient
        .from('watch_later')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('content_id', contentId);
      if (error) throw error;
      showToast('Removed from saved', 'info');
    } else {
      const { data: existing } = await supabaseClient
        .from('watch_later')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('content_id', contentId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabaseClient
          .from('watch_later')
          .insert({ user_id: currentUser.id, content_id: contentId });
        if (error) throw error;
      }
      showToast('Saved!', 'success');
    }

    const short = shortsData.find(s => s.id == shortId);
    if (short) short.real_saves_count = saved ? currentCount - 1 : currentCount + 1;
  } catch (error) {
    if (saved) {
      btn.classList.add('saved');
      btn.querySelector('i').className = 'fas fa-bookmark';
    } else {
      btn.classList.remove('saved');
      btn.querySelector('i').className = 'far fa-bookmark';
    }
    countEl.textContent = formatNumber(currentCount);
    console.error('Save error:', error);
    showToast('Failed to save', 'error');
  }
}

async function handleConnect(creatorId, btn) {
  if (!currentUser) {
    showToast('Sign in to connect', 'info');
    return;
  }
  
  const connected = btn.classList.contains('connected');
  const setLabel = (text) => {
    const span = btn.querySelector('span');
    if (span) span.textContent = text;
  };

  if (connected) {
    setLabel('Connect');
    btn.classList.remove('connected');
  } else {
    setLabel('Connected');
    btn.classList.add('connected');
  }

  try {
    if (connected) {
      const { error } = await supabaseClient
        .from('connectors')
        .delete()
        .eq('connector_id', currentUser.id)
        .eq('connected_id', creatorId);
      if (error) throw error;
      userConnections.delete(creatorId);
      showToast('Disconnected', 'info');
    } else {
      // Same check-existing-row-before-insert pattern as handleLike/
      // handleSave (and content-detail.js's toggleLike/toggleFavorite/
      // toggleWatchLater) - avoids a duplicate-key 409 if already
      // connected from another tab/device.
      const { data: existing } = await supabaseClient
        .from('connectors')
        .select('id')
        .eq('connector_id', currentUser.id)
        .eq('connected_id', creatorId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabaseClient
          .from('connectors')
          .insert({
            connector_id: currentUser.id,
            connected_id: creatorId,
            connection_type: 'creator'
          });
        if (error) throw error;
      }
      userConnections.add(creatorId);
      showToast('Connected!', 'success');
    }
  } catch (error) {
    if (connected) {
      setLabel('Connected');
      btn.classList.add('connected');
    } else {
      setLabel('Connect');
      btn.classList.remove('connected');
    }
    console.error('Connection error:', error);
    showToast('Failed to update connection', 'error');
  }
}

// ============================================
// MORE MENU FUNCTIONS
// ============================================
function toggleMoreMenu(shortId, button) {
  const menu = document.getElementById('more-menu');
  if (!menu) return;
  
  if (moreMenuOpen) {
    closeMoreMenu();
    return;
  }
  
  const rect = button.getBoundingClientRect();
  menu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  menu.style.right = `${window.innerWidth - rect.right + 10}px`;
  
  menu.dataset.shortId = shortId;
  menu.classList.add('active');
  moreMenuOpen = true;
}

function closeMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu) menu.classList.remove('active');
  moreMenuOpen = false;
}

function handleReport() {
  closeMoreMenu();
  if (!currentShort) return;
  showReportModalLocal({
    title: `Report ${currentShort.title || 'this short'}`,
    onSubmit: ({ reason, details }) => reportContentLocal({ contentId: currentShort.id, reason, details })
  });
}

function handleNotInterested() {
  closeMoreMenu();
  if (!currentShort) return;
  hiddenShortIds.add(currentShort.id);
  showToast('Got it, hiding this from your feed for now', 'info');
  if (typeof swiperInstance !== 'undefined' && swiperInstance) {
    swiperInstance.slideNext();
  }
}

function handleBlockCreator() {
  closeMoreMenu();
  if (!currentShort || !currentShort.user_id) return;
  const creatorName = currentShort.user_profiles?.full_name || currentShort.user_profiles?.username || 'this creator';
  showConfirmModalLocal({
    icon: 'fa-ban',
    danger: true,
    title: `Block ${creatorName}?`,
    message: `You won't see ${creatorName}'s content in your feed, search, or recommendations, and they won't be able to interact with you. You can unblock them anytime from Settings.`,
    confirmText: 'Block',
    confirmClass: 'danger',
    onConfirm: async () => {
      await blockCreatorLocal(currentShort.user_id, creatorName);
      if (typeof shortsData !== 'undefined') {
        shortsData = shortsData.filter(s => s.user_id !== currentShort.user_id);
      }
      if (typeof swiperInstance !== 'undefined' && swiperInstance) {
        swiperInstance.slideNext();
      }
    }
  });
}

// ============================================
// COMMENT FUNCTIONS
// ============================================
function openComments(shortId) {
  const modal = document.getElementById('comments-modal');
  modal.classList.add('active');
  loadComments(shortId);
  setTimeout(() => {
    document.getElementById('comment-input')?.focus();
  }, 300);
}

function closeComments() {
  document.getElementById('comments-modal').classList.remove('active');
}

// ============================================
// SHARE FUNCTIONS
// ============================================
function openShare(shortId) {
  document.getElementById('share-modal').classList.add('active');
  updateShareLink();
}

function closeShare() {
  document.getElementById('share-modal').classList.remove('active');
}

function updateShareLink() {
  if (!currentShort) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${currentShort.id}`;
  document.getElementById('share-link-input').value = shareUrl;
}

// Same pattern as content-detail.js's recordShareEvent(): a share only
// counts once an actual share action has happened (copy or platform link),
// not just from opening the modal - content_shares insert (real columns
// only: content_id/user_id, unlike content-detail.js's own copy of this,
// which sends a shared_at field that column doesn't have) has a DB trigger
// that keeps content_engagement_stats.total_shares in sync, so this is the
// same source of truth the displayed share count is read from. The
// content_events insert compensates for a DB-side bug: the trigger that
// auto-logs content_shares inserts into content_events hardcodes
// event_type='like' regardless of table, so without this every share would
// get silently mislogged as a like in the events table.
async function recordShareEvent(shortId) {
  if (!shortId) return;
  const contentId = parseInt(shortId, 10);
  try {
    if (currentUser) {
      await supabaseClient
        .from('content_shares')
        .insert({ content_id: contentId, user_id: currentUser.id });

      await supabaseClient
        .from('content_events')
        .insert({
          content_id: contentId,
          user_id: currentUser.id,
          event_type: 'share',
          created_at: new Date().toISOString()
        });
    }

    const short = shortsData.find(s => s.id == shortId);
    if (short) short.real_shares_count = (short.real_shares_count || 0) + 1;

    const countEl = document.querySelector(`.swiper-slide-active .share-btn[data-short-id="${shortId}"] .action-count`);
    if (countEl) countEl.textContent = formatNumber(short?.real_shares_count || 0);
  } catch (err) {
    console.warn('Failed to record share event:', err);
  }
}

async function copyShareLink() {
  const input = document.getElementById('share-link-input');
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Link copied!', 'success');
  } catch {
    input.select();
    document.execCommand('copy');
    showToast('Link copied!', 'success');
  }
  await recordShareEvent(currentShort?.id);
  closeShare();
}

function shareToWhatsApp() {
  const text = `Check out this short on Bantu Stream Connect!`;
  const url = document.getElementById('share-link-input').value;
  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  recordShareEvent(currentShort?.id);
  closeShare();
}

function shareToTwitter() {
  const text = `Check out this short on Bantu Stream Connect!`;
  const url = document.getElementById('share-link-input').value;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  recordShareEvent(currentShort?.id);
  closeShare();
}

function shareToInstagram() {
  showToast('Share to Instagram coming soon!', 'info');
  closeShare();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
// #shorts-loading is hidden by default (normal loading is skeleton-first,
// see .shorts-skeleton-slide in the HTML) - this only ever becomes visible
// for a genuine connection failure, showing a real retry UI instead of a
// generic spinner.
function hideLoadingScreen(showFallback = false, message = '') {
  const loadingScreen = document.getElementById('shorts-loading');
  if (!loadingScreen) return;

  if (showFallback) {
    loadingScreen.innerHTML = `
      <div class="fallback-message">
        <i class="fas fa-exclamation-circle" style="font-size:3rem;color:#00E5FF;margin-bottom:1rem"></i>
        <h3>Connection Issue</h3>
        <p>${escapeHtml(message || 'Unable to connect. Showing offline content.')}</p>
        <div class="fallback-actions">
          <button class="fallback-btn" onclick="location.reload()">
            <i class="fas fa-redo"></i> Retry
          </button>
          <button class="fallback-btn secondary" onclick="window.location.href='index.html'">
            <i class="fas fa-home"></i> Home
          </button>
        </div>
        <div class="fallback-tip">
          <i class="fas fa-lightbulb"></i> Tip: Check your internet connection
        </div>
      </div>
    `;
    loadingScreen.style.display = 'flex';
    loadingScreen.classList.remove('hidden');
  } else {
    loadingScreen.classList.add('hidden');
    loadingScreen.style.display = 'none';
  }
}

// This page deliberately never loads js/shared-components.js (see the
// comment on the deferred Supabase SDK <script> tag in shorts-detail.html -
// this page creates its own client inside its own DOMContentLoaded
// listener, and shared-components.js has a top-level dependency that
// would race it). So unlike every other page, this local showToast() is
// the real implementation, not a shadowing duplicate - it has to match
// shared-components.css's canonical cyan markup exactly by hand, since it
// can't just delegate to the shared JS function that isn't loaded here.
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Same reasoning as showToast() above: shared-components.js's
// showConfirmModal()/showReportModal()/blockCreator() aren't available on
// this page, so this is a local equivalent using the same .bsc-modal
// markup/CSS (shared-components.css IS loaded here, just not the JS).
function showConfirmModalLocal({ icon = 'fa-triangle-exclamation', danger = false, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmClass = 'primary', onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'bsc-modal-overlay';
  overlay.innerHTML = `
    <div class="bsc-modal">
      <div class="bsc-modal-icon ${danger ? 'danger' : ''}"><i class="fas ${icon}"></i></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="bsc-modal-actions">
        <button class="bsc-modal-btn ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button class="bsc-modal-btn ${confirmClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="confirm"]').onclick = async () => {
    const btn = overlay.querySelector('[data-action="confirm"]');
    btn.disabled = true;
    try {
      await onConfirm();
      close();
    } catch (err) {
      btn.disabled = false;
      console.error('Confirm modal action failed:', err);
    }
  };
}

function showReportModalLocal({ title = 'Report', onSubmit }) {
  const reasons = ['Spam', 'Harassment or bullying', 'Hate speech', 'Violence', 'Sexual content', 'Copyright infringement', 'Misinformation', 'Other'];
  const overlay = document.createElement('div');
  overlay.className = 'bsc-modal-overlay';
  overlay.innerHTML = `
    <div class="bsc-modal">
      <div class="bsc-modal-icon danger"><i class="fas fa-flag"></i></div>
      <h3>${escapeHtml(title)}</h3>
      <p>Help us keep Bantu Stream Connect safe. Your report is confidential.</p>
      <div class="bsc-modal-field">
        <label>Reason</label>
        <select id="sd-report-reason">${reasons.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('')}</select>
      </div>
      <div class="bsc-modal-field">
        <label>Additional details (optional)</label>
        <textarea id="sd-report-details" placeholder="Anything else we should know?"></textarea>
      </div>
      <div class="bsc-modal-actions">
        <button class="bsc-modal-btn ghost" data-action="cancel">Cancel</button>
        <button class="bsc-modal-btn danger" data-action="confirm">Submit Report</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-action="cancel"]').onclick = close;
  overlay.querySelector('[data-action="confirm"]').onclick = async () => {
    const btn = overlay.querySelector('[data-action="confirm"]');
    btn.disabled = true;
    const reason = overlay.querySelector('#sd-report-reason').value;
    const details = overlay.querySelector('#sd-report-details').value.trim();
    try {
      await onSubmit({ reason, details });
      close();
    } catch (err) {
      btn.disabled = false;
      console.error('Report submission failed:', err);
    }
  };
}

async function reportContentLocal({ contentId = null, reportedUserId = null, reason, details }) {
  if (!currentUser) {
    showToast('Sign in to submit a report', 'info');
    return;
  }
  const { error } = await supabaseClient.from('content_reports').insert({
    reporter_id: currentUser.id,
    content_id: contentId,
    reported_user_id: reportedUserId,
    reason,
    details: details || null
  });
  if (error) {
    console.error('Failed to submit report:', error);
    showToast('Failed to submit report', 'error');
    throw error;
  }
  showToast('Report submitted. Thank you for helping keep our community safe.', 'success');
}

async function blockCreatorLocal(creatorId, creatorName = 'this creator') {
  if (!currentUser) {
    showToast('Sign in to block creators', 'info');
    return;
  }
  const { error } = await supabaseClient.from('user_blocks').insert({
    blocker_id: currentUser.id,
    blocked_id: creatorId
  });
  if (error) {
    console.error('Failed to block creator:', error);
    showToast('Failed to block creator', 'error');
    throw error;
  }
  showToast(`${creatorName} has been blocked`, 'success');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatTime(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.includes('supabase.co')) return url;
  return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function showDoubleTapIndicator() {
  const indicator = document.getElementById('double-tap-indicator');
  indicator.classList.add('active');
  setTimeout(() => indicator.classList.remove('active'), 500);
}

function handleDoubleTap(e) {
  const now = Date.now();
  if (now - lastTapTime < 300) {
    const likeBtn = document.querySelector('.swiper-slide-active .like-btn');
    if (likeBtn && !likeBtn.classList.contains('liked')) {
      likeBtn.click();
    }
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
}

// ============================================
// USER PROFILE FUNCTIONS
// ============================================
async function loadUserProfilePicture(user) {
  if (!user) return;
  
  try {
    const { data: profile, error } = await supabaseClient
      .from('user_profiles')
      .select('avatar_url, full_name, username')
      .eq('id', user.id)
      .maybeSingle();
    
    const placeholder = document.getElementById('userProfilePlaceholder');
    if (!placeholder) return;
    
    placeholder.innerHTML = '';
    
    if (profile?.avatar_url) {
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.src = fixMediaUrl(profile.avatar_url);
      img.alt = profile.full_name || 'User';
      img.onerror = () => {
        placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
      };
      placeholder.appendChild(img);
    } else {
      const initials = profile?.full_name ? getInitials(profile.full_name) : getInitials(user.email);
      const div = document.createElement('div');
      div.className = 'profile-placeholder';
      div.textContent = initials;
      placeholder.appendChild(div);
    }
  } catch (error) {
    console.error('Error loading profile picture:', error);
  }
}

async function fetchUserConnections() {
  if (!currentUser) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('connectors')
      .select('connected_id')
      .eq('connector_id', currentUser.id);
    
    if (error) throw error;
    
    userConnections.clear();
    // Some connectors rows have a null connected_id (data-quality gap) - adding
    // that to the Set means Array.from(userConnections) later serializes to the
    // literal string "null" inside a .in() filter, which Postgres then rejects
    // with "invalid input syntax for type uuid: null". Skip null/falsy ids.
    if (data) data.forEach(c => { if (c.connected_id) userConnections.add(c.connected_id); });

  } catch (error) {
    console.error('Error fetching connections:', error);
  }
}

// ============================================
// LOAD MORE SHORTS
// ============================================
async function loadMoreShorts() {
  if (shortsData.length >= 50 || connectionFailed) return;
  
  try {
    const lastShort = shortsData[shortsData.length - 1];
    
    const { data, error } = await supabaseClient
      .from('Content')
      .select(`
        *,
        user_profiles!user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        content_engagement_stats (
          total_views,
          total_likes,
          total_comments,
          total_shares
        )
      `)
      .eq('status', 'published')
      .in('media_type', ['video', 'audio', 'short'])
      .lte('duration', 60)
      .lt('created_at', lastShort.created_at)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const startIndex = shortsData.length;
      shortsData = [...shortsData, ...data];

      await loadShortMetrics(data);
      await applyUserEngagementState(data);
      computeTrending(shortsData);
      appendProgressSegments(data.length);

      data.forEach((short, i) => {
        const slide = createShortSlide(short, startIndex + i);
        document.getElementById('shorts-wrapper').appendChild(slide);
      });

      if (swiperInstance) swiperInstance.update();
    }

  } catch (error) {
    console.error('Error loading more shorts:', error);
  }
}

function createShortSlide(short, index) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildSlideHTML(short, index).trim();
  const slide = wrapper.firstElementChild;
  return slide;
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  document.getElementById('profile-btn')?.addEventListener('click', () => {
    if (currentUser) {
      window.location.href = 'manage-profiles.html';
    } else {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;
    
    e.stopPropagation();
    const action = btn.dataset.action;
    const shortId = btn.dataset.shortId;
    
    if (action === 'like') handleLike(shortId, btn);
    else if (action === 'comment') openComments(shortId);
    else if (action === 'share') openShare(shortId);
    else if (action === 'save') handleSave(shortId, btn);
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.connect-btn');
    if (btn) {
      e.stopPropagation();
      handleConnect(btn.dataset.creatorId, btn);
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.more-btn');
    if (btn) {
      e.stopPropagation();
      toggleMoreMenu(btn.dataset.shortId, btn);
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('.caption-toggle');
    if (toggle) {
      e.stopPropagation();
      const captionId = toggle.dataset.captionId;
      const caption = document.getElementById(captionId);
      if (caption) {
        caption.classList.toggle('expanded');
        toggle.textContent = caption.classList.contains('expanded') ? 'less' : 'more';
      }
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const creatorInfo = e.target.closest('.creator-info');
    if (creatorInfo && !e.target.closest('.connect-btn')) {
      const creatorId = creatorInfo.dataset.creatorId;
      if (creatorId) {
        window.location.href = `creator-channel.html?id=${creatorId}`;
      }
    }
  });

  // Sound disc - real, not decorative: since there's no separate "sound"
  // entity to link to (it's honestly labeled "Original Sound" further down),
  // tapping it goes to the same place tapping the creator's name/avatar does.
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const soundDisc = e.target.closest('.sound-disc');
    if (soundDisc) {
      e.stopPropagation();
      const creatorId = soundDisc.dataset.creatorId;
      if (creatorId) {
        window.location.href = `creator-channel.html?id=${creatorId}`;
      }
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('click', (e) => {
    const muteBtn = e.target.closest('.mute-btn-float');
    if (muteBtn) {
      e.stopPropagation();
      toggleMute();
      return;
    }
    
    const progressContainer = e.target.closest('.progress-container');
    if (progressContainer) {
      e.stopPropagation();
      seekVideo(progressContainer, e);
      return;
    }
    
    const videoWrapper = e.target.closest('.short-video-wrapper');
    if (videoWrapper && 
        !e.target.closest('.shorts-actions') && 
        !e.target.closest('.shorts-info') &&
        !e.target.closest('.video-controls')) {
      togglePlayPause();
    }
  });
  
  document.getElementById('more-report')?.addEventListener('click', handleReport);
  document.getElementById('more-not-interested')?.addEventListener('click', handleNotInterested);
  document.getElementById('more-block')?.addEventListener('click', handleBlockCreator);
  
  document.addEventListener('click', (e) => {
    if (moreMenuOpen && !e.target.closest('.more-menu') && !e.target.closest('.more-btn')) {
      closeMoreMenu();
    }
  });
  
  document.getElementById('shorts-player')?.addEventListener('touchend', handleDoubleTap);
  
  document.getElementById('close-comments')?.addEventListener('click', closeComments);
  document.getElementById('close-share')?.addEventListener('click', closeShare);
  
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
  
  const commentInput = document.getElementById('comment-input');
  const postCommentBtn = document.getElementById('post-comment-btn');
  
  commentInput?.addEventListener('input', () => {
    postCommentBtn.disabled = commentInput.value.trim().length === 0;
  });
  
  commentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!postCommentBtn.disabled) postComment();
    }
  });
  
  postCommentBtn?.addEventListener('click', postComment);
  
  document.getElementById('share-whatsapp')?.addEventListener('click', shareToWhatsApp);
  document.getElementById('share-twitter')?.addEventListener('click', shareToTwitter);
  document.getElementById('share-instagram')?.addEventListener('click', shareToInstagram);
  document.getElementById('share-copy')?.addEventListener('click', copyShareLink);
  document.getElementById('copy-link-btn')?.addEventListener('click', copyShareLink);
  
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    
    switch(e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (swiperInstance) swiperInstance.slidePrev();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (swiperInstance) swiperInstance.slideNext();
        break;
      case 'Escape':
        e.preventDefault();
        closeMoreMenu();
        closeComments();
        closeShare();
        document.getElementById('search-modal')?.classList.remove('active');
        document.getElementById('notifications-panel')?.classList.remove('active');
        break;
    }
  });
}

// ============================================
// VISIBILITY CHANGE HANDLER
// ============================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAllVideos();
  } else {
    playCurrentShort();
  }
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (swiperInstance) swiperInstance.update();
  }, 300);
});

// Auth state listener
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      loadUserProfilePicture(session.user);
      loadUserNotifications();
      fetchUserConnections();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('userProfilePlaceholder').innerHTML = '<i class="fas fa-user"></i>';
      document.getElementById('notification-count').style.display = 'none';
      showToast('Signed out', 'info');
    }
  });
}
