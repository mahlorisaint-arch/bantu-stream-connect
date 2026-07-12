(function() {
// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL STATE =====
window.currentUser = null;
window.notifications = [];
window.creatorId = null;
window.creatorProfile = null;
window.isConnected = false;
window.connectorCount = 0;
window.creatorContent = [];
window.playlists = [];
window.loadingText = null;
window.currentPlaylist = null;
window.playlistItems = [];
window.creatorLibrary = [];
window.currentTab = 'home';
window.streakCount = 0;
window.creatorRecord = null;

// ===== CONTENT FORMAT CONSTANTS =====
const FILM_FORMATS = ['film', 'documentary'];
const MUSIC_FORMATS = ['album_track', 'music', 'music_video', 'song', 'track', 'audio'];

// ===== HELPER FUNCTIONS =====
function showToast(message, type = 'info') {
const container = document.getElementById('toast-container');
if (!container) return;
const toast = document.createElement('div');
toast.className = `toast ${type}`;
const icons = {error:'fa-exclamation-triangle', success:'fa-check-circle', warning:'fa-exclamation-circle', info:'fa-info-circle'};
toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${escapeHtml(message)}</span>`;
container.appendChild(toast);
setTimeout(() => {
toast.style.opacity = '0';
toast.style.transform = 'translateX(100%)';
setTimeout(() => toast.remove(), 300);
}, 3000);
}

function formatNumber(num) {
if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
if (num >= 1000) return (num/1000).toFixed(1) + 'K';
return num.toString();
}

function truncateText(text, maxLength) {
if (!text) return '';
return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
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
const date = new Date(dateString);
const now = new Date();
const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
if (diffDays === 0) return 'Today';
if (diffDays === 1) return 'Yesterday';
if (diffDays < 7) return `${diffDays} days ago`;
if (diffDays < 30) return `${Math.floor(diffDays/7)} week${Math.floor(diffDays/7)>1?'s':''} ago`;
return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
} catch { return ''; }
}

function formatTimeAgo(dateString) {
if (!dateString) return 'Just now';
const diffMs = Date.now() - new Date(dateString).getTime();
const diffMins = Math.floor(diffMs/60000);
const diffHours = Math.floor(diffMs/3600000);
const diffDays = Math.floor(diffMs/86400000);
if (diffMins < 1) return 'Just now';
if (diffMins < 60) return `${diffMins}m ago`;
if (diffHours < 24) return `${diffHours}h ago`;
if (diffDays < 7) return `${diffDays}d ago`;
return new Date(dateString).toLocaleDateString();
}

function getInitials(name) {
if (!name || name.trim() === '') return '?';
const names = name.trim().split(' ');
return names.length >= 2 ? (names[0][0] + names[names.length-1][0]).toUpperCase() : name[0].toUpperCase();
}

function fixMediaUrl(url) {
if (!url) return '';
if (url.startsWith('http')) return url;
if (url.startsWith('data:')) return url;
return `${SUPABASE_URL}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
}

function showConfetti() {
const colors = ['#F59E0B', '#1D4ED8', '#10B981', '#EC4899', '#8B5CF6'];
for (let i = 0; i < 50; i++) {
const confetti = document.createElement('div');
confetti.className = 'confetti';
confetti.style.left = Math.random() * 100 + 'vw';
confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
confetti.style.animationDelay = Math.random() * 0.5 + 's';
document.body.appendChild(confetti);
setTimeout(() => confetti.remove(), 3000);
}
}

function formatDuration(seconds) {
if (!seconds) return '0:00';
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== CONTENT FORMAT LABELS AND COLORS =====
const CONTENT_FORMAT_META = {
  film: { label: 'Film', color: '#EF4444' },
  documentary: { label: 'Documentary', color: '#8B5CF6' },
  series_episode: { label: 'Series', color: '#10B981' },
  podcast_episode: { label: 'Podcast', color: '#7F77DD' },
  short: { label: 'Short', color: '#EC4899' },
  long_form: { label: 'Video', color: '#1D4ED8' },
  album_track: { label: 'Music', color: '#F59E0B' },
  music: { label: 'Music', color: '#F59E0B' },
  music_video: { label: 'Music video', color: '#F59E0B' },
  song: { label: 'Music', color: '#F59E0B' },
  track: { label: 'Music', color: '#F59E0B' },
  audio: { label: 'Audio', color: '#94A3B8' }
};

function formatMeta(contentFormat) {
  return CONTENT_FORMAT_META[contentFormat] || { label: 'Content', color: '#94A3B8' };
}

// ===== REAL CONTENT MIX =====
function computeContentMixReal(content) {
  if (!content || content.length === 0) return [];
  const counts = {};
  content.forEach(item => {
    const key = item.content_format || 'long_form';
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = content.length;
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count, pct: Math.round((count / total) * 100), meta: formatMeta(key) }))
    .sort((a, b) => b.count - a.count);
}

// ===== REAL UPLOAD STREAK =====
function computeUploadStreak(content) {
  if (!content || content.length === 0) return 0;
  const uploadDays = new Set(content.filter(c => c.created_at).map(c => new Date(c.created_at).toISOString().slice(0, 10)));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const oneDay = 86400000;
  const mostRecentDay = [...uploadDays].sort().reverse()[0];
  if (!mostRecentDay) return 0;
  const mostRecentDate = new Date(mostRecentDay);
  const daysSinceLastUpload = Math.floor((today - mostRecentDate) / oneDay);
  if (daysSinceLastUpload > 1) return 0;
  let streak = 0;
  let cursor = new Date(mostRecentDate);
  while (uploadDays.has(cursor.toISOString().slice(0, 10))) { streak++; cursor = new Date(cursor.getTime() - oneDay); }
  return streak;
}

// ===== REAL VIEW MILESTONES =====
const VIEW_MILESTONE_THRESHOLDS = [100, 1000, 10000, 100000];

async function computeViewMilestones(creatorId) {
  try {
    const { data, error } = await supabase
      .from('content_views')
      .select('created_at')
      .eq('creator_id', creatorId)
      .eq('counted_as_view', true)
      .order('created_at', { ascending: true })
      .limit(50000);
    if (error) throw error;

    const rows = data || [];
    const milestones = [];
    VIEW_MILESTONE_THRESHOLDS.forEach(threshold => {
      if (rows.length >= threshold) {
        milestones.push({ threshold, date: rows[threshold - 1].created_at });
      }
    });
    return milestones;
  } catch (e) {
    console.warn('Could not compute view milestones:', e.message);
    return [];
  }
}

// ===== FETCH THE creators ROW =====
async function loadCreatorRecord() {
  try {
    const { data, error } = await supabase
      .from('creators')
      .select('is_founder, is_verified, is_creator_verified, is_journalist, is_educator, journalist_metadata')
      .eq('id', window.creatorId)
      .maybeSingle();
    if (error) throw error;
    window.creatorRecord = data || null;
  } catch (e) {
    console.warn('Could not load creators row (may not exist for this user yet):', e.message);
    window.creatorRecord = null;
  }
}

// ===== PHASE 5: LOAD CONTENT WITH ENGAGEMENT STATS =====
async function loadContentWithEngagementStats(creatorId, limit = 50) {
const { data, error } = await supabase
.from('Content')
.select(`
id,
title,
description,
thumbnail_url,
file_url,
duration,
media_type,
content_format,
genre,
created_at,
user_id,
is_pinned,
is_channel_trailer,
status,
live_views,
favorites_count,
comments_count,
shares_count,
is_bantu_original,
user_profiles!user_id (
id,
full_name,
username,
avatar_url
),
content_engagement_stats (
total_views,
total_likes,
total_comments,
total_shares,
total_valid_views
)
`)
.eq('user_id', creatorId)
.eq('status', 'published')
.order('created_at', { ascending: false })
.limit(limit);

if (error) {
console.error('Error loading content with engagement stats:', error);
return [];
}

return (data || []).map(item => ({
...item,
views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
likes_count: item.content_engagement_stats?.total_likes || 0,
comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
shares_count: item.content_engagement_stats?.total_shares || item.shares_count || 0,
favorites_count: item.favorites_count || 0,
valid_views_count: item.content_engagement_stats?.total_valid_views || 0,
completion_rate: item.content_engagement_stats?.completion_rate || 0
}));
}

// ===== LOAD PLAYLISTS WITH JUNCTION TABLE =====
async function loadPlaylistsWithItems(creatorId) {
console.log('🔄 Loading playlists using TWO-QUERY approach...');
let playlistsQuery = supabase
.from('creator_playlists')
.select('*')
.eq('creator_id', creatorId);

if (!window.currentUser || window.currentUser.id !== creatorId) {
playlistsQuery = playlistsQuery.eq('visibility', 'public');
}

const { data: playlistsData, error: playlistsError } = await playlistsQuery.order('created_at', { ascending: false });

if (playlistsError || !playlistsData || playlistsData.length === 0) {
return [];
}

const playlistIds = playlistsData.map(p => p.id);

const { data: playlistContentsRows, error: contentsError } = await supabase
.from('playlist_contents')
.select(`
id,
playlist_id,
content_id,
sort_index,
item_type,
track_number,
disc_number,
season_number,
display_title_override
`)
.in('playlist_id', playlistIds)
.order('sort_index', { ascending: true });

if (contentsError || !playlistContentsRows || playlistContentsRows.length === 0) {
return playlistsData.map(playlist => ({
...playlist,
playlist_contents: [],
item_count: 0
}));
}

const contentIds = [...new Set(playlistContentsRows.map(row => row.content_id).filter(Boolean))];

if (contentIds.length === 0) {
return playlistsData.map(playlist => ({
...playlist,
playlist_contents: [],
item_count: 0
}));
}

const { data: contentRows, error: contentError } = await supabase
.from('Content')
.select(`
id,
title,
thumbnail_url,
duration,
media_type,
content_format,
status,
live_views,
favorites_count,
comments_count,
content_engagement_stats (
total_views,
total_likes
)
`)
.in('id', contentIds)
.eq('status', 'published');

if (contentError) {
return playlistsData.map(playlist => ({
...playlist,
playlist_contents: [],
item_count: 0
}));
}

const contentMap = new Map();
(contentRows || []).forEach(content => {
contentMap.set(String(content.id), {
...content,
views_count: content.content_engagement_stats?.total_views || content.live_views || 0,
likes_count: content.content_engagement_stats?.total_likes || 0,
favorites_count: content.favorites_count || 0
});
});

const itemsByPlaylist = {};
playlistContentsRows.forEach(row => {
const content = contentMap.get(String(row.content_id));
if (!content) return;

if (!itemsByPlaylist[row.playlist_id]) {
itemsByPlaylist[row.playlist_id] = [];
}

itemsByPlaylist[row.playlist_id].push({
...row,
Content: content
});
});

Object.keys(itemsByPlaylist).forEach(playlistId => {
itemsByPlaylist[playlistId].sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
});

return playlistsData.map(playlist => ({
...playlist,
playlist_contents: itemsByPlaylist[playlist.id] || [],
item_count: itemsByPlaylist[playlist.id]?.length || 0
}));
}

// ===== THEME SYSTEM =====
function initThemeSystem() {
console.log('🎨 Initializing theme system...');
const sidebarThemeToggle = document.getElementById('sidebar-theme-toggle');
const themeSelector = document.getElementById('theme-selector');

if (!sidebarThemeToggle || !themeSelector) {
console.warn('Theme elements not found');
return;
}

const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
applyTheme(savedTheme);

const newToggle = sidebarThemeToggle.cloneNode(true);
sidebarThemeToggle.parentNode.replaceChild(newToggle, sidebarThemeToggle);

newToggle.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
themeSelector.classList.toggle('active');
});

const themeOptions = document.querySelectorAll('.theme-option');
themeOptions.forEach(option => {
const newOption = option.cloneNode(true);
option.parentNode.replaceChild(newOption, option);

newOption.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
const theme = this.dataset.theme;
applyTheme(theme);
themeSelector.classList.remove('active');
});
});

document.addEventListener('click', function(e) {
if (themeSelector.classList.contains('active') &&
!themeSelector.contains(e.target) &&
e.target !== newToggle &&
!newToggle.contains(e.target)) {
themeSelector.classList.remove('active');
}
});
}

function applyTheme(theme) {
if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
theme = 'dark';
}

document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
document.body.classList.add(`theme-${theme}`);
document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
document.documentElement.classList.add(`theme-${theme}`);

const root = document.documentElement;

if (theme === 'light') {
root.style.setProperty('--deep-black', '#F8FAFC');
root.style.setProperty('--deep-navy', '#E2E8F0');
root.style.setProperty('--soft-white', '#0F172A');
root.style.setProperty('--slate-grey', '#475569');
root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.85)');
root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
root.style.setProperty('--bantu-blue', '#1D4ED8');
root.style.setProperty('--warm-gold', '#F59E0B');
} else if (theme === 'high-contrast') {
root.style.setProperty('--deep-black', '#000000');
root.style.setProperty('--deep-navy', '#050505');
root.style.setProperty('--soft-white', '#FFFFFF');
root.style.setProperty('--slate-grey', '#CCCCCC');
root.style.setProperty('--bantu-blue', '#FFD700');
root.style.setProperty('--warm-gold', '#00FFFF');
root.style.setProperty('--card-bg', '#0A0A0A');
root.style.setProperty('--card-border', '#FFFFFF');
} else {
root.style.setProperty('--deep-black', '#0A0E12');
root.style.setProperty('--deep-navy', '#0F172A');
root.style.setProperty('--soft-white', '#F8FAFC');
root.style.setProperty('--slate-grey', '#94A3B8');
root.style.setProperty('--bantu-blue', '#1D4ED8');
root.style.setProperty('--warm-gold', '#F59E0B');
root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.6)');
root.style.setProperty('--card-border', 'rgba(148, 163, 184, 0.2)');
}

