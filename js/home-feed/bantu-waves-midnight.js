/* ============================================ */
/* BANTU WAVES: MIDNIGHT SESSIONS
   Home Feed Component - Late-Night Content Curation
   Features low-tempo, chill, atmospheric content for after-hours viewing
   Includes: Lo-Fi Beats, Late-Night Podcasts, Acoustic Sets, Neo-Noir Content
/* ============================================ */

console.log('🌙 Bantu Waves: Midnight Sessions section loading...');

const BantuWavesMidnight = {
    config: {
        sectionId: 'bantu-waves-midnight',
        containerId: 'bantu-waves-midnight-grid',
        maxItems: 10,
        cacheKey: 'bantu_waves_midnight',
        cacheTTL: 15 * 60 * 1000, // 15 minutes
        
        // Midnight mood keywords (for moods array)
        midnightMoods: [
            'Chill', 'Deep', 'Emotional', 'Spiritual', 'Soulful',
            'Relaxing', 'Thought-Provoking', 'Nostalgic', 'Romantic'
        ],
        
        // Low tempo range (BPM 60-90 for chill content)
        tempoRange: { min: 60, max: 90 },
        
        // Midnight session hours (9 PM - 4 AM)
        sessionStartHour: 21, // 9 PM
        sessionEndHour: 4,    // 4 AM
        
        // Content formats suitable for midnight sessions
        midnightFormats: [
            'music', 'music_video', 'song', 'track', 'audio',
            'podcast_episode', 'long_form', 'documentary'
        ],
        
        // Genre preferences for late night
        midnightGenres: [
            'Ambient', 'Lo-Fi', 'Jazz', 'Soul', 'R&B', 'Acoustic',
            'Spoken Word', 'Storytelling', 'Philosophy', 'Meditation'
        ],
        
        // City origins for localized content
        localCities: [
            'Cape Town', 'Durban', 'Johannesburg', 'Pretoria', 
            'Soweto', 'Polokwane', 'Giyani', 'Tzaneen'
        ],
        
        // South African languages
        saLanguages: ['zu', 'xh', 'st', 'tn', 'ss', 've', 'ts', 'nr', 'nso', 'af']
    },

    state: {
        initialized: false,
        isLoading: false,
        content: [],
        isMidnightMode: false,
        currentHour: new Date().getHours(),
        currentPage: 0
    },

    elements: {
        section: null,
        container: null,
        seeAllBtn: null,
        loadingIndicator: null,
        timeBadge: null,
        nowPlayingBtn: null
    },

    /* ============================================ */
    /* INITIALIZATION
    /* ============================================ */
    init() {
        if (this.state.initialized) return;

        this.cacheElements();
        
        if (!this.elements.section) {
            console.warn('Midnight Sessions section element not found');
            return;
        }

        // Check if we should show midnight mode
        this.checkMidnightMode();
        
        this.setupEventListeners();
        this.loadMidnightContent();
        
        // Set up interval to check time every hour
        setInterval(() => this.checkMidnightMode(), 60 * 60 * 1000);
        
        this.state.initialized = true;
        console.log('Midnight Sessions section initialized, midnight mode:', this.state.isMidnightMode);
    },

    cacheElements() {
        this.elements.section = document.getElementById(this.config.sectionId);
        this.elements.container = document.getElementById(this.config.containerId);
        this.elements.seeAllBtn = document.querySelector(`#${this.config.sectionId} .see-all-btn`);
        this.elements.loadingIndicator = document.querySelector(`#${this.config.sectionId} .section-loading`);
        this.elements.timeBadge = document.querySelector(`#${this.config.sectionId} .midnight-time-badge`);
        this.elements.nowPlayingBtn = document.querySelector(`#${this.config.sectionId} .now-playing-btn`);
    },

    setupEventListeners() {
        if (this.elements.seeAllBtn) {
            this.elements.seeAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'midnight-sessions.html';
            });
        }

        if (this.elements.nowPlayingBtn) {
            this.elements.nowPlayingBtn.addEventListener('click', () => {
                this.startMidnightPlaylist();
            });
        }

        document.addEventListener('themeChanged', () => {
            if (this.state.content.length > 0) {
                this.render(this.state.content);
            }
        });
        
        // Listen for visibility change to update time when tab becomes active
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkMidnightMode();
                if (this.state.content.length > 0) {
                    this.render(this.state.content);
                }
            }
        });
    },

    /* ============================================ */
    /* MIDNIGHT MODE DETECTION
    /* ============================================ */
    checkMidnightMode() {
        const now = new Date();
        const currentHour = now.getHours();
        this.state.currentHour = currentHour;
        
        // Check if current time is within midnight session hours
        let isMidnight = false;
        
        if (this.config.sessionStartHour <= this.config.sessionEndHour) {
            // Same day range (e.g., 21-23)
            isMidnight = currentHour >= this.config.sessionStartHour && 
                        currentHour <= this.config.sessionEndHour;
        } else {
            // Overnight range (e.g., 21-4)
            isMidnight = currentHour >= this.config.sessionStartHour || 
                        currentHour <= this.config.sessionEndHour;
        }
        
        this.state.isMidnightMode = isMidnight;
        
        // Update section styling and time badge
        this.updateSectionStyling();
        
        // If not midnight mode, we might want to hide or reduce the section
        // But we'll keep it visible with a badge showing when it's active
        if (this.elements.section) {
            if (isMidnight) {
                this.elements.section.classList.add('midnight-active');
                this.elements.section.classList.remove('midnight-inactive');
            } else {
                this.elements.section.classList.remove('midnight-active');
                this.elements.section.classList.add('midnight-inactive');
            }
        }
        
        console.log('Midnight mode:', isMidnight, 'at hour:', currentHour);
        return isMidnight;
    },

    updateSectionStyling() {
        if (!this.elements.timeBadge) return;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        if (this.state.isMidnightMode) {
            this.elements.timeBadge.innerHTML = `
                <i class="fas fa-moon"></i>
                <span>Midnight Session • ${timeStr}</span>
                <i class="fas fa-headphones"></i>
            `;
            this.elements.timeBadge.classList.add('active');
        } else {
            const hoursUntilMidnight = this.getHoursUntilMidnight();
            this.elements.timeBadge.innerHTML = `
                <i class="fas fa-clock"></i>
                <span>Midnight Sessions start in ${hoursUntilMidnight}h</span>
            `;
            this.elements.timeBadge.classList.remove('active');
        }
    },

    getHoursUntilMidnight() {
        const now = new Date();
        let midnightTime = new Date();
        midnightTime.setHours(this.config.sessionStartHour, 0, 0, 0);
        
        if (now > midnightTime) {
            midnightTime.setDate(midnightTime.getDate() + 1);
        }
        
        const diffMs = midnightTime - now;
        return Math.ceil(diffMs / (1000 * 60 * 60));
    },

    /* ============================================ */
    /* DATA LOADING
    /* ============================================ */
    async loadMidnightContent(forceRefresh = false) {
        if (this.state.isLoading) return;
        
        if (!forceRefresh) {
            const cachedData = this.getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('Midnight Sessions: Using cached data', cachedData.length, 'items');
                this.state.content = cachedData;
                this.render(cachedData);
                return;
            }
        }

        this.showLoading();
        this.state.isLoading = true;

        try {
            // Fetch content from Content table with midnight criteria
            const content = await this.fetchMidnightContent();
            
            // Fetch playlist content (albums, podcast series)
            const playlists = await this.fetchMidnightPlaylists();
            
            // Combine and enrich
            let allItems = [...content, ...playlists];
            
            // Enrich with metrics
            const enrichedItems = await this.enrichItemsWithMetrics(allItems);
            
            // Calculate midnight score
            const scoredItems = this.calculateMidnightScore(enrichedItems);
            
            // Sort by midnight score
            const sortedItems = scoredItems.sort((a, b) => b.midnight_score - a.midnight_score);
            
            // Take top items
            const topItems = sortedItems.slice(0, this.config.maxItems);
            
            this.state.content = topItems;
            this.cacheData(topItems);
            this.render(topItems);
            
            console.log('Midnight Sessions loaded:', topItems.length, 'items');
            
        } catch (error) {
            console.error('Error loading Midnight Sessions:', error);
            this.showError();
        } finally {
            this.hideLoading();
            this.state.isLoading = false;
        }
    },

    async fetchMidnightContent() {
        if (!window.supabaseClient) return [];

        // Build query for midnight-appropriate content
        let query = window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                file_url,
                duration,
                genre,
                language,
                country,
                city,
                content_format,
                content_type,
                views_count,
                favorites_count,
                shares_count,
                created_at,
                tempo,
                moods,
                tags,
                is_bantu_original,
                user_id,
                user_profiles:user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .in('content_format', this.config.midnightFormats)
            .limit(this.config.maxItems * 2);

        // Filter by midnight moods (using overlaps with array column)
        if (this.config.midnightMoods.length > 0) {
            // Check if any of the midnight moods are in the moods array
            const moodFilter = this.config.midnightMoods.map(m => `moods.cs.{${m}}`).join(',');
            query = query.or(moodFilter);
        }
        
        // Filter by tempo (low BPM for chill content)
        if (this.config.tempoRange) {
            query = query.gte('tempo', this.config.tempoRange.min)
                         .lte('tempo', this.config.tempoRange.max);
        }
        
        // Also include content from local cities
        const cityFilter = this.config.localCities.map(c => `city.eq.${c}`).join(',');
        query = query.or(cityFilter);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching midnight content:', error);
            return [];
        }

        return data || [];
    },

    async fetchMidnightPlaylists() {
        if (!window.supabaseClient) return [];

        // Fetch playlists suitable for midnight (ambient, chill, podcast series)
        const { data, error } = await window.supabaseClient
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
                connectors_count,
                user_profiles:creator_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('visibility', 'public')
            .in('playlist_type', ['album', 'playlist', 'podcast'])
            .limit(this.config.maxItems);

        if (error) {
            console.error('Error fetching midnight playlists:', error);
            return [];
        }

        // Filter playlists by name/description containing midnight keywords
        const midnightKeywords = ['chill', 'lofi', 'ambient', 'night', 'midnight', 'relax', 'calm', 'sleep', 'study', 'focus'];
        
        const filteredPlaylists = (data || []).filter(playlist => {
            const nameLower = (playlist.name || '').toLowerCase();
            const descLower = (playlist.description || '').toLowerCase();
            return midnightKeywords.some(keyword => 
                nameLower.includes(keyword) || descLower.includes(keyword)
            );
        });

        return filteredPlaylists.map(playlist => ({
            ...playlist,
            is_playlist: true,
            content_format: playlist.playlist_type === 'podcast' ? 'podcast_episode' : 'music'
        }));
    },

    async enrichItemsWithMetrics(items) {
        if (!items.length) return [];

        const contentIds = items.filter(i => !i.is_playlist).map(i => i.id);
        const playlistIds = items.filter(i => i.is_playlist).map(i => i.id);
        
        // Fetch engagement stats for content
        let engagementMetrics = {};
        if (contentIds.length) {
            const { data, error } = await window.supabaseClient
                .from('content_engagement_stats')
                .select('content_id, total_views, total_likes, total_comments, total_shares')
                .in('content_id', contentIds);
            
            if (!error && data) {
                engagementMetrics = data.reduce((map, stat) => {
                    map[stat.content_id] = stat;
                    return map;
                }, {});
            }
        }
        
        // For playlists, we'll use play_count as engagement
        return items.map(item => ({
            ...item,
            metrics: item.is_playlist ? {
                views: item.play_count || 0,
                likes: 0,
                comments: 0,
                shares: 0,
                connectors: item.connectors_count || 0
            } : {
                views: engagementMetrics[item.id]?.total_views || item.views_count || 0,
                likes: engagementMetrics[item.id]?.total_likes || 0,
                comments: engagementMetrics[item.id]?.total_comments || 0,
                shares: engagementMetrics[item.id]?.total_shares || item.shares_count || 0,
                connectors: 0
            }
        }));
    },

    calculateMidnightScore(item) {
        let score = 0;
        
        // Base engagement
        score += (item.metrics?.views || 0) * 1;
        score += (item.metrics?.likes || 0) * 2;
        score += (item.metrics?.comments || 0) * 3;
        
        // Midnight mood boost (if moods array exists)
        if (item.moods && Array.isArray(item.moods)) {
            const moodMatches = item.moods.filter(m => 
                this.config.midnightMoods.includes(m)
            ).length;
            score *= (1 + (moodMatches * 0.2));
        }
        
        // Tempo boost (lower tempo = more chill = higher midnight score)
        if (item.tempo && item.tempo > 0) {
            // Tempo 60 is ideal, higher tempo reduces score
            const tempoScore = Math.max(0, 1 - ((item.tempo - 60) / 60));
            score *= (0.8 + tempoScore * 0.5);
        }
        
        // Local city boost
        if (item.city && this.config.localCities.includes(item.city)) {
            score *= 1.3;
        }
        
        // South African language boost
        if (item.language && this.config.saLanguages.includes(item.language)) {
            score *= 1.2;
        }
        
        // Bantu Original boost
        if (item.is_bantu_original) {
            score *= 1.4;
        }
        
        // Duration preference (10-30 min is ideal for midnight)
        if (item.duration) {
            const durationMinutes = item.duration / 60;
            if (durationMinutes >= 10 && durationMinutes <= 30) {
                score *= 1.2;
            } else if (durationMinutes > 60) {
                score *= 0.9; // Slightly penalize very long content
            }
        }
        
        // Recency boost for new content
        const daysOld = (new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) score *= 1.2;
        else if (daysOld < 30) score *= 1.1;
        
        return Math.round(score);
    },

    /* ============================================ */
    /* RENDERING
    /* ============================================ */
    render(items) {
        if (!this.elements.container) return;
        
        if (!items.length) {
            this.renderEmpty();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        items.forEach((item, index) => {
            const card = this.createMidnightCard(item);
            fragment.appendChild(card);
            
            setTimeout(() => {
                if (card) card.classList.add('visible');
            }, index * 50);
        });
        
        this.elements.container.innerHTML = '';
        this.elements.container.appendChild(fragment);
        this.elements.section.classList.add('loaded');
    },

    createMidnightCard(item) {
        const card = document.createElement('div');
        card.className = 'midnight-card';
        card.dataset.contentId = item.id;
        card.dataset.isPlaylist = item.is_playlist || false;
        
        const thumbnailUrl = this.getThumbnailUrl(item);
        const creator = item.user_profiles || {};
        const creatorName = creator.full_name || creator.username || 'Artist';
        const creatorInitial = creatorName.charAt(0).toUpperCase();
        
        const views = this.formatNumber(item.metrics?.views || 0);
        const duration = this.formatDuration(item.duration || 0);
        
        // Determine content type icon and label
        const contentType = item.content_format || item.playlist_type || 'audio';
        const { icon, label } = this.getContentTypeInfo(contentType);
        
        // Get mood tags to display
        const moodTags = this.getMoodTags(item);
        
        // Get time badge (evening vs late night)
        const timeBadge = this.getTimeBadge();
        
        // Check if it's a local content
        const isLocal = item.city && this.config.localCities.includes(item.city);
        
        card.innerHTML = `
            <div class="midnight-card-inner">
                <div class="midnight-thumbnail">
                    <img src="${thumbnailUrl}" alt="${this.escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop'">
                    <div class="thumbnail-overlay"></div>
                    <div class="play-overlay">
                        <div class="play-icon"><i class="fas fa-play"></i></div>
                    </div>
                    ${duration ? `<div class="duration-badge">${duration}</div>` : ''}
                    ${timeBadge}
                    ${isLocal ? `<div class="local-badge"><i class="fas fa-map-marker-alt"></i> ${item.city}</div>` : ''}
                </div>
                <div class="midnight-info">
                    <div class="content-type-badge">
                        <i class="fas ${icon}"></i> ${label}
                    </div>
                    <h3 class="midnight-title" title="${this.escapeHtml(item.title)}">${this.truncateText(this.escapeHtml(item.title), 45)}</h3>
                    <div class="midnight-creator">
                        <div class="creator-avatar-small">
                            ${creator.avatar_url ? 
                                `<img src="${this.fixImageUrl(creator.avatar_url)}" alt="${creatorName}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${creatorInitial}</span>';">` :
                                `<span>${creatorInitial}</span>`
                            }
                        </div>
                        <span class="creator-name">${this.escapeHtml(creatorName)}</span>
                    </div>
                    ${moodTags.length ? `
                        <div class="mood-tags">
                            ${moodTags.map(tag => `<span class="mood-tag"><i class="fas fa-moon"></i> ${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="midnight-stats">
                        <span><i class="fas fa-headphones"></i> ${views}</span>
                        ${item.tempo ? `<span><i class="fas fa-chart-line"></i> ${item.tempo} BPM</span>` : ''}
                        ${item.language ? `<span><i class="fas fa-language"></i> ${this.getLanguageName(item.language)}</span>` : ''}
                    </div>
                    <div class="midnight-actions">
                        <button class="action-btn listen-now-btn" data-content-id="${item.id}" data-is-playlist="${item.is_playlist}">
                            <i class="fas fa-headphones"></i> Listen Now
                        </button>
                        <button class="action-btn add-queue-btn" data-content-id="${item.id}" title="Add to Queue">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const listenBtn = card.querySelector('.listen-now-btn');
        if (listenBtn) {
            listenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isPlaylist = listenBtn.dataset.isPlaylist === 'true';
                if (isPlaylist) {
                    this.playPlaylist(item.id);
                } else {
                    this.playContent(item.id, item);
                }
            });
        }
        
        const queueBtn = card.querySelector('.add-queue-btn');
        if (queueBtn) {
            queueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addToQueue(item.id, item.title);
            });
        }
        
        // Make entire card clickable
        card.addEventListener('click', () => {
            this.playContent(item.id, item);
        });
        
        return card;
    },

    getThumbnailUrl(item) {
        if (item.custom_thumbnail_url) {
            return this.fixImageUrl(item.custom_thumbnail_url);
        }
        if (item.banner_url) {
            return this.fixImageUrl(item.banner_url);
        }
        if (item.thumbnail_url) {
            return this.fixImageUrl(item.thumbnail_url);
        }
        // Default moody night-themed thumbnail
        return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop';
    },

    getContentTypeInfo(contentFormat) {
        const types = {
            'music': { icon: 'fa-music', label: 'Track' },
            'music_video': { icon: 'fa-music', label: 'Music Video' },
            'song': { icon: 'fa-music', label: 'Song' },
            'track': { icon: 'fa-music', label: 'Track' },
            'audio': { icon: 'fa-headphones', label: 'Audio' },
            'podcast_episode': { icon: 'fa-podcast', label: 'Podcast' },
            'podcast': { icon: 'fa-podcast', label: 'Podcast' },
            'album': { icon: 'fa-album', label: 'Album' },
            'playlist': { icon: 'fa-list', label: 'Playlist' },
            'long_form': { icon: 'fa-video', label: 'Long Form' },
            'documentary': { icon: 'fa-film', label: 'Documentary' },
            'film': { icon: 'fa-film', label: 'Film' }
        };
        return types[contentFormat] || { icon: 'fa-play-circle', label: 'Content' };
    },

    getMoodTags(item) {
        const moods = item.moods || [];
        // Filter moods that match midnight atmosphere
        const midnightMoods = moods.filter(m => 
            this.config.midnightMoods.includes(m) ||
            m === 'Relaxing' || m === 'Chill' || m === 'Deep' || m === 'Emotional'
        );
        return midnightMoods.slice(0, 2);
    },

    getTimeBadge() {
        const hour = this.state.currentHour;
        
        if (hour >= 0 && hour < 4) {
            return '<div class="time-badge late-night"><i class="fas fa-moon"></i> Deep Night</div>';
        } else if (hour >= 21) {
            return '<div class="time-badge evening"><i class="fas fa-star"></i> Late Evening</div>';
        }
        return '<div class="time-badge midnight-mode"><i class="fas fa-clock"></i> Midnight Mode</div>';
    },

    getLanguageName(languageCode) {
        const languages = {
            'en': 'English', 'zu': 'isiZulu', 'xh': 'isiXhosa', 'af': 'Afrikaans',
            'nso': 'Sepedi', 'st': 'Sesotho', 'tn': 'Setswana', 'ss': 'siSwati',
            've': 'Tshivenda', 'ts': 'Xitsonga', 'nr': 'isiNdebele'
        };
        return languages[languageCode] || languageCode || 'English';
    },

    /* ============================================ */
    /* PLAYBACK ACTIONS
    /* ============================================ */
    async playContent(contentId, item) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to play content', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        // Get audio/video URL
        if (item?.file_url && window.playSmartLink) {
            const mediaUrl = this.fixImageUrl(item.file_url);
            window.playSmartLink(mediaUrl, item.title, item.user_profiles?.full_name || 'Artist');
            this.showToast(`Now playing: ${item.title}`, 'success');
        } else if (contentId) {
            window.location.href = `content-detail.html?id=${contentId}`;
        }
    },

    async playPlaylist(playlistId) {
        const user = await this.getCurrentUser();
        if (!user) {
            this.showToast('Please sign in to play playlist', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        window.location.href = `playlist-detail.html?id=${playlistId}`;
    },

    startMidnightPlaylist() {
        // Start a continuous midnight playlist
        if (this.state.content.length > 0) {
            const firstItem = this.state.content[0];
            this.playContent(firstItem.id, firstItem);
            this.showToast('Starting Midnight Session playlist...', 'info');
        }
    },

    addToQueue(contentId, title) {
        this.showToast(`Added "${title}" to queue`, 'success');
        // In production, this would integrate with a global queue system
    },

    /* ============================================ */
    /* UI STATE MANAGEMENT
    /* ============================================ */
    renderEmpty() {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div class="empty-state-midnight">
                    <i class="fas fa-moon"></i>
                    <h3>No Midnight Content Yet</h3>
                    <p>Check back later for chill vibes and late-night sessions</p>
                </div>
            `;
        }
    },

    renderLoading() {
        if (!this.elements.container) return;
        
        const skeletons = Array(6).fill().map(() => `
            <div class="skeleton-midnight-card">
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
                <div class="error-state-midnight">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Midnight Sessions</h3>
                    <button class="retry-btn" onclick="BantuWavesMidnight.loadMidnightContent(true)">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
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
        } catch (e) {}
        return null;
    },

    cacheData(data) {
        try {
            localStorage.setItem(this.config.cacheKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {}
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
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    },

    async getCurrentUser() {
        if (window.AuthHelper?.isAuthenticated()) {
            return window.AuthHelper.getUserProfile();
        }
        if (window.getCurrentUser) {
            return await window.getCurrentUser();
        }
        return null;
    },

    showToast(message, type) {
        if (window.showToast) window.showToast(message, type);
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BantuWavesMidnight.init());
} else {
    BantuWavesMidnight.init();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BantuWavesMidnight;
}
