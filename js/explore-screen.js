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

// Initialize Supabase Auth Client safely and attach to window globally
if (typeof window.supabase !== 'undefined') {
  window.supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase Auth client initialized and attached to window');
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
   * @returns {Promise<Array>}
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
console.log('✅ Content Supabase client initialized and attached to window');

// ============================================
// 4. HELPER UTILITIES (CORE ONLY)
// ============================================

/**
 * Format numbers with K/M suffixes
 * @param {number} num - Raw number
 * @returns {string} - Formatted string (e.g., "1.2K", "3.4M")
 */
window.formatNumber = function(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Truncate text to max length with ellipsis
 * @param {string} text - Original text
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string}
 */
window.truncateText = function(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Raw text
 * @returns {string} - Escaped HTML
 */
window.escapeHtml = function(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Get initials from a name (max 2 characters)
 * @param {string} name - Full name
 * @returns {string} - Uppercase initials
 */
window.getInitials = function(name) {
  if (!name || name.trim() === '') return '?';
  const names = name.trim().split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
};

/**
 * Format date to relative time (Today, Yesterday, X days ago)
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
window.formatRelativeDate = function(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
window.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ============================================
// 5. CACHE MANAGEMENT UTILITIES
// ============================================

/**
 * Cache Manager Class for session-based caching
 */
class ExploreCacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Set a cache item
   * @param {string} key - Cache key
   * @param {any} data - Data to store
   * @param {number} ttl - Time to live in ms (optional)
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get a cache item if not expired
   * @param {string} key - Cache key
   * @returns {any|null}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  /**
   * Check if cache contains a valid key
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear entire cache or specific key
   * @param {string} key - Optional specific key to clear
   */
  clear(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get current cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }
}

// Initialize cache manager and attach to window
window.exploreCacheManager = new ExploreCacheManager();
// Also keep legacy exploreCache reference for compatibility
window.exploreCache = window.exploreCacheManager;

// ============================================
// 6. EXPOSE GLOBAL STATE GETTER (Debug)
// ============================================
window.getExploreState = () => ({
  user: window.currentUser ? window.currentUser.email : 'Guest',
  userId: window.currentUser?.id || null,
  isAuthenticated: !!window.currentUser,
  language: window.languageFilter,
  category: window.currentCategory,
  page: window.currentPage,
  hasMoreContent: window.hasMoreContent,
  cacheSize: window.exploreCacheManager.size,
  lastFetch: window.lastFetchTimestamp
});

// ============================================
// 7. INITIALIZATION LOGGING
// ============================================
console.log('🚀 Explore Screen Core Loaded');
console.log('📦 Cache Manager Ready');
console.log('🔑 Auth Status:', window.supabaseAuth ? 'Initialized' : 'Pending');
console.log('📡 Content API:', window.contentSupabase ? 'Ready' : 'Failed');
console.log('🌍 Language Map:', Object.keys(window.languageMap).length, 'languages');
