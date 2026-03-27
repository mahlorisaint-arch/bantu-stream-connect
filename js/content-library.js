/**
 * Core Content Library Module
 * Handles initialization, authentication, content fetching, and rendering
 * 
 * 🎯 UPDATED: Mobile header fixes, navigation button centering, UI scale improvements
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
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;

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
// UI SCALE CONTROLLER (from home feed)
// ============================================
class UIScaleController {
    constructor() {
        this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
        this.minScale = 0.8;
        this.maxScale = 1.4;
        this.step = 0.1;
    }
    init() {
        this.applyScale();
        this.setupEventListeners();
    }
    setupEventListeners() {
        document.addEventListener('scaleChanged', (e) => {
            this.updateScaleDisplay(e.detail.scale);
        });
    }
    applyScale() {
        document.documentElement.style.setProperty('--ui-scale', this.scale);
        localStorage.setItem('bantu_ui_scale', this.scale.toString());
        document.dispatchEvent(new CustomEvent('scaleChanged', {
            detail: { scale: this.scale }
        }));
    }
    increase() {
        if (this.scale < this.maxScale) {
            this.scale = Math.min(this.maxScale, this.scale + this.step);
            this.applyScale();
        }
    }
    decrease() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.step);
            this.applyScale();
        }
    }
    reset() {
        this.scale = 1;
        this.applyScale();
    }
    getScale() {
        return this.scale;
    }
    updateScaleDisplay(scale) {
        const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
        displays.forEach(el => {
            if (el) el.textContent = Math.round(scale * 100) + '%';
        });
    }
}

// Initialize UI Scale Controller globally
window.uiScaleController = new UIScaleController();

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Check authentication status
async function checkAuth() {
  try {
    if (!window.supabaseClient) {
      console.error('❌ Supabase client not initialized');
      return null;
    }
    
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
  const currentProfileName = document.getElementById('current-profile-name');
  const sidebarProfileName = document.getElementById('sidebar-profile-name');
  const sidebarProfileEmail = document.getElementById('sidebar-profile-email');
  const sidebarProfileAvatar = document.getElementById('sidebar-profile-avatar');
  
  if (!userProfilePlaceholder) return;
  
  // Clear existing content safely
  while (userProfilePlaceholder.firstChild) {
    userProfilePlaceholder.removeChild(userProfilePlaceholder.firstChild);
  }
  
  if (profile && window.currentUser) {
    const displayName = profile.full_name || 
                        profile.username || 
                        window.currentUser.email?.split('@')[0] || 
                        'User';
    const email = window.currentUser.email || '';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = profile.avatar_url;
    
    // Update profile name displays
    if (currentProfileName) currentProfileName.textContent = displayName;
    if (sidebarProfileName) sidebarProfileName.textContent = displayName;
    if (sidebarProfileEmail) sidebarProfileEmail.textContent = email;
    
    if (avatarUrl) {
      const img = document.createElement('img');
      img.alt = displayName;
      img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
      
      try {
        if (avatarUrl.startsWith('http')) {
          img.src = avatarUrl;
        } else if (avatarUrl.startsWith('avatars/')) {
          img.src = `${SUPABASE_URL}/storage/v1/object/public/${avatarUrl}`;
        } else {
          img.src = `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`;
        }
        
        img.onerror = () => {
          setFallbackAvatar(initial, userProfilePlaceholder, sidebarProfileAvatar);
        };
        
        userProfilePlaceholder.appendChild(img);
        
        // Update sidebar avatar
        if (sidebarProfileAvatar) {
          sidebarProfileAvatar.innerHTML = '';
          const sidebarImg = document.createElement('img');
          sidebarImg.src = img.src;
          sidebarImg.alt = displayName;
          sidebarImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
          sidebarProfileAvatar.appendChild(sidebarImg);
        }
      } catch (e) {
        console.error('Invalid avatar URL:', e);
        setFallbackAvatar(initial, userProfilePlaceholder, sidebarProfileAvatar);
      }
    } else {
      setFallbackAvatar(initial, userProfilePlaceholder, sidebarProfileAvatar);
    }
  } else {
    // Guest user
    if (currentProfileName) currentProfileName.textContent = 'Guest';
    if (sidebarProfileName) sidebarProfileName.textContent = 'Guest';
    if (sidebarProfileEmail) sidebarProfileEmail.textContent = 'Sign in to continue';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-user';
    userProfilePlaceholder.appendChild(icon);
    
    if (sidebarProfileAvatar) {
      sidebarProfileAvatar.innerHTML = '';
      const fallbackIcon = document.createElement('i');
      fallbackIcon.className = 'fas fa-user';
      fallbackIcon.style.cssText = 'font-size: 1.5rem;';
      sidebarProfileAvatar.appendChild(fallbackIcon);
    }
  }
  
  // Apply mobile header styles
  applyMobileHeaderStyles();
}

function setFallbackAvatar(initial, userPlaceholder, sidebarAvatar) {
  const fallback = document.createElement('div');
  fallback.className = 'profile-placeholder';
  fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px';
  fallback.textContent = initial;
  userPlaceholder.innerHTML = '';
  userPlaceholder.appendChild(fallback);
  
  if (sidebarAvatar) {
    sidebarAvatar.innerHTML = '';
    const sidebarFallback = document.createElement('div');
    sidebarFallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem';
    sidebarFallback.textContent = initial;
    sidebarAvatar.appendChild(sidebarFallback);
  }
}

// ✅ MOBILE FIX: Apply styles to hide profile picture on mobile
function applyMobileHeaderStyles() {
    const isMobile = window.innerWidth <= 480;
    const profileBtn = document.querySelector('.profile-btn');
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    const analyticsBtn = document.getElementById('analytics-btn');
    
    if (isMobile) {
        // Hide the profile picture/avatar on mobile
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'none';
        }
        // Hide analytics button on mobile
        if (analyticsBtn) {
            analyticsBtn.style.display = 'none';
        }
        // Ensure the button still shows the name
        if (profileBtn) {
            profileBtn.style.minWidth = 'auto';
            profileBtn.style.padding = '0.3125rem 0.75rem';
            profileBtn.style.justifyContent = 'center';
        }
        // Ensure name is visible
        if (profileNameSpan) {
            profileNameSpan.style.display = 'inline-block';
        }
    } else {
        // Show profile picture on desktop
        if (profilePlaceholder) {
            profilePlaceholder.style.display = 'flex';
        }
        // Show analytics button on desktop
        if (analyticsBtn) {
            analyticsBtn.style.display = 'flex';
        }
        if (profileBtn) {
            profileBtn.style.minWidth = '160px';
            profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
            profileBtn.style.justifyContent = 'flex-start';
        }
    }
}

// Listen for window resize to update mobile header styles
window.addEventListener('resize', () => {
    applyMobileHeaderStyles();
});

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

// Format large numbers (1k, 1M)
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if content is new (less than 7 days old)
function isContentNew(createdAt) {
  if (!createdAt) return false;
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo < 7;
}

// Fetch content with pagination and real view/like counts
async function fetchContent(page = 0, pageSize = 20) {
  try {
    console.log(`🔄 Fetching content page ${page + 1}...`);
    
    // Calculate range for pagination
    const from = page * pageSize;
    const to = (page + 1) * pageSize - 1;
    
    // Use rate limiter if available
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
      contentData = await fetchFn();
    } else {
      contentData = await rateLimiter.wrapSupabaseRequest(
        userId, 
        'fetch-content',
        fetchFn
      );
    }
    
    // Enrich with real counts
    const enrichedContent = [];
    for (const item of contentData) {
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
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`✅ Loaded page ${page + 1} with`, enrichedContent.length, 'items');
    
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
  
  document.querySelectorAll('.category-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
  
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
    
    const badges = [];
    if (isTrending) badges.push('TRENDING');
    if (content.is_new) badges.push('NEW');
    
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

// Render content sections (featured, trending, category)
function renderContentSections() {
  const contentSections = document.getElementById('content-sections');
  if (!contentSections) return;
  
  const featuredContent = getFeaturedContent(window.filteredContentData);
  const trendingContent = getTrendingContent(window.filteredContentData);
  
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
  
  let sectionsHTML = '';
  
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

// ============================================
// LOAD MORE / INFINITE SCROLL
// ============================================

// Setup infinite scroll
function setupInfiniteScroll() {
  const sentinel = document.getElementById('infinite-scroll-sentinel');
  if (!sentinel) return;
  
  const observer = new IntersectionObserver(async (entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && window.hasMoreContent && !window.isLoadingMore) {
      await loadMoreContent();
    }
  }, {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
  });
  
  observer.observe(sentinel);
}

// Load more content
async function loadMoreContent() {
  if (window.isLoadingMore || !window.hasMoreContent) return;
  
  window.isLoadingMore = true;
  window.currentPage++;
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'infinite-scroll-loading';
  loadingIndicator.id = 'infinite-scroll-loading';
  loadingIndicator.innerHTML = `
    <div class="infinite-scroll-spinner"></div>
    <div>Loading more content...</div>
  `;
  document.querySelector('.container').appendChild(loadingIndicator);
  
  try {
    const result = await fetchContent(window.currentPage, window.PAGE_SIZE);
    
    document.getElementById('infinite-scroll-loading')?.remove();
    
    if (result.items.length > 0) {
      appendContentToSections(result.items);
      window.hasMoreContent = result.hasMore;
    } else {
      window.hasMoreContent = false;
      
      const endMessage = document.createElement('div');
      endMessage.className = 'infinite-scroll-end';
      endMessage.innerHTML = 'You\'ve reached the end of content';
      document.querySelector('.container').appendChild(endMessage);
      setTimeout(() => endMessage.remove(), 3000);
    }
  } catch (error) {
    console.error('Error loading more content:', error);
    document.getElementById('infinite-scroll-loading')?.remove();
    window.hasMoreContent = false;
  } finally {
    window.isLoadingMore = false;
  }
}

// Append content to existing sections
function appendContentToSections(newItems) {
  const categorySection = document.querySelectorAll('.section')[2];
  if (!categorySection) return;
  
  const contentGrid = categorySection.querySelector('.content-grid');
  if (!contentGrid) return;
  
  const newCardsHTML = renderContentCards(newItems);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = newCardsHTML;
  
  while (tempDiv.firstChild) {
    contentGrid.appendChild(tempDiv.firstChild);
  }
  
  const itemCount = categorySection.querySelector('[style*="color: var(--slate-grey)"]');
  if (itemCount) {
    const currentCount = parseInt(itemCount.textContent) || 0;
    itemCount.textContent = `${currentCount + newItems.length} items`;
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

// Load user notifications
async function loadNotifications() {
  try {
    if (!window.currentUser) {
      updateNotificationBadge(0);
      return;
    }
    
    const { data, error } = await window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    window.notifications = data || [];
    const unreadCount = window.notifications.filter(n => !n.is_read).length;
    updateNotificationBadge(unreadCount);
  } catch (error) {
    console.error('Error loading notifications:', error);
    updateNotificationBadge(0);
  }
}

// Update notification badge
function updateNotificationBadge(count) {
  const mainBadge = document.getElementById('notification-count');
  const navBadge = document.getElementById('nav-notification-count');
  const sidebarBadge = document.getElementById('sidebar-notification-count');
  
  [mainBadge, navBadge, sidebarBadge].forEach(badge => {
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

// Render notifications panel
function renderNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  
  if (!window.currentUser) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>Sign in to see notifications</p>
      </div>
    `;
    return;
  }
  
  if (!window.notifications || window.notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }
  
  notificationsList.innerHTML = window.notifications.map(notification => `
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
}

// Get notification icon
function getNotificationIcon(type) {
  switch(type) {
    case 'like': return 'fas fa-heart';
    case 'comment': return 'fas fa-comment';
    case 'follow': return 'fas fa-user-plus';
    default: return 'fas fa-bell';
  }
}

// Format notification time
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

// Setup notifications panel
function setupNotifications() {
  const notificationsBtn = document.getElementById('notifications-btn');
  const notificationsPanel = document.getElementById('notifications-panel');
  const closeNotifications = document.getElementById('close-notifications');
  const markAllRead = document.getElementById('mark-all-read');
  
  if (!notificationsBtn || !notificationsPanel) return;
  
  const openNotifications = () => {
    notificationsPanel.classList.add('active');
    renderNotifications();
  };
  
  notificationsBtn.addEventListener('click', openNotifications);
  
  if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
      notificationsPanel.classList.remove('active');
    });
  }
  
  document.addEventListener('click', (e) => {
    if (notificationsPanel.classList.contains('active') &&
        !notificationsPanel.contains(e.target) &&
        !notificationsBtn.contains(e.target)) {
      notificationsPanel.classList.remove('active');
    }
  });
  
  if (markAllRead) {
    markAllRead.addEventListener('click', async () => {
      if (!window.currentUser) return;
      
      try {
        const { error } = await window.supabaseClient
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', window.currentUser.id)
          .eq('is_read', false);
        
        if (error) throw error;
        
        if (window.notifications) {
          window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
        }
        
        renderNotifications();
        updateNotificationBadge(0);
        showToast('All notifications marked as read', 'success');
      } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
      }
    });
  }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

// Search content
async function searchContent(query, category = '', sortBy = 'newest') {
  try {
    let queryBuilder = window.supabaseClient
      .from('Content')
      .select('*, user_profiles!user_id(*)')
      .ilike('title', `%${query}%`)
      .eq('status', 'published');
    
    if (category) {
      queryBuilder = queryBuilder.eq('genre', category);
    }
    
    if (sortBy === 'newest') {
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
    }
    
    const { data, error } = await queryBuilder.limit(50);
    if (error) throw error;
    
    const enriched = await Promise.all(
      (data || []).map(async (item) => {
        const { count: viewsCount } = await window.supabaseClient
          .from('content_views')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        
        const { count: likesCount } = await window.supabaseClient
          .from('content_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', item.id);
        
        return { 
          ...item, 
          real_views: viewsCount || 0, 
          real_likes: likesCount || 0 
        };
      })
    );
    
    if (sortBy === 'popular') {
      enriched.sort((a, b) => (b.real_views || 0) - (a.real_views || 0));
    } else if (sortBy === 'trending') {
      enriched.sort((a, b) => {
        const aScore = (a.real_views || 0) + ((a.real_likes || 0) * 2);
        const bScore = (b.real_views || 0) + ((b.real_likes || 0) * 2);
        return bScore - aScore;
      });
    }
    
    return enriched;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Render search results
function renderSearchResults(results) {
  const grid = document.getElementById('search-results-grid');
  if (!grid) return;
  
  if (!results || results.length === 0) {
    grid.innerHTML = '<div class="no-results">No results found. Try different keywords.</div>';
    return;
  }
  
  grid.innerHTML = results.map(item => {
    const creator = item.user_profiles?.full_name || 
                    item.user_profiles?.username || 
                    item.creator || 
                    'Creator';
    const creatorId = item.user_profiles?.id || item.user_id;
    
    return `
      <div class="content-card" data-content-id="${item.id}">
        <div class="card-thumbnail">
          <img src="${fixMediaUrl(item.thumbnail_url) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop'}"
               alt="${escapeHtml(item.title)}"
               loading="lazy">
          <div class="thumbnail-overlay"></div>
          <div class="play-overlay">
            <div class="play-icon">
              <i class="fas fa-play"></i>
            </div>
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${truncateText(escapeHtml(item.title), 45)}</h3>
          <button class="creator-btn"
                  onclick="event.stopPropagation(); window.location.href='creator-channel.html?id=${creatorId}&name=${encodeURIComponent(creator)}'">
            <i class="fas fa-user"></i>
            ${truncateText(escapeHtml(creator), 15)}
          </button>
          <div class="card-stats">
            <div class="card-stat">
              <i class="fas fa-eye"></i>
              ${formatNumber(item.real_views || 0)}
            </div>
            <div class="card-stat">
              <i class="fas fa-heart"></i>
              ${formatNumber(item.real_likes || 0)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  grid.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.creator-btn')) return;
      const id = card.dataset.contentId;
      if (id) window.location.href = `content-detail.html?id=${id}`;
    });
  });
}

// Setup search modal
function setupSearch() {
  const searchBtn = document.getElementById('search-btn');
  const searchModal = document.getElementById('search-modal');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('search-input');
  
  if (!searchBtn || !searchModal) return;
  
  searchBtn.addEventListener('click', () => {
    searchModal.classList.add('active');
    setTimeout(() => searchInput?.focus(), 300);
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
  
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', async (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        const category = document.getElementById('category-filter')?.value;
        const sortBy = document.getElementById('sort-filter')?.value;
        
        const resultsGrid = document.getElementById('search-results-grid');
        if (!resultsGrid) return;
        
        if (query.length < 2) {
          resultsGrid.innerHTML = '<div class="no-results">Start typing to search...</div>';
          return;
        }
        
        resultsGrid.innerHTML = `
          <div class="infinite-scroll-loading">
            <div class="infinite-scroll-spinner"></div>
            <div>Searching...</div>
          </div>
        `;
        
        const results = await searchContent(query, category, sortBy);
        renderSearchResults(results);
      }, 300);
    });
  }
  
  document.getElementById('category-filter')?.addEventListener('change', () => {
    if (searchInput && searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
  
  document.getElementById('sort-filter')?.addEventListener('change', () => {
    if (searchInput && searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });
}

// ============================================
// ANALYTICS
// ============================================

// Setup analytics modal
function setupAnalytics() {
  const analyticsBtn = document.getElementById('analytics-btn');
  const analyticsModal = document.getElementById('analytics-modal');
  const closeAnalytics = document.getElementById('close-analytics');
  
  if (!analyticsBtn || !analyticsModal) return;
  
  analyticsBtn.addEventListener('click', async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      showToast('Please sign in to view analytics', 'warning');
      return;
    }
    
    analyticsModal.classList.add('active');
    
    if (window.allContentData && window.allContentData.length > 0) {
      document.getElementById('total-views').textContent = formatNumber(
        window.allContentData.reduce((sum, item) => sum + (item.real_views || 0), 0)
      );
      
      document.getElementById('total-content').textContent = window.allContentData.length;
      
      document.getElementById('active-creators').textContent = 
        new Set(window.allContentData.map(item => item.user_id)).size;
    }
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

// ============================================
// UI SETUP
// ============================================

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    error: 'fa-exclamation-triangle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Setup back to top button
function setupBackToTop() {
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (!backToTopBtn) return;
  
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  window.addEventListener('scroll', () => {
    backToTopBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none';
  });
}

// Setup core event listeners
function setupCoreListeners() {
  // Profile dropdown toggle
  const profileBtn = document.getElementById('current-profile-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (profileDropdown.classList.contains('active') &&
          !profileDropdown.contains(e.target) &&
          !profileBtn.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    });
  }
  
  // Manage profiles button
  const manageProfilesBtn = document.getElementById('manage-profiles-btn');
  if (manageProfilesBtn) {
    manageProfilesBtn.addEventListener('click', () => {
      window.location.href = 'manage-profiles.html';
    });
  }
  
  // Sidebar profile click
  const sidebarProfile = document.getElementById('sidebar-profile');
  if (sidebarProfile) {
    sidebarProfile.addEventListener('click', async () => {
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
  
  // Navigation buttons - ✅ FIXED: Menu button opens sidebar, not dashboard
  const homeBtn = document.getElementById('nav-home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  const historyBtn = document.getElementById('nav-history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      window.location.href = 'watch-history.html';
    });
  }
  
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
  
  // ✅ FIXED: Menu button - Open Sidebar ONLY (no redirect)
  const menuBtn = document.getElementById('nav-menu-btn');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  const openSidebar = () => {
    if (sidebarMenu && sidebarOverlay) {
      sidebarMenu.classList.add('active');
      sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };
  
  const closeSidebar = () => {
    if (sidebarMenu && sidebarOverlay) {
      sidebarMenu.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };
  
  if (menuBtn) {
    // Remove existing listeners by cloning
    const newMenuBtn = menuBtn.cloneNode(true);
    menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
    newMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('📱 Menu button clicked - opening sidebar');
      openSidebar();
    });
  }
  
  if (menuToggle) {
    const newMenuToggle = menuToggle.cloneNode(true);
    menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
    newMenuToggle.addEventListener('click', openSidebar);
  }
  
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu?.classList.contains('active')) {
      closeSidebar();
    }
  });
  
  // See all buttons
  document.addEventListener('click', (e) => {
    const seeAllBtn = e.target.closest('[data-action^="view-all"]');
    if (seeAllBtn) {
      const action = seeAllBtn.dataset.action.replace('view-all-', '');
      showToast(`Viewing all ${action} content`, 'info');
    }
  });
}

// Setup theme selector
function setupThemeSelector() {
  const themeToggle = document.getElementById('sidebar-theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  
  if (themeToggle && themeSelector) {
    themeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      themeSelector.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (themeSelector.classList.contains('active') &&
          !themeSelector.contains(e.target) &&
          !themeToggle.contains(e.target)) {
        themeSelector.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('theme', theme);
        themeSelector.classList.remove('active');
      });
    });
  }
  
  // Apply saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.classList.add(`theme-${savedTheme}`);
}

// Setup UI scale controller
function setupUIScale() {
  if (window.uiScaleController) {
    window.uiScaleController.init();
    
    // Update sidebar scale display
    const scaleValue = document.getElementById('sidebar-scale-value');
    const updateDisplay = () => {
      if (scaleValue) {
        scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
      }
    };
    
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    
    if (decreaseBtn) {
      decreaseBtn.addEventListener('click', () => {
        window.uiScaleController.decrease();
        updateDisplay();
      });
    }
    
    if (increaseBtn) {
      increaseBtn.addEventListener('click', () => {
        window.uiScaleController.increase();
        updateDisplay();
      });
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.uiScaleController.reset();
        updateDisplay();
      });
    }
    
    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);
  }
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
    // Initialize theme
    setupThemeSelector();
    
    // Initialize UI Scale Controller
    setupUIScale();
    
    // Check authentication
    loadingText.textContent = 'Checking authentication...';
    await checkAuth();
    
    // Load content with skeleton loading
    loadingText.textContent = 'Loading content...';
    
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
    
    // Load first page of content
    const result = await fetchContent(0, window.PAGE_SIZE);
    window.allContentData = result.items;
    window.filteredContentData = window.allContentData;
    window.hasMoreContent = result.hasMore;
    window.currentPage = 0;
    
    // Render UI
    loadingText.textContent = 'Setting up interface...';
    renderCategoryTabs();
    renderContentSections();
    
    // Setup all features
    setupCoreListeners();
    setupInfiniteScroll();
    setupSearch();
    setupNotifications();
    setupAnalytics();
    setupBackToTop();
    
    // Apply mobile header styles after everything is loaded
    applyMobileHeaderStyles();
    
    // Initialize rate limiter cleanup
    if (window.rateLimiter) window.rateLimiter.startCleanup();
    if (window.authRateLimiter) window.authRateLimiter.startCleanup();
    
    // Show app
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      app.style.display = 'block';
      
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
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized');
  initContentLibrary();
});
