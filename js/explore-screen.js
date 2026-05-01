/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN CORE v4.0
 * REAL DATA INTEGRATION - No Mock Data
 */

// ============================================
// 1. SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client (check if not already defined)
if (typeof window.supabaseClient === 'undefined') {
  if (typeof window.supabase !== 'undefined') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase SDK not loaded');
    window.supabaseClient = null;
  }
}

// ============================================
// 2. GLOBAL STATE
// ============================================
window.appState = {
  currentUser: null,
  currentProfile: null,
  languageFilter: 'all',
  trendingContent: [],
  featuredCreators: [],
  liveStreams: [],
  culturalMovements: [],
  genres: [],
  isLoading: false,
  cachedData: new Map()
};

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// ============================================
// 3. REAL DATA FETCHERS
// ============================================

/**
 * Fetch trending content with momentum scores
 */
async function fetchTrendingContent(limit = 12) {
  const cacheKey = 'trending_content';
  const cached = window.appState.cachedData.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    if (!window.supabaseClient) throw new Error('Supabase not initialized');
    
    // Fetch from mv_trending_scores materialized view (pre-calculated)
    const { data: trendingData, error: trendingError } = await window.supabaseClient
      .from('mv_trending_scores')
      .select('*')
      .order('trending_score', { ascending: false })
      .limit(limit);
    
    if (trendingError) throw trendingError;
    
    // If no data from mv_trending_scores, fallback to Content table
    if (!trendingData || trendingData.length === 0) {
      const { data: contentData, error: contentError } = await window.supabaseClient
        .from('Content')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          genre,
          views_count,
          likes_count,
          shares_count,
          comments_count,
          created_at,
          duration,
          creator_display_name,
          user_id,
          content_type,
          moods,
          tags,
          country,
          region,
          is_bantu_original
        `)
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (contentError) throw contentError;
      
      const processed = (contentData || []).map(item => ({
        ...item,
        trending_score: (item.views_count || 0) * 1 + 
                        (item.likes_count || 0) * 3 + 
                        (item.shares_count || 0) * 5,
        content_type: item.content_type || item.genre || 'video'
      }));
      
      window.appState.cachedData.set(cacheKey, { data: processed, timestamp: Date.now() });
      window.appState.trendingContent = processed;
      return processed;
    }
    
    // Enrich with full Content data
    const contentIds = trendingData.map(t => t.content_id);
    const { data: contentDetails, error: detailsError } = await window.supabaseClient
      .from('Content')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        genre,
        views_count,
        likes_count,
        shares_count,
        comments_count,
        created_at,
        duration,
        creator_display_name,
        user_id,
        content_type,
        moods,
        tags,
        country,
        region,
        is_bantu_original
      `)
      .in('id', contentIds)
      .eq('status', 'published');
    
    if (detailsError) throw detailsError;
    
    const contentMap = new Map();
    (contentDetails || []).forEach(c => contentMap.set(c.id, c));
    
    const enriched = trendingData.map(trend => ({
      ...contentMap.get(trend.content_id),
      trending_score: trend.trending_score,
      global_rank: trend.global_rank
    })).filter(item => item.id);
    
    window.appState.cachedData.set(cacheKey, { data: enriched, timestamp: Date.now() });
    window.appState.trendingContent = enriched;
    return enriched;
    
  } catch (error) {
    console.error('Error fetching trending content:', error);
    return [];
  }
}

/**
 * Fetch featured creators (verified + high momentum)
 */
async function fetchFeaturedCreators(limit = 12) {
  const cacheKey = 'featured_creators';
  const cached = window.appState.cachedData.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    if (!window.supabaseClient) throw new Error('Supabase not initialized');
    
    // Fetch from creator_pulse_score for trending creators
    const { data: pulseData, error: pulseError } = await window.supabaseClient
      .from('creator_pulse_score')
      .select(`
        creator_id,
        final_pulse_score,
        velocity_score,
        momentum_score,
        trend_stage,
        trend_label,
        global_rank
      `)
      .order('final_pulse_score', { ascending: false })
      .limit(limit);
    
    if (pulseError) throw pulseError;
    
    if (!pulseData || pulseData.length === 0) {
      // Fallback to user_profiles
      const { data: profiles, error: profileError } = await window.supabaseClient
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, bio, location, role')
        .eq('role', 'creator')
        .limit(limit);
      
      if (profileError) throw profileError;
      
      window.appState.cachedData.set(cacheKey, { data: profiles || [], timestamp: Date.now() });
      window.appState.featuredCreators = profiles || [];
      return profiles || [];
    }
    
    // Get creator details
    const creatorIds = pulseData.map(p => p.creator_id);
    const { data: profiles, error: profileError } = await window.supabaseClient
      .from('user_profiles')
      .select('id, username, full_name, avatar_url, bio, location, role')
      .in('id', creatorIds);
    
    if (profileError) throw profileError;
    
    const profileMap = new Map();
    (profiles || []).forEach(p => profileMap.set(p.id, p));
    
    const enriched = pulseData.map(pulse => ({
      ...profileMap.get(pulse.creator_id),
      pulse_score: pulse.final_pulse_score,
      velocity_score: pulse.velocity_score,
      trend_stage: pulse.trend_stage,
      trend_label: pulse.trend_label,
      global_rank: pulse.global_rank
    })).filter(item => item.id);
    
    window.appState.cachedData.set(cacheKey, { data: enriched, timestamp: Date.now() });
    window.appState.featuredCreators = enriched;
    return enriched;
    
  } catch (error) {
    console.error('Error fetching featured creators:', error);
    return [];
  }
}

