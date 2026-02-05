console.log('🎬 Content Detail Initializing...');

// Global variables
let currentContent = null;
let enhancedVideoPlayer = null;
let isInitialized = false;

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
  initializeVideoPlayer();
  
  // Initialize all modals/panels
  initAnalyticsModal();
  initSearchModal();
  initNotificationsPanel();
  initThemeSelector();
  initGlobalNavigation();
  
  // Show app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  console.log('✅ Content Detail fully initialized');
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
      updateProfileUI();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      resetProfileUI();
      showToast('Signed out successfully', 'info');
    }
  });
  
  // Initial update
  if (window.AuthHelper?.isAuthenticated?.()) {
    updateProfileUI();
  } else {
    resetProfileUI();
  }
}

function updateProfileUI() {
  const profileBtn = document.getElementById('profile-btn');
  const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
  
  if (!profileBtn || !userProfilePlaceholder) return;
  
  // Check if user is authenticated
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
    // Guest user
    userProfilePlaceholder.innerHTML = `
      <div class="profile-placeholder">
        <i class="fas fa-user"></i>
      </div>
    `;
    profileBtn.onclick = () => {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    };
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

// Load content from URL
async function loadContentFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id') || '68';
  
  try {
    // Fetch real content from Supabase
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
      views_count: data.views_count || 0,
      likes_count: data.likes_count || 0,
      creator: data.user_profiles?.full_name || data.user_profiles?.username || 'Creator',
      creator_display_name: data.user_profiles?.full_name || data.user_profiles?.username || 'Creator',
      creator_id: data.user_profiles?.id || data.user_id,
      user_id: data.user_id
    };
    
    console.log('✅ Real content loaded:', currentContent.title);
    
    // Update UI
    updateContentUI(currentContent);
    
    // Record view
    if (window.SupabaseHelper?.recordView) {
      await window.SupabaseHelper.recordView(contentId, null);
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

// Update UI with content
function updateContentUI(content) {
  if (!content) return;
  
  // Update title
  safeSetText('contentTitle', content.title);
  safeSetText('creatorName', content.creator);
  safeSetText('creatorDisplayName', content.creator_display_name);
  
  // Update stats
  safeSetText('viewsCount', formatNumber(content.views_count) + ' views');
  safeSetText('viewsCountFull', formatNumber(content.views_count));
  safeSetText('likesCount', formatNumber(content.likes_count));
  
  // Update duration (FIXED: Never shows dash)
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
    const { data, error } = await window.supabaseClient
      .from('comments')
      .select('*, user_profiles!user_id(*)')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    renderComments(data || []);
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

// Render comments
function renderComments(comments) {
  const container = document.getElementById('commentsList');
  const noComments = document.getElementById('noComments');
  const countEl = document.getElementById('commentsCount');
  
  if (!container) return;
  
  // Clear container
  container.innerHTML = '';
  
  if (!comments || comments.length === 0) {
    if (noComments) noComments.style.display = 'flex';
    if (countEl) countEl.textContent = '(0)';
    return;
  }
  
  // Hide "no comments" message
  if (noComments) noComments.style.display = 'none';
  
  // Update count
  if (countEl) countEl.textContent = `(${comments.length})`;
  
  // Add comments
  comments.forEach(comment => {
    const commentEl = createCommentElement(comment);
    container.appendChild(commentEl);
  });
}

function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'comment-item';
  
  let authorName = 'User';
  let avatarUrl = null;
  
  if (comment.author_name) {
    authorName = comment.author_name;
  } else if (comment.user_profiles?.full_name || comment.user_profiles?.username) {
    authorName = comment.user_profiles.full_name || comment.user_profiles.username;
  }
  
  if (comment.user_profiles?.avatar_url) {
    avatarUrl = comment.user_profiles.avatar_url;
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      avatarUrl = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/profile-pictures/${avatarUrl}`;
    }
  }
  
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

// Initialize video player
function initializeVideoPlayer() {
  const videoElement = document.getElementById('inlineVideoPlayer');
  const videoContainer = document.querySelector('.video-container');
  
  if (!videoElement || !videoContainer) {
    console.warn('⚠️ Video elements not found');
    return;
  }
  
  try {
    // Create enhanced video player if available
    if (typeof EnhancedVideoPlayer !== 'undefined') {
      enhancedVideoPlayer = new EnhancedVideoPlayer({
        autoplay: false,
        muted: false,
        controls: true
      });
      
      enhancedVideoPlayer.attach(videoElement, videoContainer);
      console.log('✅ Enhanced video player initialized');
    }
    
    console.log('✅ Video player ready');
  } catch (error) {
    console.error('❌ Video player init failed:', error);
  }
}

// Handle play button
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
  if (window.SupabaseHelper?.fixMediaUrl) {
    videoUrl = window.SupabaseHelper.fixMediaUrl(videoUrl);
  }
  
  console.log('🎥 Playing video:', videoUrl);
  
  // Set video source
  videoElement.src = videoUrl;
  
  // Show player
  player.style.display = 'block';
  
  // Try to play
  const playPromise = videoElement.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.log('Autoplay prevented:', err);
      showToast('Click play button in video player', 'info');
    });
  }
  
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
        enhancedVideoPlayer.pause();
      }
    });
  }
  
  // Share button
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: currentContent?.title || 'Check this out',
          text: `Check out "${currentContent?.title}" on Bantu Stream Connect`,
          url: url
        });
      } else {
        navigator.clipboard.writeText(url)
          .then(() => showToast('Link copied!', 'success'))
          .catch(() => showToast('Failed to copy', 'error'));
      }
    });
  }
  
  // Favorite button
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', function() {
      const isFavorited = favoriteBtn.classList.contains('active');
      if (isFavorited) {
        favoriteBtn.classList.remove('active');
        favoriteBtn.innerHTML = '<i class="far fa-heart"></i><span>Favorite</span>';
        showToast('Removed from favorites', 'info');
      } else {
        favoriteBtn.classList.add('active');
        favoriteBtn.innerHTML = '<i class="fas fa-heart"></i><span>Favorited</span>';
        showToast('Added to favorites!', 'success');
      }
    });
  }
  
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
  
  // Send comment
  const sendBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('commentInput');
  
  if (sendBtn && commentInput) {
    sendBtn.addEventListener('click', async function() {
      const text = commentInput.value.trim();
      if (!text) {
        showToast('Please enter a comment', 'warning');
        return;
      }
      
      if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
        const shouldLogin = confirm('You need to sign in to comment. Would you like to sign in now?');
        if (shouldLogin) {
          window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        }
        return;
      }
      
      if (!currentContent) return;
      
      // Show loading
      const originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      sendBtn.disabled = true;
      
      try {
        const userProfile = window.AuthHelper.getUserProfile();
        const displayName = window.AuthHelper.getDisplayName();
        
        const { data, error } = await window.supabaseClient
          .from('comments')
          .insert({
            content_id: currentContent.id,
            user_id: userProfile.id,
            author_name: displayName,
            comment_text: text
          })
          .select()
          .single();
        
        if (error) throw error;
        
        commentInput.value = '';
        showToast('Comment added!', 'success');
        await loadComments(currentContent.id);
      } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment', 'error');
      } finally {
        sendBtn.innerHTML = originalHTML;
        sendBtn.disabled = false;
      }
    });
    
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }
  
  // Connect button in player
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async function() {
      if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
        const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
        if (shouldLogin) {
          window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        }
        return;
      }
      
      const isConnected = connectBtn.classList.contains('connected');
      if (isConnected) {
        connectBtn.classList.remove('connected');
        connectBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
        showToast('Disconnected', 'info');
      } else {
        connectBtn.classList.add('connected');
        connectBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
        showToast('Connected successfully!', 'success');
      }
    });
  }
  
  // Connect button in creator section
  const connectCreatorBtn = document.getElementById('connectCreatorBtn');
  if (connectCreatorBtn) {
    connectCreatorBtn.addEventListener('click', async function() {
      if (!window.AuthHelper || !window.AuthHelper.isAuthenticated()) {
        const shouldLogin = confirm('You need to sign in to connect. Would you like to sign in now?');
        if (shouldLogin) {
          window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        }
        return;
      }
      
      const isConnected = connectCreatorBtn.classList.contains('connected');
      if (isConnected) {
        connectCreatorBtn.classList.remove('connected');
        connectCreatorBtn.innerHTML = '<i class="fas fa-user-plus"></i><span>Connect</span>';
        showToast('Disconnected', 'info');
      } else {
        connectCreatorBtn.classList.add('connected');
        connectCreatorBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Connected</span>';
        showToast('Connected successfully!', 'success');
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
  
  console.log('✅ Event listeners setup complete');
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
  
  analyticsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    analyticsModal.classList.add('active');
    loadContentAnalytics();
  });
  
  if (closeAnalytics) {
    closeAnalytics.addEventListener('click', () => {
      analyticsModal.classList.remove('active');
    });
  }
  
  analyticsModal.addEventListener('click', (e) => {
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
  
  searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchModal.classList.add('active');
    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 300);
  });
  
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    });
  }
  
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
      if (searchInput) searchInput.value = '';
      document.getElementById('search-results-grid').innerHTML = '';
    }
  });
  
  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      const category = document.getElementById('category-filter')?.value;
      const sortBy = document.getElementById('sort-filter')?.value;
      
      if (query.length < 2) {
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Start typing to search...</div>';
        return;
      }
      
      document.getElementById('search-results-grid').innerHTML = 
        '<div class="infinite-scroll-loading"><div class="infinite-scroll-spinner"></div><div>Searching...</div></div>';
      
      try {
        const results = await searchContent(query, category, sortBy);
        renderSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        document.getElementById('search-results-grid').innerHTML = 
          '<div class="no-results">Error searching. Please try again.</div>';
      }
    }, 300));
  }
  
  // Filter change handlers
  document.getElementById('category-filter')?.addEventListener('change', triggerSearch);
  document.getElementById('sort-filter')?.addEventListener('change', triggerSearch);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function triggerSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const event = new Event('input');
    searchInput.dispatchEvent(event);
  }
}

async function searchContent(query, category = '', sortBy = 'newest') {
  try {
    let orderBy = 'created_at';
    let order = 'desc';
    
    if (sortBy === 'popular') {
      orderBy = 'views_count';
    } else if (sortBy === 'trending') {
      orderBy = 'likes_count';
    }
    
    let queryBuilder = window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .ilike('title', `%${query}%`)
      .eq('status', 'published')
      .order(orderBy, { ascending: order === 'asc' })
      .limit(20);
    
    if (category) {
      queryBuilder = queryBuilder.eq('genre', category);
    }
    
    const { data, error } = await queryBuilder;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const creator = item.user_profiles?.full_name || item.user_profiles?.username || item.creator || 'Creator';
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
            <span>${formatNumber(item.views_count || 0)} views</span>
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
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.creator-btn')) return;
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
  
  grid.querySelectorAll('.creator-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.creatorId;
      const name = btn.dataset.creatorName;
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
  [notificationsBtn, navNotificationsBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        notificationsPanel.classList.add('active');
        await loadUserNotifications();
        await markAllNotificationsAsRead();
      });
    }
  });
  
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      notificationsPanel.classList.remove('active');
    });
  }
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (notificationsPanel.classList.contains('active') && 
        !notificationsPanel.contains(e.target) && 
        !notificationsBtn.contains(e.target) && 
        (!navNotificationsBtn || !navNotificationsBtn.contains(e.target))) {
      notificationsPanel.classList.remove('active');
    }
  });
  
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async () => {
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
  const notificationsList = document.getElementById('notifications-list');
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
    
    const userProfile = window.AuthHelper.getUserProfile();
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
    const { data, error } = await window.supabaseClient
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
    
    // Add click handlers
    notificationsList.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await markNotificationAsRead(id);
        
        // Handle navigation based on notification type
        const notification = data.find(n => n.id === id);
        if (notification?.content_id) {
          window.location.href = `content-detail.html?id=${notification.content_id}`;
        }
        notificationsPanel.classList.remove('active');
      });
    });
    
    // Update badge count
    const unreadCount = data.filter(n => !n.is_read).length;
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
    const { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    
    // Update UI immediately
    const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.classList.add('read');
      const dot = item.querySelector('.notification-dot');
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
    
    const userProfile = window.AuthHelper.getUserProfile();
    if (!userProfile?.id) return;
    
    const { error } = await window.supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userProfile.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    // Update UI
    document.querySelectorAll('.notification-item.unread').forEach(item => {
      item.classList.remove('unread');
      item.classList.add('read');
      const dot = item.querySelector('.notification-dot');
      if (dot) dot.remove();
    });
    
    updateNotificationBadge(0);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

function updateNotificationBadge(count = null) {
  // If count not provided, calculate from DOM
  if (count === null) {
    count = document.querySelectorAll('.notification-item.unread').length;
  }
  
  const mainBadge = document.getElementById('notification-count');
  const navBadge = document.getElementById('nav-notification-count');
  
  [mainBadge, navBadge].forEach(badge => {
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
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

// ======================
// THEME SELECTOR
// ======================
function initThemeSelector() {
  const themeToggle = document.getElementById('nav-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  const themeOptions = document.querySelectorAll('.theme-option');
  
  if (!themeToggle || !themeSelector) return;
  
  themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    themeSelector.classList.toggle('active');
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (themeSelector.classList.contains('active') && 
        !themeSelector.contains(e.target) && 
        !themeToggle.contains(e.target)) {
      themeSelector.classList.remove('active');
    }
  });
  
  // Set up theme options
  themeOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const theme = option.dataset.theme;
      applyTheme(theme);
      themeSelector.classList.remove('active');
    });
  });
  
  // Initialize theme
  initCurrentTheme();
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;
  localStorage.setItem('theme', theme);
  
  // Update active state
  document.querySelectorAll('.theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
  
  // Show confirmation
  showToast(`Theme changed to ${theme}`, 'success');
}

function initCurrentTheme() {
  // Load saved theme or use system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  // Set initial theme
  applyTheme(defaultTheme);
  
  // Set active state on load
  document.querySelector(`.theme-option[data-theme="${defaultTheme}"]`)?.classList.add('active');
}

// ======================
// GLOBAL NAVIGATION
// ======================
function initGlobalNavigation() {
  // Home button - redirect to home-feed
  const homeBtn = document.querySelector('.nav-icon:nth-child(1)');
  if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = 'https://bantustreamconnect.com/';
    });
  }
  
  // Theme toggle already handled in initThemeSelector
  
  // Create Content button
  const createBtn = document.querySelector('.nav-icon:nth-child(3)');
  if (createBtn) {
    createBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = 'login.html?redirect=creator-upload.html';
      }
    });
  }
  
  // Creator Dashboard button
  const dashboardBtn = document.querySelector('.nav-icon:nth-child(4)');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.AuthHelper?.isAuthenticated()) {
        window.location.href = 'creator-dashboard.html';
      } else {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = 'login.html?redirect=creator-dashboard.html';
      }
    });
  }
  
  // Notifications button already handled in initNotificationsPanel
}

// Utility functions
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || '';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '-';
  }
}

// FIXED: Duration never shows dash
function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || isNaN(seconds)) {
    return '0m 0s';
  }
  
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatCommentTime(timestamp) {
  if (!timestamp) return 'Just now';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Recently';
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
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
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

console.log('✅ Content detail script loaded');
