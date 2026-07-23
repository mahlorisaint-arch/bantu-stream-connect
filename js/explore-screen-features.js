/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN FEATURES v5.0
 * REAL DATA UI IMPLEMENTATION - DISCOVERY WORLDS
 */

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Initializing Explore Screen with REAL DATA...');

  // Wait for fetchers to be available
  let retries = 0;
  while (!window.fetchers && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }

  if (!window.fetchers) {
    console.error('Fetchers not available after 5 seconds');
    document.getElementById('loading')?.remove();
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'block';
      app.innerHTML = '<div class="error-state">Loading Error - please refresh the page to continue.</div>';
    }
    return;
  }

  // DOM Elements
  const worldsContainer = document.getElementById('worldsContainer');
  const culturalContainer = document.getElementById('culturalGrid');
  const energyTicker = document.getElementById('energyTicker');

  // Journey State
  let journeySelections = {
    mood: null,
    region: null,
    language: null,
    format: null
  };

  // ============================================
  // 1. SETUP DISCOVERY JOURNEY OPTIONS
  // ============================================
  function setupJourneyOptions() {
    // Mood Options
    const moodOptions = [
      { value: 'inspirational', label: 'Inspirational', icon: 'fas fa-star', color: '#F59E0B' },
      { value: 'energetic', label: 'Energetic', icon: 'fas fa-bolt', color: '#EC4899' },
      { value: 'deep-stories', label: 'Deep Stories', icon: 'fas fa-book-open', color: '#8B5CF6' },
      { value: 'futuristic', label: 'Futuristic', icon: 'fas fa-rocket', color: '#06B6D4' },
      { value: 'funny', label: 'Funny', icon: 'fas fa-laugh', color: '#10B981' },
      { value: 'emotional', label: 'Emotional', icon: 'fas fa-heart', color: '#EF4444' },
      { value: 'educational', label: 'Educational', icon: 'fas fa-graduation-cap', color: '#3B82F6' },
      { value: 'spiritual', label: 'Spiritual', icon: 'fas fa-pray', color: '#A855F7' }
    ];

    // Region Options
    const regionOptions = [
      { value: 'south-africa', label: 'South Africa', flag: 'ZA', country: 'South Africa' },
      { value: 'nigeria', label: 'Nigeria', flag: 'NG', country: 'Nigeria' },
      { value: 'kenya', label: 'Kenya', flag: 'KE', country: 'Kenya' },
      { value: 'ghana', label: 'Ghana', flag: 'GH', country: 'Ghana' },
      { value: 'tanzania', label: 'Tanzania', flag: 'TZ', country: 'Tanzania' },
      { value: 'zimbabwe', label: 'Zimbabwe', flag: 'ZW', country: 'Zimbabwe' },
      { value: 'pan-african', label: 'Pan-African', flag: 'AF', country: 'Africa' }
    ];

    // Language Options
    const languageOptions = [
      { value: 'english', label: 'English', nativeName: 'English', code: 'en' },
      { value: 'zulu', label: 'isiZulu', nativeName: 'Zulu', code: 'zu' },
      { value: 'xhosa', label: 'isiXhosa', nativeName: 'Xhosa', code: 'xh' },
      { value: 'swahili', label: 'Kiswahili', nativeName: 'Swahili', code: 'sw' },
      { value: 'yoruba', label: 'Yorùbá', nativeName: 'Yoruba', code: 'yo' },
      { value: 'french', label: 'Français', nativeName: 'French', code: 'fr' },
      { value: 'portuguese', label: 'Português', nativeName: 'Portuguese', code: 'pt' }
    ];

    // Format Options
    const formatOptions = [
      { value: 'film', label: 'Film', icon: 'fas fa-film', color: '#8B5CF6' },
      { value: 'music', label: 'Music', icon: 'fas fa-music', color: '#EC4899' },
      { value: 'podcast', label: 'Podcast', icon: 'fas fa-podcast', color: '#10B981' },
      { value: 'live-stream', label: 'Live Stream', icon: 'fas fa-video', color: '#EF4444' },
      { value: 'animation', label: 'Animation', icon: 'fas fa-paintbrush', color: '#06B6D4' },
      { value: 'short-form', label: 'Short-form', icon: 'fas fa-mobile-alt', color: '#F59E0B' },
      { value: 'vlogs-tutorials', label: 'Vlogs & Tutorials', icon: 'fas fa-chalkboard-user', color: '#3B82F6' }
    ];

    // Render Mood Options
    const moodContainer = document.getElementById('moodOptions');
    if (moodContainer) {
      moodContainer.innerHTML = moodOptions.map(option => `
        <div class="journey-option mood-option" data-value="${option.value}" style="--option-color: ${option.color}">
          <i class="${option.icon}"></i>
          <span>${option.label}</span>
        </div>
      `).join('');

      document.querySelectorAll('.mood-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.mood-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          journeySelections.mood = opt.dataset.value;
        });
      });
    }

    // Render Region Options
    const regionContainer = document.getElementById('regionOptions');
    if (regionContainer) {
      regionContainer.innerHTML = regionOptions.map(option => `
        <div class="journey-option region-option" data-value="${option.value}" data-country="${option.country}">
          <span>${option.label}</span>
        </div>
      `).join('');

      document.querySelectorAll('.region-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.region-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          journeySelections.region = opt.dataset.value;
          journeySelections.regionCountry = opt.dataset.country;
        });
      });
    }

    // Render Language Options
    const languageContainer = document.getElementById('languageOptions');
    if (languageContainer) {
      languageContainer.innerHTML = languageOptions.map(option => `
        <div class="journey-option language-option" data-value="${option.value}" data-code="${option.code}">
          <span>${option.label}</span>
          <span style="font-size: 11px; opacity: 0.7;">${option.nativeName}</span>
        </div>
      `).join('');

      document.querySelectorAll('.language-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.language-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          journeySelections.language = opt.dataset.value;
        });
      });
    }

    // Render Format Options
    const formatContainer = document.getElementById('formatOptions');
    if (formatContainer) {
      formatContainer.innerHTML = formatOptions.map(option => `
        <div class="journey-option format-option" data-value="${option.value}" style="--option-color: ${option.color}">
          <i class="${option.icon}"></i>
          <span>${option.label}</span>
        </div>
      `).join('');

      document.querySelectorAll('.format-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.format-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          journeySelections.format = opt.dataset.value;
        });
      });
    }
  }

  // ============================================
  // 2. GENERATE DISCOVERY JOURNEY RESULTS
  // ============================================
  async function generateDiscoveryJourney() {
    // Check if all selections are made
    const missingSelections = [];
    if (!journeySelections.mood) missingSelections.push('Mood');
    if (!journeySelections.region) missingSelections.push('Region');
    if (!journeySelections.language) missingSelections.push('Language');
    if (!journeySelections.format) missingSelections.push('Format');

    if (missingSelections.length > 0) {
      if (window.showToast) {
        window.showToast(`Please select: ${missingSelections.join(', ')}`, 'warning');
      }
      return;
    }

    const resultsContainer = document.getElementById('journeyResults');
    if (!resultsContainer) return;

    // Show loading state
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--warm-gold);"></i>
        <p style="margin-top: 16px;">Crafting your personalized discovery journey...</p>
      </div>
    `;

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      let recommendations = [];

      const formatMap = {
        'film': 'movie',
        'music': 'music',
        'podcast': 'podcast',
        'live-stream': 'live',
        'animation': 'animation',
        'short-form': 'short',
        'vlogs-tutorials': 'vlog'
      };

      const contentType = formatMap[journeySelections.format] || 'video';

      // Fetch recommendations from database
      if (window.supabaseClient) {
        let query = window.supabaseClient
          .from('Content')
          .select(`
            id,
            title,
            description,
            thumbnail_url,
            creator_display_name,
            genre,
            created_at,
            content_type,
            tags,
            country,
            region
          `)
          .eq('status', 'published')
          .limit(8);

        // Apply filters based on selections
        if (contentType) {
          query = query.eq('content_type', contentType);
        }

        if (journeySelections.regionCountry && journeySelections.regionCountry !== 'Africa') {
          query = query.eq('country', journeySelections.regionCountry);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          recommendations = await window.fetchers.enrichWithEngagement(data);
        }
      }

      // Honest empty state - no fabricated recommendations
      if (recommendations.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state">Nothing here yet — check back soon.</div>
        `;
        return;
      }

      // Build results HTML
      const moodDisplay = document.querySelector('.mood-option.active span')?.innerText || journeySelections.mood;
      const regionDisplay = document.querySelector('.region-option.active span:last-child')?.innerText || journeySelections.region;
      const languageDisplay = document.querySelector('.language-option.active span:first-child')?.innerText || journeySelections.language;
      const formatDisplay = document.querySelector('.format-option.active span')?.innerText || journeySelections.format;

      resultsContainer.innerHTML = `
        <div class="journey-result-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
            <h3 style="font-size: 20px;">
              <i class="fas fa-compass" style="color: var(--warm-gold);"></i>
              Your Personalized Journey
            </h3>
            <div class="result-badges">
              <span class="result-badge"><i class="fas fa-smile"></i> ${moodDisplay}</span>
              <span class="result-badge"><i class="fas fa-map-marker-alt"></i> ${regionDisplay}</span>
              <span class="result-badge"><i class="fas fa-language"></i> ${languageDisplay}</span>
              <span class="result-badge"><i class="fas fa-tag"></i> ${formatDisplay}</span>
            </div>
          </div>

          <div class="result-recommendations">
            <h4 style="margin-bottom: 16px; font-size: 18px;">
              <i class="fas fa-star" style="color: var(--warm-gold);"></i>
              Recommended For You
            </h4>
            <div class="journey-rec-grid">
              ${recommendations.map(item => `
                <div class="rec-item" onclick="window.location.href='content-detail.html?id=${item.id}'">
                  <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;">
                  <div style="padding: 12px 4px 0;">
                    <h5 style="font-size: 14px; margin-bottom: 4px;">${window.escapeHtml(item.title) || 'Untitled'}</h5>
                    <p style="font-size: 12px; color: var(--slate-grey);">${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--slate-grey);">
                      <span><i class="fas fa-eye"></i> ${window.formatNumber(item.real_views || 0)}</span>
                      <span><i class="fas fa-heart"></i> ${window.formatNumber(item.real_likes || 0)}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <button class="explore-result-btn" onclick="window.location.href='content-library.html'">
              Explore More <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      `;

      if (window.showToast) {
        window.showToast('Your discovery journey is ready!', 'success');
      }

    } catch (error) {
      console.error('Error generating journey:', error);
      resultsContainer.innerHTML = `
        <div class="error-state">Unable to generate recommendations. Please try again.</div>
      `;
    }
  }

  // ============================================
  // 3. RENDER DISCOVERY WORLDS
  // ============================================
  const discoveryWorlds = [
    {
      id: 'film',
      name: 'Film World',
      tagline: 'Cinematic stories from Africa',
      icon: 'fa-film',
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      categories: ['Soapies & Telenovelas', 'African Futurism (Sci-Fi)', 'Township Dramas', 'SA Romantic Comedy'],
      redirectUrl: 'category/movies.html'
    },
    {
      id: 'music',
      name: 'Music World',
      tagline: 'Rhythms that move the continent',
      icon: 'fa-music',
      color: '#EC4899',
      gradient: 'linear-gradient(135deg, #1e1e2f, #2d1b3a)',
      categories: ['Amapiano', 'Afro House', 'Hip-Hop (SA)', 'Gqom'],
      redirectUrl: 'category/music.html'
    },
    {
      id: 'creator',
      name: 'Creator World',
      tagline: 'Meet the architects of culture',
      icon: 'fa-users',
      color: '#06B6D4',
      gradient: 'linear-gradient(135deg, #0f2e2e, #0f2a2e)',
      categories: ['Rising Stars', 'Verified', 'Trending'],
      redirectUrl: 'discover-creator.html'
    },
    {
      id: 'culture',
      name: 'Culture World',
      tagline: 'Heritage, traditions, and futures',
      icon: 'fa-drumstick-bite',
      color: '#10B981',
      gradient: 'linear-gradient(135deg, #0f2e1a, #1a2e24)',
      categories: ['Fashion', 'Languages', 'Traditions', 'Our History'],
      redirectUrl: '#culturalHub'
    }
  ];

  // Keyword matching for Film/Music/Culture category chips - checked against
  // genre, genres[], sa_genres[], tags[] and title (real Content columns).
  // Creator World chips use real structured fields instead (see matchesCreatorChip).
  const CHIP_KEYWORDS = {
    film: {
      'Soapies & Telenovelas': ['soapie', 'soap opera', 'telenovela'],
      'African Futurism (Sci-Fi)': ['futurism', 'sci-fi', 'scifi', 'science fiction'],
      'Township Dramas': ['township'],
      'SA Romantic Comedy': ['romantic comedy', 'rom-com', 'romcom']
    },
    music: {
      'Amapiano': ['amapiano'],
      'Afro House': ['afro house', 'afrohouse'],
      'Hip-Hop (SA)': ['hip-hop', 'hip hop', 'hiphop'],
      'Gqom': ['gqom']
    },
    culture: {
      'Fashion': ['fashion'],
      'Languages': ['language'],
      'Traditions': ['tradition'],
      'Our History': ['history']
    }
  };

  function matchesContentChip(item, keywords) {
    const haystack = [
      item.genre,
      ...(item.genres || []),
      ...(item.sa_genres || []),
      ...(item.tags || []),
      item.title
    ].filter(Boolean).join(' ').toLowerCase();
    return keywords.some(k => haystack.includes(k));
  }

  function matchesCreatorChip(item, chip) {
    if (chip === 'Rising Stars') return item.trend_stage === 'rising';
    if (chip === 'Verified') return !!item.is_verified;
    if (chip === 'Trending') return (item.velocity_score || 0) > 0 || (item.pulse_score || 0) > 0;
    return true;
  }

  async function renderDiscoveryWorlds() {
    if (!worldsContainer) return;

    worldsContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(4).fill().map(() => `<div class="skeleton-world-card"></div>`).join('')}
      </div>
    `;

    try {
      worldsContainer.innerHTML = discoveryWorlds.map(world => `
        <div class="world-card" data-world-id="${world.id}" data-redirect-url="${world.redirectUrl}" style="--world-color: ${world.color}">
          <div class="world-card-bg" style="background: ${world.gradient}"></div>
          <div class="world-card-glow" style="background: radial-gradient(circle at center, ${world.color}40, transparent)"></div>
          <div class="world-icon"><i class="fas ${world.icon}"></i></div>
          <div class="world-info">
            <h3 class="world-name">${world.name}</h3>
            <p class="world-desc">${world.tagline}</p>
            <div class="world-genres">
              ${world.categories.map(cat => `<span class="genre-tag">${cat}</span>`).join('')}
            </div>
            <div class="world-stats">
              <button class="explore-world-btn" data-world="${world.id}">Explore <i class="fas fa-arrow-right"></i></button>
            </div>
          </div>
        </div>
      `).join('');

      document.querySelectorAll('.explore-world-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const worldId = btn.dataset.world;
          const worldConfig = discoveryWorlds.find(w => w.id === worldId);
          if (worldConfig) {
            await showWorldExpandedContent(worldConfig);
          }
        });
      });

      document.querySelectorAll('.world-card').forEach(card => {
        card.addEventListener('click', async (e) => {
          if (e.target.classList.contains('explore-world-btn') || e.target.closest('.explore-world-btn')) return;
          const worldId = card.dataset.worldId;
          const worldConfig = discoveryWorlds.find(w => w.id === worldId);
          if (worldConfig) {
            await showWorldExpandedContent(worldConfig);
          }
        });
      });

    } catch (error) {
      console.error('Error rendering discovery worlds:', error);
      if (worldsContainer) {
        worldsContainer.innerHTML = '<div class="error-state">Failed to load worlds. Please refresh.</div>';
      }
    }
  }

  async function showWorldExpandedContent(worldConfig) {
    const modal = document.createElement('div');
    modal.className = 'world-expanded-modal';

    let allItems = [];
    let itemKind = 'content';
    const POOL_LIMIT = 24;

    switch (worldConfig.id) {
      case 'film':
        allItems = await window.fetchers.getContentByType('movie', POOL_LIMIT);
        if (allItems.length === 0) allItems = await window.fetchers.getContentByType('video', POOL_LIMIT);
        break;
      case 'music':
        allItems = await window.fetchers.getContentByType('music', POOL_LIMIT);
        if (allItems.length === 0) allItems = await window.fetchers.getContentByType('audio', POOL_LIMIT);
        break;
      case 'creator':
        allItems = await window.fetchers.fetchFeaturedCreators(20);
        itemKind = 'creator';
        break;
      case 'culture':
        allItems = await window.fetchers.getContentByType('culture', POOL_LIMIT);
        if (allItems.length === 0) {
          allItems = await window.fetchers.fetchCulturalMovements(POOL_LIMIT);
          itemKind = 'movement';
        }
        break;
      default:
        allItems = await window.fetchers.getContentByType('video', POOL_LIMIT);
    }

    function renderGrid(items) {
      if (!items || items.length === 0) {
        return '<div class="empty-state">Nothing here yet — check back soon.</div>';
      }
      return items.slice(0, 10).map(item => itemKind === 'movement' ? renderMovementCard(item) : renderContentItem(item, itemKind)).join('');
    }

    modal.innerHTML = `
      <div class="expanded-modal-header">
        <div>
          <i class="fas ${worldConfig.icon}" style="color: ${worldConfig.color};"></i>
          <span class="expanded-modal-title">${worldConfig.name}</span>
          <span class="expanded-modal-tagline">${worldConfig.tagline}</span>
        </div>
        <button class="close-modal-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="expanded-modal-content">
        <div class="content-categories">
          ${worldConfig.categories.map(cat => `<span class="category-chip" data-chip="${window.escapeHtml(cat)}">${cat}</span>`).join('')}
        </div>
        <div class="content-grid">${renderGrid(allItems)}</div>
        <div class="expanded-modal-footer">
          <button class="view-all-btn" data-redirect="${worldConfig.redirectUrl}" style="background: linear-gradient(135deg, ${worldConfig.color}, ${worldConfig.color}80);">
            View All <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const gridEl = modal.querySelector('.content-grid');

    function bindMovementClicks() {
      if (itemKind !== 'movement') return;
      gridEl.querySelectorAll('.movement-card').forEach(card => {
        card.addEventListener('click', () => {
          modal.remove();
          document.body.style.overflow = '';
          document.getElementById('culturalHub')?.scrollIntoView({ behavior: 'smooth' });
        });
      });
    }
    bindMovementClicks();

    // Category chips filter the already-fetched pool client-side, since
    // Film/Music/Culture chips key off real genre/genres/sa_genres/tags text
    // and Creator chips key off real trend_stage/velocity/is_verified fields.
    // Clicking an active chip again clears the filter.
    modal.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const isActive = chip.classList.contains('active');
        modal.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));

        if (isActive) {
          gridEl.innerHTML = renderGrid(allItems);
          bindMovementClicks();
          return;
        }

        chip.classList.add('active');
        const label = chip.dataset.chip;
        let filtered;
        if (worldConfig.id === 'creator') {
          filtered = allItems.filter(item => matchesCreatorChip(item, label));
        } else {
          const keywords = (CHIP_KEYWORDS[worldConfig.id] || {})[label] || [];
          filtered = allItems.filter(item => matchesContentChip(item, keywords));
        }
        gridEl.innerHTML = renderGrid(filtered);
        bindMovementClicks();
      });
    });

    const closeBtn = modal.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => {
      modal.remove();
      document.body.style.overflow = '';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = '';
      }
    });

    const viewAllBtn = modal.querySelector('.view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        const redirectUrl = viewAllBtn.dataset.redirect;
        if (!redirectUrl) return;
        modal.remove();
        document.body.style.overflow = '';
        if (redirectUrl.startsWith('#')) {
          document.getElementById(redirectUrl.slice(1))?.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.location.href = redirectUrl;
        }
      });
    }
  }

  function renderContentItem(item, worldType) {
    if (worldType === 'creator') {
      return `
        <div class="content-card creator-card" onclick="window.location.href='creator-channel.html?id=${item.id}'">
          <div class="content-card-avatar">
            ${item.avatar_url ? `<img src="${item.avatar_url}" alt="${window.escapeHtml(item.full_name || item.username || 'Creator')}">` : `<i class="fas fa-user"></i>`}
          </div>
          <h4>${window.escapeHtml(item.full_name || item.username || 'Creator')}</h4>
          <p>${item.bio ? window.escapeHtml(item.bio.substring(0, 60)) : 'African Creator'}</p>
        </div>
      `;
    }

    return `
      <div class="content-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
        <div class="content-card-thumb">
          <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title || 'Content')}">
        </div>
        <div class="content-card-body">
          <h4>${window.escapeHtml(item.title || 'Untitled')}</h4>
          <p>${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
          <div class="content-card-stats">
            <span><i class="fas fa-eye"></i> ${window.formatNumber(item.real_views || 0)}</span>
            <span><i class="fas fa-heart"></i> ${window.formatNumber(item.real_likes || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderMovementCard(movement) {
    return `
      <div class="content-card creator-card movement-card">
        <div class="content-card-avatar"><i class="fas fa-compass"></i></div>
        <h4>${window.escapeHtml(movement.name)}</h4>
        <p>${movement.description ? window.escapeHtml(movement.description.substring(0, 80)) : `Explore the ${window.escapeHtml(movement.name)} movement`}</p>
      </div>
    `;
  }

  // ============================================
  // 4. CULTURAL HUB - real `movements` table data only
  // ============================================
  async function renderCulturalHub() {
    if (!culturalContainer) return;
    culturalContainer.innerHTML = `<div class="skeleton-grid">${Array(6).fill().map(() => `<div class="skeleton-cultural-card"></div>`).join('')}</div>`;
    try {
      const movements = await window.fetchers.fetchCulturalMovements(6);
      if (!movements || movements.length === 0) {
        culturalContainer.innerHTML = '<div class="empty-state">Nothing here yet — check back soon.</div>';
        return;
      }
      culturalContainer.innerHTML = movements.map((m, i) => `
        <div class="cultural-card" data-movement-index="${i}">
          <div class="cultural-card-inner">
            <i class="fas fa-compass"></i>
            <h3>${window.escapeHtml(m.name)}</h3>
            <p>${window.escapeHtml(m.description || `Explore the ${m.name} movement`)}</p>
            <button class="explore-cultural-btn" type="button">Explore <i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
      `).join('');

      culturalContainer.querySelectorAll('.cultural-card').forEach(card => {
        card.addEventListener('click', () => {
          const movement = movements[Number(card.dataset.movementIndex)];
          if (movement) showMovementDetail(movement);
        });
      });
    } catch (error) {
      culturalContainer.innerHTML = '<div class="error-state">Failed to load cultural content</div>';
    }
  }

  function showMovementDetail(movement) {
    const modal = document.createElement('div');
    modal.className = 'world-expanded-modal';

    const eraText = movement.era_start
      ? `${movement.era_start}${movement.era_end ? ' – ' + movement.era_end : ' – present'}`
      : '';
    const placeText = [movement.city, movement.region].filter(Boolean).join(', ');

    modal.innerHTML = `
      <div class="expanded-modal-header">
        <div>
          <i class="fas fa-compass" style="color: var(--bantu-blue);"></i>
          <span class="expanded-modal-title">${window.escapeHtml(movement.name)}</span>
        </div>
        <button class="close-modal-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="expanded-modal-content movement-detail-content">
        ${movement.description ? `<p class="movement-detail-description">${window.escapeHtml(movement.description)}</p>` : ''}
        <div class="content-categories">
          ${eraText ? `<span class="category-chip"><i class="fas fa-clock"></i> ${window.escapeHtml(eraText)}</span>` : ''}
          ${placeText ? `<span class="category-chip"><i class="fas fa-map-marker-alt"></i> ${window.escapeHtml(placeText)}</span>` : ''}
        </div>
        <div class="expanded-modal-footer">
          <button class="view-all-btn" id="movementHubBtn" style="background: linear-gradient(135deg, var(--warm-gold), var(--bantu-blue));">
            See Culture World <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
      modal.remove();
      document.body.style.overflow = '';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = '';
      }
    });
    modal.querySelector('#movementHubBtn').addEventListener('click', () => {
      modal.remove();
      document.body.style.overflow = '';
      const cultureWorld = discoveryWorlds.find(w => w.id === 'culture');
      if (cultureWorld) showWorldExpandedContent(cultureWorld);
    });
  }

  // ============================================
  // 5. ENERGY TICKER - only real fetchPlatformStats() numbers, honest
  //    loading/empty state otherwise (no fabricated placeholder numbers)
  // ============================================
  async function updateEnergyBar() {
    if (!energyTicker) return;
    try {
      const stats = await window.fetchers.fetchPlatformStats();
      if (!stats) {
        energyTicker.innerHTML = '<span>Platform stats unavailable right now</span>';
        return;
      }
      const tickerItems = [
        `${(stats.totalViews || 0).toLocaleString()} total views across the platform`,
        `${(stats.totalContent || 0).toLocaleString()} pieces of content published`,
        `${(stats.totalCreators || 0).toLocaleString()} creators on Bantu Stream Connect`
      ];
      energyTicker.innerHTML = tickerItems.map(item => `<span>${item}</span>`).join('') + tickerItems.map(item => `<span>${item}</span>`).join('');
    } catch (error) {
      energyTicker.innerHTML = '<span>Platform stats unavailable right now</span>';
    }
  }

  // ============================================
  // 6. HERO BUTTONS & FINAL CTA
  // ============================================
  function setupHeroButtons() {
    const exploreWorldsBtn = document.getElementById('exploreWorldsBtn');
    const startJourneyBtn = document.getElementById('startJourneyBtn');
    const discoverCreatorsBtn = document.getElementById('discoverCreatorsBtn');
    if (exploreWorldsBtn) exploreWorldsBtn.addEventListener('click', () => document.getElementById('worldsSection')?.scrollIntoView({ behavior: 'smooth' }));
    if (startJourneyBtn) startJourneyBtn.addEventListener('click', () => document.getElementById('journeySection')?.scrollIntoView({ behavior: 'smooth' }));
    if (discoverCreatorsBtn) discoverCreatorsBtn.addEventListener('click', () => window.location.href = 'discover-creator.html');
  }

  function setupFinalCta() {
    const discoverAllBtn = document.getElementById('discoverAllBtn');
    if (discoverAllBtn) discoverAllBtn.addEventListener('click', () => document.getElementById('worldsSection')?.scrollIntoView({ behavior: 'smooth' }));
  }

  // ============================================
  // 7. INITIALIZE
  // ============================================
  async function initialize() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    try {
      setupJourneyOptions();
      const generateBtn = document.getElementById('generateJourneyBtn');
      if (generateBtn) generateBtn.addEventListener('click', generateDiscoveryJourney);
      setupHeroButtons();
      setupFinalCta();
      await Promise.all([
        renderDiscoveryWorlds(),
        renderCulturalHub(),
        updateEnergyBar()
      ]);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
      console.log('Explore Screen initialized with real data');
    } catch (error) {
      console.error('Error initializing explore screen:', error);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }

  initialize();
});