localStorage.setItem('bantu_theme', theme);

document.querySelectorAll('.theme-option').forEach(option => {
if (option.dataset.theme === theme) {
option.classList.add('active');
} else {
option.classList.remove('active');
}
});
}

// ===== UI SCALE CONTROLS =====
class UIScaleController {
constructor() {
this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
this.minScale = 0.8;
this.maxScale = 1.4;
this.step = 0.1;
}

init() {
this.applyScale();
this.setupEventListeners();
}

setupEventListeners() {
document.addEventListener('scaleChanged', (e) => {
this.updateScaleDisplay(e.detail.scale);
});
}

applyScale() {
document.documentElement.style.setProperty('--ui-scale', this.scale);
localStorage.setItem('bantu_ui_scale', this.scale.toString());
document.dispatchEvent(new CustomEvent('scaleChanged', { detail: { scale: this.scale } }));
}

increase() {
if (this.scale < this.maxScale) {
this.scale = Math.min(this.maxScale, this.scale + this.step);
this.applyScale();
}
}

decrease() {
if (this.scale > this.minScale) {
this.scale = Math.max(this.minScale, this.scale - this.step);
this.applyScale();
}
}

reset() {
this.scale = 1;
this.applyScale();
}

getScale() { return this.scale; }

updateScaleDisplay(scale) {
const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
displays.forEach(el => {
if (el) el.textContent = Math.round(scale * 100) + '%';
});
}
}

function setupScaleControls() {
const decreaseBtn = document.getElementById('sidebar-scale-decrease');
const increaseBtn = document.getElementById('sidebar-scale-increase');
const resetBtn = document.getElementById('sidebar-scale-reset');

if (decreaseBtn) {
decreaseBtn.addEventListener('click', () => {
if (window.uiScaleController) window.uiScaleController.decrease();
});
}

if (increaseBtn) {
increaseBtn.addEventListener('click', () => {
if (window.uiScaleController) window.uiScaleController.increase();
});
}

if (resetBtn) {
resetBtn.addEventListener('click', () => {
if (window.uiScaleController) window.uiScaleController.reset();
});
}
}

// ===== SIDEBAR SETUP =====
function setupSidebar() {
const menuToggle = document.getElementById('menu-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarMenu = document.getElementById('sidebar-menu');

if (!menuToggle || !sidebarClose || !sidebarOverlay || !sidebarMenu) return;

const openSidebar = () => {
sidebarMenu.classList.add('active');
sidebarOverlay.classList.add('active');
document.body.style.overflow = 'hidden';
};

const closeSidebar = () => {
sidebarMenu.classList.remove('active');
sidebarOverlay.classList.remove('active');
document.body.style.overflow = '';
};

menuToggle.addEventListener('click', (e) => {
e.preventDefault();
e.stopPropagation();
openSidebar();
});

sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) closeSidebar();
});
}

// ===== NAVIGATION BUTTONS =====
function setupNavigationButtons() {
const navHome = document.getElementById('nav-home-btn');
if (navHome) {
navHome.addEventListener('click', (e) => {
e.preventDefault();
window.location.href = 'index.html';
});
}

const navHistory = document.getElementById('nav-history-btn');
if (navHistory) {
navHistory.addEventListener('click', async (e) => {
e.preventDefault();
if (!window.currentUser) {
showToast('Please sign in to view watch history', 'warning');
window.location.href = `login.html?redirect=watch-history.html`;
return;
}
window.location.href = 'watch-history.html';
});
}

const navCreate = document.getElementById('nav-create-btn');
if (navCreate) {
navCreate.addEventListener('click', async (e) => {
e.preventDefault();
const { data } = await supabase.auth.getSession();
if (data?.session) {
window.location.href = 'creator-upload.html';
} else {
showToast('Please sign in to create content', 'warning');
window.location.href = `login.html?redirect=creator-upload.html`;
}
});
}

const navMenu = document.getElementById('nav-menu-btn');
if (navMenu) {
navMenu.addEventListener('click', (e) => {
e.preventDefault();
e.stopPropagation();
const sidebarMenu = document.getElementById('sidebar-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
if (sidebarMenu && sidebarOverlay) {
sidebarMenu.classList.add('active');
sidebarOverlay.classList.add('active');
document.body.style.overflow = 'hidden';
}
});
}
}

// ===== BUILD UPLOAD CARD HTML WITH HOVER PLAY ICON =====
function buildUploadCardHTML(item) {
  const typeKey = normalizeContentType(item);
  const color = getTypeColor(typeKey);
  const textColor = getTypeTextColor(typeKey);
  const label = typeDisplayLabel(typeKey);
  const originalRibbon = item.is_bantu_original ? '<span class="upload-card__badge" style="right:5px;left:auto;background:var(--warm-gold);color:#1a1200;">Original</span>' : '';
  const isShort = item.content_format === 'short';
  const thumbClass = isShort ? 'upload-card__thumb upload-card__thumb--vertical' : 'upload-card__thumb';

  return `
    <div class="upload-card ${isShort ? 'upload-card--vertical' : ''}" data-content-id="${item.id}" tabindex="0" role="link">
      <div class="${thumbClass}" style="background-image:url(${fixMediaUrl(item.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop')});">
        <span class="upload-card__badge" style="background:${color};color:${textColor};">${escapeHtml(label)}</span>
        ${originalRibbon}
        <div class="media-hover-play"><i class="fas fa-play"></i></div>
        ${item.duration ? `<span class="upload-card__duration">${formatDuration(item.duration)}</span>` : ''}
      </div>
      <p class="upload-card__title">${escapeHtml(item.title || 'Untitled')}</p>
      <p class="upload-card__meta">${formatNumber(item.views_count || 0)} views · ${formatTimeAgo(item.created_at)}</p>
    </div>
  `;
}

function normalizeContentType(item) {
  return item.content_format || item.media_type || 'long_form';
}

function getTypeColor(typeKey) {
  const meta = CONTENT_FORMAT_META[typeKey];
  return meta ? meta.color : '#1D4ED8';
}

function getTypeTextColor(typeKey) {
  const darkBg = ['#1D4ED8', '#8B5CF6', '#EC4899', '#EF4444'];
  const color = getTypeColor(typeKey);
  return darkBg.includes(color) ? 'white' : '#1a1200';
}

function typeDisplayLabel(typeKey) {
  const meta = CONTENT_FORMAT_META[typeKey];
  return meta ? meta.label : typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
}

function attachUploadCardClicks(container) {
container.querySelectorAll('.upload-card').forEach(card => {
card.addEventListener('click', () => {
const id = card.dataset.contentId;
if (id) window.location.href = `content-detail.html?id=${id}`;
});
});
}

// ===== BUILD SHORT CARD HTML WITH HOVER PLAY ICON =====
function buildShortCardHTML(item) {
  const thumbUrl = fixMediaUrl(item.thumbnail_url || '');
  const plays = formatNumber(item.views_count || 0);

  return `
    <div class="short-card" data-content-id="${item.id}">
      <div class="short-card__thumb" style="${thumbUrl ? `background-image:url(${thumbUrl});` : ''}">
        ${item.is_pinned ? '<i class="fas fa-thumbtack short-card__pin"></i>' : ''}
        <div class="media-hover-play"><i class="fas fa-play"></i></div>
        <div class="short-card__plays"><i class="fas fa-play"></i>${plays}</div>
      </div>
      <p class="short-card__title">${escapeHtml(item.title || 'Untitled short')}</p>
    </div>
  `;
}

// ==========================================================================
// FILM TAB
// ==========================================================================

function renderFilmTab() {
  const grid = document.getElementById('film-content');
  const empty = document.getElementById('film-empty');
  const emptyText = document.getElementById('film-empty-text');
  if (!grid) return;

  const films = (window.creatorContent || []).filter(c => FILM_FORMATS.includes(c.content_format));

  if (films.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (emptyText) emptyText.textContent = window.isOwner ? 'You have not published any films yet' : 'This creator has not published any films or documentaries';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...films].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  grid.innerHTML = sorted.map(item => buildUploadCardHTML(item)).join('');
  attachUploadCardClicks(grid);
}

// ==========================================================================
// MUSIC TAB
// ==========================================================================

function renderMusicTab() {
  const grid = document.getElementById('music-content');
  const empty = document.getElementById('music-empty');
  const emptyText = document.getElementById('music-empty-text');
  if (!grid) return;

  const music = (window.creatorContent || []).filter(c => MUSIC_FORMATS.includes(c.content_format));

  if (music.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (emptyText) emptyText.textContent = window.isOwner ? 'You have not published any music yet' : 'This creator has not published any music';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...music].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  grid.innerHTML = sorted.map(item => buildUploadCardHTML(item)).join('');
  attachUploadCardClicks(grid);
}

// ==========================================================================
// TABS SETUP
// ==========================================================================

function setupTabs() {
const tabs = document.querySelectorAll('.channel-tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(tab => {
tab.addEventListener('click', () => {
const target = tab.dataset.tab;

tabs.forEach(t => {
t.classList.remove('is-active');
t.setAttribute('aria-selected', 'false');
});
tab.classList.add('is-active');
tab.setAttribute('aria-selected', 'true');

panels.forEach(panel => {
if (panel.dataset.panel === target) {
panel.hidden = false;
if (target === 'home') renderHomeTab();
else if (target === 'series') renderSeriesTab();
else if (target === 'film') renderFilmTab();
else if (target === 'music') renderMusicTab();
else if (target === 'shorts') renderShortsTab();
else if (target === 'community') renderCommunityTab();
else if (target === 'about') renderAboutTab();
} else {
panel.hidden = true;
}
});
window.currentTab = target;
});
});
}

// ==========================================================================
// HOME TAB — Renders all seven sections
// ==========================================================================

function renderHomeTab() {
renderFeaturedCard();
renderWorldRow();
renderUploadGrid();
renderHomeShortsRow();
renderHomePlaylistRow();
renderHomeFilmRow();
renderHomePulseRow();
renderHomeMusicRow();
}

// ===== HOME SHORTS ROW =====
function renderHomeShortsRow() {
  const section = document.getElementById('home-shorts-section');
  const row = document.getElementById('home-shorts-row');
  if (!section || !row) return;

  const shorts = (window.creatorContent || [])
    .filter(c => c.content_format === 'short')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  if (shorts.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  row.innerHTML = shorts.map(item => buildShortCardHTML(item)).join('');
  row.querySelectorAll('.short-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `shorts-detail.html?id=${id}`;
    });
  });
}

// ===== HOME PLAYLIST ROW =====
function renderHomePlaylistRow() {
  const section = document.getElementById('home-playlist-section');
  const row = document.getElementById('home-playlist-row');
  if (!section || !row) return;

  const playlists = [...(window.playlists || [])]
    .sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    })
    .slice(0, 8);

  if (playlists.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  row.innerHTML = playlists.map(p => buildCollectionCardHTML(p)).join('');
  row.querySelectorAll('.collection-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.playlistId;
      const type = card.dataset.playlistType;
      window.location.href = `content-detail.html?playlist_id=${id}&type=${type}`;
    });
  });
}

// ===== HOME FILM ROW =====
function renderHomeFilmRow() {
  const section = document.getElementById('home-film-section');
  const row = document.getElementById('home-film-row');
  if (!section || !row) return;

  const films = (window.creatorContent || [])
    .filter(c => FILM_FORMATS.includes(c.content_format))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  if (films.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  row.innerHTML = films.map(item => buildUploadCardHTML(item)).join('');
  attachUploadCardClicks(row);
}

// ===== HOME MUSIC ROW =====
function renderHomeMusicRow() {
  const section = document.getElementById('home-music-section');
  const row = document.getElementById('home-music-row');
  if (!section || !row) return;

  const music = (window.creatorContent || [])
    .filter(c => MUSIC_FORMATS.includes(c.content_format))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  if (music.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  row.innerHTML = music.map(item => buildUploadCardHTML(item)).join('');
  attachUploadCardClicks(row);
}

// ===== HOME PULSE ROW (non-interactive teaser) =====
async function renderHomePulseRow() {
  const section = document.getElementById('home-pulse-section');
  const row = document.getElementById('home-pulse-row');
  if (!section || !row) return;

  try {
    const { data: posts, error } = await supabase
      .from('pulse_posts')
      .select(`
        id, content, created_at,
        user_profiles!creator_id ( full_name, username, avatar_url )
      `)
      .eq('creator_id', window.creatorId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!posts || posts.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const post = posts[0];
    const creator = post.user_profiles || {};
    const name = creator.full_name || creator.username || 'Creator';
    const avatar = creator.avatar_url ? fixMediaUrl(creator.avatar_url) : null;

    row.innerHTML = `
      <div class="home-pulse-teaser">
        <div class="home-pulse-teaser__header">
          <div class="home-pulse-teaser__avatar" style="${avatar ? `background-image:url(${avatar});` : ''}"></div>
          <div>
            <p class="home-pulse-teaser__name">${escapeHtml(name)}</p>
            <span class="home-pulse-teaser__time">${formatTimeAgo(post.created_at)}</span>
          </div>
        </div>
        <p class="home-pulse-teaser__content">${escapeHtml(post.content)}</p>
      </div>
    `;
    row.querySelector('.home-pulse-teaser')?.addEventListener('click', () => {
      document.querySelector('.channel-tab[data-tab="community"]')?.click();
    });
  } catch (e) {
    console.warn('Could not load Home pulse teaser:', e.message);
    section.style.display = 'none';
  }
}

// ===== "SEE ALL" BUTTONS =====
function setupHomeSeeAllButtons() {
  document.querySelectorAll('.home-see-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.seeAll;
      document.querySelector(`.channel-tab[data-tab="${target}"]`)?.click();
    });
  });
}

