// ============================================ */
// SHARED COMPONENTS JS - BANTU STREAM CONNECT */
// Platform-wide JavaScript with FULL AUTH INTEGRATION */
// Complete implementation for Search, Analytics, Notifications, Voice Search, Profile */
// ============================================ */

console.log('📦 Shared Components v3.2 - Complete with all features and fixes...');

// ============================================ */
// GLOBAL VARIABLES */
// ============================================ */
window.platformComponents = window.platformComponents || {
    initialized: false,
    currentUser: null,
    currentProfile: null,
    uiScaleController: null,
    supabaseClient: null,
    notifications: [],
    searchDebounceTimer: null,
    voiceRecognition: null,
    analyticsChart: null
};

// ============================================ */
// AUTH INTEGRATION - Get user from AuthHelper */
// ============================================ */
async function getCurrentUser() {
    // Try AuthHelper first
    if (window.AuthHelper && typeof window.AuthHelper.isAuthenticated === 'function') {
        if (window.AuthHelper.isAuthenticated()) {
            const userProfile = window.AuthHelper.getUserProfile();
            if (userProfile && userProfile.id) {
                return {
                    id: userProfile.id,
                    email: userProfile.email,
                    full_name: userProfile.full_name || userProfile.username || userProfile.email?.split('@')[0] || 'User',
                    avatar_url: userProfile.avatar_url,
                    username: userProfile.username
                };
            }
        }
    }
    
    // Try Supabase directly
    if (window.supabaseClient) {
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (user) {
                // Fetch profile from user_profiles
                const { data: profile } = await window.supabaseClient
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                    
                return {
                    id: user.id,
                    email: user.email,
                    full_name: profile?.full_name || profile?.username || user.email?.split('@')[0] || 'User',
                    avatar_url: profile?.avatar_url,
                    username: profile?.username
                };
            }
        } catch (e) {
            console.warn('Error getting user from Supabase:', e);
        }
    }
    
    return null;
}

// ============================================ */
// UPDATE HEADER PROFILE - Shows logged-in user (FIXED: NO REDIRECT) */
// ============================================ */
async function updateHeaderProfile() {
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    
    if (!profilePlaceholder) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        // User is logged in
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const initial = displayName.charAt(0).toUpperCase();
        
        if (profileNameSpan) {
            profileNameSpan.textContent = displayName;
        }
        
        // Clear placeholder
        profilePlaceholder.innerHTML = '';
        
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            // Fix avatar URL if needed
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = displayName;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
            img.onerror = () => {
                profilePlaceholder.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem;">${initial}</div>`;
            };
            profilePlaceholder.appendChild(img);
        } else {
            // Show initials
            profilePlaceholder.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1rem;">${initial}</div>`;
        }
        
        // FIX: Do NOT set onclick redirect here - handled by profile dropdown
        // The profile button click should toggle the dropdown, not redirect.
        
    } else {
        // Guest user
        if (profileNameSpan) {
            profileNameSpan.textContent = 'Guest';
        }
        profilePlaceholder.innerHTML = '<i class="fas fa-user"></i>';
        // Also no redirect - dropdown will handle sign-in
    }
    
    // Apply mobile styles
    applyMobileHeaderStyles();
}

// ============================================ */
// UPDATE SIDEBAR PROFILE - Shows logged-in user */
// ============================================ */
async function updateSidebarProfile() {
    const avatarDiv = document.getElementById('sidebar-profile-avatar');
    const nameSpan = document.getElementById('sidebar-profile-name');
    const emailSpan = document.getElementById('sidebar-profile-email');
    const profileDiv = document.getElementById('sidebar-profile');
    
    if (!avatarDiv || !nameSpan || !emailSpan) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        // User is logged in
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const userEmail = user.email || 'user@example.com';
        const initial = displayName.charAt(0).toUpperCase();
        
        nameSpan.textContent = displayName;
        emailSpan.textContent = userEmail;
        
        // Clear avatar
        avatarDiv.innerHTML = '';
        
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            // Fix avatar URL if needed
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = displayName;
            img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
            img.onerror = () => {
                avatarDiv.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initial}</span>`;
            };
            avatarDiv.appendChild(img);
        } else {
            // Show initials
            avatarDiv.innerHTML = `<span style="font-size:1.2rem;font-weight:bold;">${initial}</span>`;
        }
        
        // Make profile clickable to profile page (sidebar only)
        if (profileDiv) {
            profileDiv.onclick = () => {
                window.location.href = 'manage-profiles.html';
            };
        }
        
        // Show creator section if user is creator
        await checkAndShowCreatorSection(user.id);
        
    } else {
        // Guest user
        nameSpan.textContent = 'Guest';
        emailSpan.textContent = 'Sign in to continue';
        avatarDiv.innerHTML = '<i class="fas fa-user" style="font-size:1.5rem;"></i>';
        
        if (profileDiv) {
            profileDiv.onclick = () => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            };
        }
    }
}

// ============================================ */
// CHECK IF USER IS CREATOR AND SHOW CREATOR SECTION */
// ============================================ */
async function checkAndShowCreatorSection(userId) {
    if (!userId || !window.supabaseClient) return;
    
    try {
        // Check if user has any published content
        const { data, error } = await window.supabaseClient
            .from('Content')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'published')
            .limit(1);
            
        if (!error && data && data.length > 0) {
            // User is a creator, show creator section
            const creatorSection = document.querySelector('.sidebar-section[data-section="creator"]');
            if (creatorSection) {
                creatorSection.style.display = 'block';
            }
            
            // Also show creator mode toggle
            const creatorModeToggle = document.getElementById('creatorModeToggle');
            if (creatorModeToggle) {
                creatorModeToggle.style.display = 'flex';
            }
        }
    } catch (e) {
        console.warn('Error checking creator status:', e);
    }
}

// ============================================ */
// UPDATE PROFILE DROPDOWN LIST */
// ============================================ */
async function updateProfileDropdown() {
    const profileList = document.getElementById('profile-list');
    if (!profileList) return;
    
    const user = await getCurrentUser();
    
    if (user && user.id) {
        const displayName = user.full_name || user.username || user.email?.split('@')[0] || 'User';
        const initial = displayName.charAt(0).toUpperCase();
        
        let avatarHtml = '';
        if (user.avatar_url && user.avatar_url !== 'null' && user.avatar_url !== 'undefined') {
            let avatarUrl = user.avatar_url;
            if (window.SupabaseHelper && typeof window.SupabaseHelper.fixMediaUrl === 'function') {
                avatarUrl = window.SupabaseHelper.fixMediaUrl(avatarUrl);
            }
            avatarHtml = `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg, #1D4ED8, #F59E0B);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${initial}</div>`;
        }
        
        profileList.innerHTML = `
            <div class="profile-item active" data-profile="main">
                <div class="profile-avatar-small">
                    ${avatarHtml}
                </div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(displayName)}</div>
                    <div class="profile-type">Main Profile</div>
                </div>
            </div>
        `;
    } else {
        profileList.innerHTML = `
            <div class="profile-item" onclick="window.location.href='login.html?redirect=${encodeURIComponent(window.location.pathname)}'">
                <div class="profile-avatar-small">
                    <i class="fas fa-sign-in-alt"></i>
                </div>
                <div class="profile-info">
                    <div class="profile-name">Sign In</div>
                    <div class="profile-type">To access your profile</div>
                </div>
            </div>
        `;
    }
}

