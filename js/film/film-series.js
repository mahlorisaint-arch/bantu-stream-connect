(function() {
  'use strict';

  // ===== SUPABASE CONFIGURATION =====
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  window.supabaseClient = supabase;
  window.supabaseAuth = supabase;

  window.currentUser = null;
  let currentFilter = 'all';

  const SERIES_FORMATS = ['series_episode'];
  const FILM_FORMATS = ['film', 'documentary'];
  const SHORT_FORMATS = ['short'];

  // ===== HOVER PREVIEW STATE =====
  const HOVER_DELAY = 500;
  const hoverTimers = new WeakMap();

  // ===== FOCUS RETURN STATE =====
  let lastFocusedCard = null;

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

  // ===== DETERMINISTIC "LEAVING SOON" =====
  function getLeavingSoonInfo(leavingAt) {
    if (!leavingAt) return null;
    const daysLeft = Math.ceil((new Date(leavingAt) - Date.now()) / 86400000);
    if (daysLeft < 0 || daysLeft > 14) return null;
    return { daysLeft };
  }

  function buildStandardCardHTML(item, isTop10 = false, rank = 0) {
    const meta = formatMeta(item.content_format);
    const leaving = getLeavingSoonInfo(item.leaving_at);
    const leavingBadge = leaving
      ? `<span class="upload-card__badge leaving-soon">Leaving in ${leaving.daysLeft}d</span>`
      : '';
    
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
          ${leavingBadge}
          <span class="upload-card__badge" style="background: ${meta.color}; color: white;">${meta.label}</span>
          ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
        </div>
        <p class="upload-card__title">${escapeHtml(item.title)}</p>
        <p class="upload-card__meta">
          <i class="fas fa-eye"></i> ${formatNumber(item.content_engagement_stats?.total_views || 0)} views
        </p>
      </div>
    `;
  }

  function buildShortCardHTML(item) {
    const leaving = getLeavingSoonInfo(item.leaving_at);
    const leavingBadge = leaving
      ? `<span class="upload-card__badge leaving-soon">Leaving in ${leaving.daysLeft}d</span>`
      : '';

    return `
      <div class="short-card" data-content-id="${item.id}" tabindex="0" role="link">
        <div class="short-card__thumb" style="background-image: url(${fixMediaUrl(item.thumbnail_url)});">
          ${leavingBadge}
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
          <div class="short-card__plays"><i class="fas fa-play"></i> ${formatNumber(item.content_engagement_stats?.total_views || 0)}</div>
        </div>
        <p class="short-card__title">${escapeHtml(item.title)}</p>
      </div>
    `;
  }

  // ===== HOVER PREVIEW FUNCTIONS =====
  function attachHoverPreview(cardEl, item) {
    if (!item.preview_clip_url) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const thumb = cardEl.querySelector('.upload-card__thumb, .short-card__thumb, .top10-thumb');
    if (!thumb) return;

    cardEl.addEventListener('mouseenter', () => {
      const timer = setTimeout(() => startPreview(thumb, item), HOVER_DELAY);
      hoverTimers.set(cardEl, timer);
    });

    cardEl.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimers.get(cardEl));
      stopPreview(thumb);
    });
  }

  function startPreview(thumb, item) {
    if (thumb.querySelector('video')) return;
    const video = document.createElement('video');
    video.src = fixMediaUrl(item.preview_clip_url);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.className = 'card-preview-video';
    thumb.appendChild(video);
    requestAnimationFrame(() => {
      video.classList.add('active');
      video.play().catch(() => {});
    });
  }

  function stopPreview(thumb) {
    const video = thumb.querySelector('video');
    if (!video) return;
    video.pause();
    video.remove();
  }

  // ===== REAL DATA: IN-PAGE DETAIL OVERLAY =====
  window.openInPageDetail = async function(contentId) {
    const overlay = document.getElementById('detail-overlay');
    if (!overlay) return;

    lastFocusedCard = document.activeElement;

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const container = document.getElementById('detail-overlay-content');
    container.innerHTML = '<div class="detail-loading"><div class="spinner"></div><p>Loading details...</p></div>';

    try {
      // 1. Fetch main content with engagement stats and creator info
      const { data: content, error: contentError } = await supabase
        .from('Content')
        .select(`
          id, title, description, thumbnail_url, content_format, genre, language, duration,
          is_bantu_original, content_metadata, chapters, leaving_at,
          user_profiles!user_id (full_name, username, avatar_url),
          content_engagement_stats (total_views, total_likes)
        `)
        .eq('id', contentId)
        .single();

      if (contentError || !content) throw new Error('Content not found');

      // 2. Fetch Series/Playlist info if applicable
      let seriesInfo = null;
      let relatedEpisodes = [];
      if (content.content_format === 'series_episode') {
        const { data: pc } = await supabase
          .from('playlist_contents')
          .select(`
            playlist_id, season_number, track_number,
            creator_playlists!playlist_id (name, description, series_metadata)
          `)
          .eq('content_id', contentId)
          .maybeSingle();
        
        if (pc) {
          seriesInfo = pc;
          const { data: episodes } = await supabase
            .from('playlist_contents')
            .select(`content_id, track_number, Content!inner (id, title, thumbnail_url, duration, content_format, leaving_at, preview_clip_url)`)
            .eq('playlist_id', pc.playlist_id)
            .order('track_number', { ascending: true })
            .limit(5);
          relatedEpisodes = episodes || [];
        }
      }

      // 3. Fetch World Content (Behind the lens, family web, etc.)
      const { data: worldData } = await supabase
        .from('world_content')
        .select('id, world_type, title, description, media_url')
        .eq('content_id', contentId);

      renderDetailOverlay(content, seriesInfo, relatedEpisodes, worldData);

    } catch (e) {
      console.error('Detail overlay error:', e);
      const container = document.getElementById('detail-overlay-content');
      container.innerHTML = `
        <div class="detail-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load content details.</p>
          <button onclick="window.closeInPageDetail()" class="btn-secondary">Close</button>
        </div>
      `;
    }
  };

  window.closeInPageDetail = function() {
    const overlay = document.getElementById('detail-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    lastFocusedCard?.focus();
  };

  function renderDetailOverlay(content, seriesInfo, relatedEpisodes, worldData) {
    const container = document.getElementById('detail-overlay-content');
    if (!container) return;

    const isSeries = content.content_format === 'series_episode';
    const meta = formatMeta(content.content_format);
    const creatorName = content.user_profiles?.full_name || content.user_profiles?.username || 'Unknown Creator';
    const leaving = getLeavingSoonInfo(content.leaving_at);

    container.innerHTML = `
      <button class="detail-close-btn" onclick="window.closeInPageDetail()"><i class="fas fa-times"></i></button>
      
      <div class="detail-hero">
        <div class="detail-hero-video">
          <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(content.title)}">
          <div class="hero-gradient"></div>
        </div>
        <div class="detail-hero-content">
          ${content.is_bantu_original ? '<span class="badge-premium"><i class="fas fa-crown"></i> Bantu Original</span>' : ''}
          ${leaving ? `<span class="badge-leaving"><i class="fas fa-clock"></i> Leaving in ${leaving.daysLeft} days</span>` : ''}
          <h1 class="detail-title">${escapeHtml(content.title)}</h1>
          <div class="detail-meta">
            <span>${content.genre || meta.label}</span>
            <span class="meta-divider">·</span>
            <span>${isSeries && seriesInfo ? `Season ${seriesInfo.season_number || 1}` : formatDurationLong(content.duration)}</span>
            <span class="meta-divider">·</span>
            <span>${content.language || 'English'}</span>
            <span class="meta-divider">·</span>
            <span><i class="fas fa-eye"></i> ${formatNumber(content.content_engagement_stats?.total_views || 0)}</span>
          </div>
          <p class="detail-description">${escapeHtml(content.description || 'No description available.')}</p>
          <div class="detail-actions">
            <button class="btn-primary btn-glow" onclick="window.location.href='../content-detail.html?id=${content.id}'">
              <i class="fas fa-play"></i> ${isSeries ? `Resume S${seriesInfo?.season_number || 1} E${seriesInfo?.track_number || 1}` : 'Play Now'}
            </button>
            <button class="btn-secondary btn-favorite" id="favorite-btn" onclick="window.toggleFavorite(${content.id}, this)">
              <i class="fas fa-heart"></i> <span class="fav-label">Favorite</span>
            </button>
          </div>
        </div>
      </div>

      <div class="detail-body">
        ${isSeries ? renderSeriesBody(content, seriesInfo, relatedEpisodes, worldData) : renderFilmBody(content, worldData)}
      </div>
    `;

    // Check initial favorite status
    if (window.currentUser) {
      checkFavoriteStatus(content.id).then(isFav => {
        const btn = document.getElementById('favorite-btn');
        if (btn && isFav) {
          btn.classList.add('favorited');
          const label = btn.querySelector('.fav-label');
          if (label) label.textContent = 'Favorited';
        }
      });
    }
  }

  function renderSeriesBody(content, seriesInfo, relatedEpisodes, worldData) {
    const episodesHtml = relatedEpisodes.length > 0 
      ? relatedEpisodes.map((ep, idx) => {
          const c = ep.Content;
          const isCurrent = c.id === content.id;
          const leaving = getLeavingSoonInfo(c.leaving_at);
          const leavingBadge = leaving
            ? `<span class="ep-leaving-badge">Leaving in ${leaving.daysLeft}d</span>`
            : '';
          return `
            <div class="episode-card ${isCurrent ? 'watched' : ''}" data-content-id="${c.id}" onclick="window.location.href='../content-detail.html?id=${c.id}'">
              <div class="ep-thumb">
                <img src="${fixMediaUrl(c.thumbnail_url)}" alt="${escapeHtml(c.title)}">
                ${isCurrent ? '<div class="ep-check"><i class="fas fa-check-circle"></i></div>' : ''}
                <div class="ep-play-overlay"><i class="fas fa-play"></i></div>
                ${leavingBadge}
              </div>
              <div class="ep-info">
                <span class="ep-number">E${ep.track_number || (idx + 1)}</span>
                <h4>${escapeHtml(c.title)}</h4>
                <span class="ep-duration">${formatDuration(c.duration)}</span>
              </div>
            </div>
          `;
        }).join('')
      : '<p style="color:var(--slate-grey);font-size:13px;">No additional episodes found.</p>';

    const worldHtml = (worldData && worldData.length > 0)
      ? worldData.map(w => `
          <div class="world-card" onclick="window.location.href='../content-detail.html?id=${content.id}&world=${w.world_type}'">
            <div class="world-card-icon"><i class="fas fa-${getWorldIcon(w.world_type)}"></i></div>
            <h4>${escapeHtml(w.title)}</h4>
            <p>${escapeHtml(w.description)}</p>
          </div>
        `).join('')
      : '<p style="color:var(--slate-grey);font-size:13px;">No deep-dive content available yet.</p>';

    return `
      <div class="detail-section">
        <h3 class="section-title">Up Next in ${escapeHtml(seriesInfo?.creator_playlists?.name || 'this series')}</h3>
        <div class="episode-rail">${episodesHtml}</div>
      </div>

      <div class="detail-section">
        <h3 class="section-title"><i class="fas fa-globe-africa"></i> The World of ${escapeHtml(content.title)}</h3>
        <div class="world-grid">${worldHtml}</div>
      </div>
    `;
  }

  function renderFilmBody(content, worldData) {
    // Parse chapters from content_metadata or chapters column
    const chapters = content.chapters && content.chapters.length > 0 
      ? content.chapters 
      : (content.content_metadata?.chapters || []);
    
    const chaptersHtml = chapters.length > 0
      ? chapters.map((ch, idx) => `
          <div class="episode-card" onclick="window.location.href='../content-detail.html?id=${content.id}&t=${ch.start_time || 0}'">
            <div class="ep-thumb">
              <img src="${fixMediaUrl(content.thumbnail_url)}" alt="${escapeHtml(ch.title || `Chapter ${idx + 1}`)}">
              <div class="ep-play-overlay"><i class="fas fa-play"></i></div>
            </div>
            <div class="ep-info">
              <span class="ep-number">Ch ${idx + 1}</span>
              <h4>${escapeHtml(ch.title || `Chapter ${idx + 1}`)}</h4>
              <span class="ep-duration">${ch.start_time ? formatDuration(ch.start_time) : ''}</span>
            </div>
          </div>
        `).join('')
      : '<p style="color:var(--slate-grey);font-size:13px;">No chapters defined.</p>';

    const worldHtml = (worldData && worldData.length > 0)
      ? worldData.map(w => `
          <div class="world-card" onclick="window.location.href='../content-detail.html?id=${content.id}&world=${w.world_type}'">
            <div class="world-card-icon"><i class="fas fa-${getWorldIcon(w.world_type)}"></i></div>
            <h4>${escapeHtml(w.title)}</h4>
            <p>${escapeHtml(w.description)}</p>
          </div>
        `).join('')
      : '<p style="color:var(--slate-grey);font-size:13px;">No behind-the-scenes content available yet.</p>';

    return `
      <div class="detail-section">
        <h3 class="section-title">Chapters</h3>
        <div class="episode-rail">${chaptersHtml}</div>
      </div>

      <div class="detail-section">
        <h3 class="section-title"><i class="fas fa-film"></i> Behind the Lens</h3>
        <div class="world-grid">${worldHtml}</div>
      </div>
    `;
  }

  function getWorldIcon(type) {
    const icons = {
      'family_web': 'project-diagram',
      'timeline': 'hourglass-half',
      'filmed_here': 'map-marker-alt',
      'making_of': 'video',
      'directors_cut': 'user-tie',
      'deleted_scene': 'film'
    };
    return icons[type] || 'info-circle';
  }

  // ===== FAVORITES FUNCTIONS =====
  async function checkFavoriteStatus(contentId) {
    if (!window.currentUser) return false;
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', window.currentUser.id)
        .eq('content_id', contentId)
        .maybeSingle();
      return !!data;
    } catch (e) {
      console.error('Check favorite error:', e);
      return false;
    }
  }

  window.toggleFavorite = async function(contentId, btnEl) {
    if (!window.currentUser) {
      window.openAuthModal?.();
      return;
    }
    const isFav = btnEl.classList.contains('favorited');
    btnEl.classList.toggle('favorited');
    btnEl.classList.add('fav-pop');
    setTimeout(() => btnEl.classList.remove('fav-pop'), 400);

    const label = btnEl.querySelector('.fav-label');
    if (label) {
      label.textContent = isFav ? 'Favorite' : 'Favorited';
    }

    try {
      if (isFav) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', window.currentUser.id)
          .eq('content_id', contentId);
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: window.currentUser.id, content_id: contentId });
      }
    } catch (e) {
      console.error('Toggle favorite error:', e);
      // Revert on error
      btnEl.classList.toggle('favorited');
      if (label) {
        label.textContent = isFav ? 'Favorited' : 'Favorite';
      }
    }
  };

  // ===== REAL DATA LOADING =====
  async function loadTop10() {
    const container = document.getElementById('top10-row');
    if (!container) return;
    try {
      const { data } = await supabase
        .from('Content')
        .select(`id, title, thumbnail_url, content_format, leaving_at, preview_clip_url, content_engagement_stats(total_views)`)
        .eq('status', 'published')
        .order('content_engagement_stats.total_views', { ascending: false, referencedTable: 'content_engagement_stats' })
        .limit(10);
      
      if (data && data.length > 0) {
        container.innerHTML = data.map((item, idx) => buildStandardCardHTML(item, true, idx + 1)).join('');
        attachCardClicks(container, data);
      }
    } catch (e) {
      console.error('Top 10 error:', e);
      container.innerHTML = `<button class="row-retry" onclick="loadTop10()">Couldn't load — tap to retry</button>`;
    }
  }

  async function loadMoodRows() {
    const container = document.getElementById('family-grid');
    if (!container) return;
    try {
      let query = supabase
        .from('Content')
        .select(`id, title, thumbnail_url, content_format, duration, leaving_at, preview_clip_url, content_engagement_stats(total_views)`)
        .eq('status', 'published');

      if (currentFilter === 'telenovela') {
        query = query.contains('sa_genres', ['telenovela']);
      } else if (currentFilter !== 'all') {
        query = query.eq('content_format', currentFilter);
      }

      const { data } = await query.limit(10);
      
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildStandardCardHTML(item)).join('');
        attachCardClicks(container, data);
      }
    } catch (e) {
      console.error('Mood rows error:', e);
      container.innerHTML = `<button class="row-retry" onclick="loadMoodRows()">Couldn't load — tap to retry</button>`;
    }
  }

  async function loadQuickBites() {
    const container = document.getElementById('quickbites-row');
    if (!container) return;
    try {
      let query = supabase
        .from('Content')
        .select(`id, title, thumbnail_url, content_format, leaving_at, preview_clip_url, content_engagement_stats(total_views)`)
        .eq('content_format', 'short')
        .eq('status', 'published');

      if (currentFilter === 'telenovela') {
        query = query.contains('sa_genres', ['telenovela']);
      } else if (currentFilter !== 'all') {
        query = query.eq('content_format', currentFilter);
      }

      const { data } = await query.limit(8);
      
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildShortCardHTML(item)).join('');
        attachCardClicks(container, data);
      }
    } catch (e) {
      console.error('Quick bites error:', e);
      container.innerHTML = `<button class="row-retry" onclick="loadQuickBites()">Couldn't load — tap to retry</button>`;
    }
  }

  async function loadRecommended() {
    const container = document.getElementById('recommended-row');
    if (!container) return;
    try {
      const { data } = await supabase
        .from('Content')
        .select(`id, title, thumbnail_url, content_format, duration, leaving_at, preview_clip_url, content_engagement_stats(total_views)`)
        .eq('status', 'published')
        .limit(8);
      
      if (data && data.length > 0) {
        container.innerHTML = data.map(item => buildStandardCardHTML(item)).join('');
        attachCardClicks(container, data);
      }
    } catch (e) {
      console.error('Recommended error:', e);
      container.innerHTML = `<button class="row-retry" onclick="loadRecommended()">Couldn't load — tap to retry</button>`;
    }
  }

  // ===== CONTINUE WATCHING =====
  async function loadContinueWatching() {
    if (!window.currentUser) return;
    const container = document.getElementById('continue-row');
    if (!container) return;

    try {
      const { data } = await supabase
        .from('watch_progress')
        .select(`
          last_position,
          updated_at,
          Content!inner(
            id,
            title,
            thumbnail_url,
            duration,
            content_format,
            leaving_at,
            preview_clip_url,
            content_engagement_stats(total_views)
          )
        `)
        .eq('user_id', window.currentUser.id)
        .eq('is_completed', false)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!data?.length) {
        document.getElementById('row-continue')?.remove();
        return;
      }

      container.innerHTML = data.map(w => {
        const pct = w.Content.duration ? Math.min(100, Math.round((w.last_position / w.Content.duration) * 100)) : 0;
        const leaving = getLeavingSoonInfo(w.Content.leaving_at);
        const leavingBadge = leaving
          ? `<span class="upload-card__badge leaving-soon">Leaving in ${leaving.daysLeft}d</span>`
          : '';
        return `
          <div class="upload-card" data-content-id="${w.Content.id}" tabindex="0" role="link">
            <div class="upload-card__thumb" style="background-image:url(${fixMediaUrl(w.Content.thumbnail_url)});">
              ${leavingBadge}
              <div class="media-hover-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <p class="upload-card__title">${escapeHtml(w.Content.title)}</p>
          </div>
        `;
      }).join('');
      attachCardClicks(container, data.map(w => w.Content));
    } catch (e) {
      console.error('Continue watching error:', e);
    }
  }

  function attachCardClicks(container, items = []) {
    container.querySelectorAll('[data-content-id]').forEach(card => {
      const activate = () => {
        const id = card.dataset.contentId;
        if (id) window.openInPageDetail(id);
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
      const item = items.find(i => String(i.id) === card.dataset.contentId);
      if (item) attachHoverPreview(card, item);
    });
  }

  function setupFilterChips() {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        loadMoodRows();
        loadQuickBites();
      });
    });
  }

  async function loadHero() {
    try {
      const { data } = await supabase
        .from('Content')
        .select(`id, title, description, thumbnail_url, content_format, genre, language, is_bantu_original, duration, leaving_at, content_engagement_stats(total_views)`)
        .eq('status', 'published')
        .order('content_engagement_stats.total_views', { ascending: false, referencedTable: 'content_engagement_stats' })
        .limit(1);
      
      if (data && data.length > 0) {
        const item = data[0];
        document.getElementById('hero-title').textContent = item.title;
        document.getElementById('hero-description').textContent = item.description || 'A gripping story of family, loyalty, and survival.';
        document.getElementById('hero-genre').textContent = item.genre || 'Drama';
        document.getElementById('hero-duration').textContent = item.duration ? formatDurationLong(item.duration) : '1h 54m';
        document.getElementById('hero-language').textContent = item.language || 'isiZulu, English subs';
        if (item.is_bantu_original) document.getElementById('hero-bantu-original').style.display = 'inline-flex';
        
        document.getElementById('hero-play-btn').onclick = () => window.openInPageDetail(item.id);
        document.getElementById('hero-info-btn').onclick = () => window.openInPageDetail(item.id);
      }
    } catch (e) { console.error('Hero error:', e); }
  }

  async function initialize() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');

    try {
      if (window.initSharedComponents) {
        await window.initSharedComponents();
      }

      // Show app shell immediately with skeletons
      if (app) app.style.display = 'block';

      // Fire independently, not Promise.all
      loadHero();
      loadTop10();
      loadMoodRows();
      loadQuickBites();
      loadRecommended();
      loadContinueWatching();

      setupFilterChips();

      if (loading) loading.style.display = 'none';

      console.log('✅ Film/Series browse screen initialized with REAL DATA');
    } catch (e) {
      console.error('Initialization error:', e);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