// ===== RENDER FEATURED CARD =====
function renderFeaturedCard() {
const card = document.getElementById('featured-card');
if (!card) return;

const pinned = window.creatorContent.find(c => c.is_pinned === true);
const featured = pinned || (window.creatorContent.length > 0 ? window.creatorContent[0] : null);

if (!featured) {
card.style.display = 'none';
return;
}

const isShort = featured.content_format === 'short';
card.classList.toggle('featured-card--vertical', isShort);

card.style.display = 'block';
card.style.backgroundImage = `url(${fixMediaUrl(featured.thumbnail_url || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&h=450&fit=crop')})`;

const badge = document.getElementById('featured-badge');
if (badge) {
badge.textContent = featured.is_pinned ? '📌 Pinned' : 'New';
}

const duration = document.getElementById('featured-duration');
if (duration) {
duration.textContent = featured.duration ? formatDuration(featured.duration) : '0:00';
}

const title = document.getElementById('featured-title');
if (title) {
title.textContent = featured.title || 'Featured Content';
}

const meta = document.getElementById('featured-meta');
if (meta) {
meta.textContent = `${formatNumber(featured.views_count || 0)} views · ${formatTimeAgo(featured.created_at)}`;
}

card.onclick = () => {
window.location.href = isShort
? `shorts-detail.html?id=${featured.id}`
: `content-detail.html?id=${featured.id}`;
};
card.onkeydown = (e) => { if (e.key === 'Enter') card.onclick(); };
}

// ===== RENDER WORLD ROW =====
function renderWorldRow() {
const mobileRow = document.getElementById('world-row-mobile');
const desktopRow = document.getElementById('world-row-desktop');

if (!mobileRow && !desktopRow) return;

const genres = [...new Set(window.creatorContent.map(c => c.genre || c.content_format || 'Other'))];
const worldItems = genres.slice(0, 6).map(genre => ({
label: genre,
color: ['#26215C', '#04342C', '#4A1B0C', '#1D4ED8', '#F59E0B', '#EC4899'][Math.floor(Math.random() * 6)]
}));

if (worldItems.length === 0) {
if (mobileRow) mobileRow.style.display = 'none';
if (desktopRow) desktopRow.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">No content types yet</p>';
return;
}

const renderItems = (container) => {
if (!container) return;
container.innerHTML = worldItems.map(item => `
<div class="world-item">
<div class="world-item__thumb" style="background:${item.color};"></div>
<p class="world-item__label">${escapeHtml(item.label)}</p>
</div>
`).join('');
};

if (mobileRow) {
renderItems(mobileRow);
}

if (desktopRow) {
renderItems(desktopRow);
}
}

// ===== RENDER UPLOAD GRID =====
function renderUploadGrid() {
const grid = document.getElementById('upload-grid');
const noContent = document.getElementById('no-content');
if (!grid) return;

const content = window.creatorContent || [];
if (content.length === 0) {
grid.innerHTML = '';
if (noContent) noContent.style.display = 'block';
return;
}

if (noContent) noContent.style.display = 'none';

const sorted = [...content].sort((a, b) => {
if (a.is_pinned && !b.is_pinned) return -1;
if (!a.is_pinned && b.is_pinned) return 1;
return new Date(b.created_at) - new Date(a.created_at);
}).slice(0, 6);

grid.innerHTML = sorted.map(item => buildUploadCardHTML(item)).join('');
attachUploadCardClicks(grid);
}

// ==========================================================================
// SERIES TAB — REAL PLAYLIST DATA
// ==========================================================================

const PLAYLIST_TYPE_META = {
  series: { label: 'Series', icon: 'fa-tv' },
  album: { label: 'Album', icon: 'fa-compact-disc' },
  podcast: { label: 'Podcast', icon: 'fa-podcast' },
  course: { label: 'Course', icon: 'fa-graduation-cap' }
};

function playlistTypeMeta(type) {
  return PLAYLIST_TYPE_META[type] || { label: type ? escapeHtml(type) : 'Playlist', icon: 'fa-list' };
}

async function renderSeriesTab() {
  const grid = document.getElementById('collections-grid');
  const empty = document.getElementById('collections-empty');
  const emptyText = document.getElementById('collections-empty-text');
  if (!grid) return;

  grid.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading</p>';

  const playlists = window.playlists && window.playlists.length > 0
    ? window.playlists
    : await loadPlaylistsWithItems(window.creatorId);

  if (playlists.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (emptyText) {
      emptyText.textContent = window.isOwner
        ? 'You have not published any playlists yet'
        : 'This creator has not published any playlists';
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...playlists].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  grid.innerHTML = sorted.map(playlist => buildCollectionCardHTML(playlist)).join('');

  grid.querySelectorAll('.collection-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.playlistId;
      const type = card.dataset.playlistType;
      window.location.href = `content-detail.html?playlist_id=${id}&type=${type}`;
    });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.click(); });
  });
}

function buildCollectionCardHTML(playlist) {
  const type = playlist.playlist_type || 'playlist';
  const meta = playlistTypeMeta(type);
  const itemCount = playlist.playlist_contents?.length || 0;
  const thumbnail = getCollectionThumbnail(playlist);
  const badgeClass = PLAYLIST_TYPE_META[type] ? type : 'playlist';

  const featuredRibbon = playlist.is_featured
    ? '<span class="collection-featured-ribbon"><i class="fas fa-star"></i>Featured</span>'
    : '';

  const metaParts = [`${itemCount} item${itemCount === 1 ? '' : 's'}`];
  const seasons = seasonCount(playlist);
  if (seasons) metaParts.push(`${seasons} seasons`);
  if (playlist.total_duration) metaParts.push(formatDuration(playlist.total_duration));
  if (playlist.play_count > 0) metaParts.push(`${formatNumber(playlist.play_count)} plays`);
  if (playlist.connectors_count > 0) metaParts.push(`${formatNumber(playlist.connectors_count)} saves`);

  return `
    <div class="collection-card" data-playlist-id="${playlist.id}" data-playlist-type="${type}">
      <div class="collection-thumb-wrapper">
        <img src="${thumbnail}" alt="${escapeHtml(playlist.name)}" loading="lazy">
        <div class="collection-overlay"><i class="fas fa-play"></i></div>
        ${featuredRibbon}
        <span class="collection-type-badge ${badgeClass}"><i class="fas ${meta.icon}"></i>${meta.label}</span>
        <span class="collection-count-badge"><i class="fas fa-list"></i>${itemCount}</span>
      </div>
      <p class="collection-title">${escapeHtml(playlist.name)}</p>
      <p class="collection-meta">${metaParts.map(p => `<span>${p}</span>`).join('')}</p>
    </div>
  `;
}

function orderedPlaylistItems(playlist) {
  const items = playlist.playlist_contents || [];
  if (playlist.sort_order === 'episode_number') {
    return [...items].sort((a, b) => {
      const at = a.track_number, bt = b.track_number;
      if (at != null && bt != null && at !== bt) return at - bt;
      if (at != null && bt == null) return -1;
      if (at == null && bt != null) return 1;
      return (a.sort_index || 0) - (b.sort_index || 0);
    });
  }
  return [...items].sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
}

function seasonCount(playlist) {
  if ((playlist.playlist_type || 'playlist') !== 'series') return null;
  const seasons = new Set((playlist.playlist_contents || []).map(i => i.season_number || 1));
  return seasons.size > 1 ? seasons.size : null;
}

function getCollectionThumbnail(playlist) {
  if (playlist.custom_thumbnail_url) return fixMediaUrl(playlist.custom_thumbnail_url);
  const firstItem = orderedPlaylistItems(playlist)[0]?.Content;
  if (firstItem?.thumbnail_url) return fixMediaUrl(firstItem.thumbnail_url);
  return 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=225&fit=crop';
}

// ==========================================================================
// SHORTS TAB — REAL DATA
// ==========================================================================

function renderShortsTab() {
  const grid = document.getElementById('shorts-content');
  const empty = document.getElementById('shorts-empty');
  const emptyText = document.getElementById('shorts-empty-text');
  if (!grid) return;

  const shorts = (window.creatorContent || []).filter(c => c.content_format === 'short');

  if (shorts.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (emptyText) {
      emptyText.textContent = window.isOwner
        ? 'You have not published any shorts yet'
        : 'This creator has not published any shorts';
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...shorts].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  grid.innerHTML = sorted.map(item => buildShortCardHTML(item)).join('');

  grid.querySelectorAll('.short-card').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    card.addEventListener('click', () => {
      const id = card.dataset.contentId;
      if (id) window.location.href = `shorts-detail.html?id=${id}`;
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.click(); });
  });
}

// ==========================================================================
// COMMUNITY TAB — Pulse Integration
// ==========================================================================