// ============================================ */
// 1. COMPLETE SEARCH FUNCTIONALITY (with thumbnail fix) */
// ============================================ */

function setupSearchModal() {
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    
    if (!searchBtn || !searchModal) return;
    
    // Open modal
    searchBtn.onclick = () => {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 100);
    };
    
    // Close modal
    if (closeSearchBtn) {
        closeSearchBtn.onclick = () => searchModal.classList.remove('active');
    }
    
    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal?.classList.contains('active')) {
            searchModal.classList.remove('active');
        }
    });
    
    // Search input handler with debounce
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(window.platformComponents.searchDebounceTimer);
            window.platformComponents.searchDebounceTimer = setTimeout(() => {
                performSearch(e.target.value, categoryFilter?.value, sortFilter?.value);
            }, 500);
        });
    }
    
    // Filter handlers
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            performSearch(searchInput?.value, categoryFilter.value, sortFilter?.value);
        });
    }
    
    if (sortFilter) {
        sortFilter.addEventListener('change', () => {
            performSearch(searchInput?.value, categoryFilter?.value, sortFilter.value);
        });
    }
}

async function performSearch(query, category = '', sortBy = 'newest') {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;
    
    if (!query || query.length < 2) {
        resultsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Type at least 2 characters to search</p></div>';
        return;
    }
    
    resultsGrid.innerHTML = '<div class="loading-spinner-small"></div>';
    
    try {
        let supabaseQuery = window.supabaseClient
            .from('Content')
            .select(`
                id, 
                title, 
                description, 
                thumbnail_url, 
                duration, 
                genre, 
                language,
                views_count,
                created_at,
                user_id,
                user_profiles!user_id(full_name, username, avatar_url)
            `)
            .eq('status', 'published')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,genre.ilike.%${query}%`);
        
        // Apply category filter
        if (category && category !== '') {
            supabaseQuery = supabaseQuery.eq('genre', category);
        }
        
        // Get results
        const { data: content, error } = await supabaseQuery.limit(50);
        
        if (error) throw error;
        
        // Sort results
        let results = content || [];
        if (sortBy === 'popular') {
            results.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        } else if (sortBy === 'newest') {
            results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        renderSearchResults(results, query);
        
    } catch (error) {
        console.error('Search error:', error);
        resultsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error searching. Please try again.</p></div>';
    }
}

// FIXED: Thumbnail URL construction for search results
function renderSearchResults(results, query) {
    const resultsGrid = document.getElementById('search-results-grid');
    
    if (!results || results.length === 0) {
        resultsGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No results found for "${escapeHtml(query)}"</p></div>`;
        return;
    }
    
    resultsGrid.innerHTML = results.map(item => {
        // FIXED: Proper thumbnail URL construction
        let thumbnail = 'https://via.placeholder.com/400x225?text=No+Thumbnail';
        if (item.thumbnail_url) {
            if (item.thumbnail_url.startsWith('http')) {
                thumbnail = item.thumbnail_url;
            } else if (item.thumbnail_url.startsWith('/')) {
                thumbnail = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content${item.thumbnail_url}`;
            } else {
                thumbnail = `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${item.thumbnail_url}`;
            }
        }
        
        const creatorName = item.user_profiles?.full_name || item.user_profiles?.username || 'Unknown Creator';
        const views = formatNumber(item.views_count || 0);
        const duration = item.duration ? formatDuration(item.duration) : '';
        
        return `
            <div class="search-result-card" onclick="window.location.href='content-detail.html?id=${item.id}'">
                <div class="search-result-thumbnail">
                    <img src="${thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x225?text=No+Image'">
                    ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
                </div>
                <div class="search-result-info">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p class="creator-name">${escapeHtml(creatorName)}</p>
                    <div class="result-meta">
                        <span><i class="fas fa-eye"></i> ${views} views</span>
                        ${item.genre ? `<span><i class="fas fa-tag"></i> ${escapeHtml(item.genre)}</span>` : ''}
                    </div>
                    ${item.description ? `<p class="description-preview">${escapeHtml(item.description.substring(0, 100))}${item.description.length > 100 ? '...' : ''}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================ */
// 2. COMPLETE ANALYTICS FUNCTIONALITY (FIXED: 4 metrics) */
// ============================================ */

function setupAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const modal = document.getElementById('analytics-modal');
    const closeBtn = document.getElementById('close-analytics');
    
    if (!analyticsBtn || !modal) return;
    
    analyticsBtn.onclick = async () => {
        const user = await getCurrentUser();
        if (!user || !user.id) {
            showToast('Please sign in to view analytics', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        modal.classList.add('active');
        await loadCompleteAnalyticsData();
    };
    
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }
    
    // Setup chart controls
    setupChartControls();
}

// FIXED: Analytics now shows Total Views, Avg. Watch Time, Engagement Rate, Comments
async function loadCompleteAnalyticsData() {
    const user = await getCurrentUser();
    if (!user || !user.id) return;
    
    try {
        // Get user's content
        const { data: contentList } = await window.supabaseClient
            .from('Content')
            .select('id, title, views_count, created_at')
            .eq('user_id', user.id);
        
        if (!contentList || contentList.length === 0) {
            showNoAnalyticsData();
            return;
        }
        
        const contentIds = contentList.map(c => c.id);
        
        // Get view analytics
        const { data: views } = await window.supabaseClient
            .from('content_views')
            .select('content_id, view_duration, created_at, profile_id')
            .in('content_id', contentIds);
        
        // Get likes
        const { data: likes } = await window.supabaseClient
            .from('content_likes')
            .select('content_id')
            .in('content_id', contentIds);
        
        // Get comments
        const { data: comments } = await window.supabaseClient
            .from('comments')
            .select('content_id')
            .in('content_id', contentIds);
        
        // Calculate metrics
        const totalViews = views?.length || 0;
        const totalWatchTime = views?.reduce((sum, v) => sum + (v.view_duration || 0), 0) || 0;
        const avgWatchTime = totalViews > 0 ? Math.floor(totalWatchTime / totalViews) : 0;
        const totalLikes = likes?.length || 0;
        const totalComments = comments?.length || 0;
        const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(1) : 0;
        
        // Update UI elements for the 4 requested metrics
        const totalViewsEl = document.getElementById('total-views');
        const avgWatchTimeEl = document.getElementById('avg-watch-time');
        const engagementRateEl = document.getElementById('engagement-rate');
        const totalCommentsEl = document.getElementById('total-comments');
        
        if (totalViewsEl) totalViewsEl.textContent = formatNumber(totalViews);
        if (avgWatchTimeEl) avgWatchTimeEl.textContent = formatDuration(avgWatchTime);
        if (engagementRateEl) engagementRateEl.textContent = engagementRate + '%';
        if (totalCommentsEl) totalCommentsEl.textContent = formatNumber(totalComments);
        
        // Optional: also update other stats if elements exist
        const totalLikesEl = document.getElementById('total-likes');
        if (totalLikesEl) totalLikesEl.textContent = formatNumber(totalLikes);
        
        const totalContentEl = document.getElementById('total-content');
        if (totalContentEl) totalContentEl.textContent = contentList.length.toString();
        
        // Get daily views for chart
        const dailyViews = getDailyViewsData(views);
        renderAnalyticsChart(dailyViews);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Error loading analytics data', 'error');
    }
}

function getDailyViewsData(views) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayViews = views?.filter(v => {
            const viewDate = new Date(v.created_at);
            return viewDate.toDateString() === date.toDateString();
        }).length || 0;
        last7Days.push({ date: dateStr, views: dayViews });
    }
    return last7Days;
}

function updateAnalyticsUI(totalViews, totalWatchTime, avgWatchTime, uniqueViewers, contentCount) {
    const elements = {
        'total-views': formatNumber(totalViews),
        'total-watch-time': formatDuration(totalWatchTime),
        'avg-watch-time': formatDuration(avgWatchTime),
        'unique-viewers': formatNumber(uniqueViewers),
        'total-content': contentCount.toString()
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    // Update trends
    updateTrendIndicators();
}

async function loadEngagementMetrics(contentIds) {
    try {
        const { data: likes } = await window.supabaseClient
            .from('content_likes')
            .select('content_id')
            .in('content_id', contentIds);
        
        const { data: comments } = await window.supabaseClient
            .from('comments')
            .select('content_id')
            .in('content_id', contentIds);
        
        const engagementRate = contentIds.length > 0 ? 
            ((likes?.length || 0) + (comments?.length || 0)) / contentIds.length : 0;
        
        const engagementEl = document.getElementById('engagement-rate');
        if (engagementEl) engagementEl.textContent = Math.round(engagementRate) + '%';
        
    } catch (error) {
        console.warn('Error loading engagement:', error);
    }
}

function updateTrendIndicators() {
    // Simulate trend calculation - in production, compare with previous period
    const trends = {
        'views-trend': { value: '+12%', class: 'up' },
        'watch-time-trend': { value: '+8%', class: 'up' },
        'engagement-trend': { value: '+5%', class: 'up' }
    };
    
    for (const [id, trend] of Object.entries(trends)) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<i class="fas fa-arrow-${trend.class === 'up' ? 'up' : 'down'}"></i> ${trend.value}`;
            el.className = `analytics-trend ${trend.class}`;
        }
    }
}

function setupChartControls() {
    const chartButtons = document.querySelectorAll('.chart-btn');
    let currentPeriod = '7d';
    
    chartButtons.forEach(btn => {
        btn.onclick = async () => {
            chartButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            await refreshAnalyticsChart(currentPeriod);
        };
    });
}

async function refreshAnalyticsChart(period) {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Fetch data for selected period
    const { data: views } = await window.supabaseClient
        .from('content_views')
        .select('created_at')
        .eq('profile_id', user.id);
    
    let filteredViews = views || [];
    if (period === '7d') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filteredViews = views?.filter(v => new Date(v.created_at) >= sevenDaysAgo) || [];
    } else if (period === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filteredViews = views?.filter(v => new Date(v.created_at) >= thirtyDaysAgo) || [];
    }
    
    const chartData = getDailyViewsData(filteredViews);
    updateAnalyticsChart(chartData);
}

function renderAnalyticsChart(data) {
    const canvas = document.getElementById('analytics-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (window.platformComponents.analyticsChart) {
        window.platformComponents.analyticsChart.destroy();
    }
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }
    
    window.platformComponents.analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Views',
                data: data.map(d => d.views),
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#F59E0B',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#F8FAFC' }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#94A3B8'
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94A3B8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94A3B8' }
                }
            }
        }
    });
}

