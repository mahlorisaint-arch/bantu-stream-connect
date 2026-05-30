/* ============================================ */
/* BANTU WAVES: MUSIC SECTION
   Home Feed Component - Music Playlists & Albums
   Displays music playlists and albums from creator_playlists
   Filtered by playlist_type = 'album' or 'playlist'
   Ordered by engagement (play_count, connectors_count)
   
   UPDATED:
   1. Hides playlists with no items/tracks
   2. Shows correct total_views from content_engagement_stats
   3. Redirects to playlist mode in content-detail
/* ============================================ */

console.log('🎵 Bantu Waves: Music section loading...');

// ============================================ */
// MUSIC SECTION CONTROLLER
// ============================================ */

const BantuWavesMusic = {
    // Configuration
    config: {
        sectionId: 'bantu-waves-music',
        containerId: 'bantu-waves-music-grid',
        playlistTypes: ['album', 'playlist'],
        maxItems: 12,
        cacheKey: 'bantu_waves_music',
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        engagementWindowDays: 30 // For trending calculation
    },

    // State
    state: {
        initialized: false,
        isLoading: false,
        musicPlaylists: [],
        hasMore: true,
        currentPage: 0
    },

    // DOM Elements
    elements: {
        section: null,
        container: null,
        seeAllBtn: null,
        loadingIndicator: null
    },

    /* ============================================ */
    /* INITIALIZATION
    /* ============================================ */
    init() {
        if (this.state.initialized) {
            console.log('🎵 Music section already initialized');
            return;
        }

        this.cacheElements();
        
        if (!this.elements.section) {
            console.warn('🎵 Music section element not found');
            return;
        }

        this.setupEventListeners();
        this.loadMusicContent();
        
        this.state.initialized = true;
        console.log('🎵 Music section initialized');
    },

    cacheElements() {
        this.elements.section = document.getElementById(this.config.sectionId);
        this.elements.container = document.getElementById(this.config.containerId);
        this.elements.seeAllBtn = document.querySelector(`#${this.config.sectionId} .see-all-btn`);
        this.elements.loadingIndicator = document.querySelector(`#${this.config.sectionId} .section-loading`);
    },

    setupEventListeners() {
        if (this.elements.seeAllBtn) {
            this.elements.seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToMusicHub();
            });
        }

        // Listen for theme changes to re-render if needed
        document.addEventListener('themeChanged', () => {
            if (this.state.musicPlaylists.length > 0) {
                this.render(this.state.musicPlaylists);
            }
        });
    },

    /* ============================================ */
    /* DATA LOADING - FIXED: Uses supabaseAuth
    /* ============================================ */
    async loadMusicContent(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        // Check cache first
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('📦 Music section: Using cached data', cachedData.length, 'items');
                this.state.musicPlaylists = cachedData;
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            // Fetch music playlists from creator_playlists using supabaseAuth
            const playlists = await this.fetchMusicPlaylists();
            
            // Enrich with content and metrics
            const enrichedPlaylists = await this.enrichPlaylistsWithData(playlists);
            
            // FIX 1: Filter out playlists with no items/tracks
            const playlistsWithContent = enrichedPlaylists.filter(playlist => 
                playlist.contents && playlist.contents.length > 0
            );
            
            console.log(`📊 Music: Filtered out ${enrichedPlaylists.length - playlistsWithContent.length} empty playlists`);
            
            // Sort by engagement score
            const sortedPlaylists = this.sortByEngagement(playlistsWithContent);
            
            // Take top items
            const topPlaylists = sortedPlaylists.slice(0, this.config.maxItems);
            
            this.state.musicPlaylists = topPlaylists;
            this.cacheData(topPlaylists);
            this.render(topPlaylists);
            
            console.log('✅ Music section loaded:', topPlaylists.length, 'playlists with content');
            
        } catch (error) {
            console.error('❌ Error loading music section:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchMusicPlaylists() {
        // FIXED: Use window.supabaseAuth instead of window.supabaseClient
        if (!window.supabaseAuth) {
            console.error('Supabase Auth client not available');
            return [];
        }

        try {
            // Build query for music playlists (albums and playlists)
            const { data, error } = await window.supabaseAuth
                .from('creator_playlists')
                .select(`
                    id,
                    creator_id,
                    name,
                    description,
                    playlist_type,
                    custom_thumbnail_url,
                    banner_url,
                    is_featured,
                    visibility,
                    sort_order,
                    total_duration,
                    play_count,
                    created_at,
                    updated_at,
                    connectors_count,
                    series_metadata,
                    user_profiles:creator_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                `)
                .in('playlist_type', this.config.playlistTypes)
                .eq('visibility', 'public')
                .order('play_count', { ascending: false })
                .limit(this.config.maxItems * 2); // Fetch extra for engagement sorting

            if (error) {
                console.error('Error fetching music playlists:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Exception in fetchMusicPlaylists:', err);
            return [];
        }
    },

    async enrichPlaylistsWithData(playlists) {
        if (!playlists || playlists.length === 0) return [];

        // Get all playlist IDs
        const playlistIds = playlists.map(p => p.id);
        
        // Fetch content for each playlist in parallel
        const playlistContentsPromises = playlistIds.map(playlistId =>
            this.fetchPlaylistContents(playlistId)
        );
        
        const playlistContentsResults = await Promise.allSettled(playlistContentsPromises);
        
        // Build content maps
        const playlistContentMap = {};
        playlistContentsResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
                playlistContentMap[playlistIds[index]] = result.value;
            } else {
                playlistContentMap[playlistIds[index]] = [];
            }
        });

        // Get all content IDs for engagement metrics
        const allContentIds = [];
        Object.values(playlistContentMap).forEach(contents => {
            contents.forEach(c => {
                if (c.content_id) allContentIds.push(c.content_id);
            });
        });

        // FIX 2: Fetch engagement metrics for all content from content_engagement_stats
        const engagementMetrics = await this.fetchEngagementMetrics(allContentIds);

        // Enrich each playlist
        const enrichedPlaylists = playlists.map(playlist => {
            const contents = playlistContentMap[playlist.id] || [];
            
            // FIX 2: Calculate playlist metrics from contents using total_views from content_engagement_stats
            let totalViews = 0;
            let totalLikes = 0;
            let totalEngagement = 0;
            
            contents.forEach(item => {
                const metrics = engagementMetrics[item.content_id] || {};
                // Use total_views from content_engagement_stats
                const itemViews = metrics.total_views || 0;
                const itemLikes = metrics.total_likes || 0;
                
                totalViews += itemViews;
                totalLikes += itemLikes;
                totalEngagement += itemViews + (itemLikes * 2);
            });
            
            // Calculate engagement score
            const engagementScore = this.calculateEngagementScore(playlist, totalEngagement);
            
            return {
                ...playlist,
                contents: contents,
                total_views: totalViews,
                total_likes: totalLikes,
                total_tracks: contents.length,
                engagement_score: engagementScore,
                thumbnail_url: this.getBestThumbnail(playlist, contents)
            };
        });

        return enrichedPlaylists;
    },

    async fetchPlaylistContents(playlistId) {
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return [];

        try {
            const { data, error } = await window.supabaseAuth
                .from('playlist_contents')
                .select(`
                    id,
                    playlist_id,
                    content_id,
                    sort_index,
                    track_number,
                    display_title_override,
                    Content:content_id (
                        id,
                        title,
                        description,
                        thumbnail_url,
                        duration,
                        genre,
                        language,
                        created_at,
                        content_format,
                        user_profiles:user_id (
                            id,
                            full_name,
                            username,
                            avatar_url
                        )
                    )
                `)
                .eq('playlist_id', playlistId)
                .order('sort_index', { ascending: true });

            if (error) {
                console.error(`Error fetching contents for playlist ${playlistId}:`, error);
                return [];
            }

            // Filter out items without content and map to simpler structure
            // Also filter out items where Content is null (orphaned references)
            const validItems = (data || [])
                .filter(item => item && item.Content && item.Content.id)
                .map(item => ({
                    id: item.id,
                    content_id: item.content_id,
                    sort_index: item.sort_index,
                    track_number: item.track_number || item.sort_index + 1,
                    title: item.display_title_override || item.Content?.title || 'Untitled',
                    thumbnail_url: item.Content?.thumbnail_url,
                    duration: item.Content?.duration,
                    genre: item.Content?.genre,
                    content_format: item.Content?.content_format,
                    creator: item.Content?.user_profiles,
                    created_at: item.Content?.created_at
                }));
            
            return validItems;
        } catch (err) {
            console.error(`Exception fetching playlist contents for ${playlistId}:`, err);
            return [];
        }
    },

    async fetchEngagementMetrics(contentIds) {
        if (!contentIds.length) return {};
        
        // Remove duplicates
        const uniqueIds = [...new Set(contentIds)];
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return {};
        
        try {
            const { data, error } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments, total_shares, total_watch_time_ms')
                .in('content_id', uniqueIds);
            
            if (error) {
                // Check if error is because table doesn't exist or missing column
                console.warn('Error fetching engagement metrics (may not be available):', error.message);
                return {};
            }
            
            // Build map
            const metricsMap = {};
            (data || []).forEach(stat => {
                metricsMap[stat.content_id] = {
                    total_views: stat.total_views || 0,
                    total_likes: stat.total_likes || 0,
                    total_comments: stat.total_comments || 0,
                    total_shares: stat.total_shares || 0,
                    total_watch_time_ms: stat.total_watch_time_ms || 0
                };
            });
            
            return metricsMap;
            
        } catch (error) {
            console.error('Failed to fetch engagement metrics:', error);
            return {};
        }
    },

    calculateEngagementScore(playlist, totalContentEngagement) {
        let score = 0;
        
        // Playlist-level metrics
        score += (playlist.play_count || 0) * 1;
        score += (playlist.connectors_count || 0) * 2;
        
        // Content-level metrics (from engagement_stats)
        score += totalContentEngagement;
        
        // Recency boost (newer playlists get slight boost)
        if (playlist.created_at) {
            const daysSinceCreation = (new Date() - new Date(playlist.created_at)) / (1000 * 60 * 60 * 24);
            if (daysSinceCreation < 7) {
                score *= 1.3; // 30% boost for new playlists
            } else if (daysSinceCreation < 30) {
                score *= 1.1; // 10% boost for recent playlists
            }
        }
        
        // Featured boost
        if (playlist.is_featured) {
            score *= 1.5;
        }
        
        return Math.round(score);
    },

    getBestThumbnail(playlist, contents) {
        // Priority: custom_thumbnail_url > banner_url > first content thumbnail > default
        if (playlist.custom_thumbnail_url) {
            return this.fixImageUrl(playlist.custom_thumbnail_url);
        }
        
        if (playlist.banner_url) {
            return this.fixImageUrl(playlist.banner_url);
        }
        
        if (contents.length > 0 && contents[0].thumbnail_url) {
            return this.fixImageUrl(contents[0].thumbnail_url);
        }
        
        // Default music thumbnail
        return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=225&fit=crop';
    },

    sortByEngagement(playlists) {
        return [...playlists].sort((a, b) => {
            // First by is_featured
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            
            // Then by engagement score
            return (b.engagement_score || 0) - (a.engagement_score || 0);
        });
    },

    /* ============================================ */
    /* RENDERING
    /* ============================================ */
    render(playlists) {
        if (!this.elements.container) return;
        
        if (!playlists || playlists.length === 0) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        playlists.forEach((playlist, index) => {
            const card = this.createPlaylistCard(playlist);
            fragment.appendChild(card);
            
            // Staggered animation
            setTimeout(() => {
                if (card) card.classList.add('visible');
            }, index * 50);
        });
        
        this.elements.container.innerHTML = '';
        this.elements.container.appendChild(fragment);
        if (this.elements.section) {
            this.elements.section.classList.add('loaded');
        }
    },

    createPlaylistCard(playlist) {
        const card = document.createElement('div');
        card.className = 'music-playlist-card';
        card.dataset.playlistId = playlist.id;
        card.dataset.playlistType = playlist.playlist_type;
        
        const thumbnailUrl = playlist.thumbnail_url;
        const playlistTypeIcon = playlist.playlist_type === 'album' ? 'fa-record-vinyl' : 'fa-list';
        const playlistTypeLabel = playlist.playlist_type === 'album' ? 'ALBUM' : 'PLAYLIST';
        
        const creator = playlist.user_profiles || {};
        const creatorName = creator.full_name || creator.username || 'Artist';
        const creatorInitial = creatorName.charAt(0).toUpperCase();
        
        const trackCount = playlist.total_tracks || 0;
        const trackText = trackCount === 1 ? 'track' : 'tracks';
        
        // FIX 2: Use total_views from engagement_stats (calculated from all tracks)
        const totalViews = this.formatNumber(playlist.total_views || 0);
        
        // Format duration
        const duration = this.formatDuration(playlist.total_duration || 0);
        
        card.innerHTML = `
            <div class="playlist-card-inner">
                <div class="playlist-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(playlist.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=225&fit=crop'">
                    <div class="playlist-overlay">
                        <button class="play-all-btn" data-playlist-id="${playlist.id}">
                            <i class="fas fa-play"></i> Play All
                        </button>
                    </div>
                    <div class="playlist-type-badge">
                        <i class="fas ${playlistTypeIcon}"></i> ${playlistTypeLabel}
                    </div>
                    ${playlist.is_featured ? '<div class="featured-badge"><i class="fas fa-crown"></i> Featured</div>' : ''}
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-title" title="${this.escapeHtml(playlist.name)}">${this.truncateText(this.escapeHtml(playlist.name), 40)}</h3>
                    <div class="playlist-creator">
                        <div class="creator-avatar-small">
                            ${creator.avatar_url ? 
                                `<img src="${this.fixImageUrl(creator.avatar_url)}" alt="${creatorName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${creatorInitial}</span>';">` :
                                `<span>${creatorInitial}</span>`
                            }
                        </div>
                        <span class="creator-name">${this.escapeHtml(creatorName)}</span>
                    </div>
                    <div class="playlist-meta">
                        <span><i class="fas fa-music"></i> ${trackCount} ${trackText}</span>
                        <span><i class="fas fa-eye"></i> ${totalViews}</span>
                        ${duration ? `<span><i class="fas fa-clock"></i> ${duration}</span>` : ''}
                    </div>
                    ${playlist.description ? `
                        <p class="playlist-description">${this.truncateText(this.escapeHtml(playlist.description), 80)}</p>
                    ` : ''}
                    <div class="playlist-actions">
                        <button class="action-btn save-playlist-btn" data-playlist-id="${playlist.id}" title="Save to Library">
                            <i class="far fa-heart"></i>
                        </button>
                        <button class="action-btn share-playlist-btn" data-playlist-id="${playlist.id}" title="Share">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const playAllBtn = card.querySelector('.play-all-btn');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playPlaylist(playlist.id, playlist.contents);
            });
        }
        
        const saveBtn = card.querySelector('.save-playlist-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.savePlaylist(playlist.id);
            });
        }
        
        const shareBtn = card.querySelector('.share-playlist-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sharePlaylist(playlist.id, playlist.name);
            });
        }
        
        // FIX 3: Make entire card clickable to view playlist - redirect to content-detail with playlist_id
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            this.viewPlaylist(playlist.id, playlist.playlist_type);
        });
        
        return card;
    },

    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-music">
                    <i class="fas fa-music"></i>
                    <h3>No Music Albums Yet</h3>
                    <p>Check back soon for new music from African artists</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        const skeletons = Array(6).fill().map(() => `
            <div class="skeleton-music-card">
                <div class="skeleton-thumbnail"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-creator"></div>
                <div class="skeleton-stats"></div>
            </div>
        `).join('');
        
        this.elements.container.innerHTML = skeletons;
    },

    showLoading() {
        this.renderLoading();
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'flex';
        }
    },

    hideLoading() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }
    },

    showError() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="error-state-music">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Music</h3>
                    <p>Please check your connection and try again</p>
                    <button class="retry-btn" onclick="BantuWavesMusic.loadMusicContent(true)">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    },

    /* ============================================ */
    /* ACTIONS - FIXED: Use supabaseAuth for all operations
    /* ============================================ */
    async playPlaylist(playlistId, contents) {
        if (!contents || contents.length === 0) {
            this.showToast('No tracks in this playlist', 'warning');
            return;
        }
        
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to play music', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // Start playing the first track
        const firstTrack = contents[0];
        if (firstTrack && window.playSmartLink) {
            // Get audio URL - use supabaseAuth
            const audioUrl = await this.getContentAudioUrl(firstTrack.content_id);
            if (audioUrl) {
                window.playSmartLink(audioUrl, firstTrack.title, firstTrack.creator?.full_name || 'Artist');
                this.showToast(`Now playing: ${firstTrack.title}`, 'success');
            } else {
                this.showToast('Unable to play this track', 'error');
            }
        }
    },

    async getContentAudioUrl(contentId) {
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return null;
        
        try {
            const { data, error } = await window.supabaseAuth
                .from('Content')
                .select('file_url')
                .eq('id', contentId)
                .single();
            
            if (error || !data) return null;
            return this.fixImageUrl(data.file_url);
        } catch (error) {
            console.error('Error getting audio URL:', error);
            return null;
        }
    },

    async savePlaylist(playlistId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to save playlists', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) {
            this.showToast('Service unavailable', 'error');
            return;
        }
        
        try {
            // Check if already saved
            const { data: existing, error: fetchError } = await window.supabaseAuth
                .from('saved_playlists')
                .select('id')
                .eq('user_id', user.id)
                .eq('playlist_id', playlistId)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking saved playlist:', fetchError);
                this.showToast('Error accessing saved playlists', 'error');
                return;
            }
            
            if (existing) {
                // Unsave
                const { error: deleteError } = await window.supabaseAuth
                    .from('saved_playlists')
                    .delete()
                    .eq('id', existing.id);
                    
                if (deleteError) throw deleteError;
                this.showToast('Removed from your library', 'info');
            } else {
                // Save
                const { error: insertError } = await window.supabaseAuth
                    .from('saved_playlists')
                    .insert({
                        user_id: user.id,
                        playlist_id: playlistId,
                        saved_at: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
                this.showToast('Added to your library', 'success');
            }
        } catch (error) {
            console.error('Error saving playlist:', error);
            this.showToast('Error saving playlist', 'error');
        }
    },

    sharePlaylist(playlistId, playlistName) {
        // FIX 3: Use content-detail with playlist_id parameter
        const shareUrl = `${window.location.origin}/content-detail?playlist_id=${playlistId}&type=album`;
        
        if (navigator.share) {
            navigator.share({
                title: playlistName,
                text: `Check out this playlist on Bantu Stream Connect: ${playlistName}`,
                url: shareUrl
            }).catch(() => {
                this.copyToClipboard(shareUrl);
            });
        } else {
            this.copyToClipboard(shareUrl);
        }
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Share URL: ' + text, 'info');
        });
    },

    // FIX 3: Redirect to content-detail with playlist_id parameter
    viewPlaylist(playlistId, playlistType) {
        const type = playlistType === 'album' ? 'album' : 'playlist';
        window.location.href = `content-detail?playlist_id=${playlistId}&type=${type}`;
    },

    navigateToMusicHub() {
        window.location.href = 'music-hub.html';
    },

    /* ============================================ */
    /* CACHE MANAGEMENT
    /* ============================================ */
    getCachedData() {
        try {
            const cached = localStorage.getItem(this.config.cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < this.config.cacheTTL) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
        return null;
    },

    cacheData(data) {
        try {
            localStorage.setItem(this.config.cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    },

    /* ============================================ */
    /* UTILITY FUNCTIONS
    /* ============================================ */
    fixImageUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (window.SupabaseHelper?.fixMediaUrl) {
            return window.SupabaseHelper.fixMediaUrl(url);
        }
        return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${url.replace(/^\/+/, '')}`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    formatNumber(num) {
        if (!num && num !== 0) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
            return `${minutes}m`;
        }
        return '< 1m';
    },

    async getCurrentUser() {
        // FIXED: Use AuthHelper if available, or check supabaseAuth session
        if (window.AuthHelper?.isAuthenticated && window.AuthHelper.isAuthenticated()) {
            return window.AuthHelper.getUserProfile();
        }
        
        // Try to get from supabaseAuth session
        if (window.supabaseAuth) {
            try {
                const { data: { user } } = await window.supabaseAuth.auth.getUser();
                if (user) {
                    return {
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.email,
                        username: user.user_metadata?.username
                    };
                }
            } catch (e) {
                console.warn('Error getting user from supabaseAuth:', e);
            }
        }
        
        if (window.getCurrentUser) {
            return await window.getCurrentUser();
        }
        return null;
    },

    showToast(message, type) {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BantuWavesMusic.init());
} else {
    // Small delay to ensure supabaseAuth is ready
    setTimeout(() => {
        if (window.supabaseAuth) {
            BantuWavesMusic.init();
        } else {
            console.log('🎵 Music waiting for supabaseAuth...');
            const authCheck = setInterval(() => {
                if (window.supabaseAuth) {
                    clearInterval(authCheck);
                    BantuWavesMusic.init();
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(authCheck);
                if (!BantuWavesMusic.state.initialized) {
                    console.warn('🎵 Music: supabaseAuth not available, initializing anyway');
                    BantuWavesMusic.init();
                }
            }, 5000);
        }
    }, 100);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuWavesMusic;
}
