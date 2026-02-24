// Supabase Configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Auth client initialized');

// Global state variables (minimal - only for auth/profiles)
window.currentUser = null;
window.currentProfile = null;
window.notifications = [];
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;
window.currentCategory = 'All';
window.userProfiles = [];
window.userBadges = [];

// Categories list
const categories = [
    'All',
    'Music',
    'STEM',
    'Culture',
    'News',
    'Sports',
    'Movies',
    'Documentaries',
    'Podcasts',
    'Skits',
    'Videos'
];

// South African languages mapping
const languageMap = {
    'en': 'English',
    'zu': 'IsiZulu',
    'xh': 'IsiXhosa',
    'af': 'Afrikaans',
    'nso': 'Sepedi',
    'st': 'Sesotho',
    'tn': 'Setswana',
    'ss': 'siSwati',
    've': 'Tshivenda',
    'ts': 'Xitsonga',
    'nr': 'isiNdebele'
};
window.languageMap = languageMap;

// Simple Supabase REST client for content queries
class ContentSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }

    async query(table, options = {}) {
        const {
            select = '*',
            where = {},
            orderBy = 'created_at',
            order = 'desc',
            limit = 100,
            offset = 0
        } = options;

        let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;

        Object.keys(where).forEach(key => {
            if (where[key] !== undefined && where[key] !== null) {
                queryUrl += `&${key}=eq.${encodeURIComponent(where[key])}`;
            }
        });

        if (orderBy) {
            queryUrl += `&order=${orderBy}.${order}`;
        }

        if (limit) {
            queryUrl += `&limit=${limit}`;
        }

        if (offset) {
            queryUrl += `&offset=${offset}`;
        }

        try {
            const response = await window.rateLimiter.execute('content', async () => {
                const res = await fetch(queryUrl, {
                    headers: {
                        'apikey': this.key,
                        'Authorization': `Bearer ${this.key}`,
                        'Content-Type': 'application/json'
                    }
                });
                return res;
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Supabase query error:', error);
            throw error;
        }
    }

    fixMediaUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.includes('supabase.co')) return url;
        return `${this.url}/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
    }
}

// Initialize content Supabase client
const contentSupabase = new ContentSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.contentSupabase = contentSupabase;

console.log('✅ Content Supabase client initialized');

// Make supabaseAuth available globally
window.supabaseAuth = supabaseAuth;
