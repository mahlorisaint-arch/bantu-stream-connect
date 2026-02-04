console.log('📡 Supabase Helper Initializing...');

// Simple Supabase helper object
const SupabaseHelper = {
    isInitialized: false,
    client: null,
    
    // Initialize helper
    initialize: function() {
        try {
            // Check if we have supabaseClient from the HTML
            if (typeof window.supabaseClient !== 'undefined') {
                this.client = window.supabaseClient;
                this.isInitialized = true;
                console.log('✅ Supabase Helper Initialized with global client');
                return true;
            }
            
            // Try to create client directly if not available
            const SUPABASE_URL = 'https://ydnxqnbjoshvxteevemc.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWV2ZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MzI0OTMsImV4cCI6MjA3MzIwODQ5M30.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U';
            
            if (typeof supabase !== 'undefined') {
                this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                this.isInitialized = true;
                console.log('✅ Supabase Helper Initialized with direct client');
                return true;
            }
            
            console.warn('⚠️ Supabase client not available - running in offline mode');
            return false;
        } catch (error) {
            console.error('❌ Supabase Helper Initialization error:', error);
            return false;
        }
    },
    
    // Get content by ID - FIXED QUERY
    getContentById: async function(contentId) {
        if (!this.isInitialized || !this.client) {
            console.warn('⚠️ Supabase not initialized, using fallback');
            return this.getSampleContent(contentId);
        }
        
        try {
            console.log('🔄 Fetching content with ID:', contentId);
            
            // First try: Simple query without complex joins
            let { data, error } = await this.client
                .from('Content')
                .select('*')
                .eq('id', contentId)
                .single();
            
            if (error) {
                console.error('Error with simple query:', error);
                
                // Second try: Try with different case (content vs Content)
                ({ data, error } = await this.client
                    .from('content')
                    .select('*')
                    .eq('id', contentId)
                    .single());
                    
                if (error) {
                    console.error('Error with lowercase query:', error);
                    return this.getSampleContent(contentId);
                }
            }
            
            if (!data) {
                console.warn('No content found for ID:', contentId);
                return this.getSampleContent(contentId);
            }
            
            console.log('✅ Content fetched successfully:', data.title);
            
            // Try to get creator info separately
            let creatorInfo = await this.getCreatorInfo(data.creator_id || data.user_id);
            
            return {
                id: data.id,
                title: data.title || 'Untitled',
                description: data.description || 'No description available',
                thumbnail_url: data.thumbnail_url || data.thumbnail,
                file_url: data.file_url || data.media_url,
                media_type: data.media_type || 'video',
                genre: data.genre || data.category || 'General',
                created_at: data.created_at || data.upload_date,
                // FIXED: Convert to number with proper fallback
                duration: Number(data.duration) || Number(data.duration_seconds) || 3600,
                language: data.language || 'English',
                views_count: data.views_count || data.views || 0,
                likes_count: data.likes_count || data.likes || 0,
                creator: creatorInfo.name || 'Content Creator',
                creator_display_name: creatorInfo.name || 'Content Creator',
                creator_id: data.creator_id || data.user_id
            };
            
        } catch (error) {
            console.error('❌ Exception in getContentById:', error);
            return this.getSampleContent(contentId);
        }
    },
    
    // Get creator info
    getCreatorInfo: async function(creatorId) {
        if (!this.isInitialized || !creatorId) {
            return { name: 'Content Creator' };
        }
        
        try {
            // Try user_profiles table
            let { data, error } = await this.client
                .from('user_profiles')
                .select('full_name, username')
                .eq('id', creatorId)
                .single();
                
            if (error || !data) {
                // Try creators table
                ({ data, error } = await this.client
                    .from('creators')
                    .select('username, email')
                    .eq('id', creatorId)
                    .single());
            }
            
            if (data) {
                return {
                    name: data.full_name || data.username || data.email?.split('@')[0] || 'Creator'
                };
            }
        } catch (error) {
            console.log('⚠️ Could not fetch creator info:', error);
        }
        
        return { name: 'Content Creator' };
    },
    
    // Sample content fallback - UPDATED WITH PROPER DURATION
    getSampleContent: function(contentId) {
        console.log('📋 Using sample content for ID:', contentId);
        
        const sampleContent = {
            id: contentId || '68',
            title: 'African Music Festival Highlights',
            description: 'Highlights from the biggest African music festival featuring top artists from across the continent. Experience the vibrant culture, amazing performances, and unforgettable moments.',
            thumbnail_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop',
            file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            media_type: 'video',
            genre: 'Music',
            created_at: '2025-01-15T10:30:00Z',
            creator: 'Music Africa',
            creator_display_name: 'Music Africa',
            duration: 3600, // 1 hour in seconds
            language: 'English',
            views_count: 12500,
            likes_count: 890,
            creator_id: 'creator123'
        };
        
        return sampleContent;
    },
    
    // Get related content
    getRelatedContent: async function(currentContentId, currentGenre, creatorId, limit = 6) {
        if (!this.isInitialized) {
            return this.getSampleRelated();
        }
        
        try {
            let query = this.client
                .from('Content')
                .select('id, title, thumbnail_url, views_count')
                .neq('id', currentContentId)
                .limit(limit);
            
            if (currentGenre && currentGenre !== 'General') {
                query = query.eq('genre', currentGenre);
            } else if (creatorId) {
                query = query.eq('creator_id', creatorId);
            }
            
            const { data, error } = await query;
            
            if (error || !data) {
                console.error('Error fetching related:', error);
                return this.getSampleRelated();
            }
            
            return data.map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                thumbnail_url: item.thumbnail_url,
                views_count: item.views_count || 0
            }));
            
        } catch (error) {
            console.error('Exception in getRelatedContent:', error);
            return this.getSampleRelated();
        }
    },
    
    // Sample related content
    getSampleRelated: function() {
        return [
            {
                id: '2',
                title: 'Tech Innovation in Africa',
                thumbnail_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop',
                views_count: 8900
            },
            {
                id: '3',
                title: 'Traditional Dance Performance',
                thumbnail_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=225&fit=crop',
                views_count: 15600
            },
            {
                id: '4',
                title: 'African Wildlife Documentary',
                thumbnail_url: 'https://images.unsplash.com/photo-1550358864-518f202c02ba?w=400&h=225&fit=crop',
                views_count: 12000
            },
            {
                id: '5',
                title: 'Modern African Architecture',
                thumbnail_url: 'https://images.unsplash.com/photo-1542293787938-c9e299b880cc?w=400&h=225&fit=crop',
                views_count: 7600
            }
        ];
    },
    
    // Get comments
    getComments: async function(contentId) {
        if (!this.isInitialized) {
            return [];
        }
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .select('*')
                .eq('content_id', contentId)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching comments:', error);
                return [];
            }
            
            return data || [];
        } catch (error) {
            console.error('Exception in getComments:', error);
            return [];
        }
    },
    
    // Add comment
    addComment: async function(contentId, commentText, userId, authorName) {
        if (!this.isInitialized) return null;
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .insert({
                    content_id: contentId,
                    user_id: userId,
                    author_name: authorName || 'User',
                    comment_text: commentText
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error adding comment:', error);
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Exception in addComment:', error);
            return null;
        }
    },
    
    // Record view
    recordView: async function(contentId, userId) {
        if (!this.isInitialized) return false;
        
        try {
            const { error } = await this.client
                .from('content_views')
                .insert({
                    content_id: contentId,
                    viewer_id: userId || null,
                    device_type: this.getDeviceType(),
                    viewed_at: new Date().toISOString()
                });
            
            if (error) {
                console.error('Error recording view:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Exception in recordView:', error);
            return false;
        }
    },
    
    // Get current user
    getCurrentUser: async function() {
        if (!this.isInitialized) {
            console.log('⚠️ Supabase not initialized, returning null user');
            return null;
        }
        
        try {
            const { data, error } = await this.client.auth.getUser();
            if (error) {
                console.log('⚠️ No authenticated user:', error.message);
                return null;
            }
            return data.user;
        } catch (error) {
            console.error('Exception in getCurrentUser:', error);
            return null;
        }
    },
    
    // Fix media URL
    fixMediaUrl: function(url) {
        if (!url) return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop';
        
        // If it's already a full URL, return it
        if (url.startsWith('http')) {
            return url;
        }
        
        // Otherwise, construct the URL
        const projectRef = 'ydnxqnbjoshvxteevemc';
        
        if (url.includes('thumbnails')) {
            return `https://${projectRef}.supabase.co/storage/v1/object/public/content-thumbnails/${url}`;
        } else if (url.includes('media')) {
            return `https://${projectRef}.supabase.co/storage/v1/object/public/content-media/${url}`;
        } else {
            // Try to guess
            return `https://${projectRef}.supabase.co/storage/v1/object/public/${url}`;
        }
    },
    
    // Helper function
    getDeviceType: function() {
        const userAgent = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) return 'mobile';
        if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
        return 'desktop';
    }
};

// Initialize immediately (don't wait for DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - initializing helper...');
    SupabaseHelper.initialize();
});

// Also try to initialize immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        SupabaseHelper.initialize();
    });
} else {
    // DOM already loaded, initialize now
    SupabaseHelper.initialize();
}

// Make available globally
window.SupabaseHelper = SupabaseHelper;
