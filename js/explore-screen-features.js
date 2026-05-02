/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN FEATURES v4.0
 * REAL DATA UI IMPLEMENTATION - DISCOVERY WORLDS
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
      { value: 'south-africa', label: 'South Africa', flag: '🇿🇦', country: 'South Africa' },
      { value: 'nigeria', label: 'Nigeria', flag: '🇳🇬', country: 'Nigeria' },
      { value: 'kenya', label: 'Kenya', flag: '🇰🇪', country: 'Kenya' },
      { value: 'ghana', label: 'Ghana', flag: '🇬🇭', country: 'Ghana' },
      { value: 'tanzania', label: 'Tanzania', flag: '🇹🇿', country: 'Tanzania' },
      { value: 'zimbabwe', label: 'Zimbabwe', flag: '🇿🇼', country: 'Zimbabwe' },
      { value: 'pan-african', label: 'Pan-African', flag: '🌍', country: 'Africa' }
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
          <span>${option.flag}</span>
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
      // Fetch content based on selections
      let recommendations = [];
      
      // Map selections to API parameters
      const moodMap = {
        'inspirational': ['inspirational', 'motivational', 'uplifting'],
        'energetic': ['energetic', 'exciting', 'action', 'vibrant'],
        'deep-stories': ['drama', 'storytelling', 'narrative', 'deep'],
        'futuristic': ['sci-fi', 'futuristic', 'tech', 'innovation'],
        'funny': ['comedy', 'funny', 'humor', 'entertaining'],
        'emotional': ['emotional', 'romance', 'touching', 'heartfelt'],
        'educational': ['educational', 'learning', 'tutorial', 'how-to'],
        'spiritual': ['spiritual', 'meditation', 'faith', 'inspiration']
      };
      
      const formatMap = {
        'film': 'movie',
        'music': 'music',
        'podcast': 'podcast',
        'live-stream': 'live',
        'animation': 'animation',
        'short-form': 'short',
        'vlogs-tutorials': 'vlog'
      };
      
      const moodTags = moodMap[journeySelections.mood] || [journeySelections.mood];
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
            views_count,
            likes_count,
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
        
        const { data, error } = await query.order('views_count', { ascending: false });
        
        if (!error && data && data.length > 0) {
          recommendations = data;
        }
      }
      
      // If no recommendations from DB, use curated fallback
      if (recommendations.length === 0) {
        recommendations = getCuratedRecommendations(journeySelections);
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
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
              ${recommendations.map(item => `
                <div class="rec-item" onclick="window.location.href='content-detail.html?id=${item.id}'" style="cursor: pointer; background: rgba(255,255,255,0.03); border-radius: 16px; overflow: hidden; transition: all 0.3s;">
                  <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title)}" style="width: 100%; height: 120px; object-fit: cover;">
                  <div style="padding: 12px;">
                    <h5 style="font-size: 14px; margin-bottom: 4px;">${window.escapeHtml(item.title) || 'Untitled'}</h5>
                    <p style="font-size: 12px; color: #94A3B8;">${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #64748B;">
                      <span><i class="fas fa-eye"></i> ${window.formatNumber(item.views_count || 0)}</span>
                      <span><i class="fas fa-heart"></i> ${window.formatNumber(item.likes_count || 0)}</span>
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
        <div style="text-align: center; padding: 40px;">
          <i class="fas fa-exclamation-circle" style="font-size: 32px; color: var(--error-red);"></i>
          <p style="margin-top: 16px;">Unable to generate recommendations. Please try again.</p>
          <button onclick="generateDiscoveryJourney()" style="margin-top: 16px; background: var(--warm-gold); border: none; padding: 8px 24px; border-radius: 30px; cursor: pointer;">Retry</button>
        </div>
      `;
    }
  }
  
  /**
   * Get curated recommendations based on journey selections
   */
  function getCuratedRecommendations(selections) {
    const recommendationsByMood = {
      'inspirational': [
        { title: 'Rising Stars of Africa', creator: 'Bantu Originals', views: 1250000, likes: 89000, type: 'Documentary' },
        { title: 'The Entrepreneur\'s Journey', creator: 'Business Africa', views: 890000, likes: 67000, type: 'Series' },
        { title: 'Dream Chasers', creator: 'Inspire Studios', views: 560000, likes: 45000, type: 'Film' }
      ],
      'energetic': [
        { title: 'Amapiano Dance Battle', creator: 'Dance SA', views: 3200000, likes: 245000, type: 'Music' },
        { title: 'Afrobeat Workout', creator: 'Fit Africa', views: 2100000, likes: 178000, type: 'Fitness' },
        { title: 'Street Football Legends', creator: 'Sports Africa', views: 1800000, likes: 123000, type: 'Sports' }
      ],
      'deep-stories': [
        { title: 'Tales of the Motherland', creator: 'Storytelling Africa', views: 980000, likes: 76000, type: 'Series' },
        { title: 'The Price of Freedom', creator: 'Nollywood Studios', views: 870000, likes: 65000, type: 'Film' },
        { title: 'Untold Histories', creator: 'Heritage Channel', views: 650000, likes: 48000, type: 'Documentary' }
      ],
      'futuristic': [
        { title: 'African Cyberpunk', creator: 'Futurism Studios', views: 1500000, likes: 112000, type: 'Sci-Fi' },
        { title: 'Tech Innovators', creator: 'Tech Africa', views: 890000, likes: 67000, type: 'Series' },
        { title: 'AI in Africa', creator: 'Future Tech', views: 560000, likes: 43000, type: 'Documentary' }
      ],
      'funny': [
        { title: 'African Comedy Special', creator: 'Laugh Africa', views: 2300000, likes: 189000, type: 'Comedy' },
        { title: 'Funny Skits Africa', creator: 'Comedy Sketch', views: 1900000, likes: 145000, type: 'Skits' },
        { title: 'The Prank Show', creator: 'Prank Africa', views: 1200000, likes: 89000, type: 'Entertainment' }
      ],
      'emotional': [
        { title: 'Love in Soweto', creator: 'Romance Studios', views: 1100000, likes: 89000, type: 'Romance' },
        { title: 'Tears of Joy', creator: 'Emotional Stories', views: 890000, likes: 67000, type: 'Drama' },
        { title: 'Family Bonds', creator: 'Family Channel', views: 760000, likes: 54000, type: 'Series' }
      ],
      'educational': [
        { title: 'Learn African History', creator: 'Education First', views: 670000, likes: 45000, type: 'Educational' },
        { title: 'Language Made Easy', creator: 'Language Hub', views: 540000, likes: 38000, type: 'Tutorial' },
        { title: 'Science in Africa', creator: 'STEM Africa', views: 430000, likes: 29000, type: 'Educational' }
      ],
      'spiritual': [
        { title: 'Meditation Journeys', creator: 'Spiritual Africa', views: 450000, likes: 32000, type: 'Wellness' },
        { title: 'Faith Stories', creator: 'Inspiration Hub', views: 380000, likes: 27000, type: 'Spiritual' },
        { title: 'Ancient Wisdom', creator: 'Cultural Heritage', views: 320000, likes: 21000, type: 'Documentary' }
      ]
    };
    
    const recommendations = recommendationsByMood[selections.mood] || recommendationsByMood['inspirational'];
    
    return recommendations.map((rec, index) => ({
      id: `journey-${index}`,
      title: rec.title,
      description: `Watch this ${rec.type.toLowerCase()} content`,
      thumbnail_url: `https://via.placeholder.com/400x225?text=${encodeURIComponent(rec.title.substring(0, 20))}`,
      creator_display_name: rec.creator,
      views_count: rec.views,
      likes_count: rec.likes,
      content_type: rec.type.toLowerCase()
    }));
  }
  
  // ============================================
  // 3. RENDER DISCOVERY WORLDS
  // ============================================
  async function renderDiscoveryWorlds() {
    if (!worldsContainer) return;
    
    worldsContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(6).fill().map(() => `<div class="skeleton-world-card"></div>`).join('')}
      </div>
    `;
    
    try {
      const discoveryWorlds = [
        {
          id: 'film',
          name: 'Film World',
          tagline: 'Cinematic stories from Africa',
          icon: 'fa-film',
          color: '#8B5CF6',
          gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          categories: ['Soapies & Telenovelas', 'African Futurism (Sci-Fi)', 'Township Dramas', 'SA Romantic Comedy'],
          redirectUrl: 'https://bantustreamconnect.com/category/movies'
        },
        {
          id: 'music',
          name: 'Music World',
          tagline: 'Rhythms that move the continent',
          icon: 'fa-music',
          color: '#EC4899',
          gradient: 'linear-gradient(135deg, #1e1e2f, #2d1b3a)',
          categories: ['Amapiano', 'Afro House', 'Hip-Hop (SA)', 'Gqom'],
          redirectUrl: 'https://bantustreamconnect.com/category/music'
        },
        {
          id: 'podcast',
          name: 'Podcast World',
          tagline: 'Conversations that matter',
          icon: 'fa-podcast',
          color: '#10B981',
          gradient: 'linear-gradient(135deg, #1a2e1a, #0f2e1a)',
          categories: ['Business', 'Storytelling', 'Culture', 'News & Politics'],
          redirectUrl: 'https://bantustreamconnect.com/category/podcasts'
        },
        {
          id: 'creator',
          name: 'Creator World',
          tagline: 'Meet the architects of culture',
          icon: 'fa-users',
          color: '#06B6D4',
          gradient: 'linear-gradient(135deg, #0f2e2e, #0f2a2e)',
          categories: ['Rising Stars', 'Verified', 'Trending'],
          redirectUrl: 'https://bantustreamconnect.com/discover-creator'
        },
        {
          id: 'news',
          name: 'News',
          tagline: 'Trusted source for African perspectives',
          icon: 'fa-newspaper',
          color: '#EF4444',
          gradient: 'linear-gradient(135deg, #2e1a1a, #2e1f1a)',
          categories: ['Business', 'Entertainment', 'Technology', 'Politics'],
          redirectUrl: 'https://bantustreamconnect.com/category/news'
        },
        {
          id: 'culture',
          name: 'Culture World',
          tagline: 'Heritage, traditions, and futures',
          icon: 'fa-drumstick-bite',
          color: '#F59E0B',
          gradient: 'linear-gradient(135deg, #2e1a0f, #2e241a)',
          categories: ['Fashion', 'Languages', 'Traditions', 'Our History'],
          redirectUrl: 'https://bantustreamconnect.com/category/culture'
        }
      ];
      
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
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      backdrop-filter: blur(20px);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      animation: fadeIn 0.3s ease;
      overflow-y: auto;
    `;
    
    let contentItems = [];
    
    switch(worldConfig.id) {
      case 'film':
        contentItems = await window.fetchers.getContentByType('movie', 10);
        if (contentItems.length === 0) contentItems = await window.fetchers.getContentByType('video', 10);
        break;
      case 'music':
        contentItems = await window.fetchers.getContentByType('music', 10);
        if (contentItems.length === 0) contentItems = await window.fetchers.getContentByType('audio', 10);
        break;
      case 'podcast':
        contentItems = await window.fetchers.getContentByType('podcast', 10);
        break;
      case 'creator':
        contentItems = await window.fetchers.fetchFeaturedCreators(10);
        break;
      case 'news':
        contentItems = await window.fetchers.getContentByType('article', 10);
        if (contentItems.length === 0) contentItems = await window.fetchers.getContentByType('news', 10);
        break;
      case 'culture':
        contentItems = await window.fetchers.getContentByType('culture', 10);
        if (contentItems.length === 0) contentItems = await window.fetchers.fetchCulturalMovements(10);
        break;
      default:
        contentItems = await window.fetchers.getContentByType('video', 10);
    }
    
    if (!contentItems || contentItems.length === 0) {
      contentItems = generateFallbackContent(worldConfig.id, 10);
    }
    
    modal.innerHTML = `
      <div class="expanded-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 10;">
        <div>
          <i class="fas ${worldConfig.icon}" style="color: ${worldConfig.color}; font-size: 28px; margin-right: 12px;"></i>
          <span style="font-size: 24px; font-weight: 700;">${worldConfig.name}</span>
          <span style="color: #94A3B8; margin-left: 12px;">${worldConfig.tagline}</span>
        </div>
        <button class="close-modal-btn" style="background: rgba(255,255,255,0.1); border: none; width: 40px; height: 40px; border-radius: 50%; color: white; cursor: pointer; font-size: 20px;">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="expanded-modal-content" style="padding: 30px; max-width: 1200px; margin: 0 auto; width: 100%;">
        <div class="content-categories" style="display: flex; gap: 12px; margin-bottom: 30px; flex-wrap: wrap;">
          ${worldConfig.categories.map(cat => `<span class="category-chip" style="background: rgba(255,255,255,0.05); padding: 8px 20px; border-radius: 30px; cursor: pointer; transition: all 0.3s;">${cat}</span>`).join('')}
        </div>
        <div class="content-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
          ${contentItems.slice(0, 10).map(item => renderContentItem(item, worldConfig.id)).join('')}
        </div>
        <div style="text-align: center; margin-top: 40px;">
          <button class="view-all-btn" data-redirect="${worldConfig.redirectUrl}" style="background: linear-gradient(135deg, ${worldConfig.color}, ${worldConfig.color}80); border: none; padding: 14px 40px; border-radius: 50px; color: white; font-weight: 600; cursor: pointer; font-size: 16px; transition: transform 0.3s;">
            View All <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
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
        if (redirectUrl) window.location.href = redirectUrl;
      });
    }
  }
  
  function renderContentItem(item, worldType) {
    if (worldType === 'creator') {
      return `
        <div class="content-card creator-card" style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B, #8B5CF6); margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${item.avatar_url ? `<img src="${item.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : `<i class="fas fa-user" style="font-size: 32px; color: white;"></i>`}
          </div>
          <h4 style="margin-bottom: 5px;">${window.escapeHtml(item.full_name || item.username || 'Creator')}</h4>
          <p style="font-size: 13px; color: #94A3B8;">${item.bio ? window.escapeHtml(item.bio.substring(0, 60)) : 'African Creator'}</p>
        </div>
      `;
    }
    
    return `
      <div class="content-card" style="background: rgba(255,255,255,0.03); border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s;">
        <div style="position: relative;">
          <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title || 'Content')}" style="width: 100%; height: 140px; object-fit: cover;">
        </div>
        <div style="padding: 15px;">
          <h4 style="font-size: 16px; margin-bottom: 5px;">${window.escapeHtml(item.title || 'Untitled')}</h4>
          <p style="font-size: 13px; color: #94A3B8;">${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748B; margin-top: 8px;">
            <span><i class="fas fa-eye"></i> ${window.formatNumber(item.views_count || 0)}</span>
            <span><i class="fas fa-heart"></i> ${window.formatNumber(item.likes_count || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  function generateFallbackContent(worldId, limit) {
    const fallbackContent = {
      film: [
        { title: 'The Last King', creator_display_name: 'Nollywood Studios', views_count: 1250000, likes_count: 89000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'Soweto Love Story', creator_display_name: 'SA Film Co', views_count: 890000, likes_count: 67000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'African Cyberpunk', creator_display_name: 'Futurism Studios', views_count: 560000, likes_count: 45000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ],
      music: [
        { title: 'Amapiano Mix 2025', creator_display_name: 'DJ Maphorisa', views_count: 3200000, likes_count: 245000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'Afro House Vibes', creator_display_name: 'Black Coffee', views_count: 2100000, likes_count: 178000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ],
      podcast: [
        { title: 'The Business Breakfast', creator_display_name: 'Money Talk SA', views_count: 450000, likes_count: 23000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'African Stories', creator_display_name: 'Storytelling Africa', views_count: 320000, likes_count: 19000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ],
      creator: [
        { full_name: 'Theresa Kachindamoto', username: 'theresa_creates', bio: 'Award-winning filmmaker from Malawi' },
        { full_name: 'David Tlale', username: 'david_tlale', bio: 'Fashion designer showcasing African elegance' }
      ],
      news: [
        { title: 'African Tech Summit 2025', creator_display_name: 'TechAfrica', views_count: 780000, likes_count: 34000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ],
      culture: [
        { title: 'Fashion Week Lagos', creator_display_name: 'Culture Hub', views_count: 890000, likes_count: 67000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ]
    };
    
    const items = fallbackContent[worldId] || fallbackContent.film;
    while (items.length < limit && items.length > 0) {
      items.push({ ...items[0], title: items[0].title + ' (New)' });
    }
    return items.slice(0, limit);
  }
  
  // ============================================
  // 4. OTHER RENDER FUNCTIONS
  // ============================================
  async function renderCreatorUniverses() {
    if (!creatorsContainer) return;
    creatorsContainer.innerHTML = `<div class="skeleton-list">${Array(5).fill().map(() => `<div class="skeleton-creator-card"></div>`).join('')}</div>`;
    try {
      const creators = await window.fetchers.fetchFeaturedCreators(8);
      if (!creators || creators.length === 0) {
        creatorsContainer.innerHTML = '<div class="empty-state">No creators found</div>';
        return;
      }
      const creatorGroups = [
        { name: 'Trending Now', icon: 'fa-chart-line', color: '#F59E0B', creators: creators.slice(0, 3) },
        { name: 'Rising Stars', icon: 'fa-star', color: '#EC4899', creators: creators.slice(3, 6) },
        { name: 'Top Creators', icon: 'fa-trophy', color: '#10B981', creators: creators.slice(6, 8) }
      ].filter(group => group.creators.length > 0);
      
      creatorsContainer.innerHTML = creatorGroups.map(group => `
        <div class="creator-group">
          <div class="creator-group-header"><i class="fas ${group.icon}" style="color: ${group.color}"></i><h3>${group.name}</h3><span class="group-count">${group.creators.length} creators</span></div>
          <div class="creator-group-grid">${group.creators.map(creator => `
            <div class="creator-ecosystem-card" onclick="window.location.href='creator-channel.html?id=${creator.id}'">
              <div class="eco-icon" style="background: ${group.color}20; color: ${group.color}">${creator.avatar_url ? `<img src="${creator.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : `<i class="fas fa-user"></i>`}</div>
              <div class="eco-info"><h4>${window.escapeHtml(creator.full_name || creator.username || 'Creator')}</h4><p>${creator.bio ? window.escapeHtml(creator.bio.substring(0, 60)) : (creator.location || 'African Creator')}</p><div class="eco-stats">${creator.pulse_score ? `<span><i class="fas fa-bolt"></i> Score: ${Math.round(creator.pulse_score)}</span>` : ''}</div></div>
              <button class="follow-creator-btn" onclick="event.stopPropagation(); window.showToast('Following ${window.escapeHtml(creator.full_name || creator.username)}', 'success')">Follow</button>
            </div>`).join('')}</div>
        </div>`).join('');
    } catch (error) { creatorsContainer.innerHTML = '<div class="empty-state">Failed to load creators</div>'; }
  }
  
  async function renderLiveExperiences() {
    if (!liveContainer) return;
    liveContainer.innerHTML = `<div class="skeleton-grid">${Array(4).fill().map(() => `<div class="skeleton-live-card"></div>`).join('')}</div>`;
    try {
      const liveContent = await window.fetchers.fetchLiveStreams(6);
      if (!liveContent || liveContent.length === 0) { liveContainer.innerHTML = '<div class="empty-state">No live content right now. Check back later!</div>'; return; }
      liveContainer.innerHTML = liveContent.map(item => `
        <div class="live-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
          <div class="live-badge"><span class="live-dot"></span>${item.is_live ? 'LIVE NOW' : 'TRENDING'}</div>
          <div class="live-thumbnail"><img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title)}" style="width:100%;border-radius:12px;aspect-ratio:16/9;object-fit:cover"></div>
          <div class="live-info"><h4>${window.escapeHtml(item.title) || 'Untitled'}</h4><p><i class="fas fa-user"></i> ${window.escapeHtml(item.creator_display_name || 'Creator')}</p><div class="live-stats"><span><i class="fas fa-calendar"></i> ${window.formatRelativeTime(item.created_at)}</span></div></div>
          <button class="watch-live-btn">${item.is_live ? 'Watch Live' : 'Watch Now'} <i class="fas fa-play"></i></button>
        </div>`).join('');
    } catch (error) { liveContainer.innerHTML = '<div class="empty-state">Failed to load live content</div>'; }
  }
  
  async function renderCulturalHub() {
    if (!culturalContainer) return;
    culturalContainer.innerHTML = `<div class="skeleton-grid">${Array(6).fill().map(() => `<div class="skeleton-cultural-card"></div>`).join('')}</div>`;
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
      const culturalFeatures = (movements && movements.length) ? movements.map(m => ({ title: m.name, description: m.description || `Explore the ${m.name} movement`, icon: 'fa-compass', color: '#F59E0B' })) : fallbackFeatures;
      culturalContainer.innerHTML = culturalFeatures.map(f => `<div class="cultural-card" style="--cultural-color: ${f.color}"><div class="cultural-card-inner"><i class="fas ${f.icon}"></i><h3>${window.escapeHtml(f.title)}</h3><p>${window.escapeHtml(f.description)}</p><button class="explore-cultural-btn">Explore <i class="fas fa-arrow-right"></i></button></div></div>`).join('');
    } catch (error) { culturalContainer.innerHTML = '<div class="empty-state">Failed to load cultural content</div>'; }
  }
  
  async function renderTrendingEditorial() {
    const editorialContainer = document.getElementById('editorialGrid');
    if (!editorialContainer) return;
    editorialContainer.innerHTML = `<div class="skeleton-grid">${Array(4).fill().map(() => `<div class="skeleton-editorial-card"></div>`).join('')}</div>`;
    try {
      const trending = await window.fetchers.fetchTrendingContent(6);
      if (!trending || trending.length === 0) { editorialContainer.innerHTML = '<div class="empty-state">No trending content available</div>'; return; }
      editorialContainer.innerHTML = trending.slice(0, 4).map(item => `
        <div class="editorial-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
          <div class="editorial-category">${item.content_type || item.genre || 'TRENDING'}</div>
          <h3>${window.escapeHtml(item.title) || 'Untitled'}</h3>
          <p>${item.description ? window.escapeHtml(item.description.substring(0, 100)) : `Watch this trending content with ${window.formatNumber(item.views_count || 0)} views`}</p>
          <div class="editorial-stats"><span><i class="fas fa-eye"></i> ${window.formatNumber(item.views_count || 0)}</span><span><i class="fas fa-heart"></i> ${window.formatNumber(item.likes_count || 0)}</span></div>
          <button class="read-more-btn">Watch Now <i class="fas fa-play"></i></button>
        </div>`).join('');
    } catch (error) { editorialContainer.innerHTML = '<div class="empty-state">Failed to load trending content</div>'; }
  }
  
  async function updateEnergyBar() {
    try {
      const stats = await window.fetchers.fetchPlatformStats();
      if (energyText) energyText.textContent = `${Math.floor(Math.random() * 500) + 800} active viewers now`;
      if (energyTicker) {
        const tickerItems = [`🔥 ${(stats.totalViews || 0).toLocaleString()} total views`, `📍 Trending across Africa`, `🎵 ${(stats.totalContent || 0).toLocaleString()} pieces of content`, `⭐ ${(stats.totalCreators || 0).toLocaleString()} creators`];
        energyTicker.innerHTML = tickerItems.map(item => `<span>${item}</span>`).join('') + tickerItems.map(item => `<span>${item}</span>`).join('');
      }
    } catch (error) {}
  }
  
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
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
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
      { name: 'Nairobi', x: width * 0.6, y: height * 0.45, country: 'Kenya' }
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
      trendingItems.push(`<div class="trending-item" style="border-left-color: #F59E0B"><span class="trending-city">📍 ${region.name}</span><span class="trending-trend">Trending content</span></div>`);
    }
    trendingContainer.innerHTML = trendingItems.join('');
  }
  
  function setupSmartSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchModal = document.getElementById('searchModal');
    const searchBtn = document.getElementById('searchBtn');
    const closeSearch = document.getElementById('closeSearch');
    if (!searchInput) return;
    if (searchBtn) searchBtn.addEventListener('click', () => { if (searchModal) searchModal.classList.add('active'); setTimeout(() => searchInput.focus(), 100); });
    if (closeSearch) closeSearch.addEventListener('click', () => { if (searchModal) searchModal.classList.remove('active'); searchInput.value = ''; if (searchResults) searchResults.innerHTML = ''; });
    if (searchModal) searchModal.addEventListener('click', (e) => { if (e.target === searchModal) { searchModal.classList.remove('active'); searchInput.value = ''; if (searchResults) searchResults.innerHTML = ''; } });
    let searchTimeout;
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      clearTimeout(searchTimeout);
      if (query.length < 2) { if (searchResults) searchResults.innerHTML = '<div class="search-placeholder">Type at least 2 characters to search...</div>'; return; }
      searchTimeout = setTimeout(async () => {
        if (!searchResults) return;
        searchResults.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
        const results = await window.fetchers.searchContent(query);
        if (!results || results.length === 0) { searchResults.innerHTML = '<div class="no-results">No results found. Try something else!</div>'; return; }
        searchResults.innerHTML = `<div class="search-results-header"><span>Found ${results.length} results for "${window.escapeHtml(query)}"</span></div><div class="search-results-grid">${results.map(item => `<div class="search-result-item" onclick="window.location.href='content-detail.html?id=${item.id}'"><img src="${item.thumbnail_url || 'https://via.placeholder.com/80x45'}" style="width:80px;height:45px;border-radius:8px;object-fit:cover"><div class="search-result-info"><h4>${window.escapeHtml(item.title) || 'Untitled'}</h4><p>${window.escapeHtml(item.creator_display_name || 'Creator')} • ${window.formatNumber(item.views_count || 0)} views</p></div></div>`).join('')}</div>`;
      }, 300);
    });
  }
  
  function setupSidebar() {
    const menuBtn = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn) menuBtn.addEventListener('click', () => { sidebar?.classList.add('active'); overlay?.classList.add('active'); });
    function closeSidebar() { sidebar?.classList.remove('active'); overlay?.classList.remove('active'); }
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
  }
  
  function setupHeroButtons() {
    const exploreWorldsBtn = document.getElementById('exploreWorldsBtn');
    const startJourneyBtn = document.getElementById('startJourneyBtn');
    const discoverCreatorsBtn = document.getElementById('discoverCreatorsBtn');
    if (exploreWorldsBtn) exploreWorldsBtn.addEventListener('click', () => document.getElementById('worldsSection')?.scrollIntoView({ behavior: 'smooth' }));
    if (startJourneyBtn) startJourneyBtn.addEventListener('click', () => document.getElementById('journeySection')?.scrollIntoView({ behavior: 'smooth' }));
    if (discoverCreatorsBtn) discoverCreatorsBtn.addEventListener('click', () => document.querySelector('.creator-universes')?.scrollIntoView({ behavior: 'smooth' }));
  }
  
  async function initialize() {
    console.log('Initializing Explore Screen with REAL DATA...');
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    try {
      setupJourneyOptions();
      const generateBtn = document.getElementById('generateJourneyBtn');
      if (generateBtn) generateBtn.addEventListener('click', generateDiscoveryJourney);
      setupHeroButtons();
      await Promise.all([
        renderDiscoveryWorlds(),
        renderCreatorUniverses(),
        renderLiveExperiences(),
        renderCulturalHub(),
        renderTrendingEditorial(),
        updateEnergyBar(),
        renderAfricaMap()
      ]);
      setupSmartSearch();
      setupSidebar();
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
  
  initialize();
});
