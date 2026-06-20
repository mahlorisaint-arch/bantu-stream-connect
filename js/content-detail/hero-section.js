// js/content-detail/hero-section.js
// ============================================
// HERO SECTION MODULE
// Contains UI rendering functions for the content hero section
// AND its specific data-fetching logic (watch progress)
// ============================================
console.log('🎬 Hero Section Module Loading...');

// ============================================
// UPDATE HERO POSTER - R2 FOLDER REALIGNMENT
// ============================================

/**
 * Update the hero poster/backdrop with thumbnail
 * @param {Object} content - Content object with thumbnail_url
 */
function updateHeroPoster(content) {
    const heroPoster = document.getElementById('heroPoster');
    const posterPlaceholder = document.getElementById('posterPlaceholder');
    
    if (!heroPoster) return;
    
    if (content && content.thumbnail_url) {
        // 🚨 CRITICAL: Pass 'thumbnail' context for correct R2 folder mapping
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url, 'thumbnail') || content.thumbnail_url;
        
        console.log('🖼️ Hero poster resolved URL:', imgUrl ? imgUrl.substring(0, 80) + (imgUrl.length > 80 ? '...' : '') : 'null');
        
        // Check if there's already an image
        let existingImg = heroPoster.querySelector('img');
        if (existingImg) {
            existingImg.src = imgUrl;
            existingImg.alt = content.title || 'Content thumbnail';
            console.log('🖼️ Hero poster image updated');
        } else {
            // Create new image
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = content.title || 'Content thumbnail';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = function() {
                console.warn('🖼️ Hero poster image failed to load');
                this.style.display = 'none';
                if (posterPlaceholder) posterPlaceholder.style.display = 'flex';
            };
            img.onload = function() {
                console.log('🖼️ Hero poster image loaded successfully');
            };
            // Hide placeholder
            if (posterPlaceholder) posterPlaceholder.style.display = 'none';
            heroPoster.appendChild(img);
            console.log('🖼️ Hero poster image created');
        }
        
        // Also set background for fallback
        heroPoster.style.backgroundImage = `url('${imgUrl}')`;
        heroPoster.style.backgroundSize = 'cover';
        heroPoster.style.backgroundPosition = 'center';
        heroPoster.style.backgroundColor = 'transparent';
        
    } else {
        // No thumbnail - show placeholder
        heroPoster.style.backgroundImage = '';
        heroPoster.style.backgroundColor = 'var(--bg-secondary)';
        if (posterPlaceholder) posterPlaceholder.style.display = 'flex';
        
        // Remove any existing img
        const existingImg = heroPoster.querySelector('img');
        if (existingImg) existingImg.remove();
        console.log('🖼️ No thumbnail, showing placeholder');
    }
}

/**
 * Update the entire content UI (hero section)
 * This is the main entry point for hero section rendering
 */
