// ============================================
// MANAGE PROFILES FEATURES - Clean Version
// ============================================

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesFeatures() {
    console.log('🎯 Initializing Manage Profiles Features');
    
    setupSearch();
    setupNotifications();
    setupAnalytics();
    setupVoiceSearch();
    setupWatchParty();
    setupTipSystem();
    setupBadges();
}

// ============================================
// SETUP SEARCH
// ============================================
function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const languageFilter = document.getElementById('language-filter');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', openSearch);
    }
    
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            document.getElementById('search-modal')?.classList.remove('active');
        });
    }
    
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
// OPEN SEARCH
// ============================================
function openSearch() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    
    if (searchModal) {
        searchModal.classList.add('active');
        setTimeout(() => searchInput?.focus(), 100);
    }
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
                        ? `<img src="${contentSupabase.fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;">`
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
// SETUP NOTIFICATIONS
// ============================================
function setupNotifications() {
    const notificationsBtn = document.getElementById('notifications-btn');
    const closeNotifications = document.getElementById('close-notifications');
    const markAllRead = document.getElementById('mark-all-read');
    
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', toggleNotifications);
    }
    
    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            document.getElementById('notifications-panel')?.classList.remove('active');
        });
    }
    
    if (markAllRead) {
        markAllRead.addEventListener('click', markAllNotificationsRead);
    }
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================
function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    
    if (!window.notifications || window.notifications.length === 0) {
        list.innerHTML = `
            <div class="empty-state-small">
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
        updateNotificationBadge(unreadCount);
        
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
            showToast('No unread notifications', 'info');
            return;
        }
        
        const { error } = await supabaseAuth
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
        
        if (error) throw error;
        
        window.notifications.forEach(n => n.is_read = true);
        updateNotificationBadge(0);
        renderNotifications();
        
        showToast('All notifications marked as read', 'success');
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark notifications as read', 'error');
    }
}

// ============================================
// SETUP ANALYTICS
// ============================================
function setupAnalytics() {
    const analyticsBtn = document.getElementById('analytics-btn');
    const closeAnalytics = document.getElementById('close-analytics');
    
    if (analyticsBtn) {
        analyticsBtn.addEventListener('click', openAnalytics);
    }
    
    if (closeAnalytics) {
        closeAnalytics.addEventListener('click', () => {
            document.getElementById('analytics-modal')?.classList.remove('active');
        });
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
                    labels: { color: '#F5F5F5' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#A0A0A0' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#A0A0A0' }
                }
            }
        }
    });
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
            performSearch(transcript);
        }
        
        if (status) {
            status.classList.remove('active');
        }
        
        showToast(`"${transcript}"`, 'info');
    };
    
    recognition.onerror = (event) => {
        const status = document.getElementById('voice-search-status');
        if (status) {
            status.classList.remove('active');
        }
        showToast('Voice search failed: ' + event.error, 'error');
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
// SETUP WATCH PARTY
// ============================================
function setupWatchParty() {
    const watchPartyBtn = document.getElementById('sidebar-watch-party');
    const closeWatchParty = document.getElementById('close-watch-party');
    const startParty = document.getElementById('start-watch-party');
    const searchInput = document.getElementById('watch-party-search');
    
    if (watchPartyBtn) {
        watchPartyBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to start a watch party', 'warning');
                return;
            }
            document.getElementById('watch-party-modal')?.classList.add('active');
            loadWatchPartyContent();
        });
    }
    
    if (closeWatchParty) {
        closeWatchParty.addEventListener('click', () => {
            document.getElementById('watch-party-modal')?.classList.remove('active');
        });
    }
    
    if (startParty) {
        startParty.addEventListener('click', startWatchParty);
    }
    
    if (searchInput) {
        let debounceTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                loadWatchPartyContent(e.target.value);
            }, 300);
        });
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
        showToast('Please select content to watch', 'warning');
        return;
    }
    
    const contentId = selected.dataset.id;
    const syncPlayback = document.getElementById('party-sync-playback')?.checked;
    const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
    
    const partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    showToast(`Watch party created! Code: ${partyCode}`, 'success');
    
    document.getElementById('watch-party-modal')?.classList.remove('active');
    
    setTimeout(() => {
        window.location.href = `watch.html?id=${contentId}&party=${partyCode}&sync=${syncPlayback}&chat=${chatEnabled}`;
    }, 1500);
}

// ============================================
// SETUP TIP SYSTEM
// ============================================
function setupTipSystem() {
    const closeTip = document.getElementById('close-tip');
    const sendTip = document.getElementById('send-tip');
    
    if (closeTip) {
        closeTip.addEventListener('click', () => {
            document.getElementById('tip-modal')?.classList.remove('active');
        });
    }
    
    if (sendTip) {
        sendTip.addEventListener('click', sendTipToCreator);
    }
    
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
        showToast('Please sign in to send tips', 'warning');
        return;
    }
    
    const selectedAmount = document.querySelector('.tip-option.selected');
    if (!selectedAmount) {
        showToast('Please select an amount', 'warning');
        return;
    }
    
    const amount = selectedAmount.dataset.amount;
    
    showToast(`Thank you for your tip of R${amount}!`, 'success');
    
    document.getElementById('tip-modal')?.classList.remove('active');
}

// ============================================
// SETUP BADGES
// ============================================
function setupBadges() {
    const badgesBtn = document.getElementById('sidebar-badges');
    const closeBadges = document.getElementById('close-badges');
    
    if (badgesBtn) {
        badgesBtn.addEventListener('click', () => {
            if (!window.currentUser) {
                showToast('Please sign in to view badges', 'warning');
                return;
            }
            document.getElementById('badges-modal')?.classList.add('active');
            loadUserBadges();
        });
    }
    
    if (closeBadges) {
        closeBadges.addEventListener('click', () => {
            document.getElementById('badges-modal')?.classList.remove('active');
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
        { id: 3, name: 'Super Fan', description: 'Watched 100 hours', icon: 'fa-heart', earned: false }
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

// Export functions
window.initializeManageProfilesFeatures = initializeManageProfilesFeatures;
window.renderNotifications = renderNotifications;
window.loadPersonalAnalytics = loadPersonalAnalytics;
window.loadWatchPartyContent = loadWatchPartyContent;
window.loadUserBadges = loadUserBadges;