const ChannelPulse = {
  reactionCounts: {},
  repostCounts: {},
  commentCounts: {},
  userReactions: {},
  userReposts: {},
  pollCache: {},

  async load() {
    const feedEl = document.getElementById('community-pulse-feed');
    if (!feedEl) return;

    feedEl.innerHTML = this.skeletonHTML();

    try {
      const { data: posts, error } = await supabase
        .from('pulse_posts')
        .select(`
          id, content, post_type, created_at, visibility, is_pinned,
          creator_id,
          user_profiles!creator_id ( id, username, full_name, avatar_url ),
          pulse_smart_links ( id, link_type, target_content_id, external_url, cta_text ),
          pulse_post_media ( id, media_url, media_type, order_index )
        `)
        .eq('creator_id', window.creatorId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!posts || posts.length === 0) {
        feedEl.innerHTML = this.emptyStateHTML();
        this.wireEmptyState();
        renderLeaderboardFromPulse([]);
        return;
      }

      await this.loadCounts(posts);
      await this.preloadPollsFor(posts.filter(p => p.post_type === 'poll'));
      this.renderFeed(posts, feedEl);
      renderLeaderboardFromPulse(posts);

    } catch (e) {
      console.error('Error loading channel pulse feed:', e);
      feedEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px;">Could not load community posts</p>';
    }
  },

  skeletonHTML() {
    return Array.from({ length: 2 }).map(() => `
      <div class="pulse-skeleton">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    `).join('');
  },

  emptyStateHTML() {
    return `
      <div class="empty-pulse">
        <i class="fas fa-newspaper" style="font-size:40px;color:var(--slate-grey);"></i>
        <p style="color:var(--slate-grey);margin-top:12px;font-size:13px;">
          ${window.isOwner ? "You haven't posted an update yet." : "No community posts yet."}
        </p>
      </div>
    `;
  },

  wireEmptyState() {
    // Placeholder for future inline CTA
  },

  async loadCounts(posts) {
    for (const post of posts) {
      const id = post.id;
      try {
        const { count: reactions } = await supabase
          .from('pulse_post_reactions').select('id', { count: 'exact', head: true })
          .eq('post_id', id).eq('reaction_type', 'fire');
        this.reactionCounts[id] = reactions || 0;

        if (window.currentUser) {
          const { data: ur } = await supabase
            .from('pulse_post_reactions').select('id')
            .eq('post_id', id).eq('user_id', window.currentUser.id).eq('reaction_type', 'fire').maybeSingle();
          this.userReactions[id] = !!ur;
        } else {
          this.userReactions[id] = false;
        }

        const { count: reposts } = await supabase
          .from('pulse_post_reposts').select('id', { count: 'exact', head: true }).eq('post_id', id);
        this.repostCounts[id] = reposts || 0;

        if (window.currentUser) {
          const { data: urp } = await supabase
            .from('pulse_post_reposts').select('id')
            .eq('post_id', id).eq('user_id', window.currentUser.id).maybeSingle();
          this.userReposts[id] = !!urp;
        } else {
          this.userReposts[id] = false;
        }

        const { count: comments } = await supabase
          .from('pulse_post_comments').select('id', { count: 'exact', head: true }).eq('post_id', id);
        this.commentCounts[id] = comments || 0;
      } catch (e) {
        console.warn(`Could not load counts for pulse post ${id}:`, e);
        this.reactionCounts[id] = this.reactionCounts[id] || 0;
        this.repostCounts[id] = this.repostCounts[id] || 0;
        this.commentCounts[id] = this.commentCounts[id] || 0;
      }
    }
  },

  async preloadPollsFor(pollPosts) {
    for (const post of pollPosts) {
      try {
        const { data: poll, error: pollError } = await supabase
          .from('pulse_post_polls')
          .select('*')
          .eq('post_id', post.id)
          .maybeSingle();

        if (pollError || !poll) {
          this.pollCache[post.id] = null;
          continue;
        }

        const { data: votes } = await supabase
          .from('pulse_poll_votes')
          .select('selected_option_index, user_id')
          .eq('poll_id', poll.id);

        const voteCounts = {};
        const totalVotes = (votes || []).length;
        (votes || []).forEach(v => {
          voteCounts[v.selected_option_index] = (voteCounts[v.selected_option_index] || 0) + 1;
        });

        const userVote = window.currentUser
          ? (votes || []).find(v => v.user_id === window.currentUser.id)
          : null;

        this.pollCache[post.id] = {
          pollId: poll.id,
          question: poll.question,
          options: poll.options,
          voteCounts,
          totalVotes,
          userVoteIndex: userVote ? userVote.selected_option_index : null,
          expiresAt: poll.ends_at
        };
      } catch (e) {
        console.warn(`Could not load poll for post ${post.id}:`, e);
        this.pollCache[post.id] = null;
      }
    }
  },

  renderFeed(posts, feedEl) {
    feedEl.innerHTML = '';
    posts.forEach(post => feedEl.appendChild(this.buildPostCard(post)));
  },

  buildPostCard(post) {
    const creator = post.user_profiles || { username: 'creator', full_name: 'Creator', avatar_url: null };
    const displayName = creator.full_name || creator.username || 'Creator';
    const avatarUrl = creator.avatar_url ? fixMediaUrl(creator.avatar_url) : null;
    const initials = displayName.charAt(0).toUpperCase();
    const id = post.id;

    const card = document.createElement('div');
    card.className = 'pulse-card';
    card.dataset.postId = id;

    const pinnedFlag = post.is_pinned ? '<span class="pulse-pinned-flag"><i class="fas fa-thumbtack"></i> Pinned</span>' : '';

    card.innerHTML = `
      <div class="pulse-header">
        <div class="pulse-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(displayName)}">` : initials}</div>
        <div class="pulse-creator-info">
          <h4>${escapeHtml(displayName)} ${pinnedFlag}</h4>
          <span>${formatTimeAgo(post.created_at)}</span>
        </div>
      </div>
      <div class="pulse-content">${escapeHtml(post.content)}</div>
      ${post.post_type === 'poll' ? this.buildPollHTML(post.id) : ''}
      ${this.buildMediaHTML(post.pulse_post_media)}
      ${this.buildSmartLinkHTML(post.pulse_smart_links?.[0])}
      <div class="pulse-actions">
        <button class="action-btn fire-btn ${this.userReactions[id] ? 'active' : ''}" data-id="${id}">
          <i class="fas fa-fire"></i> <span class="reaction-count">${this.reactionCounts[id] || 0}</span>
        </button>
        <button class="action-btn comment-btn" data-id="${id}">
          <i class="fas fa-comment"></i> <span class="comment-count">${this.commentCounts[id] || 0}</span>
        </button>
        <button class="action-btn repost-btn ${this.userReposts[id] ? 'active' : ''}" data-id="${id}">
          <i class="fas fa-retweet"></i> <span class="repost-count">${this.repostCounts[id] || 0}</span>
        </button>
        <button class="action-btn share-btn" data-id="${id}"><i class="fas fa-share"></i></button>
      </div>
    `;

    card.querySelector('.fire-btn')?.addEventListener('click', () => this.handleReaction(id));
    card.querySelector('.comment-btn')?.addEventListener('click', () => this.handleComment(id));
    card.querySelector('.repost-btn')?.addEventListener('click', () => this.handleRepost(id));
    card.querySelector('.share-btn')?.addEventListener('click', () => this.handleShare(id));

    if (post.post_type === 'poll') {
      card.querySelectorAll('.pulse-poll-option:not(.is-locked)').forEach(el => {
        el.addEventListener('click', () => this.castPollVote(id, Number(el.dataset.optionIndex)));
      });
    }

    const smartLinkEl = card.querySelector('.smart-link-card');
    const smartLinkData = post.pulse_smart_links?.[0];
    if (smartLinkEl && smartLinkData) {
      smartLinkEl.addEventListener('click', () => this.handleSmartLinkClick(smartLinkData));
    }

    return card;
  },

  buildPollHTML(postId) {
    const pollData = this.pollCache[postId];
    if (!pollData) return '';

    const hasVoted = pollData.userVoteIndex !== null;
    const expired = pollData.expiresAt ? new Date(pollData.expiresAt) < new Date() : false;
    const colors = ['#5DCAA5', '#7F77DD', '#F0997B', '#EF9F27'];

    const rows = pollData.options.map((opt, index) => {
      const optLabel = typeof opt === 'string' ? opt : (opt.text || opt.label || `Option ${index + 1}`);
      const count = pollData.voteCounts[index] || 0;
      const pct = pollData.totalVotes > 0 ? Math.round((count / pollData.totalVotes) * 100) : 0;
      const isUserChoice = pollData.userVoteIndex === index;
      
      return `
        <div class="pulse-poll-option ${hasVoted || expired ? 'is-locked' : ''}" data-option-index="${index}">
          <div class="pulse-poll-option__labels">
            <span>${escapeHtml(optLabel)}${isUserChoice ? ' <i class="fas fa-check" style="font-size:10px;"></i>' : ''}</span>
            ${hasVoted || expired ? `<span>${pct}%</span>` : ''}
          </div>
          ${hasVoted || expired ? `<div class="pulse-poll-option__track"><div class="pulse-poll-option__fill" style="width:${pct}%;background:${colors[index % colors.length]};"></div></div>` : ''}
        </div>
      `;
    }).join('');

    const metaText = `${formatNumber(pollData.totalVotes)} votes${expired ? ' · Poll closed' : (hasVoted ? ' · You voted' : ' · Tap an option to vote')}`;

    return `<div class="pulse-poll"><p style="font-weight:600;margin-bottom:8px;font-size:14px;">${escapeHtml(pollData.question)}</p>${rows}<span class="pulse-poll-meta">${metaText}</span></div>`;
  },

  buildMediaHTML(mediaArray) {
    if (!mediaArray || mediaArray.length === 0) return '';
    const media = mediaArray[0];
    if (media.media_type === 'image') {
      return `<div class="pulse-media"><img src="${fixMediaUrl(media.media_url)}" loading="lazy" onerror="this.style.display='none'"></div>`;
    }
    if (media.media_type === 'video') {
      return `<div class="pulse-media"><video controls preload="metadata"><source src="${fixMediaUrl(media.media_url)}"></video></div>`;
    }
    return '';
  },

  buildSmartLinkHTML(link) {
    if (!link) return '';
    const iconMap = { music: 'fa-music', video: 'fa-video', podcast: 'fa-podcast', playlist: 'fa-list', article: 'fa-newspaper' };
    const icon = iconMap[link.link_type] || 'fa-link';
    const ctaText = link.cta_text || `Open ${link.link_type}`;
    return `
      <div class="smart-link-card">
        <div class="smart-link-icon"><i class="fas ${icon}"></i></div>
        <div class="smart-link-info"><h5>${escapeHtml(link.link_type.toUpperCase())}</h5><p>${escapeHtml(ctaText)}</p></div>
        <div class="smart-link-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
    `;
  },

  async castPollVote(postId, optionIndex) {
    if (!window.currentUser) { showToast('Please sign in to vote', 'warning'); return; }
    const pollData = this.pollCache[postId];
    if (!pollData) return;
    if (pollData.userVoteIndex !== null) { showToast('You already voted', 'info'); return; }

    try {
      const { error } = await supabase.from('pulse_poll_votes').insert({
        poll_id: pollData.pollId,
        user_id: window.currentUser.id,
        selected_option_index: optionIndex
      });
      if (error) throw error;

      pollData.voteCounts[optionIndex] = (pollData.voteCounts[optionIndex] || 0) + 1;
      pollData.totalVotes++;
      pollData.userVoteIndex = optionIndex;

      const card = document.querySelector(`.pulse-card[data-post-id="${postId}"]`);
      const pollContainer = card?.querySelector('.pulse-poll');
      if (pollContainer) {
        pollContainer.outerHTML = this.buildPollHTML(postId);
        card.querySelectorAll('.pulse-poll-option:not(.is-locked)').forEach(el => {
          el.addEventListener('click', () => this.castPollVote(postId, Number(el.dataset.optionIndex)));
        });
      }
      showToast('Vote counted!', 'success');
    } catch (e) {
      console.error('Error voting:', e);
      showToast('Could not record your vote', 'error');
    }
  },

  async handleReaction(postId) {
    if (!window.currentUser) { showToast('Please sign in to react', 'warning'); return; }
    const btn = document.querySelector(`.fire-btn[data-id="${postId}"]`);
    if (!btn) return;
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.reaction-count');
    let count = parseInt(countSpan.textContent) || 0;

    try {
      if (wasActive) {
        const { error } = await supabase.from('pulse_post_reactions').delete()
          .eq('post_id', postId).eq('user_id', window.currentUser.id).eq('reaction_type', 'fire');
        if (error) throw error;
        btn.classList.remove('active'); count--; countSpan.textContent = count;
        this.userReactions[postId] = false; this.reactionCounts[postId] = count;
      } else {
        const { error } = await supabase.from('pulse_post_reactions').insert({
          post_id: postId, user_id: window.currentUser.id, reaction_type: 'fire'
        });
        if (error) throw error;
        btn.classList.add('active'); count++; countSpan.textContent = count;
        this.userReactions[postId] = true; this.reactionCounts[postId] = count;
      }
    } catch (e) {
      console.error('Reaction error:', e);
      showToast('Failed to update reaction', 'error');
    }
  },

  async handleRepost(postId) {
    if (!window.currentUser) { showToast('Please sign in to repost', 'warning'); return; }
    const btn = document.querySelector(`.repost-btn[data-id="${postId}"]`);
    if (!btn) return;
    const wasActive = btn.classList.contains('active');
    const countSpan = btn.querySelector('.repost-count');
    let count = parseInt(countSpan.textContent) || 0;

    try {
      if (wasActive) {
        const { error } = await supabase.from('pulse_post_reposts').delete()
          .eq('post_id', postId).eq('user_id', window.currentUser.id);
        if (error) throw error;
        btn.classList.remove('active'); count--; countSpan.textContent = count;
        this.userReposts[postId] = false; this.repostCounts[postId] = count;
      } else {
        const { error } = await supabase.from('pulse_post_reposts').insert({ post_id: postId, user_id: window.currentUser.id });
        if (error) throw error;
        btn.classList.add('active'); count++; countSpan.textContent = count;
        this.userReposts[postId] = true; this.repostCounts[postId] = count;
        showToast('Reposted to your profile!', 'success');
      }
    } catch (e) {
      console.error('Repost error:', e);
      showToast('Failed to update repost', 'error');
    }
  },

  async handleComment(postId) {
    if (!window.currentUser) { showToast('Please sign in to comment', 'warning'); return; }

    const { data: comments } = await supabase
      .from('pulse_post_comments')
      .select(`id, content, user_id, created_at, user_profiles!user_id ( full_name, username, avatar_url )`)
      .eq('post_id', postId).is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    const list = comments || [];
    const modalHtml = `
      <div id="pulse-comment-modal-${postId}" class="modal-overlay">
        <div class="modal-content" style="max-width:500px;">
          <div class="modal-header"><h3><i class="fas fa-comment"></i> Comments (${list.length})</h3><button class="modal-close">&times;</button></div>
          <div class="modal-body" style="max-height:400px;overflow-y:auto;">
            <div class="comments-list" style="margin-bottom:16px;">
              ${list.length === 0 ? '<p style="color:var(--slate-grey);text-align:center;">No comments yet</p>' : ''}
              ${list.map(c => {
                const author = c.user_profiles || {};
                const name = author.full_name || author.username || 'User';
                return `
                  <div class="comment-item" style="padding:12px;border-bottom:1px solid var(--card-border);">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${name.charAt(0).toUpperCase()}</div>
                      <div><strong style="font-size:13px;">${escapeHtml(name)}</strong><div style="font-size:10px;color:var(--slate-grey);">${formatTimeAgo(c.created_at)}</div></div>
                    </div>
                    <p style="font-size:13px;margin:0;">${escapeHtml(c.content)}</p>
                  </div>
                `;
              }).join('')}
            </div>
            <textarea id="pulse-comment-input-${postId}" placeholder="Write a comment..." rows="3" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--card-border);border-radius:12px;padding:12px;color:var(--soft-white);font-family:inherit;resize:vertical;"></textarea>
          </div>
          <div class="modal-footer"><button class="cancel-btn">Cancel</button><button class="submit-btn post-comment-btn">Post comment</button></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById(`pulse-comment-modal-${postId}`);
    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.cancel-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('.post-comment-btn').addEventListener('click', async () => {
      const input = document.getElementById(`pulse-comment-input-${postId}`);
      const text = input.value.trim();
      if (!text) { showToast('Write something first', 'warning'); return; }
      try {
        const { error } = await supabase.from('pulse_post_comments').insert({
          post_id: postId, user_id: window.currentUser.id, content: text, parent_comment_id: null
        });
        if (error) throw error;
        const newCount = (this.commentCounts[postId] || 0) + 1;
        this.commentCounts[postId] = newCount;
        const badge = document.querySelector(`.comment-btn[data-id="${postId}"] .comment-count`);
        if (badge) badge.textContent = newCount;
        showToast('Comment posted!', 'success');
        close();
      } catch (e) {
        console.error('Comment error:', e);
        showToast('Failed to post comment', 'error');
      }
    });
  },

  handleShare(postId) {
    const url = `${window.location.origin}/creator-channel.html?id=${window.creatorId}&post=${postId}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => showToast('Share: ' + url, 'info'));
  },

  handleSmartLinkClick(link) {
    if (!link) return;
    if (link.link_type === 'video' && link.target_content_id) window.location.href = `content-detail.html?id=${link.target_content_id}`;
    else if (link.link_type === 'article' && link.target_content_id) window.location.href = `insights-detail.html?id=${link.target_content_id}`;
    else if (link.external_url) window.open(link.external_url, '_blank', 'noopener');
    else showToast('Content coming soon!', 'info');
  }
};

// ===== REAL LEADERBOARD =====
async function renderLeaderboardFromPulse(posts) {
  const board = document.getElementById('leaderboard');
  if (!board) return;

  const postIds = posts.map(p => p.id);
  if (postIds.length === 0) {
    board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">No activity yet</p>';
    return;
  }

  try {
    const [{ data: reactions }, { data: comments }, { data: reposts }] = await Promise.all([
      supabase.from('pulse_post_reactions').select('user_id').in('post_id', postIds),
      supabase.from('pulse_post_comments').select('user_id').in('post_id', postIds),
      supabase.from('pulse_post_reposts').select('user_id').in('post_id', postIds)
    ]);

    const weights = { reaction: 1, comment: 2, repost: 3 };
    const scores = {};
    const tally = (rows, kind) => (rows || []).forEach(r => {
      if (!r.user_id) return;
      scores[r.user_id] = (scores[r.user_id] || 0) + weights[kind];
    });
    tally(reactions, 'reaction');
    tally(comments, 'comment');
    tally(reposts, 'repost');

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
      board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">No top voices yet</p>';
      return;
    }

    const userIds = sorted.map(([id]) => id);
    const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, username, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    board.innerHTML = sorted.map(([userId, score], index) => {
      const profile = profileMap[userId];
      const name = profile?.full_name || profile?.username || 'User';
      const avatar = profile?.avatar_url ? fixMediaUrl(profile.avatar_url) : null;
      return `
        <div class="leaderboard-row">
          <span class="leaderboard-rank">${index + 1}</span>
          <div class="leaderboard-avatar" style="${avatar ? `background-image:url(${avatar});background-size:cover;` : 'background:var(--bg-media);'}"></div>
          <div>
            <p class="leaderboard-name">${escapeHtml(name)}</p>
            <p class="leaderboard-meta">${score} engagement pt${score > 1 ? 's' : ''}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Error loading pulse-based leaderboard:', e);
    board.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Could not load leaderboard</p>';
  }
}

