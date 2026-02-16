// Supabase Configuration
const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';

// Initialize Supabase client for authentication
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase Auth client initialized');

// Global state variables
window.currentUser = null;
window.notifications = [];
window.currentPage = 0;
window.isLoadingMore = false;
window.hasMoreContent = true;
window.PAGE_SIZE = 20;
window.currentCategory = 'All';

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

// Simple Supabase REST client for content queries (not authentication)
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
            const response = await fetch(queryUrl, {
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': 'application/json'
                }
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
        return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/${url.replace(/^\/+/, '')}`;
    }

    async getLiveStreams() {
        try {
            let streams = [];
            try {
                streams = await this.query('Content', {
                    where: { is_live: true, status: 'published' },
                    limit: 10
                });
            } catch (error) {
                streams = await this.query('content', {
                    where: { is_live: true, status: 'published' },
                    limit: 10
                });
            }
            return streams;
        } catch (error) {
            console.error('Error getting live streams:', error);
            return [];
        }
    }

    async getTrendingContent(category = null) {
        try {
            let queryBuilder = null;
            try {
                queryBuilder = supabaseAuth
                    .from('Content')
                    .select('*, user_profiles!user_id(*)')
                    .eq('status', 'published')
                    .order('views_count', { ascending: false })
                    .limit(12);
            } catch (error) {
                queryBuilder = supabaseAuth
                    .from('content')
                    .select('*, user_profiles!user_id(*)')
                    .eq('status', 'published')
                    .order('views_count', { ascending: false })
                    .limit(12);
            }

            if (category && category !== 'All') {
                queryBuilder = queryBuilder.eq('genre', category);
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;

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
            let queryBuilder = null;
            try {
                queryBuilder = supabaseAuth
                    .from('Content')
                    .select('*, user_profiles!user_id(*)')
                    .eq('status', 'published')
                    .order('created_at', { ascending: false })
                    .limit(12);
            } catch (error) {
                queryBuilder = supabaseAuth
                    .from('content')
                    .select('*, user_profiles!user_id(*)')
                    .eq('status', 'published')
                    .order('created_at', { ascending: false })
                    .limit(12);
            }

            if (category && category !== 'All') {
                queryBuilder = queryBuilder.eq('genre', category);
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting new content:', error);
            return [];
        }
    }
}

// Initialize content Supabase client
const contentSupabase = new ContentSupabaseClient(
    'https://ydnxqnbjoshvxteevemc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U'
);

console.log('✅ Content Supabase client initialized');
