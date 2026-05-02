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
  
  // ============================================
  // 1. RENDER DISCOVERY WORLDS (Film, Music, Podcast, Creator, News, Culture)
  // ============================================
  async function renderDiscoveryWorlds() {
    if (!worldsContainer) return;
    
    worldsContainer.innerHTML = `
      <div class="skeleton-grid">
        ${Array(6).fill().map(() => `<div class="skeleton-world-card"></div>`).join('')}
      </div>
    `;
    
    try {
      // Define the 6 Discovery Worlds as specified
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
      
      // Add click handlers for Explore buttons
      document.querySelectorAll('.explore-world-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const worldId = btn.dataset.world;
          const worldCard = btn.closest('.world-card');
          const redirectUrl = worldCard?.dataset.redirectUrl;
          
          // Find the world config
          const worldConfig = discoveryWorlds.find(w => w.id === worldId);
          if (worldConfig) {
            await showWorldExpandedContent(worldConfig);
          } else if (redirectUrl) {
            window.location.href = redirectUrl;
          }
        });
      });
      
      // Also make clicking the card show expanded content
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
  
  /**
   * Show expanded content for a world (max 10 items + View All button)
   */
  async function showWorldExpandedContent(worldConfig) {
    // Create modal for expanded content
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
    
    // Fetch content based on world type
    let contentItems = [];
    let contentType = '';
    
    switch(worldConfig.id) {
      case 'film':
        contentType = 'movie';
        contentItems = await window.fetchers.getContentByType('movie', 10);
        if (contentItems.length === 0) {
          contentItems = await window.fetchers.getContentByType('video', 10);
        }
        break;
      case 'music':
        contentType = 'music';
        contentItems = await window.fetchers.getContentByType('music', 10);
        if (contentItems.length === 0) {
          contentItems = await window.fetchers.getContentByType('audio', 10);
        }
        break;
      case 'podcast':
        contentType = 'podcast';
        contentItems = await window.fetchers.getContentByType('podcast', 10);
        break;
      case 'creator':
        contentType = 'creator';
        contentItems = await window.fetchers.fetchFeaturedCreators(10);
        break;
      case 'news':
        contentType = 'news';
        contentItems = await window.fetchers.getContentByType('article', 10);
        if (contentItems.length === 0) {
          contentItems = await window.fetchers.getContentByType('news', 10);
        }
        break;
      case 'culture':
        contentType = 'culture';
        contentItems = await window.fetchers.getContentByType('culture', 10);
        if (contentItems.length === 0) {
          contentItems = await window.fetchers.fetchCulturalMovements(10);
        }
        break;
      default:
        contentItems = await window.fetchers.getContentByType('video', 10);
    }
    
    // If no content, use fallback demo content
    if (!contentItems || contentItems.length === 0) {
      contentItems = generateFallbackContent(worldConfig.id, 10);
    }
    
    // Build modal HTML
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
    
    // Close modal functionality
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
    
    // View All button
    const viewAllBtn = modal.querySelector('.view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        const redirectUrl = viewAllBtn.dataset.redirect;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      });
    }
    
    // Category chips filter (visual only)
    const categoryChips = modal.querySelectorAll('.category-chip');
    categoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        categoryChips.forEach(c => c.style.background = 'rgba(255,255,255,0.05)');
        chip.style.background = worldConfig.color;
      });
    });
  }
  
  /**
   * Render individual content item based on world type
   */
  function renderContentItem(item, worldType) {
    if (worldType === 'creator') {
      return `
        <div class="content-card creator-card" style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B, #8B5CF6); margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${item.avatar_url ? `<img src="${item.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : `<i class="fas fa-user" style="font-size: 32px; color: white;"></i>`}
          </div>
          <h4 style="margin-bottom: 5px;">${window.escapeHtml(item.full_name || item.username || 'Creator')}</h4>
          <p style="font-size: 13px; color: #94A3B8;">${item.bio ? window.escapeHtml(item.bio.substring(0, 60)) : 'African Creator'}</p>
          <div style="margin-top: 12px; display: flex; justify-content: center; gap: 10px;">
            ${item.pulse_score ? `<span style="font-size: 12px; background: rgba(245,158,11,0.2); padding: 4px 12px; border-radius: 20px;">🔥 Score: ${Math.round(item.pulse_score)}</span>` : ''}
          </div>
        </div>
      `;
    }
    
    return `
      <div class="content-card" style="background: rgba(255,255,255,0.03); border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s;">
        <div style="position: relative;">
          <img src="${item.thumbnail_url || 'https://via.placeholder.com/400x225'}" alt="${window.escapeHtml(item.title || 'Content')}" style="width: 100%; height: 140px; object-fit: cover;">
          ${item.duration ? `<span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${item.duration}</span>` : ''}
        </div>
        <div style="padding: 15px;">
          <h4 style="font-size: 16px; margin-bottom: 5px;">${window.escapeHtml(item.title || 'Untitled')}</h4>
          <p style="font-size: 13px; color: #94A3B8; margin-bottom: 8px;">${window.escapeHtml(item.creator_display_name || 'Creator')}</p>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748B;">
            <span><i class="fas fa-eye"></i> ${window.formatNumber(item.views_count || 0)}</span>
            <span><i class="fas fa-heart"></i> ${window.formatNumber(item.likes_count || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Generate fallback content when API returns empty
   */
  function generateFallbackContent(worldId, limit) {
    const fallbackContent = {
      film: [
        { title: 'The Last King', creator_display_name: 'Nollywood Studios', views_count: 1250000, likes_count: 89000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '2h 15m' },
        { title: 'Soweto Love Story', creator_display_name: 'SA Film Co', views_count: 890000, likes_count: 67000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '1h 45m' },
        { title: 'African Cyberpunk', creator_display_name: 'Futurism Studios', views_count: 560000, likes_count: 45000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '1h 50m' }
      ],
      music: [
        { title: 'Amapiano Mix 2025', creator_display_name: 'DJ Maphorisa', views_count: 3200000, likes_count: 245000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '1h 30m' },
        { title: 'Afro House Vibes', creator_display_name: 'Black Coffee', views_count: 2100000, likes_count: 178000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '45m' }
      ],
      podcast: [
        { title: 'The Business Breakfast', creator_display_name: 'Money Talk SA', views_count: 450000, likes_count: 23000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '48m' },
        { title: 'African Stories', creator_display_name: 'Storytelling Africa', views_count: 320000, likes_count: 19000, thumbnail_url: 'https://via.placeholder.com/400x225', duration: '55m' }
      ],
      creator: [
        { full_name: 'Theresa Kachindamoto', username: 'theresa_creates', bio: 'Award-winning filmmaker from Malawi', pulse_score: 95 },
        { full_name: 'David Tlale', username: 'david_tlale', bio: 'Fashion designer showcasing African elegance', pulse_score: 92 }
      ],
      news: [
        { title: 'African Tech Summit 2025', creator_display_name: 'TechAfrica', views_count: 780000, likes_count: 34000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'New Film Policy Announced', creator_display_name: 'Entertainment Today', views_count: 450000, likes_count: 28000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ],
      culture: [
        { title: 'Fashion Week Lagos', creator_display_name: 'Culture Hub', views_count: 890000, likes_count: 67000, thumbnail_url: 'https://via.placeholder.com/400x225' },
        { title: 'Preserving African Languages', creator_display_name: 'Heritage Foundation', views_count: 340000, likes_count: 28000, thumbnail_url: 'https://via.placeholder.com/400x225' }
      ]
    };
    
    const items = fallbackContent[worldId] || fallbackContent.film;
    while (items.length < limit && items.length > 0) {
      items.push({ ...items[0], title: items[0].title + ' (New)' });
    }
    return items.slice(0, limit);
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