// ===== RENDER COMMUNITY TAB =====
function renderCommunityTab() {
  ChannelPulse.load();
}

// ==========================================================================
// ABOUT TAB — REAL DATA (v2: unboxed, professional)
// ==========================================================================

// ===== ABOUT IDENTITY — v2 (no badge chips, verified is plain inline) =====
function renderAboutIdentity() {
  const profile = window.creatorProfile || {};
  const record = window.creatorRecord || {};

  const bioText = document.getElementById('about-bio-text');
  if (bioText) bioText.textContent = profile.bio || 'This creator has not written a bio yet.';

  const missionEl = document.getElementById('about-mission-text');
  const mission = profile.creator_mission || profile.mission || profile.quote || null;
  if (missionEl) {
    if (mission) { missionEl.textContent = mission; missionEl.style.display = 'block'; }
    else missionEl.style.display = 'none';
  }

  const joinedText = document.getElementById('about-joined-text');
  if (joinedText) {
    const date = profile.created_at ? new Date(profile.created_at) : null;
    joinedText.textContent = date
      ? `Joined Bantu Stream Connect in ${date.toLocaleString('default', { month: 'long', year: 'numeric' })}`
      : 'Join date unavailable';
  }

  const locationItem = document.getElementById('about-location-item');
  const locationText = document.getElementById('about-location-text');
  if (locationItem && locationText) {
    if (profile.location) { locationText.textContent = profile.location; locationItem.style.display = 'inline-flex'; }
    else locationItem.style.display = 'none';
  }

  const verifiedItem = document.getElementById('about-verified-item');
  if (verifiedItem) {
    const isVerified = record.is_verified || record.is_creator_verified;
    verifiedItem.style.display = isVerified ? 'inline-flex' : 'none';
  }

  const linksRow = document.getElementById('about-links-row');
  const websiteLink = document.getElementById('about-website-link');
  const websiteText = document.getElementById('about-website-text');
  const scheduleChip = document.getElementById('about-schedule-chip');
  const scheduleText = document.getElementById('about-schedule-text');
  let hasLinks = false;

  if (profile.website_url && websiteLink && websiteText) {
    websiteLink.href = profile.website_url;
    websiteText.textContent = profile.website_url.replace(/^https?:\/\//, '');
    websiteLink.style.display = 'inline-flex';
    hasLinks = true;
  } else if (websiteLink) websiteLink.style.display = 'none';

  if (profile.upload_schedule && scheduleChip && scheduleText) {
    scheduleText.textContent = profile.upload_schedule;
    scheduleChip.style.display = 'inline-flex';
    hasLinks = true;
  } else if (scheduleChip) scheduleChip.style.display = 'none';

  if (linksRow) linksRow.style.display = hasLinks ? 'flex' : 'none';

  const tagsRow = document.getElementById('about-tags-row');
  if (tagsRow) {
    const tags = profile.content_categories && profile.content_categories.length > 0
      ? profile.content_categories
      : (profile.interests ? profile.interests.split(',').map(t => t.trim()).filter(Boolean) : []);
    if (tags.length > 0) {
      tagsRow.innerHTML = tags.map(t => `<span class="about-tag-chip">${escapeHtml(t)}</span>`).join('');
      tagsRow.style.display = 'flex';
    } else {
      tagsRow.style.display = 'none';
    }
  }

  const socialsRow = document.getElementById('about-socials-row');
  if (socialsRow) {
    let socials = {};
    try { socials = typeof profile.social_links === 'string' ? JSON.parse(profile.social_links) : (profile.social_links || {}); } catch { socials = {}; }
    const iconMap = { instagram: 'fa-instagram', twitter: 'fa-x-twitter', youtube: 'fa-youtube', tiktok: 'fa-tiktok', facebook: 'fa-facebook' };
    const entries = Object.entries(socials).filter(([, url]) => url);
    if (entries.length > 0) {
      socialsRow.innerHTML = entries.map(([platform, url]) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fab ${iconMap[platform] || 'fa-link'}"></i></a>`
      ).join('');
      socialsRow.style.display = 'flex';
    } else {
      socialsRow.style.display = 'none';
    }
  }
}

// ===== ABOUT STATS — plain counts, no card chrome =====
function renderAboutStats() {
  const content = window.creatorContent || [];

  const totalViewsEl = document.getElementById('about-total-views');
  if (totalViewsEl) totalViewsEl.textContent = formatNumber(content.reduce((s, c) => s + (c.views_count || 0), 0));

  const totalUploadsEl = document.getElementById('about-total-uploads');
  if (totalUploadsEl) totalUploadsEl.textContent = content.length;

  const streak = computeUploadStreak(content);
  window.streakCount = streak;
  const streakEl = document.getElementById('about-streak');
  if (streakEl) streakEl.textContent = streak;

  const originalsEl = document.getElementById('about-originals');
  if (originalsEl) originalsEl.textContent = content.filter(c => c.is_bantu_original === true).length;

  const completionEl = document.getElementById('about-completion-rate');
  if (completionEl) {
    const withRates = content.filter(c => typeof c.completion_rate === 'number');
    const avg = withRates.length > 0 ? withRates.reduce((s, c) => s + c.completion_rate, 0) / withRates.length : 0;
    completionEl.textContent = `${Math.round(avg * 100)}%`;
  }

  const engagementEl = document.getElementById('about-engagement-total');
  if (engagementEl) {
    const total = content.reduce((s, c) =>
      s + (c.likes_count || 0) + (c.comments_count || 0) + (c.shares_count || 0) + (c.favorites_count || 0), 0);
    engagementEl.textContent = formatNumber(total);
  }
}

// ===== ABOUT CONTENT MIX =====
function renderAboutContentMix() {
  const bar = document.getElementById('content-mix-bar');
  const legend = document.getElementById('content-mix-legend');
  if (!bar || !legend) return;

  const mix = computeContentMixReal(window.creatorContent || []);
  if (mix.length === 0) {
    bar.innerHTML = '';
    legend.innerHTML = '<span style="color:var(--text-muted);">No content published yet</span>';
    return;
  }

  bar.innerHTML = mix.map(m => `<div style="width:${m.pct}%;background:${m.meta.color};"></div>`).join('');
  legend.innerHTML = mix.map(m =>
    `<span><span class="swatch" style="background:${m.meta.color};"></span>${escapeHtml(m.meta.label)} ${m.pct}%</span>`
  ).join('');
}

// ===== ABOUT INSIGHTS — v2 (now also toggles divider above) =====
function renderAboutInsights() {
  const dividerTop = document.getElementById('about-insights-divider-top');
  const card = document.getElementById('about-insights-card');
  const list = document.getElementById('about-insights-list');
  if (!card || !list) return;

  const content = window.creatorContent || [];
  if (content.length < 2) {
    card.style.display = 'none';
    if (dividerTop) dividerTop.style.display = 'none';
    return;
  }

  const insights = [];

  const mix = computeContentMixReal(content);
  if (mix.length > 0) {
    insights.push({
      icon: 'fa-chart-pie',
      text: `${mix[0].meta.label} makes up ${mix[0].pct} percent of this creator's uploads.`
    });
  }

  const sortedDates = [...content].map(c => new Date(c.created_at)).sort((a, b) => a - b);
  if (sortedDates.length >= 3) {
    const gaps = [];
    for (let i = 1; i < sortedDates.length; i++) gaps.push((sortedDates[i] - sortedDates[i - 1]) / 86400000);
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 1.5) insights.push({ icon: 'fa-bolt', text: 'This creator publishes new content almost every day.' });
    else insights.push({ icon: 'fa-calendar-check', text: `New uploads land roughly every ${Math.round(avgGap)} days.` });
  }

  const topContent = [...content].sort((a, b) => (b.views_count || 0) - (a.views_count || 0))[0];
  if (topContent && topContent.views_count > 0) {
    insights.push({
      icon: 'fa-fire',
      text: `The most watched upload is ${escapeHtml(truncateText(topContent.title || 'an untitled upload', 60))}, with ${formatNumber(topContent.views_count)} views.`
    });
  }

  if (insights.length === 0) {
    card.style.display = 'none';
    if (dividerTop) dividerTop.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  if (dividerTop) dividerTop.style.display = 'block';
  list.innerHTML = insights.map(i => `
    <div class="about-insight-row"><i class="fas ${i.icon}"></i><span>${i.text}</span></div>
  `).join('');
}

// ===== ABOUT JOURNEY =====
async function renderAboutJourney() {
  const timeline = document.getElementById('journey-timeline');
  const emptyState = document.getElementById('journey-empty');
  if (!timeline) return;

  const content = window.creatorContent || [];
  const entries = [];

  const sortedByDate = [...content].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (sortedByDate.length > 0) {
    const first = sortedByDate[0];
    entries.push({
      date: new Date(first.created_at),
      title: 'First upload',
      desc: truncateText(first.title || 'This creator published their first piece of content.', 70),
      color: '#5DCAA5'
    });
  }

  const firstOriginal = sortedByDate.find(c => c.is_bantu_original === true);
  if (firstOriginal) {
    entries.push({
      date: new Date(firstOriginal.created_at),
      title: 'First Bantu Original',
      desc: truncateText(firstOriginal.title || 'Their first title recognized as a Bantu Original.', 70),
      color: '#7F77DD'
    });
  }

  const viewMilestones = await computeViewMilestones(window.creatorId);
  viewMilestones.forEach(m => {
    entries.push({
      date: new Date(m.date),
      title: `Reached ${formatNumber(m.threshold)} views`,
      desc: 'A view count milestone across all of this creator\'s content.',
      color: 'var(--accent-streak)'
    });
  });

  entries.sort((a, b) => a.date - b.date);

  if (entries.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    timeline.querySelectorAll('.journey-item').forEach(el => el.remove());
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  timeline.innerHTML = entries.map((e, idx) => `
    <div class="journey-item">
      <div class="journey-dot-col">
        <div class="journey-dot" style="background:${e.color};"></div>
        ${idx < entries.length - 1 ? '<div class="journey-line"></div>' : ''}
      </div>
      <div>
        <span class="journey-date">${e.date.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        <p class="journey-title">${escapeHtml(e.title)}</p>
        <p class="journey-desc">${escapeHtml(e.desc)}</p>
      </div>
    </div>
  `).join('');
}

// ===== MASTER ABOUT RENDER =====
async function renderAboutTab() {
  if (!window.creatorRecord) await loadCreatorRecord();
  renderAboutIdentity();
  renderAboutStats();
  renderAboutContentMix();
  renderAboutInsights();
  await renderAboutJourney();
}

// ===== ANALYTICS FUNCTIONS =====
function initAnalyticsModal() {
const modal = document.getElementById('analytics-modal');
if (!modal) return;

const analyticsBtn = document.getElementById('analytics-btn');
if (analyticsBtn) {
analyticsBtn.addEventListener('click', () => {
modal.classList.add('active');
loadChannelAnalytics();
});
}

const closeBtn = document.getElementById('close-analytics');
if (closeBtn) {
closeBtn.addEventListener('click', () => modal.classList.remove('active'));
}

modal.addEventListener('click', e => {
if (e.target === modal) modal.classList.remove('active');
});
}

async function loadChannelAnalytics() {
if (!window.currentUser || !window.creatorContent) return;

const totalViews = window.creatorContent.reduce((s,c) => s + (c.views_count || 0), 0);
const totalLikes = window.creatorContent.reduce((s,c) => s + (c.likes_count || 0), 0);
const engagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) + '%' : '0%';

const viewsEl = document.getElementById('analytics-views');
const connectorsEl = document.getElementById('analytics-connectors');
const engagementEl = document.getElementById('analytics-engagement');
const watchTimeEl = document.getElementById('analytics-watch-time');

if (viewsEl) viewsEl.textContent = formatNumber(totalViews);
if (connectorsEl) connectorsEl.textContent = formatNumber(window.connectorCount || 0);
if (engagementEl) engagementEl.textContent = engagement;
if (watchTimeEl) watchTimeEl.textContent = Math.floor(totalViews * 0.65 / 60) + 'm';

const ctx = document.getElementById('channel-engagement-chart');
if (!ctx) return;

if (window._analyticsChart) window._analyticsChart.destroy();

window._analyticsChart = new Chart(ctx, {
type: 'line',
data: {
labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
datasets: [
{
label: 'Views',
data: [65, 80, 50, 90, 110, 75, 120],
borderColor: '#F59E0B',
backgroundColor: 'rgba(245,158,11,0.1)',
tension: 0.4,
fill: true
},
{
label: 'Connects',
data: [12, 19, 15, 25, 22, 30, 35],
borderColor: '#1D4ED8',
backgroundColor: 'rgba(29,78,216,0.1)',
tension: 0.4,
fill: true
}
]
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: {
legend: {
labels: {
color: 'var(--soft-white)'
}
}
},
scales: {
x: {
grid: { color: 'rgba(255,255,255,0.1)' },
ticks: { color: 'var(--slate-grey)' }
},
y: {
grid: { color: 'rgba(255,255,255,0.1)' },
ticks: { color: 'var(--slate-grey)' }
}
}
}
});
}

// ===== BANNER FUNCTIONS =====
async function handleBannerUpload(file) {
const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
if (!validTypes.includes(file.type)) {
showToast('Please upload a valid image (JPEG, PNG, or WEBP)', 'error');
return false;
}

const maxSize = 20 * 1024 * 1024;
if (file.size > maxSize) {
showToast('Image must be less than 20MB', 'error');
return false;
}

const progressContainer = document.getElementById('banner-upload-progress');
const progressFill = document.getElementById('upload-progress-fill');
const progressText = document.getElementById('upload-progress-text');

if (progressContainer) progressContainer.style.display = 'block';
if (progressText) progressText.textContent = 'Requesting upload URL...';

try {
const { data: uploadData, error: uploadError } = await supabase.functions.invoke('get-upload-url', {
body: { mediaType: 'banner', fileName: file.name }
});

if (uploadError) throw new Error(uploadError.message);
if (!uploadData?.uploadUrl) throw new Error('No upload URL received');

if (progressText) progressText.textContent = 'Uploading to CDN...';

const xhr = new XMLHttpRequest();
xhr.open('PUT', uploadData.uploadUrl);
xhr.setRequestHeader('Content-Type', file.type);

xhr.upload.onprogress = (e) => {
if (e.lengthComputable && progressFill) {
const percent = (e.loaded / e.total) * 100;
progressFill.style.width = percent + '%';
if (progressText) progressText.textContent = `Uploading: ${Math.round(percent)}%`;
}
};

await new Promise((resolve, reject) => {
xhr.onload = () => {
if (xhr.status === 200) resolve();
else reject(new Error(`Upload failed: ${xhr.status}`));
};
xhr.onerror = () => reject(new Error('Network error during upload'));
xhr.send(file);
});

if (progressText) progressText.textContent = 'Updating profile...';

const { error: dbError } = await supabase
.from('user_profiles')
.update({ channel_banner_url: uploadData.fileUrl })
.eq('id', window.creatorId);

if (dbError) throw dbError;

setBannerImage(uploadData.fileUrl);
showToast('Banner updated successfully! 🎉', 'success');

if (window.creatorProfile) {
window.creatorProfile.channel_banner_url = uploadData.fileUrl;
}

if (progressContainer) {
setTimeout(() => {
progressContainer.style.display = 'none';
if (progressFill) progressFill.style.width = '0%';
}, 1000);
}

return true;

} catch (error) {
console.error('Banner upload error:', error);
showToast('Failed to upload banner: ' + error.message, 'error');
if (progressContainer) progressContainer.style.display = 'none';
return false;
}
}

function setBannerImage(url) {
if (!url) return;
const banner = document.getElementById('channel-banner');
if (banner) {
const cleanUrl = url.replace(/^["']|["']$/g, '');
banner.style.backgroundImage = `linear-gradient(rgba(10, 14, 18, 0.85), rgba(15, 23, 42, 0.95)), url('${cleanUrl}')`;
banner.style.backgroundSize = 'cover';
banner.style.backgroundPosition = 'center';
}
}

function showBannerUploadModal() {
if (!window.currentUser || window.currentUser.id !== window.creatorId) {
showToast('Only the channel owner can change the banner', 'warning');
return;
}
const modal = document.getElementById('banner-upload-modal');
if (modal) modal.classList.add('active');
}

function hideBannerUploadModal() {
const modal = document.getElementById('banner-upload-modal');
if (modal) modal.classList.remove('active');
}

// ===== PROFILE UPDATE =====
function updateProfileUI() {
const placeholder = document.getElementById('userProfilePlaceholder');
const nameEl = document.getElementById('current-profile-name');
const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
const sidebarName = document.getElementById('sidebar-profile-name');
const sidebarEmail = document.getElementById('sidebar-profile-email');

const creatorAvatar = document.getElementById('creator-avatar-container');
const creatorInitials = document.getElementById('creator-initials');
const creatorName = document.getElementById('creator-name');
const creatorUsername = document.getElementById('creator-username');
const connectorDisplay = document.getElementById('connector-count-display');
const streakCountEl = document.getElementById('streak-count');

if (!placeholder || !nameEl) return;

placeholder.innerHTML = '';

if (window.currentUser) {
try {
const { data: profile } = await supabase
.from('user_profiles')
.select('full_name, username, avatar_url')
.eq('id', window.currentUser.id)
.maybeSingle();

const displayName = profile?.full_name || profile?.username || window.currentUser.email?.split('@')[0] || 'User';
nameEl.textContent = displayName;
if (sidebarName) sidebarName.textContent = displayName;
if (sidebarEmail) sidebarEmail.textContent = window.currentUser.email || 'user@example.com';

if (profile?.avatar_url) {
const avatarUrl = fixMediaUrl(profile.avatar_url);
const img = document.createElement('img');
img.className = 'profile-img';
img.src = avatarUrl;
img.alt = displayName;
img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';

img.onerror = () => {
const fallback = document.createElement('div');
fallback.className = 'profile-placeholder';
fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
fallback.textContent = getInitials(displayName);
placeholder.innerHTML = '';
placeholder.appendChild(fallback);

if (sidebarAvatar) {
sidebarAvatar.innerHTML = '';
sidebarAvatar.appendChild(fallback.cloneNode(true));
}
};

placeholder.appendChild(img);

if (sidebarAvatar) {
const sidebarImg = img.cloneNode(true);
sidebarImg.onload = () => {
sidebarAvatar.innerHTML = '';
sidebarAvatar.appendChild(sidebarImg);
};
sidebarImg.onerror = () => {
const fallback = document.createElement('div');
fallback.className = 'profile-placeholder';
fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
fallback.textContent = getInitials(displayName);
sidebarAvatar.innerHTML = '';
sidebarAvatar.appendChild(fallback);
};
}
} else {
const fallback = document.createElement('div');
fallback.className = 'profile-placeholder';
fallback.style.cssText = 'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;';
fallback.textContent = getInitials(displayName);
placeholder.appendChild(fallback);

if (sidebarAvatar) {
const sidebarFallback = fallback.cloneNode(true);
sidebarAvatar.innerHTML = '';
sidebarAvatar.appendChild(sidebarFallback);
}
}

} catch (e) {
console.warn('Profile fetch error:', e);
}
} else {
nameEl.textContent = 'Guest';
if (sidebarName) sidebarName.textContent = 'Guest';
if (sidebarEmail) sidebarEmail.textContent = 'Sign in to continue';
placeholder.innerHTML = '<div class="profile-placeholder"><i class="fas fa-user"></i></div>';
if (sidebarAvatar) sidebarAvatar.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;color:var(--soft-white);"></i>';
}

if (window.creatorProfile) {
const displayName = window.creatorProfile.full_name || window.creatorProfile.username || 'Creator';
if (creatorName) creatorName.textContent = displayName;
if (creatorUsername) creatorUsername.textContent = `@${window.creatorProfile.username || 'creator'}`;
if (creatorInitials) creatorInitials.textContent = getInitials(displayName);
if (connectorDisplay) connectorDisplay.textContent = formatNumber(window.connectorCount || 0);
if (streakCountEl) streakCountEl.textContent = window.streakCount || 0;

if (creatorAvatar && window.creatorProfile.avatar_url) {
const avatarUrl = fixMediaUrl(window.creatorProfile.avatar_url);
creatorAvatar.innerHTML = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">`;
}
}

// ===== FIX 1: CONSOLIDATED BADGE — replaces the old three-line block =====
renderCreatorStatusBadge();
}

// ===== FIX 1: CONSOLIDATED BADGE — renders the new #creator-status-badge =====
function renderCreatorStatusBadge() {
  const badge = document.getElementById('creator-status-badge');
  const badgeText = document.getElementById('creator-status-badge-text');
  if (!badge || !badgeText) return;

  const record = window.creatorRecord || {};
  const isFounder = !!record.is_founder;
  const isVerified = !!(record.is_verified || record.is_creator_verified);

  if (isFounder) {
    badge.style.display = 'inline-flex';
    badge.classList.add('is-founder');
    badgeText.textContent = 'Verified founder';
  } else if (isVerified) {
    badge.style.display = 'inline-flex';
    badge.classList.remove('is-founder');
    badgeText.textContent = 'Verified creator';
  } else {
    badge.style.display = 'none';
    badge.classList.remove('is-founder');
  }

  // The old on-avatar FOUNDER ribbon stays as its own separate signal
  const founderRibbon = document.getElementById('founder-badge');
  if (founderRibbon) founderRibbon.style.display = isFounder ? 'block' : 'none';
}

// ===== FIX 2 & 4: UPDATED CONNECT BUTTON — outline styles for Connect/Connected/You =====
function updateConnectButton() {
  const btn = document.getElementById('connect-btn');
  if (!btn) return;

  btn.classList.remove('connected', 'is-self');

  if (!window.currentUser) {
    btn.innerHTML = '<i class="fas fa-link"></i> Connect';
    btn.disabled = false;
    btn.onclick = handleLoginRequired;
    return;
  }

  if (window.currentUser.id === window.creatorId) {
    btn.disabled = true;
    btn.classList.add('is-self');
    btn.innerHTML = '<i class="fas fa-user"></i> You';
    return;
  }

  btn.disabled = false;
  if (window.isConnected) {
    btn.classList.add('connected');
    btn.innerHTML = '<i class="fas fa-check"></i> Connected';
    btn.onclick = handleDisconnect;
  } else {
    btn.innerHTML = '<i class="fas fa-link"></i> Connect';
    btn.onclick = handleConnect;
  }
}

// ===== FIX 5: THREE-DOT MENU — was completely unwired; now a real dropdown =====
function setupMoreMenu() {
  const moreBtn = document.getElementById('more-btn');
  const moreMenu = document.getElementById('more-menu');
  if (!moreBtn || !moreMenu) return;

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.isOwner) {
      showToast('Only the channel owner can access these options', 'info');
      return;
    }
    moreMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (moreMenu.classList.contains('active') && !moreMenu.contains(e.target) && e.target !== moreBtn) {
      moreMenu.classList.remove('active');
    }
  });

  const bannerItem = document.getElementById('more-menu-banner');
  if (bannerItem) {
    bannerItem.addEventListener('click', () => {
      moreMenu.classList.remove('active');
      showBannerUploadModal();
    });
  }

  const pollItem = document.getElementById('more-menu-poll');
  if (pollItem) {
    pollItem.addEventListener('click', () => {
      moreMenu.classList.remove('active');
      openCreatePollModal();
    });
  }

  const aboutItem = document.getElementById('more-menu-about');
  if (aboutItem) {
    aboutItem.addEventListener('click', () => {
      moreMenu.classList.remove('active');
      openEditAboutModal();
    });
  }
}

