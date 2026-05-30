/**
 * For You Module
 * Handles personalized content recommendations based on user preferences,
 * using content_engagement_stats for engagement weighting.
 * 
 * UPDATED: Now filters by content_format for long-form content only,
 * uses array overlap for preference matching, and fetches metrics from
 * content_engagement_stats.
 * 
 * BADGE FIX: Split layout with glassmorphism badges
 * GLITCH FIX: Added error boundaries, proper null checks, and RAF for animations
 * FIXED: Infinite loading issue - proper error handling and fallback content
 */

const ForYou = (function() {
    'use strict';
    
    // Private variables
    let container = null;
    let currentUser = null;
    let refreshInterval = null;
    let userPreferences = null;
    let isLoading = false;
    let initAttempts = 0;
    let loadPromise = null;
    const MAX_INIT_ATTEMPTS = 3;
    
    // Configuration
    const CACHE_KEY = 'feed_forYou';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const MAX_ITEMS = 12;
    const DISPLAY_ITEMS = 8;
    const REFRESH_INTERVAL = 300000; // 5 minutes
    
    // Long-form content formats (per specification)
    const LONG_FORM_FORMATS = ['video', 'movie', 'podcast', 'audio', 'long_form', 'film', 'documentary', 'series_episode'];
    
    // South African languages for amplification
    const LOCAL_LANGUAGES = ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af'];
    
    /**
     * Initialize For You module with error handling
     */
    async function init() {
        // Prevent multiple simultaneous initializations
        if (isLoading) {
            console.log('🎯 For You already initializing, waiting...');
            // Wait for the existing load to complete
            if (loadPromise) {
                await loadPromise;
            }
            return;
        }
        
        isLoading = true;
        console.log('🎯 For You Module initializing...');
        
        try {
            container = document.getElementById('for-you-grid');
            
            if (!container) {
                console.warn('For You container not found, creating fallback');
                createFallbackContainer();
                container = document.getElementById('for-you-grid');
                if (!container) {
                    console.error('Could not create For You container');
                    isLoading = false;
                    return;
                }
            }
            
            // Get current user
            await getCurrentUser();
            
            // Load user preferences (with error tolerance)
            await loadUserPreferences();
            
            // Load content
            await loadContent();
            
            // Setup see all button
            setupSeeAllButton();
            
            // Add personalization tooltip
            addPersonalizationTooltip();
            
            // Start background refresh
            startBackgroundRefresh();
            
            console.log('✅ For You Module initialized successfully');
            initAttempts = 0;
            
        } catch (err) {
            console.error('❌ For You Module initialization error:', err);
            initAttempts++;
            
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                console.log(`Retrying initialization (${initAttempts}/${MAX_INIT_ATTEMPTS})...`);
                setTimeout(() => {
                    isLoading = false;
                    init();
                }, 2000);
            } else {
                // Show fallback content instead of error state
                showFallbackContent();
            }
        } finally {
            isLoading = false;
            loadPromise = null;
        }
    }
    
    /**
     * Create fallback container if not present
     */
    function createFallbackContainer() {
        const forYouSection = document.getElementById('for-you-section');
        if (forYouSection && !document.getElementById('for-you-grid')) {
            const grid = document.createElement('div');
            grid.id = 'for-you-grid';
            grid.className = 'content-grid';
            forYouSection.appendChild(grid);
            container = grid;
        }
    }
    
    /**
     * Get current user from Supabase
     */
    async function getCurrentUser() {
        try {
            if (!window.supabaseAuth) {
                currentUser = null;
                return;
            }
            
            const { data: { session }, error } = await window.supabaseAuth.auth.getSession();
            if (error) throw error;
            
            currentUser = session?.user || null;
            
            if (currentUser) {
                console.log('👤 User authenticated for For You:', currentUser.id);
                await loadUserProfile();
            } else {
                console.log('👤 No user logged in for For You');
            }
        } catch (err) {
            console.error('Error getting current user:', err);
            currentUser = null;
        }
    }
    
    /**
     * Load user profile data including category interests
     */
    async function loadUserProfile() {
        if (!currentUser || !window.supabaseAuth) return;
        
        try {
            // Fix: Use maybeSingle() instead of single() to avoid 400 error when no rows
            const { data: profile, error } = await window.supabaseAuth
                .from('user_profiles')
                .select('id, full_name, username, category_interests, preferred_languages, location')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            if (error) {
                console.warn('Could not load user profile:', error.message);
                return;
            }
            
            if (profile) {
                currentUser.profile = profile;
                console.log('👤 User profile loaded:', profile);
            }
        } catch (err) {
            console.warn('Could not load user profile:', err);
        }
    }
    
    /**
     * Load user preferences from category_interests, likes, and watch history
     */
    async function loadUserPreferences() {
        if (!currentUser) {
            userPreferences = { hasPreferences: false, genres: [], languages: [] };
            return;
        }
        
        try {
            let categoryInterests = [];
            let preferredLanguages = [];
            
            // First, try to get category_interests from user profile
            if (currentUser.profile?.category_interests) {
                categoryInterests = Array.isArray(currentUser.profile.category_interests) 
                    ? currentUser.profile.category_interests 
                    : (currentUser.profile.category_interests ? [currentUser.profile.category_interests] : []);
                preferredLanguages = Array.isArray(currentUser.profile.preferred_languages)
                    ? currentUser.profile.preferred_languages
                    : (currentUser.profile.preferred_languages ? [currentUser.profile.preferred_languages] : []);
            }
            
            // If no category interests from profile, try to derive from liked content
            if (categoryInterests.length === 0 && window.supabaseAuth) {
                try {
                    // Get user's liked content
                    const { data: likedContent, error: likesError } = await window.supabaseAuth
                        .from('content_likes')
                        .select('content_id')
                        .eq('user_id', currentUser.id)
                        .limit(30);
                    
                    if (!likesError && likedContent && likedContent.length > 0) {
                        const likedIds = likedContent.map(l => l.content_id);
                        
                        // Get genres from liked content
                        const { data: likedGenres } = await window.supabaseAuth
                            .from('Content')
                            .select('genre, language')
                            .in('id', likedIds.slice(0, 15));
                        
                        if (likedGenres) {
                            categoryInterests = [...new Set(likedGenres.map(g => g.genre).filter(Boolean))];
                            preferredLanguages = [...new Set(likedGenres.map(g => g.language).filter(Boolean))];
                        }
                    }
                } catch (likesErr) {
                    console.warn('Could not fetch liked content:', likesErr);
                }
                
                // If still no preferences, try watch history
                if (categoryInterests.length === 0) {
                    try {
                        const { data: watchHistory } = await window.supabaseAuth
                            .from('watch_progress')
                            .select('content_id, total_watch_time')
                            .eq('user_id', currentUser.id)
                            .limit(30);
                        
                        if (watchHistory && watchHistory.length > 0) {
                            const watchedIds = watchHistory.map(w => w.content_id);
                            
                            const { data: watchedGenres } = await window.supabaseAuth
                                .from('Content')
                                .select('genre, language')
                                .in('id', watchedIds.slice(0, 15));
                            
                            if (watchedGenres) {
                                categoryInterests = [...new Set(watchedGenres.map(g => g.genre).filter(Boolean))];
                                preferredLanguages = [...new Set(watchedGenres.map(g => g.language).filter(Boolean))];
                            }
                        }
                    } catch (watchErr) {
                        console.warn('Could not fetch watch history:', watchErr);
                    }
                }
            }
            
            userPreferences = {
                genres: categoryInterests.slice(0, 5),
                languages: preferredLanguages.slice(0, 3),
                hasPreferences: categoryInterests.length > 0,
                lastUpdated: Date.now()
            };
            
            console.log('📊 User Preferences loaded:', userPreferences);
            
        } catch (err) {
            console.error('Error loading user preferences:', err);
            userPreferences = { hasPreferences: false, genres: [], languages: [] };
        }
    }
    
    /**
     * Load content (with caching and error handling)
     */
    async function loadContent() {
        const startTime = performance.now();
        
        // Don't load if already loading
        if (isLoading && loadPromise) {
            console.log('Already loading, waiting for existing load...');
            return loadPromise;
        }
        
        // Create a new load promise
        loadPromise = (async () => {
            try {
                // Try cached data first
                const cachedData = loadFromCache();
                if (cachedData && cachedData.length > 0) {
                    console.log('📦 For You: Using cached data,', cachedData.length, 'items');
                    if (container) {
                        container.innerHTML = '';
                        renderCards(cachedData);
                        animateCards();
                    }
                    // Refresh in background
                    refreshInBackground();
                    return;
                }
                
                // Show skeletons
                if (container) showSkeletons();
                
                let contentList = [];
                
                // Try to get personalized recommendations
                if (currentUser && userPreferences?.hasPreferences) {
                    contentList = await getPersonalizedRecommendations();
                }
                
                // Fallback to trending/recent content if no personalized content
                if (!contentList || contentList.length === 0) {
                    console.log('No personalized content, falling back to recent content');
                    contentList = await getRecentContentFallback();
                }
                
                // Second fallback - get any published content
                if (!contentList || contentList.length === 0) {
                    console.log('No recent content, falling back to any published content');
                    contentList = await getAnyContentFallback();
                }
                
                if (!contentList || contentList.length === 0) {
                    showEmptyState();
                    return;
                }
                
                // Build complete dataset with metrics from engagement_stats
                let sectionData = await buildSectionData(contentList.slice(0, DISPLAY_ITEMS));
                
                // Apply Amplification Logic
                sectionData = applyAmplificationLogic(sectionData);
                
                // Sort by amplification score
                sectionData.sort((a, b) => (b.amplification_score || 0) - (a.amplification_score || 0));
                
                // Render
                if (container) {
                    container.innerHTML = '';
                    renderCards(sectionData);
                }
                
                // Cache the result
                saveToCache(sectionData);
                
                // Animate cards
                animateCards();
                
                const loadTime = performance.now() - startTime;
                console.log(`📊 For You section loaded in ${loadTime.toFixed(0)}ms with ${sectionData.length} items`);
                
            } catch (err) {
                console.error("❌ For You Section Error:", err);
                const cached = loadFromCache();
                if (cached && cached.length > 0) {
                    if (container) {
                        container.innerHTML = '';
                        renderCards(cached);
                        animateCards();
                    }
                } else {
                    showFallbackContent();
                }
            }
        })();
        
        return loadPromise;
    }
    
    /**
     * Get personalized recommendations based on user preferences
     */
    async function getPersonalizedRecommendations() {
        let contentList = [];
        
        try {
            if (!window.supabaseAuth) return [];
            
            // Build the query
            let query = window.supabaseAuth
                .from('Content')
                .select(`
                    id, 
                    title, 
                    description, 
                    thumbnail_url, 
                    duration, 
                    genre, 
                    language, 
                    created_at, 
                    favorites_count,
                    content_format,
                    media_type,
                    tags,
                    user_id, 
                    user_profiles!user_id (
                        id, 
                        full_name, 
                        username, 
                        avatar_url
                    )
                `)
                .eq('status', 'published')
                .in('content_format', LONG_FORM_FORMATS);
            
            // Only add genre filter if we have preferences
            if (userPreferences.genres && userPreferences.genres.length > 0) {
                const validGenres = userPreferences.genres.filter(g => g && typeof g === 'string');
                if (validGenres.length > 0) {
                    query = query.in('genre', validGenres);
                }
            }
            
            // Get the content
            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(MAX_ITEMS);
            
            if (error) {
                console.warn('Error in personalized query:', error.message);
                return [];
            }
            
            contentList = data || [];
            
            // If we don't have enough, add some recent content without preference filter
            if (contentList.length < DISPLAY_ITEMS) {
                const existingIds = contentList.map(c => c.id).filter(Boolean);
                
                let fallbackQuery = window.supabaseAuth
                    .from('Content')
                    .select(`
                        id, title, description, thumbnail_url, duration, 
                        genre, language, created_at, favorites_count,
                        content_format, media_type, tags,
                        user_id, user_profiles!user_id (
                            id, full_name, username, avatar_url
                        )
                    `)
                    .eq('status', 'published')
                    .in('content_format', LONG_FORM_FORMATS);
                
                if (existingIds.length > 0) {
                    fallbackQuery = fallbackQuery.not('id', 'in', `(${existingIds.join(',')})`);
                }
                
                const { data: fallbackData, error: fallbackError } = await fallbackQuery
                    .order('created_at', { ascending: false })
                    .limit(DISPLAY_ITEMS - contentList.length);
                
                if (!fallbackError && fallbackData) {
                    contentList = [...contentList, ...fallbackData];
                }
            }
            
        } catch (err) {
            console.error('Error getting personalized recommendations:', err);
        }
        
        return contentList;
    }
    
    /**
     * Get recent content as fallback (simpler query)
     */
    async function getRecentContentFallback() {
        try {
            if (!window.supabaseAuth) return [];
            
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, favorites_count,
                    content_format, media_type,
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('status', 'published')
                .in('content_format', LONG_FORM_FORMATS)
                .order('created_at', { ascending: false })
                .limit(DISPLAY_ITEMS);
            
            if (error) {
                console.warn('Error fetching recent content:', error.message);
                return [];
            }
            
            return data || [];
        } catch (err) {
            console.error('Error getting recent content:', err);
            return [];
        }
    }
    
    /**
     * Get any content as final fallback (no format filter)
     */
    async function getAnyContentFallback() {
        try {
            if (!window.supabaseAuth) return [];
            
            // Simpler query - just get any published content
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select(`
                    id, title, description, thumbnail_url, duration, 
                    genre, language, created_at, favorites_count,
                    user_id, user_profiles!user_id (
                        id, full_name, username, avatar_url
                    )
                `)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(DISPLAY_ITEMS);
            
            if (error) {
                console.warn('Error fetching any content:', error.message);
                return [];
            }
            
            return data || [];
        } catch (err) {
            console.error('Error getting any content:', err);
            return [];
        }
    }
    
    /**
     * Apply amplification logic to boost relevant content
     */
    function applyAmplificationLogic(items) {
        if (!items || !Array.isArray(items)) return [];
        
        return items.map(item => {
            let score = 0;
            
            // Base score from engagement metrics
            const baseScore = (item.metrics?.views || 0) + 
                             ((item.metrics?.likes || 0) * 5) + 
                             ((item.metrics?.shares || 0) * 10);
            
            score = baseScore || (item.favorites_count || 0) * 5;
            let boostReason = null;
            
            // 1. Local Language Boost
            if (item.language && LOCAL_LANGUAGES.includes(item.language)) {
                score = score * 1.3;
                boostReason = 'Local language content';
            }
            
            // 2. Emerging Creator Boost (< 1000 connectors)
            if (item.metrics?.connectors < 1000) {
                score = score * 1.2;
                boostReason = boostReason ? `${boostReason} + Emerging creator` : 'Emerging creator';
            }
            
            // 3. Freshness Boost (< 7 days old)
            if (item.created_at) {
                const daysOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
                if (daysOld < 7) {
                    score = score * 1.4;
                    boostReason = boostReason ? `${boostReason} + Fresh content` : 'Fresh content';
                }
            }
            
            // 4. Genre Match Boost
            if (userPreferences?.genres?.includes(item.genre)) {
                score = score * 1.25;
                boostReason = boostReason ? `${boostReason} + Matches your interests` : 'Matches your interests';
            }
            
            return { 
                ...item, 
                amplification_score: Math.max(score, 100),
                boost_reason: boostReason || 'Recommended for you',
                metrics: {
                    ...item.metrics,
                    base_score: baseScore
                }
            };
        });
    }
    
    /**
     * Show fallback content when all else fails
     */
    async function showFallbackContent() {
        if (!container) return;
        
        try {
            const fallbackContent = await getRecentContentFallback();
            if (fallbackContent && fallbackContent.length > 0) {
                const sectionData = await buildSectionData(fallbackContent);
                renderCards(sectionData);
                animateCards();
            } else {
                showEmptyState();
            }
        } catch (err) {
            showEmptyState();
        }
    }
    
    /**
     * Build section data with metrics from content_engagement_stats
     */
    async function buildSectionData(contentList) {
        if (!contentList || contentList.length === 0) return [];
        
        const contentIds = contentList.map(c => c.id).filter(Boolean);
        const creatorIds = [...new Set(contentList.map(c => c.user_id).filter(Boolean))];
        
        // Fetch engagement metrics from content_engagement_stats
        let engagementMetrics = {};
        let connectors = {};
        
        if (window.supabaseAuth) {
            engagementMetrics = await fetchEngagementMetrics(contentIds);
            connectors = await fetchConnectorCounts(creatorIds);
        }
        
        return contentList.map(item => ({
            ...item,
            metrics: {
                views: engagementMetrics[item.id]?.total_views || item.views_count || 0,
                likes: engagementMetrics[item.id]?.total_likes || 0,
                comments: engagementMetrics[item.id]?.total_comments || 0,
                shares: engagementMetrics[item.id]?.total_shares || 0,
                favorites: item.favorites_count || 0,
                connectors: connectors[item.user_id] || 0
            }
        }));
    }
    
    /**
     * Fetch engagement metrics from content_engagement_stats table
     */
    async function fetchEngagementMetrics(contentIds) {
        if (!contentIds.length || !window.supabaseAuth) return {};
        
        try {
            const { data, error } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments, total_shares')
                .in('content_id', contentIds);
            
            if (error) {
                console.warn('Error fetching engagement metrics:', error.message);
                return {};
            }
            
            const metricsMap = {};
            data?.forEach(row => {
                metricsMap[row.content_id] = {
                    total_views: row.total_views || 0,
                    total_likes: row.total_likes || 0,
                    total_comments: row.total_comments || 0,
                    total_shares: row.total_shares || 0
                };
            });
            
            return metricsMap;
        } catch (err) {
            console.warn('Error fetching engagement metrics:', err);
            return {};
        }
    }
    
    /**
     * Fetch connector counts
     */
    async function fetchConnectorCounts(creatorIds) {
        if (!creatorIds || creatorIds.length === 0 || !window.supabaseAuth) return {};
        
        const limitedIds = creatorIds.slice(0, 50);
        try {
            const { data, error } = await window.supabaseAuth
                .from("connectors")
                .select("connected_id")
                .in("connected_id", limitedIds)
                .eq("connection_type", "creator");
            
            if (error) {
                console.warn('Error fetching connector counts:', error.message);
                return {};
            }
            
            const counts = {};
            data?.forEach(row => counts[row.connected_id] = (counts[row.connected_id] || 0) + 1);
            return counts;
        } catch (err) {
            console.warn('Error fetching connector counts:', err);
            return {};
        }
    }
    
    /**
     * Render content cards with split badge layout
     */
    function renderCards(contents) {
        if (!contents || !container) return;
        
        const fragment = document.createDocumentFragment();
        
        contents.forEach((content, index) => {
            if (!content) return;
            
            const thumbnailUrl = fixMediaUrl(content.thumbnail_url) || 
                'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
            
            const creatorProfile = content.user_profiles;
            const displayName = creatorProfile?.full_name || creatorProfile?.username || 'User';
            const username = creatorProfile?.username || 'creator';
            const initials = getInitials(displayName);
            const isNew = content.created_at ? (new Date() - new Date(content.created_at)) < 7 * 24 * 60 * 60 * 1000 : false;
            const durationFormatted = formatDuration(content.duration || 0);
            
            // Determine recommendation score class
            let scoreClass = 'low';
            let scoreValue = Math.round((content.amplification_score || 100) / 100);
            if (scoreValue > 100) scoreClass = 'high';
            else if (scoreValue > 50) scoreClass = 'medium';
            
            // Format badge
            let formatBadgeHtml = '';
            if (content.content_format) {
                const formatIcons = {
                    'film': '🎬', 'documentary': '📽️', 'movie': '🎥',
                    'podcast': '🎙️', 'audio': '🎧', 'long_form': '📺',
                    'video': '📹', 'series_episode': '📺'
                };
                const icon = formatIcons[content.content_format] || '📹';
                const formatLabel = content.content_format.replace('_', ' ').toUpperCase();
                formatBadgeHtml = `<div class="card-badge format-badge">${icon} ${formatLabel}</div>`;
            }
            
            // New badge
            const newBadgeHtml = isNew ? `<div class="card-badge new-badge"><i class="fas fa-gem"></i> NEW</div>` : '';
            
            // Genre badge (bottom-left)
            const genreBadgeHtml = content.genre ? 
                `<div class="card-badge genre-badge"><i class="fas fa-tag"></i> ${escapeHtml(content.genre)}</div>` : '';
            
            const boostReason = content.boost_reason || 'Personalized for you';
            const scoreLabel = scoreValue > 0 ? scoreValue : 'Pick';
            
            // Avatar HTML
            let avatarHtml = '';
            if (creatorProfile?.avatar_url) {
                const avatarUrl = fixAvatarUrl(creatorProfile.avatar_url);
                avatarHtml = `
                    <div style="position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;">
                        <img src="${avatarUrl}" 
                             alt="${escapeHtml(displayName)}" 
                             loading="lazy"
                             style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                             onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\'width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;\'>${initials}</div>';">
                    </div>
                `;
            } else {
                avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,var(--bantu-blue),var(--warm-gold));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initials}</div>`;
            }
            
            const card = document.createElement('a');
            card.className = 'content-card';
            card.href = `content-detail.html?id=${content.id}`;
            card.dataset.contentId = content.id;
            card.dataset.language = content.language || 'en';
            card.dataset.category = content.genre || '';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            card.innerHTML = `
                <div class="card-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${escapeHtml(content.title)}" 
                         loading="lazy"
                         onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';">
                    
                    <!-- TOP-LEFT BADGES: Format and New badges -->
                    <div class="for-you-badges-top">
                        ${formatBadgeHtml}
                        ${newBadgeHtml}
                    </div>
                    
                    <!-- BOTTOM-LEFT BADGES: Genre badge -->
                    <div class="for-you-badges-bottom">
                        ${genreBadgeHtml}
                    </div>
                    
                    <!-- TOP-RIGHT: Recommendation score -->
                    <div class="recommendation-score ${scoreClass}" title="${escapeHtml(boostReason)}">
                        <i class="fas fa-magic"></i> ${scoreLabel}
                    </div>
                    
                    <!-- BOTTOM-RIGHT: Duration badge -->
                    ${content.duration > 0 ? `<div class="duration-badge">${durationFormatted}</div>` : ''}
                    
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay"><div class="play-icon"><i class="fas fa-play"></i></div></div>
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${escapeHtml(content.title)}">${truncateText(escapeHtml(content.title), 50)}</h3>
                    <div class="creator-info">
                        <div class="creator-avatar-small" style="width:28px;height:28px;border-radius:50%;overflow:hidden;">${avatarHtml}</div>
                        <div class="creator-name-small">@${escapeHtml(username)}</div>
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-eye"></i> ${formatNumber(content.metrics?.views || 0)}</span>
                        <span><i class="fas fa-thumbs-up"></i> ${formatNumber(content.metrics?.likes || 0)}</span>
                        <span><i class="fas fa-comment"></i> ${formatNumber(content.metrics?.comments || 0)}</span>
                        <span><i class="fas fa-share-alt"></i> ${formatNumber(content.metrics?.shares || 0)}</span>
                        <span><i class="fas fa-language"></i> ${getLanguageName(content.language)}</span>
                    </div>
                    <div class="connector-info">
                        <i class="fas fa-user-friends"></i> ${formatNumber(content.metrics?.connectors || 0)} Connectors
                    </div>
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
    }
    
    /**
     * Get language name from code
     */
    function getLanguageName(code) {
        const languageMap = {
            'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'af': 'Afrikaans',
            'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
            've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
        };
        return languageMap[code] || code || 'English';
    }
    
    /**
     * Animate cards with stagger effect
     */
    function animateCards() {
        if (!container) return;
        
        const cards = document.querySelectorAll('#for-you-grid .content-card');
        if (!cards.length) return;
        
        cards.forEach((card, i) => {
            setTimeout(() => {
                if (card && card.style) {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    card.classList.add('visible');
                    
                    if (i === 0) {
                        card.classList.add('recommended');
                        setTimeout(() => {
                            if (card) card.classList.remove('recommended');
                        }, 1500);
                    }
                }
            }, i * 50);
        });
    }
    
    /**
     * Show skeleton loading state
     */
    function showSkeletons() {
        if (!container) return;
        container.innerHTML = Array(4).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
    }
    
    /**
     * Show empty state with personalization CTA
     */
    function showEmptyState() {
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon"><i class="fas fa-magic"></i></div>
                <h3>No Recommendations Yet</h3>
                <p>Start watching and liking content to get personalized picks just for you!</p>
                <div class="action-buttons">
                    <button class="cta-btn" id="explore-trending-btn-foryou">
                        <i class="fas fa-fire"></i> Explore Trending
                    </button>
                    <button class="cta-btn" id="discover-creators-btn-foryou">
                        <i class="fas fa-user-plus"></i> Discover Creators
                    </button>
                </div>
            </div>
        `;
        
        const exploreBtn = document.getElementById('explore-trending-btn-foryou');
        const discoverBtn = document.getElementById('discover-creators-btn-foryou');
        
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/trending_screen';
            });
        }
        
        if (discoverBtn) {
            discoverBtn.addEventListener('click', () => {
                window.location.href = 'https://bantustreamconnect.com/discover-creator';
            });
        }
    }
    
    /**
     * Setup see all button
     */
    function setupSeeAllButton() {
        const seeAllBtn = document.getElementById('see-all-for-you');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://bantustreamconnect.com/for-you';
            });
        }
    }
    
    /**
     * Add personalization tooltip to section title
     */
    function addPersonalizationTooltip() {
        const sectionTitle = document.querySelector('#for-you-section .section-title');
        if (!sectionTitle) return;
        
        if (sectionTitle.querySelector('.personalization-tooltip')) return;
        
        const tooltipSpan = document.createElement('span');
        tooltipSpan.className = 'personalization-tooltip';
        tooltipSpan.innerHTML = `
            <i class="fas fa-info-circle" style="font-size: 14px; color: var(--slate-grey);"></i>
            <span class="tooltip-text">
                Based on your interests and watch history. 
                ${userPreferences?.hasPreferences ? 
                    `We found ${userPreferences.genres?.length || 0} genres you enjoy.` : 
                    'Watch and like content to get better recommendations!'}
            </span>
        `;
        
        sectionTitle.appendChild(tooltipSpan);
    }
    
    /**
     * Refresh content in background
     */
    async function refreshInBackground() {
        if (isLoading) return;
        
        try {
            await loadUserPreferences();
            const cachedData = loadFromCache();
            if (cachedData && cachedData.length > 0) {
                // Just refresh preferences, not full content
                addPersonalizationTooltip();
            } else {
                await loadContent();
            }
        } catch (err) {
            console.log('Background refresh failed:', err);
        }
    }
    
    /**
     * Start background refresh interval
     */
    function startBackgroundRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            refreshInBackground();
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Load from cache
     */
    function loadFromCache() {
        try {
            if (window.cacheManager && typeof window.cacheManager.get === 'function') {
                return window.cacheManager.get(CACHE_KEY);
            }
            
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < CACHE_TTL) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to load from cache:', e);
        }
        return null;
    }
    
    /**
     * Save to cache
     */
    function saveToCache(data) {
        try {
            if (window.cacheManager && typeof window.cacheManager.set === 'function') {
                window.cacheManager.set(CACHE_KEY, data, CACHE_TTL);
            }
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save to cache:', e);
        }
    }
    
    /**
     * Fix media URL
     */
    function fixMediaUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.fixMediaUrl) return window.fixMediaUrl(url);
        return url;
    }
    
    /**
     * Fix avatar URL
     */
    function fixAvatarUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.fixAvatarUrl) return window.fixAvatarUrl(url);
        return url;
    }
    
    /**
     * Format duration
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    
    /**
     * Format number
     */
    function formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    /**
     * Get initials
     */
    function getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Truncate text
     */
    function truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * Refresh module
     */
    async function refresh() {
        isLoading = false;
        await getCurrentUser();
        await loadUserPreferences();
        await loadContent();
    }
    
    /**
     * Destroy module
     */
    function destroy() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (container) {
            container.innerHTML = '';
        }
        console.log('🎯 For You Module destroyed');
    }
    
    // Public API
    return {
        init,
        refresh,
        destroy
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => ForYou.init(), 100);
    });
} else {
    setTimeout(() => ForYou.init(), 100);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ForYou;
}