function updateContentUI(content) {
    if (!content) return;
    
    window.safeSetText('contentTitle', content.title);
    
    const creatorName = content.creator || (window.currentPlaylist?.creator_name || window.currentPlaylist?.creator_username || 'Creator');
    window.safeSetText('creatorName', creatorName);
    window.safeSetText('creatorDisplayName', creatorName);
    
    window.safeSetText('viewsCount', window.formatNumber(content.views_count) + ' views');
    window.safeSetText('viewsCountFull', window.formatNumber(content.views_count));
    window.safeSetText('likesCount', window.formatNumber(content.likes_count));
    window.safeSetText('favoritesCount', window.formatNumber(content.favorites_count));
    window.safeSetText('commentsCount', `(${window.formatNumber(content.comments_count)})`);
    
    const duration = window.formatDuration(content.duration || 3600);
    window.safeSetText('durationText', duration);
    window.safeSetText('contentDurationFull', duration);
    
    window.safeSetText('uploadDate', window.formatDate(content.created_at));
    window.safeSetText('contentGenre', content.genre || 'General');
    window.safeSetText('contentDescriptionShort', window.truncateText(content.description, 150));
    window.safeSetText('contentDescriptionFull', content.description);
    
    // Update creator avatar
    const creatorAvatar = document.getElementById('creatorAvatar');
    if (creatorAvatar && content.user_profiles) {
        const avatarUrl = content.user_profiles.avatar_url;
        const displayName = content.user_profiles.full_name || content.user_profiles.username || (window.currentPlaylist?.creator_name || 'Creator');
        const initial = displayName.charAt(0).toUpperCase();
        
        if (avatarUrl && avatarUrl !== 'null' && avatarUrl !== 'undefined' && avatarUrl !== '') {
            const fixedAvatarUrl = window.SupabaseHelper?.fixMediaUrl?.(avatarUrl, 'avatar') || avatarUrl;
            creatorAvatar.innerHTML = `
                <img src="${fixedAvatarUrl}" 
                     alt="${window.escapeHtml(displayName)}" 
                     style="width:100%; height:100%; border-radius:50%; object-fit:cover;"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231D4ED8%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22>${initial}</text></svg>'">
            `;
        } else {
            creatorAvatar.innerHTML = `
                <div style="
                    width:100%;
                    height:100%;
                    border-radius:50%;
                    background:linear-gradient(135deg, #1D4ED8, #F59E0B);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:white;
                    font-weight:bold;
                    font-size:1.5rem;
                ">${initial}</div>
            `;
        }
    }
    
    // Update poster placeholder
    const posterPlaceholder = document.getElementById('posterPlaceholder');
    if (posterPlaceholder && content.thumbnail_url) {
        const imgUrl = window.SupabaseHelper?.fixMediaUrl?.(content.thumbnail_url, 'thumbnail') || content.thumbnail_url;
        posterPlaceholder.innerHTML = `
            <img src="${imgUrl}" alt="${content.title}" 
                 style="width:100%; height:100%; object-fit:cover; border-radius: 12px;"
                 onerror="this.src='https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=450&fit=crop'">
            <div class="play-overlay">
                <div class="play-icon-large">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }
    
    // 🖼️ Update hero poster with thumbnail
    updateHeroPoster(content);
    
    console.log('✅ Content UI updated for:', content.title);
}

/**
 * Update content details (alias for updateContentUI for compatibility)
 */
function updateContentDetails(content) {
    updateContentUI(content);
}

/**
 * Add resume button to hero actions
 * Fetches watch progress data to determine resume position
 */
async function addResumeButton(progressSeconds) {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    if (document.getElementById('resumeBtn')) return;
    
    // If progressSeconds not provided, fetch from database
    let finalProgress = progressSeconds;
    if (!finalProgress && window.currentUserId && window.currentContent?.id) {
        try {
            const { data: progressData } = await window.supabaseClient
                .from('watch_progress')
                .select('last_position')
                .eq('user_id', window.currentUserId)
                .eq('content_id', window.currentContent.id)
                .maybeSingle();
            
            if (progressData?.last_position && progressData.last_position > 10) {
                finalProgress = progressData.last_position;
            }
        } catch (error) {
            console.warn('Failed to fetch watch progress for resume button:', error);
        }
    }
    
    if (!finalProgress || finalProgress <= 10) return;
    
    const resumeBtn = document.createElement('button');
    resumeBtn.id = 'resumeBtn';
    resumeBtn.className = 'btn btn-primary resume-btn';
    resumeBtn.innerHTML = `
        <i class="fas fa-play"></i>
        <span>Resume (${window.formatDuration(finalProgress)})</span>
    `;
    resumeBtn.addEventListener('click', () => {
        if (typeof window.startPlaybackFromUserGesture === 'function') {
            window.startPlaybackFromUserGesture();
        }
    });
    
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        heroActions.insertBefore(resumeBtn, playBtn);
        playBtn.style.display = 'none';
    } else {
        heroActions.prepend(resumeBtn);
    }
    
    console.log('✅ Resume button added with progress:', finalProgress);
}

/**
 * Remove resume button from hero actions
 */
function removeResumeButton() {
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) {
        resumeBtn.remove();
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.style.display = 'flex';
    }
}

/**
 * Set hero poster to playing state (visual feedback)
 */
function setHeroPosterPlaying(isPlaying) {
    const heroPoster = document.getElementById('heroPoster');
    if (!heroPoster) return;
    
    if (isPlaying) {
        heroPoster.classList.add('playing');
        heroPoster.style.opacity = '0.3';
    } else {
        heroPoster.classList.remove('playing');
        heroPoster.style.opacity = '1';
    }
}

// ============================================
// LOAD CRITICAL CONTENT DATA (Hero section specific)
// Fetches content details from database including watch progress
// ============================================

async function loadCriticalContentData(contentId) {
    const cached = localStorage.getItem(`content_${contentId}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed._cachedAt && Date.now() - parsed._cachedAt < 300000) {
                await window.setCurrentContent(parsed);
                refreshContentInBackground(contentId);
                return;
            }
        } catch(e) { console.warn('Cache parse error:', e); }
    }
    
    const profileData = await fetchContentProfileDetails(contentId);
    if (!profileData) {
        console.warn('Profile fetch failed, falling back to legacy method');
        await loadContentFromURLLegacy();
        return;
    }
    
    let watchProgress = null;
    if (window.currentUserId) {
        const { data: progressData } = await window.supabaseClient
            .from('watch_progress')
            .select('last_position, is_completed')
            .eq('user_id', window.currentUserId)
            .eq('content_id', contentId)
            .maybeSingle();
        watchProgress = progressData;
    }
    
    const { data: streamingData } = await window.supabaseClient
        .from('Content')
        .select('quality_profiles, hls_manifest_url, data_saver_url')
        .eq('id', contentId)
        .maybeSingle();
    
    const { data: seriesData } = await window.supabaseClient
        .from('Content')
        .select('series_id, episode_number')
        .eq('id', contentId)
        .maybeSingle();
    
    const contentObj = {
        id: profileData.id,
        title: profileData.title || 'Untitled',
        description: profileData.description || '',
        thumbnail_url: profileData.thumbnail_url,
        file_url: profileData.file_url,
        media_type: profileData.media_type || 'video',
        genre: profileData.genre || 'General',
        created_at: profileData.created_at,
        duration: profileData.duration || 3600,
        language: profileData.language || 'English',
        views_count: profileData.views_count,
        likes_count: profileData.likes_count,
        valid_views_count: profileData.valid_views_count,
        favorites_count: profileData.favorites_count || 0,
        comments_count: profileData.comments_count,
        creator: profileData.creator,
        creator_display_name: profileData.creator_display_name,
        creator_id: profileData.creator_id,
        user_id: profileData.user_id,
        user_profiles: profileData.user_profiles,
        watch_progress: watchProgress?.last_position || 0,
        is_completed: watchProgress?.is_completed || false,
        quality_profiles: streamingData?.quality_profiles || [],
        hls_manifest_url: streamingData?.hls_manifest_url || null,
        data_saver_url: streamingData?.data_saver_url || null,
        series_id: seriesData?.series_id || null,
        episode_number: seriesData?.episode_number || null,
        _cachedAt: Date.now()
    };
    
    await window.setCurrentContent(contentObj);
    localStorage.setItem(`content_${contentId}`, JSON.stringify(contentObj));
    
    if (contentObj.watch_progress > 10 && !contentObj.is_completed) {
        addResumeButton(contentObj.watch_progress);
    }
}

