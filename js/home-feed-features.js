// ============================================
// VIDEO PREVIEW SYSTEM (Match explore-screen)
// ============================================
class VideoPreviewSystem {
  constructor() {
    this.hoverTimeout = null;
    this.currentPreview = null;
    this.touchStartTime = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchMoved = false;
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  init() {
    this.setupEventDelegation();
    this.setupVideoAttributes();
  }

  setupEventDelegation() {
    document.addEventListener('mouseover', (e) => {
      if (!this.isMobile) {
        const card = e.target.closest('.content-card');
        if (card) this.handleCardHover(card);
      }
    });
    
    document.addEventListener('mouseout', (e) => {
      if (!this.isMobile) {
        const card = e.target.closest('.content-card');
        if (card) this.handleCardLeave(card);
      }
    });
    
    document.addEventListener('touchstart', (e) => {
      this.touchStartTime = Date.now();
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchMoved = false;
      const card = e.target.closest('.content-card');
      if (card && !e.target.closest('.share-btn') && !e.target.closest('.creator-btn')) {
        this.handleCardHover(card);
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = Math.abs(touchX - this.touchStartX);
        const deltaY = Math.abs(touchY - this.touchStartY);
        if (deltaX > 10 || deltaY > 10) {
          this.touchMoved = true;
          this.handleCardLeaveAll();
        }
      }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - this.touchStartTime;
      if (touchDuration < 300 && !this.touchMoved) {
        const card = e.target.closest('.content-card');
        if (card) this.handleCardLeave(card);
      } else {
        this.handleCardLeaveAll();
      }
      this.touchMoved = false;
    }, { passive: true });
  }

  setupVideoAttributes() {
    document.querySelectorAll('.video-preview').forEach(video => {
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('preload', 'metadata');
    });
  }

  handleCardHover(card) {
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      const videoElement = card.querySelector('.video-preview');
      if (videoElement && videoElement.src) {
        card.classList.add('video-hover');
        this.currentPreview = videoElement;
        videoElement.currentTime = 0;
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.log('Video autoplay prevented:', e);
            card.classList.remove('video-hover');
          });
        }
      }
    }, this.isMobile ? 100 : 500);
  }

  handleCardLeave(card) {
    clearTimeout(this.hoverTimeout);
    const videoElement = card.querySelector('.video-preview');
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
    card.classList.remove('video-hover');
    this.currentPreview = null;
  }

  handleCardLeaveAll() {
    clearTimeout(this.hoverTimeout);
    document.querySelectorAll('.content-card.video-hover').forEach(card => {
      const videoElement = card.querySelector('.video-preview');
      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
      }
      card.classList.remove('video-hover');
    });
    this.currentPreview = null;
  }
}

// ============================================
// PERFORMANCE: Cache Layer (From explore-screen)
// ============================================
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes default
  }
  
  set(key, data, ttl = this.ttl) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
  
  clear() { this.cache.clear(); }
}

// ============================================
// PERFORMANCE: Query Batcher (From explore-screen)
// ============================================
class QueryBatcher {
  constructor() { 
    this.batchSize = 20; 
  }
  
  async batchQuery(table, ids, field = 'id') {
    const cacheKey = `${table}-${ids.sort().join(',')}`;
    const cached = window.cacheManager.get(cacheKey);
    if (cached) return cached;
    
    const batches = [];
    for (let i = 0; i < ids.length; i += this.batchSize) {
      batches.push(ids.slice(i, i + this.batchSize));
    }
    
    const results = await Promise.all(
      batches.map(batch => getSupabaseClient().from(table).select('*').in(field, batch))
    );
    
    const data = results.flatMap(r => r.data || []);
    window.cacheManager.set(cacheKey, data, 2 * 60 * 1000);
    return data;
  }
}

// ============================================
// GLOBAL STATE (Match explore-screen)
// ============================================
let trendingContent = [], newContent = [], communityFavorites = [], allContentData = [];
let contentMetrics = new Map(); // Content ID -> {views, likes, shares}
let connectorCounts = new Map(); // Content ID -> connector count

const languageMap = {
  'en': 'English', 'zu': 'IsiZulu', 'xh': 'IsiXhosa', 'af': 'Afrikaans',
  'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
  've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
};

// ============================================
// PERFORMANCE: BATCHED Metrics Loading (From explore-screen)
// ============================================
async function loadContentMetrics(contentIds) {
  if (!contentIds || contentIds.length === 0) return;
  
  const cacheKey = `metrics-${contentIds.sort().join(',')}`;
  const cached = window.cacheManager.get(cacheKey);
  if (cached) {
    cached.forEach(m => contentMetrics.set(m.content_id, m));
    updateMetricsOnCards(contentIds);
    return;
  }
  
  try {
    const client = getSupabaseClient();
    if (!client) return;
    
    const viewsPromises = contentIds.map(id =>
      client.from('content_views').select('*', { count: 'exact', head: true }).eq('content_id', id)
    );
    const likesPromises = contentIds.map(id =>
      client.from('content_likes').select('*', { count: 'exact', head: true }).eq('content_id', id)
    );
    
    const [viewsResults, likesResults] = await Promise.all([
      Promise.all(viewsPromises), Promise.all(likesPromises)
    ]);
    
    const metricsMap = new Map();
    viewsResults.forEach((r, i) => {
      const id = contentIds[i];
      if (!metricsMap.has(id)) metricsMap.set(id, {});
      metricsMap.get(id).views = r.count || 0;
    });
    
    likesResults.forEach((r, i) => {
      const id = contentIds[i];
      if (!metricsMap.has(id)) metricsMap.set(id, {});
      metricsMap.get(id).likes = r.count || 0;
    });
    
    try {
      const sharesPromises = contentIds.map(id =>
        client.from('content_shares').select('*', { count: 'exact', head: true }).eq('content_id', id)
      );
      const sharesResults = await Promise.all(sharesPromises);
      sharesResults.forEach((r, i) => {
        const id = contentIds[i];
        if (!metricsMap.has(id)) metricsMap.set(id, {});
        metricsMap.get(id).shares = r.count || 0;
      });
    } catch (e) {
      contentIds.forEach(id => {
        if (!metricsMap.has(id)) metricsMap.set(id, {});
        metricsMap.get(id).shares = 0;
      });
    }
    
    metricsMap.forEach((metrics, id) => contentMetrics.set(id, metrics));
    window.cacheManager.set(cacheKey,
      Array.from(metricsMap.entries()).map(([k, v]) => ({ content_id: k, ...v })),
      3 * 60 * 1000
    );
    
    updateMetricsOnCards(contentIds);
  } catch (error) {
    console.error('Error loading content metrics:', error);
  }
}