function updateAnalyticsChart(data) {
    if (window.platformComponents.analyticsChart) {
        window.platformComponents.analyticsChart.data.labels = data.map(d => d.date);
        window.platformComponents.analyticsChart.data.datasets[0].data = data.map(d => d.views);
        window.platformComponents.analyticsChart.update();
    }
}

function showNoAnalyticsData() {
    const statsGrid = document.querySelector('.analytics-stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = '<div class="empty-state" style="grid-column: span 4;"><i class="fas fa-chart-line"></i><p>No analytics data yet. Start creating content to see your stats!</p></div>';
    }
}

// ============================================ */
// 3. COMPLETE NOTIFICATIONS FUNCTIONALITY */
// ============================================ */

function setupNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const panel = document.getElementById('notifications-panel');
    const closeBtn = document.getElementById('close-notifications');
    const markAllReadBtn = document.getElementById('mark-all-read');
    const settingsBtn = document.getElementById('notification-settings');
    
    if (!notificationsBtn || !panel) return;
    
    notificationsBtn.onclick = () => {
        panel.classList.add('active');
        loadCompleteNotifications();
    };
    
    if (closeBtn) {
        closeBtn.onclick = () => panel.classList.remove('active');
    }
    
    if (markAllReadBtn) {
        markAllReadBtn.onclick = () => markAllNotificationsAsRead();
    }
    
    if (settingsBtn) {
        settingsBtn.onclick = () => openNotificationSettings();
    }
    
    // Setup realtime subscription
    setupRealtimeNotifications();
}