/**
 * Fetch live streams from Content table
 */
async function fetchLiveStreams(limit = 6) {
  const cacheKey = 'live_streams';
  const cached = window.appState.cachedData.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    if (!window.supabaseClient) throw new Error('Supabase not initialized');
    
    // Check for live content
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        creator_display_name,
        user_id,
        live_views,
        created_at,
        content_type,
        tags,
        views_count
      `)
      .eq('media_type', 'live')
      .eq('status', 'published')
      .order('live_views', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // If no live streams, get recent popular content as "live-like"
    if (!data || data.length === 0) {
      const { data: popular, error: popError } = await window.supabaseClient
        .from('Content')
        .select(`id, title, description, thumbnail_url, creator_display_name, user_id, views_count, created_at, content_type`)
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(limit);
      
      if (popError) throw popError;
      
      const processed = (popular || []).map(item => ({ ...item, is_live: false }));
      window.appState.cachedData.set(cacheKey, { data: processed, timestamp: Date.now() });
      window.appState.liveStreams = processed;
      return processed;
    }
    
    const processed = data.map(item => ({ ...item, is_live: true }));
    window.appState.cachedData.set(cacheKey, { data: processed, timestamp: Date.now() });
    window.appState.liveStreams = processed;
    return processed;
    
  } catch (error) {
    console.error('Error fetching live streams:', error);
    return [];
  }
}

/**
 * Fetch genres for discovery worlds
 */
async function fetchGenres() {
  const cacheKey = 'genres';
  const cached = window.appState.cachedData.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    if (!window.supabaseClient) throw new Error('Supabase not initialized');
    
    const { data, error } = await window.supabaseClient
      .from('genres')
      .select('id, name, slug, description, origin_region, origin_city, is_active, metadata')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    window.appState.cachedData.set(cacheKey, { data: data || [], timestamp: Date.now() });
    window.appState.genres = data || [];
    return data || [];
    
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
}

/**
 * Fetch cultural movements
 */
async function fetchCulturalMovements(limit = 6) {
  const cacheKey = 'cultural_movements';
  const cached = window.appState.cachedData.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    if (!window.supabaseClient) throw new Error('Supabase not initialized');
    
    const { data, error } = await window.supabaseClient
      .from('movements')
      .select('id, name, slug, description, era_start, era_end, region, city, is_active, metadata')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    
    window.appState.cachedData.set(cacheKey, { data: data || [], timestamp: Date.now() });
    window.appState.culturalMovements = data || [];
    return data || [];
    
  } catch (error) {
    console.error('Error fetching cultural movements:', error);
    return [];
  }
}

/**
 * Search content across multiple tables
 */
async function searchContent(query, category = null) {
  if (!query || query.length < 2) return [];
  
  try {
    if (!window.supabaseClient) return [];
    
    let searchQuery = window.supabaseClient
      .from('Content')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        creator_display_name,
        genre,
        views_count,
        created_at,
        content_type,
        tags
      `)
      .eq('status', 'published')
      .ilike('title', `%${query}%`);
    
    if (category && category !== 'all') {
      searchQuery = searchQuery.eq('genre', category);
    }
    
    const { data, error } = await searchQuery.limit(20);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Get content by world/type
 */
async function getContentByType(contentType, limit = 10) {
  try {
    if (!window.supabaseClient) return [];
    
    const { data, error } = await window.supabaseClient
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
        shares_count,
        created_at,
        duration,
        content_type,
        moods,
        tags
      `)
      .eq('status', 'published')
      .eq('content_type', contentType)
      .order('views_count', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error(`Error fetching content by type ${contentType}:`, error);
    return [];
  }
}

/**
 * Get platform stats
 */
async function fetchPlatformStats() {
  try {
    if (!window.supabaseClient) return { totalContent: 0, totalCreators: 0, totalViews: 0 };
    
    const [contentRes, creatorsRes, viewsRes] = await Promise.all([
      window.supabaseClient.from('Content').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      window.supabaseClient.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator'),
      window.supabaseClient.from('content_views').select('id', { count: 'exact', head: true }).eq('counted_as_view', true)
    ]);
    
    return {
      totalContent: contentRes.count || 0,
      totalCreators: creatorsRes.count || 0,
      totalViews: viewsRes.count || 0
    };
    
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return { totalContent: 0, totalCreators: 0, totalViews: 0 };
  }
}

/**
 * Get trending by region
 */
async function getTrendingByRegion(region, limit = 5) {
  try {
    if (!window.supabaseClient) return [];
    
    const { data, error } = await window.supabaseClient
      .from('Content')
      .select(`id, title, thumbnail_url, region, views_count, creator_display_name`)
      .eq('status', 'published')
      .eq('region', region)
      .order('views_count', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error(`Error fetching trending by region ${region}:`, error);
    return [];
  }
}

// ============================================
// 4. UTILITY FUNCTIONS
// ============================================
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

window.formatNumber = function(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

window.formatRelativeTime = function(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
};

window.escapeHtml = function(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Register fetchers to window BEFORE features file loads
window.fetchers = {
  fetchTrendingContent,
  fetchFeaturedCreators,
  fetchLiveStreams,
  fetchGenres,
  fetchCulturalMovements,
  searchContent,
  getContentByType,
  fetchPlatformStats,
  getTrendingByRegion
};

console.log('🚀 Explore Screen Core v4.0 Loaded - REAL DATA MODE');
console.log('📡 Supabase client ready:', !!window.supabaseClient);
console.log('🔧 Fetchers registered:', Object.keys(window.fetchers).length);
