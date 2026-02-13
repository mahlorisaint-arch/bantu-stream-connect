/**
 * Core Content Library Module
 * Handles initialization, authentication, content fetching, and rendering
 */

// Supabase Configuration from environment
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Environment check
if (!window.ENV) {
  console.warn('⚠️ Using fallback credentials. Set up environment variables for production.');
}

// Global state variables
window.currentUser = null;
window.allContentData = [];
window.filteredContentData = [];
window.notifications = [];
window.selectedCategoryIndex = 0;

// Categories list
const categories = [
  'All',
  'Music',
  'STEM',
  'Culture',
  'News',
  'Sports',
  'Movies',
  'Documentaries',
  'Podcasts',
  'Skits',
  'Videos'
];

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Check authentication status
async function checkAuth() {
  try {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    
    window.currentUser = session?.user || null;
    
    if (window.currentUser) {
      console.log('✅ User authenticated:', window.currentUser.email);
      await loadUserProfile();
    } else {
      console.log('⚠️ User not authenticated');
      updateProfileUI(null);
    }
    
    return window.currentUser;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

// Load user profile from database
async function loadUserProfile() {
  try {
    if (!window.currentUser) return;
    
    const { data: profile, error } = await window.supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', window.currentUser.id)
      .maybeSingle();
    
    if (error) {
      console.warn('Profile fetch error:', error);
      updateProfileUI(null);
      return;
    }
    
    updateProfileUI(profile);
    await loadNotifications();
  } catch (error) {
    console.error('Error loading profile:', error);
    updateProfileUI(null);
  }
}

// Update profile UI with user data (XSS-safe version)
function updateProfileUI(profile) {
  const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
  if (!userProfilePlaceholder) return;
  
  // Clear existing content safely
  while (userProfilePlaceholder.firstChild) {
    userProfilePlaceholder.removeChild(userProfilePlaceholder.firstChild);
  }
  
  if (profile) {
    const displayName = profile.full_name || 
                        profile.username || 
                        window.currentUser?.email || 
                        'User';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = profile.avatar_url;
    
    if (avatarUrl) {
      const img = document.createElement('img');
      img.className = 'profile-img';
      img.alt = displayName;
      img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
      
      // Validate and construct URL safely
      try {
        if (avatarUrl.startsWith('http')) {
          img.src = avatarUrl;
        } else if (avatarUrl.startsWith('avatars/')) {
          img.src = `${SUPABASE_URL}/storage/v1/object/public/${avatarUrl}`;
        } else {
          img.src = `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`;
        }
        
        img.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'profile-placeholder';
          fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold';
          fallback.textContent = initial;
          userProfilePlaceholder.innerHTML = '';
          userProfilePlaceholder.appendChild(fallback);
        };
        
        userProfilePlaceholder.appendChild(img);
      } catch (e) {
        console.error('Invalid avatar URL:', e);
        const fallback = document.createElement('div');
        fallback.className = 'profile-placeholder';
        fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold';
        fallback.textContent = initial;
        userProfilePlaceholder.appendChild(fallback);
      }
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'profile-placeholder';
      fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
      fallback.textContent = initial;
      userProfilePlaceholder.appendChild(fallback);
    }
  } else {
    const icon = document.createElement('i');
    icon.className = 'fas fa-user';
    userProfilePlaceholder.appendChild(icon);
  }
}

// ============================================
// CONTENT FUNCTIONS
// ============================================

// Fix media URL for Supabase storage
function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

// Format duration from seconds to MM:SS or HH:MM:SS
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Fetch content with pagination and real view/like counts
async function fetchContent(page = 0, pageSize = 20) {
  try {
    console.log(`🔄 Fetching content page ${page + 1}...`);
    
    // Calculate range for pagination
    const from = page * pageSize;
    const to = (page + 1) * pageSize - 1;
    
    // Use rate limiter with null check
    const fetchFn = async () => {
      const { data: contentData, error: contentError } = await window.supabaseClient
        .from('Content')
        .select('*, user_profiles!user_id(*)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (contentError) throw contentError;
      return contentData || [];
    };
    
    const userId = window.currentUser?.id;
    const rateLimiter = userId ? (window.authRateLimiter || window.rateLimiter) : window.rateLimiter;
    
    let contentData;
    if (!rateLimiter) {
      console.warn('Rate limiter not initialized, proceeding without rate limiting');
      contentData = await fetchFn();
    } else {
      contentData = await rateLimiter.wrapSupabaseRequest(
        userId, 
        'fetch-content',
        fetchFn
      );
    }
    
    // Enrich with real counts (limit concurrent requests)
    const enrichedContent = [];
    for (const item of contentData) {
      // Get real view count with rate limiting
      let viewsCount = 0;
      let likesCount = 0;
      
      if (rateLimiter) {
        viewsCount = await rateLimiter.wrapSupabaseRequest(
          userId,
          'get-views',
          async () => {
            const { count } = await window.supabaseClient
              .from('content_views')
              .select('*', { count: 'exact', head: true })
              .eq('content_id', item.id);
            return count || 0;
          }
        );
        
        // Get real like count with rate limiting
        likesCount = await rateLimiter.wrapSupabaseRequest(
          userId,
          'get-likes',
          async () => {
            const { count } = await window.supabaseClient
              .from('content_likes')
              .select('*', { count: 'exact', head: true })
              .eq('content_id', item.id);
            return count || 0;
          }
        );
      } else {
        // Fallback without rate limiting
        const { count: viewsCountResult } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        viewsCount = viewsCountResult || 0;
        
        const { count: likesCountResult } = await window.supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        likesCount = likesCountResult || 0;
      }
      
      enrichedContent.push({
        ...item,
        real_views: viewsCount,
        real_likes: likesCount,
        is_new: isContentNew(item.created_at)
      });
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`✅ Loaded page ${page + 1} with`, enrichedContent.length, 'items');
    
    // Store for potential future use
    if (!window.allContentData) window.allContentData = [];
    if (page === 0) {
      window.allContentData = enrichedContent;
    } else {
      window.allContentData = [...window.allContentData, ...enrichedContent];
    }
    
    return {
      items: enrichedContent,
      hasMore: enrichedContent.length === pageSize,
      page,
      pageSize
    };
  } catch (error) {
    console.error('Error fetching content:', error);
    
    if (error.message?.includes('Rate limit')) {
      showToast(error.message, 'warning');
    } else {
      showToast('Failed to load content', 'error');
    }
    
    // Return fallback for first page only
    if (page === 0) {
      return {
        items: getFallbackContent(),
        hasMore: false,
        page,
        pageSize
      };
    }
    
    return {
      items: [],
      hasMore: false,
      page,
      pageSize
    };
  }
}

// Check if content is new (less than 7 days old)
function isContentNew(createdAt) {
  if (!createdAt) return false;
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo < 7;
}

// Fallback content for errors
function getFallbackContent() {
  return [
    {
      id: 1,
      title: 'African Music Festival Highlights',
      thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop',
      creator: 'Music Africa',
      creator_id: 1,
      real_views: 12500,
      real_likes: 890,
      is_new: true,
      duration: 245
    },
    {
      id: 2,
      title: 'Tech Innovation in Africa',
      thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
      creator: 'Tech Africa',
      creator_id: 2,
      real_views: 8900,
      real_likes: 650,
      is_new: true,
      duration: 187
    },
    {
      id: 3,
      title: 'Traditional Dance Performance',
      thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
      creator: 'Cultural Hub',
      creator_id: 3,
      real_views: 15600,
      real_likes: 1200,
      is_new: true,
      duration: 320
    },
    {
      id: 4,
      title: 'African Cuisine Cooking Show',
      thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
      creator: 'Chef Amina',
      creator_id: 4,
      real_views: 7800,
      real_likes: 540,
      is_new: true,
      duration: 420
    },
    {
      id: 5,
      title: 'Startup Success Stories',
      thumbnail_url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=225&fit=crop',
      creator: 'Startup Africa',
      creator_id: 5,
      real_views: 11200,
      real_likes: 890,
      is_new: true,
      duration: 280
    },
    {
      id: 6,
      title: 'Sports Highlights: African Cup',
      thumbnail_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=225&fit=crop',
      creator: 'Sports Network',
      creator_id: 6,
      real_views: 21500,
      real_likes: 1800,
      is_new: true,
      duration: 195
    }
  ];
}

// Get trending content based on engagement
function getTrendingContent(contentData) {
  if (!contentData || contentData.length === 0) return [];
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return [...contentData]
    .filter(item => {
      try {
        return new Date(item.created_at) >= oneWeekAgo;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const aScore = (a.real_views || 0) + ((a.real_likes || 0) * 2);
      const bScore = (b.real_views || 0) + ((b.real_likes || 0) * 2);
      return bScore - aScore;
    })
    .slice(0, 8);
}

// Get featured content (most viewed)
function getFeaturedContent(contentData) {
  if (!contentData || contentData.length === 0) return [];
  
  return [...contentData]
    .sort((a, b) => (b.real_views || 0) - (a.real_views || 0))
    .slice(0, 6);
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

// Render category tabs
function renderCategoryTabs() {
  const categoryTabs = document.getElementById('category-tabs');
  if (!categoryTabs) return;
  
  categoryTabs.innerHTML = categories.map((category, index) => `
    <button class="category-tab ${index === window.selectedCategoryIndex ? 'active' : ''}"
            data-index="${index}">
      ${escapeHtml(category)}
    </button>
  `).join('');
  
  // Add event listeners to tabs
  document.querySelectorAll('.category-tab').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      onCategoryChanged(index);
    });
  });
}

