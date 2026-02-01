// Supabase Proxy API for secure server-side operations
// This would be deployed on a backend server

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['https://bantustreamconnect.com', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Initialize Supabase client with service role key (server-side only)
const supabaseUrl = process.env.SUPABASE_URL || 'https://ydnxqnbjoshvxteevemc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Store in environment variables

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'bantu-stream-connect-proxy'
    });
});

// Get content endpoint (with caching)
app.get('/api/content', async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0,
            category,
            sort = 'created_at',
            order = 'desc'
        } = req.query;

        let query = supabase
            .from('Content')
            .select('*,user_profiles!user_id(*)')
            .eq('status', 'published')
            .range(offset, offset + limit - 1);

        // Apply filters
        if (category) {
            query = query.eq('genre', category);
        }

        // Apply sorting
        query = query.order(sort, { ascending: order === 'asc' });

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        // Process data
        const processedData = data.map(item => ({
            id: item.id,
            title: item.title || 'Untitled',
            description: item.description || '',
            thumbnail_url: item.thumbnail_url,
            file_url: item.file_url,
            media_type: item.media_type || 'video',
            genre: item.genre,
            created_at: item.created_at,
            creator: item.user_profiles?.full_name || 
                    item.user_profiles?.username || 
                    item.creator || 
                    'Content Creator',
            creator_id: item.creator_id || item.user_id,
            views: item.views_count || item.views || 0,
            likes: item.likes_count || item.likes || 0,
            trending_score: calculateTrendingScore(item)
        }));

        // Set cache headers
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
        res.setHeader('CDN-Cache-Control', 'public, max-age=1800'); // 30 minutes CDN cache
        
        res.json({
            success: true,
            data: processedData,
            meta: {
                count: processedData.length,
                total: data.length,
                offset: parseInt(offset),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch content',
            details: error.message
        });
    }
});

// Search content endpoint
app.get('/api/content/search', async (req, res) => {
    try {
        const { q, category, limit = 20 } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        let query = supabase
            .from('Content')
            .select('*,user_profiles!user_id(*)')
            .eq('status', 'published')
            .or(`title.ilike.%${q}%,description.ilike.%${q}%,genre.ilike.%${q}%`)
            .limit(limit);

        if (category) {
            query = query.eq('genre', category);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            data: data.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                thumbnail_url: item.thumbnail_url,
                creator: item.user_profiles?.full_name || item.user_profiles?.username || item.creator,
                views: item.views || 0,
                likes: item.likes || 0
            })),
            meta: {
                query: q,
                count: data.length
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

// Analytics endpoint (track views, likes, etc.)
app.post('/api/analytics/event', async (req, res) => {
    try {
        const { event, properties, userId, sessionId } = req.body;

        // Validate required fields
        if (!event || !properties) {
            return res.status(400).json({
                success: false,
                error: 'Event and properties are required'
            });
        }

        // Insert analytics event
        const { data, error } = await supabase
            .from('analytics_events')
            .insert({
                event,
                properties,
                user_id: userId,
                session_id: sessionId,
                user_agent: req.headers['user-agent'],
                ip_address: req.ip,
                created_at: new Date().toISOString()
            });

        if (error) {
            throw error;
        }

        // Update content stats if it's a content interaction
        if (event === 'content_view' && properties.content_id) {
            await supabase
                .from('Content')
                .update({ views_count: supabase.raw('views_count + 1') })
                .eq('id', properties.content_id);
        }

        if (event === 'content_like' && properties.content_id) {
            await supabase
                .from('Content')
                .update({ likes_count: supabase.raw('likes_count + 1') })
                .eq('id', properties.content_id);
        }

        res.json({
            success: true,
            message: 'Event tracked successfully'
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track event'
        });
    }
});

// Get user recommendations
app.get('/api/recommendations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10 } = req.query;

        // Get user's watch history and likes
        const { data: userHistory } = await supabase
            .from('user_watch_history')
            .select('content_id, genre')
            .eq('user_id', userId)
            .limit(100);

        const { data: userLikes } = await supabase
            .from('user_likes')
            .select('content_id')
            .eq('user_id', userId);

        // Extract preferred genres
        const preferredGenres = [...new Set(userHistory?.map(h => h.genre).filter(Boolean) || [])];
        const likedContentIds = userLikes?.map(like => like.content_id) || [];

        // Build recommendation query
        let query = supabase
            .from('Content')
            .select('*,user_profiles!user_id(*)')
            .eq('status', 'published')
            .limit(limit);

        // Prioritize preferred genres
        if (preferredGenres.length > 0) {
            query = query.in('genre', preferredGenres);
        }

        // Exclude already liked content
        if (likedContentIds.length > 0) {
            query = query.not('id', 'in', `(${likedContentIds.join(',')})`);
        }

        const { data: recommendations, error } = await query;

        if (error) {
            throw error;
        }

        // If no recommendations based on history, get trending content
        if (!recommendations || recommendations.length === 0) {
            const { data: trending } = await supabase
                .from('Content')
                .select('*,user_profiles!user_id(*)')
                .eq('status', 'published')
                .order('views_count', { ascending: false })
                .limit(limit);

            res.json({
                success: true,
                data: trending || [],
                source: 'trending_fallback'
            });
            return;
        }

        res.json({
            success: true,
            data: recommendations,
            source: 'personalized'
        });

    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get recommendations'
        });
    }
});

// Upload content (with authentication)
app.post('/api/content/upload', async (req, res) => {
    try {
        const { 
            title, 
            description, 
            file_url, 
            thumbnail_url, 
            genre, 
            media_type,
            user_id 
        } = req.body;

        // Validate required fields
        if (!title || !file_url || !user_id) {
            return res.status(400).json({
                success: false,
                error: 'Title, file URL, and user ID are required'
            });
        }

        // Verify user exists
        const { data: user, error: userError } = await supabase
            .from('user_profiles')
            .select('id, can_upload')
            .eq('id', user_id)
            .single();

        if (userError || !user || !user.can_upload) {
            return res.status(403).json({
                success: false,
                error: 'User not authorized to upload content'
            });
        }

        // Insert content
        const { data, error } = await supabase
            .from('Content')
            .insert({
                title,
                description,
                file_url,
                thumbnail_url,
                genre,
                media_type: media_type || 'video',
                user_id,
                creator_id: user_id,
                status: 'pending_review',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            data,
            message: 'Content uploaded successfully and pending review'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload content'
        });
    }
});

// Helper function to calculate trending score
function calculateTrendingScore(content) {
    const views = content.views_count || content.views || 0;
    const likes = content.likes_count || content.likes || 0;
    const createdAt = new Date(content.created_at);
    const now = new Date();
    
    // Calculate age in hours
    const ageInHours = (now - createdAt) / (1000 * 60 * 60);
    
    // Higher score for more recent content
    let score = (views * 1) + (likes * 2);
    
    if (ageInHours < 24) {
        score *= 2; // Double score for content less than 24 hours old
    } else if (ageInHours < 168) { // 7 days
        score *= 1.5;
    }
    
    // Penalize very old content
    if (ageInHours > 720) { // 30 days
        score *= 0.5;
    }
    
    return Math.round(score);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        request_id: req.id
    });
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Supabase proxy server running on port ${PORT}`);
    });
}

module.exports = app;
