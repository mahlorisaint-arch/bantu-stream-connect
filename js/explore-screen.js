/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN CORE
 * File: js/explore-screen.js
 * Purpose: Supabase initialization, global state, and REST client helper.
 * Note: All UI rendering, event listeners, and feature logic is handled in explore-screen-features.js
 */

// ============================================
// 1. SUPABASE CONFIGURATION & AUTH CLIENT
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase Auth Client safely
if (typeof window.supabase !== 'undefined') {
  window.supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase Auth client initialized');
} else {
  console.error('❌ Supabase SDK not loaded. Ensure CDN is accessible.');
}

// ============================================
// 2. GLOBAL STATE VARIABLES
// ============================================
// Core App State
window.currentUser = null;
window.notifications = [];
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;
window.currentCategory = 'All';
window.languageFilter = 'all';

// UI/Performance State
window.isSidebarOpen = false;
window.lastFetchTimestamp = null;
window.exploreCache = new Map(); // Simple in-memory cache for session

// Categories Fallback (used if DB fetch fails)
window.categoriesList = [
  'All', 'Music', 'STEM', 'Culture', 'News', 'Sports', 
  'Movies', 'Documentaries', 'Podcasts', 'Shorts'
];

// South African Languages Mapping
window.languageMap = {
  'en': 'English', 'zu': 'IsiZulu', 'xh': 'IsiXhosa', 'af': 'Afrikaans',
  'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
  've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
};

// ============================================
// 3. CONTENT SUPABASE CLIENT (REST Helper)
// ============================================
// Used for direct REST API queries, batch processing, and media URL normalization.
class ContentSupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  /**
   * Perform a direct REST query to Supabase
   * @param {string} table - Table name (e.g., 'Content', 'user_profiles')
   * @param {object} options - Query options: select, where, orderBy, order, limit, offset
   */
  async query(table, options = {}) {
    const { 
      select = '*', 
      where = {}, 
      orderBy = 'created_at', 
      order = 'desc', 
      limit = 100, 
      offset = 0 
    } = options;

    let queryUrl = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    
    // Apply WHERE filters
    Object.keys(where).forEach(key => { 
      queryUrl += `&${key}=eq.${encodeURIComponent(where[key])}`; 
    });
    
    // Apply ordering & pagination
    if (orderBy) queryUrl += `&order=${orderBy}.${order}`;
    queryUrl += `&limit=${limit}&offset=${offset}`;
    
    try {
      const response = await fetch(queryUrl, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact' // Optional: if you need total counts
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Supabase REST query failed on [${table}]:`, error);
      return [];
    }
  }

  /**
   * Normalizes relative Supabase storage URLs to absolute public URLs
   * @param {string} url - Raw URL from database
   * @returns {string} - Fully qualified URL
   */
  fixMediaUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http')) return url;
    if (url.includes('supabase.co')) return url;
    // Remove leading slash if present to avoid double slashes
    const cleanPath = url.replace(/^\/+/, '');
    return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${cleanPath}`;
  }

  /**
   * Batch fetch helper to avoid N+1 query limits
   * @param {string} table 
   * @param {Array} ids 
   * @param {string} field 
   * @returns {Promise<Array>}
   */
  async batchQuery(table, ids, field = 'id') {
    if (!ids || ids.length === 0) return [];
    // Supabase REST supports comma-separated IN clauses up to a limit (~1000)
    const idsChunk = ids.slice(0, 1000);
    const queryUrl = `${this.url}/rest/v1/${table}?select=*&${field}=in.(${idsChunk.join(',')})`;
    
    try {
      const response = await fetch(queryUrl, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });
      return response.ok ? await response.json() : [];
    } catch (error) {
      console.error('Batch query failed:', error);
      return [];
    }
  }
}

// Initialize and expose globally
const contentSupabase = new ContentSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.contentSupabase = contentSupabase;
console.log('✅ Content Supabase client initialized');

// ============================================
// 4. CORE UTILITY EXPORTS
// ============================================
// Makes debugging easier from browser console
window.getExploreState = () => ({
  user: window.currentUser ? window.currentUser.email : 'Guest',
  language: window.languageFilter,
  category: window.currentCategory,
  page: window.currentPage,
  cacheSize: window.exploreCache.size
});

console.log('🚀 Explore Screen Core Loaded - Ready for Features');
