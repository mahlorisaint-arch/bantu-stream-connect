// ============================================
// MANAGE PROFILES FEATURES - Advanced Features
// ============================================

// ============================================
// INITIALIZATION
// ============================================
function initializeManageProfilesFeatures() {
    console.log('🎯 Initializing Manage Profiles Features');
    
    // Setup advanced features
    setupSearch();
    setupNotifications();
    setupAnalytics();
    setupVoiceSearch();
    setupWatchParty();
    setupTipSystem();
    setupBadges();
    setupProfileContentSections();
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
        
        // Build query
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
                    <div class="thumbnail-meta">${item.views || 0} views • ${item.duration || '0:00'}</div>
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
        
        // Update local state
        window.notifications.forEach(n => n.is_read = true);
        
        // Update UI
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
// SETUP VOICE SEARCH
// ============================================
function setupVoiceSearch() {
    const voiceBtn = document.getElementById('voice-search-btn');
    const voiceModalBtn = document.getElementById('voice-search-modal-btn');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        // Voice search not supported
        [voiceBtn, voiceModalBtn].forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
            }
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
    
    if (voiceBtn) {
        voiceBtn.addEventListener('click', startVoiceSearch);
    }
    
    if (voiceModalBtn) {
        voiceModalBtn.addEventListener('click', startVoiceSearch);
    }
}

// ============================================
// SETUP WATCH PARTY
// ============================================
function setupWatchParty() {
    const watchPartyBtn = document.getElementById('sidebar-watch-party');
    const closeWatchParty = document.getElementById('close-watch-party');
    const startParty = document.getElementById('start-watch-party');
    const searchInput = document.getElementById('watch-party-search');
    
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
            <div class="watch-party-item" data-id="${item.id}">
                <div class="watch-party-thumb">
                    ${item.thumbnail_url 
                        ? `<img src="${contentSupabase.fixMediaUrl(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<i class="fas fa-film"></i>`
                    }
                </div>
                <div class="watch-party-info">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${item.creator_name || 'Unknown'} • ${item.duration || '0:00'}</p>
                </div>
            </div>
        `).join('');
        
        // Add selection handler
        document.querySelectorAll('.watch-party-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.watch-party-item').forEach(i => i.classList.remove('selected'));
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
    const selected = document.querySelector('.watch-party-item.selected');
    if (!selected) {
        showToast('Please select content to watch', 'warning');
        return;
    }
    
    const contentId = selected.dataset.id;
    const syncPlayback = document.getElementById('party-sync-playback')?.checked;
    const chatEnabled = document.getElementById('party-chat-enabled')?.checked;
    
    // Generate party code
    const partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    showToast(`Watch party created! Code: ${partyCode}`, 'success');
    
    // Close modal
    document.getElementById('watch-party-modal')?.classList.remove('active');
    
    // Navigate to watch page with party params
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
    
    // Tip amount selection
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
    const message = document.getElementById('tip-message')?.value;
    
    // Here you would integrate with a payment processor
    showToast(`Thank you for your tip of R${amount}!`, 'success');
    
    // Close modal
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
    
    // Mock badges data
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
        <div class="badge-item ${badge.earned ? '' : 'locked'}">
            <div class="badge-icon">
                <i class="fas ${badge.icon}"></i>
            </div>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
        </div>
    `).join('');
}

// ============================================
// SETUP PROFILE CONTENT SECTIONS
// ============================================
function setupProfileContentSections() {
    // This would be called when viewing a specific profile
    if (window.currentProfile) {
        loadProfileFavorites();
        loadProfileWatchHistory();
    }
}

// ============================================
// LOAD PROFILE FAVORITES
// ============================================
async function loadProfileFavorites() {
    const container = document.getElementById('profile-favorites');
    if (!container || !window.currentProfile) return;
    
    try {
        const { data, error } = await supabaseAuth
            .from('favorites')
            .select('*, content:content_id(*)')
            .eq('user_id', window.currentProfile.id)
            .limit(10);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-heart"></i>
                    <p>No favorites yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.map(item => `
            <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.content_id}'">
                <div class="thumbnail-image">
                    ${item.content?.thumbnail_url 
                        ? `<img src="${contentSupabase.fixMediaUrl(item.content.thumbnail_url)}" alt="${escapeHtml(item.content.title)}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<i class="fas fa-film"></i>`
                    }
                </div>
                <div class="thumbnail-info">
                    <div class="thumbnail-title">${escapeHtml(item.content?.title || 'Unknown')}</div>
                    <div class="thumbnail-meta">Added ${formatTimeAgo(item.created_at)}</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

// ============================================
// LOAD PROFILE WATCH HISTORY
// ============================================
async function loadProfileWatchHistory() {
    const container = document.getElementById('profile-history');
    if (!container || !window.currentProfile) return;
    
    try {
        const { data, error } = await supabaseAuth
            .from('watch_history')
            .select('*, content:content_id(*)')
            .eq('user_id', window.currentProfile.id)
            .order('watched_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-history"></i>
                    <p>No watch history yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.map(item => `
            <div class="content-thumbnail" onclick="window.location.href='watch.html?id=${item.content_id}'">
                <div class="thumbnail-image">
                    ${item.content?.thumbnail_url 
                        ? `<img src="${contentSupabase.fixMediaUrl(item.content.thumbnail_url)}" alt="${escapeHtml(item.content.title)}" style="width:100%;height:100%;object-fit:cover;">`
                        : `<i class="fas fa-film"></i>`
                    }
                </div>
                <div class="thumbnail-info">
                    <div class="thumbnail-title">${escapeHtml(item.content?.title || 'Unknown')}</div>
                    <div class="thumbnail-meta">Watched ${formatTimeAgo(item.watched_at)}</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading watch history:', error);
    }
}

// Export functions
window.initializeManageProfilesFeatures = initializeManageProfilesFeatures;
window.loadWatchPartyContent = loadWatchPartyContent;
window.loadUserBadges = loadUserBadges;
window.loadProfileFavorites = loadProfileFavorites;
window.loadProfileWatchHistory = loadProfileWatchHistory;