async function fetchContentProfileDetails(contentId) {
    try {
        const { data: mediaAsset, error: fetchError } = await window.supabaseClient
            .from('Content')
            .select(`
                id,
                title,
                description,
                thumbnail_url,
                file_url,
                duration,
                media_type,
                content_format,
                created_at,
                user_id,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                ),
                content_engagement_stats (
                    total_views,
                    total_valid_views,
                    total_likes,
                    total_comments
                )
            `)
            .eq('id', contentId)
            .maybeSingle();
        
        if (fetchError) throw fetchError;
        if (!mediaAsset) return null;
        
        const clientPayload = {
            ...mediaAsset,
            views_count: mediaAsset.content_engagement_stats?.total_views || 0,
            likes_count: mediaAsset.content_engagement_stats?.total_likes || 0,
            valid_views_count: mediaAsset.content_engagement_stats?.total_valid_views || 0,
            comments_count: mediaAsset.content_engagement_stats?.total_comments || 0,
            creator: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || (window.isPlaylistMode && window.currentPlaylist ? window.currentPlaylist.creator_name : 'Creator'),
            creator_display_name: mediaAsset.user_profiles?.full_name || mediaAsset.user_profiles?.username || (window.isPlaylistMode && window.currentPlaylist ? window.currentPlaylist.creator_name : 'Creator'),
            creator_id: mediaAsset.user_id
        };
        
        return clientPayload;
    } catch (error) {
        console.error("Critical Profile Fetch Interruption:", error.message);
        return null;
    }
}