// ===== FIX 5: CREATE POLL MODAL — the missing write side of the poll system =====
function openCreatePollModal() {
  if (!window.isOwner) return;
  document.getElementById('poll-question-input').value = '';
  document.getElementById('poll-option-1-input').value = '';
  document.getElementById('poll-option-2-input').value = '';
  document.getElementById('poll-option-3-input').value = '';
  document.getElementById('poll-option-4-input').value = '';
  document.getElementById('poll-duration-select').value = '3';
  document.getElementById('create-poll-modal').classList.add('active');
}

async function submitCreatePoll() {
  const question = document.getElementById('poll-question-input').value.trim();
  const options = [
    document.getElementById('poll-option-1-input').value.trim(),
    document.getElementById('poll-option-2-input').value.trim(),
    document.getElementById('poll-option-3-input').value.trim(),
    document.getElementById('poll-option-4-input').value.trim()
  ].filter(Boolean);
  const days = parseInt(document.getElementById('poll-duration-select').value, 10);

  if (!question) { showToast('Add a question first', 'warning'); return; }
  if (options.length < 2) { showToast('Add at least two options', 'warning'); return; }

  try {
    const { data: post, error: postError } = await supabase
      .from('pulse_posts')
      .insert({
        creator_id: window.creatorId,
        content: question,
        post_type: 'poll',
        visibility: 'public',
        is_pinned: false
      })
      .select()
      .single();
    if (postError) throw postError;

    const endsAt = new Date(Date.now() + days * 86400000).toISOString();

    const { error: pollError } = await supabase
      .from('pulse_post_polls')
      .insert({
        post_id: post.id,
        question,
        options,
        ends_at: endsAt
      });
    if (pollError) throw pollError;

    document.getElementById('create-poll-modal').classList.remove('active');
    showToast('Poll posted!', 'success');

    // Refresh the Community tab if it's the one currently open
    if (window.currentTab === 'community') ChannelPulse.load();
  } catch (e) {
    console.error('Error creating poll:', e);
    showToast('Could not create the poll — check that pulse_post_polls exists', 'error');
  }
}