async function loadCompleteNotifications() {
    const user = await getCurrentUser();
    const notificationsList = document.getElementById('notifications-list');
    
    if (!notificationsList) return;
    
    if (!user || !user.id) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>Sign in to see notifications</p>
                <button class="text-btn" onclick="window.location.href='login.html'">Sign In</button>
            </div>
        `;
        return;
    }
    
    try {
        const { data: notifications, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        window.platformComponents.notifications = notifications || [];
        renderNotificationsList(window.platformComponents.notifications);
        
        const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading notifications</p>
                <button class="text-btn" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

function renderNotificationsList(notifications) {
    const notificationsList = document.getElementById('notifications-list');
    
    if (!notifications || notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
                <p style="font-size: 12px;">When you get notifications, they'll appear here</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? 'read' : 'unread'}" data-id="${notification.id}">
            <div class="notification-icon">
                <i class="fas ${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${escapeHtml(notification.title)}</h4>
                <p>${escapeHtml(notification.message)}</p>
                <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
            </div>
            <div class="notification-actions">
                ${!notification.is_read ? `<button class="notification-action-btn mark-read" data-id="${notification.id}">Mark Read</button>` : ''}
                <button class="notification-action-btn delete" data-id="${notification.id}">Delete</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to notification actions
    document.querySelectorAll('.mark-read').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            markNotificationAsRead(btn.dataset.id);
        };
    });
    
    document.querySelectorAll('.delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            deleteNotification(btn.dataset.id);
        };
    });
    
    // Make notification items clickable
    document.querySelectorAll('.notification-item').forEach(item => {
        item.onclick = () => {
            const id = item.dataset.id;
            const notification = notifications.find(n => n.id === id);
            if (notification && !notification.is_read) {
                markNotificationAsRead(id);
            }
            if (notification?.action_url) {
                window.location.href = notification.action_url;
            }
        };
    });
}

async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
        
        if (error) throw error;
        
        // Update local state
        const notification = window.platformComponents.notifications.find(n => n.id === notificationId);
        if (notification) notification.is_read = true;
        
        // Re-render
        renderNotificationsList(window.platformComponents.notifications);
        
        // Update badge
        const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    const user = await getCurrentUser();
    if (!user) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        // Update local state
        window.platformComponents.notifications.forEach(n => n.is_read = true);
        renderNotificationsList(window.platformComponents.notifications);
        updateNotificationBadge(0);
        
        showToast('All notifications marked as read', 'success');
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Error marking notifications as read', 'error');
    }
}

async function deleteNotification(notificationId) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .delete()
            .eq('id', notificationId);
        
        if (error) throw error;
        
        // Remove from local state
        window.platformComponents.notifications = window.platformComponents.notifications.filter(n => n.id !== notificationId);
        renderNotificationsList(window.platformComponents.notifications);
        
        showToast('Notification deleted', 'success');
        
    } catch (error) {
        console.error('Error deleting notification:', error);
        showToast('Error deleting notification', 'error');
    }
}

function setupRealtimeNotifications() {
    if (!window.supabaseClient) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    const subscription = window.supabaseClient
        .channel('notifications-channel')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            // Add new notification to list
            const newNotification = payload.new;
            window.platformComponents.notifications.unshift(newNotification);
            renderNotificationsList(window.platformComponents.notifications);
            
            // Update badge
            const unreadCount = window.platformComponents.notifications.filter(n => !n.is_read).length;
            updateNotificationBadge(unreadCount);
            
            // Show toast for new notification
            showToast(newNotification.title, 'info');
        })
        .subscribe();
}

function openNotificationSettings() {
    // Navigate to notification settings page
    window.location.href = 'notification-settings.html';
}

function getNotificationIcon(type) {
    const icons = {
        like: 'fa-heart',
        comment: 'fa-comment',
        follow: 'fa-user-plus',
        view_milestone: 'fa-trophy',
        achievement: 'fa-medal',
        system: 'fa-bell',
        warning: 'fa-exclamation-triangle',
        success: 'fa-check-circle'
    };
    return icons[type] || 'fa-bell';
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-count');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================ */
// 4. COMPLETE VOICE SEARCH FUNCTIONALITY */
// ============================================ */

function setupVoiceSearch() {
    const voiceBtn = document.getElementById('voice-search-btn');
    const modalVoiceBtn = document.getElementById('voice-search-modal-btn');
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported');
        if (voiceBtn) voiceBtn.style.display = 'none';
        return;
    }
    
    // Initialize recognition
    window.platformComponents.voiceRecognition = new SpeechRecognition();
    const recognition = window.platformComponents.voiceRecognition;
    
    recognition.lang = 'en-ZA'; // South African English
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    let voiceStatusDiv = document.getElementById('voice-search-status');
    if (!voiceStatusDiv) {
        voiceStatusDiv = createVoiceStatusElement();
    }
    
    const startVoiceSearch = async () => {
        // Check microphone permission
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            showMicrophonePermissionPrompt();
            return;
        }
        
        const user = await getCurrentUser();
        if (!user || !user.id) {
            showToast('Please sign in to use voice search', 'warning');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        
        try {
            recognition.start();
            showVoiceStatus('Listening...', true);
            
            // Auto-stop after 5 seconds if no speech
            setTimeout(() => {
                if (recognition) {
                    try { recognition.stop(); } catch(e) {}
                }
            }, 5000);
            
        } catch (error) {
            console.error('Voice recognition error:', error);
            showToast('Error starting voice search', 'error');
            hideVoiceStatus();
        }
    };
    
    recognition.onstart = () => {
        console.log('Voice recognition started');
        showVoiceStatus('Listening... Speak now', true);
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const isFinal = event.results[0].isFinal;
        
        if (isFinal) {
            showVoiceStatus(`Searching: "${transcript}"`, false);
            
            // Fill search input and trigger search
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = transcript;
                performSearch(transcript, '', 'newest');
                
                // Open search modal if not open
                const searchModal = document.getElementById('search-modal');
                if (searchModal && !searchModal.classList.contains('active')) {
                    searchModal.classList.add('active');
                }
            }
            
            setTimeout(() => hideVoiceStatus(), 1500);
        } else {
            showVoiceStatus(transcript, true);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        let errorMessage = 'Voice search error';
        
        switch(event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not found';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied';
                break;
            case 'network':
                errorMessage = 'Network error';
                break;
        }
        
        showToast(errorMessage, 'warning');
        hideVoiceStatus();
    };
    
    recognition.onend = () => {
        console.log('Voice recognition ended');
        setTimeout(() => hideVoiceStatus(), 500);
    };
    
    if (voiceBtn) {
        voiceBtn.onclick = startVoiceSearch;
    }
    
    if (modalVoiceBtn) {
        modalVoiceBtn.onclick = startVoiceSearch;
    }
}

function createVoiceStatusElement() {
    const div = document.createElement('div');
    div.id = 'voice-search-status';
    div.className = 'voice-search-status';
    div.innerHTML = `
        <i class="fas fa-microphone-alt"></i>
        <span id="voice-status-text">Listening...</span>
        <button class="voice-search-cancel" id="voice-search-cancel">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(div);
    
    const cancelBtn = document.getElementById('voice-search-cancel');
    if (cancelBtn && window.platformComponents.voiceRecognition) {
        cancelBtn.onclick = () => {
            window.platformComponents.voiceRecognition.stop();
            hideVoiceStatus();
        };
    }
    
    return div;
}