function updateMetricsOnCards(contentIds) {
  contentIds.forEach(id => {
    const card = document.querySelector(`.content-card[data-content-id="${id}"]`);
    if (!card) return;
    
    const metrics = contentMetrics.get(id) || { views: 0, likes: 0, shares: 0 };
    
    const statsEl = card.querySelector('.card-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="card-stat" title="Views">
          <i class="fas fa-eye"></i> ${formatNumber(metrics.views)}
        </span>
        <span class="card-stat" title="Likes">
          <i class="fas fa-heart"></i> ${formatNumber(metrics.likes)}
        </span>
        <span class="card-stat" title="Shares">
          <i class="fas fa-share"></i> ${formatNumber(metrics.shares)}
        </span>
      `;
    }
    
    const metaEl = card.querySelector('.card-meta');
    if (metaEl && metrics.views > 0) {
      metaEl.innerHTML = `
        <span><i class="fas fa-eye"></i> ${formatNumber(metrics.views)} views</span>
        <span><i class="fas fa-heart"></i> ${formatNumber(metrics.likes)} likes</span>
      `;
    }
  });
}

// ============================================
// PERFORMANCE: BATCHED Connector Counts (From explore-screen)
// ============================================
async function loadConnectorCounts(contentIds) {
  if (!contentIds || contentIds.length === 0) return;
  
  const cacheKey = `connectors-${contentIds.sort().join(',')}`;
  const cached = window.cacheManager.get(cacheKey);
  if (cached) {
    cached.forEach(c => connectorCounts.set(c.content_id, c.count));
    updateConnectorCountsOnCards();
    return;
  }
  
  try {
    const client = getSupabaseClient();
    if (!client) return;
    
    const { data: contentData } = await client
      .from('Content')
      .select('id, user_id')
      .in('id', contentIds);
      
    const creatorIds = [...new Set(contentData?.map(c => c.user_id).filter(Boolean))];
    const contentCreatorMap = new Map(contentData?.map(c => [c.id, c.user_id]));
    
    const connectorPromises = creatorIds.map(userId =>
      client.from('connectors').select('*', { count: 'exact', head: true })
        .eq('connected_id', userId).eq('connection_type', 'creator')
    );
    
    const connectorResults = await Promise.all(connectorPromises);
    const creatorCountMap = new Map(creatorIds.map((id, i) => [id, connectorResults[i].count || 0]));
    
    const results = contentIds.map(id => ({
      content_id: id,
      count: contentCreatorMap.get(id) ? (creatorCountMap.get(contentCreatorMap.get(id)) || 0) : 0
    }));
    
    results.forEach(r => connectorCounts.set(r.content_id, r.count));
    window.cacheManager.set(cacheKey, results, 5 * 60 * 1000);
    updateConnectorCountsOnCards();
  } catch (error) {
    console.error('Error loading connector counts:', error);
  }
}

function updateConnectorCountsOnCards() {
  document.querySelectorAll('.content-card').forEach(card => {
    const contentId = card.dataset.contentId;
    if (!contentId) return;
    
    const count = connectorCounts.get(contentId) || 0;
    let connectorBadge = card.querySelector('.connector-badge');
    
    if (!connectorBadge) {
      const badgesContainer = card.querySelector('.card-badges');
      if (badgesContainer) {
        connectorBadge = document.createElement('div');
        connectorBadge.className = 'connector-badge';
        badgesContainer.appendChild(connectorBadge);
      }
    }
    
    if (connectorBadge) {
      connectorBadge.innerHTML = `
        <i class="fas fa-user-friends"></i>
        <span>${formatNumber(count)} ${count === 1 ? 'Connector' : 'Connectors'}</span>
      `;
    }
  });
}

// ============================================
// ✅ CONTENT CARD RENDERING (MATCH EXPLORE-SCREEN EXACTLY)
// ============================================
function renderContentCards(contents) {
  const fragment = document.createDocumentFragment();
  
  contents.forEach(content => {
    const card = document.createElement('a');
    card.className = 'content-card';
    card.href = `content-detail.html?id=${content.id}`;
    card.dataset.contentId = content.id;
    card.dataset.previewUrl = content.preview_url || '';
    card.dataset.language = content.language || 'en';
    card.dataset.category = content.genre || '';

    const thumbnailUrl = content.thumbnail_url
      ? fixMediaUrl(content.thumbnail_url)
      : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
    
    const creatorProfile = content.user_profiles;
    const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
    const initials = getInitials(displayName);
    const username = creatorProfile?.username || 'creator';
    const isNew = (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000;
    const metrics = contentMetrics.get(content.id) || { views: 0, likes: 0, shares: 0 };
    const favorites = content.favorites_count || 0;

    let avatarHtml = '';
    if (creatorProfile?.avatar_url) {
      const avatarUrl = fixMediaUrl(creatorProfile.avatar_url);
      avatarHtml = `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}" loading="lazy">`;
    } else {
      avatarHtml = `<div class="creator-initials-small">${initials}</div>`;
    }

    card.innerHTML = `
      <div class="card-thumbnail">
        <img src="${thumbnailUrl}" alt="${escapeHtml(content.title)}" loading="lazy">
        <div class="card-badges">
          ${isNew ? '<div class="card-badge badge-new"><i class="fas fa-gem"></i> NEW</div>' : ''}
          ${content.is_trending ? '<div class="card-badge badge-trending"><i class="fas fa-fire"></i> TRENDING</div>' : ''}
          <div class="connector-badge">
            <i class="fas fa-user-friends"></i>
            <span>${formatNumber(favorites)} ${favorites === 1 ? 'Connector' : 'Connectors'}</span>
          </div>
        </div>
        <div class="thumbnail-overlay"></div>
        <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
        <video class="video-preview" muted loop playsinline preload="metadata">
          <source src="${content.preview_url ? fixMediaUrl(content.preview_url) : ''}" type="video/mp4">
        </video>
      </div>
      <div class="card-content">
        <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
        <div class="creator-info">
          <div class="creator-avatar-small">${avatarHtml}</div>
          <div class="creator-name-small">@${escapeHtml(username)}</div>
        </div>
        <div class="card-stats">
          <span class="card-stat" title="Views"><i class="fas fa-eye"></i> ${formatNumber(metrics.views)}</span>
          <span class="card-stat" title="Likes"><i class="fas fa-heart"></i> ${formatNumber(metrics.likes)}</span>
          <span class="card-stat" title="Shares"><i class="fas fa-share"></i> ${formatNumber(metrics.shares)}</span>
        </div>
        <div class="card-meta">
          <span><i class="fas fa-language"></i> ${languageMap[content.language] || 'English'}</span>
          <span><i class="fas fa-clock"></i> ${formatDate(content.created_at)}</span>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  });
  
  return fragment;
}

// ============================================
// ✅ UPDATE FUNCTIONS (From explore-screen)
// ============================================
function updateTrendingContent() {
  const trendingGrid = document.getElementById('trending-grid');
  if (!trendingGrid) return;
  
  if (trendingContent.length === 0) {
    trendingGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-icon"><i class="fas fa-chart-line"></i></div><h3>No Trending Content</h3><p>Popular content will appear here</p></div>`;
    return;
  }
  
  const fragment = renderContentCards(trendingContent.slice(0, 8));
  trendingGrid.innerHTML = '';
  trendingGrid.appendChild(fragment);
  setupVideoPreviews();
  loadConnectorCounts(trendingContent.slice(0, 8).map(c => c.id));
  loadContentMetrics(trendingContent.slice(0, 8).map(c => c.id));
}

