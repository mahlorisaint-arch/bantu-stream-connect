(function() {
  'use strict';

  // ===== SUPABASE CONFIGURATION =====
  const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Expose to shared components
  window.supabaseClient = supabase;
  window.supabaseAuth = supabase;

  // ===== GLOBAL STATE =====
  window.currentUser = null;
  let currentFilter = 'all';

  // ===== CONTENT FORMAT CONSTANTS =====
  const FILM_SERIES_FORMATS = ['film', 'documentary', 'series_episode', 'short', 'long_form'];
  const SHORT_FORMATS = ['short'];

  // ===== HELPER FUNCTIONS (Reused from creator-channel) =====
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDurationLong(seconds) {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function fixMediaUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=225&fit=crop';
    if (url.startsWith('http')) return url;
    return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
  }

  const CONTENT_FORMAT_META = {
    film: { label: 'Film', color: '#EF4444' },
    documentary: { label: 'Documentary', color: '#8B5CF6' },
    series_episode: { label: 'Series', color: '#10B981' },
    short: { label: 'Short', color: '#EC4899' },
    long_form: { label: 'Video', color: '#1D4ED8' }
  };

  function formatMeta(contentFormat) {
    return CONTENT_FORMAT_META[contentFormat] || { label: 'Content', color: '#94A3B8' };
  }

  // ===== BUILD CARD HTML =====
  function buildStandardCardHTML(item) {
    const meta = formatMeta(item.content_format);
    const isLeavingSoon = Math.random() > 0.85; // Simulated logic, replace with real date check
    const leavingSoonBadge = isLeavingSoon ? `<span class="upload-card__badge leaving-soon">Leaving soon</span>` : '';
    
    return `
      <div class="upload-card" data-content-id="${item.id}" tabindex="0" role="link">
        <div class="upload-card__thumb" style="background-image: url(${fixMediaUrl(item.thumbnail_url)});">
          ${leavingSoonBadge}
          <span class="upload-card__badge" style="background: ${meta.color}; color: white;">${meta.label}</span>
          ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
          <div class="media-hover-play"><i class="fas fa-play"></i></div>
        </div>
        <p class="upload-card__title">${escapeHtml(item.title)}</p>
        <p class="upload-card__meta">
          <i class="fas fa-eye"></i> ${formatNumber(item.total_views || 0)} views
       3.  **Filter Chips**: Click handlers that dynamically filter the displayed rows without reloading the page.
4.  **Shared Components**: Fully integrated with your existing header, sidebar, bottom nav, search, and notifications.
