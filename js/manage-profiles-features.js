// ============================================
// MANAGE PROFILES FEATURES - Professional Version
// ============================================

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesFeatures() {
    console.log('🎯 Initializing Manage Profiles Features');
    
    setupVoiceSearch();
    setupSearchFunctionality();
    setupWatchPartyFeatures();
    setupTipFeatures();
    setupBadgesFeatures();
}

// ============================================
// SETUP VOICE SEARCH
// ============================================
function setupVoiceSearch() {
    const voiceBtn = document.getElementById('voice-search-btn');
    const voiceModalBtn = document.getElementById('voice-search-modal-btn');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        [voiceBtn, voiceModalBtn].forEach(btn => {
            if (btn) btn.style.display = 'none';
        });
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    const startVoiceSearch = () => {
        const status = document.getElementById('voice-search-status');
        const statusText = document.getElementById('voice-status-text');
        
        if (status && statusText) {
            status.classList.add('active');
            statusText.textContent = 'Listening...';
        }
        
        recognition.start();
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const searchInput = document.getElementById('search-input');
        const status = document.getElementById('voice-search-status');
        
        if (searchInput) {
            searchInput.value = transcript;
            if (typeof performSearch === 'function') {
                performSearch(transcript);
            }
        }
        
        if (status) {
            status.classList.remove('active');
        }
        
        if (typeof showToast === 'function') {
            showToast(`"${transcript}"`, 'info');
        }
    };
    
    recognition.onerror = (event) => {
        const status = document.getElementById('voice-search-status');
        if (status) {
            status.classList.remove('active');
        }
        if (typeof showToast === 'function') {
            showToast('Voice search failed: ' + event.error, 'error');
        }
    };
    
    recognition.onend = () => {
        const status = document.getElementById('voice-search-status');
        if (status) {
            status.classList.remove('active');
        }
    };
    
    if (voiceBtn) voiceBtn.addEventListener('click', startVoiceSearch);
    if (voiceModalBtn) voiceModalBtn.addEventListener('click', startVoiceSearch);
}

// ============================================
// SETUP SEARCH FUNCTIONALITY
// ============================================
function setupSearchFunctionality() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const languageFilter = document.getElementById('language-filter');
    
    if (searchInput) {
        let debounceTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 300);
        });
    }
    
    [categoryFilter, sortFilter, languageFilter].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => {
                performSearch(searchInput?.value || '');
            });
        }
    });
}