function updateNewContent() {
  const newContentGrid = document.getElementById('new-content-grid');
  if (!newContentGrid) return;
  
  if (newContent.length === 0) {
    newContentGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-icon"><i class="fas fa-gem"></i></div><h3>No New Content</h3><p>Fresh content will appear here</p></div>`;
    return;
  }
  
  const fragment = renderContentCards(newContent.slice(0, 8));
  newContentGrid.innerHTML = '';
  newContentGrid.appendChild(fragment);
  setupVideoPreviews();
  loadConnectorCounts(newContent.slice(0, 8).map(c => c.id));
  loadContentMetrics(newContent.slice(0, 8).map(c => c.id));
}

function updateCommunityFavorites() {
  const grid = document.getElementById('community-favorites-grid');
  if (!grid) return;
  
  if (communityFavorites.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No community favorites yet</p></div>';
    return;
  }
  
  const fragment = renderContentCards(communityFavorites.slice(0, 8));
  grid.innerHTML = '';
  grid.appendChild(fragment);
  setupVideoPreviews();
  loadConnectorCounts(communityFavorites.slice(0, 8).map(c => c.id));
  loadContentMetrics(communityFavorites.slice(0, 8).map(c => c.id));
}

// ============================================
// ✅ VIDEO PREVIEWS ON HOVER (From explore-screen)
// ============================================
function setupVideoPreviews() {
  document.querySelectorAll('.content-card[data-preview-url]').forEach(card => {
    let video = null;
    let hoverTimeout = null;
    
    card.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        const previewUrl = card.dataset.previewUrl;
        if (!previewUrl) return;
        
        if (!video) {
          video = document.createElement('video');
          video.className = 'card-preview-video';
          video.muted = true; 
          video.loop = true; 
          video.playsInline = true;
          video.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:2;`;
          
          const thumbnail = card.querySelector('.card-thumbnail');
          if (thumbnail) thumbnail.appendChild(video);
        }
        
        video.src = fixMediaUrl(previewUrl);
        video.play().catch(() => { 
          video.remove(); 
          video = null; 
        });
      }, 300);
    });
    
    card.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      if (video) { 
        video.pause(); 
        video.remove(); 
        video = null; 
      }
    });
  });
}

// ============================================
// ✅ SHORTS SECTION — FIXED REDIRECT TO shorts-detail.html
// ============================================
async function loadShorts() {
  try {
    const container = document.getElementById('shorts-container');
    if (!container) return;
    
    const client = getSupabaseClient();
    let shorts = [];
    
    if (client) {
      const { data, error } = await client
        .from('Content')
        .select('*, user_profiles!user_id(*)')
        .eq('status', 'published')
        .eq('media_type', 'short')
        .or('media_type.eq.short,duration.lte.60')
        .order('views_count', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      shorts = data || [];
    }
    
    if (shorts.length === 0) shorts = getMockShorts();
    if (shorts.length === 0) { container.style.display = 'none'; return; }
    
    container.style.display = 'flex';
    container.innerHTML = shorts.map(short => {
      const thumbnailUrl = short.thumbnail_url ? fixMediaUrl(short.thumbnail_url) :
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop';
      const creatorProfile = short.user_profiles;
      const creatorName = creatorProfile?.full_name || creatorProfile?.username || short.creator || 'Creator';
      const metrics = contentMetrics.get(short.id) || { views: 0, likes: 0 };
      
      return `
        <a href="shorts-detail.html?id=${short.id}" class="short-card">
          <div class="short-thumbnail">
            <img src="${thumbnailUrl}" alt="${escapeHtml(short.title)}" loading="lazy">
            <div class="short-overlay"><i class="fas fa-play"></i></div>
            <div class="short-stats"><span><i class="fas fa-eye"></i> ${formatNumber(metrics.views)}</span></div>
          </div>
          <div class="short-info">
            <h4>${truncateText(escapeHtml(short.title), 30)}</h4>
            <p>${escapeHtml(creatorName)}</p>
          </div>
        </a>
      `;
    }).join('');
    
    setupVideoPreviews();
  } catch (error) { 
    console.error('Error loading shorts:', error); 
  }
}

function getMockShorts() {
  return [
    { id: 'short1', title: 'Quick African Dance Tutorial', thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop', creator: 'Dance Africa' },
    { id: 'short2', title: '1-Minute Recipe: Jollof Rice', thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop', creator: 'Tasty Africa' },
    { id: 'short3', title: 'African Wildlife in 60 Seconds', thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop', creator: 'Wild Africa' },
    { id: 'short4', title: 'Learn Zulu Greetings', thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop', creator: 'Language Lessons' }
  ];
}

// ============================================
// ✅ LANGUAGE FILTER SYSTEM (From explore-screen)
// ============================================
function setupLanguageFilter() {
  const languageChips = document.querySelectorAll('.language-chip');
  const moreLanguagesBtn = document.getElementById('more-languages-btn');
  let languageFilter = 'all';
  
  languageChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      languageFilter = chip.dataset.lang;
      filterContentByLanguage(languageFilter);
      const langName = getLanguageName(languageFilter);
      if (typeof toast !== 'undefined') toast.info(`Showing: ${langName}`);
    });
  });
  
  if (moreLanguagesBtn) {
    moreLanguagesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const languageContainer = document.querySelector('.language-chips');
      const hiddenLanguages = ['nr', 'ss', 've', 'ts'];
      
      hiddenLanguages.forEach(lang => {
        if (!document.querySelector(`.language-chip[data-lang="${lang}"]`)) {
          const newChip = document.createElement('button');
          newChip.className = 'language-chip';
          newChip.dataset.lang = lang;
          newChip.textContent = languageMap[lang] || lang;
          
          newChip.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.language-chip').forEach(c => c.classList.remove('active'));
            newChip.classList.add('active');
            languageFilter = lang;
            filterContentByLanguage(lang);
            if (typeof toast !== 'undefined') toast.info(`Showing: ${languageMap[lang]}`);
          });
          
          languageContainer.insertBefore(newChip, moreLanguagesBtn);
        }
      });
      
      moreLanguagesBtn.style.display = 'none';
      if (typeof toast !== 'undefined') toast.info('All languages shown');
    });
  }
  
  const defaultChip = document.querySelector('.language-chip[data-lang="all"]');
  if (defaultChip) defaultChip.classList.add('active');
}

function getLanguageName(code) { 
  return languageMap[code] || code || 'All Languages'; 
}

function filterContentByLanguage(lang) {
  const contentCards = document.querySelectorAll('.content-card');
  let visibleCount = 0;
  
  contentCards.forEach(card => {
    const contentLang = card.dataset.language || 'en';
    if (lang === 'all' || contentLang === lang) {
      card.style.display = 'block';
      card.style.opacity = '0'; 
      card.style.transform = 'translateY(10px)';
      setTimeout(() => { 
        card.style.opacity = '1'; 
        card.style.transform = 'translateY(0)'; 
      }, 50);
      visibleCount++;
    } else { 
      card.style.display = 'none'; 
    }
  });
  
  if (visibleCount === 0 && lang !== 'all') {
    if (typeof toast !== 'undefined') toast.warning(`No content in ${getLanguageName(lang)} yet`);
  }
}

// ============================================
// ✅ COMMUNITY STATS (From explore-screen)
// ============================================
async function loadCommunityStats() {
  try {
    const client = getSupabaseClient();
    if (!client) { updateMockStats(); return; }
    
    const { count: connectorsCount } = await client.from('connectors').select('*', { count: 'exact', head: true });
    const { count: contentCount } = await client.from('Content').select('*', { count: 'exact', head: true }).eq('status', 'published');
    
    const today = new Date(); 
    today.setHours(0,0,0,0);
    const { count: newConnectors } = await client.from('connectors').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
    
    document.getElementById('total-connectors').textContent = formatNumber(connectorsCount || 12500);
    document.getElementById('total-content').textContent = formatNumber(contentCount || 2300);
    document.getElementById('new-connectors').textContent = `+${formatNumber(newConnectors || 342)}`;
  } catch (error) { 
    console.error('Error loading community stats:', error); 
    updateMockStats(); 
  }
}

function updateMockStats() {
  document.getElementById('total-connectors').textContent = '12.5K';
  document.getElementById('total-content').textContent = '2.3K';
  document.getElementById('new-connectors').textContent = '+342';
}

// ============================================
// ✅ VIDEO HERO (From explore-screen)
// ============================================
async function initVideoHero() {
  const heroVideo = document.getElementById('hero-video');
  const heroMuteBtn = document.getElementById('hero-mute-btn');
  const heroMuteBtnMobile = document.getElementById('hero-mute-btn-mobile');
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  
  if (!heroVideo) return;
  
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('Content')
        .select('*')
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(1);
        
      if (error) throw error;
      
      const trending = data || [];
      if (trending && trending.length > 0) {
        const featured = trending[0];
        const videoUrl = featured.preview_url || featured.file_url;
        
        if (videoUrl) {
          heroVideo.src = fixMediaUrl(videoUrl);
          heroVideo.poster = featured.thumbnail_url ? fixMediaUrl(featured.thumbnail_url) : '';
          heroTitle.textContent = featured.title || 'DISCOVER & CONNECT';
          heroSubtitle.textContent = truncateText(featured.description || 'Explore amazing content from creators across Africa', 120);
          
          heroVideo.play().catch(() => {
            if (heroMuteBtn) heroMuteBtn.style.display = 'flex';
            if (heroMuteBtnMobile) heroMuteBtnMobile.style.display = 'flex';
          });
        }
      }
    }
  } catch (error) { 
    console.error('Error loading hero video:', error); 
  }
  
  if (heroMuteBtn) {
    heroMuteBtn.addEventListener('click', () => {
      heroVideo.muted = !heroVideo.muted;
      const icon = heroVideo.muted ? 'fa-volume-mute' : 'fa-volume-up';
      heroMuteBtn.innerHTML = `<i class="fas ${icon}"></i>`;
      if (heroMuteBtnMobile) heroMuteBtnMobile.innerHTML = `<i class="fas ${icon}"></i>`;
    });
  }
  
  if (heroMuteBtnMobile) {
    heroMuteBtnMobile.addEventListener('click', () => {
      heroVideo.muted = !heroVideo.muted;
      const icon = heroVideo.muted ? 'fa-volume-mute' : 'fa-volume-up';
      heroMuteBtnMobile.innerHTML = `<i class="fas ${icon}"></i>`;
      if (heroMuteBtn) heroMuteBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    });
  }
}

// ============================================
// ✅ UTILITY FUNCTIONS (From explore-screen)
// ============================================
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString), now = new Date();
    const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) { 
      const weeks = Math.floor(diffDays / 7); 
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`; 
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) { 
    return ''; 
  }
}

function getInitials(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  return names.length >= 2 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : name[0].toUpperCase();
}

function fixMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.includes('supabase.co')) return url;
  return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function getSupabaseClient() {
  if (typeof supabaseAuth !== 'undefined' && supabaseAuth?.from) return supabaseAuth;
  if (typeof window.supabaseAuth !== 'undefined' && window.supabaseAuth?.from) return window.supabaseAuth;
  console.error('❌ Supabase client not found!');
  return null;
}

// ============================================
// ✅ SIDEBAR SETUP
// ============================================
function setupSidebar() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarMenu = document.getElementById('sidebar-menu');
  
  const openSidebar = () => {
    if (sidebarMenu) sidebarMenu.classList.add('active');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  
  const closeSidebar = () => {
    if (sidebarMenu) sidebarMenu.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      openSidebar();
    });
  }
  
  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeSidebar);
  }
  
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarMenu?.classList.contains('active')) {
      closeSidebar();
    }
  });
  
  updateSidebarProfile();
  setupSidebarNavigation();
  setupSidebarThemeToggle();
  setupSidebarScaleControls();
  
  console.log('✅ Sidebar initialized');
}

