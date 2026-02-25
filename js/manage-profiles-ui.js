// ============================================
// MANAGE PROFILES UI - UI Interaction Handlers (continued)
// ============================================

function initializeManageProfilesUI() {
    console.log('🎯 Initializing Manage Profiles UI');
    
    // Setup UI components
    setupToastContainer();
    setupBackToTop();
    setupUIWidgets();
    setupThemeSelector();
    setupScaleControl();
    setupKeyboardShortcuts();
}

// ============================================
// TOAST CONTAINER SETUP
// ============================================
function setupToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

// ============================================
// UI WIDGETS SETUP
// ============================================
function setupUIWidgets() {
    // Show UI scale control after a delay
    setTimeout(() => {
        const scaleControl = document.getElementById('ui-scale-control');
        if (scaleControl) {
            scaleControl.classList.add('active');
        }
    }, 2000);
    
    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ============================================
// CLOSE ALL MODALS
// ============================================
function closeAllModals() {
    const modals = [
        'profile-modal',
        'delete-modal',
        'delete-all-modal',
        'search-modal',
        'notifications-panel',
        'analytics-modal',
        'watch-party-modal',
        'tip-modal',
        'badges-modal',
        'theme-selector'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    });
    
    // Also close profile dropdown if open
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        profileDropdown.classList.remove('active');
    }
}

// ============================================
// THEME SELECTOR SETUP
// ============================================
function setupThemeSelector() {
    const themeSelector = document.getElementById('theme-selector');
    if (!themeSelector) return;
    
    // Load saved theme
    const savedTheme = localStorage.getItem('bantu_theme') || 'dark';
    applyTheme(savedTheme);
    
    // Theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeSelector.classList.remove('active');
        });
    });
    
    // Close theme selector when clicking outside
    document.addEventListener('click', (e) => {
        if (!themeSelector.contains(e.target) && !e.target.closest('#sidebar-theme-toggle')) {
            themeSelector.classList.remove('active');
        }
    });
}

// ============================================
// APPLY THEME
// ============================================
function applyTheme(theme) {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    
    switch(theme) {
        case 'light':
            root.classList.add('theme-light');
            root.style.setProperty('--deep-black', '#ffffff');
            root.style.setProperty('--soft-white', '#1a1a1a');
            root.style.setProperty('--slate-grey', '#666666');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
            root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.1)');
            break;
            
        case 'high-contrast':
            root.classList.add('theme-high-contrast');
            root.style.setProperty('--deep-black', '#000000');
            root.style.setProperty('--soft-white', '#ffffff');
            root.style.setProperty('--slate-grey', '#ffff00');
            root.style.setProperty('--warm-gold', '#ff0000');
            root.style.setProperty('--bantu-blue', '#00ff00');
            root.style.setProperty('--card-bg', '#000000');
            root.style.setProperty('--card-border', '#ffffff');
            break;
            
        default: // dark theme
            root.classList.add('theme-dark');
            root.style.setProperty('--deep-black', '#0A0A0A');
            root.style.setProperty('--soft-white', '#F5F5F5');
            root.style.setProperty('--slate-grey', '#A0A0A0');
            root.style.setProperty('--warm-gold', '#F59E0B');
            root.style.setProperty('--bantu-blue', '#1D4ED8');
            root.style.setProperty('--card-bg', 'rgba(18, 18, 18, 0.95)');
            root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.1)');
            break;
    }
    
    localStorage.setItem('bantu_theme', theme);
    showToast(`Theme changed to ${theme}`, 'success');
}

// ============================================
// SCALE CONTROL SETUP
// ============================================
function setupScaleControl() {
    const decreaseBtn = document.getElementById('scale-decrease');
    const increaseBtn = document.getElementById('scale-increase');
    const resetBtn = document.getElementById('scale-reset');
    
    if (!window.uiScaleController) {
        window.uiScaleController = new UIScaleController();
        window.uiScaleController.init();
    }
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            window.uiScaleController.decrease();
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            window.uiScaleController.increase();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.uiScaleController.reset();
        });
    }
}