function openEditAboutModal() {
  // This function is called from the more menu; the edit about modal
  // already exists in the HTML and is wired up separately.
  const modal = document.getElementById('edit-about-modal');
  if (modal) modal.classList.add('active');
}

// ===== NOTIFICATIONS =====
async function loadNotifications() {
try {
if (!window.currentUser) {
updateNotificationBadge(0);
return;
}

const { data, error } = await supabase
.from('notifications')
.select('*')
.eq('user_id', window.currentUser.id)
.order('created_at', { ascending: false })
.limit(20);

if (error) throw error;

window.notifications = data || [];
const unreadCount = window.notifications.filter(n => !n.is_read).length;
updateNotificationBadge(unreadCount);

} catch (error) {
console.error('Error loading notifications:', error);
updateNotificationBadge(0);
}
}

function updateNotificationBadge(count) {
const mainBadge = document.getElementById('notification-count');
const sidebarBadge = document.getElementById('sidebar-notification-count');

[mainBadge, sidebarBadge].forEach(badge => {
if (badge) {
badge.textContent = count > 99 ? '99+' : count;
badge.style.display = count > 0 ? 'flex' : 'none';
}
});
}

function renderNotifications() {
const list = document.getElementById('notifications-list');
if (!list) return;

if (!window.currentUser) {
list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i><p>Sign in to see notifications</p></div>`;
return;
}

if (!window.notifications || window.notifications.length === 0) {
list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--slate-grey);"><i class="fas fa-bell" style="font-size:48px;margin-bottom:15px;opacity:0.3;"></i><p>No notifications yet</p></div>`;
return;
}

list.innerHTML = window.notifications.map(n => {
const icon = getNotificationIcon(n.type);
const readClass = n.is_read ? 'opacity:0.7;' : 'background:rgba(245,158,11,0.1);';
const unreadDot = !n.is_read ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--warm-gold);margin-top:5px;"></div>' : '';

return `<div style="padding:15px;border-bottom:1px solid var(--card-border);${readClass}"><div style="display:flex;gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="${icon}" style="font-size:18px;"></i></div><div style="flex:1;"><div style="font-weight:600;margin-bottom:5px;color:var(--soft-white);">${escapeHtml(n.title)}</div><div style="font-size:14px;color:var(--slate-grey);margin-bottom:8px;">${escapeHtml(n.message)}</div><div style="font-size:12px;color:var(--warm-gold);">${formatTimeAgo(n.created_at)}</div></div>${unreadDot}</div></div>`;
}).join('');
}

function getNotificationIcon(type) {
switch(type) {
case 'like': return 'fas fa-heart';
case 'comment': return 'fas fa-comment';
case 'follow': return 'fas fa-user-plus';
default: return 'fas fa-bell';
}
}

// ===== AUTH CHECK =====
async function checkAuth() {
try {
const { data, error } = await supabase.auth.getSession();
if (error) throw error;
window.currentUser = data?.session?.user || null;

if (window.currentUser) {
console.log('✅ User authenticated:', window.currentUser.email);
await loadUserProfile();
}

return window.currentUser;
} catch (error) {
console.error('Auth check error:', error);
return null;
}
}

async function loadUserProfile() {
try {
if (!window.currentUser) return;

const { data: profile, error } = await supabase
.from('user_profiles')
.select('*')
.eq('id', window.currentUser.id)
.maybeSingle();

if (error) throw error;

updateProfileUI();
await loadNotifications();

} catch (error) {
console.error('Error loading profile:', error);
}
}

// ===== DATA LOADING FUNCTIONS =====
function getUrlParam(name) {
const urlParams = new URLSearchParams(window.location.search);
return urlParams.get(name);
}

async function loadCreatorData() {
try {
window.creatorId = getUrlParam('id');
if (!window.creatorId) {
showToast('Creator ID not found', 'error');
window.location.href = 'content-library.html';
return;
}

window.loadingText = document.getElementById('loading-text');
if (window.loadingText) window.loadingText.textContent = 'Loading creator profile...';

const { data: profile, error: profileError } = await supabase
.from('user_profiles')
.select('*')
.eq('id', window.creatorId)
.maybeSingle();

if (profileError || !profile) {
showToast('Creator not found', 'error');
window.location.href = 'content-library.html';
return;
}

window.creatorProfile = profile;

if (profile.channel_banner_url) {
setBannerImage(profile.channel_banner_url);
}

if (window.loadingText) window.loadingText.textContent = 'Loading creator content...';
window.creatorContent = await loadContentWithEngagementStats(window.creatorId, 50);

const { count: connectorCount, error: countError } = await supabase
.from('connectors')
.select('*', { count: 'exact', head: true })
.eq('connected_id', window.creatorId)
.eq('connection_type', 'creator');

if (countError) throw countError;
window.connectorCount = connectorCount || 0;

if (window.currentUser) {
const { data: connections } = await supabase
.from('connectors')
.select('*')
.eq('connector_id', window.currentUser.id)
.eq('connected_id', window.creatorId)
.eq('connection_type', 'creator')
.limit(1);

window.isConnected = connections && connections.length > 0;
} else {
window.isConnected = false;
}

// Determine if current user is the channel owner
window.isOwner = window.currentUser && window.currentUser.id === window.creatorId;

if (window.loadingText) window.loadingText.textContent = 'Loading playlists...';
window.playlists = await loadPlaylistsWithItems(window.creatorId);

const { data: badges } = await supabase.from('user_badges').select('*').eq('user_id', window.creatorId);
window.achievements = badges || [];

await loadCreatorRecord();

console.log('✅ Creator data loaded:', {
profile: window.creatorProfile,
contentCount: window.creatorContent.length,
connectorCount: window.connectorCount,
isConnected: window.isConnected,
playlists: window.playlists.length
});

updateProfileUI();
updateConnectButton();
renderHomeTab();
renderAboutTab();

setupHomeSeeAllButtons();

const loading = document.getElementById('loading');
const app = document.getElementById('app');
if (loading) loading.style.display = 'none';
if (app) app.style.display = 'block';

} catch (error) {
console.error('❌ Error loading creator channel:', error);
showToast('Failed to load creator channel', 'error');
setTimeout(() => {
const loading = document.getElementById('loading');
const app = document.getElementById('app');
if (loading) loading.style.display = 'none';
if (app) app.style.display = 'block';
}, 2000);
}
}

// ===== CONNECT HANDLERS =====
function handleLoginRequired() {
showToast('Please log in to connect', 'info');
window.location.href = `login.html?redirect=creator-channel.html?id=${window.creatorId}`;
}

async function handleConnect() {
if (!window.currentUser) {
handleLoginRequired();
return;
}

if (window.currentUser.id === window.creatorId) {
showToast('You cannot connect to your own channel', 'info');
return;
}

try {
const { error } = await supabase.from('connectors').insert({
connector_id: window.currentUser.id,
connected_id: window.creatorId,
connection_type: 'creator',
created_at: new Date().toISOString()
});

if (error) throw error;

window.isConnected = true;
window.connectorCount++;
updateConnectButton();
updateProfileUI();
showConfetti();
showToast(`Connected with ${window.creatorProfile.full_name || window.creatorProfile.username}!`, 'success');

} catch (error) {
console.error('Error connecting:', error);
showToast('Failed to connect', 'error');
}
}

async function handleDisconnect() {
try {
const { error } = await supabase.from('connectors').delete()
.eq('connector_id', window.currentUser.id)
.eq('connected_id', window.creatorId)
.eq('connection_type', 'creator');

if (error) throw error;

window.isConnected = false;
window.connectorCount = Math.max(0, window.connectorCount - 1);
updateConnectButton();
updateProfileUI();
showToast('Disconnected', 'info');

} catch (error) {
console.error('Error disconnecting:', error);
showToast('Failed to disconnect', 'error');
}
}

// ===== SEARCH =====
async function searchContent(query, category = '', sortBy = 'newest') {
try {
let qb = supabase.from('Content')
.select(`
*,
user_profiles!user_id(*),
live_views,
favorites_count,
content_engagement_stats (
total_views,
total_likes,
total_comments
)
`)
.ilike('title', `%${query}%`)
.eq('status', 'published');

if (category) qb = qb.eq('genre', category);

const { data, error } = await qb.limit(50);
if (error) throw error;

const enriched = (data || []).map(item => ({
...item,
views_count: item.content_engagement_stats?.total_views || item.live_views || 0,
likes_count: item.content_engagement_stats?.total_likes || 0,
comments_count: item.content_engagement_stats?.total_comments || item.comments_count || 0,
favorites_count: item.favorites_count || 0
}));

if (sortBy === 'popular') enriched.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
else if (sortBy === 'trending') enriched.sort((a, b) => ((b.views_count || 0) + ((b.likes_count || 0) * 2)) - ((a.views_count || 0) + ((a.likes_count || 0) * 2)));
else enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

return enriched;

} catch (error) {
console.error('Search error:', error);
return [];
}
}

