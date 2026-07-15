(function() {
  'use strict';

  // ===== SUPABASE CONFIGURATION =====
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== GLOBAL STATE =====
  window.currentUser = null;
  window.userProfile = null;
  window.sonicDNA = null;
  window.portalDrop = null;
  window.worlds = [];
  window.worldProgress = {};

  // ===== MUSIC FORMAT CONSTANTS =====
  const MUSIC_FORMATS = ['album_track', 'music', 'music_video', 'song', 'track', 'audio'];

  // ===== HELPER FUNCTIONS =====
  function showToast(message, type = 'info') {
    if (window.showToast) return window.showToast(message, type);
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { error: 'fa-exclamation-triangle', success: 'fa-check-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return (num || 0).toString();
  }

  function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Just now';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function fixMediaUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // ===== AUTH =====
  async function checkAuth() {
    try {
      const { data } = await supabase.auth.getSession();
      window.currentUser = data?.session?.user || null;
      if (window.currentUser) {
        await loadUserProfile();
      }
      return window.currentUser;
    } catch (e) {
      console.error('Auth error:', e);
      return null;
    }
  }

  async function loadUserProfile() {
    if (!window.currentUser) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .maybeSingle();
      window.userProfile = profile;
      window.sonicDNA = profile?.sonic_dna || null;
    } catch (e) {
      console.warn('Profile load error:', e);
    }
  }

  // ===== SONIC DNA RENDERING =====
  function renderSonicDNA() {
    const archetypeEl = document.getElementById('sonic-dna-archetype');
    const barsEl = document.getElementById('sonic-dna-bars');
    const streakEl = document.getElementById('streak-count');

    if (!window.sonicDNA || !window.sonicDNA.archetype) {
      archetypeEl.textContent = 'Discover your sound';
      barsEl.innerHTML = `
        <div class="music-empty-state" style="grid-column: 1/-1;">
          <i class="fas fa-fingerprint"></i>
          <h4>Take the 30-second taste quiz</h4>
          <p>Unlock your personal Sonic DNA archetype</p>
        </div>
      `;
      return;
    }

    const dna = window.sonicDNA;
    archetypeEl.textContent = dna.archetype || 'Sound Explorer';

    // Render top genre bars
    const topGenres = dna.top_genres || [];
    if (topGenres.length > 0) {
      barsEl.innerHTML = topGenres.slice(0, 4).map(g => `
        <div class="dna-bar-item">
          <span class="dna-bar-label">${escapeHtml(g.name || 'Unknown')}</span>
          <div class="dna-bar-track">
            <div class="dna-bar-fill" style="width: 0%;" data-target="${Math.round((g.weight || 0) * 100)}"></div>
          </div>
          <span class="dna-bar-value">${Math.round((g.weight || 0) * 100)}%</span>
        </div>
      `).join('');

      // Animate bars in
      setTimeout(() => {
        barsEl.querySelectorAll('.dna-bar-fill').forEach(fill => {
          fill.style.width = fill.dataset.target + '%';
        });
      }, 100);
    } else {
      barsEl.innerHTML = '<p style="color: var(--slate-grey); font-size: 12px;">Listen to more to build your DNA</p>';
    }
  }

  // ===== CONTINUE LISTENING =====
  async function loadContinueListening() {
    const row = document.getElementById('continue-listening-row');
    const section = document.getElementById('continue-listening-section');

    if (!window.currentUser) {
      section.style.display = 'none';
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          content_id,
          last_position,
          total_watch_time,
          is_completed,
          Content!inner (
            id,
            title,
            thumbnail_url,
            duration,
            content_format,
            user_profiles!user_id (full_name, username)
          )
        `)
        .eq('user_id', window.currentUser.id)
        .eq('is_completed', false)
        .in('Content.content_format', MUSIC_FORMATS)
        .order('updated_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      if (!data || data.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      row.innerHTML = data.map(item => {
        const content = item.Content;
        const progress = content.duration ? Math.min(100, Math.round((item.last_position / content.duration) * 100)) : 0;
        const creator = content.user_profiles?.full_name || content.user_profiles?.username || 'Artist';
        return `
          <div class="continue-card" data-content-id="${content.id}">
            <div class="continue-card-artwork">
              <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}" loading="lazy">
              <div class="continue-card-progress">
                <div class="continue-card-progress-fill" style="width: ${progress}%;"></div>
              </div>
              <div class="continue-card-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="continue-card-info">
              <p class="continue-card-title">${escapeHtml(content.title)}</p>
              <p class="continue-card-meta">
                <i class="fas fa-user"></i>
                ${escapeHtml(creator)}
              </p>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      row.querySelectorAll('.continue-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Continue listening error:', e);
      section.style.display = 'none';
    }
  }

  // ===== MYSTERY PORTAL =====
  async function loadPortalDrop() {
    const noteEl = document.getElementById('portal-card-note');
    const countdownEl = document.getElementById('portal-countdown');

    if (!window.currentUser) {
      noteEl.textContent = 'Sign in to receive your daily drop';
      return;
    }

    try {
      // Call the portal drop function
      const { data, error } = await supabase
        .rpc('fn_generate_portal_drop', { p_user_id: window.currentUser.id });

      if (error) throw error;

      if (!data || data.length === 0) {
        noteEl.textContent = 'More mysteries coming soon...';
        return;
      }

      const drop = data[0];
      window.portalDrop = drop;

      // Load the actual content details
      const { data: contentData } = await supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          content_format,
          user_profiles!user_id (full_name, username)
        `)
        .eq('id', drop.content_id)
        .single();

      if (contentData) {
        noteEl.textContent = drop.curator_note || 'A sound chosen for you';
        setupPortalReveal(contentData, drop);
      }

      // Start countdown to next drop
      startPortalCountdown(countdownEl);
    } catch (e) {
      console.error('Portal drop error:', e);
      noteEl.textContent = 'Your portal is charging...';
    }
  }

  function setupPortalReveal(content, drop) {
    const portalCard = document.getElementById('portal-card');
    const modal = document.getElementById('portal-reveal-modal');
    const closeBtn = document.getElementById('portal-reveal-close');
    const playBtn = document.getElementById('portal-reveal-play-btn');

    portalCard.addEventListener('click', () => {
      // Populate modal
      document.getElementById('portal-reveal-artwork').innerHTML = `
        <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}">
        <div class="portal-reveal-artwork-blur"></div>
      `;
      document.getElementById('portal-reveal-title').textContent = content.title;
      document.getElementById('portal-reveal-artist').textContent =
        content.user_profiles?.full_name || content.user_profiles?.username || 'Unknown Artist';
      document.getElementById('portal-reveal-note').textContent = drop.curator_note || 'A sound chosen for you.';

      const dnaMatch = window.sonicDNA?.top_genres?.[0];
      document.getElementById('portal-reveal-dna-match').innerHTML = dnaMatch
        ? `<i class="fas fa-fingerprint"></i> Matched to your ${window.sonicDNA.archetype} DNA · ${Math.round(dnaMatch.weight * 100)}% ${dnaMatch.name}`
        : `<i class="fas fa-sparkles"></i> Fresh discovery just for you`;

      modal.classList.add('active');
      setTimeout(() => modal.classList.add('revealed'), 300);
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active', 'revealed');
    });

    playBtn.addEventListener('click', () => {
      window.location.href = `../content-detail.html?id=${content.id}`;
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('portal-reveal-overlay')) {
        modal.classList.remove('active', 'revealed');
      }
    });
  }

  function startPortalCountdown(el) {
    function update() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow - now;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    update();
    setInterval(update, 1000);
  }

  // ===== PORTAL PARTICLES =====
  function createPortalParticles() {
    const container = document.getElementById('portal-card-particles');
    if (!container) return;
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'portal-particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (4 + Math.random() * 4) + 's';
      container.appendChild(particle);
    }
  }

  // ===== WORLDS =====
  async function loadWorlds() {
    const grid = document.getElementById('worlds-grid');

    try {
      // Load top-level worlds (parent_genre_id IS NULL)
      const { data: worldsData, error: worldsError } = await supabase
        .from('genres')
        .select(`
          id,
          name,
          slug,
          description,
          metadata,
          unlock_threshold_tracks
        `)
        .is('parent_genre_id', null)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(10);

      if (worldsError) throw worldsError;
      if (!worldsData || worldsData.length === 0) {
        grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-globe"></i><h4>No worlds yet</h4><p>Worlds are being curated</p></div>';
        return;
      }

      window.worlds = worldsData;

      // Load user's progress in these worlds
      if (window.currentUser) {
        const { data: progressData } = await supabase
          .from('user_world_progress')
          .select('genre_id, exploration_percentage, tracks_listened, unlocked_subworlds')
          .eq('user_id', window.currentUser.id);

        (progressData || []).forEach(p => {
          window.worldProgress[p.genre_id] = p;
        });
      }

      renderWorlds();
    } catch (e) {
      console.error('Worlds load error:', e);
      grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-globe"></i><h4>Could not load worlds</h4></div>';
    }
  }

  function renderWorlds() {
    const grid = document.getElementById('worlds-grid');
    const worldColors = ['#1D4ED8', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316'];

    grid.innerHTML = window.worlds.map((world, idx) => {
      const progress = window.worldProgress[world.id];
      const pct = progress ? Math.round(progress.exploration_percentage || 0) : 0;
      const tracksListened = progress ? progress.tracks_listened : 0;
      const color = worldColors[idx % worldColors.length];
      const isLocked = pct === 0 && !progress;

      // Generate a gradient background based on world name
      const bgGradient = `linear-gradient(135deg, ${color}40, ${color}80)`;

      return `
        <div class="world-card" data-world-id="${world.id}" data-world-name="${escapeHtml(world.name)}">
          <div class="world-card-artwork" style="background: ${bgGradient};"></div>
          <div class="world-card-overlay"></div>
          <div class="world-card-lock ${isLocked ? '' : 'unlocked'}">
            <i class="fas ${isLocked ? 'fa-lock' : 'fa-check'}"></i>
          </div>
          <div class="world-card-content">
            <h4 class="world-card-name">${escapeHtml(world.name)}</h4>
            <div class="world-card-progress">
              <div class="world-card-progress-bar">
                <div class="world-card-progress-fill" style="width: ${pct}%;"></div>
              </div>
              <span class="world-card-progress-text">${pct}%</span>
            </div>
            <p class="world-card-meta">${tracksListened} track${tracksListened === 1 ? '' : 's'} explored</p>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    grid.querySelectorAll('.world-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.worldId;
        const name = card.dataset.worldName;
        window.location.href = `world-detail.html?id=${id}&name=${encodeURIComponent(name)}`;
      });
    });
  }

  // ===== SOCIAL STRIP =====
  async function loadSocialStrip() {
    const row = document.getElementById('social-strip-row');
    const section = document.getElementById('social-strip-section');

    try {
      // Get recent watch activity from other users
      const { data, error } = await supabase
        .from('watch_progress')
        .select(`
          user_id,
          updated_at,
          Content!inner (
            id,
            title,
            content_format,
            user_profiles!user_id (full_name, username, avatar_url)
          ),
          user_profiles!user_id (full_name, username, avatar_url)
        `)
        .eq('Content.content_format', 'track')
        .neq('user_id', window.currentUser?.id || '00000000-0000-0000-0000-000000000000')
        .gte('updated_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('updated_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (!data || data.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      row.innerHTML = data.map(item => {
        const user = item.user_profiles;
        const content = item.Content;
        const creator = content.user_profiles;
        const name = user?.full_name || user?.username || 'Listener';
        const avatar = user?.avatar_url ? fixMediaUrl(user.avatar_url) : null;
        const trackTitle = content.title || 'a track';

        return `
          <div class="social-strip-item" data-content-id="${content.id}">
            <div class="social-strip-avatar">
              ${avatar ? `<img src="${avatar}" alt="${escapeHtml(name)}">` : getInitials(name)}
            </div>
            <div class="social-strip-info">
              <p class="social-strip-name">${escapeHtml(name)}</p>
              <p class="social-strip-track">Listening to ${escapeHtml(trackTitle)}</p>
            </div>
          </div>
        `;
      }).join('');

      // Click handlers
      row.querySelectorAll('.social-strip-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Social strip error:', e);
      section.style.display = 'none';
    }
  }

  // ===== TRENDING IN YOUR WORLDS =====
  async function loadTrending() {
    const grid = document.getElementById('trending-grid');

    try {
      // Get user's top genres
      const topGenres = window.sonicDNA?.top_genres?.slice(0, 3).map(g => g.id) || [];

      let query = supabase
        .from('Content')
        .select(`
          id,
          title,
          thumbnail_url,
          duration,
          content_format,
          genre,
          user_profiles!user_id (full_name, username),
          content_engagement_stats (total_views, total_likes)
        `)
        .in('content_format', MUSIC_FORMATS)
        .eq('status', 'published');

      if (topGenres.length > 0) {
        query = query.in('primary_genre_id', topGenres);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (!data || data.length === 0) {
        grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-chart-line"></i><h4>No trending tracks yet</h4></div>';
        return;
      }

      grid.innerHTML = data.map((item, idx) => {
        const views = item.content_engagement_stats?.total_views || 0;
        const likes = item.content_engagement_stats?.total_likes || 0;
        const creator = item.user_profiles?.full_name || item.user_profiles?.username || 'Artist';
        return `
          <div class="trending-card" data-content-id="${item.id}">
            <div class="trending-card-artwork">
              <img src="${fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
              <div class="trending-card-rank">${idx + 1}</div>
              <div class="trending-card-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="trending-card-info">
              <p class="trending-card-title">${escapeHtml(item.title)}</p>
              <p class="trending-card-artist">${escapeHtml(creator)}</p>
              <div class="trending-card-stats">
                <span><i class="fas fa-eye"></i> ${formatNumber(views)}</span>
                <span><i class="fas fa-heart"></i> ${formatNumber(likes)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.trending-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.contentId;
          if (id) window.location.href = `../content-detail.html?id=${id}`;
        });
      });
    } catch (e) {
      console.error('Trending error:', e);
      grid.innerHTML = '<div class="music-empty-state"><i class="fas fa-chart-line"></i><h4>Could not load trending</h4></div>';
    }
  }

  // ===== SIDEBAR SETUP =====
  function setupSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');

    if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;

    menuToggle.addEventListener('click', () => {
      sidebarMenu.classList.add('active');
      sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    const closeSidebar = () => {
      sidebarMenu.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) closeSidebar();
    });
  }

  // ===== NAVIGATION =====
  function setupNavigation() {
    const navHome = document.getElementById('nav-home-btn');
    const navHistory = document.getElementById('nav-history-btn');
    const navCreate = document.getElementById('nav-create-btn');
    const navMenu = document.getElementById('nav-menu-btn');

    if (navHome) navHome.addEventListener('click', () => window.location.href = '../index.html');
    if (navHistory) navHistory.addEventListener('click', () => {
      if (window.currentUser) window.location.href = '../watch-history.html';
      else window.location.href = `../login.html?redirect=music.html`;
    });
    if (navCreate) navCreate.addEventListener('click', () => {
      if (window.currentUser) window.location.href = '../creator-upload.html';
      else window.location.href = `../login.html?redirect=music.html`;
    });
    if (navMenu) navMenu.addEventListener('click', () => {
      document.getElementById('sidebar-menu')?.classList.add('active');
      document.getElementById('sidebar-overlay')?.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  // ===== SEARCH =====
  function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');

    if (searchBtn && searchModal) {
      searchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 100);
      });
    }
    if (closeBtn && searchModal) {
      closeBtn.addEventListener('click', () => searchModal.classList.remove('active'));
    }
    if (searchModal) {
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) searchModal.classList.remove('active');
      });
    }

    // Populate world filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter && window.worlds.length > 0) {
      window.worlds.forEach(world => {
        const opt = document.createElement('option');
        opt.value = world.name;
        opt.textContent = world.name;
        categoryFilter.appendChild(opt);
      });
    }
  }

  // ===== NOTIFICATIONS =====
  function setupNotifications() {
    const btn = document.getElementById('notifications-btn');
    const panel = document.getElementById('notifications-panel');
    const closeBtn = document.getElementById('close-notifications');

    if (btn && panel) {
      btn.addEventListener('click', () => {
        panel.classList.add('active');
        loadNotifications();
      });
    }
    if (closeBtn && panel) {
      closeBtn.addEventListener('click', () => panel.classList.remove('active'));
    }
    if (panel) {
      panel.addEventListener('click', (e) => {
        if (e.target === panel) panel.classList.remove('active');
      });
    }
  }

  async function loadNotifications() {
    if (!window.currentUser) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const list = document.getElementById('notifications-list');
      if (!list) return;

      if (!data || data.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell" style="font-size:40px;opacity:0.3;"></i><p>No notifications yet</p></div>';
        return;
      }

      list.innerHTML = data.map(n => `
        <div style="padding:15px;border-bottom:1px solid var(--card-border);${n.is_read ? 'opacity:0.7;' : 'background:rgba(245,158,11,0.05);'}">
          <div style="font-weight:600;margin-bottom:5px;color:var(--soft-white);">${escapeHtml(n.title)}</div>
          <div style="font-size:13px;color:var(--slate-grey);margin-bottom:8px;">${escapeHtml(n.message)}</div>
          <div style="font-size:11px;color:var(--warm-gold);">${formatTimeAgo(n.created_at)}</div>
        </div>
      `).join('');

      const unread = data.filter(n => !n.is_read).length;
      const badge = document.getElementById('notification-count');
      if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }
    } catch (e) {
      console.error('Notifications error:', e);
    }
  }

  // ===== PROFILE =====
  async function updateProfileUI() {
    const placeholder = document.getElementById('userProfilePlaceholder');
    const nameEl = document.getElementById('current-profile-name');
    const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
    const sidebarName = document.getElementById('sidebar-profile-name');
    const sidebarEmail = document.getElementById('sidebar-profile-email');

    if (!placeholder || !nameEl) return;

    if (window.currentUser && window.userProfile) {
      const displayName = window.userProfile.full_name || window.userProfile.username || 'User';
      nameEl.textContent = displayName;
      if (sidebarName) sidebarName.textContent = displayName;
      if (sidebarEmail) sidebarEmail.textContent = window.currentUser.email || '';

      placeholder.innerHTML = '';
      if (window.userProfile.avatar_url) {
        const img = document.createElement('img');
        img.src = fixMediaUrl(window.userProfile.avatar_url);
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        placeholder.appendChild(img);
        if (sidebarAvatar) {
          const img2 = img.cloneNode(true);
          sidebarAvatar.innerHTML = '';
          sidebarAvatar.appendChild(img2);
        }
      } else {
        const initial = displayName.charAt(0).toUpperCase();
        placeholder.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initial}</div>`;
        if (sidebarAvatar) sidebarAvatar.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initial}</span>`;
      }
    } else {
      nameEl.textContent = 'Guest';
      if (sidebarName) sidebarName.textContent = 'Guest';
      if (sidebarEmail) sidebarEmail.textContent = 'Sign in to continue';
      placeholder.innerHTML = '<i class="fas fa-user"></i>';
    }
  }

  // ===== INITIALIZE =====
  async function initialize() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');

    try {
      setupSidebar();
      setupNavigation();
      await checkAuth();
      await updateProfileUI();

      // Load all sections in parallel
      await Promise.all([
        loadContinueListening(),
        loadPortalDrop(),
        loadWorlds(),
        loadSocialStrip(),
        loadTrending()
      ]);

      // Render Sonic DNA after profile is loaded
      renderSonicDNA();
      createPortalParticles();
      setupSearch();
      setupNotifications();

      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';

      console.log('✅ Music discovery page initialized');
    } catch (e) {
      console.error('Initialization error:', e);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }

  // ===== AUTH STATE CHANGES =====
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      window.currentUser = session.user;
      loadUserProfile().then(() => {
        updateProfileUI();
        renderSonicDNA();
        loadContinueListening();
        loadPortalDrop();
        loadWorlds();
        loadSocialStrip();
      });
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      window.userProfile = null;
      window.sonicDNA = null;
      updateProfileUI();
      location.reload();
    }
  });

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
