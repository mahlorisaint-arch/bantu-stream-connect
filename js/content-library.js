/**
 * Core Content Library Module
 * Handles initialization, authentication, content fetching, and rendering
 */

// Supabase Configuration (initialized in HTML)
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

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

// Update profile UI with user data
function updateProfileUI(profile) {
  const userProfilePlaceholder = document.getElementById('userProfilePlaceholder');
  if (!userProfilePlaceholder) return;
  
  if (profile) {
    const displayName = profile.full_name || 
                        profile.username || 
                        window.currentUser?.email || 
                        'User';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = profile.avatar_url;
    
    if (avatarUrl) {
      let fullAvatarUrl = avatarUrl;
      if (!avatarUrl.startsWith('http')) {
        if (avatarUrl.startsWith('avatars/')) {
          fullAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/${avatarUrl}`;
        } else {
          fullAvatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`;
        }
      }
      
      userProfilePlaceholder.innerHTML = `
        <img src="${fullAvatarUrl}" alt="${displayName}"
             class="profile-img"
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"
             onerror="this.parentElement.innerHTML = '<div class=\\'profile-placeholder\\' style=\\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold\\'>${initial}</div>'">
      `;
    } else {
      userProfilePlaceholder.innerHTML = `
        <div class="profile-placeholder" style="
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #1D4ED8, #F59E0B);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 16px;
        ">${initial}</div>
      `;
    }
  } else {
    userProfilePlaceholder.innerHTML = '<i class="fas fa-user"></i>';
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

// Fetch content with real view/like counts
async function fetchContent() {
  try {
    console.log('🔄 Fetching content from Supabase...');
    
    // Fetch content items
    const { data: contentData, error: contentError } = await window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (contentError) throw contentError;
    
    // Enrich with real counts
    const enrichedContent = await Promise.all(
      (contentData || []).map(async (item) => {
        // Get real view count
        const { count: viewsCount } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        
        // Get real like count
        const { count: likesCount } = await window.supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        
        return {
          ...item,
          real_views: viewsCount || 0,
          real_likes: likesCount || 0,
          is_new: isContentNew(item.created_at)
        };
      })
    );
    
    console.log('✅ Loaded', enrichedContent.length, 'content items with real counts');
    return enrichedContent;
  } catch (error) {
    console.error('Error fetching content:', error);
    showToast('Failed to load content', 'error');
    return getFallbackContent();
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
      is_new: true
    },
    {
      id: 2,
      title: 'Tech Innovation in Africa',
      thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
      creator: 'Tech Africa',
      creator_id: 2,
      real_views: 8900,
      real_likes: 650,
      is_new: true
    },
    {
      id: 3,
      title: 'Traditional Dance Performance',
      thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
      creator: 'Cultural Hub',
      creator_id: 3,
      real_views: 15600,
      real_likes: 1200,
      is_new: true
    },
    {
      id: 4,
      title: 'African Cuisine Cooking Show',
      thumbnail_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=225&fit=crop',
      creator: 'Chef Amina',
      creator_id: 4,
      real_views: 7800,
      real_likes: 540,
      is_new: true
    },
    {
      id: 5,
      title: 'Startup Success Stories',
      thumbnail_url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=225&fit=crop',
      creator: 'Startup Africa',
      creator_id: 5,
      real_views: 11200,
      real_likes: 890,
      is_new: true
    },
    {
      id: 6,
      title: 'Sports Highlights: African Cup',
      thumbnail_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=225&fit=crop',
      creator: 'Sports Network',
      creator_id: 6,
      real_views: 21500,
      real_likes: 1800,
      is_new: true
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
      ${category}
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
        <h2 class="section-title">${categories[window.selectedCategoryIndex]}</h2>
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
    
    return `
      <a href="content-detail.html?id=${content.id}" class="content-card" data-content-id="${content.id}">
        <div class="card-thumbnail">
          <img src="${thumbnailUrl}"
               alt="${escapeHtml(content.title)}"
               loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'">
          <div class="thumbnail-overlay"></div>
          <div class="play-overlay">
            <div class="play-icon">
              <i class="fas fa-play"></i>
            </div>
          </div>
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
            ${truncateText(content.title, 50)}
          </h3>
          <button class="creator-btn"
                  onclick="event.preventDefault(); event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
            <i class="fas fa-user"></i>
            ${truncateText(creator, 15)}
          </button>
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
    initTheme();
    
    // Check authentication
    loadingText.textContent = 'Checking authentication...';
    await checkAuth();
    
    // Load content
    loadingText.textContent = 'Loading content...';
    window.allContentData = await fetchContent();
    window.filteredContentData = window.allContentData;
    
    // Render UI
    loadingText.textContent = 'Setting up interface...';
    renderCategoryTabs();
    renderContentSections();
    
    // Setup listeners
    setupCoreListeners();
    initFeatures();
    
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
      renderNotifications();
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
