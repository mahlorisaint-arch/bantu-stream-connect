// ============================================
// MAIN-INIT - INITIALIZATION & STARTUP
// ============================================

// ===== FIX MOBILE HORIZONTAL SCROLL =====
function fixMobileHorizontalScroll() {
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  
  const checkOverflow = () => {
    const maxWidth = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;
    if (bodyWidth > maxWidth) {
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > maxWidth + 5) {
          el.style.maxWidth = '100%';
          el.style.overflow = 'hidden';
        }
      });
    }
  };
  
  checkOverflow();
  window.addEventListener('resize', checkOverflow);
}

// ===== LOAD RECOMMENDED CREATORS =====
async function loadRecommendedCreators() {
  const grid = document.getElementById('recommended-grid');
  if (!grid) return;
  
  try {
    const { data: connectors, error: connError } = await supabase
      .from('connectors')
      .select('connector_id')
      .eq('connected_id', window.creatorId)
      .limit(10);
      
    if (connError) throw connError;
    
    let recommended = [];
    
    if (connectors && connectors.length > 0) {
      const connectorIds = connectors.map(c => c.connector_id);
      const { data: profiles, error: profError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, bio')
        .in('id', connectorIds)
        .eq('role', 'creator')
        .neq('id', window.creatorId)
        .limit(4);
        
      if (profError) throw profError;
      recommended = profiles || [];
    }
    
    if (recommended.length === 0) {
      const { data: randomCreators, error: randError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, bio')
        .eq('role', 'creator')
        .neq('id', window.creatorId)
        .limit(4);
        
      if (randError) throw randError;
      recommended = randomCreators || [];
    }
    
    if (recommended.length > 0) {
      const connectionChecks = await Promise.all(recommended.map(async (creator) => {
        if (!window.currentUser) return { id: creator.id, isConnected: false };
        const { data: conn } = await supabase
          .from('connectors')
          .select('id')
          .eq('connector_id', window.currentUser.id)
          .eq('connected_id', creator.id)
          .eq('connection_type', 'creator')
          .maybeSingle();
        return { id: creator.id, isConnected: !!conn };
      }));
      
      const connectionMap = Object.fromEntries(connectionChecks.map(c => [c.id, c.isConnected]));
      
      grid.innerHTML = recommended.map(creator => {
        const avatarUrl = creator.avatar_url ? fixMediaUrl(creator.avatar_url) : null;
        const initials = getInitials(creator.full_name || creator.username);
        const isConnected = connectionMap[creator.id] || false;
        
        return `
          <div class="recommended-creator" data-creator-id="${creator.id}">
            <div class="recommended-avatar">
              ${avatarUrl ? 
                `<img src="${avatarUrl}" alt="${escapeHtml(creator.full_name || creator.username)}" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:24px;\\'>${initials}</div>'">` : 
                `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:24px;">${initials}</div>`
              }
            </div>
            <div class="recommended-name" title="${escapeHtml(creator.full_name || creator.username)}">${escapeHtml(creator.full_name || creator.username)}</div>
            <div class="recommended-username" title="@${escapeHtml(creator.username)}">@${escapeHtml(creator.username || 'creator')}</div>
            <button class="recommended-follow-btn ${isConnected ? 'connected' : ''}" data-target-id="${creator.id}">${isConnected ? 'Connected' : 'Connect'}</button>
          </div>
        `;
      }).join('');
      
      grid.querySelectorAll('.recommended-follow-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetId = btn.dataset.targetId;
          await handleRecommendedConnect(targetId, btn);
        });
      });
      
      grid.querySelectorAll('.recommended-creator').forEach(card => {
        card.addEventListener('click', (e) => {
          if (!e.target.classList.contains('recommended-follow-btn')) {
            const creatorId = card.dataset.creatorId;
            if (creatorId) window.location.href = `creator-channel.html?id=${creatorId}`;
          }
        });
      });
      
      const recommendedSection = document.getElementById('recommended-section');
      if (recommendedSection) recommendedSection.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading recommended creators:', error);
    grid.innerHTML = '<p style="color:var(--slate-grey);grid-column:1/-1;text-align:center;">More creators coming soon!</p>';
  }
}

// ===== INITIALIZE CREATOR CHANNEL =====
async function initializeCreatorChannel() {
  try {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    if (loading) loading.style.display = 'flex';
    if (app) app.style.display = 'none';
    
    window.loadingText = document.getElementById('loading-text');
    
    // Initialize theme system
    initThemeSystem();
    
    // Initialize UI Scale
    window.uiScaleController = new UIScaleController();
    window.uiScaleController.init();
    setupScaleControls();
    
    // Fix horizontal scroll on mobile
    fixMobileHorizontalScroll();
    
    // Setup sidebar and navigation
    setupSidebar();
    setupNavigationButtons();
    
    await checkAuth();
    await loadCreatorData();
    setupEventListeners();
    
    setTimeout(() => {
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 500);
    
    console.log('✅ Creator channel initialized with PHASE 5 database migration!');
    console.log('   🚀 Using content_engagement_stats for metrics');
    console.log('   🚀 Using playlist_contents junction table for playlists');
    console.log('   🚀 Using status = "published" for content filtering');
    console.log('   🚀 Using sort_index for ordering');
    console.log('   🚨 FIXED: Removed fragile Content:content_id!inner syntax');
    console.log('   🚨 FIXED: Enterprise-safe TWO-QUERY approach bypasses PostgREST embedding');
    console.log('   🚨 FIXED: Proper item count using playlist_contents.length');
    console.log('   🚨 FIXED: Proper thumbnail extraction with fallback chain');
    console.log('   🚨 FIXED: Playlist click navigation with playlist_id parameter');
    console.log('   🚨 FIXED: Album track extraction with proper sorting and mapping');
    console.log('   🚨 FIXED: Replaced views_count/likes_count with live_views/favorites_count');
    console.log('   🔧 CRITICAL: String() type normalization for ID lookups in all merge functions');
    console.log('   🎨 BANNER UPLOAD: Using Edge Function → Cloudflare R2 with 20MB limit');
    
  } catch (error) {
    console.error('❌ Error initializing:', error);
    showToast('Failed to initialize', 'error');
    setTimeout(() => {
      const loading = document.getElementById('loading');
      const app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }, 1000);
  }
}

// ===== SIDEBAR SETUP =====
function setupSidebar() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;
  
  const openSidebar = () => {
    sidebarMenu.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  
  const closeSidebar = () => {
    sidebarMenu.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  menuToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSidebar();
  });
  
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) closeSidebar();
  });
}

// ===== NAVIGATION BUTTONS =====
function setupNavigationButtons() {
  const navHome = document.getElementById('nav-home-btn');
  if (navHome) {
    navHome.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }
  
  const navHistory = document.getElementById('nav-history-btn');
  if (navHistory) {
    navHistory.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!window.currentUser) {
        showToast('Please sign in to view watch history', 'warning');
        window.location.href = `login.html?redirect=watch-history.html`;
        return;
      }
      window.location.href = 'watch-history.html';
    });
  }
  
  const navCreate = document.getElementById('nav-create-btn');
  if (navCreate) {
    navCreate.addEventListener('click', async (e) => {
      e.preventDefault();
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        window.location.href = 'creator-upload.html';
      } else {
        showToast('Please sign in to create content', 'warning');
        window.location.href = `login.html?redirect=creator-upload.html`;
      }
    });
  }
  
  const navMenu = document.getElementById('nav-menu-btn');
  if (navMenu) {
    navMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sidebarMenu = document.getElementById('sidebar-menu');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebarMenu && sidebarOverlay) {
        sidebarMenu.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }
}

// Make functions globally available
window.fixMobileHorizontalScroll = fixMobileHorizontalScroll;
window.loadRecommendedCreators = loadRecommendedCreators;
window.initializeCreatorChannel = initializeCreatorChannel;
window.setupSidebar = setupSidebar;
window.setupNavigationButtons = setupNavigationButtons;

// ===== START THE APPLICATION =====
// The creator-channel.js had this at the end:
// Start the application
initializeCreatorChannel();

// So we call it here
initializeCreatorChannel();
