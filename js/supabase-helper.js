// supabase-helper.js - Simplified Supabase helper for content-detail page

console.log('📡 Supabase Helper Initializing...');

// Simple Supabase helper object
const SupabaseHelper = {
    isInitialized: false,
    client: null,
    
    initialize: function() {
        if (typeof window.supabaseClient !== 'undefined') {
            this.client = window.supabaseClient;
            this.isInitialized = true;
            console.log('✅ Supabase Helper Initialized');
            return true;
        }
        console.warn('⚠️ Supabase client not available');
        return false;
    },
    
    // Get content by ID
    getContentById: async function(contentId) {
        if (!this.isInitialized) return null;
        
        try {
            console.log('Fetching content with ID:', contentId);
            
            const { data, error } = await this.client
                .from('Content')
                .select(`
                    *,
                    user_profiles!Content_user_id_fkey (
                        id,
                        username,
                        full_name,
                        avatar_url
                    ),
                    creators!Content_creator_id_fkey (
                        id,
                        username,
                        email
                    )
                `)
                .eq('id', contentId)
                .single();
            
            if (error) {
                console.error('Error fetching content:', error);
                return null;
            }
            
            if (!data) {
                console.error('No content found for ID:', contentId);
                return null;
            }
            
            console.log('Content fetched successfully:', data.title);
            return this.formatContent(data);
            
        } catch (error) {
            console.error('Exception in getContentById:', error);
            return null;
        }
    },
    
    // Format content data
    formatContent: function(content) {
        if (!content) return null;
        
        // Determine creator name
        let creatorDisplayName = 'Unknown Creator';
        if (content.user_profiles && content.user_profiles.full_name) {
            creatorDisplayName = content.user_profiles.full_name;
        } else if (content.user_profiles && content.user_profiles.username) {
            creatorDisplayName = content.user_profiles.username;
        } else if (content.creators && content.creators.username) {
            creatorDisplayName = content.creators.username;
        } else if (content.creator) {
            creatorDisplayName = content.creator;
        }
        
        return {
            id: content.id,
            title: content.title || 'Untitled',
            description: content.description || '',
            thumbnail_url: content.thumbnail_url,
            file_url: content.file_url,
            media_type: content.media_type || 'video',
            genre: content.genre,
            created_at: content.created_at,
            duration: content.duration || 0,
            language: content.language || 'English',
            views_count: content.views_count || 0,
            likes_count: content.likes_count || 0,
            creator: creatorDisplayName,
            creator_display_name: creatorDisplayName,
            creator_id: content.creator_id || content.user_id,
            user_id: content.user_id
        };
    },
    
    // Get related content
    getRelatedContent: async function(currentContentId, currentGenre, creatorId, limit = 6) {
        if (!this.isInitialized) return [];
        
        try {
            let query = this.client
                .from('Content')
                .select('*')
                .neq('id', currentContentId)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (currentGenre) {
                query = query.eq('genre', currentGenre);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching related content:', error);
                return [];
            }
            
            return (data || []).map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                thumbnail_url: item.thumbnail_url,
                views_count: item.views_count || 0
            }));
            
        } catch (error) {
            console.error('Exception in getRelatedContent:', error);
            return [];
        }
    },
    
    // Get comments
    getComments: async function(contentId) {
        if (!this.isInitialized) return [];
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .select(`
                    *,
                    user_profiles!comments_user_id_fkey (
                        username,
                        full_name,
                        avatar_url
                    )
                `)
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
        if (!this.isInitialized || !userId) return null;
        
        try {
            const { data, error } = await this.client
                .from('comments')
                .insert({
                    content_id: contentId,
                    user_id: userId,
                    author_name: authorName,
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
                    device_type: this.getDeviceType()
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
        if (!this.isInitialized) return null;
        
        try {
            const { data, error } = await this.client.auth.getUser();
            if (error) {
                console.error('Error getting current user:', error);
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

// Initialize when loaded
document.addEventListener('DOMContentLoaded', function() {
    SupabaseHelper.initialize();
});

// Make available globally
window.SupabaseHelper = SupabaseHelper;