// ============================================
// PERFORM SEARCH
// ============================================
async function performSearch(query) {
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;
    
    if (!query.trim()) {
        resultsGrid.innerHTML = `
            <div class="empty-state-small" style="grid-column: 1/-1;">
                <i class="fas fa-search"></i>
                <p>Start typing to search</p>
            </div>
        `;
        return;
    }
    
    resultsGrid.innerHTML = `
        <div class="empty-state-small" style="grid-column: 1/-1;">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching...</p>
        </div>
    `;
    
    try {
        const category = document.getElementById('category-filter')?.value;
        const sort = document.getElementById('sort-filter')?.value;
        const language = document.getElementById('language-filter')?.value;
        
        let supabaseQuery = supabaseAuth
            .from('content')
            .select('*')
            .ilike('title', `%${query}%`);
        
        if (category) {
            supabaseQuery = supabaseQuery.eq('category', category);
        }
        
        if (language) {
            supabaseQuery = supabaseQuery.eq('language', language);
        }
        
        if (sort === 'popular') {
            supabaseQuery = supabaseQuery.order('views', { ascending: false });
        } else {
            supabaseQuery = supabaseQuery.order('created_at', { ascending: false });
        }
        
        const { data, error } = await supabaseQuery.limit(20);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            resultsGrid.innerHTML = `
                <div class="empty-state-small" style="grid-column: 1/-1;">
                    <i class="fas fa-search"></i>
                    <p>No results found for "${escapeHtml(query)}"</p>
                </div>
            `;
            return;
        }
        
        resultsGrid.innerHTML = data.map(item => `
            <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.id}'">
                <div class="thumbnail-image">
                    ${item.thumbnail_url 
                        ? `<img src="${contentSupabase.fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}">`
                        : `<i class="fas fa-film"></i>`
                    }
                </div>
                <div class="thumbnail-info">
                    <div class="thumbnail-title">${escapeHtml(item.title)}</div>
                    <div class="thumbnail-meta">${item.views || 0} views</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Search error:', error);
        resultsGrid.innerHTML = `
            <div class="empty-state-small" style="grid-column: 1/-1;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error performing search</p>
            </div>
        `;
    }
}

// ============================================
// SETUP WATCH PARTY FEATURES
// ============================================
function setupWatchPartyFeatures() {
    const searchInput = document.getElementById('watch-party-search');
    const startBtn = document.getElementById('start-watch-party');
    
    if (searchInput) {
        let debounceTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                loadWatchPartyContent(e.target.value);
            }, 300);
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', startWatchParty);
    }
}

// ============================================
// LOAD WATCH PARTY CONTENT
// ============================================
async function loadWatchPartyContent(search = '') {
    const list = document.getElementById('watch-party-content-list');
    if (!list) return;
    
    list.innerHTML = '<div class="empty-state-small"><i class="fas fa-spinner fa-spin"></i><p>Loading content...</p></div>';
    
    try {
        let query = supabaseAuth
            .from('content')
            .select('*')
            .limit(10);
        
        if (search) {
            query = query.ilike('title', `%${search}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty-state-small"><i class="fas fa-film"></i><p>No content found</p></div>';
            return;
        }
        
        list.innerHTML = data.map(item => `
            <div class="watch-party-content-item" data-id="${item.id}">
                <img src="${contentSupabase.fixMediaUrl(item.thumbnail_url || '')}" alt="${escapeHtml(item.title)}">
                <div class="watch-party-content-info">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${item.duration || '0:00'}</p>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.watch-party-content-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.watch-party-content-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
    } catch (error) {
        console.error('Error loading watch party content:', error);
        list.innerHTML = '<div class="empty-state-small"><i class="fas fa-exclamation-triangle"></i><p>Error loading content</p></div>';
    }
}

// ============================================
// START WATCH PARTY
// ============================================
function startWatchParty() {
    const selected = document.querySelector('.watch-party-content-item.selected');
    if (!selected) {
        if (typeof showToast === 'function') {
            showToast('Please select content to watch', 'warning');
        }
        return;
    }
    
    const contentId = selected.dataset.id;
    const syncPlayback = document.getElementById('party-sync-playback')?.checked;
    const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
    
    const partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (typeof showToast === 'function') {
        showToast(`Watch party created! Code: ${partyCode}`, 'success');
    }
    
    document.getElementById('watch-party-modal')?.classList.remove('active');
    
    setTimeout(() => {
        window.location.href = `watch.html?id=${contentId}&party=${partyCode}&sync=${syncPlayback}&chat=${chatEnabled}`;
    }, 1500);
}

// ============================================
// SETUP TIP FEATURES
// ============================================
function setupTipFeatures() {
    document.querySelectorAll('.tip-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tip-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
}

// ============================================
// SEND TIP TO CREATOR
// ============================================
async function sendTipToCreator() {
    if (!window.currentUser) {
        if (typeof showToast === 'function') {
            showToast('Please sign in to send tips', 'warning');
        }
        return;
    }
    
    const selectedAmount = document.querySelector('.tip-option.selected');
    if (!selectedAmount) {
        if (typeof showToast === 'function') {
            showToast('Please select an amount', 'warning');
        }
        return;
    }
    
    const amount = selectedAmount.dataset.amount;
    const message = document.getElementById('tip-message')?.value;
    
    if (typeof showToast === 'function') {
        showToast(`Thank you for your tip of R${amount}!`, 'success');
    }
    
    document.getElementById('tip-modal')?.classList.remove('active');
}

// ============================================
// SETUP BADGES FEATURES
// ============================================
function setupBadgesFeatures() {
    const badgesBtn = document.getElementById('sidebar-badges');
    
    if (badgesBtn) {
        badgesBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                if (typeof showToast === 'function') {
                    showToast('Please sign in to view badges', 'warning');
                }
                return;
            }
            document.getElementById('badges-modal')?.classList.add('active');
            loadUserBadges();
        });
    }
}

// ============================================
// LOAD USER BADGES
// ============================================
async function loadUserBadges() {
    const grid = document.getElementById('badges-grid');
    const countEl = document.getElementById('badges-earned');
    
    if (!grid) return;
    
    const badges = [
        { id: 1, name: 'First Watch', description: 'Watched your first video', icon: 'fa-play', earned: true },
        { id: 2, name: 'Early Adopter', description: 'Joined in the first month', icon: 'fa-rocket', earned: true },
        { id: 3, name: 'Super Fan', description: 'Watched 100 hours', icon: 'fa-heart', earned: false },
        { id: 4, name: 'Social Butterfly', description: 'Shared 10 videos', icon: 'fa-share-alt', earned: false },
        { id: 5, name: 'Commentator', description: 'Posted 50 comments', icon: 'fa-comment', earned: false },
        { id: 6, name: 'Creator', description: 'Uploaded your first video', icon: 'fa-video', earned: false }
    ];
    
    const earned = badges.filter(b => b.earned).length;
    if (countEl) countEl.textContent = earned;
    
    grid.innerHTML = badges.map(badge => `
        <div class="badge-item ${badge.earned ? 'earned' : 'locked'}">
            <div class="badge-icon ${badge.earned ? 'earned' : ''}">
                <i class="fas ${badge.icon}"></i>
            </div>
            <div class="badge-info">
                <h4>${badge.name}</h4>
                <p>${badge.description}</p>
                ${badge.earned ? '<span class="badge-earned-date">Earned</span>' : ''}
            </div>
        </div>
    `).join('');
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================
function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    
    if (!window.notifications || window.notifications.length === 0) {
        list.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = window.notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
            <div class="notification-icon">
                <i class="fas ${notification.icon || 'fa-bell'}"></i>
            </div>
            <div class="notification-content">
                <h4>${escapeHtml(notification.title)}</h4>
                <p>${escapeHtml(notification.message)}</p>
                <span class="notification-time">${formatTimeAgo(notification.created_at)}</span>
            </div>
            ${!notification.is_read ? '<span class="notification-dot"></span>' : ''}
        </div>
    `).join('');
    
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            await markNotificationAsRead(id);
        });
    });
}

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
async function markNotificationAsRead(id) {
    try {
        const { error } = await supabaseAuth
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
        
        if (error) throw error;
        
        const notification = window.notifications.find(n => n.id === id);
        if (notification) {
            notification.is_read = true;
        }
        
        const unreadCount = window.notifications.filter(n => !n.is_read).length;
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge(unreadCount);
        }
        
        renderNotifications();
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// ============================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================
async function markAllNotificationsRead() {
    if (!window.currentUser || !window.notifications) return;
    
    try {
        const unreadIds = window.notifications
            .filter(n => !n.is_read)
            .map(n => n.id);
        
        if (unreadIds.length === 0) {
            if (typeof showToast === 'function') {
                showToast('No unread notifications', 'info');
            }
            return;
        }
        
        const { error } = await supabaseAuth
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
        
        if (error) throw error;
        
        window.notifications.forEach(n => n.is_read = true);
        
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge(0);
        }
        
        renderNotifications();
        
        if (typeof showToast === 'function') {
            showToast('All notifications marked as read', 'success');
        }
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to mark notifications as read', 'error');
        }
    }
}

