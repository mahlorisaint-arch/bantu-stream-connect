/**
 * BANTU STREAM CONNECT - EXPLORE SCREEN CORE v3.0
 * Discovery Worlds Architecture
 */

// ============================================
// 1. SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase
window.supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// 2. GLOBAL STATE
// ============================================
window.appState = {
  currentUser: null,
  currentProfile: null,
  languageFilter: 'all',
  journeySelections: {
    mood: null,
    region: null,
    language: null,
    format: null
  },
  currentWorld: null,
  isLoading: false,
  notifications: []
};

// ============================================
// 3. DISCOVERY WORLDS DATA
// ============================================
window.discoveryWorlds = [
  {
    id: 'film',
    name: 'Film World',
    icon: 'fa-film',
    description: 'Cinematic stories from Africa',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    genres: ['Nollywood', 'African Sci-Fi', 'Township Dramas', 'Documentaries'],
    activeCount: 234
  },
  {
    id: 'music',
    name: 'Music World',
    icon: 'fa-music',
    description: 'Rhythms that move the continent',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #1e1e2f, #2d1b3a)',
    genres: ['Amapiano', 'Afrobeats', 'Afro-jazz', 'Gospel'],
    activeCount: 567
  },
  {
    id: 'podcast',
    name: 'Podcast World',
    icon: 'fa-podcast',
    description: 'Conversations that matter',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #1a2e1a, #0f2e1a)',
    genres: ['Business', 'Storytelling', 'Culture', 'Interviews'],
    activeCount: 189
  },
  {
    id: 'creator',
    name: 'Creator World',
    icon: 'fa-user-astronaut',
    description: 'Meet the architects of culture',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #2e1a0f, #2e241a)',
    genres: ['Rising Stars', 'Verified', 'Trending', 'Collaborations'],
    activeCount: 892
  },
  {
    id: 'anime',
    name: 'Anime & Animation',
    icon: 'fa-dragon',
    description: 'African animation rising',
    color: '#06B6D4',
    gradient: 'linear-gradient(135deg, #0f2e2e, #0f2a2e)',
    genres: ['African Anime', 'Animation', 'Fantasy', 'Illustration'],
    activeCount: 145
  },
  {
    id: 'culture',
    name: 'Culture World',
    icon: 'fa-drumstick-bite',
    description: 'Heritage, traditions, and futures',
    color: '#EF4444',
    gradient: 'linear-gradient(135deg, #2e1a1a, #2e1f1a)',
    genres: ['Fashion', 'Languages', 'Traditions', 'Storytelling'],
    activeCount: 312
  }
];

// ============================================
// 4. JOURNEY OPTIONS
// ============================================
window.journeyOptions = {
  moods: [
    { id: 'inspirational', name: 'Inspirational', icon: 'fa-sun', color: '#F59E0B' },
    { id: 'energetic', name: 'Energetic', icon: 'fa-bolt', color: '#EF4444' },
    { id: 'deep', name: 'Deep Stories', icon: 'fa-book-open', color: '#8B5CF6' },
    { id: 'futuristic', name: 'Futuristic', icon: 'fa-robot', color: '#06B6D4' },
    { id: 'funny', name: 'Funny', icon: 'fa-laugh', color: '#10B981' },
    { id: 'emotional', name: 'Emotional', icon: 'fa-heart', color: '#EC4899' },
    { id: 'educational', name: 'Educational', icon: 'fa-graduation-cap', color: '#3B82F6' },
    { id: 'spiritual', name: 'Spiritual', icon: 'fa-pray', color: '#A855F7' }
  ],
  regions: [
    { id: 'south-africa', name: 'South Africa', flag: '🇿🇦' },
    { id: 'nigeria', name: 'Nigeria', flag: '🇳🇬' },
    { id: 'kenya', name: 'Kenya', flag: '🇰🇪' },
    { id: 'ghana', name: 'Ghana', flag: '🇬🇭' },
    { id: 'tanzania', name: 'Tanzania', flag: '🇹🇿' },
    { id: 'zimbabwe', name: 'Zimbabwe', flag: '🇿🇼' },
    { id: 'pan-african', name: 'Pan-African', flag: '🌍' }
  ],
  languages: [
    { id: 'en', name: 'English', native: 'English' },
    { id: 'zu', name: 'Zulu', native: 'isiZulu' },
    { id: 'xh', name: 'Xhosa', native: 'isiXhosa' },
    { id: 'sw', name: 'Swahili', native: 'Kiswahili' },
    { id: 'yo', name: 'Yoruba', native: 'Yorùbá' },
    { id: 'fr', name: 'French', native: 'Français' },
    { id: 'pt', name: 'Portuguese', native: 'Português' }
  ],
  formats: [
    { id: 'film', name: 'Film', icon: 'fa-film' },
    { id: 'music', name: 'Music', icon: 'fa-music' },
    { id: 'podcast', name: 'Podcast', icon: 'fa-podcast' },
    { id: 'live', name: 'Live Stream', icon: 'fa-broadcast-tower' },
    { id: 'animation', name: 'Animation', icon: 'fa-dragon' },
    { id: 'short', name: 'Short-form', icon: 'fa-photo-video' }
  ]
};

// ============================================
// 5. CULTURAL HUB DATA
// ============================================
window.culturalFeatures = [
  {
    title: 'Sounds of Africa',
    description: 'Discover regional music movements from Cape Town to Cairo',
    icon: 'fa-headphones',
    color: '#EC4899',
    image: null
  },
  {
    title: 'Township Stories',
    description: 'Real stories from African communities',
    icon: 'fa-home',
    color: '#F59E0B',
    image: null
  },
  {
    title: 'African Futurism',
    description: 'Sci-fi, tech, and future African storytelling',
    icon: 'fa-rocket',
    color: '#06B6D4',
    image: null
  },
  {
    title: 'Indigenous Voices',
    description: "Language-first discovery experiences in Africa's 2000+ languages",
    icon: 'fa-language',
    color: '#10B981',
    image: null
  },
  {
    title: 'Women of African Creativity',
    description: 'Highlighting women creators and innovators',
    icon: 'fa-female',
    color: '#EC4899',
    image: null
  },
  {
    title: 'Rising African Animators',
    description: 'The next generation of animation storytellers',
    icon: 'fa-paintbrush',
    color: '#8B5CF6',
    image: null
  }
];

// ============================================
// 6. UTILITY FUNCTIONS
// ============================================
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

window.formatNumber = function(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

window.escapeHtml = function(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// ============================================
// 7. EXPORT FOR FEATURES FILE
// ============================================
console.log('🚀 Explore Screen Core v3.0 Loaded - Discovery Worlds Architecture');
