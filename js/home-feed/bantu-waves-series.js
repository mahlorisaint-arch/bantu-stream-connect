/* ============================================ */
/* BANTU WAVES: SERIES SECTION
   Home Feed Component - TV Series & Web Series
   Displays series playlists from creator_playlists
   Filtered by playlist_type = 'series'
   Ordered by release date (latest first)
   FIXED: Uses window.supabaseAuth instead of window.supabaseClient
/* ============================================ */

console.log('📺 Bantu Waves: Series section loading...');

const BantuWavesSeries = {
    config: {
        sectionId: 'bantu-waves-series',
        containerId: 'bantu-waves-series-grid',
        playlistType: 'series',
        maxItems: 8,
        cacheKey: 'bantu_waves_series',
        cacheTTL: 10 * 60 * 1000,
        maxEpisodesPerSeries: 4
    },

    state: {
        initialized: false,
        isLoading: false,
        series: [],
        hasMore: true,
        currentPage: 0
    },

    elements: {
        section: null,
        container: null,
        seeAllBtn: null,
        loadingIndicator: null
    },

    init() {
        if (this.state.initialized) return;

        this.cacheElements();
        
        if (!this.elements.section) {
            console.warn('📺 Series section element not found');
            return;
        }

        this.setupEventListeners();
        this.loadSeries();
        
        this.state.initialized = true;
        console.log('📺 Series section initialized');
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
                window.location.href = 'series-hub.html';
            });
        }

        document.addEventListener('themeChanged', () => {
            if (this.state.series.length > 0) {
                this.render(this.state.series);
            }
        });
    },

    async loadSeries(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('📦 Series: Using cached data', cachedData.length, 'items');
                this.state.series = cachedData;
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            const seriesList = await this.fetchSeriesPlaylists();
            const enrichedSeries = await this.enrichSeriesWithEpisodes(seriesList);
            
            this.state.series = enrichedSeries;
            this.cacheData(enrichedSeries);
            this.render(enrichedSeries);
            
            console.log('✅ Series loaded:', enrichedSeries.length);
            
        } catch (error) {
            console.error('❌ Error loading series:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchSeriesPlaylists() {
        // FIXED: Use window.supabaseAuth instead of window.supabaseClient
        if (!window.supabaseAuth) {
            console.error('Supabase Auth client not available');
            return [];
        }

        try {
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
                .eq('playlist_type', this.config.playlistType)
                .eq('visibility', 'public')
                .order('created_at', { ascending: false })
                .limit(this.config.maxItems);

            if (error) {
                console.error('Error fetching series:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Exception in fetchSeriesPlaylists:', err);
            return [];
        }
    },

    async enrichSeriesWithEpisodes(seriesList) {
        if (!seriesList.length) return [];

        const seriesIds = seriesList.map(s => s.id);
        
        // Fetch episodes for each series
        const episodesPromises = seriesIds.map(id => this.fetchSeriesEpisodes(id));
        const episodesResults = await Promise.allSettled(episodesPromises);
        
        const episodesMap = {};
        episodesResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                episodesMap[seriesIds[index]] = result.value;
            } else {
                episodesMap[seriesIds[index]] = [];
            }
        });

        // Fetch engagement metrics for all episodes
        const allEpisodeIds = [];
        Object.values(episodesMap).forEach(episodes => {
            episodes.forEach(ep => {
                if (ep.content_id) allEpisodeIds.push(ep.content_id);
            });
        });
        
        const engagementMetrics = await this.fetchEpisodeMetrics(allEpisodeIds);

        // Enrich each series
        return seriesList.map(series => {
            const episodes = episodesMap[series.id] || [];
            const latestEpisode = episodes[0];
            const nextEpisode = episodes.find(ep => ep.status === 'pending') || null;
            
            // Calculate total views
            let totalViews = 0;
            episodes.forEach(ep => {
                const metrics = engagementMetrics[ep.content_id] || {};
                totalViews += metrics.total_views || 0;
            });
            
            // Parse series metadata
            const metadata = series.series_metadata || {};
            const totalSeasons = metadata.total_seasons || 1;
            const totalEpisodes = metadata.total_episodes || episodes.length;
            const releaseYear = metadata.release_year || (series.created_at ? new Date(series.created_at).getFullYear() : new Date().getFullYear());
            
            return {
                ...series,
                episodes: episodes.slice(0, this.config.maxEpisodesPerSeries),
                episode_count: episodes.length,
                total_seasons: totalSeasons,
                total_episodes: totalEpisodes,
                release_year: releaseYear,
                latest_episode: latestEpisode,
                next_episode: nextEpisode,
                total_views: totalViews,
                completion_rate: metadata.completion_rate || 0,
                thumbnail_url: this.getBestThumbnail(series, episodes)
            };
        });
    },

    async fetchSeriesEpisodes(seriesId) {
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
                    season_number,
                    track_number as episode_number,
                    display_title_override,
                    created_at,
                    Content:content_id (
                        id,
                        title,
                        description,
                        thumbnail_url,
                        duration,
                        created_at,
                        file_url,
                        status,
                        user_profiles:user_id (
                            id,
                            full_name,
                            username,
                            avatar_url
                        )
                    )
                `)
                .eq('playlist_id', seriesId)
                .order('season_number', { ascending: true })
                .order('sort_index', { ascending: true })
                .limit(this.config.maxEpisodesPerSeries + 2);

            if (error) {
                console.error(`Error fetching episodes for series ${seriesId}:`, error);
                return [];
            }

            return (data || [])
                .filter(item => item.Content)
                .map(item => ({
                    id: item.id,
                    content_id: item.content_id,
                    season: item.season_number || 1,
                    episode: item.episode_number || item.sort_index + 1,
                    title: item.display_title_override || item.Content?.title || `Episode ${item.episode_number || item.sort_index + 1}`,
                    description: item.Content?.description,
                    thumbnail_url: item.Content?.thumbnail_url,
                    duration: item.Content?.duration,
                    created_at: item.Content?.created_at,
                    status: item.Content?.status,
                    creator: item.Content?.user_profiles
                }));
        } catch (err) {
            console.error(`Exception fetching episodes for series ${seriesId}:`, err);
            return [];
        }
    },

    async fetchEpisodeMetrics(contentIds) {
        if (!contentIds.length) return {};
        
        const uniqueIds = [...new Set(contentIds)];
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) return {};
        
        try {
            const { data, error } = await window.supabaseAuth
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments')
                .in('content_id', uniqueIds);
            
            if (error) {
                // Table might not exist or column missing - just return empty
                console.warn('Error fetching episode metrics (may not be available):', error.message);
                return {};
            }
            
            const metricsMap = {};
            (data || []).forEach(stat => {
                metricsMap[stat.content_id] = stat;
            });
            return metricsMap;
            
        } catch (error) {
            console.error('Error fetching episode metrics:', error);
            return {};
        }
    },

    getBestThumbnail(series, episodes) {
        if (series.custom_thumbnail_url) {
            return this.fixImageUrl(series.custom_thumbnail_url);
        }
        if (series.banner_url) {
            return this.fixImageUrl(series.banner_url);
        }
        if (episodes.length > 0 && episodes[0].thumbnail_url) {
            return this.fixImageUrl(episodes[0].thumbnail_url);
        }
        return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=225&fit=crop';
    },

    render(series) {
        if (!this.elements.container) return;
        
        if (!series.length) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        series.forEach((show, index) => {
            const card = this.createSeriesCard(show);
            fragment.appendChild(card);
            
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

    createSeriesCard(series) {
        const card = document.createElement('div');
        card.className = 'series-card';
        card.dataset.seriesId = series.id;
        
        const thumbnailUrl = series.thumbnail_url;
        const creator = series.user_profiles || {};
        const creatorName = creator.full_name || creator.username || 'Creator';
        const creatorInitial = creatorName.charAt(0).toUpperCase();
        
        const episodeCount = series.episode_count || 0;
        const episodeText = episodeCount === 1 ? 'episode' : 'episodes';
        const seasonText = series.total_seasons === 1 ? '1 Season' : `${series.total_seasons} Seasons`;
        
        // Format total views
        const totalViews = this.formatNumber(series.total_views || series.play_count || 0);
        
        // Get next episode info
        const nextEpisode = series.next_episode;
        const nextEpisodeText = nextEpisode ? `Next: S${nextEpisode.season}E${nextEpisode.episode}` : '';
        
        // Calculate progress percentage
        const progressPercent = series.episode_count > 0 && series.total_episodes > 0 
            ? Math.round((series.episode_count / series.total_episodes) * 100)
            : 0;
        
        card.innerHTML = `
            <div class="series-card-inner">
                <div class="series-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(series.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=225&fit=crop'">
                    <div class="series-overlay">
                        <button class="watch-latest-btn" data-series-id="${series.id}" data-episode-id="${series.latest_episode?.content_id || ''}">
                            <i class="fas fa-play"></i> Watch Latest
                        </button>
                    </div>
                    ${series.is_featured ? '<div class="featured-badge"><i class="fas fa-crown"></i> Featured</div>' : ''}
                    <div class="episode-progress-bar" style="width: ${progressPercent}%"></div>
                </div>
                <div class="series-info">
                    <h3 class="series-title" title="${this.escapeHtml(series.name)}">${this.truncateText(this.escapeHtml(series.name), 40)}</h3>
                    <div class="series-creator">
                        <div class="creator-avatar-small">
                            ${creator.avatar_url ? 
                                `<img src="${this.fixImageUrl(creator.avatar_url)}" alt="${creatorName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${creatorInitial}</span>';">` :
                                `<span>${creatorInitial}</span>`
                            }
                        </div>
                        <span class="creator-name">${this.escapeHtml(creatorName)}</span>
                    </div>
                    <div class="series-meta">
                        <span><i class="fas fa-calendar"></i> ${series.release_year}</span>
                        <span><i class="fas fa-tv"></i> ${seasonText}</span>
                        <span><i class="fas fa-list"></i> ${episodeCount} ${episodeText}</span>
                        <span><i class="fas fa-eye"></i> ${totalViews}</span>
                    </div>
                    ${nextEpisodeText ? `
                        <div class="next-episode">
                            <i class="fas fa-clock"></i>
                            <span>${nextEpisodeText}</span>
                        </div>
                    ` : ''}
                    ${series.description ? `
                        <p class="series-description">${this.truncateText(this.escapeHtml(series.description), 100)}</p>
                    ` : ''}
                    <div class="series-actions">
                        <button class="action-btn watchlist-btn" data-series-id="${series.id}" title="Add to Watchlist">
                            <i class="far fa-bookmark"></i> Watchlist
                        </button>
                        <button class="action-btn notify-btn" data-series-id="${series.id}" title="Get Notifications">
                            <i class="far fa-bell"></i> Notify
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const watchBtn = card.querySelector('.watch-latest-btn');
        if (watchBtn) {
            watchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const episodeId = watchBtn.dataset.episodeId;
                if (episodeId) {
                    this.watchEpisode(episodeId, series.latest_episode);
                } else {
                    this.viewSeries(series.id);
                }
            });
        }
        
        const watchlistBtn = card.querySelector('.watchlist-btn');
        if (watchlistBtn) {
            watchlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleWatchlist(series.id);
            });
        }
        
        const notifyBtn = card.querySelector('.notify-btn');
        if (notifyBtn) {
            notifyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotifications(series.id);
            });
        }
        
        card.addEventListener('click', () => {
            this.viewSeries(series.id);
        });
        
        return card;
    },

    async watchEpisode(episodeId, episode) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to watch episodes', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        if (episodeId) {
            window.location.href = `content-detail.html?id=${episodeId}`;
        } else {
            this.showToast('Episode not available', 'error');
        }
    },

    async toggleWatchlist(seriesId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to add to watchlist', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) {
            this.showToast('Service unavailable', 'error');
            return;
        }
        
        try {
            // Check if already in watchlist
            const { data: existing, error: fetchError } = await window.supabaseAuth
                .from('watchlist')
                .select('id')
                .eq('user_id', user.id)
                .eq('playlist_id', seriesId)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking watchlist:', fetchError);
                this.showToast('Error checking watchlist', 'error');
                return;
            }
            
            if (existing) {
                // Remove from watchlist
                const { error: deleteError } = await window.supabaseAuth
                    .from('watchlist')
                    .delete()
                    .eq('id', existing.id);
                    
                if (deleteError) throw deleteError;
                this.showToast('Removed from watchlist', 'info');
            } else {
                // Add to watchlist
                const { error: insertError } = await window.supabaseAuth
                    .from('watchlist')
                    .insert({
                        user_id: user.id,
                        playlist_id: seriesId,
                        added_at: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
                this.showToast('Added to watchlist!', 'success');
            }
        } catch (error) {
            console.error('Error toggling watchlist:', error);
            this.showToast('Error updating watchlist', 'error');
        }
    },

    async toggleNotifications(seriesId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to enable notifications', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) {
            this.showToast('Service unavailable', 'error');
            return;
        }
        
        try {
            // Check if already subscribed to notifications
            const { data: existing, error: fetchError } = await window.supabaseAuth
                .from('series_notifications')
                .select('id')
                .eq('user_id', user.id)
                .eq('playlist_id', seriesId)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking notifications:', fetchError);
                this.showToast('Error checking notifications', 'error');
                return;
            }
            
            if (existing) {
                // Disable notifications
                const { error: deleteError } = await window.supabaseAuth
                    .from('series_notifications')
                    .delete()
                    .eq('id', existing.id);
                    
                if (deleteError) throw deleteError;
                this.showToast('Notifications disabled', 'info');
            } else {
                // Enable notifications
                const { error: insertError } = await window.supabaseAuth
                    .from('series_notifications')
                    .insert({
                        user_id: user.id,
                        playlist_id: seriesId,
                        created_at: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
                this.showToast('Notifications enabled!', 'success');
            }
        } catch (error) {
            console.error('Error toggling notifications:', error);
            this.showToast('Error updating notifications', 'error');
        }
    },

    viewSeries(seriesId) {
        window.location.href = `series-detail.html?id=${seriesId}`;
    },

    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-series">
                    <i class="fas fa-tv"></i>
                    <h3>No Series Available</h3>
                    <p>Check back soon for new series from African creators</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        const skeletons = Array(4).fill().map(() => `
            <div class="skeleton-series-card">
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
                <div class="error-state-series">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Series</h3>
                    <p>Please check your connection and try again</p>
                    <button class="retry-btn" onclick="BantuWavesSeries.loadSeries(true)">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    },

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

// Auto-initialize with proper delay for supabaseAuth
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.supabaseAuth) {
                BantuWavesSeries.init();
            } else {
                console.log('📺 Series waiting for supabaseAuth...');
                const authCheck = setInterval(() => {
                    if (window.supabaseAuth) {
                        clearInterval(authCheck);
                        BantuWavesSeries.init();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(authCheck);
                    if (!BantuWavesSeries.state.initialized) {
                        console.warn('📺 Series: supabaseAuth not available, initializing anyway');
                        BantuWavesSeries.init();
                    }
                }, 5000);
            }
        }, 100);
    });
} else {
    setTimeout(() => {
        if (window.supabaseAuth) {
            BantuWavesSeries.init();
        } else {
            console.log('📺 Series waiting for supabaseAuth...');
            const authCheck = setInterval(() => {
                if (window.supabaseAuth) {
                    clearInterval(authCheck);
                    BantuWavesSeries.init();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(authCheck);
                if (!BantuWavesSeries.state.initialized) {
                    console.warn('📺 Series: supabaseAuth not available, initializing anyway');
                    BantuWavesSeries.init();
                }
            }, 5000);
        }
    }, 100);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuWavesSeries;
}