function updateSidebarProfile() {
  const avatar = document.getElementById('sidebar-profile-avatar');
  const name = document.getElementById('sidebar-profile-name');
  const email = document.getElementById('sidebar-profile-email');
  const profileSection = document.getElementById('sidebar-profile');
  
  if (!avatar || !name || !email) return;
  
  if (window.currentUser) {
    name.textContent = window.currentUser.user_metadata?.full_name || window.currentUser.email?.split('@')[0] || 'User';
    email.textContent = window.currentUser.email || '';
    
    if (window.currentUser.user_metadata?.avatar_url) {
      avatar.innerHTML = `<img src="${fixMediaUrl(window.currentUser.user_metadata.avatar_url)}" alt="Profile">`;
    } else {
      const initials = getInitials(name.textContent);
      avatar.innerHTML = `<span>${initials}</span>`;
    }
    
    if (profileSection) {
      profileSection.addEventListener('click', () => {
        closeSidebar();
        window.location.href = 'manage-profiles.html';
      });
    }
  } else {
    name.textContent = 'Guest';
    email.textContent = 'Sign in to continue';
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    
    if (profileSection) {
      profileSection.addEventListener('click', () => {
        closeSidebar();
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      });
    }
  }
}

function setupSidebarNavigation() {
  document.getElementById('sidebar-analytics')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    if (!window.currentUser) {
      if (typeof toast !== 'undefined') toast.warning('Please sign in to view analytics');
      return;
    }
    const analyticsModal = document.getElementById('analytics-modal');
    if (analyticsModal) {
      analyticsModal.classList.add('active');
      if (typeof analyticsSystem?.updateAnalyticsDisplay === 'function') {
        analyticsSystem.updateAnalyticsDisplay();
      }
    }
  });
  
  document.getElementById('sidebar-notifications')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    const notificationsPanel = document.getElementById('notifications-panel');
    if (notificationsPanel) {
      notificationsPanel.classList.add('active');
      if (typeof notificationSystem?.renderNotifications === 'function') {
        notificationSystem.renderNotifications();
      }
    }
  });
  
  document.getElementById('sidebar-badges')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
    if (!window.currentUser) {
      if (typeof toast !== 'undefined') toast.warning('Please sign in to view badges');
      return;
    }
    const badgesModal = document.getElementById('badges-modal');
    if (badgesModal) {
      badgesModal.classList.add('active');
      if (typeof loadUserBadges === 'function') loadUserBadges();
    }
  });
  
  document.getElementById('sidebar-create')?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    const { data } = await supabaseAuth.auth.getSession();
    if (!data?.session) {
      if (typeof toast !== 'undefined') toast.warning('Please sign in to upload content');
      window.location.href = `login.html?redirect=creator-upload.html`;
    } else {
      window.location.href = 'creator-upload.html';
    }
  });
  
  document.getElementById('sidebar-dashboard')?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    const { data } = await supabaseAuth.auth.getSession();
    if (!data?.session) {
      if (typeof toast !== 'undefined') toast.warning('Please sign in to access dashboard');
      window.location.href = `login.html?redirect=creator-dashboard.html`;
    } else {
      window.location.href = 'creator-dashboard.html';
    }
  });
}

