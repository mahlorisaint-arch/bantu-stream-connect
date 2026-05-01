/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN FEATURES v3.0
 * Discovery Worlds Architecture - Complete Implementation
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎬 Initializing Discovery Worlds...');

  // ============================================
  // 1. RENDER DISCOVERY WORLDS
  // ============================================
  function renderDiscoveryWorlds() {
    const container = document.getElementById('worldsContainer');
    if (!container) return;

    container.innerHTML = window.discoveryWorlds.map(world => `
      <div class="world-card" data-world="${world.id}" style="--world-color: ${world.color}">
        <div class="world-card-bg" style="background: ${world.gradient}"></div>
        <div class="world-card-glow" style="background: radial-gradient(circle at center, ${world.color}40, transparent)"></div>
        <div class="world-icon"><i class="fas ${world.icon}"></i></div>
        <div class="world-info">
          <h3 class="world-name">${world.name}</h3>
          <p class="world-desc">${world.description}</p>
          <div class="world-genres">
            ${world.genres.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join('')}
          </div>
          <div class="world-stats">
            <span class="active-count"><i class="fas fa-circle" style="color: ${world.color}"></i> ${world.activeCount} active</span>
            <span class="explore-link">Explore <i class="fas fa-arrow-right"></i></span>
          </div>
        </div>
      </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.world-card').forEach(card => {
      card.addEventListener('click', () => {
        const worldId = card.dataset.world;
        window.showToast(`Entering ${worldId} world...`, 'info');
        // Navigate to world view
      });
    });
  }

  // ============================================
  // 2. RENDER JOURNEY OPTIONS
  // ============================================
  function renderJourneyOptions() {
    // Mood options
    const moodContainer = document.getElementById('moodOptions');
    if (moodContainer) {
      moodContainer.innerHTML = window.journeyOptions.moods.map(mood => `
        <button class="journey-option" data-type="mood" data-value="${mood.id}" style="--option-color: ${mood.color}">
          <i class="fas ${mood.icon}"></i>
          <span>${mood.name}</span>
        </button>
      `).join('');
    }

    // Region options
    const regionContainer = document.getElementById('regionOptions');
    if (regionContainer) {
      regionContainer.innerHTML = window.journeyOptions.regions.map(region => `
        <button class="journey-option" data-type="region" data-value="${region.id}">
          <span class="region-flag">${region.flag}</span>
          <span>${region.name}</span>
        </button>
      `).join('');
    }

    // Language options
    const langContainer = document.getElementById('languageOptions');
    if (langContainer) {
      langContainer.innerHTML = window.journeyOptions.languages.map(lang => `
        <button class="journey-option" data-type="language" data-value="${lang.id}">
          <i class="fas fa-language"></i>
          <span>${lang.native}</span>
          <small>${lang.name}</small>
        </button>
      `).join('');
    }

    // Format options
    const formatContainer = document.getElementById('formatOptions');
    if (formatContainer) {
      formatContainer.innerHTML = window.journeyOptions.formats.map(format => `
        <button class="journey-option" data-type="format" data-value="${format.id}">
          <i class="fas ${format.icon}"></i>
          <span>${format.name}</span>
        </button>
      `).join('');
    }

    // Add click handlers for journey options
    document.querySelectorAll('.journey-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const type = opt.dataset.type;
        const value = opt.dataset.value;
        
        // Remove active class from siblings
        opt.parentElement.querySelectorAll('.journey-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        
        // Update state
        window.appState.journeySelections[type] = value;
      });
    });
  }

  // ============================================
  // 3. GENERATE JOURNEY RESULTS
  // ============================================
  function generateJourneyResults() {
    const selections = window.appState.journeySelections;
    const hasAllSelections = selections.mood && selections.region && selections.language && selections.format;
    
    if (!hasAllSelections) {
      window.showToast('Please complete all 4 steps to generate your discovery world!', 'warning');
      return;
    }

    const resultsContainer = document.getElementById('journeyResults');
    if (!resultsContainer) return;

    // Get selected option names
    const mood = window.journeyOptions.moods.find(m => m.id === selections.mood);
    const region = window.journeyOptions.regions.find(r => r.id === selections.region);
    const language = window.journeyOptions.languages.find(l => l.id === selections.language);
    const format = window.journeyOptions.formats.find(f => f.id === selections.format);

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div class="journey-result-card">
        <div class="result-header">
          <i class="fas fa-magic"></i>
          <h3>Your Personalized Discovery World</h3>
        </div>
        <div class="result-badges">
          <span class="result-badge" style="background: ${mood?.color || '#F59E0B'}">${mood?.name || 'Inspirational'}</span>
          <span class="result-badge">${region?.flag || '🌍'} ${region?.name || 'Africa'}</span>
          <span class="result-badge">${language?.native || 'English'}</span>
          <span class="result-badge">${format?.name || 'Content'}</span>
        </div>
        <div class="result-content">
          <p>Based on your selections, we've curated a unique experience for you:</p>
          <div class="result-recommendations" id="resultRecommendations">
            <div class="skeleton-recommendation">Loading your personalized world...</div>
          </div>
        </div>
        <button class="explore-result-btn" onclick="window.location.href='content-library.html'">
          Enter Your World <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    `;

    // Simulate loading recommendations
    setTimeout(() => {
      const recContainer = document.getElementById('resultRecommendations');
      if (recContainer) {
        recContainer.innerHTML = `
          <div class="rec-item">
            <i class="fas fa-headphones"></i>
            <div>
              <strong>Trending in ${region?.name || 'Africa'}</strong>
              <p>Top ${format?.name || 'content'} creators speaking ${language?.native || 'English'}</p>
            </div>
          </div>
          <div class="rec-item">
            <i class="fas fa-star"></i>
            <div>
              <strong>${mood?.name || 'Inspiring'} Picks</strong>
              <p>Hand-picked ${format?.name || 'content'} for your ${mood?.name?.toLowerCase() || 'journey'}</p>
            </div>
          </div>
          <div class="rec-item">
            <i class="fas fa-users"></i>
            <div>
              <strong>Community Favorites</strong>
              <p>What others with your taste are enjoying</p>
            </div>
          </div>
        `;
      }
    }, 1500);

    window.showToast('Discovery world generated!', 'success');
  }

  // ============================================
  // 4. RENDER CULTURAL HUB
  // ============================================
  function renderCulturalHub() {
    const container = document.getElementById('culturalGrid');
    if (!container) return;

    container.innerHTML = window.culturalFeatures.map(feature => `
      <div class="cultural-card" style="--cultural-color: ${feature.color}">
        <div class="cultural-card-inner">
          <i class="fas ${feature.icon}"></i>
          <h3>${feature.title}</h3>
          <p>${feature.description}</p>
          <button class="explore-cultural-btn">Explore <i class="fas fa-arrow-right"></i></button>
        </div>
      </div>
    `).join('');
  }

  // ============================================
  // 5. RENDER CREATOR ECOSYSTEMS
  // ============================================
  function renderCreatorEcosystems() {
    const container = document.getElementById('creatorEcosystems');
    if (!container) return;

    // Simulated creator data
    const creators = [
      { name: 'Thabo Mbeki Creatives', category: 'Filmmakers', members: '12.4K', icon: 'fa-video', color: '#8B5CF6' },
      { name: 'AfroTech Voices', category: 'Tech & Innovation', members: '8.2K', icon: 'fa-microchip', color: '#06B6D4' },
      { name: 'Women in Podcasting', category: 'Audio Storytelling', members: '5.7K', icon: 'fa-podcast', color: '#EC4899' },
      { name: 'Next-Gen Animators', category: 'Animation', members: '3.9K', icon: 'fa-dragon', color: '#10B981' },
      { name: 'Indie Music Collective', category: 'Music Production', members: '15.2K', icon: 'fa-music', color: '#F59E0B' }
    ];

    container.innerHTML = creators.map(creator => `
      <div class="creator-ecosystem-card">
        <div class="eco-icon" style="background: ${creator.color}20; color: ${creator.color}">
          <i class="fas ${creator.icon}"></i>
        </div>
        <div class="eco-info">
          <h4>${creator.name}</h4>
          <p>${creator.category}</p>
          <div class="eco-stats">
            <span><i class="fas fa-users"></i> ${creator.members} members</span>
            <span class="eco-live"><i class="fas fa-circle"></i> Live now</span>
          </div>
        </div>
        <button class="join-eco-btn">Join</button>
      </div>
    `).join('');
  }

  // ============================================
  // 6. RENDER LIVE GRID
  // ============================================
  function renderLiveGrid() {
    const container = document.getElementById('liveGrid');
    if (!container) return;

    const liveItems = [
      { title: 'Amapiano Sunday Session', creator: 'DJ Maphorisa', viewers: '2.3K', category: 'Music' },
      { title: 'Film Discussion: "The Ghost and the House of Truth"', creator: 'Nollywood Hub', viewers: '856', category: 'Film' },
      { title: 'Tech Talk: AI in Africa', creator: 'AfroTech Live', viewers: '1.2K', category: 'Tech' },
      { title: 'Language Learning: isiZulu 101', creator: 'Learn Zulu', viewers: '432', category: 'Education' }
    ];

    container.innerHTML = liveItems.map(item => `
      <div class="live-card">
        <div class="live-badge"><span class="live-dot"></span> LIVE</div>
        <div class="live-info">
          <h4>${item.title}</h4>
          <p><i class="fas fa-user"></i> ${item.creator}</p>
          <div class="live-stats">
            <span><i class="fas fa-eye"></i> ${item.viewers} watching</span>
            <span><i class="fas fa-tag"></i> ${item.category}</span>
          </div>
        </div>
        <button class="watch-live-btn">Watch Live <i class="fas fa-play"></i></button>
      </div>
    `).join('');
  }

  // ============================================
  // 7. RENDER EDITORIAL GRID
  // ============================================
  function renderEditorialGrid() {
    const container = document.getElementById('editorialGrid');
    if (!container) return;

    const editorials = [
      { title: 'Voices Changing Africa', subtitle: 'Meet 10 creators redefining the continent', image: null, category: 'People' },
      { title: 'Hidden Gems This Week', subtitle: 'Underrated content you need to see', image: null, category: 'Discovery' },
      { title: 'Future African Legends', subtitle: 'The next generation of superstars', image: null, category: 'Rising Stars' },
      { title: 'The New Wave of African Creativity', subtitle: 'How Gen Z is reshaping culture', image: null, category: 'Culture' }
    ];

    container.innerHTML = editorials.map(ed => `
      <div class="editorial-card">
        <div class="editorial-category">${ed.category}</div>
        <h3>${ed.title}</h3>
        <p>${ed.subtitle}</p>
        <button class="read-more-btn">Read More <i class="fas fa-arrow-right"></i></button>
      </div>
    `).join('');
  }

  // ============================================
  // 8. SMART SEARCH
  // ============================================
  function renderSmartSearch() {
    const categoriesContainer = document.getElementById('smartSearchCategories');
    const suggestionsContainer = document.getElementById('smartSearchSuggestions');
    
    if (categoriesContainer) {
      const categories = ['Creators', 'Cultures', 'Languages', 'Podcasts', 'Movements', 'Live Spaces', 'Films', 'Trends'];
      categoriesContainer.innerHTML = categories.map(cat => `
        <button class="search-category" data-cat="${cat.toLowerCase()}">${cat}</button>
      `).join('');
    }

    if (suggestionsContainer) {
      const suggestions = ['Trending in South Africa', 'Zulu creators', 'African sci-fi films', 'Live Amapiano sessions', 'Kenyan storytellers'];
      suggestionsContainer.innerHTML = suggestions.map(sug => `
        <div class="search-suggestion" data-query="${sug}">
          <i class="fas fa-search"></i>
          <span>${sug}</span>
        </div>
      `).join('');
    }
  }

  // ============================================
  // 9. RENDER AFRICA MAP
  // ============================================
  function renderAfricaMap() {
    const canvas = document.getElementById('africaMapCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Draw simplified African map silhouette
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw glowing map outline
    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#F59E0B';
    
    // Simplified Africa outline
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

    // Add hotspots
    const hotspots = [
      { x: width * 0.68, y: height * 0.4, city: 'Lagos', trend: 'Afrobeats exploding', color: '#F59E0B' },
      { x: width * 0.55, y: height * 0.55, city: 'Johannesburg', trend: 'Amapiano rising', color: '#EC4899' },
      { x: width * 0.6, y: height * 0.45, city: 'Nairobi', trend: 'Tech creators', color: '#06B6D4' },
      { x: width * 0.4, y: height * 0.6, city: 'Cape Town', trend: 'Film discussions', color: '#10B981' }
    ];

    const trendingContainer = document.getElementById('mapTrending');
    if (trendingContainer) {
      trendingContainer.innerHTML = hotspots.map(hotspot => `
        <div class="trending-item" style="border-left-color: ${hotspot.color}">
          <span class="trending-city">📍 ${hotspot.city}</span>
          <span class="trending-trend">${hotspot.trend}</span>
        </div>
      `).join('');
    }
  }

  // ============================================
  // 10. ROTATING TEXT ANIMATION
  // ============================================
  function initRotatingText() {
    const container = document.getElementById('rotatingWords');
    if (!container) return;
    
    const spans = container.querySelectorAll('span');
    let currentIndex = 0;
    
    function showNext() {
      spans.forEach((span, i) => {
        span.style.display = i === currentIndex ? 'inline-block' : 'none';
        span.style.animation = 'fadeInUp 0.5s ease';
      });
      currentIndex = (currentIndex + 1) % spans.length;
      setTimeout(showNext, 4000);
    }
    
    showNext();
  }

  // ============================================
  // 11. ENERGY TICKER ANIMATION
  // ============================================
  function initEnergyTicker() {
    const ticker = document.getElementById('energyTicker');
    if (!ticker) return;
    
    // Clone content for seamless loop
    const content = ticker.innerHTML;
    ticker.innerHTML = content + content;
    
    // Animation handled by CSS
  }

  // ============================================
  // 12. SIDEBAR FUNCTIONALITY
  // ============================================
  function initSidebar() {
    const openBtn = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
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
  }

  // ============================================
  // 13. SEARCH FUNCTIONALITY
  // ============================================
  function initSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const modal = document.getElementById('searchModal');
    const closeBtn = document.getElementById('closeSearch');
    const input = document.getElementById('searchInput');

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        modal?.classList.add('active');
        input?.focus();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal?.classList.remove('active');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    if (input) {
      input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer && query.length > 1) {
          resultsContainer.innerHTML = `
            <div class="search-result-item">
              <i class="fas fa-search"></i>
              <span>Searching for "${window.escapeHtml(query)}"...</span>
            </div>
          `;
        }
      });
    }
  }

  // ============================================
  // 14. INITIALIZE ALL
  // ============================================
  function initialize() {
    renderDiscoveryWorlds();
    renderJourneyOptions();
    renderCulturalHub();
    renderCreatorEcosystems();
    renderLiveGrid();
    renderEditorialGrid();
    renderSmartSearch();
    renderAfricaMap();
    initRotatingText();
    initEnergyTicker();
    initSidebar();
    initSearch();

    // Journey generate button
    const generateBtn = document.getElementById('generateJourneyBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', generateJourneyResults);
    }

    // Hero buttons
    const exploreWorldsBtn = document.getElementById('exploreWorldsBtn');
    if (exploreWorldsBtn) {
      exploreWorldsBtn.addEventListener('click', () => {
        document.getElementById('worldsSection')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const startJourneyBtn = document.getElementById('startJourneyBtn');
    if (startJourneyBtn) {
      startJourneyBtn.addEventListener('click', () => {
        document.getElementById('journeySection')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const discoverCreatorsBtn = document.getElementById('discoverCreatorsBtn');
    if (discoverCreatorsBtn) {
      discoverCreatorsBtn.addEventListener('click', () => {
        document.getElementById('creatorEcosystems')?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const discoverAllBtn = document.getElementById('discoverAllBtn');
    if (discoverAllBtn) {
      discoverAllBtn.addEventListener('click', () => {
        window.showToast('Opening the full discovery universe...', 'info');
        setTimeout(() => {
          window.location.href = 'content-library.html';
        }, 1000);
      });
    }

    console.log('✅ Discovery Worlds fully initialized');
    window.showToast('Welcome to Discovery Worlds', 'success');
  }

  initialize();
});