async function loadContentFromURLLegacy() {
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id') || '68';
    try {
        const { data: contentData, error: contentError } = await window.supabaseClient
            .from('Content')
            .select(`
                *,
                user_profiles!user_id (
                    id,
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .eq('id', contentId)
            .maybeSingle();
        
        if (contentError || !contentData) throw contentError || new Error('Content not found');
        
        const liveCounts = await window.loadLiveEngagementCounts(contentId);
        
        let watchProgress = null;
        if (window.currentUserId) {
            const { data: progressData } = await window.supabaseClient
                .from('watch_progress')
                .select('last_position, is_completed')
                .eq('user_id', window.currentUserId)
                .eq('content_id', contentId)
                .maybeSingle();
            watchProgress = progressData;
        }
        
        const { data: streamingData } = await window.supabaseClient
            .from('Content')
            .select('quality_profiles, hls_manifest_url, data_saver_url')
            .eq('id', contentId)
            .maybeSingle();
        
        const { data: seriesData } = await window.supabaseClient
            .from('Content')
            .select('series_id, episode_number')
            .eq('id', contentId)
            .maybeSingle();
        
        const contentObj = {
            id: contentData.id,
            title: contentData.title || 'Untitled',
            description: contentData.description || '',
            thumbnail_url: contentData.thumbnail_url,
            file_url: contentData.file_url,
            media_type: contentData.media_type || 'video',
            genre: contentData.genre || 'General',
            created_at: contentData.created_at,
            duration: contentData.duration || contentData.duration_seconds || 3600,
            language: contentData.language || 'English',
            views_count: liveCounts.views,
            likes_count: liveCounts.likes,
            favorites_count: contentData.favorites_count || 0,
            comments_count: liveCounts.comments,
            creator: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_display_name: contentData.user_profiles?.full_name || contentData.user_profiles?.username || 'Creator',
            creator_id: contentData.user_profiles?.id || contentData.user_id,
            user_id: contentData.user_id,
            user_profiles: contentData.user_profiles,
            watch_progress: watchProgress?.last_position || 0,
            is_completed: watchProgress?.is_completed || false,
            quality_profiles: streamingData?.quality_profiles || [],
            hls_manifest_url: streamingData?.hls_manifest_url || null,
            data_saver_url: streamingData?.data_saver_url || null,
            series_id: seriesData?.series_id || null,
            episode_number: seriesData?.episode_number || null
        };
        
        await window.setCurrentContent(contentObj);
        
        if (contentObj.watch_progress > 10 && !contentObj.is_completed) {
            addResumeButton(contentObj.watch_progress);
        }
    } catch (error) {
        console.error('❌ Content load failed:', error);
        window.showToast('Content not available. Please try again.', 'error');
        document.getElementById('contentTitle').textContent = 'Content Unavailable';
    }
}

function refreshContentInBackground(contentId) {
    try {
        setTimeout(async () => {
            const liveCounts = await window.loadLiveEngagementCounts(contentId);
            if (window.currentContent && window.currentContent.id == contentId) {
                window.currentContent.views_count = liveCounts.views;
                window.currentContent.likes_count = liveCounts.likes;
                if (typeof updateCountsUI === 'function') updateCountsUI(window.currentContent);
                window.currentContent._cachedAt = Date.now();
                localStorage.setItem(`content_${contentId}`, JSON.stringify(window.currentContent));
            }
        }, 100);
    } catch(e) { console.warn('Background refresh failed:', e); }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.updateHeroPoster = updateHeroPoster;
window.updateContentUI = updateContentUI;
window.updateContentDetails = updateContentDetails;
window.addResumeButton = addResumeButton;
window.removeResumeButton = removeResumeButton;
window.setHeroPosterPlaying = setHeroPosterPlaying;
window.loadCriticalContentData = loadCriticalContentData;
window.fetchContentProfileDetails = fetchContentProfileDetails;
window.loadContentFromURLLegacy = loadContentFromURLLegacy;

console.log('✅ Hero Section Module loaded');
console.log('   🖼️ updateHeroPoster: R2 folder routing with thumbnail context');
console.log('   🎯 R2 folder routing: thumbnails → /content-thumbnails/');