function setupSidebarThemeToggle() {
  const themeToggle = document.getElementById('sidebar-theme-toggle');
  if (!themeToggle) return;
  
  themeToggle.addEventListener('click', () => {
    closeSidebar();
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
      themeSelector.classList.toggle('active');
    }
  });
}

function setupSidebarScaleControls() {
  if (!window.uiScaleController) return;
  
  const decreaseBtn = document.getElementById('sidebar-scale-decrease');
  const increaseBtn = document.getElementById('sidebar-scale-increase');
  const resetBtn = document.getElementById('sidebar-scale-reset');
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      window.uiScaleController.decrease();
    });
  }
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      window.uiScaleController.increase();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.uiScaleController.reset();
    });
  }
}

function closeSidebar() {
  const sidebarMenu = document.getElementById('sidebar-menu');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarMenu) sidebarMenu.classList.remove('active');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// ✅ UI SCALE CONTROLLER
// ============================================
class UIScaleController {
  constructor() {
    this.scaleKey = 'bantu_ui_scale';
    this.scales = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5];
    this.currentIndex = 2;
  }

  init() {
    const savedScale = localStorage.getItem(this.scaleKey);
    if (savedScale) {
      this.currentIndex = this.scales.indexOf(parseFloat(savedScale));
      if (this.currentIndex === -1) this.currentIndex = 2;
    }
    this.applyScale();
    this.setupEventListeners();
    console.log('🎨 UI Scale Controller initialized');
  }

  setupEventListeners() {
    const decreaseBtn = document.getElementById('scale-decrease');
    const increaseBtn = document.getElementById('scale-increase');
    const resetBtn = document.getElementById('scale-reset');

    if (decreaseBtn) {
      decreaseBtn.addEventListener('click', () => this.decrease());
    }

    if (increaseBtn) {
      increaseBtn.addEventListener('click', () => this.increase());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }
  }

  applyScale() {
    const scale = this.scales[this.currentIndex];
    document.documentElement.style.setProperty('--ui-scale', scale);
    localStorage.setItem(this.scaleKey, scale);
    this.updateScaleDisplay();
    document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale } }));
    console.log(`📏 UI Scale set to: ${scale}x`);
  }

  updateScaleDisplay() {
    const scaleValue = document.getElementById('scale-value');
    const sidebarScaleValue = document.getElementById('sidebar-scale-value');
    const percentage = Math.round(this.getScale() * 100) + '%';
    
    if (scaleValue) scaleValue.textContent = percentage;
    if (sidebarScaleValue) sidebarScaleValue.textContent = percentage;
  }

  getScale() {
    return this.scales[this.currentIndex];
  }

  increase() {
    if (this.currentIndex < this.scales.length - 1) {
      this.currentIndex++;
      this.applyScale();
      this.showScaleToast();
    }
  }

  decrease() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.applyScale();
      this.showScaleToast();
    }
  }

  reset() {
    this.currentIndex = 2;
    this.applyScale();
    this.showScaleToast();
  }

  showScaleToast() {
    const percentage = Math.round(this.getScale() * 100);
    if (typeof toast !== 'undefined') {
      toast.info(`UI Size: ${percentage}%`);
    }
  }
}