function renderSearchResults(results) {
const grid = document.getElementById('search-results-grid');
if (!grid) return;

if (!results || results.length === 0) {
grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No results found. Try different keywords.</div>';
return;
}

grid.innerHTML = results.map(item => {
const thumbnailUrl = item.thumbnail_url ? fixMediaUrl(item.thumbnail_url) : 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=225&fit=crop';
return `<div class="content-card" data-content-id="${item.id}"><div class="card-thumbnail"><img src="${thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy"><div class="thumbnail-overlay"></div><div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div></div><div class="card-content"><h3 class="card-title">${truncateText(escapeHtml(item.title), 45)}</h3><div class="card-meta"><span><i class="fas fa-eye"></i> ${formatNumber(item.views_count || 0)}</span><span><i class="fas fa-heart"></i> ${formatNumber(item.likes_count || 0)}</span></div></div></div>`;
}).join('');

grid.querySelectorAll('.content-card').forEach(card => {
card.addEventListener('click', () => {
const id = card.dataset.contentId;
if (id) window.location.href = `content-detail.html?id=${id}`;
});
});
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
// Profile button
const profileBtn = document.getElementById('profile-btn');
if (profileBtn) {
profileBtn.addEventListener('click', async () => {
const { data } = await supabase.auth.getSession();
data?.session ? window.location.href = 'profile.html' : window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
});
}

const currentProfileBtn = document.getElementById('current-profile-btn');
if (currentProfileBtn) {
currentProfileBtn.addEventListener('click', async (e) => {
e.stopPropagation();
const dropdown = document.getElementById('profile-dropdown');
if (dropdown) dropdown.classList.toggle('active');
});
}

const manageProfilesBtn = document.getElementById('manage-profiles-btn');
if (manageProfilesBtn) {
manageProfilesBtn.addEventListener('click', () => {
window.location.href = 'manage-profiles.html';
});
}

document.addEventListener('click', (e) => {
const profileBtnEl = document.getElementById('profile-btn');
const profileDropdown = document.getElementById('profile-dropdown');
const currentProfileBtnEl = document.getElementById('current-profile-btn');

if (profileDropdown && profileBtnEl && currentProfileBtnEl) {
if (!profileBtnEl.contains(e.target) && !profileDropdown.contains(e.target) && !currentProfileBtnEl.contains(e.target)) {
profileDropdown.classList.remove('active');
}
}
});

// Banner edit
const bannerEditBtn = document.getElementById('banner-edit-btn');
if (bannerEditBtn) bannerEditBtn.addEventListener('click', showBannerUploadModal);

// Banner file upload
const bannerFileUpload = document.getElementById('banner-file-upload');
const bannerFileInput = document.getElementById('banner-file-input');

if (bannerFileUpload && bannerFileInput) {
bannerFileUpload.addEventListener('click', () => { bannerFileInput.click(); });

bannerFileInput.addEventListener('change', async (e) => {
const file = e.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = (event) => {
const previewImg = document.getElementById('banner-preview-img');
const placeholder = document.getElementById('banner-preview-placeholder');
if (previewImg && placeholder) {
previewImg.src = event.target.result;
previewImg.style.display = 'block';
placeholder.style.display = 'none';
}
};
reader.readAsDataURL(file);

await handleBannerUpload(file);
e.target.value = '';
});
}

// Banner URL apply
const bannerUrlApply = document.getElementById('banner-url-apply');
if (bannerUrlApply) {
bannerUrlApply.addEventListener('click', async () => {
const url = document.getElementById('banner-url-input')?.value.trim();
if (!url) {
showToast('Please enter a URL', 'warning');
return;
}

try {
const response = await fetch(url, { method: 'HEAD' });
const contentType = response.headers.get('content-type');
if (!contentType || !contentType.startsWith('image/')) {
showToast('URL must point to an image', 'error');
return;
}

const contentLength = parseInt(response.headers.get('content-length'));
const maxSize = 20 * 1024 * 1024;
if (contentLength > maxSize) {
showToast('Image must be less than 20MB', 'error');
return;
}
} catch (error) {
showToast('Could not validate image URL', 'error');
return;
}

const previewImg = document.getElementById('banner-preview-img');
const placeholder = document.getElementById('banner-preview-placeholder');

if (previewImg && placeholder) {
previewImg.src = url;
previewImg.onload = () => {
previewImg.style.display = 'block';
placeholder.style.display = 'none';
};
previewImg.onerror = () => {
showToast('Failed to load image from URL', 'error');
};
}
});
}

// Banner save
const bannerSave = document.getElementById('banner-save');
if (bannerSave) {
bannerSave.addEventListener('click', async () => {
const previewImg = document.getElementById('banner-preview-img');

if (previewImg && previewImg.style.display === 'block' && previewImg.src) {
if (previewImg.src.startsWith('data:image')) {
const response = await fetch(previewImg.src);
const blob = await response.blob();
const file = new File([blob], 'banner.jpg', { type: blob.type });
await handleBannerUpload(file);
} else {
try {
const { error: dbError } = await supabase
.from('user_profiles')
.update({ channel_banner_url: previewImg.src })
.eq('id', window.creatorId);

if (dbError) throw dbError;

setBannerImage(previewImg.src);
showToast('Banner updated successfully! 🎉', 'success');
hideBannerUploadModal();

} catch (error) {
console.error('Error saving banner:', error);
showToast('Failed to save banner', 'error');
}
}
} else {
showToast('Please select or enter an image first', 'warning');
}
});
}

// Banner cancel
const bannerCancel = document.getElementById('banner-cancel');
if (bannerCancel) bannerCancel.addEventListener('click', hideBannerUploadModal);

// Search
const searchBtn = document.getElementById('search-btn');
const closeSearchBtn = document.getElementById('close-search-btn');
const searchModal = document.getElementById('search-modal');

if (searchBtn) {
searchBtn.addEventListener('click', () => {
if (searchModal) searchModal.classList.add('active');
setTimeout(() => document.getElementById('search-input')?.focus(), 300);
});
}

if (closeSearchBtn) {
closeSearchBtn.addEventListener('click', () => {
if (searchModal) searchModal.classList.remove('active');
const searchInputEl = document.getElementById('search-input');
const searchResultsGrid = document.getElementById('search-results-grid');
if (searchInputEl) searchInputEl.value = '';
if (searchResultsGrid) searchResultsGrid.innerHTML = '';
});
}

if (searchModal) {
searchModal.addEventListener('click', e => {
if (e.target === searchModal) {
searchModal.classList.remove('active');
const searchInputEl = document.getElementById('search-input');
const searchResultsGrid = document.getElementById('search-results-grid');
if (searchInputEl) searchInputEl.value = '';
if (searchResultsGrid) searchResultsGrid.innerHTML = '';
}
});
}

const searchInputElement = document.getElementById('search-input');
if (searchInputElement) {
let timeout;
searchInputElement.addEventListener('input', e => {
clearTimeout(timeout);
timeout = setTimeout(async () => {
const query = e.target.value.trim();
if (query.length < 2) {
const resultsGrid = document.getElementById('search-results-grid');
if (resultsGrid) resultsGrid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">Start typing to search...</div>';
return;
}

const resultsGrid = document.getElementById('search-results-grid');
if (resultsGrid) {
resultsGrid.innerHTML = `<div style="text-align:center;padding:40px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-radius:50%;border-top-color:var(--warm-gold);animation:spin 1s linear infinite;margin:0 auto 15px;"></div><div style="color:var(--slate-grey);">Searching...</div></div>`;
}

const categoryFilter = document.getElementById('category-filter')?.value;
const sortFilter = document.getElementById('sort-filter')?.value;
const results = await searchContent(query, categoryFilter, sortFilter);
renderSearchResults(results);
}, 300);
});
}

const categoryFilter = document.getElementById('category-filter');
const sortFilter = document.getElementById('sort-filter');

if (categoryFilter) {
categoryFilter.addEventListener('change', () => {
if (searchInputElement && searchInputElement.value.trim().length >= 2) {
searchInputElement.dispatchEvent(new Event('input'));
}
});
}

if (sortFilter) {
sortFilter.addEventListener('change', () => {
if (searchInputElement && searchInputElement.value.trim().length >= 2) {
searchInputElement.dispatchEvent(new Event('input'));
}
});
}

// Notifications
const notificationsBtn = document.getElementById('notifications-btn');
if (notificationsBtn) {
notificationsBtn.addEventListener('click', () => {
const panel = document.getElementById('notifications-panel');
if (panel) panel.classList.add('active');
renderNotifications();
});
}

const closeNotifications = document.getElementById('close-notifications');
if (closeNotifications) {
closeNotifications.addEventListener('click', () => {
const panel = document.getElementById('notifications-panel');
if (panel) panel.classList.remove('active');
});
}

const notificationsPanel = document.getElementById('notifications-panel');
if (notificationsPanel) {
notificationsPanel.addEventListener('click', e => {
if (e.target === notificationsPanel) notificationsPanel.classList.remove('active');
});
}

const markAllRead = document.getElementById('mark-all-read');
if (markAllRead) {
markAllRead.addEventListener('click', async () => {
if (!window.currentUser) return;
try {
const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', window.currentUser.id).eq('is_read', false);
if (error) throw error;

window.notifications = window.notifications.map(n => ({ ...n, is_read: true }));
renderNotifications();
updateNotificationBadge(0);
showToast('All notifications marked as read', 'success');

} catch (error) {
console.error('Error marking all as read:', error);
showToast('Failed to mark notifications as read', 'error');
}
});
}

// Analytics
initAnalyticsModal();

// Connectors
const connectorsStatCard = document.getElementById('connectors-stat-card');
if (connectorsStatCard) {
connectorsStatCard.addEventListener('click', showConnectorsModal);
}

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) {
closeModalBtn.addEventListener('click', () => {
const modal = document.getElementById('connectors-modal');
if (modal) modal.classList.remove('active');
});
}

const connectorsModal = document.getElementById('connectors-modal');
if (connectorsModal) {
connectorsModal.addEventListener('click', e => {
if (e.target === connectorsModal) connectorsModal.classList.remove('active');
});
}

// Voice search
const voiceSearchBtn = document.getElementById('voice-search-btn');
if (voiceSearchBtn) {
voiceSearchBtn.addEventListener('click', () => {
showToast('Voice search coming soon!', 'info');
});
}

// Sidebar nav items
const sidebarCreate = document.getElementById('sidebar-create');
if (sidebarCreate) {
sidebarCreate.addEventListener('click', async (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();

const { data } = await supabase.auth.getSession();
if (!data?.session) {
showToast('Please sign in to upload content', 'warning');
window.location.href = `login.html?redirect=creator-upload.html`;
} else {
window.location.href = 'creator-upload.html';
}
});
}

const sidebarDashboard = document.getElementById('sidebar-dashboard');
if (sidebarDashboard) {
sidebarDashboard.addEventListener('click', async (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();

const { data } = await supabase.auth.getSession();
if (!data?.session) {
showToast('Please sign in to access dashboard', 'warning');
window.location.href = `login.html?redirect=creator-dashboard.html`;
} else {
window.location.href = 'creator-dashboard.html';
}
});
}

const sidebarWatchHistory = document.getElementById('sidebar-watch-history');
if (sidebarWatchHistory) {
sidebarWatchHistory.addEventListener('click', (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();

if (!window.currentUser) {
showToast('Please sign in to view watch history', 'warning');
window.location.href = `login.html?redirect=watch-history.html`;
return;
}
window.location.href = 'watch-history.html';
});
}

const sidebarAnalytics = document.getElementById('sidebar-analytics');
if (sidebarAnalytics) {
sidebarAnalytics.addEventListener('click', (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();

const modal = document.getElementById('analytics-modal');
if (modal) modal.classList.add('active');
loadChannelAnalytics();
});
}

const sidebarNotifications = document.getElementById('sidebar-notifications');
if (sidebarNotifications) {
sidebarNotifications.addEventListener('click', (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();

const panel = document.getElementById('notifications-panel');
if (panel) panel.classList.add('active');
renderNotifications();
});
}

const sidebarBadges = document.getElementById('sidebar-badges');
if (sidebarBadges) {
sidebarBadges.addEventListener('click', (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();
showToast('Badges coming soon!', 'info');
});
}

const sidebarWatchParty = document.getElementById('sidebar-watch-party');
if (sidebarWatchParty) {
sidebarWatchParty.addEventListener('click', (e) => {
e.preventDefault();
const closeBtn = document.getElementById('sidebar-close');
if (closeBtn) closeBtn.click();
showToast('Watch Party coming soon!', 'info');
});
}

// ===== FIX 5: Wire up the Create Poll modal buttons =====
document.getElementById('poll-create-submit-btn')?.addEventListener('click', submitCreatePoll);
document.getElementById('poll-create-cancel-btn')?.addEventListener('click', () => document.getElementById('create-poll-modal').classList.remove('active'));
}

// ===== SHOW CONNECTORS MODAL =====
async function showConnectorsModal() {
try {
const { data: connectors, error } = await supabase
.from('connectors')
.select(`connector_id, user_profiles!inner(id, full_name, username, avatar_url)`)
.eq('connected_id', window.creatorId)
.eq('connection_type', 'creator');

if (error) throw error;

const title = document.getElementById('modal-title');
const list = document.getElementById('connectors-list');
const profiles = connectors.map(c => c.user_profiles);

if (title) title.textContent = `Connectors (${profiles.length})`;

if (list) {
if (profiles.length === 0) {
list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--slate-grey);">No connectors yet</div>';
} else {
list.innerHTML = profiles.map(p => {
const avatarUrl = p.avatar_url ? fixMediaUrl(p.avatar_url) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop';
return `
<div style="display:flex;align-items:center;gap:15px;padding:15px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:10px;">
<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--warm-gold);"><img src="${avatarUrl}" alt="${p.full_name || p.username}" style="width:100%;height:100%;object-fit:cover;"></div>
<div><div style="font-weight:600;color:var(--soft-white);">${escapeHtml(p.full_name || p.username)}</div><div style="font-size:14px;color:var(--slate-grey);">@${escapeHtml(p.username || 'user')}</div></div>
</div>
`;
}).join('');
}
}

const modal = document.getElementById('connectors-modal');
if (modal) modal.classList.add('active');

} catch (error) {
console.error('Error loading connectors:', error);
showToast('Failed to load connectors', 'error');
}
}

// ===== FIX MOBILE HORIZONTAL SCROLL =====
function fixMobileHorizontalScroll() {
document.body.style.overflowX = 'hidden';
document.documentElement.style.overflowX = 'hidden';

const checkOverflow = () => {
const maxWidth = window.innerWidth;
const bodyWidth = document.body.scrollWidth;

if (bodyWidth > maxWidth) {
const allElements = document.querySelectorAll('*');
allElements.forEach(el => {
const rect = el.getBoundingClientRect();
if (rect.right > maxWidth + 5) {
el.style.maxWidth = '100%';
el.style.overflow = 'hidden';
}
});
}
};

checkOverflow();
window.addEventListener('resize', checkOverflow);
}

// ===== INITIALIZE =====
async function initializeCreatorChannel() {
try {
const loading = document.getElementById('loading');
const app = document.getElementById('app');

if (loading) loading.style.display = 'flex';
if (app) app.style.display = 'none';

window.loadingText = document.getElementById('loading-text');

initThemeSystem();
window.uiScaleController = new UIScaleController();
window.uiScaleController.init();
setupScaleControls();

fixMobileHorizontalScroll();
setupSidebar();
setupNavigationButtons();
setupTabs();

await checkAuth();
await loadCreatorData();

setupEventListeners();
setupMoreMenu(); // FIX 5: Initialize the three-dot menu

setTimeout(() => {
if (loading) loading.style.display = 'none';
if (app) app.style.display = 'block';
}, 500);

console.log('✅ Creator channel initialized with PHASE 5 + NEW DESIGN!');
console.log('   🚀 Using content_engagement_stats for metrics');
console.log('   🚀 Using playlist_contents junction table for playlists');
console.log('   🎨 New design: Home, Community, About tabs');
console.log('   🎨 Mobile-first responsive layout');
console.log('   🎨 Banner section kept as is');
console.log('   🎨 Community tab uses Pulse feed with polls (pulse_post_polls + pulse_poll_votes)');
console.log('   🎯 FIX 1: Consolidated creator-status-badge (founder gold, verified blue)');
console.log('   🎯 FIX 2: About tab padding fixed (16px var(--space-3))');
console.log('   🎯 FIX 3: Avatar glow clipping fixed (overflow: visible)');
console.log('   🎯 FIX 4: Connect/Connected/You outlined buttons');
console.log('   🎯 FIX 5: Three-dot menu wired with Create Poll and Edit About');

} catch (error) {
console.error('❌ Error initializing:', error);
showToast('Failed to initialize', 'error');
setTimeout(() => {
const loading = document.getElementById('loading');
const app = document.getElementById('app');
if (loading) loading.style.display = 'none';
if (app) app.style.display = 'block';
}, 1000);
}
}

// ===== AUTH STATE CHANGE =====
supabase.auth.onAuthStateChange((event, session) => {
if (event === 'SIGNED_IN') {
window.currentUser = session.user;
loadUserProfile();
showToast('Welcome back!', 'success');
} else if (event === 'SIGNED_OUT') {
window.currentUser = null;
updateProfileUI();
updateNotificationBadge(0);
window.notifications = [];
showToast('Signed out', 'info');
}
});

// Start the application
initializeCreatorChannel();
})();