function showVoiceStatus(message, isActive) {
    const statusDiv = document.getElementById('voice-search-status');
    const statusText = document.getElementById('voice-status-text');
    
    if (statusDiv && statusText) {
        statusText.textContent = message;
        statusDiv.classList.add('active');
        if (isActive) {
            statusDiv.style.animation = 'voicePulse 1.5s infinite';
        }
    }
}

function hideVoiceStatus() {
    const statusDiv = document.getElementById('voice-search-status');
    if (statusDiv) {
        statusDiv.classList.remove('active');
        statusDiv.style.animation = '';
    }
}

function showMicrophonePermissionPrompt() {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'voice-permission-prompt';
    promptDiv.innerHTML = `
        <i class="fas fa-microphone-alt"></i>
        <p>Voice search needs microphone access</p>
        <button id="voice-permission-allow">Allow</button>
        <button id="voice-permission-dismiss">Dismiss</button>
    `;
    document.body.appendChild(promptDiv);
    
    document.getElementById('voice-permission-allow')?.addEventListener('click', async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            showToast('Microphone access granted', 'success');
            promptDiv.remove();
        } catch (err) {
            showToast('Microphone access denied', 'error');
            promptDiv.remove();
        }
    });
    
    document.getElementById('voice-permission-dismiss')?.addEventListener('click', () => {
        promptDiv.remove();
    });
    
    setTimeout(() => {
        if (promptDiv.parentNode) promptDiv.remove();
    }, 10000);
}