// ============================================
// ✅ BADGES SYSTEM
// ============================================
async function initBadgesSystem() {
  const badgesModal = document.getElementById('badges-modal');
  const closeBadges = document.getElementById('close-badges');

  if (!badgesModal) return;

  if (closeBadges) {
    closeBadges.addEventListener('click', () => {
      badgesModal.classList.remove('active');
    });
  }

  let badgesBtn = document.getElementById('nav-badges-btn');
  if (!badgesBtn) {
    const navContainer = document.querySelector('.navigation-button');
    if (navContainer) {
      badgesBtn = document.createElement('div');
      badgesBtn.className = 'nav-icon';
      badgesBtn.id = 'nav-badges-btn';
      badgesBtn.innerHTML = '<i class="fas fa-medal"></i>';
      badgesBtn.title = 'My Badges';
      navContainer.appendChild(badgesBtn);
    }
  }

  if (badgesBtn) {
    badgesBtn.addEventListener('click', () => {
      if (!window.currentUser) {
        if (typeof toast !== 'undefined') {
          toast.warning('Please sign in to view your badges');
        }
        return;
      }
      badgesModal.classList.add('active');
      loadUserBadges();
    });
  }

  badgesModal.addEventListener('click', (e) => {
    if (e.target === badgesModal) {
      badgesModal.classList.remove('active');
    }
  });
}

