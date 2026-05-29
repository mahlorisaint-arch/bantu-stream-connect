/* ============================================ */
/* BANTU WAVES: PODCASTS SECTION
   Home Feed Component - Podcast Playlists & Episodes
   Displays podcast playlists from creator_playlists
   Filtered by playlist_type = 'podcast'
   Ordered by latest episode drops
   FIXED: Uses window.supabaseAuth instead of window.supabaseClient
/* ============================================ */

console.log('🎙️ Bantu Waves: Podcasts section loading...');

const BantuWavesPodcasts = {
    config: {
        sectionId: 'bantu-waves-podcasts',
        containerId: 'bantu-waves-podcasts-grid',
        playlistType: 'podcast',
        maxItems: 8,
        cacheKey: 'bantu_waves_podcasts',
        cacheTTL: 10 * 60 * 1000,
        maxEpisodesPerPodcast: 3
    },

    state: {
        initialized: false,
        isLoading: false,
        podcasts: [],
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
            console.warn('🎙️ Podcasts section element not found');
            return;
        }

        this.setupEventListeners();
        this.loadPodcasts();
        
        this.state.initialized = true;
        console.log('🎙️ Podcasts section initialized');
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
                window.location.href = 'podcasts-hub.html';
            });
        }

        document.addEventListener('themeChanged', () => {
            if (this.state.podcasts.length > 0) {
                this.render(this.state.podcasts);
            }
        });
    },

    async loadPodcasts(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('📦 Podcasts: Using cached data', cachedData.length, 'items');
                this.state.podcasts = cachedData;
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            const podcasts = await this.fetchPodcastPlaylists();
            const enrichedPodcasts = await this.enrichPodcastsWithEpisodes(podcasts);
            
            this.state.podcasts = enrichedPodcasts;
            this.cacheData(enrichedPodcasts);
            this.render(enrichedPodcasts);
            
            console.log('✅ Podcasts loaded:', enrichedPodcasts.length);
            
        } catch (error) {
            console.error('❌ Error loading podcasts:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchPodcastPlaylists() {
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
                    play_count,
                    created_at,
                    updated_at,
                    connectors_count,
                    user_profiles:creator_id (
                        id,
                        full_name,
                        username,
                        avatar_url
                    )
                `)
                .eq('playlist_type', this.config.playlistType)
                .eq('visibility', 'public')
                .order('updated_at', { ascending: false })
                .limit(this.config.maxItems);

            if (error) {
                console.error('Error fetching podcasts:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Exception in fetchPodcastPlaylists:', err);
            return [];
        }
    },

    async enrichPodcastsWithEpisodes(podcasts) {
        if (!podcasts.length) return [];

        const podcastIds = podcasts.map(p => p.id);
        
        // Fetch episodes for each podcast
        const episodesPromises = podcastIds.map(id => this.fetchPodcastEpisodes(id));
        const episodesResults = await Promise.allSettled(episodesPromises);
        
        const episodesMap = {};
        episodesResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                episodesMap[podcastIds[index]] = result.value;
            } else {
                episodesMap[podcastIds[index]] = [];
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

        // Enrich each podcast
        return podcasts.map(podcast => {
            const episodes = episodesMap[podcast.id] || [];
            const latestEpisode = episodes[0];
            
            // Calculate total plays from episodes
            let totalPlays = 0;
            episodes.forEach(ep => {
                const metrics = engagementMetrics[ep.content_id] || {};
                totalPlays += metrics.total_views || 0;
            });
            
            return {
                ...podcast,
                episodes: episodes.slice(0, this.config.maxEpisodesPerPodcast),
                episode_count: episodes.length,
                latest_episode: latestEpisode,
                total_plays: totalPlays,
                thumbnail_url: this.getBestThumbnail(podcast, episodes)
            };
        });
    },

    async fetchPodcastEpisodes(podcastId) {
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
                        user_profiles:user_id (
                            id,
                            full_name,
                            username,
                            avatar_url
                        )
                    )
                `)
                .eq('playlist_id', podcastId)
                .order('sort_index', { ascending: false })
                .limit(this.config.maxEpisodesPerPodcast + 2);

            if (error) {
                console.error(`Error fetching episodes for podcast ${podcastId}:`, error);
                return [];
            }

            return (data || [])
                .filter(item => item.Content)
                .map(item => ({
                    id: item.id,
                    content_id: item.content_id,
                    title: item.display_title_override || item.Content?.title || 'Episode',
                    description: item.Content?.description,
                    thumbnail_url: item.Content?.thumbnail_url,
                    duration: item.Content?.duration,
                    created_at: item.Content?.created_at,
                    audio_url: item.Content?.file_url,
                    creator: item.Content?.user_profiles
                }));
        } catch (err) {
            console.error(`Exception fetching episodes for podcast ${podcastId}:`, err);
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

    getBestThumbnail(podcast, episodes) {
        if (podcast.custom_thumbnail_url) {
            return this.fixImageUrl(podcast.custom_thumbnail_url);
        }
        if (podcast.banner_url) {
            return this.fixImageUrl(podcast.banner_url);
        }
        if (episodes.length > 0 && episodes[0].thumbnail_url) {
            return this.fixImageUrl(episodes[0].thumbnail_url);
        }
        return 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&h=225&fit=crop';
    },

    render(podcasts) {
        if (!this.elements.container) return;
        
        if (!podcasts.length) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        podcasts.forEach((podcast, index) => {
            const card = this.createPodcastCard(podcast);
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

    createPodcastCard(podcast) {
        const card = document.createElement('div');
        card.className = 'podcast-card';
        card.dataset.podcastId = podcast.id;
        
        const thumbnailUrl = podcast.thumbnail_url;
        const creator = podcast.user_profiles || {};
        const creatorName = creator.full_name || creator.username || 'Podcaster';
        const creatorInitial = creatorName.charAt(0).toUpperCase();
        const episodeCount = podcast.episode_count || 0;
        const episodeText = episodeCount === 1 ? 'episode' : 'episodes';
        
        // Get latest episode info
        const latestEpisode = podcast.latest_episode;
        const latestEpisodeTitle = latestEpisode ? this.truncateText(latestEpisode.title, 35) : '';
        const latestEpisodeDate = latestEpisode ? this.formatTimeAgo(latestEpisode.created_at) : '';
        
        // Format total plays
        const totalPlays = this.formatNumber(podcast.total_plays || podcast.play_count || 0);
        
        card.innerHTML = `
            <div class="podcast-card-inner">
                <div class="podcast-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(podcast.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&h=225&fit=crop'">
                    <div class="podcast-overlay">
                        <button class="play-latest-btn" data-podcast-id="${podcast.id}" data-episode-id="${latestEpisode?.content_id || ''}">
                            <i class="fas fa-play"></i> Latest Episode
                        </button>
                    </div>
                    ${podcast.is_featured ? '<div class="featured-badge"><i class="fas fa-crown"></i> Featured</div>' : ''}
                </div>
                <div class="podcast-info">
                    <h3 class="podcast-title" title="${this.escapeHtml(podcast.name)}">${this.truncateText(this.escapeHtml(podcast.name), 40)}</h3>
                    <div class="podcast-creator">
                        <div class="creator-avatar-small">
                            ${creator.avatar_url ? 
                                `<img src="${this.fixImageUrl(creator.avatar_url)}" alt="${creatorName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${creatorInitial}</span>';">` :
                                `<span>${creatorInitial}</span>`
                            }
                        </div>
                        <span class="creator-name">${this.escapeHtml(creatorName)}</span>
                    </div>
                    <div class="podcast-meta">
                        <span><i class="fas fa-microphone-alt"></i> ${episodeCount} ${episodeText}</span>
                        <span><i class="fas fa-headphones"></i> ${totalPlays}</span>
                    </div>
                    ${latestEpisode ? `
                        <div class="latest-episode">
                            <span class="latest-label">Latest:</span>
                            <span class="episode-title" title="${this.escapeHtml(latestEpisode.title)}">${latestEpisodeTitle}</span>
                            <span class="episode-date">${latestEpisodeDate}</span>
                        </div>
                    ` : ''}
                    ${podcast.description ? `
                        <p class="podcast-description">${this.truncateText(this.escapeHtml(podcast.description), 80)}</p>
                    ` : ''}
                    <div class="podcast-actions">
                        <button class="action-btn subscribe-btn" data-podcast-id="${podcast.id}" title="Subscribe">
                            <i class="far fa-bell"></i> Subscribe
                        </button>
                        <button class="action-btn share-btn" data-podcast-id="${podcast.id}" title="Share">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const playBtn = card.querySelector('.play-latest-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const episodeId = playBtn.dataset.episodeId;
                if (episodeId) {
                    this.playEpisode(episodeId, latestEpisode);
                } else {
                    this.viewPodcast(podcast.id);
                }
            });
        }
        
        const subscribeBtn = card.querySelector('.subscribe-btn');
        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSubscribe(podcast.id);
            });
        }
        
        const shareBtn = card.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sharePodcast(podcast.id, podcast.name);
            });
        }
        
        card.addEventListener('click', () => {
            this.viewPodcast(podcast.id);
        });
        
        return card;
    },

    async playEpisode(episodeId, episode) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to play episodes', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        if (episode?.audio_url && window.playSmartLink) {
            const audioUrl = this.fixImageUrl(episode.audio_url);
            window.playSmartLink(audioUrl, episode.title, episode.creator?.full_name || 'Podcast');
            this.showToast(`Now playing: ${episode.title}`, 'success');
        } else if (episodeId) {
            window.location.href = `content-detail.html?id=${episodeId}`;
        } else {
            this.showToast('Episode not available', 'error');
        }
    },

    async toggleSubscribe(podcastId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to subscribe', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // FIXED: Use window.supabaseAuth
        if (!window.supabaseAuth) {
            this.showToast('Service unavailable', 'error');
            return;
        }
        
        try {
            // Check if already subscribed
            const { data: existing, error: fetchError } = await window.supabaseAuth
                .from('podcast_subscriptions')
                .select('id')
                .eq('user_id', user.id)
                .eq('playlist_id', podcastId)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error checking subscription:', fetchError);
                this.showToast('Error checking subscription', 'error');
                return;
            }
            
            if (existing) {
                // Unsubscribe
                const { error: deleteError } = await window.supabaseAuth
                    .from('podcast_subscriptions')
                    .delete()
                    .eq('id', existing.id);
                    
                if (deleteError) throw deleteError;
                this.showToast('Unsubscribed from podcast', 'info');
            } else {
                // Subscribe
                const { error: insertError } = await window.supabaseAuth
                    .from('podcast_subscriptions')
                    .insert({
                        user_id: user.id,
                        playlist_id: podcastId,
                        subscribed_at: new Date().toISOString()
                    });
                    
                if (insertError) throw insertError;
                this.showToast('Subscribed to podcast!', 'success');
            }
        } catch (error) {
            console.error('Error toggling subscription:', error);
            this.showToast('Error updating subscription', 'error');
        }
    },

    sharePodcast(podcastId, podcastName) {
        const shareUrl = `${window.location.origin}/podcast.html?id=${podcastId}`;
        
        if (navigator.share) {
            navigator.share({
                title: podcastName,
                text: `Check out this podcast on Bantu Stream Connect: ${podcastName}`,
                url: shareUrl
            }).catch(() => this.copyToClipboard(shareUrl));
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

    viewPodcast(podcastId) {
        window.location.href = `podcast-detail.html?id=${podcastId}`;
    },

    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-podcasts">
                    <i class="fas fa-podcast"></i>
                    <h3>No Podcasts Yet</h3>
                    <p>Check back soon for new podcast episodes</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        const skeletons = Array(4).fill().map(() => `
            <div class="skeleton-podcast-card">
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
                <div class="error-state-podcasts">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Podcasts</h3>
                    <p>Please check your connection and try again</p>
                    <button class="retry-btn" onclick="BantuWavesPodcasts.loadPodcasts(true)">
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

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
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
                BantuWavesPodcasts.init();
            } else {
                console.log('🎙️ Podcasts waiting for supabaseAuth...');
                const authCheck = setInterval(() => {
                    if (window.supabaseAuth) {
                        clearInterval(authCheck);
                        BantuWavesPodcasts.init();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(authCheck);
                    if (!BantuWavesPodcasts.state.initialized) {
                        console.warn('🎙️ Podcasts: supabaseAuth not available, initializing anyway');
                        BantuWavesPodcasts.init();
                    }
                }, 5000);
            }
        }, 100);
    });
} else {
    setTimeout(() => {
        if (window.supabaseAuth) {
            BantuWavesPodcasts.init();
        } else {
            console.log('🎙️ Podcasts waiting for supabaseAuth...');
            const authCheck = setInterval(() => {
                if (window.supabaseAuth) {
                    clearInterval(authCheck);
                    BantuWavesPodcasts.init();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(authCheck);
                if (!BantuWavesPodcasts.state.initialized) {
                    console.warn('🎙️ Podcasts: supabaseAuth not available, initializing anyway');
                    BantuWavesPodcasts.init();
                }
            }, 5000);
        }
    }, 100);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuWavesPodcasts;
}
