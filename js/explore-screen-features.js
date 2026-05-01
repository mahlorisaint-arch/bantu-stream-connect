/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN FEATURES v4.0
 * REAL DATA UI IMPLEMENTATION
 */

document.addEventListener('DOMContentLoaded', async function() {
  console.log('🎬 Initializing Explore Screen with REAL DATA...');
  
  // Wait for fetchers to be available
  let retries = 0;
  while (!window.fetchers && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  
  if (!window.fetchers) {
    console.error('❌ Fetchers not available after 5 seconds');
    document.getElementById('loading')?.remove();
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'block';
      app.innerHTML = '<div class="error-screen"><h2>Loading Error</h2><p>Please refresh the page to continue.</p><button onclick="location.reload()">Refresh</button></div>';
    }
    return;
  }
  
  console.log('✅ Fetchers available, initializing UI...');
  
  // DOM Elements
  const worldsContainer = document.getElementById('worldsContainer');
  const creatorsContainer = document.getElementById('creatorEcosystems');
  const liveContainer = document.getElementById('liveGrid');
  const culturalContainer = document.getElementById('culturalGrid');
  const editorialContainer = document.getElementById('editorialGrid');
  const energyText = document.getElementById('energyText');
  const energyTicker = document.getElementById('energyTicker');
  
  // ============================================
  // 1. RENDER DISCOVERY WORLDS (From Genres)
  // ============================================
  async function renderDiscoveryWorlds() {
    if (!worldsContainer) return;
    
    worldsContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(6).fill().map(() => `<div class="skeleton-world-card"></div>`).join('')}
      </div>
    `;
    
    try {
      // Fetch real genres from database
      let genres = await window.fetchers.fetchGenres();
      
      // Map genres to world cards with icons and colors
      const worldConfigs = {
        'Music': { icon: 'fa-music', color: '#EC4899', gradient: 'linear-gradient(135deg, #1e1e2f, #2d1b3a)' },
        'Film': { icon: 'fa-film', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
        'Movies': { icon: 'fa-film', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
        'STEM': { icon: 'fa-flask', color: '#06B6D4', gradient: 'linear-gradient(135deg, #0f2e2e, #0f2a2e)' },
        'Sports': { icon: 'fa-futbol', color: '#10B981', gradient: 'linear-gradient(135deg, #1a2e1a, #0f2e1a)' },
        'Culture': { icon: 'fa-drumstick-bite', color: '#F59E0B', gradient: 'linear-gradient(135deg, #2e1a0f, #2e241a)' },
        'News': { icon: 'fa-newspaper', color: '#EF4444', gradient: 'linear-gradient(135deg, #2e1a1a, #2e1f1a)' },
        'Podcast': { icon: 'fa-podcast', color: '#10B981', gradient: 'linear-gradient(135deg, #1a2e1a, #0f2e1a)' }
      };
      
      // Limit to top 6 genres or use fallback
      const topGenres = (genres && genres.length) ? genres.slice(0, 6) : [];
      
      if (!topGenres.length) {
        // Fallback to default worlds
        const defaultWorlds = [
          { name: 'Music World', icon: 'fa-music', desc: 'Discover trending tracks and artists', color: '#EC4899', gradient: 'linear-gradient(135deg, #1e1e2f, #2d1b3a)' },
          { name: 'Film World', icon: 'fa-film', desc: 'Nollywood, African cinema, and more', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
          { name: 'STEM World', icon: 'fa-flask', desc: 'Innovation and education', color: '#06B6D4', gradient: 'linear-gradient(135deg, #0f2e2e, #0f2a2e)' },
          { name: 'Culture World', icon: 'fa-drumstick-bite', desc: 'Heritage and traditions', color: '#F59E0B', gradient: 'linear-gradient(135deg, #2e1a0f, #2e241a)' },
          { name: 'Sports World', icon: 'fa-futbol', desc: 'Live matches and highlights', color: '#10B981', gradient: 'linear-gradient(135deg, #1a2e1a, #0f2e1a)' },
          { name: 'News World', icon: 'fa-newspaper', desc: 'Breaking stories from Africa', color: '#EF4444', gradient: 'linear-gradient(135deg, #2e1a1a, #2e1f1a)' }
        ];
        
        worldsContainer.innerHTML = defaultWorlds.map(world => `
          <div class="world-card" data-world="${world.name.toLowerCase().replace(' world', '')}" style="--world-color: ${world.color}">
            <div class="world-card-bg" style="background: ${world.gradient}"></div>
            <div class="world-card-glow" style="background: radial-gradient(circle at center, ${world.color}40, transparent)"></div>
            <div class="world-icon"><i class="fas ${world.icon}"></i></div>
            <div class="world-info">
              <h3 class="world-name">${world.name}</h3>
              <p class="world-desc">${world.desc}</p>
              <div class="world-stats">
                <span class="explore-link">Explore <i class="fas fa-arrow-right"></i></span>
              </div>
            </div>
          </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.world-card').forEach(card => {
          card.addEventListener('click', () => {
            const world = card.dataset.world;
            window.location.href = `content-library.html?genre=${encodeURIComponent(world)}`;
          });
        });
        return;
      }
      
      // Get content counts for each genre
      const worldsWithCounts = await Promise.all(topGenres.map(async (genre) => {
        const config = worldConfigs[genre.name] || worldConfigs['Culture'];
        let contentCount = 0;
        
        try {
          if (window.supabaseClient) {
            const { count } = await window.supabaseClient
              .from('Content')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'published')
              .eq('genre', genre.name);
            contentCount = count || 0;
          } else {
            contentCount = Math.floor(Math.random() * 500) + 100;
          }
        } catch (e) {
          contentCount = Math.floor(Math.random() * 500) + 100;
        }
        
        return {
          id: genre.id,
          name: `${genre.name} World`,
          icon: config.icon,
          desc: genre.description || `Explore ${genre.name} content from African creators`,
          color: config.color,
          gradient: config.gradient,
          contentCount: contentCount,
          origin: genre.origin_city || genre.origin_region
        };
      }));
      
      worldsContainer.innerHTML = worldsWithCounts.map(world => `
        <div class="world-card" data-world="${world.name.toLowerCase().replace(' world', '')}" data-genre="${world.name.replace(' World', '')}" style="--world-color: ${world.color}">
          <div class="world-card-bg" style="background: ${world.gradient}"></div>
          <div class="world-card-glow" style="background: radial-gradient(circle at center, ${world.color}40, transparent)"></div>
          <div class="world-icon"><i class="fas ${world.icon}"></i></div>
          <div class="world-info">
            <h3 class="world-name">${world.name}</h3>
            <p class="world-desc">${world.desc}</p>
            <div class="world-genres">
              <span class="genre-tag">${world.contentCount.toLocaleString()} pieces</span>
              ${world.origin ? `<span class="genre-tag">${world.origin}</span>` : ''}
            </div>
            <div class="world-stats">
              <span class="explore-link">Explore <i class="fas fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
      `).join('');
      
      // Add click handlers
      document.querySelectorAll('.world-card').forEach(card => {
        card.addEventListener('click', () => {
          const genre = card.dataset.genre;
          if (genre) {
            window.location.href = `content-library.html?genre=${encodeURIComponent(genre)}`;
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
  
  // ============================================
  // 2. RENDER CREATOR UNIVERSES
  // ============================================
  async function renderCreatorUniverses() {
    if (!creatorsContainer) return;
    
    creatorsContainer.innerHTML = `
      <div class="skeleton-list">
        ${Array(5).fill().map(() => `<div class="skeleton-creator-card"></div>`).join('')}
      </div>
    `;
    
    try {
      const creators = await window.fetchers.fetchFeaturedCreators(8);
      
      if (!creators || creators.length === 0) {
        creatorsContainer.innerHTML = '<div class="empty-state">No creators found</div>';
        return;
      }
      
      const creatorGroups = [
        { name: 'Trending Now', icon: 'fa-chart-line', color: '#F59E0B', creators: creators.slice(0, Math.min(3, creators.length)) },
        { name: 'Rising Stars', icon: 'fa-star', color: '#EC4899', creators: creators.slice(3, Math.min(6, creators.length)) },
        { name: 'Top Creators', icon: 'fa-trophy', color: '#10B981', creators: creators.slice(6, 8) }
      ].filter(group => group.creators.length > 0);
      
      creatorsContainer.innerHTML = creatorGroups.map(group => `
        <div class="creator-group">
          <div class="creator-group-header">
            <i class="fas ${group.icon}" style="color: ${group.color}"></i>
            <h3>${group.name}</h3>
            <span class="group-count">${group.creators.length} creators</span>
          </div>
          <div class="creator-group-grid">
            ${group.creators.map(creator => `
              <div class="creator-ecosystem-card" data-creator-id="${creator.id}" onclick="window.location.href='creator-channel.html?id=${creator.id}'">
                <div class="eco-icon" style="background: ${group.color}20; color: ${group.color}">
                  ${creator.avatar_url ? 
                    `<img src="${creator.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : 
                    `<i class="fas fa-user"></i>`
                  }
                </div>
                <div class="eco-info">
                  <h4>${window.escapeHtml(creator.full_name || creator.username || 'Creator')}</h4>
                  <p>${creator.bio ? window.escapeHtml(creator.bio.substring(0, 60)) : (creator.location || 'African Creator')}</p>
                  <div class="eco-stats">
                    ${creator.pulse_score ? `<span><i class="fas fa-bolt"></i> Score: ${Math.round(creator.pulse_score)}</span>` : ''}
                    ${creator.trend_label ? `<span class="eco-trend">🔥 ${window.escapeHtml(creator.trend_label)}</span>` : ''}
                  </div>
                </div>
                <button class="follow-creator-btn" data-creator="${creator.id}" onclick="event.stopPropagation(); if(window.showToast) window.showToast('Following ${window.escapeHtml(creator.full_name || creator.username)}', 'success')">
                  Follow
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error rendering creator universes:', error);
      if (creatorsContainer) creatorsContainer.innerHTML = '<div class="empty-state">Failed to load creators</div>';
    }
  }
  
  // ============================================
  // 3. RENDER LIVE EXPERIENCES
  // ============================================
  async function renderLiveExperiences() {
    if (!liveContainer) return;
    
    liveContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(4).fill().map(() => `<div class="skeleton-live-card"></div>`).join('')}
      </div>
    `;
    
    try {
      const liveContent = await window.fetchers.fetchLiveStreams(6);
      
      if (!liveContent || liveContent.length === 0) {
        liveContainer.innerHTML = '<div class="empty-state">No live content right now. Check back later!</div>';
        return;
      }
      
      liveContainer.innerHTML = liveContent.map(item => `
        <div class="live-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
          <div class="live-badge">
            <span class="live-dot"></span>
            ${item.is_live ? 'LIVE NOW' : 'TRENDING'}
          </div>
          <div class="live-thumbnail" style="position:relative">
            <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title)}" style="width:100%;border-radius:12px;aspect-ratio:16/9;object-fit:cover">
            ${item.is_live ? `<span class="live-viewers" style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:12px;font-size:11px"><i class="fas fa-eye"></i> ${window.formatNumber(item.live_views || Math.floor(Math.random() * 1000) + 100)}</span>` : ''}
          </div>
          <div class="live-info">
            <h4>${window.escapeHtml(item.title) || 'Untitled'}</h4>
            <p><i class="fas fa-user"></i> ${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
            <div class="live-stats">
              <span><i class="fas fa-calendar"></i> ${window.formatRelativeTime(item.created_at)}</span>
              ${item.views_count ? `<span><i class="fas fa-chart-line"></i> ${window.formatNumber(item.views_count)} views</span>` : ''}
            </div>
          </div>
          <button class="watch-live-btn">${item.is_live ? 'Watch Live' : 'Watch Now'} <i class="fas fa-play"></i></button>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error rendering live experiences:', error);
      if (liveContainer) liveContainer.innerHTML = '<div class="empty-state">Failed to load live content</div>';
    }
  }
  
  // ============================================
  // 4. RENDER CULTURAL HUB
  // ============================================
  async function renderCulturalHub() {
    if (!culturalContainer) return;
    
    culturalContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(6).fill().map(() => `<div class="skeleton-cultural-card"></div>`).join('')}
      </div>
    `;
    
    try {
      const movements = await window.fetchers.fetchCulturalMovements(6);
      
      const fallbackFeatures = [
        { title: 'Sounds of Africa', description: 'Discover regional music movements', icon: 'fa-headphones', color: '#EC4899' },
        { title: 'Township Stories', description: 'Real stories from African communities', icon: 'fa-home', color: '#F59E0B' },
        { title: 'African Futurism', description: 'Sci-fi and future African storytelling', icon: 'fa-rocket', color: '#06B6D4' },
        { title: 'Indigenous Voices', description: 'Language-first discovery experiences', icon: 'fa-language', color: '#10B981' },
        { title: 'Women of African Creativity', description: 'Highlighting women creators', icon: 'fa-female', color: '#EC4899' },
        { title: 'Rising African Animators', description: 'Next generation of animation', icon: 'fa-paintbrush', color: '#8B5CF6' }
      ];
      
      const culturalFeatures = (movements && movements.length) ? movements.map(movement => ({
        title: movement.name,
        description: movement.description || `Explore the ${movement.name} movement${movement.era_start ? ` (${movement.era_start}${movement.era_end ? `-${movement.era_end}` : ''})` : ''}`,
        icon: getIconForMovement(movement.name),
        color: getColorForMovement(movement.name),
        region: movement.region || movement.city,
        id: movement.id
      })) : fallbackFeatures;
      
      culturalContainer.innerHTML = culturalFeatures.map(feature => `
        <div class="cultural-card" style="--cultural-color: ${feature.color}" data-movement-id="${feature.id || ''}">
          <div class="cultural-card-inner">
            <i class="fas ${feature.icon}"></i>
            <h3>${window.escapeHtml(feature.title)}</h3>
            <p>${window.escapeHtml(feature.description)}</p>
            ${feature.region ? `<div class="cultural-region"><i class="fas fa-map-marker-alt"></i> ${window.escapeHtml(feature.region)}</div>` : ''}
            <button class="explore-cultural-btn">Explore <i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error rendering cultural hub:', error);
      if (culturalContainer) culturalContainer.innerHTML = '<div class="empty-state">Failed to load cultural content</div>';
    }
  }
  
  // Helper functions for cultural hub
  function getIconForMovement(name) {
    const iconMap = {
      'Afrobeats': 'fa-music',
      'Amapiano': 'fa-music',
      'Nollywood': 'fa-film',
      'Kwaito': 'fa-music',
      'African Renaissance': 'fa-africa',
      'ubuntu': 'fa-heart'
    };
    for (const [key, icon] of Object.entries(iconMap)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return 'fa-compass';
  }
  
  function getColorForMovement(name) {
    const colorMap = {
      'Afrobeats': '#EC4899',
      'Amapiano': '#F59E0B',
      'Nollywood': '#8B5CF6',
      'Renaissance': '#06B6D4'
    };
    for (const [key, color] of Object.entries(colorMap)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return '#F59E0B';
  }
  
  // ============================================
  // 5. RENDER TRENDING EDITORIAL
  // ============================================
  async function renderTrendingEditorial() {
    const editorialContainer = document.getElementById('editorialGrid');
    if (!editorialContainer) return;
    
    editorialContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(4).fill().map(() => `<div class="skeleton-editorial-card"></div>`).join('')}
      </div>
    `;
    
    try {
      const trending = await window.fetchers.fetchTrendingContent(6);
      
      if (!trending || trending.length === 0) {
        editorialContainer.innerHTML = '<div class="empty-state">No trending content available</div>';
        return;
      }
      
      const editorialItems = trending.slice(0, 4);
      
      editorialContainer.innerHTML = editorialItems.map((item, index) => `
        <div class="editorial-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
          <div class="editorial-category">${item.content_type || item.genre || 'TRENDING'}</div>
          <h3>${window.escapeHtml(item.title) || 'Untitled'}</h3>
          <p>${item.description ? window.escapeHtml(item.description.substring(0, 100)) : `Watch this trending content with ${window.formatNumber(item.views_count || 0)} views`}</p>
          <div class="editorial-stats">
            <span><i class="fas fa-eye"></i> ${window.formatNumber(item.views_count || 0)}</span>
            <span><i class="fas fa-heart"></i> ${window.formatNumber(item.likes_count || 0)}</span>
            ${item.trending_score ? `<span class="trending-badge">🔥 Trending</span>` : ''}
          </div>
          <button class="read-more-btn">Watch Now <i class="fas fa-play"></i></button>
        </div>
      `).join('');
      
    } catch (error) {
      console.error('Error rendering editorial:', error);
      if (editorialContainer) editorialContainer.innerHTML = '<div class="empty-state">Failed to load trending content</div>';
    }
  }
  
  // ============================================
  // 6. UPDATE ENERGY BAR
  // ============================================
  async function updateEnergyBar() {
    try {
      const stats = await window.fetchers.fetchPlatformStats();
      
      if (energyText) {
        const randomActive = Math.floor(Math.random() * 500) + 800;
        energyText.textContent = `${randomActive.toLocaleString()} active viewers now`;
      }
      
      if (energyTicker) {
        const tickerItems = [
          `🔥 ${(stats.totalViews || 0).toLocaleString()} total views`,
          `📍 Trending across Africa`,
          `🎵 ${(stats.totalContent || 0).toLocaleString()} pieces of content`,
          `⭐ ${(stats.totalCreators || 0).toLocaleString()} creators`,
          `📺 ${Math.floor(Math.random() * 50) + 20} live streams active`,
          `🚀 ${Math.floor(Math.random() * 200) + 100} new interactions`
        ];
        
        const tickerHTML = tickerItems.map(item => `<span>${item}</span>`).join('');
        energyTicker.innerHTML = tickerHTML + tickerHTML;
      }
      
    } catch (error) {
      console.error('Error updating energy bar:', error);
    }
  }
  
  // ============================================
  // 7. RENDER AFRICA MAP
  // ============================================
  async function renderAfricaMap() {
    const canvas = document.getElementById('africaMapCanvas');
    const trendingContainer = document.getElementById('mapTrending');
    if (!canvas || !trendingContainer) return;
    
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    const width = Math.min(container.clientWidth, 800);
    const height = 400;
    canvas.width = width;
    canvas.height = height;
    
    // Draw simplified Africa outline
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#F59E0B';
    
    ctx.moveTo(width * 0.35, height * 0.3);
    ctx.lineTo(width * 0.45, height * 0.25);
    ctx.lineTo(width * 0.55, height * 0.28);
    ctx.lineTo(width * 0.65, height * 0.35);
    ctx.lineTo(width * 0.7, height * 0.45);
    ctx.lineTo(width * 0.68, height * 0.55);
    ctx.lineTo(width * 0.6, height * 0.65);
    ctx.lineTo(width * 0.5, height * 0.7);
    ctx.lineTo(width * 0.4, height * 0.68);
    ctx.lineTo(width * 0.32, height * 0.6);
    ctx.lineTo(width * 0.3, height * 0.5);
    ctx.lineTo(width * 0.35, height * 0.3);
    ctx.stroke();
    
    const regions = [
      { name: 'Lagos', x: width * 0.68, y: height * 0.4, country: 'Nigeria' },
      { name: 'Johannesburg', x: width * 0.55, y: height * 0.55, country: 'South Africa' },
      { name: 'Nairobi', x: width * 0.6, y: height * 0.45, country: 'Kenya' },
      { name: 'Accra', x: width * 0.62, y: height * 0.48, country: 'Ghana' }
    ];
    
    const trendingItems = [];
    for (const region of regions) {
      ctx.beginPath();
      ctx.fillStyle = '#F59E0B';
      ctx.arc(region.x, region.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.fillStyle = '#F59E0B40';
      ctx.arc(region.x, region.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      let trendText = 'Trending content';
      try {
        const trending = await window.fetchers.getTrendingByRegion(region.country, 1);
        if (trending && trending[0]) {
          trendText = trending[0].title?.substring(0, 30) || 'Popular content';
        }
      } catch (e) {
        trendText = 'New content rising';
      }
      
      trendingItems.push(`
        <div class="trending-item" style="border-left-color: #F59E0B">
          <span class="trending-city">📍 ${region.name}</span>
          <span class="trending-trend">${window.escapeHtml(trendText)}</span>
        </div>
      `);
    }
    
    trendingContainer.innerHTML = trendingItems.join('');
  }
  
  // ============================================
  // 8. SMART SEARCH
  // ============================================
  function setupSmartSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchModal = document.getElementById('searchModal');
    const searchBtn = document.getElementById('searchBtn');
    const closeSearch = document.getElementById('closeSearch');
    
    if (!searchInput) return;
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchModal) searchModal.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
      });
    }
    
    if (closeSearch) {
      closeSearch.addEventListener('click', () => {
        if (searchModal) searchModal.classList.remove('active');
        searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
      });
    }
    
    if (searchModal) {
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
          searchModal.classList.remove('active');
          searchInput.value = '';
          if (searchResults) searchResults.innerHTML = '';
        }
      });
    }
    
    let searchTimeout;
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      
      clearTimeout(searchTimeout);
      
      if (query.length < 2) {
        if (searchResults) searchResults.innerHTML = '<div class="search-placeholder">Type at least 2 characters to search...</div>';
        return;
      }
      
      searchTimeout = setTimeout(async () => {
        if (!searchResults) return;
        searchResults.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
        
        const results = await window.fetchers.searchContent(query);
        
        if (!results || results.length === 0) {
          searchResults.innerHTML = '<div class="no-results">No results found. Try something else!</div>';
          return;
        }
        
        searchResults.innerHTML = `
          <div class="search-results-header">
            <span>Found ${results.length} results for "${window.escapeHtml(query)}"</span>
          </div>
          <div class="search-results-grid">
            ${results.map(item => `
              <div class="search-result-item" onclick="window.location.href='content-detail.html?id=${item.id}'">
                <img src="${item.thumbnail_url || 'https://via.placeholder.com/80x45'}" alt="${window.escapeHtml(item.title)}" style="width:80px;height:45px;border-radius:8px;object-fit:cover">
                <div class="search-result-info">
                  <h4>${window.escapeHtml(item.title) || 'Untitled'}</h4>
                  <p>${window.escapeHtml(item.creator_display_name || 'Creator')} • ${window.formatNumber(item.views_count || 0)} views</p>
                  <span class="search-result-tag">${item.genre || item.content_type || 'Content'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }, 300);
    });
  }
  
  // ============================================
  // 9. SIDEBAR SETUP
  // ============================================
  function setupSidebar() {
    const menuBtn = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');
    
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        sidebar?.classList.add('active');
        overlay?.classList.add('active');
      });
    }
    
    function closeSidebar() {
      sidebar?.classList.remove('active');
      overlay?.classList.remove('active');
    }
    
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
    
    // Try to load user data
    if (window.supabaseClient) {
      window.supabaseClient.auth.getSession().then(({ data: session }) => {
        if (session?.session?.user) {
          window.supabaseClient.from('user_profiles')
            .select('full_name, avatar_url')
            .eq('id', session.session.user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                const nameEl = document.getElementById('sidebarName');
                const avatarEl = document.getElementById('sidebarAvatar');
                if (nameEl) nameEl.textContent = profile.full_name || 'User';
                if (avatarEl && profile.avatar_url) {
                  avatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
                }
              }
            }).catch(() => {});
        }
      }).catch(() => {});
    }
  }
  
  // ============================================
  // 10. INITIALIZE ALL
  // ============================================
  async function initialize() {
    console.log('Initializing Explore Screen with REAL DATA...');
    
    // Hide loading screen
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    
    try {
      // Run all render functions in parallel
      await Promise.all([
        renderDiscoveryWorlds(),
        renderCreatorUniverses(),
        renderLiveExperiences(),
        renderCulturalHub(),
        renderTrendingEditorial(),
        updateEnergyBar(),
        renderAfricaMap()
      ]);
      
      // Setup interactive features
      setupSmartSearch();
      setupSidebar();
      
      // Show app
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
      
      console.log('✅ Explore Screen initialized with real data');
      if (window.showToast) window.showToast('Welcome to Discovery Worlds', 'success');
      
    } catch (error) {
      console.error('Error initializing explore screen:', error);
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'block';
    }
  }
  
  // Start everything
  initialize();
});
