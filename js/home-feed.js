// Supabase Configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Auth client initialized');

// Global state variables
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
window.continueWatching = [];
window.recommendations = [];
window.shorts = [];
window.liveStreams = [];
window.trendingContent = [];
window.newContent = [];
window.communityFavorites = [];

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
            queryUrl += `&${key}=eq.${encodeURIComponent(where[key])}`;
        });

        if (orderBy) {
            queryUrl += `&order=${orderBy}.${order}`;
        }

        queryUrl += `&limit=${limit}&offset=${offset}`;

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

    async getLiveStreams() {
        try {
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('media_type', 'live')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(10);
            
            return data || [];
        } catch (error) {
            console.error('Error getting live streams:', error);
            return [];
        }
    }

    async getTrendingContent(category = null) {
        try {
            let query = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(12);

            if (category && category !== 'All') {
                query = query.eq('genre', category);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Enrich with real view counts
            const enriched = await Promise.all(
                (data || []).map(async (item) => {
                    const { count: viewsCount } = await supabaseAuth
                        .from('content_views')
                        .select('*', { count: 'exact', head: true })
                        .eq('content_id', item.id);
                    
                    return {
                        ...item,
                        real_views: viewsCount || item.views_count || 0
                    };
                })
            );

            return enriched;
        } catch (error) {
            console.error('Error getting trending content:', error);
            return [];
        }
    }

    async getNewContent(category = null) {
        try {
            let query = supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(12);

            if (category && category !== 'All') {
                query = query.eq('genre', category);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting new content:', error);
            return [];
        }
    }

    async getCommunityFavorites() {
        try {
            const { data, error } = await supabaseAuth
                .from('Content')
                .select('*, user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('favorites_count', { ascending: false })
                .limit(12);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting community favorites:', error);
            return [];
        }
    }
}

// Initialize content Supabase client
const contentSupabase = new ContentSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.contentSupabase = contentSupabase;

console.log('✅ Content Supabase client initialized');
