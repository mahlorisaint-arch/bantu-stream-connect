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

  // ===== HOVER PREVIEW STATE =====
  const HOVER_DELAY = 500;
  const hoverTimers = new WeakMap();

  // ===== FOCUS RETURN STATE =====
  let lastFocusedCard = null;
  let featuredContentId = null;
  let topContentIds = [];

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
    if (typeof url !== 'string') return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=225&fit=crop';
    url = url.trim().replace(/^`+|`+$/g, '').replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  function getCloudflareThumbnailUrl(providerVideoId, height = 720) {
    if (!providerVideoId) return '';
    return `https://videodelivery.net/${providerVideoId}/thumbnails/thumbnail.jpg?time=5s&height=${height}`;
  }

  function getPosterUrl(item, height = 720) {
    if (item?.thumbnail_url) return fixMediaUrl(item.thumbnail_url);
    if (item?.streaming_provider === 'cloudflare_stream' && item?.provider_video_id) {
      return getCloudflareThumbnailUrl(item.provider_video_id, height);
    }
    return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=600&fit=crop';
  }

  function getCreatorName(item) {
    return item?.creator_display_name || item?.creator || item?.user_profiles?.full_name || item?.user_profiles?.username || 'Unknown Creator';
  }

  function getViewCount(item) {
    return item?.content_engagement_stats?.total_views || item?.live_views || 0;
  }

  function formatViewsLabel(item) {
    return `${formatNumber(getViewCount(item))} views`;
  }

  const MOVIES_CONTENT_FORMATS = ['film', 'documentary', 'series_episode'];

  function matchesCurrentFilter(item) {
    if (!item) return false;
    if (!MOVIES_CONTENT_FORMATS.includes(item.content_format)) return false;
    if (currentFilter === 'all') return true;
    if (currentFilter === 'telenovela') {
      return Array.isArray(item.sa_genres) && item.sa_genres.includes('telenovela');
    }
    if (currentFilter === 'series') return item.content_format === 'series_episode';
    if (currentFilter === 'film') return item.content_format === 'film';
    if (currentFilter === 'documentary') return item.content_format === 'documentary';
    return false;
  }

  function hasHeroVideo(item) {
    return !!(item?.preview_clip_url || (item?.streaming_provider === 'cloudflare_stream' && item?.provider_video_id));
  }

  function getPreviewUrl(item) {
    if (!item) return '';
    if (item.preview_clip_url) return fixMediaUrl(item.preview_clip_url);
    if (item.streaming_provider === 'cloudflare_stream' && item.provider_video_id) {
      const params = new URLSearchParams({
        autoplay: 'true',
        muted: 'true',
        loop: 'true',
        controls: 'false',
        preload: 'true',
        poster: getCloudflareThumbnailUrl(item.provider_video_id, 480)
      });
      return `https://iframe.videodelivery.net/${item.provider_video_id}?${params.toString()}`;
    }
    return '';
  }

  function getHeroFeatureLabel(item) {
    if (item?.is_bantu_original) return 'Bantu Original Spotlight';
    if (getViewCount(item) > 0) return 'Top in Mzansi';
    return "Tonight's Spotlight";
  }

  function getHeroScore(item) {
    let score = getViewCount(item);
    if (item?.is_bantu_original) score += 100000000;
    if (hasHeroVideo(item)) score += 1000000;
    if (item?.content_format === 'film') score += 100000;
    if (item?.content_format === 'documentary') score += 50000;
    if (item?.content_format === 'series_episode') score += 25000;
    score += (item?.favorites_count || 0) * 100;
    score += (item?.shares_count || 0) * 75;
    score += (item?.comments_count || 0) * 20;
    if (item?.created_at) {
      score += Math.floor(new Date(item.created_at).getTime() / 86400000);
    }
    return score;
  }

  function selectFeaturedItem(items) {
    if (!items?.length) return null;
    return [...items].sort((a, b) => getHeroScore(b) - getHeroScore(a))[0];
  }

  function applyCardExclusions(items, exclusions = []) {
    if (!items?.length) return [];
    const exclusionSet = new Set(exclusions.filter(Boolean).map(String));
    return items.filter(item => !exclusionSet.has(String(item.id)));
  }

  function configureHeroMedia(item) {
    const posterImage = document.getElementById('hero-poster-image');
    const videoEl = document.getElementById('hero-video');
    const frameEl = document.getElementById('hero-video-frame');
    if (!posterImage || !videoEl || !frameEl) return;

    const posterUrl = getPosterUrl(item);
    posterImage.src = posterUrl;
    posterImage.style.display = 'block';

    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.style.display = 'none';
    videoEl.load();

    frameEl.src = '';
    frameEl.style.display = 'none';

    if (item?.preview_clip_url) {
      videoEl.poster = posterUrl;
      videoEl.src = fixMediaUrl(item.preview_clip_url);
      videoEl.style.display = 'block';
      videoEl.play().catch(() => {
        videoEl.style.display = 'none';
      });
      return;
    }

    if (item?.streaming_provider === 'cloudflare_stream' && item?.provider_video_id) {
      const params = new URLSearchParams({
        autoplay: 'true',
        muted: 'true',
        loop: 'true',
        controls: 'false',
        preload: 'true',
        poster: getCloudflareThumbnailUrl(item.provider_video_id, 720)
      });
      frameEl.src = `https://iframe.videodelivery.net/${item.provider_video_id}?${params.toString()}`;
      frameEl.style.display = 'block';
    }
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

  function applyCurrentFilter(query) {
    query = query.in('content_format', MOVIES_CONTENT_FORMATS);

    if (currentFilter === 'telenovela') {
      return query.contains('sa_genres', ['telenovela']);
    }

    if (currentFilter === 'series') return query.eq('content_format', 'series_episode');
    if (currentFilter === 'film') return query.eq('content_format', 'film');
    if (currentFilter === 'documentary') return query.eq('content_format', 'documentary');

    return query;
  }

  function setSectionVisibility(sectionId, shouldShow, displayValue = '') {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.style.display = shouldShow ? displayValue : 'none';
  }

  function renderRowEmptyState(container, message) {
    if (!container) return;
    container.innerHTML = `<div class="row-empty">${escapeHtml(message)}</div>`;
  }

  function renderHeroFallback() {
    featuredContentId = null;
    setSectionVisibility('hero-section', true, 'flex');
    const posterImage = document.getElementById('hero-poster-image');
    const videoEl = document.getElementById('hero-video');
    const frameEl = document.getElementById('hero-video-frame');
    if (posterImage) {
      posterImage.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=600&fit=crop';
      posterImage.style.display = 'block';
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.style.display = 'none';
      videoEl.load();
    }
    if (frameEl) {
      frameEl.src = '';
      frameEl.style.display = 'none';
    }
    document.getElementById('hero-title').textContent = 'Movies worth exploring';
    document.getElementById('hero-description').textContent = 'Fresh films, documentaries, and series episodes will appear here as soon as they are ready to watch.';
    document.getElementById('hero-genre').textContent = 'Film & Series';
    document.getElementById('hero-duration').textContent = 'Updated daily';
    document.getElementById('hero-language').textContent = 'South Africa';
    document.getElementById('hero-creator').textContent = 'Curated from BSC creators';
    document.getElementById('hero-views').textContent = 'New titles loading';
    document.getElementById('hero-feature-badge').textContent = "Tonight's Spotlight";
    document.getElementById('hero-bantu-original').style.display = 'none';
    document.getElementById('hero-leaving-badge').style.display = 'none';
    document.getElementById('hero-leaving-badge').textContent = '';
    document.getElementById('hero-play-btn').onclick = () => window.scrollTo({ top: document.getElementById('row-top10')?.offsetTop || 0, behavior: 'smooth' });
    document.getElementById('hero-info-btn').onclick = () => window.scrollTo({ top: document.getElementById('row-family')?.offsetTop || 0, behavior: 'smooth' });
  }

  function buildStandardCardHTML(item, isTop10 = false, rank = 0) {
    const meta = formatMeta(item.content_format);
    const leaving = getLeavingSoonInfo(item.leaving_at);
    const leavingBadge = leaving
      ? `<span class="upload-card__badge leaving-soon">Leaving in ${leaving.daysLeft}d</span>`
      : '';
    const creatorName = getCreatorName(item);
    const posterUrl = getPosterUrl(item, 400);
    
    if (isTop10) {
      return `
        <div class="top10-card" data-content-id="${item.id}" tabindex="0" role="link">
          <div class="top10-thumb">
            <span class="top10-stamp"><i class="fas fa-bolt"></i> Heat</span>
            <img src="${posterUrl}" alt="${escapeHtml(item.title)}" loading="lazy">
          </div>
          <p class="top10-title">${escapeHtml(item.title)}</p>
          <p class="top10-meta">${escapeHtml(creatorName)}</p>
        </div>
      `;
    }

    return `
      <div class="upload-card" data-content-id="${item.id}" tabindex="0" role="link">
        <div class="upload-card__thumb" style="background-image: url(${posterUrl});">
          ${leavingBadge}
          <span class="upload-card__badge" style="background: ${meta.color}; color: white;">${meta.label}</span>
          ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
        </div>
        <p class="upload-card__title">${escapeHtml(item.title)}</p>
        <p class="upload-card__byline">${escapeHtml(creatorName)}</p>
        <p class="upload-card__meta">
          <span>${item.duration ? formatDurationLong(item.duration) : meta.label}</span>
          <span class="meta-divider">·</span>
          <span><i class="fas fa-eye"></i> ${formatViewsLabel(item)}</span>
        </p>
      </div>
    `;
  }

  // ===== HOVER PREVIEW FUNCTIONS =====
  function attachHoverPreview(cardEl, item) {
    if (!getPreviewUrl(item)) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const thumb = cardEl.querySelector('.upload-card__thumb, .top10-thumb');
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
    if (thumb.querySelector('video, iframe')) return;

    if (item?.streaming_provider === 'cloudflare_stream' && item?.provider_video_id && !item?.preview_clip_url) {
      const frame = document.createElement('iframe');
      frame.src = getPreviewUrl(item);
      frame.className = 'card-preview-frame';
      frame.title = `${item.title || 'Content'} preview`;
      frame.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      thumb.appendChild(frame);
      requestAnimationFrame(() => {
        frame.classList.add('active');
      });
      return;
    }

    const video = document.createElement('video');
    video.src = getPreviewUrl(item);
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
    if (video) {
      video.pause();
      video.remove();
    }

    const frame = thumb.querySelector('iframe');
    if (frame) {
      frame.remove();
    }
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
          is_bantu_original, content_metadata, chapters, leaving_at, creator_display_name, creator,
          streaming_provider, provider_video_id,
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
            .select(`content_id, track_number, Content!inner (id, title, thumbnail_url, duration, content_format, leaving_at, preview_clip_url, streaming_provider, provider_video_id)`)
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
          <img src="${getPosterUrl(content)}" alt="${escapeHtml(content.title)}">
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
            <span>${escapeHtml(creatorName)}</span>
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
                <img src="${getPosterUrl(c, 400)}" alt="${escapeHtml(c.title)}">
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
              <img src="${getPosterUrl(content, 400)}" alt="${escapeHtml(ch.title || `Chapter ${idx + 1}`)}">
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
      let query = supabase
        .from('Content')
        .select(`
          id, created_at, title, thumbnail_url, content_format, duration, leaving_at, preview_clip_url,
          creator, creator_display_name, favorites_count, shares_count, comments_count, live_views,
          streaming_provider, provider_video_id
        `)
        .eq('status', 'published')
        .order('favorites_count', { ascending: false })
        .order('shares_count', { ascending: false })
        .order('created_at', { ascending: false });

      query = applyCurrentFilter(query);

      const { data } = await query.limit(14);
      const topItems = applyCardExclusions(data || [], [featuredContentId]).slice(0, 10);
      
      if (topItems.length > 0) {
        topContentIds = topItems.map(item => item.id);
        setSectionVisibility('row-top10', true);
        container.innerHTML = topItems.map(item => buildStandardCardHTML(item, true)).join('');
        attachCardClicks(container, topItems);
      } else {
        topContentIds = [];
        setSectionVisibility('row-top10', true);
        renderRowEmptyState(container, 'Top movies will appear here as soon as published titles are ready.');
      }
    } catch (e) {
      console.error('Top 10 error:', e);
      topContentIds = [];
      setSectionVisibility('row-top10', true);
      renderRowEmptyState(container, 'Top movies are temporarily unavailable. Refresh to try again.');
    }
  }

  async function loadMoodRows() {
    const container = document.getElementById('family-grid');
    if (!container) return;
    try {
      let query = supabase
        .from('Content')
        .select(`
          id, created_at, title, thumbnail_url, content_format, duration, leaving_at, preview_clip_url,
          creator, creator_display_name, favorites_count, shares_count, comments_count, live_views,
          streaming_provider, provider_video_id, sa_genres
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      query = applyCurrentFilter(query);

      const { data } = await query.limit(24);
      const moodItems = applyCardExclusions(data || [], [featuredContentId, ...topContentIds]).slice(0, 10);
      
      if (moodItems.length > 0) {
        setSectionVisibility('row-family', true);
        container.innerHTML = moodItems.map(item => buildStandardCardHTML(item)).join('');
        attachCardClicks(container, moodItems);
      } else {
        setSectionVisibility('row-family', true);
        renderRowEmptyState(container, 'More titles will appear here as your movie library grows.');
      }
    } catch (e) {
      console.error('Mood rows error:', e);
      setSectionVisibility('row-family', true);
      renderRowEmptyState(container, 'More titles are temporarily unavailable. Refresh to try again.');
    }
  }

  // ===== CONTINUE WATCHING =====
  async function loadContinueWatching() {
    if (!window.currentUser) {
      setSectionVisibility('row-continue', false);
      return;
    }
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
            sa_genres,
            creator,
            creator_display_name,
            favorites_count,
            shares_count,
            comments_count,
            live_views,
            leaving_at,
            preview_clip_url,
            streaming_provider,
            provider_video_id
          )
        `)
        .eq('user_id', window.currentUser.id)
        .eq('is_completed', false)
        .order('updated_at', { ascending: false })
        .limit(10);

      const filteredItems = (data || []).filter(w => matchesCurrentFilter(w.Content));

      if (!filteredItems.length) {
        setSectionVisibility('row-continue', false);
        return;
      }

      setSectionVisibility('row-continue', true);
      container.innerHTML = filteredItems.map(w => {
        const pct = w.Content.duration ? Math.min(100, Math.round((w.last_position / w.Content.duration) * 100)) : 0;
        const remainingSeconds = w.Content.duration ? Math.max(0, w.Content.duration - w.last_position) : 0;
        const leaving = getLeavingSoonInfo(w.Content.leaving_at);
        const leavingBadge = leaving
          ? `<span class="upload-card__badge leaving-soon">Leaving in ${leaving.daysLeft}d</span>`
          : '';
        return `
          <div class="upload-card" data-content-id="${w.Content.id}" tabindex="0" role="link">
            <div class="upload-card__thumb" style="background-image:url(${getPosterUrl(w.Content, 400)});">
              ${leavingBadge}
              <div class="media-hover-play"><i class="fas fa-play"></i></div>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <p class="upload-card__title">${escapeHtml(w.Content.title)}</p>
            <p class="upload-card__byline">${escapeHtml(getCreatorName(w.Content))}</p>
            <p class="upload-card__meta">
              <span>${remainingSeconds ? `${formatDurationLong(remainingSeconds)} left` : 'Resume now'}</span>
              <span class="meta-divider">·</span>
              <span>${formatViewsLabel(w.Content)}</span>
            </p>
          </div>
        `;
      }).join('');
      attachCardClicks(container, filteredItems.map(w => w.Content));
    } catch (e) {
      console.error('Continue watching error:', e);
      setSectionVisibility('row-continue', false);
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

  async function refreshBrowseContent() {
    await loadHero();
    await loadTop10();
    await loadMoodRows();
    await loadContinueWatching();
  }

  function setupFilterChips() {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', async () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        await refreshBrowseContent();
      });
    });
  }

  async function loadHero() {
    const heroSection = document.getElementById('hero-section');
    try {
      let query = supabase
        .from('Content')
        .select(`
          id, created_at, title, description, thumbnail_url, content_format, genre, language, is_bantu_original, duration, leaving_at, sa_genres,
          creator, creator_display_name, favorites_count, shares_count, comments_count, live_views,
          preview_clip_url, streaming_provider, provider_video_id
        `)
        .eq('status', 'published')
        .order('is_bantu_original', { ascending: false })
        .order('favorites_count', { ascending: false })
        .order('created_at', { ascending: false });

      query = applyCurrentFilter(query);

      const { data } = await query.limit(12);
      
      if (data && data.length > 0) {
        const item = selectFeaturedItem(data.filter(matchesCurrentFilter));
        if (!item) {
          renderHeroFallback();
          return;
        }

        featuredContentId = item.id;
        setSectionVisibility('hero-section', true, 'flex');
        configureHeroMedia(item);
        document.getElementById('hero-title').textContent = item.title;
        document.getElementById('hero-description').textContent = item.description || 'A story worth settling into tonight.';
        document.getElementById('hero-genre').textContent = item.genre || 'Drama';
        document.getElementById('hero-duration').textContent = item.duration ? formatDurationLong(item.duration) : '1h 54m';
        document.getElementById('hero-language').textContent = item.language || 'isiZulu, English subs';
        document.getElementById('hero-creator').textContent = `By ${getCreatorName(item)}`;
        document.getElementById('hero-views').textContent = formatViewsLabel(item);
        document.getElementById('hero-feature-badge').textContent = getHeroFeatureLabel(item);
        document.getElementById('hero-bantu-original').style.display = item.is_bantu_original ? 'inline-flex' : 'none';
        const leaving = getLeavingSoonInfo(item.leaving_at);
        const leavingBadge = document.getElementById('hero-leaving-badge');
        if (leaving) {
          leavingBadge.style.display = 'inline-flex';
          leavingBadge.innerHTML = `<i class="fas fa-clock"></i> Leaving in ${leaving.daysLeft}d`;
        } else {
          leavingBadge.style.display = 'none';
          leavingBadge.textContent = '';
        }
        
        document.getElementById('hero-play-btn').onclick = () => {
          window.location.href = `../content-detail.html?id=${item.id}`;
        };
        document.getElementById('hero-info-btn').onclick = () => window.openInPageDetail(item.id);
      } else if (heroSection) {
        renderHeroFallback();
      }
    } catch (e) {
      console.error('Hero error:', e);
      renderHeroFallback();
    }
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

      await refreshBrowseContent();

      setupFilterChips();

      if (loading) loading.style.display = 'none';

      console.log('✅ Movies browse screen initialized with real data');
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