// Handle category change
function onCategoryChanged(index) {
  window.selectedCategoryIndex = index;
  const selectedCategory = categories[index];
  
  // Update active tab UI
  document.querySelectorAll('.category-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  
  // Filter content
  if (selectedCategory === 'All') {
    window.filteredContentData = window.allContentData;
  } else {
    window.filteredContentData = window.allContentData.filter(item => {
      const itemGenre = item.genre || '';
      return itemGenre.toLowerCase() === selectedCategory.toLowerCase();
    });
  }
  
  renderContentSections();
}

// Render skeleton loaders
function renderSkeletonLoaders(count = 6) {
  let skeletons = '';
  for (let i = 0; i < count; i++) {
    skeletons += `
      <div class="skeleton-card">
        <div class="skeleton-thumbnail"></div>
        <div class="skeleton-title"></div>
        <div class="skeleton-creator"></div>
        <div class="skeleton-stats"></div>
      </div>
    `;
  }
  return skeletons;
}

// Render content sections (featured, trending, category)
function renderContentSections() {
  const contentSections = document.getElementById('content-sections');
  if (!contentSections) return;
  
  const featuredContent = getFeaturedContent(window.filteredContentData);
  const trendingContent = getTrendingContent(window.filteredContentData);
  
  // Show empty state if no content
  if (window.filteredContentData.length === 0) {
    contentSections.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-film"></i>
        <h3>No Content Available</h3>
        <p>Check back later for new content!</p>
      </div>
    `;
    return;
  }
  
  // Build sections HTML
  let sectionsHTML = '';
  
  // Featured section
  if (featuredContent.length > 0) {
    sectionsHTML += `
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Featured Content</h2>
          <button class="see-all-btn" data-action="view-all-featured">See All</button>
        </div>
        <div class="content-grid">
          ${renderContentCards(featuredContent)}
        </div>
      </section>
    `;
  }
  
  // Trending section
  if (trendingContent.length > 0) {
    sectionsHTML += `
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Trending Now</h2>
          <button class="see-all-btn" data-action="view-all-trending">See All</button>
        </div>
        <div class="content-grid">
          ${renderContentCards(trendingContent, true)}
        </div>
      </section>
    `;
  }
  
  // Category section
  sectionsHTML += `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(categories[window.selectedCategoryIndex])}</h2>
        <div style="color: var(--slate-grey); font-size: 14px;">
          ${window.filteredContentData.length} items
        </div>
      </div>
      <div class="content-grid">
        ${renderContentCards(window.filteredContentData.slice(0, 12))}
      </div>
    </section>
  `;
  
  contentSections.innerHTML = sectionsHTML;
}

// Render content cards
function renderContentCards(contentItems, isTrending = false) {
  if (!contentItems || contentItems.length === 0) {
    return '<div class="empty-state">No content available</div>';
  }
  
  return contentItems.map(content => {
    const thumbnailUrl = content.thumbnail_url ?
      fixMediaUrl(content.thumbnail_url) :
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
    
    const creator = content.user_profiles?.full_name ||
                    content.user_profiles?.username ||
                    content.creator ||
                    'Creator';
    
    const creatorId = content.user_profiles?.id || content.user_id || content.creator_id;
    
    // Determine badges
    const badges = [];
    if (isTrending) badges.push('TRENDING');
    if (content.is_new) badges.push('NEW');
    
    // Calculate rating if available
    const rating = content.rating || (content.real_likes ? Math.min(5, (content.real_likes / 100) + 3) : null);
    
    return `
      <a href="content-detail.html?id=${content.id}" class="content-card" data-content-id="${content.id}">
        <div class="card-thumbnail">
          <img src="${escapeHtml(thumbnailUrl)}"
               alt="${escapeHtml(content.title)}"
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          <div class="thumbnail-overlay"></div>
          <div class="play-overlay">
            <div class="play-icon">
              <i class="fas fa-play"></i>
            </div>
          </div>
          ${content.duration ? `
            <div class="card-badge badge-duration" style="position:absolute;bottom:10px;right:10px;z-index:2;">
              <i class="fas fa-clock"></i>
              ${formatDuration(content.duration)}
            </div>
          ` : ''}
          ${badges.length > 0 ? `
            <div class="card-badges">
              ${badges.map(badge => `
                <div class="card-badge ${badge === 'TRENDING' ? 'badge-trending' : 'badge-new'}">
                  <i class="fas ${badge === 'TRENDING' ? 'fa-fire' : 'fa-clock'}"></i>
                  ${badge}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="card-content">
          <h3 class="card-title" title="${escapeHtml(content.title)}">
            ${truncateText(escapeHtml(content.title), 50)}
          </h3>
          <button class="creator-btn"
                  onclick="event.preventDefault(); event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
            <i class="fas fa-user"></i>
            ${truncateText(escapeHtml(creator), 15)}
          </button>
          ${rating ? `
            <div class="card-rating">
              <i class="fas fa-star" style="color: var(--warm-gold);"></i>
              ${rating.toFixed(1)}
            </div>
          ` : ''}
          <div class="card-stats">
            <div class="card-stat">
              <i class="fas fa-eye"></i>
              ${formatNumber(content.real_views || 0)}
            </div>
            <div class="card-stat">
              <i class="fas fa-heart"></i>
              ${formatNumber(content.real_likes || 0)}
            </div>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ============================================
// CORE EVENT LISTENERS
// ============================================

// Setup core event listeners
function setupCoreListeners() {
  // Profile button navigation
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        window.location.href = 'profile.html';
      } else {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
      }
    });
  }
  
  // Browse all button
  const browseAllBtn = document.getElementById('browse-all-btn');
  if (browseAllBtn) {
    browseAllBtn.addEventListener('click', () => {
      if (window.allContentData.length > 0) {
        window.location.href = `content-detail.html?id=${window.allContentData[0].id}`;
      }
    });
  }
  
  // Home navigation button
  const homeBtn = document.getElementById('nav-home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  // Create content button
  const createBtn = document.getElementById('nav-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to upload content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  // Dashboard button
  const dashboardBtn = document.getElementById('nav-dashboard-btn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', async () => {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) {
        window.location.href = 'creator-dashboard.html';
      } else {
        showToast('Please sign in to access dashboard', 'warning');
        window.location.href = `login.html?redirect=creator-dashboard.html`;
      }
    });
  }
  
  // See all buttons (delegated event)
  document.addEventListener('click', (e) => {
    const seeAllBtn = e.target.closest('[data-action^="view-all"]');
    if (seeAllBtn) {
      const action = seeAllBtn.dataset.action.replace('view-all-', '');
      showToast(`Viewing all ${action} content`, 'info');
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize the entire application
async function initContentLibrary() {
  console.log('📚 Content Library Initializing with enhanced features...');
  
  const loadingScreen = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');
  const app = document.getElementById('app');
  
  try {
    // Initialize theme first to avoid FOUC
    if (typeof initTheme === 'function') initTheme();
    
    // Check authentication
    loadingText.textContent = 'Checking authentication...';
    await checkAuth();
    
    // Load content with skeleton loading
    loadingText.textContent = 'Loading content...';
    
    // Show skeleton loading in content sections
    const contentSections = document.getElementById('content-sections');
    if (contentSections) {
      contentSections.innerHTML = `
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Featured Content</h2>
          </div>
          <div class="content-grid">
            ${renderSkeletonLoaders(6)}
          </div>
        </section>
      `;
    }
    
    // Load first page of content - use global pagination variables
    const result = await fetchContent(0, window.PAGE_SIZE || 20);
    window.allContentData = result.items;
    window.filteredContentData = window.allContentData;
    window.hasMoreContent = result.hasMore;
    window.currentPage = 0;
    
    // Render UI
    loadingText.textContent = 'Setting up interface...';
    renderCategoryTabs();
    renderContentSections();
    
    // Setup listeners
    setupCoreListeners();
    if (typeof initFeatures === 'function') initFeatures();
    if (typeof setupInfiniteScroll === 'function') setupInfiniteScroll();
    if (typeof setupKeyboardNavigation === 'function') setupKeyboardNavigation();
    
    // Initialize rate limiter cleanup
    if (window.rateLimiter) window.rateLimiter.startCleanup();
    if (window.authRateLimiter) window.authRateLimiter.startCleanup();
    
    // Show app after brief delay for smooth transition
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      app.style.display = 'block';
      
      // Trigger animations
      document.querySelectorAll('.content-card').forEach((card, index) => {
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 300 + (index * 50));
      });
    }, 500);
    
    console.log('✅ Content Library initialized successfully');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    loadingText.textContent = 'Error loading content. Please refresh.';
    showToast('Failed to initialize. Please refresh the page.', 'error');
    
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      app.style.display = 'block';
    }, 1000);
  }
  
  // Auth state change listener
  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN') {
      window.currentUser = session.user;
      loadUserProfile();
      loadNotifications();
      showToast('Welcome back!', 'success');
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      updateProfileUI(null);
      updateNotificationBadge(0);
      window.notifications = [];
      if (typeof renderNotifications === 'function') renderNotifications();
      showToast('You have been signed out', 'info');
    }
  });
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Supabase client (must happen before other code)
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized');
  
  // Start app initialization
  initContentLibrary();
});
