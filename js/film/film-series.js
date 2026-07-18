(function() {
  'use strict';

  // ===== SUPABASE CONFIGURATION =====
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Expose to shared components to prevent "undefined" errors
  window.supabaseClient = supabase;
  window.supabaseAuth = supabase;

  // ===== GLOBAL STATE =====
  window.currentUser = null;
  let currentFilter = 'all';

  // ===== CONTENT FORMAT CONSTANTS =====
  const SERIES_FORMATS = ['series_episode'];
  const FILM_FORMATS = ['film', 'documentary'];
  const SHORT_FORMATS = ['short'];
  const ALL_FORMATS = [...SERIES_FORMATS, ...FILM_FORMATS, ...SHORT_FORMATS, 'long_form'];

  // ===== HELPER FUNCTIONS =====
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

  function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDurationLong(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function fixMediaUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=225&fit=crop';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  const CONTENT_FORMAT_META = {
    film: { label: 'Film', color: '#EF4444' },
    documentary: { label: 'Documentary', color: '#8B5CF6' },
    series_episode: { label: 'Series', color: '#10B981' },
    short: { label: 'Short', color: '#EC4899' },
    long_form: { label: 'Video', color: '#1D4ED8' }
  };

  function formatMeta(contentFormat) {
    return CONTENT_FORMAT_META[contentFormat] || { label: 'Content', color: '#94A3B8' };
  }

  // ===== BUILD CARD HTML =====
  function buildStandardCardHTML(item, isTop10 = false, rank = 0) {
    const meta = formatMeta(item.content_format);
    const isLeavingSoon = Math.random() > 0.85; // Simulated for demo
    const leavingSoonBadge = isLeavingSoon ? `<span class="upload-card__badge leaving-soon">Leaving soon</span>` : '';
    
    if (isTop10) {
      return `
        <div class="top10-card" data-content-id="${item.id}" tabindex="0" role="link">
          <div class="top10-number">${rank}</div>
          <div class="top10-thumb">
            <img src="${fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
          </div>
          <p class="top10-title">${escapeHtml(item.title)}</p>
        </div>
      `;
    }

    return `
      <div class="upload-card" data-content-id="${item.id}" tabindex="0" role="link">
        <div class="upload-card__thumb" style="background-image: url(${fixMediaUrl(item.thumbnail_url)});">
          ${leavingSoonBadge}
          <span class="upload-card__badge" style="background: ${meta.color}; color: white;">${meta.label}</span>
          ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
        </div>
        <p class="upload-card__title">${escapeHtml(item.title)}</p>
        <p class="upload-card__meta">
          <i class="fas fa-eye"></i> ${formatNumber(item.total_views || 0)} views
        </p>
      </div>
    `;
  }

  function buildShortCardHTML(item) {
    return `
      <div class="short-card" data-content-id="${item.id}" tabindex="0" role="link">
        <div class="short-card__thumb" style="background-image: url(${fixMediaUrl(item.thumbnail_url)});">
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
          <div class="short-card__plays"><i class="fas fa-play"></i> ${formatNumber(item.total_views || 0)}</div>
        </div>
        <p class="short-card__title">${escapeHtml(item.title)}</p>
      </div>
    `;
  }

  // ===== IN-PAGE DETAIL OVERLAY (Screen within a Screen) =====
  window.openInPageDetail = function(contentId) {
    const overlay = document.getElementById('detail-overlay');
    if (!overlay) return;

    // In production, fetch full content details here. Simulating for UI demo.
    const mockContent = {
      id: contentId,
      title: "Isibaya Rising",
      content_format: "series_episode", 
      duration: 2700,
      description: "Thandi is seconds from learning who struck the match, and the answer is sitting across her own dinner table...",
      thumbnail_url: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=1200&h=600&fit=crop",
      genre: "Telenovela",
      language: "isiZulu, English subs",
      total_views: 12400,
      is_bantu_original: true
    };

    renderDetailOverlay(mockContent);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeInPageDetail = function() {
    const overlay = document.getElementById('detail-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  function renderDetailOverlay(content) {
    const container = document.getElementById('detail-overlay-content');
    if (!container) return;

    const isSeries = content.content_format === 'series_episode';
    const meta = formatMeta(content.content_format);

    container.innerHTML = `
      <button class="detail-close-btn" onclick="window.closeInPageDetail()"><i class="fas fa-times"></i></button>
      
      <!-- HERO SECTION -->
      <div class="detail-hero">
        <div class="detail-hero-video">
          <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}" style="width:100%;height:100%;object-fit:cover;">
          <div class="hero-gradient"></div>
        </div>
        <div class="detail-hero-content">
          ${content.is_bantu_original ? '<span class="badge-premium"><i class="fas fa-crown"></i> Bantu Original</span>' : ''}
          <h1 class="detail-title">${escapeHtml(content.title)}</h1>
          <div class="detail-meta">
            <span>${content.genre || meta.label}</span>
            <span class="meta-divider">·</span>
            <span>${isSeries ? 'Season 3' : formatDurationLong(content.duration)}</span>
            <span class="meta-divider">·</span>
            <span>${content.language || 'English'}</span>
          </div>
          <p class="detail-description">${escapeHtml(content.description)}</p>
          <div class="detail-actions">
            <button class="btn-primary btn-glow" onclick="window.location.href='../content-detail.html?id=${content.id}'">
              <i class="fas fa-play"></i> ${isSeries ? 'Resume S3 E12' : 'Play Now'}
            </button>
            <button class="btn-secondary"><i class="fas fa-plus"></i> My List</button>
          </div>
        </div>
      </div>

      <!-- DYNAMIC CONTENT BASED ON FORMAT -->
      <div class="detail-body">
        ${isSeries ? renderSeriesBody(content) : renderFilmBody(content)}
      </div>
    `;
  }

  function renderSeriesBody(content) {
    return `
      <div class="detail-section">
        <h3 class="section-title">Up Next</h3>
        <div class="episode-rail">
          <div class="episode-card watched">
            <div class="ep-thumb"><img src="https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=170&fit=crop"><div class="ep-check"><i class="fas fa-check-circle"></i></div></div>
            <div class="ep-info"><span class="ep-number">E12</span><h4>The Shebeen Fire</h4><span class="ep-duration">42m</span></div>
          </div>
          <div class="episode-card curiosity-gap">
            <div class="ep-thumb blurred"><img src="https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=170&fit=crop"><div class="ep-play-overlay"><i class="fas fa-eye"></i> Tap to Unblur</div></div>
            <div class="ep-info"><span class="ep-number">E13</span><h4>The Reveal</h4><span class="ep-duration">44m</span></div>
          </div>
          <div class="episode-card locked">
            <div class="ep-thumb"><img src="https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=170&fit=crop" style="filter:grayscale(100%) brightness(0.4)"><div class="ep-lock"><i class="fas fa-lock"></i></div></div>
            <div class="ep-info"><span class="ep-number">E14</span><h4>Locked Scene</h4><span class="ep-lock-text">Watch 2 more to unlock</span></div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title"><i class="fas fa-globe-africa"></i> The World of ${escapeHtml(content.title)}</h3>
        <div class="world-grid">
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-project-diagram"></i></div><h4>Family Web</h4><p>Explore the tangled loyalties.</p></div>
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-hourglass-half"></i></div><h4>Full Timeline</h4><p>From the first match to the fire.</p></div>
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-map-marker-alt"></i></div><h4>Filmed Here</h4><p>Find the real Soweto locations.</p></div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">Fans are asking</h3>
        <div class="pulse-card live-poll">
          <p class="poll-question">Should Thandi forgive Sipho?</p>
          <div class="poll-options">
            <div class="poll-option"><span>Yes, family is everything</span><div class="poll-bar"><div class="poll-fill" style="width:68%"></div></div><span class="poll-pct">68%</span></div>
            <div class="poll-option"><span>No, he betrayed her</span><div class="poll-bar"><div class="poll-fill" style="width:32%"></div></div><span class="poll-pct">32%</span></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderFilmBody(content) {
    return `
      <div class="detail-section">
        <h3 class="section-title">Chapters</h3>
        <div class="episode-rail">
          <div class="episode-card watched">
            <div class="ep-thumb"><img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=170&fit=crop"><div class="ep-check"><i class="fas fa-check-circle"></i></div></div>
            <div class="ep-info"><span class="ep-number">Ch 5</span><h4>The Departure</h4><span class="ep-duration">22m</span></div>
          </div>
          <div class="episode-card">
            <div class="ep-thumb"><img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=170&fit=crop"></div>
            <div class="ep-info"><span class="ep-number">Ch 6</span><h4>The Homecoming</h4><span class="ep-duration">28m</span></div>
          </div>
          <div class="episode-card curiosity-gap">
            <div class="ep-thumb blurred"><img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=170&fit=crop"><div class="ep-play-overlay"><i class="fas fa-eye"></i> Deleted Scene</div></div>
            <div class="ep-info"><span class="ep-number">Bonus</span><h4>Deleted Scene</h4><span class="ep-duration">5m</span></div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title"><i class="fas fa-film"></i> Behind the Lens</h3>
        <div class="world-grid">
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-video"></i></div><h4>Making Of</h4><p>Go behind the scenes of the Free State shoot.</p></div>
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-map-marker-alt"></i></div><h4>Filmed Here</h4><p>Real locations from the 1994 era.</p></div>
          <div class="world-card"><div class="world-card-icon"><i class="fas fa-user-tie"></i></div><h4>Director's Cut</h4><p>Extended scenes not in the theatrical release.</p></div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">If this moved you, try</h3>
        <div class="episode-rail">
          <div class="episode-card"><div class="ep-thumb"><img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=170&fit=crop"></div><div class="ep-info"><h4>Dust and Gold</h4><span class="ep-duration">1h 54m</span></div></div>
          <div class="episode-card"><div class="ep-thumb"><img src="https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300&h=170&fit=crop"></div><div class="ep-info"><h4>Roots of the Veld</h4><span class="ep-duration">2h 10m</span></div></div>
        </div>
      </div>
    `;
  }

  // ===== DATA LOADING =====
  async function loadTop10() {
    const container = document.getElementById('top10-row');
    if (!container) return;
    try {
      const { data } = await supabase.from('Content').select('id, title, thumbnail_url, content_format, total_views').eq('status', 'published').order('total_views', { ascending: false }).limit(10);
      if (data && data.length > 0) {
        container.innerHTML = data.map((item, idx) => buildStandardCardHTML(item, true, idx + 1)).join('');
        attachCardClicks(container);
      }
    } catch (e) { console.error('Top 10 error:', e); }
 a>
  }

  async function loadMoodRows() {
    const container = document.getElementById('family-grid');
    if (!container) return;
    try {
      const { data } = await supabase.from('Content').select('id, title, thumbnail_url, content_format, duration, total_views').eq('status', 'published').limit(10);
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildStandardCardHTML(item)).join('');
        attachCardClicks(container);
      }
    } catch (e) { console.error('Mood rows error:', e); }
  }

  async function loadQuickBites() {
    const container = document.getElementById('quickbites-row');
    if (!container) return;
    try {
      const { data } = await supabase.from('Content').select('id, title, thumbnail_url, content_format, total_views').eq('content_format', 'short').eq('status', 'published').limit(8);
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildShortCardHTML(item)).join('');
        attachCardClicks(container);
      }
    } catch (e) { console.error('Quick bites error:', e); }
  }

  async function loadRecommended() {
    const container = document.getElementById('recommended-row');
    if (!container) return;
    try {
      const { data } = await supabase.from('Content').select('id, title, thumbnail_url, content_format, duration, total_views').eq('status', 'published').limit(8);
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildStandardCardHTML(item)).join('');
        attachCardClicks(container);
      }
    } catch (e) { console.error('Recommended error:', e); }
  }

  function attachCardClicks(container) {
    container.querySelectorAll('[data-content-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.contentId;
        if (id) window.openInPageDetail(id);
      });
    });
  }

  // ===== FILTER CHIPS =====
  function setupFilterChips() {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        
        // In production, this would re-fetch data with the new filter.
        // For now, we simulate a refresh.
        loadMoodRows();
        loadQuickBites();
      });
    });
  }

  // ===== HERO SECTION =====
  async function loadHero() {
    try {
      const { data } = await supabase.from('Content').select('id, title, description, thumbnail_url, content_format, genre, language, is_bantu_original, duration, total_views').eq('status', 'published').order('total_views', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const item = data[0];
        document.getElementById('hero-title').textContent = item.title;
        document.getElementById('hero-description').textContent = item.description || 'A gripping story of family, loyalty, and survival.';
        document.getElementById('hero-genre').textContent = item.genre || 'Drama';
        document.getElementById('hero-duration').textContent = item.duration ? formatDurationLong(item.duration) : '1h 54m';
        document.getElementById('hero-language').textContent = item.language || 'isiZulu, English subs';
        if (item.is_bantu_original) document.getElementById('hero-bantu-original').style.display = 'inline-flex';
        
        document.getElementById('hero-play-btn').onclick = () => window.openInPageDetail(item.id);
      }
    } catch (e) { console.error('Hero error:', e); }
  }

  // ===== INITIALIZATION =====
  async function initialize() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');

    try {
      // Ensure shared components are ready
      if (window.initSharedComponents) {
        await window.initSharedComponents();
      }

      // Load all data in parallel
      await Promise.all([
        loadHero(),
        loadTop10(),
        loadMoodRows(),
        loadQuickBites(),
        loadRecommended()
      ]);

      setupFilterChips();

      // Setup close button for detail overlay
      const closeDetailBtn = document.getElementById('detail-close-btn');
      if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', window.closeInPageDetail);
      }

      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';

      console.log('✅ Film/Series browse screen initialized successfully');
    } catch (e) {
      console.error('Initialization error:', e);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