// ============================================ */
// 5. PROFILE DROPDOWN (FIXED: No redirect, toggles dropdown) */
// ============================================ */

function setupProfileDropdown() {
    const profileBtn = document.getElementById('current-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    
    if (profileBtn && dropdown) {
        // Remove any existing click listeners by cloning
        const newProfileBtn = profileBtn.cloneNode(true);
        profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
        
        // FIX: This toggles the dropdown, does NOT redirect
        newProfileBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!newProfileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }
    
    if (manageProfilesBtn) {
        manageProfilesBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = 'manage-profiles.html';
        };
    }
}

// ============================================ */
// PROFILE MANAGEMENT FUNCTIONS */
// ============================================ */

async function createNewProfile(profileData) {
    const user = await getCurrentUser();
    if (!user) {
        showToast('Please sign in first', 'warning');
        return false;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .insert({
                user_id: user.id,
                name: profileData.name,
                avatar_url: profileData.avatar_url || null,
                is_child: profileData.is_child || false,
                pin_code: profileData.pin_code || null,
                settings: profileData.settings || {}
            })
            .select()
            .single();
        
        if (error) throw error;
        
        showToast(`Profile "${profileData.name}" created successfully`, 'success');
        await updateProfileDropdown();
        return data;
        
    } catch (error) {
        console.error('Error creating profile:', error);
        showToast('Error creating profile', 'error');
        return false;
    }
}

async function updateProfileAvatar(profileId, avatarFile) {
    if (!avatarFile) return false;
    
    try {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profileId}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await window.supabaseClient.storage
            .from('avatars')
            .upload(filePath, avatarFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        const { error: updateError } = await window.supabaseClient
            .from('user_profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', profileId);
        
        if (updateError) throw updateError;
        
        showToast('Avatar updated successfully', 'success');
        await updateHeaderProfile();
        await updateSidebarProfile();
        return publicUrl;
        
    } catch (error) {
        console.error('Error updating avatar:', error);
        showToast('Error updating avatar', 'error');
        return false;
    }
}

async function deleteProfile(profileId) {
    const confirmed = confirm('Are you sure you want to delete this profile? This action cannot be undone.');
    if (!confirmed) return false;
    
    try {
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .delete()
            .eq('id', profileId);
        
        if (error) throw error;
        
        showToast('Profile deleted successfully', 'success');
        await updateProfileDropdown();
        return true;
        
    } catch (error) {
        console.error('Error deleting profile:', error);
        showToast('Error deleting profile', 'error');
        return false;
    }
}

async function switchProfile(profileId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', profileId)
            .eq('user_id', user.id)
            .single();
        
        if (error) throw error;
        
        window.platformComponents.currentProfile = profile;
        localStorage.setItem('currentProfileId', profileId);
        
        await updateHeaderProfile();
        await updateSidebarProfile();
        
        showToast(`Switched to ${profile.name}`, 'success');
        
        // Reload page content if needed
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            location.reload();
        }
        
    } catch (error) {
        console.error('Error switching profile:', error);
        showToast('Error switching profile', 'error');
    }
}