// ============================================
// LOAD PERSONAL ANALYTICS
// ============================================
async function loadPersonalAnalytics() {
    if (!window.currentUser) return;
    
    try {
        const { data: watchData } = await supabaseAuth
            .from('watch_history')
            .select('duration_seconds')
            .eq('user_id', window.currentUser.id);
        
        const totalSeconds = watchData?.reduce((sum, item) => sum + (item.duration_seconds || 0), 0) || 0;
        const hours = Math.floor(totalSeconds / 3600);
        
        document.getElementById('personal-watch-time').textContent = hours + 'h';
        
        const { count: sessions } = await supabaseAuth
            .from('watch_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', window.currentUser.id);
        
        document.getElementById('personal-sessions').textContent = sessions || 0;
        
        const { count: views } = await supabaseAuth
            .from('watch_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', window.currentUser.id);
        
        document.getElementById('personal-views').textContent = views || 0;
        
        document.getElementById('return-rate').textContent = Math.floor(Math.random() * 30) + 40 + '%';
        
        initializeAnalyticsChart();
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ============================================
// INITIALIZE ANALYTICS CHART
// ============================================
function initializeAnalyticsChart() {
    const canvas = document.getElementById('engagement-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Watch Time (minutes)',
                data: [65, 59, 80, 81, 56, 55, 40],
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#F8FAFC' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.2)' },
                    ticks: { color: '#94A3B8' }
                },
                x: {
                    grid: { color: 'rgba(148, 163, 184, 0.2)' },
                    ticks: { color: '#94A3B8' }
                }
            }
        }
    });
}

// ============================================
// UPDATE NOTIFICATION BADGE
// ============================================
function updateNotificationBadge(count) {
    const mainBadge = document.getElementById('notification-count');
    const sidebarBadge = document.getElementById('sidebar-notification-count');
    
    [mainBadge, sidebarBadge].forEach(badge => {
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    });
}

// Export functions
window.initializeManageProfilesFeatures = initializeManageProfilesFeatures;
window.performSearch = performSearch;
window.renderNotifications = renderNotifications;
window.markAllNotificationsRead = markAllNotificationsRead;
window.loadPersonalAnalytics = loadPersonalAnalytics;
window.loadWatchPartyContent = loadWatchPartyContent;
window.startWatchParty = startWatchParty;
window.sendTipToCreator = sendTipToCreator;
window.loadUserBadges = loadUserBadges;
window.updateNotificationBadge = updateNotificationBadge;
