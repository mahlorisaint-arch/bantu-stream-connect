/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN CORE v5.0
 * REAL DATA INTEGRATION - No Mock Data
 * Supabase client is initialized inline in explore-screen.html before this file loads.
 */

// ============================================
// 1. GLOBAL STATE
// ============================================
window.appState = {
  currentUser: null,
  currentProfile: null,
  featuredCreators: [],
  culturalMovements: [],
  isLoading: false,
  cachedData: new Map()
};

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// ============================================
// 2. ENGAGEMENT ENRICHMENT (content_engagement_stats is the only working
//    source for views/likes on anon reads - Content.views_count/likes_count
//    don't exist as columns, and content_views is RLS-blocked for anon)
// ============================================
async function enrichWithEngagement(items) {
  if (!items || items.length === 0) return items;
  const ids = items.map(item => item.id).filter(Boolean);
  if (ids.length === 0) return items;

  try {
    const { data: engagementData } = await window.supabaseClient
      .from('content_engagement_stats')
      .select('content_id, total_views, total_likes')
      .in('content_id', ids);

    const engagementMap = new Map((engagementData || []).map(e => [e.content_id, e]));
    return items.map(item => {
      const engagement = engagementMap.get(item.id) || {};
      return {
        ...item,
        real_views: engagement.total_views || 0,
        real_likes: engagement.total_likes || 0
      };
    });
  } catch (error) {
    console.error('Error enriching engagement data:', error);
    return items.map(item => ({ ...item, real_views: 0, real_likes: 0 }));
  }
}

// ============================================
// 3. REAL DATA FETCHERS
// ============================================

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
 * Get content by world/type, enriched with real engagement counts
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
        created_at,
        duration,
        content_type,
        moods,
        tags
      `)
      .eq('status', 'published')
      .eq('content_type', contentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return await enrichWithEngagement(data || []);

  } catch (error) {
    console.error(`Error fetching content by type ${contentType}:`, error);
    return [];
  }
}

/**
 * Get platform stats. Total views is summed from content_engagement_stats
 * (the real, anon-readable aggregate) rather than counting content_views
 * rows directly, since that table's RLS returns nothing to anon reads.
 */
async function fetchPlatformStats() {
  try {
    if (!window.supabaseClient) return null;

    const [contentRes, creatorsRes, engagementRes] = await Promise.all([
      window.supabaseClient.from('Content').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      window.supabaseClient.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator'),
      window.supabaseClient.from('content_engagement_stats').select('total_views')
    ]);

    const totalViews = (engagementRes.data || []).reduce((sum, row) => sum + (row.total_views || 0), 0);

    return {
      totalContent: contentRes.count || 0,
      totalCreators: creatorsRes.count || 0,
      totalViews
    };

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return null;
  }
}

// ============================================
// 4. UTILITY FUNCTIONS
// ============================================
window.showToast = window.showToast || function(message, type = 'info') {
  const container = document.getElementById('toast-container');
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
  fetchFeaturedCreators,
  fetchCulturalMovements,
  getContentByType,
  fetchPlatformStats,
  enrichWithEngagement
};

console.log('Explore Screen Core v5.0 Loaded - REAL DATA MODE');
console.log('Supabase client ready:', !!window.supabaseClient);
console.log('Fetchers registered:', Object.keys(window.fetchers).length);