// ============================================ */
// SETUP BOTTOM NAVIGATION */
// ============================================ */
function setupBottomNavigation() {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');
    const navCreateBtn = document.getElementById('nav-create-btn');
    const navMenuBtn = document.getElementById('nav-menu-btn');
    
    if (navHomeBtn) {
        navHomeBtn.onclick = () => {
            window.location.href = 'index.html';
        };
    }
    
    if (navHistoryBtn) {
        navHistoryBtn.onclick = async () => {
            const user = await getCurrentUser();
            if (user && user.id) {
                window.location.href = 'watch-history.html';
            } else {
                showToast('Please sign in to view watch history', 'warning');
                window.location.href = `login.html?redirect=${encodeURIComponent('watch-history.html')}`;
            }
        };
    }
    
    if (navCreateBtn) {
        navCreateBtn.onclick = async () => {
            const user = await getCurrentUser();
            if (user && user.id) {
                window.location.href = 'creator-upload.html';
            } else {
                showToast('Please sign in to create content', 'warning');
                window.location.href = `login.html?redirect=${encodeURIComponent('creator-upload.html')}`;
            }
        };
    }
    
    if (navMenuBtn) {
        navMenuBtn.onclick = () => {
            const sidebar = document.getElementById('sidebar-menu');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar && overlay) {
                sidebar.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        };
    }
}

// ============================================ */
// SETUP SIDEBAR TOGGLES */
// ============================================ */
function setupSidebarToggles() {
    document.querySelectorAll('.sidebar-section-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = newHeader.closest('.sidebar-section');
            const items = section.querySelector('.sidebar-section-items');
            const icon = newHeader.querySelector('.toggle-icon');
            
            if (items.classList.contains('collapsed')) {
                items.classList.remove('collapsed');
                newHeader.classList.remove('collapsed');
                if (icon) icon.style.transform = 'rotate(0deg)';
            } else {
                items.classList.add('collapsed');
                newHeader.classList.add('collapsed');
                if (icon) icon.style.transform = 'rotate(-90deg)';
            }
        });
    });
}

// ============================================ */
// SETUP SIDEBAR CLOSE */
// ============================================ */
function setupSidebarClose() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');
    
    if (menuToggle) {
        const newToggle = menuToggle.cloneNode(true);
        menuToggle.parentNode.replaceChild(newToggle, menuToggle);
        newToggle.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        };
    }
    
    if (sidebarClose) {
        sidebarClose.onclick = () => {
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        };
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.onclick = () => {
            if (sidebarMenu && sidebarOverlay) {
                sidebarMenu.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        };
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu?.classList.contains('active')) {
            sidebarMenu.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ============================================ */
// SETUP LOGOUT */
// ============================================ */
function setupLogout() {
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (window.AuthHelper && typeof window.AuthHelper.logout === 'function') {
                await window.AuthHelper.logout();
            } else if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        };
    }
}

// ============================================ */
// UI SCALE CONTROLLER */
// ============================================ */
class UIScaleController {
    constructor() {
        this.scale = parseFloat(localStorage.getItem('bantu_ui_scale')) || 1;
        this.minScale = 0.8;
        this.maxScale = 1.4;
        this.step = 0.1;
    }

    init() {
        this.applyScale();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('scaleChanged', (e) => {
            this.updateScaleDisplay(e.detail.scale);
        });
    }

    applyScale() {
        document.documentElement.style.setProperty('--ui-scale', this.scale);
        localStorage.setItem('bantu_ui_scale', this.scale.toString());
        document.dispatchEvent(new CustomEvent('scaleChanged', {
            detail: { scale: this.scale }
        }));
    }