async function loadUserBadges() {
  if (!window.currentUser) return;

  try {
    const client = getSupabaseClient();
    let userBadges = [];

    if (client) {
      const { data, error } = await client
        .from('user_badges')
        .select('*')
        .eq('user_id', window.currentUser.id);

      if (error) throw error;
      userBadges = data || [];
    }

    const allBadges = [
      { id: 'music', name: 'Music Explorer', icon: 'fa-music', description: 'Watched 5+ music videos', requirement: 5 },
      { id: 'stem', name: 'STEM Seeker', icon: 'fa-microscope', description: 'Explored 5+ STEM videos', requirement: 5 },
      { id: 'culture', name: 'Cultural Curator', icon: 'fa-drum', description: 'Explored 5+ Culture videos', requirement: 5 },
      { id: 'news', name: 'News Junkie', icon: 'fa-newspaper', description: 'Watched 5+ news videos', requirement: 5 },
      { id: 'sports', name: 'Sports Fanatic', icon: 'fa-futbol', description: 'Watched 5+ sports videos', requirement: 5 },
      { id: 'movies', name: 'Movie Buff', icon: 'fa-film', description: 'Watched 5+ movies', requirement: 5 },
      { id: 'docs', name: 'Documentary Lover', icon: 'fa-clapperboard', description: 'Watched 5+ documentaries', requirement: 5 },
      { id: 'podcasts', name: 'Podcast Pro', icon: 'fa-podcast', description: 'Listened to 5+ podcasts', requirement: 5 },
      { id: 'shorts', name: 'Quick Bites Master', icon: 'fa-bolt', description: 'Watched 10+ shorts', requirement: 10 },
      { id: 'connector', name: 'Social Butterfly', icon: 'fa-handshake', description: 'Connected with 10+ creators', requirement: 10 },
      { id: 'polyglot', name: 'Language Explorer', icon: 'fa-language', description: 'Watched content in 3+ languages', requirement: 3 }
    ];

    const badgesGrid = document.getElementById('badges-grid');
    const badgesEarned = document.getElementById('badges-earned');

    badgesGrid.innerHTML = allBadges.map(badge => {
      const earned = userBadges.some(b => b.badge_name === badge.name);
      return `
        <div class="badge-item ${earned ? 'earned' : 'locked'}">
          <div class="badge-icon ${earned ? 'earned' : ''}">
            <i class="fas ${badge.icon}"></i>
          </div>
          <div class="badge-info">
            <h4>${badge.name}</h4>
            <p>${badge.description}</p>
            ${earned ?
              `<span class="badge-earned-date">Earned!</span>` :
              `<span class="badge-requirement">Watch ${badge.requirement} videos</span>`
            }
          </div>
        </div>
      `;
    }).join('');

    if (badgesEarned) {
      badgesEarned.textContent = userBadges.length;
    }
  } catch (error) {
    console.error('Error loading badges:', error);
  }
}

// ============================================
// ✅ TIP SYSTEM
// ============================================
function setupTipSystem() {
  const tipModal = document.getElementById('tip-modal');
  const closeTip = document.getElementById('close-tip');
  const sendTip = document.getElementById('send-tip');

  if (!tipModal) return;

  document.addEventListener('click', (e) => {
    if (e.target.closest('.tip-creator-btn')) {
      const btn = e.target.closest('.tip-creator-btn');
      const creatorId = btn.dataset.creatorId;
      const creatorName = btn.dataset.creatorName;
      openTipModal(creatorId, creatorName);
    }
  });

  if (closeTip) {
    closeTip.addEventListener('click', () => {
      tipModal.classList.remove('active');
    });
  }

  document.querySelectorAll('.tip-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const customAmount = document.getElementById('custom-amount');
      if (btn.dataset.amount === 'custom') {
        customAmount.style.display = 'block';
      } else {
        customAmount.style.display = 'none';
      }
    });
  });

  if (sendTip) {
    sendTip.addEventListener('click', async () => {
      const selectedOption = document.querySelector('.tip-option.selected');
      if (!selectedOption) {
        if (typeof toast !== 'undefined') {
          toast.warning('Please select an amount');
        }
        return;
      }

      let amount = selectedOption.dataset.amount;
      if (amount === 'custom') {
        amount = document.getElementById('custom-tip-amount').value;
        if (!amount || amount < 1) {
          if (typeof toast !== 'undefined') {
            toast.warning('Please enter a valid amount');
          }
          return;
        }
      }

      const message = document.getElementById('tip-message').value;
      const creatorId = tipModal.dataset.creatorId;

      if (!window.currentUser) {
        if (typeof toast !== 'undefined') {
          toast.warning('Please sign in to send tips');
        }
        return;
      }

      try {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client
            .from('tips')
            .insert({
              sender_id: window.currentUser.id,
              recipient_id: creatorId,
              amount: parseFloat(amount),
              message: message,
              status: 'completed'
            });

          if (error) throw error;
        }

        if (typeof toast !== 'undefined') {
          toast.success('Thank you for supporting this creator!');
        }
        tipModal.classList.remove('active');

        document.getElementById('tip-message').value = '';
        document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
        document.getElementById('custom-amount').style.display = 'none';
      } catch (error) {
        console.error('Error sending tip:', error);
        if (typeof toast !== 'undefined') {
          toast.error('Failed to send tip');
        }
      }
    });
  }

  tipModal.addEventListener('click', (e) => {
    if (e.target === tipModal) {
      tipModal.classList.remove('active');
    }
  });
}