// ============================================
// KEYBOARD SHORTCUTS SETUP
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in an input
        if (e.target.matches('input, textarea, select')) return;
        
        // Ctrl/Cmd + K: Open search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
        }
        
        // Alt + N: Open notifications
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            toggleNotifications();
        }
        
        // Alt + A: Open analytics
        if (e.altKey && e.key === 'a') {
            e.preventDefault();
            openAnalytics();
        }
        
        // Alt + P: Open profile dropdown
        if (e.altKey && e.key === 'p') {
            e.preventDefault();
            toggleProfileDropdown();
        }
        
        // Ctrl + N: New profile
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (window.currentUser) {
                openCreateProfileModal();
            } else {
                showToast('Please sign in to create a profile', 'warning');
            }
        }
        
        // ? : Show shortcuts help
        if (e.key === '?' && !e.shiftKey) {
            e.preventDefault();
            showShortcutsHelp();
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
// TOGGLE NOTIFICATIONS
// ============================================
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.classList.toggle('active');
        if (panel.classList.contains('active') && typeof renderNotifications === 'function') {
            renderNotifications();
        }
    }
}

// ============================================
// OPEN ANALYTICS
// ============================================
function openAnalytics() {
    if (!window.currentUser) {
        showToast('Please sign in to view analytics', 'warning');
        return;
    }
    
    const modal = document.getElementById('analytics-modal');
    if (modal) {
        modal.classList.add('active');
        if (typeof loadPersonalAnalytics === 'function') {
            loadPersonalAnalytics();
        }
    }
}

// ============================================
// TOGGLE PROFILE DROPDOWN
// ============================================
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// ============================================
// SHOW SHORTCUTS HELP
// ============================================
function showShortcutsHelp() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// ============================================
// LOAD PERSONAL ANALYTICS
// ============================================
async function loadPersonalAnalytics() {
    if (!window.currentUser) return;
    
    try {
        // Load watch time
        const { data: watchData } = await supabaseAuth
            .from('watch_history')
            .select('duration_seconds')
            .eq('user_id', window.currentUser.id);
        
        const totalSeconds = watchData?.reduce((sum, item) => sum + (item.duration_seconds || 0), 0) || 0;
        const hours = Math.floor(totalSeconds / 3600);
        
        document.getElementById('personal-watch-time').textContent = hours + 'h';
        
        // Load sessions count
        const { count: sessions } = await supabaseAuth
            .from('watch_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', window.currentUser.id);
        
        document.getElementById('personal-sessions').textContent = sessions || 0;
        
        // Load total views
        const { count: views } = await supabaseAuth
            .from('watch_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', window.currentUser.id);
        
        document.getElementById('personal-views').textContent = views || 0;
        
        // Calculate return rate (simplified)
        const returnRate = Math.floor(Math.random() * 30) + 40; // Mock data
        document.getElementById('return-rate').textContent = returnRate + '%';
        
        // Initialize chart
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
    
    // Mock data for the chart
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
                    labels: {
                        color: '#F5F5F5'
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#A0A0A0'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#A0A0A0'
                    }
                }
            }
        }
    });
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
            <div class="notification-avatar">
                <i class="fas ${notification.icon || 'fa-bell'}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${escapeHtml(notification.title)}</div>
                <div class="notification-message">${escapeHtml(notification.message)}</div>
                <div class="notification-time">${formatTimeAgo(notification.created_at)}</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
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
        
        // Update local state
        const notification = window.notifications.find(n => n.id === id);
        if (notification) {
            notification.is_read = true;
        }
        
        // Update badge count
        const unreadCount = window.notifications.filter(n => !n.is_read).length;
        updateNotificationBadge(unreadCount);
        
        // Re-render
        renderNotifications();
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// ============================================
// FORMAT TIME AGO
// ============================================
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
    
    return date.toLocaleDateString();
}

// Export functions
window.initializeManageProfilesUI = initializeManageProfilesUI;
window.closeAllModals = closeAllModals;
window.openSearch = openSearch;
window.toggleNotifications = toggleNotifications;
window.openAnalytics = openAnalytics;