    increase() {
        if (this.scale < this.maxScale) {
            this.scale = Math.min(this.maxScale, this.scale + this.step);
            this.applyScale();
            this.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    decrease() {
        if (this.scale > this.minScale) {
            this.scale = Math.max(this.minScale, this.scale - this.step);
            this.applyScale();
            this.showToast(`UI Size: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    reset() {
        this.scale = 1;
        this.applyScale();
        this.showToast('UI Size reset to default', 'success');
    }

    getScale() {
        return this.scale;
    }

    updateScaleDisplay(scale) {
        const displays = document.querySelectorAll('.scale-value, #sidebar-scale-value');
        displays.forEach(el => {
            if (el) el.textContent = Math.round(scale * 100) + '%';
        });
    }

    showToast(message, type) {
        if (window.showToast) window.showToast(message, type);
    }
}

// ============================================ */
// SETUP SIDEBAR SCALE CONTROLS */
// ============================================ */
function setupSidebarScaleControls() {
    const decreaseBtn = document.getElementById('sidebar-scale-decrease');
    const increaseBtn = document.getElementById('sidebar-scale-increase');
    const resetBtn = document.getElementById('sidebar-scale-reset');
    const scaleValue = document.getElementById('sidebar-scale-value');
    
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    const updateDisplay = () => {
        if (scaleValue) {
            scaleValue.textContent = Math.round(window.uiScaleController.getScale() * 100) + '%';
        }
    };
    
    if (decreaseBtn) {
        decreaseBtn.onclick = () => {
            window.uiScaleController.decrease();
            updateDisplay();
        };
    }
    if (increaseBtn) {
        increaseBtn.onclick = () => {
            window.uiScaleController.increase();
            updateDisplay();
        };
    }
    if (resetBtn) {
        resetBtn.onclick = () => {
            window.uiScaleController.reset();
            updateDisplay();
        };
    }
    
    updateDisplay();
    document.addEventListener('scaleChanged', updateDisplay);
}

// ============================================ */
// THEME MANAGEMENT */
// ============================================ */
function initThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    const themeToggle = document.getElementById('sidebar-theme-toggle');
    
    if (!themeSelector || !themeToggle) return;
    
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeSelector.classList.remove('active');
        };
    });
    
    themeToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        themeSelector.classList.toggle('active');
    };
    
    document.addEventListener('click', (e) => {
        if (themeSelector.classList.contains('active') &&
            !themeSelector.contains(e.target) &&
            !themeToggle.contains(e.target)) {
            themeSelector.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    if (!theme || (theme !== 'dark' && theme !== 'light' && theme !== 'high-contrast')) {
        theme = 'dark';
    }
    
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);
    
    localStorage.setItem('bantu_theme', theme);
    
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.toggle('active', option.dataset.theme === theme);
    });
    
    if (window.showToast) {
        window.showToast(`Theme changed to ${theme}`, 'success');
    }
}

// ============================================ */
// BACK TO TOP BUTTON */
// ============================================ */
function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (!backToTopBtn) return;
    
    backToTopBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
}

// ============================================ */
// MOBILE HEADER STYLES */
// ============================================ */
function applyMobileHeaderStyles() {
    const isMobile = window.innerWidth <= 768;
    const profilePlaceholder = document.getElementById('userProfilePlaceholder');
    const profileNameSpan = document.getElementById('current-profile-name');
    const profileBtn = document.querySelector('.profile-btn');
    
    if (isMobile) {
        if (profilePlaceholder) profilePlaceholder.style.display = 'none';
        if (profileBtn) {
            profileBtn.style.minWidth = 'auto';
            profileBtn.style.padding = '0.3125rem 0.75rem';
        }
        if (profileNameSpan) profileNameSpan.style.display = 'inline-block';
    } else {
        if (profilePlaceholder) profilePlaceholder.style.display = 'flex';
        if (profileBtn) {
            profileBtn.style.minWidth = '160px';
            profileBtn.style.padding = '0.3125rem 1.2rem 0.3125rem 0.5rem';
        }
    }
}

// ============================================ */
// TOAST NOTIFICATION SYSTEM */
// ============================================ */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    switch(type) {
        case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
        default: icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================ */
// UTILITY FUNCTIONS */
// ============================================ */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(timestamp) {
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
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function fixMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://ydnxqnbjoshvxteevemc.supabase.co/storage/v1/object/public/content/${url.replace(/^\/+/, '')}`;
}

// ============================================ */
// LISTEN FOR AUTH STATE CHANGES */
// ============================================ */
function setupAuthListener() {
    // Listen for auth state changes from Supabase
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            // Refresh all profile displays
            await updateHeaderProfile();
            await updateSidebarProfile();
            await updateProfileDropdown();
            
            if (event === 'SIGNED_IN') {
                showToast('Welcome back!', 'success');
                await loadCompleteNotifications();
            } else if (event === 'SIGNED_OUT') {
                showToast('Signed out', 'info');
            }
        });
    }
    
    // Also listen for custom auth ready event
    document.addEventListener('authReady', async () => {
        await updateHeaderProfile();
        await updateSidebarProfile();
        await updateProfileDropdown();
        await loadCompleteNotifications();
    });
}

// ============================================ */
// MAKE HEADER BUTTONS CLICKABLE */
// ============================================ */
function setupHeaderButtons() {
    // All buttons are set up in their respective functions:
    // - Voice search: setupVoiceSearch
    // - Analytics: setupAnalytics
    // - Search: setupSearchModal
    // - Notifications: setupNotifications
    // - Profile: setupProfileDropdown
}

// ============================================ */
// MAIN INITIALIZATION */
// ============================================ */
async function initSharedComponents() {
    if (window.platformComponents.initialized) {
        console.log('⚠️ Shared components already initialized');
        return;
    }
    
    console.log('🚀 Initializing shared components with complete features...');
    
    // Setup all components
    setupHeaderButtons();
    setupSearchModal();        // COMPLETE with thumbnail fix
    setupAnalytics();          // COMPLETE with full metrics
    setupNotifications();      // COMPLETE
    setupVoiceSearch();        // COMPLETE
    setupBottomNavigation();
    setupSidebarClose();
    setupSidebarToggles();
    setupSidebarScaleControls();
    setupBackToTop();
    setupProfileDropdown();    // FIXED - no redirect, toggles dropdown
    setupLogout();
    setupAuthListener();
    initThemeSelector();
    
    // Update profiles with user data
    await updateHeaderProfile();
    await updateSidebarProfile();
    await updateProfileDropdown();
    
    // Apply mobile styles
    applyMobileHeaderStyles();
    window.addEventListener('resize', applyMobileHeaderStyles);
    
    // Setup UI Scale Controller
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    // Make functions globally available
    window.showToast = showToast;
    window.getCurrentUser = getCurrentUser;
    window.updateHeaderProfile = updateHeaderProfile;
    window.updateSidebarProfile = updateSidebarProfile;
    window.performSearch = performSearch;
    window.switchProfile = switchProfile;
    window.createNewProfile = createNewProfile;
    window.markNotificationAsRead = markNotificationAsRead;
    
    window.platformComponents.initialized = true;
    console.log('✅ Shared components initialized successfully with all features');
}

// ============================================ */
// AUTO-INITIALIZE WHEN DOM READY */
// ============================================ */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedComponents);
} else {
    initSharedComponents();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSharedComponents,
        showToast,
        getCurrentUser,
        updateHeaderProfile,
        updateSidebarProfile,
        performSearch,
        switchProfile,
        createNewProfile,
        markNotificationAsRead,
        UIScaleController
    };
}