function openTipModal(creatorId, creatorName) {
  const tipModal = document.getElementById('tip-modal');
  const creatorInfo = document.getElementById('tip-creator-info');

  tipModal.dataset.creatorId = creatorId;
  creatorInfo.innerHTML = `
    <h3>${escapeHtml(creatorName)}</h3>
    <p>Show your appreciation with a tip</p>
  `;

  tipModal.classList.add('active');
}

// ============================================
// ✅ VOICE SEARCH
// ============================================
function setupVoiceSearch() {
  const voiceSearchBtn = document.getElementById('voice-search-btn');
  const voiceStatus = document.getElementById('voice-search-status');
  const voiceStatusText = document.getElementById('voice-status-text');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (voiceSearchBtn) voiceSearchBtn.style.display = 'none';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-ZA';

  const startVoiceSearch = () => {
    if (!window.currentUser) {
      if (typeof toast !== 'undefined') {
        toast.warning('Please sign in to use voice search');
      }
      return;
    }
    recognition.start();
    if (voiceStatus) {
      voiceStatus.classList.add('active');
      voiceStatusText.textContent = 'Listening...';
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = transcript;
      const event = new Event('input', { bubbles: true });
      searchInput.dispatchEvent(event);
    }
    if (voiceStatus) {
      voiceStatus.classList.remove('active');
    }
    if (typeof toast !== 'undefined') {
      toast.info(`Searching: "${transcript}"`);
    }
  };

  recognition.onerror = (event) => {
    console.error('Voice search error:', event.error);
    if (voiceStatus) {
      voiceStatus.classList.remove('active');
    }
    if (event.error === 'not-allowed') {
      if (typeof toast !== 'undefined') {
        toast.error('Microphone access denied');
      }
    }
  };

  recognition.onend = () => {
    if (voiceStatus) {
      voiceStatus.classList.remove('active');
    }
  };

  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', startVoiceSearch);
  }
}

// ============================================
// ✅ INITIALIZE ALL FEATURES
// ============================================
function initializeAllFeatures() {
  console.log('🚀 Initializing Home Feed with ALL explore-screen features...');
  
  if (typeof videoPreviewSystem !== 'undefined') {
    videoPreviewSystem.init();
  }
  
  setupLanguageFilter();
  loadCommunityStats();
  initVideoHero();
  loadShorts();
  setupVideoPreviews();
  setupSidebar();
  initBadgesSystem();
  setupTipSystem();
  setupVoiceSearch();
  
  window.uiScaleController = new UIScaleController();
  window.uiScaleController.init();
  
  if (typeof updateTrendingContent === 'function') updateTrendingContent();
  if (typeof updateNewContent === 'function') updateNewContent();
  if (typeof updateCommunityFavorites === 'function') updateCommunityFavorites();
  
  console.log('✅ All features initialized — home-feed now matches explore-screen!');
}

// ============================================
// ✅ CREATE AND EXPORT INSTANCES
// ============================================
const videoPreviewSystem = new VideoPreviewSystem();

// ============================================
// ✅ GLOBAL EXPORTS
// ============================================
window.cacheManager = new CacheManager();
window.queryBatcher = new QueryBatcher();
window.contentMetrics = new Map();
window.videoPreviewSystem = videoPreviewSystem;
window.uiScaleController = window.uiScaleController || new UIScaleController();

window.renderContentCards = renderContentCards;
window.updateTrendingContent = updateTrendingContent;
window.updateNewContent = updateNewContent;
window.updateCommunityFavorites = updateCommunityFavorites;
window.setupVideoPreviews = setupVideoPreviews;
window.loadContentMetrics = loadContentMetrics;
window.loadConnectorCounts = loadConnectorCounts;
window.updateConnectorCountsOnCards = updateConnectorCountsOnCards;
window.loadShorts = loadShorts;
window.setupLanguageFilter = setupLanguageFilter;
window.loadCommunityStats = loadCommunityStats;
window.initVideoHero = initVideoHero;
window.setupSidebar = setupSidebar;
window.initBadgesSystem = initBadgesSystem;
window.setupTipSystem = setupTipSystem;
window.setupVoiceSearch = setupVoiceSearch;
window.formatNumber = formatNumber;
window.truncateText = truncateText;
window.escapeHtml = escapeHtml;
window.getInitials = getInitials;
window.fixMediaUrl = fixMediaUrl;
window.getSupabaseClient = getSupabaseClient;

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAllFeatures);
} else {
  initializeAllFeatures();
}

console.log('✅ Home Feed Features fully loaded with explore-screen integration');
